-- ====================================================================
-- FIX: Permitir a usuarios autenticados leer nombres de auditores
-- VISOR - Sistema de Supervisión
-- Fecha: 2026-02-24
-- ====================================================================
-- Contexto: El rol "viewer" necesita leer el `nombre` de los auditores
-- en user_profiles para mostrar el Dashboard correctamente.
--
-- PROBLEMA con USING(true): hace redundantes las otras políticas SELECT
-- y expone perfiles de admins/viewers a todos los usuarios autenticados.
--
-- SOLUCIÓN: Política granular que solo expone perfiles con roles operativos
-- (auditor, supervisor_informatico) a cualquier usuario autenticado.
--
-- EJECUTAR EN: Supabase → SQL Editor
-- ====================================================================

-- Eliminar política anterior si existe (idempotente)
DROP POLICY IF EXISTS "enable_authenticated_read_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "enable_read_auditor_names"             ON user_profiles;

-- Política granular: cualquier usuario autenticado puede leer perfiles
-- de auditores y supervisores IT (para mostrar nombres en la UI).
-- No expone perfiles de viewers ni admins a roles no-admin.
CREATE POLICY "enable_read_auditor_names"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id        -- siempre puedes leer tu propio perfil
  OR
  EXISTS (                    -- admins leen todos (mantiene política existente)
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
    LIMIT 1
  )
  OR
  role IN ('auditor', 'supervisor_informatico')  -- cualquier autenticado lee perfiles operativos
);

COMMENT ON POLICY "enable_read_auditor_names" ON user_profiles IS
'Permite leer perfiles de auditores/supervisores IT a cualquier usuario autenticado.
Necesario para mostrar nombres en el Dashboard del viewer.
No expone perfiles de admins ni viewers a roles no-admin.
Complementa (no reemplaza) las políticas enable_read_own_profile y enable_admin_read_all.';

-- ====================================================================
-- VERIFICACIÓN: Ejecutar esto para confirmar el estado final
-- ====================================================================
SELECT
  policyname  AS "Política",
  cmd         AS "Tipo",
  roles       AS "Roles",
  qual        AS "Condición USING"
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- ====================================================================
-- RESULTADO ESPERADO: 4 políticas en total
--   enable_admin_delete                       DELETE
--   enable_admin_read_all                     SELECT  (admin lee todos)
--   enable_admin_update_all                   UPDATE
--   enable_insert_profile                     INSERT
--   enable_read_auditor_names                 SELECT  ← NUEVA
--   enable_read_own_profile                   SELECT  (tu propio perfil)
--   enable_update_own_profile                 UPDATE
-- ====================================================================
