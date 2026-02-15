-- ====================================================================
-- MIGRACIÓN: Asegurar que supervisiones tengan tipo correcto
-- PROPÓSITO: Separar supervisiones por rol (general vs informatico)
-- ====================================================================

-- 1. Actualizar supervisiones sin tipo a 'general'
UPDATE supervisiones
SET tipo = 'general'
WHERE tipo IS NULL OR tipo = '';

-- 2. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_supervisiones_tipo ON supervisiones(tipo);

-- 3. Crear índice compuesto auditor + tipo
CREATE INDEX IF NOT EXISTS idx_supervisiones_auditor_tipo ON supervisiones(auditor_id, tipo);

-- 4. Agregar constraint para asegurar valores válidos
ALTER TABLE supervisiones
ADD CONSTRAINT chk_supervision_tipo CHECK (tipo IN ('general', 'informatico'));

-- 5. Verificar que la migración fue exitosa
-- SELECT tipo, COUNT(*) as cantidad FROM supervisiones GROUP BY tipo;

-- EXPLICACIÓN:
-- - tipo='general': Supervisión de Médicos Auditores (rol: auditor)
-- - tipo='informatico': Supervisión Informática (rol: supervisor_informatico)
-- - El rol del usuario determina automáticamente el tipo
-- - Los parámetros (preguntas) se filtran por tipo_supervision en la BD
