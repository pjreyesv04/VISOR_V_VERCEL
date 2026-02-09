-- ====================================================================
-- Script de Diagnóstico y Solución: Problemas de Login
-- VISOR - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: DIAGNÓSTICO - Ver estado del usuario
-- Reemplaza 'pablor.sist04@gmail.com' con el email del usuario con problemas
SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at as user_created,
  up.id as profile_id,
  up.nombre,
  up.role,
  up.activo,
  CASE 
    WHEN u.email_confirmed_at IS NULL THEN '❌ Email NO confirmado'
    ELSE '✅ Email confirmado'
  END as estado_email,
  CASE 
    WHEN up.id IS NULL THEN '❌ SIN perfil en user_profiles'
    ELSE '✅ Tiene perfil'
  END as estado_perfil,
  CASE 
    WHEN up.activo = false THEN '❌ Usuario INACTIVO'
    WHEN up.activo = true THEN '✅ Usuario activo'
    ELSE '⚠️ Estado desconocido'
  END as estado_activo
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'pablor.sist04@gmail.com';
-- Cambia el email arriba ↑

-- ====================================================================
-- PASO 2: SOLUCIÓN RÁPIDA - Ejecutar según el problema detectado
-- ====================================================================

-- SOLUCIÓN A: Confirmar email (si email_confirmed_at es NULL)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'pablor.sist04@gmail.com'
AND email_confirmed_at IS NULL;
-- Cambia el email arriba ↑

-- SOLUCIÓN B: Crear perfil si no existe
INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'nombre', email),
  COALESCE(raw_user_meta_data->>'role', 'auditor'),
  true
FROM auth.users
WHERE email = 'pablor.sist04@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = auth.users.id
);
-- Cambia el email arriba ↑

-- SOLUCIÓN C: Activar usuario si está inactivo
UPDATE user_profiles
SET activo = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'pablor.sist04@gmail.com'
);
-- Cambia el email arriba ↑

-- ====================================================================
-- PASO 3: VERIFICACIÓN FINAL - Confirmar que todo está correcto
-- ====================================================================
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  up.nombre,
  up.role,
  up.activo,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL 
         AND up.id IS NOT NULL 
         AND up.activo = true 
    THEN '✅ USUARIO LISTO PARA LOGIN'
    ELSE '❌ AÚN HAY PROBLEMAS'
  END as estado_final
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'pablor.sist04@gmail.com';
-- Cambia el email arriba ↑

-- ====================================================================
-- SOLUCIÓN D (OPCIONAL): Arreglar TODOS los usuarios con problemas
-- ====================================================================
-- Solo ejecutar si quieres arreglar todos los usuarios del sistema:

-- Confirmar emails de todos los usuarios sin confirmar
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;

-- Crear perfiles faltantes para todos los usuarios
-- INSERT INTO user_profiles (user_id, nombre, role, activo)
-- SELECT 
--   u.id,
--   COALESCE(u.raw_user_meta_data->>'nombre', u.email),
--   COALESCE(u.raw_user_meta_data->>'role', 'auditor'),
--   true
-- FROM auth.users u
-- LEFT JOIN user_profiles up ON u.id = up.user_id
-- WHERE up.id IS NULL;

-- ====================================================================
