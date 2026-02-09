-- ====================================================================
-- Setup: Configuración de user_profiles con trigger y políticas RLS
-- VISOR - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Crear tabla user_profiles si no existe
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  role TEXT DEFAULT 'auditor' CHECK (role IN ('admin', 'auditor', 'viewer')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- PASO 2: Habilitar RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- PASO 3: Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Los admins pueden ver todos los perfiles" ON user_profiles;
DROP POLICY IF EXISTS "Los admins pueden actualizar todos los perfiles" ON user_profiles;
DROP POLICY IF EXISTS "Permitir inserción durante registro" ON user_profiles;

-- PASO 4: Crear políticas de acceso
-- Política 1: Los usuarios pueden ver su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política 2: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política 3: Los admins pueden ver todos los perfiles
CREATE POLICY "Los admins pueden ver todos los perfiles"
  ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Política 4: Los admins pueden actualizar todos los perfiles
CREATE POLICY "Los admins pueden actualizar todos los perfiles"
  ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Política 5: Permitir inserción durante registro (trigger automático)
CREATE POLICY "Permitir inserción durante registro"
  ON user_profiles
  FOR INSERT
  WITH CHECK (true);

-- PASO 5: Crear función que se ejecuta al crear nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, nombre, role, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'auditor'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 6: Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- PASO 7: Crear trigger que ejecuta la función al crear usuario
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 8: Comentarios de documentación
COMMENT ON TABLE user_profiles IS 'Perfiles de usuario del sistema VISOR con roles y estado activo';
COMMENT ON COLUMN user_profiles.role IS 'Rol del usuario: admin, auditor, viewer';
COMMENT ON COLUMN user_profiles.activo IS 'Estado del usuario, false = bloqueado';

-- ====================================================================
-- PASO OPCIONAL: Confirmar usuarios existentes sin email verificado
-- ====================================================================
-- Si los usuarios no pueden iniciar sesión porque no confirmaron email:
-- 
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;
-- 
-- ⚠️ Solo ejecutar en desarrollo, en producción debe usar el flujo normal
-- ====================================================================
