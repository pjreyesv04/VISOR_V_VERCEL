-- ====================================================================
-- Migración: Soporte de campos condicionales en formulario de supervisión
-- V.I.S.O.R - Ejecutar en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Agregar metadatos de campo condicional a parametros
-- tipo_campo_condicional: Qué tipo de input adicional mostrar
--   NULL = sin campo condicional (estándar Sí/No + observación)
--   'fecha' = selector de fecha
--   'cantidad' = input numérico
--   'texto' = input de texto libre / nombre
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS tipo_campo_condicional TEXT DEFAULT NULL;

-- condicion_campo: Cuándo mostrar el campo condicional
--   NULL = nunca (estándar)
--   'si' = mostrar solo cuando la respuesta es Sí (valor_bool = true)
--   'no' = mostrar solo cuando la respuesta es No (valor_bool = false)
--   'siempre' = mostrar siempre sin importar la respuesta Sí/No
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS condicion_campo TEXT DEFAULT NULL;

-- etiqueta_campo_condicional: Label personalizado para el input condicional
--   Ej: "Fecha de capacitación", "Cantidad de pacientes", "Nombre del digitador"
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS etiqueta_campo_condicional TEXT DEFAULT NULL;

-- Restricciones CHECK para valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tipo_campo_condicional'
  ) THEN
    ALTER TABLE parametros
      ADD CONSTRAINT chk_tipo_campo_condicional
      CHECK (tipo_campo_condicional IS NULL OR tipo_campo_condicional IN ('fecha', 'cantidad', 'texto'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_condicion_campo'
  ) THEN
    ALTER TABLE parametros
      ADD CONSTRAINT chk_condicion_campo
      CHECK (condicion_campo IS NULL OR condicion_campo IN ('si', 'no', 'siempre'));
  END IF;
END $$;

-- PASO 2: Agregar columnas de valor a respuestas
ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS valor_fecha DATE DEFAULT NULL;

ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS valor_cantidad INTEGER DEFAULT NULL;

ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS valor_texto TEXT DEFAULT NULL;

-- PASO 3: Todas las preguntas deben tener observación habilitada
UPDATE parametros SET requiere_observacion = true WHERE requiere_observacion = false;

-- PASO 4: Comentarios de documentación
COMMENT ON COLUMN parametros.tipo_campo_condicional IS 'Tipo de input condicional: fecha, cantidad, texto, o NULL';
COMMENT ON COLUMN parametros.condicion_campo IS 'Cuándo mostrar campo condicional: si, no, siempre, o NULL';
COMMENT ON COLUMN parametros.etiqueta_campo_condicional IS 'Label personalizado para el campo condicional';
COMMENT ON COLUMN respuestas.valor_fecha IS 'Respuesta de fecha para campos condicionales tipo fecha';
COMMENT ON COLUMN respuestas.valor_cantidad IS 'Respuesta numérica para campos condicionales tipo cantidad';
COMMENT ON COLUMN respuestas.valor_texto IS 'Respuesta de texto para campos condicionales tipo texto/nombre';
