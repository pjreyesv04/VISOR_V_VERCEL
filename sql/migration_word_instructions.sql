-- ====================================================================
-- Migración: Implementar instrucciones del documento Word V.1.2
-- V.I.S.O.R - Ejecutar en Supabase SQL Editor
-- Fecha: 2026-02-11
-- ====================================================================

-- =========================================================
-- 1) TABLA: participantes_capacitacion (Sección 1.1)
--    Cuando 1.1 = Sí, se abre tabla de participantes
-- =========================================================
CREATE TABLE IF NOT EXISTS participantes_capacitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  apellidos_nombres TEXT NOT NULL DEFAULT '',
  dni TEXT DEFAULT '',
  grupo_ocupacional TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_part_cap_supervision ON participantes_capacitacion(supervision_id);

-- =========================================================
-- 2) TABLA: fua_verificados (Sección 6 - tabla 10 filas FUA)
-- =========================================================
CREATE TABLE IF NOT EXISTS fua_verificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  fila_numero INTEGER NOT NULL DEFAULT 1,
  numero_fua TEXT DEFAULT '',
  fecha_atencion DATE DEFAULT NULL,
  paciente TEXT DEFAULT '',
  diagnostico TEXT DEFAULT '',
  observacion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fua_verif_supervision ON fua_verificados(supervision_id);

-- =========================================================
-- 3) TABLA: verificacion_fua_hc (Sección 7.1 Gratuidad)
--    Verificación FUA vs Historia Clínica
-- =========================================================
CREATE TABLE IF NOT EXISTS verificacion_fua_hc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  fila_numero INTEGER NOT NULL DEFAULT 1,
  numero_fua TEXT DEFAULT '',
  numero_hc TEXT DEFAULT '',
  coincide BOOLEAN DEFAULT NULL,
  observacion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verif_fua_hc_supervision ON verificacion_fua_hc(supervision_id);

-- =========================================================
-- 4) Nuevos campos en parametros para dependencias y
--    cantidades múltiples
-- =========================================================

-- depende_de_codigo: Código del parámetro del que depende (ej: "2.1")
-- depende_valor: Valor que debe tener para que este se active (ej: "no" = solo si 2.1 es No)
-- Esto permite que 2.4 se desactive si 2.1 = Sí
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS depende_de_codigo TEXT DEFAULT NULL;

ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS depende_valor TEXT DEFAULT NULL;

-- tipo_campo_condicional ahora soporta 'cantidad_multiple' para campos con 3 cantidades separadas
-- Actualizamos el CHECK constraint
ALTER TABLE parametros DROP CONSTRAINT IF EXISTS chk_tipo_campo_condicional;
ALTER TABLE parametros
  ADD CONSTRAINT chk_tipo_campo_condicional
  CHECK (tipo_campo_condicional IS NULL OR tipo_campo_condicional IN ('fecha', 'cantidad', 'texto', 'cantidad_multiple', 'tabla_participantes', 'texto_persona'));

-- has_tabla_extra: indica si el parámetro tiene una tabla extra asociada
-- Valores: NULL, 'participantes', 'fua_verificados', 'verificacion_fua_hc'
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS has_tabla_extra TEXT DEFAULT NULL;

-- =========================================================
-- 5) Nuevos campos en respuestas para cantidades múltiples
-- =========================================================
ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS valor_cantidad_2 INTEGER DEFAULT NULL;

ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS valor_cantidad_3 INTEGER DEFAULT NULL;

-- Labels para las cantidades múltiples se gestionan en etiqueta_campo_condicional
-- con formato "HBA1c|Microalbuminuria|Creatinina sérica"

COMMENT ON COLUMN parametros.depende_de_codigo IS 'Código del parámetro del que depende (ej: 2.1). Si este parámetro tiene valor contrario, se desactiva.';
COMMENT ON COLUMN parametros.depende_valor IS 'Valor que activa la dependencia: si/no. Ej: depende_valor=no y depende_de_codigo=2.1 significa "solo visible si 2.1=No"';
COMMENT ON COLUMN parametros.has_tabla_extra IS 'Tabla extra asociada: participantes, fua_verificados, verificacion_fua_hc';
COMMENT ON COLUMN respuestas.valor_cantidad_2 IS 'Segunda cantidad (ej: microalbuminuria)';
COMMENT ON COLUMN respuestas.valor_cantidad_3 IS 'Tercera cantidad (ej: creatinina sérica)';

-- =========================================================
-- 6) RLS para nuevas tablas
-- =========================================================
ALTER TABLE participantes_capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE fua_verificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE verificacion_fua_hc ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados (misma lógica que supervisiones)
CREATE POLICY "allow_all_authenticated_participantes" ON participantes_capacitacion
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_fua" ON fua_verificados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_verif" ON verificacion_fua_hc
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
