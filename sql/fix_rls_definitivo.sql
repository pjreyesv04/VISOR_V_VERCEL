-- ====================================================================
-- SOLUCIÓN DEFINITIVA: Políticas RLS para user_profiles
-- VISOR - Sistema de Supervisión
-- ====================================================================
-- Este script resuelve los problemas de autenticación y pérdida de sesión
-- causados por políticas RLS mal configuradas.
--
-- EJECUTAR EN: Supabase SQL Editor
-- ====================================================================

-- ====================
-- PASO 1: LIMPIEZA TOTAL
-- ====================

-- Eliminar TODAS las políticas existentes (limpiar estado anterior)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
        RAISE NOTICE 'Eliminada política: %', r.policyname;
    END LOOP;
END $$;

-- ====================
-- PASO 2: HABILITAR RLS
-- ====================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ====================
-- PASO 3: POLÍTICAS DEFINITIVAS Y OPTIMIZADAS
-- ====================

-- ====================================================================
-- POLÍTICA 1: Lectura del propio perfil (TODOS los usuarios autenticados)
-- ====================================================================
-- Permite que cualquier usuario autenticado lea su propio perfil
-- CRÍTICO: Sin esta política, los usuarios no pueden cargar su perfil al iniciar sesión

CREATE POLICY "enable_read_own_profile"
ON user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "enable_read_own_profile" ON user_profiles IS 
'Permite a usuarios autenticados leer su propio perfil. CRÍTICO para inicio de sesión.';

-- ====================================================================
-- POLÍTICA 2: Actualización del propio perfil
-- ====================================================================
-- Permite que los usuarios actualicen su propio perfil (nombre, etc.)

CREATE POLICY "enable_update_own_profile"
ON user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "enable_update_own_profile" ON user_profiles IS 
'Permite a usuarios autenticados actualizar su propio perfil.';

-- ====================================================================
-- POLÍTICA 3: Inserción de perfil durante registro
-- ====================================================================
-- Permite crear el perfil cuando un nuevo usuario se registra
-- El trigger handle_new_user() usa esta política

CREATE POLICY "enable_insert_profile"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "enable_insert_profile" ON user_profiles IS 
'Permite crear perfil durante el registro. Usado por trigger handle_new_user().';

-- ====================================================================
-- POLÍTICA 4: Admins pueden leer TODOS los perfiles
-- ====================================================================
-- OPTIMIZACIÓN: Usa subconsulta con LIMIT 1 para evitar recursión infinita
-- La subconsulta se ejecuta UNA SOLA VEZ por consulta

CREATE POLICY "enable_admin_read_all"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  -- Si el usuario actual tiene rol admin, puede leer todos los perfiles
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    LIMIT 1
  )
);

COMMENT ON POLICY "enable_admin_read_all" ON user_profiles IS 
'Permite a administradores leer todos los perfiles de usuarios.';

-- ====================================================================
-- POLÍTICA 5: Admins pueden actualizar TODOS los perfiles
-- ====================================================================
-- Permite a admins cambiar roles, nombres, estado activo de cualquier usuario

CREATE POLICY "enable_admin_update_all"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    LIMIT 1
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    LIMIT 1
  )
);

COMMENT ON POLICY "enable_admin_update_all" ON user_profiles IS 
'Permite a administradores actualizar cualquier perfil (rol, nombre, activo).';

-- ====================================================================
-- POLÍTICA 6: Admins pueden eliminar perfiles (para delete_user_safely)
-- ====================================================================
-- Necesario para la función de eliminación de usuarios

CREATE POLICY "enable_admin_delete"
ON user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    LIMIT 1
  )
);

COMMENT ON POLICY "enable_admin_delete" ON user_profiles IS 
'Permite a administradores eliminar usuarios (vía delete_user_safely).';

-- ====================
-- PASO 4: VERIFICACIÓN
-- ====================

-- Verificar que RLS está habilitado
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'user_profiles';
  
  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS está HABILITADO en user_profiles';
  ELSE
    RAISE EXCEPTION '❌ ERROR: RLS NO está habilitado en user_profiles';
  END IF;
END $$;

-- Contar políticas creadas
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_profiles';
  
  RAISE NOTICE '✅ Se crearon % políticas en user_profiles', policy_count;
  
  IF policy_count < 6 THEN
    RAISE WARNING '⚠️ Se esperaban 6 políticas, solo hay %', policy_count;
  END IF;
END $$;

-- Listar todas las políticas creadas
SELECT 
  policyname AS "Política",
  cmd AS "Comando",
  CASE 
    WHEN policyname LIKE '%admin%' THEN '👑 Admin'
    WHEN policyname LIKE '%own%' THEN '👤 Usuario'
    WHEN policyname LIKE '%insert%' THEN '➕ Registro'
    ELSE '❓'
  END AS "Tipo"
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- ====================
-- PASO 5: VERIFICAR USUARIOS
-- ====================

-- Verificar que todos los usuarios tienen perfil
SELECT 
  u.email AS "Email Usuario",
  COALESCE(up.nombre, '❌ SIN PERFIL') AS "Nombre",
  COALESCE(up.role, '❌ SIN ROL') AS "Rol",
  CASE 
    WHEN up.activo IS TRUE THEN '✅ Activo'
    WHEN up.activo IS FALSE THEN '⚠️ Inactivo'
    ELSE '❌ SIN ESTADO'
  END AS "Estado",
  CASE
    WHEN u.email_confirmed_at IS NULL THEN '⚠️ No confirmado'
    ELSE '✅ Confirmado'
  END AS "Email"
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at;

-- ====================
-- PASO 6: CREAR PERFILES FALTANTES (si existen)
-- ====================

INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT 
  u.id,
  u.email,
  'auditor',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Verificar si se crearon perfiles
DO $$
DECLARE
  created_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO created_count
  FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM user_profiles WHERE user_id = u.id);
  
  RAISE NOTICE '✅ Total de usuarios con perfil: %', created_count;
END $$;

-- ====================
-- PASO 7: CONFIRMAR EMAILS (solo en desarrollo)
-- ====================

-- ⚠️ COMENTAR ESTA LÍNEA EN PRODUCCIÓN
-- UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- ====================
-- RESUMEN FINAL
-- ====================

SELECT 
  '✅ SCRIPT COMPLETADO' AS "Estado",
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_profiles') AS "Total Políticas",
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_profiles') AS "RLS Habilitado",
  (SELECT COUNT(*) FROM user_profiles) AS "Usuarios con Perfil";

-- ====================================================================
-- NOTAS IMPORTANTES:
-- ====================================================================
-- 1. Este script es idempotente: se puede ejecutar múltiples veces sin problemas
-- 2. Las políticas usan EXISTS con LIMIT 1 para optimizar performance
-- 3. La política enable_read_own_profile es CRÍTICA para login
-- 4. Si hay problemas, ejecutar: ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
--    luego investigar y volver a ejecutar este script
-- 5. Para diagnóstico adicional, usar: sql/diagnostic_auth_system.sql
-- ====================================================================
