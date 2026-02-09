-- ====================================================================
-- SOLUCIÓN TEMPORAL: Deshabilitar RLS para diagnosticar
-- VISOR - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Deshabilitar RLS temporalmente
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- PASO 2: Verificar que todos los usuarios tienen perfil
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  up.id as profile_id,
  up.nombre,
  up.role,
  up.activo,
  CASE 
    WHEN up.id IS NULL THEN '❌ SIN PERFIL'
    WHEN u.email_confirmed_at IS NULL THEN '❌ EMAIL NO CONFIRMADO'
    WHEN up.activo = false THEN '❌ USUARIO INACTIVO'
    ELSE '✅ OK'
  END as diagnostico
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at DESC;

-- PASO 3: Crear perfiles faltantes
INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'nombre', u.email),
  'auditor',
  true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = u.id);

-- PASO 4: Confirmar emails
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- PASO 5: Activar todos los usuarios
UPDATE user_profiles 
SET activo = true
WHERE activo = false;

-- PASO 6: Verificación final
SELECT 
  u.email,
  up.nombre,
  up.role,
  up.activo,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  '✅ AHORA DEBERÍA FUNCIONAR' as estado
FROM auth.users u
INNER JOIN user_profiles up ON u.id = up.user_id;

-- ====================================================================
-- NOTA: Con RLS deshabilitado, CUALQUIER usuario puede leer/modificar
-- TODOS los perfiles. Esto es TEMPORAL solo para diagnóstico.
-- Una vez funcionando, vuelve a habilitar RLS ejecutando:
-- 
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- 
-- Y luego contacta para configurar políticas correctas.
-- ====================================================================
