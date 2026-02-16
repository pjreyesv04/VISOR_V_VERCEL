-- ====================================================================
-- MIGRACIÓN V2: Mejoras al Acta de Supervisión Informática
-- Ejecutar en Supabase SQL Editor
-- ====================================================================

-- ============================================
-- PASO 1: Nuevas columnas en parametros
-- ============================================
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS parametro_padre_id TEXT REFERENCES parametros(id);
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS es_grupo BOOLEAN DEFAULT false;
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS opciones_si TEXT;  -- JSON array opciones cuando Sí
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS opciones_no TEXT;  -- JSON array opciones cuando No
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS campos_si TEXT;    -- JSON config campos extra cuando Sí
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS campos_no TEXT;    -- JSON config campos extra cuando No

-- Nuevas columnas en respuestas
ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS valor_texto_2 TEXT;
ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS valor_texto_3 TEXT;

-- Tabla de sepelios para C.5
CREATE TABLE IF NOT EXISTS sepelios_supervisados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  fila_numero INTEGER NOT NULL,
  dni TEXT,
  nombre_afiliado TEXT,
  fecha_registro DATE,
  estado TEXT,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de indicadores prestacionales
CREATE TABLE IF NOT EXISTS indicadores_prestacionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  indicador_codigo TEXT NOT NULL,
  sub_indicador TEXT,
  valor_cantidad INTEGER,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para nuevas tablas
ALTER TABLE sepelios_supervisados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sepelios_all_authenticated" ON sepelios_supervisados;
CREATE POLICY "sepelios_all_authenticated" ON sepelios_supervisados FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE indicadores_prestacionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indicadores_all_authenticated" ON indicadores_prestacionales;
CREATE POLICY "indicadores_all_authenticated" ON indicadores_prestacionales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- PASO 2: Modificar parámetros existentes
-- ============================================

-- A.3: Cambiar texto + agregar campos condicionales
UPDATE parametros SET
  descripcion = '¿Cuenta con Acceso a Internet?',
  campos_si = '["velocidad_mbps","estado_internet"]',
  opciones_si = '["Buena","Regular","Malo"]',
  opciones_no = '["Por falta de pago","Por avería zonal","Por robo de cableado","Otro"]',
  tipo_campo_condicional = 'cantidad',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Velocidad (Mbps)'
WHERE codigo = 'A.3' AND tipo_supervision = 'informatico';

-- A.6: Desactivar
UPDATE parametros SET activo = false
WHERE codigo = 'A.6' AND tipo_supervision = 'informatico';

-- A.7: Agregar campo piso
UPDATE parametros SET
  tipo_campo_condicional = 'texto',
  condicion_campo = 'siempre',
  etiqueta_campo_condicional = 'Piso donde se ubica'
WHERE codigo = 'A.7' AND tipo_supervision = 'informatico';

-- A.8: Cambiar texto + campos condicionales
UPDATE parametros SET
  descripcion = '¿El personal de la Oficina registra su asistencia en el cuaderno de registros?',
  campos_si = '["hora_registro"]',
  opciones_no = '["Ningún tercero se registra","No tienen un cuaderno de registro","El digitador no quiere registrarse","Otro"]',
  tipo_campo_condicional = 'texto',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Hora de registro de ingreso'
WHERE codigo = 'A.8' AND tipo_supervision = 'informatico';

-- ============================================
-- PASO 3: Sección B - Reestructurar B.1 como grupo
-- ============================================

-- B.1: Convertir en grupo padre
UPDATE parametros SET
  descripcion = 'El digitador de la Oficina de Seguros del establecimiento de salud cuenta con acceso a los sistemas:',
  es_grupo = true,
  requiere_observacion = false
WHERE codigo = 'B.1' AND tipo_supervision = 'informatico';

-- Obtener ID de B.1 para los hijos
DO $$
DECLARE
  padre_b1_id TEXT;
  padre_b4_id TEXT;
