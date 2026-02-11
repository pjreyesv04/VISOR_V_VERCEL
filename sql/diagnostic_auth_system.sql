-- ====================================================================
-- SCRIPT DE DIAGNÓSTICO DEL SISTEMA DE AUTENTICACIÓN
-- VISOR - Sistema de Supervisión
-- ====================================================================
-- Este script ayuda a diagnosticar problemas de autenticación, RLS,
-- usuarios sin perfil, y configuración general del sistema.
--
-- EJECUTAR EN: Supabase SQL Editor
-- MODO: Solo lectura (no modifica datos)
-- ====================================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO DEL SISTEMA DE AUTENTICACIÓN';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

-- ====================
-- 1. VERIFICAR ESTADO DE RLS
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣ ESTADO DE ROW LEVEL SECURITY (RLS)';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  schemaname AS "Schema",
  tablename AS "Tabla",
  CASE 
    WHEN rowsecurity = true THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END AS "Estado RLS"
FROM pg_tables
WHERE tablename IN ('user_profiles', 'supervisiones', 'respuestas', 'evidencias', 'parametros')
ORDER BY tablename;

-- ====================
-- 2. POLÍTICAS RLS EN user_profiles
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣ POLÍTICAS RLS EN user_profiles';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  policyname AS "Nombre Política",
  cmd AS "Comando",
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permisiva'
    ELSE '⚠️ Restrictiva'
  END AS "Tipo",
  CASE 
    WHEN policyname LIKE '%admin%' THEN '👑 Admin'
    WHEN policyname LIKE '%own%' THEN '👤 Usuario propio'
    WHEN policyname LIKE '%insert%' THEN '➕ Inserción'
    WHEN policyname LIKE '%read%' THEN '📖 Lectura'
    WHEN policyname LIKE '%update%' THEN '✏️ Actualización'
    WHEN policyname LIKE '%delete%' THEN '🗑️ Eliminación'
    ELSE '❓ Otra'
  END AS "Categoría"
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- Verificar si hay políticas suficientes
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_profiles';
  
  IF policy_count = 0 THEN
    RAISE WARNING '⚠️ NO HAY POLÍTICAS EN user_profiles - Los usuarios no podrán acceder';
  ELSIF policy_count < 6 THEN
    RAISE WARNING '⚠️ Solo hay % políticas (se esperan al menos 6)', policy_count;
  ELSE
    RAISE NOTICE '✅ Hay % políticas configuradas', policy_count;
  END IF;
END $$;

-- ====================
-- 3. USUARIOS Y PERFILES
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣ ESTADO DE USUARIOS Y PERFILES';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  u.email AS "📧 Email",
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS "Email Confirmado",
  COALESCE(up.nombre, '⚠️ SIN PERFIL') AS "👤 Nombre",
  COALESCE(up.role, '❌ SIN ROL') AS "🎭 Rol",
  CASE 
    WHEN up.activo IS TRUE THEN '✅ Activo'
    WHEN up.activo IS FALSE THEN '⛔ Inactivo'
    ELSE '❌ Sin estado'
  END AS "Estado",
  TO_CHAR(u.created_at, 'YYYY-MM-DD HH24:MI') AS "📅 Creado",
  CASE
    WHEN up.user_id IS NULL THEN '🚨 FALTA PERFIL'
    ELSE '✅ OK'
  END AS "Validación"
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at DESC;

-- Contar usuarios sin perfil
DO $$
DECLARE
  users_without_profile INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_without_profile
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = u.id);
  
  IF users_without_profile > 0 THEN
    RAISE WARNING '🚨 HAY % USUARIOS SIN PERFIL', users_without_profile;
    RAISE NOTICE 'Ejecute: sql/fix_rls_definitivo.sql (PASO 6) para crear los perfiles';
  ELSE
    RAISE NOTICE '✅ Todos los usuarios tienen perfil';
  END IF;
END $$;

-- ====================
-- 4. DISTRIBUCIÓN DE ROLES
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣ DISTRIBUCIÓN DE ROLES';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  COALESCE(role, 'SIN ROL') AS "🎭 Rol",
  COUNT(*) AS "👥 Cantidad",
  STRING_AGG(nombre, ', ') AS "Usuarios"
FROM user_profiles
GROUP BY role
ORDER BY COUNT(*) DESC;

-- Verificar si hay al menos un admin
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM user_profiles
  WHERE role = 'admin' AND activo = true;
  
  IF admin_count = 0 THEN
    RAISE WARNING '🚨 NO HAY ADMINISTRADORES ACTIVOS EN EL SISTEMA';
  ELSIF admin_count = 1 THEN
    RAISE NOTICE '⚠️ Solo hay 1 administrador (cuidado al eliminar usuarios)';
  ELSE
    RAISE NOTICE '✅ Hay % administradores activos', admin_count;
  END IF;
END $$;

-- ====================
-- 5. SUPERVISIONES POR USUARIO
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5️⃣ SUPERVISIONES POR USUARIO';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  COALESCE(up.nombre, '⚠️ Auditor eliminado') AS "👤 Auditor",
  COALESCE(up.role, 'N/A') AS "Rol",
  COUNT(s.id) AS "📋 Total Supervisiones",
  SUM(CASE WHEN s.estado = 'completado' THEN 1 ELSE 0 END) AS "✅ Completadas",
  SUM(CASE WHEN s.estado = 'borrador' THEN 1 ELSE 0 END) AS "📝 Borradores",
  SUM(CASE WHEN s.auditor_eliminado = true THEN 1 ELSE 0 END) AS "🗑️ Auditor eliminado"
