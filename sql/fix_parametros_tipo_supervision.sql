-- ====================================================================
-- MIGRACIÓN: Agregar columna tipo_supervision a tabla parametros
-- PROPÓSITO: Separar parámetros de Supervisión General vs Informática
-- ====================================================================

-- 1. Agregar columna tipo_supervision si no existe
ALTER TABLE parametros
ADD COLUMN IF NOT EXISTS tipo_supervision VARCHAR(50) DEFAULT 'general';

-- 2. Actualizar parámetros existentes que no sean informáticos a 'general'
-- (Los que ya tienen 'informatico' en el seed se quedarán así)
UPDATE parametros
SET tipo_supervision = 'general'
WHERE tipo_supervision IS NULL OR tipo_supervision = '';

-- 3. Crear índice para mejorar queries de filtrado
CREATE INDEX IF NOT EXISTS idx_parametros_tipo_supervision ON parametros(tipo_supervision);

-- 4. Agregar constraint para asegurar valores válidos
ALTER TABLE parametros
ADD CONSTRAINT chk_tipo_supervision CHECK (tipo_supervision IN ('general', 'informatico'));

-- Verificar que la migración fue exitosa
-- SELECT COUNT(*) as total, tipo_supervision FROM parametros GROUP BY tipo_supervision;