BEGIN
  SELECT id INTO padre_b1_id FROM parametros WHERE codigo = 'B.1' AND tipo_supervision = 'informatico' LIMIT 1;

  -- Insertar sub-parámetros de B.1
  INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_supervision, parametro_padre_id, opciones_no)
  VALUES
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.1.1', 'ARFSIS WEB', true, 1, true, 'informatico', padre_b1_id, '["Es Locador Nuevo","No se gestionó su usuario","Está pendiente","Otro"]'),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.1.2', 'SIASIS/SIGEPS', true, 2, true, 'informatico', padre_b1_id, '["Es Locador Nuevo","No se gestionó su usuario","Está pendiente","Otro"]'),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.1.3', 'SIGESE', true, 3, true, 'informatico', padre_b1_id, '["Es Locador Nuevo","No se gestionó su usuario","Está pendiente","Otro"]'),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.1.4', 'REGISTRO DE SEPELIOS', true, 4, true, 'informatico', padre_b1_id, '["Es Locador Nuevo","No se gestionó su usuario","Está pendiente","Otro"]');

  -- B.2: Modificar texto + campos condicionales
  UPDATE parametros SET
    descripcion = '¿El digitador de la Oficina de Seguros del establecimiento de salud viene realizando correctamente su carga de paquetes y sincronización?',
    campos_si = '["fecha_hora_ultima_carga"]',
    opciones_no = '["No tiene Internet","No hay Digitador","Digitador no ejecuta Acción","Otro"]',
    tipo_campo_condicional = 'texto',
    condicion_campo = 'si',
    etiqueta_campo_condicional = 'Fecha y hora de última carga'
  WHERE codigo = 'B.2' AND tipo_supervision = 'informatico';

  -- B.3: Modificar lógica condicional
  UPDATE parametros SET
    descripcion = 'El sistema ARFSIS se encuentra actualizado (VERSION, BASE DE MAESTROS, CATÁLOGO DE MAESTRO Y ASEGURADO).',
    campos_si = '["version_arfsis","fecha_act_maestros","fecha_act_afiliados"]',
    tipo_campo_condicional = 'texto',
    condicion_campo = 'si',
    etiqueta_campo_condicional = 'Versión del ARFSIS Web'
  WHERE codigo = 'B.3' AND tipo_supervision = 'informatico';

  -- B.4: Convertir en grupo padre
  UPDATE parametros SET
    descripcion = 'Al momento de la supervisión, ¿El digitador presenta inconvenientes con los sistemas informáticos, Sistema Operativo, hardware, Software?',
    es_grupo = true,
    requiere_observacion = false
  WHERE codigo = 'B.4' AND tipo_supervision = 'informatico';

  SELECT id INTO padre_b4_id FROM parametros WHERE codigo = 'B.4' AND tipo_supervision = 'informatico' LIMIT 1;

  -- Insertar sub-parámetros de B.4
  INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_supervision, parametro_padre_id, opciones_si, opciones_no)
  VALUES
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.1', 'ARFSIS WEB', true, 1, true, 'informatico', padre_b4_id, '["Se reinstalo","Se Actualizo","Otro"]', NULL),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.2', 'SIASIS/SIGEPS', true, 2, true, 'informatico', padre_b4_id, '["Es digitador nuevo","Se gestionó la creación de usuario","La creación de usuario está pendiente","Otro"]', NULL),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.3', 'SIGESE', true, 3, true, 'informatico', padre_b4_id, '["Se creo usuario","Se indicó Link","Otro"]', NULL),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.4', 'Registro de sepelios', true, 4, true, 'informatico', padre_b4_id, '["Se creo usuario","Se indicó Link","Otro"]', NULL),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.5', 'S.O/Software', true, 5, true, 'informatico', padre_b4_id, '["Se formateo el equipo","Se instalaron Drivers","Se instalaron Actualizaciones","Se coordinó con OGTI"]', NULL),
  (gen_random_uuid(), 'B. ARFSIS/SIGEPS/SIASIS/SGA', 'B.4.6', 'Hardware', true, 6, true, 'informatico', padre_b4_id, '["Se realizo mantenimiento","Se cambiaron componentes","Se coordinó con OGTI"]', NULL);

END $$;

-- ============================================
-- PASO 4: Sección C - Modificar C.5
-- ============================================
UPDATE parametros SET
  descripcion = 'Cantidad de sepelios recepcionados por el digitador al día de la supervisión.',
  has_tabla_extra = 'tabla_sepelios'
WHERE codigo = 'C.5' AND tipo_supervision = 'informatico';

-- ============================================
-- PASO 5: Sección E - Modificar lógica condicional
-- ============================================