FROM supervisiones s
LEFT JOIN user_profiles up ON s.auditor_id = up.user_id
GROUP BY up.nombre, up.role
ORDER BY COUNT(s.id) DESC;

-- ====================
-- 6. TRIGGER DE CREACIÓN DE PERFILES
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '6️⃣ TRIGGER handle_new_user';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

SELECT 
  tgname AS "Trigger",
  tgenabled AS "Estado",
  pg_get_functiondef(tgfoid) AS "Función"
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Verificar si existe la función
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    RAISE NOTICE '✅ Función handle_new_user existe';
  ELSE
    RAISE WARNING '❌ Función handle_new_user NO existe - Los nuevos usuarios no tendrán perfil';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    RAISE NOTICE '✅ Trigger on_auth_user_created existe';
  ELSE
    RAISE WARNING '❌ Trigger on_auth_user_created NO existe';
  END IF;
END $$;

-- ====================
-- 7. INTEGRIDAD DE DATOS
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '7️⃣ INTEGRIDAD DE DATOS';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

-- Supervisiones sin auditor
SELECT 
  COUNT(*) AS "Total",
  '📋 Supervisiones sin auditor' AS "Descripción"
FROM supervisiones
WHERE auditor_id IS NULL AND auditor_eliminado = false
UNION ALL
-- Supervisiones con auditor eliminado
SELECT 
  COUNT(*),
  '🗑️ Supervisiones con auditor eliminado'
FROM supervisiones
WHERE auditor_eliminado = true
UNION ALL
-- Respuestas huérfanas (sin supervisión)
SELECT 
  COUNT(*),
  '⚠️ Respuestas sin supervisión'
FROM respuestas r
WHERE NOT EXISTS (SELECT 1 FROM supervisiones WHERE id = r.supervision_id)
UNION ALL
-- Evidencias huérfanas
SELECT 
  COUNT(*),
  '⚠️ Evidencias sin supervisión'
FROM evidencias e
WHERE NOT EXISTS (SELECT 1 FROM supervisiones WHERE id = e.supervision_id);

-- ====================
-- 8. PROBLEMAS DETECTADOS
-- ====================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '8️⃣ RESUMEN DE PROBLEMAS DETECTADOS';
  RAISE NOTICE '────────────────────────────────────────';
END $$;

DO $$
DECLARE
  rls_disabled BOOLEAN;
  users_without_profile INTEGER;
  no_admins BOOLEAN;
  no_policies BOOLEAN;
  orphaned_data INTEGER;
  problems_found BOOLEAN := false;
BEGIN
  -- Verificar RLS
  SELECT NOT rowsecurity INTO rls_disabled
  FROM pg_tables
  WHERE tablename = 'user_profiles';
  
  -- Verificar usuarios sin perfil
  SELECT COUNT(*) INTO users_without_profile
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = u.id);
  
  -- Verificar admins
  SELECT COUNT(*) = 0 INTO no_admins
  FROM user_profiles
  WHERE role = 'admin' AND activo = true;
  
  -- Verificar políticas
  SELECT COUNT(*) = 0 INTO no_policies
  FROM pg_policies
  WHERE tablename = 'user_profiles';
  
  -- Verificar datos huérfanos
  SELECT 
    (SELECT COUNT(*) FROM respuestas r WHERE NOT EXISTS (SELECT 1 FROM supervisiones WHERE id = r.supervision_id)) +
    (SELECT COUNT(*) FROM evidencias e WHERE NOT EXISTS (SELECT 1 FROM supervisiones WHERE id = e.supervision_id))
  INTO orphaned_data;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  IF rls_disabled THEN
    RAISE WARNING '🚨 CRÍTICO: RLS está DESHABILITADO en user_profiles';
    RAISE NOTICE 'Solución: Ejecutar sql/fix_rls_definitivo.sql';
    problems_found := true;
  END IF;
  
  IF users_without_profile > 0 THEN
    RAISE WARNING '⚠️ ALTO: % usuarios sin perfil', users_without_profile;
    RAISE NOTICE 'Solución: Ejecutar PASO 6 de sql/fix_rls_definitivo.sql';
    problems_found := true;
  END IF;
  
  IF no_admins THEN
    RAISE WARNING '🚨 CRÍTICO: No hay administradores activos';
    RAISE NOTICE 'Solución: UPDATE user_profiles SET role = ''admin'' WHERE email = ''tu_email@email.com'';';
    problems_found := true;
  END IF;
  
  IF no_policies THEN
    RAISE WARNING'🚨 CRÍTICO: No hay políticas RLS en user_profiles';
    RAISE NOTICE 'Solución: Ejecutar sql/fix_rls_definitivo.sql';
    problems_found := true;
  END IF;
  
  IF orphaned_data > 0 THEN
    RAISE WARNING '⚠️ MEDIO: Hay % registros huérfanos', orphaned_data;
    RAISE NOTICE 'Solución: Revisar integridad referencial';
    problems_found := true;
  END IF;
  
  IF NOT problems_found THEN
    RAISE NOTICE '✅ ¡NO SE DETECTARON PROBLEMAS!';
    RAISE NOTICE '✅ El sistema está configurado correctamente';
  END IF;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '✅ DIAGNÓSTICO COMPLETADO';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '💡 TIPS:';
  RAISE NOTICE '  • Para ver más detalles de una tabla: SELECT * FROM user_profiles;';
  RAISE NOTICE '  • Para habilitar debug en frontend: localStorage.setItem("AUTH_DEBUG", "true")';
  RAISE NOTICE '  • Para solucionar problemas: ejecutar sql/fix_rls_definitivo.sql';
  RAISE NOTICE '  • Para documentación: ver TROUBLESHOOTING.md';
  RAISE NOTICE '';
END $$;
