-- ====================================================================
-- FIX URGENTE: Arreglar políticas RLS de user_profiles
-- VISOR - Ejecutar INMEDIATAMENTE en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Eliminar TODAS las políticas actuales (están causando problemas)
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Los admins pueden ver todos los perfiles" ON user_profiles;
DROP POLICY IF EXISTS "Los admins pueden actualizar todos los perfiles" ON user_profiles;
DROP POLICY IF EXISTS "Permitir inserción durante registro" ON user_profiles;

-- PASO 2: Crear políticas CORRECTAS que no bloqueen el acceso

-- Política 1: Cualquier usuario autenticado puede leer su propio perfil
CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política 2: Los usuarios pueden actualizar su propio perfil (solo nombre)
CREATE POLICY "users_update_own_profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política 3: Los admins pueden leer TODOS los perfiles
CREATE POLICY "admins_read_all_profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- Política 4: Los admins pueden actualizar TODOS los perfiles
CREATE POLICY "admins_update_all_profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- Política 5: Permitir INSERT durante el registro (para el trigger)
CREATE POLICY "allow_insert_during_signup"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- PASO 3: Verificar que existen perfiles para todos los usuarios
-- Crear perfiles faltantes
INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'nombre', u.email),
  'auditor',
  true
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE up.id IS NULL;

-- PASO 4: Confirmar emails de usuarios (solo en desarrollo)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- PASO 5: Activar todos los usuarios
UPDATE user_profiles 
SET activo = true;

-- ====================================================================
-- VERIFICACIÓN FINAL
-- ====================================================================
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_ok,
  up.nombre,
  up.role,
  up.activo,
  '✅ LISTO' as estado
FROM auth.users u
INNER JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at DESC;