-- E.1: Si → cantidad + numeración. No → acciones correctivas
UPDATE parametros SET
  descripcion = 'El digitador tiene actualizado el registro de control de FUAs que entrega a las distintas áreas.',
  campos_si = '["cantidad_fuas_entregados","numeracion_inicial","numeracion_final"]',
  opciones_no = '["Se Implemento Cuaderno de registro","Se implemento DRIVE de registro","Se capito al Digitador","Otro"]',
  tipo_campo_condicional = 'cantidad',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Cantidad de FUAs entregados'
WHERE codigo = 'E.1' AND tipo_supervision = 'informatico';

-- E.2: Si → cantidad devueltos. No → acciones correctivas
UPDATE parametros SET
  descripcion = 'El digitador tiene actualizado el registro de devolución de FUAs que proporcionan las áreas correspondientes.',
  campos_si = '["cantidad_fuas_devueltos"]',
  opciones_no = '["Se Implemento Cuaderno de registro","Se implemento DRIVE de registro","Se capito al Digitador","Otro"]',
  tipo_campo_condicional = 'cantidad',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Cantidad de FUAs devueltos para digitación'
WHERE codigo = 'E.2' AND tipo_supervision = 'informatico';

-- E.3: Si → FUAs observadas + anuladas. No → acciones correctivas
UPDATE parametros SET
  descripcion = 'El digitador registra las FUAs observadas y subsanación de estas cuando realiza el control de calidad.',
  campos_si = '["cantidad_fuas_anuladas"]',
  opciones_no = '["Se capacita al personal","Se implementa Drive","Se implementa Formato","Otro"]',
  tipo_campo_condicional = 'cantidad',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Cantidad de FUAs Observadas'
WHERE codigo = 'E.3' AND tipo_supervision = 'informatico';

-- ============================================
-- PASO 6: Sección F - Modificar lógica condicional
-- ============================================

-- F.1: Si → fecha último tomo. No → acciones correctivas
UPDATE parametros SET
  campos_si = '["fecha_ultimo_tomo"]',
  opciones_no = '["Se establece plazo para Archivamiento","Se realiza acta de compromiso","Otro"]',
  tipo_campo_condicional = 'fecha',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Fecha del último Tomo'
WHERE codigo = 'F.1' AND tipo_supervision = 'informatico';

-- F.2: Si → fecha último tomo. No → acciones correctivas
UPDATE parametros SET
  campos_si = '["fecha_ultimo_tomo"]',
  opciones_no = '["Se establece plazo para Archivamiento","Se realiza acta de compromiso","Otro"]',
  tipo_campo_condicional = 'fecha',
  condicion_campo = 'si',
  etiqueta_campo_condicional = 'Fecha del último Tomo'
WHERE codigo = 'F.2' AND tipo_supervision = 'informatico';

-- ============================================
-- PASO 7: Nueva Sección - Indicadores Prestacionales
-- ============================================
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, tipo_supervision)
VALUES
(gen_random_uuid(), 'IP. Indicadores Prestacionales', 'IP.1',
 'IP 02-03 Indicador de Pacientes con Diabetes Mellitus. Indicar la cantidad de Atenciones con:',
 false, 1, true, NULL, NULL, NULL, 'tabla_indicadores_diabetes', 'informatico'),

(gen_random_uuid(), 'IP. Indicadores Prestacionales', 'IP.2',
 'IP 04 Indicador de Pacientes con Hipertensión Arterial. Cantidad de pacientes con DX de HTA en el Establecimiento al Momento de la Supervisión.',
 false, 2, true, 'cantidad', 'siempre', 'Cantidad de pacientes', NULL, 'informatico'),

(gen_random_uuid(), 'IP. Indicadores Prestacionales', 'IP.3',
 'IP 05 Indicador de Mamografías. Cantidad de pacientes referidos o atendidos al Momento de la supervisión.',
 false, 3, true, 'cantidad', 'siempre', 'Cantidad de pacientes', NULL, 'informatico'),

(gen_random_uuid(), 'IP. Indicadores Prestacionales', 'IP.4',
 'IP 06 Indicador de Teleinterconsulta. Cantidad de Atenciones con Teleinterconsulta y CPMS 99499.11 Momento de la supervisión.',
 false, 4, true, 'cantidad', 'siempre', 'Cantidad de atenciones', NULL, 'informatico');

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT codigo, descripcion, activo, es_grupo, parametro_padre_id IS NOT NULL as es_hijo
FROM parametros
WHERE tipo_supervision = 'informatico'
ORDER BY seccion, orden;
