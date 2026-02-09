-- ====================================================================
-- Agregar funcionalidad de eliminación de usuarios con auditor eliminado
-- VISOR - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Agregar columna para guardar el nombre del auditor eliminado
ALTER TABLE supervisiones 
ADD COLUMN IF NOT EXISTS auditor_nombre_eliminado TEXT;

-- PASO 2: Agregar columna booleana para marcar si el auditor fue eliminado
ALTER TABLE supervisiones 
ADD COLUMN IF NOT EXISTS auditor_eliminado BOOLEAN DEFAULT false;

-- PASO 3: Crear función para eliminar usuario de forma segura
CREATE OR REPLACE FUNCTION public.delete_user_safely(user_id_to_delete UUID)
RETURNS JSON AS $$
DECLARE
  user_profile RECORD;
  admin_count INTEGER;
  supervision_count INTEGER;
  result JSON;
BEGIN
  -- Verificar que el usuario existe
  SELECT * INTO user_profile 
  FROM user_profiles 
  WHERE user_id = user_id_to_delete;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;
  
  -- Verificar que no es el último admin
  IF user_profile.role = 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_profiles
    WHERE role = 'admin' AND activo = true AND user_id != user_id_to_delete;
    
    IF admin_count = 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'No se puede eliminar el último administrador del sistema'
      );
    END IF;
  END IF;
  
  -- Contar supervisiones del usuario
  SELECT COUNT(*) INTO supervision_count
  FROM supervisiones
  WHERE auditor_id = user_id_to_delete;
  
  -- Marcar las supervisiones como "auditor eliminado" y guardar el nombre
  UPDATE supervisiones
  SET 
    auditor_eliminado = true,
    auditor_nombre_eliminado = user_profile.nombre
  WHERE auditor_id = user_id_to_delete;
  
  -- Establecer auditor_id como NULL para que no falle la FK cuando se elimine el usuario
  UPDATE supervisiones
  SET auditor_id = NULL
  WHERE auditor_id = user_id_to_delete;
  
  -- Eliminar el usuario de auth.users (esto eliminará automáticamente user_profiles por CASCADE)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
  -- Retornar resultado exitoso
  RETURN json_build_object(
    'success', true,
    'message', 'Usuario eliminado correctamente',
    'deleted_user', user_profile.nombre,
    'supervisions_affected', supervision_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: Modificar la FK de supervisiones para permitir NULL en auditor_id
-- Primero eliminamos la constraint existente si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'supervisiones_auditor_id_fkey' 
    AND table_name = 'supervisiones'
  ) THEN
    ALTER TABLE supervisiones DROP CONSTRAINT supervisiones_auditor_id_fkey;
  END IF;
END $$;

-- Recrear la constraint permitiendo NULL y con ON DELETE SET NULL
ALTER TABLE supervisiones
ADD CONSTRAINT supervisiones_auditor_id_fkey 
FOREIGN KEY (auditor_id) 
REFERENCES user_profiles(user_id) 
ON DELETE SET NULL;

-- PASO 5: Comentarios de documentación
COMMENT ON COLUMN supervisiones.auditor_nombre_eliminado IS 'Nombre del auditor si fue eliminado del sistema';
COMMENT ON COLUMN supervisiones.auditor_eliminado IS 'Marca si el auditor que creó esta supervisión fue eliminado';
COMMENT ON FUNCTION public.delete_user_safely IS 'Elimina un usuario de forma segura, preservando el historial de sus supervisiones';

-- ====================================================================
-- VERIFICACIÓN: Consultar usuarios y sus supervisiones
-- ====================================================================
-- SELECT 
--   up.nombre,
--   up.role,
--   up.activo,
--   COUNT(s.id) as total_supervisiones
-- FROM user_profiles up
-- LEFT JOIN supervisiones s ON s.auditor_id = up.user_id
-- GROUP BY up.id, up.nombre, up.role, up.activo
-- ORDER BY up.nombre;
-- ====================================================================

-- ====================================================================
-- EJEMPLO DE USO:
-- ====================================================================
-- Para eliminar un usuario de forma segura:
-- SELECT delete_user_safely('UUID_DEL_USUARIO_A_ELIMINAR');
-- 
-- Ejemplo:
-- SELECT delete_user_safely('e6cc5f9f-8e3a-476c-829a-bac9fe222e2f');
-- ====================================================================
