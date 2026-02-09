-- ====================================================================
-- Resetear contraseña de usuario específico
-- VISOR - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Verificar usuario
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  up.nombre,
  up.role,
  up.activo
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'miguelixyu@gmail.com';

-- ====================================================================
-- PARA RESETEAR CONTRASEÑA:
-- ====================================================================
-- NO es posible cambiar la contraseña directamente desde SQL.
-- Tienes 3 opciones:
--
-- OPCIÓN 1: Usar Supabase Dashboard (RECOMENDADO)
-- 1. Ve a Authentication → Users
-- 2. Busca miguelixyu@gmail.com
-- 3. Click en el usuario → "Send password reset email"
-- 4. O click en "..." → "Reset password" para cambiar manualmente
--
-- OPCIÓN 2: Desde el código (UserManagement.jsx)
-- Como admin, ve a Gestión de Usuarios y edita el usuario
-- Aunque esto solo actualiza el perfil, no la contraseña
--
-- OPCIÓN 3: Eliminar y recrear usuario (ÚLTIMA OPCIÓN)
-- Solo si es necesario:
-- 
-- -- 1. Eliminar usuario existente
-- DELETE FROM auth.users WHERE email = 'miguelixyu@gmail.com';
-- 
-- -- 2. Crear nuevo usuario desde UserManagement.jsx en la app
-- -- con email: miguelixyu@gmail.com
-- -- y contraseña: [tu_nueva_contraseña]
--
-- ====================================================================

-- PASO 2: Verificar que el usuario está activo y confirmado
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'miguelixyu@gmail.com' 
AND email_confirmed_at IS NULL;

UPDATE user_profiles 
SET activo = true
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'miguelixyu@gmail.com');

-- PASO 3: Verificación final
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  up.activo,
  '⚠️ Si sigue sin funcionar, resetea la contraseña desde Dashboard' as nota
FROM auth.users u
INNER JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'miguelixyu@gmail.com';
