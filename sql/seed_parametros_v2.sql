-- ====================================================================
-- Seed V2: Parámetros actualizados según documento Word V.1.2
-- V.I.S.O.R - Ejecutar DESPUÉS de migration_word_instructions.sql
--
-- IMPORTANTE: Primero desactivar parámetros existentes:
--   UPDATE parametros SET activo = false;
-- ====================================================================

-- Desactivar todos los parámetros anteriores
UPDATE parametros SET activo = false;

-- =========================================================
-- SECCIÓN 1: Capacitación Profesional
-- Instrucciones: Si=Sí → fecha de capacitación + tabla participantes
-- =========================================================
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '1. Capacitación Profesional',
  '1.1',
  'Profesionales se encuentran capacitados en los procesos que incluyen los indicadores solicitados en el convenio para lograr el cumplimiento en el periodo solicitado.',
  true, 1, true,
  'fecha', 'si', 'Fecha de la capacitación',
  'participantes', NULL, NULL
);

-- =========================================================
-- SECCIÓN 2: IP 02-03 Diabetes Mellitus
-- =========================================================

-- 2.1: Si/No + observación siempre
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.1',
  '¿Cuenta con Equipo Automatizado para realizar HBA1c - microalbuminuria - creatinina sérica?',
  true, 1, true,
  NULL, NULL, NULL,
  NULL, NULL, NULL
);

-- 2.2: Si=fecha abastecimiento + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.2',
  'Cuenta con reactivos e insumos para realizar HBA1c (hemoglobina glicosilada) microalbuminuria y creatinina sérica.',
  true, 2, true,
  'fecha', 'si', 'Fecha de Abastecimiento (Farmacia/Laboratorio)',
  NULL, NULL, NULL
);

-- 2.3: Si=3 cantidades separadas (HBA1c, microalb, creat), No=obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.3',
  'Tomas procesadas de muestra de HBA1c, microalbuminuria y creatinina sérica (SI AUTOMATIZADO).',
  true, 3, true,
  'cantidad_multiple', 'si', 'HBA1c|Microalbuminuria|Creatinina sérica',
  NULL, NULL, NULL
);

-- 2.4: Depende de 2.1 (solo si 2.1=No). Si=3 cantidades, No=obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.4',
  'Tomas realizadas de muestra de HBA1c, microalbuminuria y creatinina sérica (NO AUTOMATIZADO).',
  true, 4, true,
  'cantidad_multiple', 'si', 'HBA1c|Microalbuminuria|Creatinina sérica',
  NULL, '2.1', 'no'
);

-- 2.5: Si/No + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.5',
  '¿Cuenta con Flujograma socializado por Oficina de Seguros?',
  true, 5, true,
  NULL, NULL, NULL,
  NULL, NULL, NULL
);

-- 2.6: Si/No + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.6',
  '¿Realiza correcto llenado del FUA 071 Laboratorio?',
  true, 6, true,
  NULL, NULL, NULL,
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 3: IP 04 Hipertensión Arterial
-- =========================================================

-- 3.1: Si=registrar nombre y grupo ocupacional de quien tomó P.A. + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.1',
  '¿Se realiza toma de la presión arterial correctamente al paciente que llega al EESS?',
  true, 1, true,
  'texto_persona', 'si', 'Nombres y Apellidos|Grupo Ocupacional',
  NULL, NULL, NULL
);

-- 3.2: Si=cantidad al día de la supervisión + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.2',
  '¿Cuentan con Pacientes con HTA registrados en su padrón?',
  true, 2, true,
  'cantidad', 'si', 'Cantidad al día de la supervisión',
  NULL, NULL, NULL
);

-- 3.3: Si=cantidad + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.3',
  '¿Cuentan con Pacientes Medicados, tienen un registro?',
  true, 3, true,
  'cantidad', 'si', 'Cantidad de pacientes medicados',
  NULL, NULL, NULL
);

-- 3.4: Si/No + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.4',
  '¿Cuenta con Flujograma socializado por Oficina de Seguros?',
  true, 4, true,
  NULL, NULL, NULL,
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 4: IP 05 Mamografías
-- =========================================================

-- 4.1: Si/No + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.1',
  '¿Pacientes mujeres mayores de 40 años que acuden al EESS pasan por obstetricia?',
  true, 1, true,
  NULL, NULL, NULL,
  NULL, NULL, NULL
);

-- 4.2: Si=cantidad + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.2',
  '¿Cuántos Pacientes han derivado a EESS que cuentan con mamógrafo operativo?',
  true, 2, true,
  'cantidad', 'si', 'Cantidad de pacientes derivados',
  NULL, NULL, NULL
);

-- 4.3: Si=cantidad, No=obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.3',
  '¿Se registran pacientes en DRIVE y se verificó el registro?',
  true, 3, true,
  'cantidad', 'si', 'Cantidad de pacientes registrados a la fecha',
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 5: IP 06 Teleinterconsulta
-- =========================================================

-- 5.1: Si=cantidad + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '5. IP 06 Teleinterconsulta',
  '5.1',
  '¿Se realizan interconsultas (CP 300)?',
  true, 1, true,
  'cantidad', 'si', 'Cantidad realizada',
  NULL, NULL, NULL
);

-- 5.2: Si=cantidad + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '5. IP 06 Teleinterconsulta',
  '5.2',
  '¿Se registra el CPMS 99499.11 en el FUA?',
  true, 2, true,
  'cantidad', 'si', 'Cantidad realizada',
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 6: Power BI + Tabla FUA verificados (10 filas)
-- =========================================================

-- 6.1: Si o No = registrar nombre digitador + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '6. Power BI',
  '6.1',
  '¿Digitador corrige las Observaciones?',
  true, 1, true,
  'texto', 'siempre', 'Nombre del Digitador del Establecimiento',
  'fua_verificados', NULL, NULL
);

-- 6.2: Si o No = registrar nombre digitador + obs
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '6. Power BI',
  '6.2',
  '¿Digitador realiza envío Oportuno de Backups a Supervisor?',
  true, 2, true,
  'texto', 'siempre', 'Nombre del Digitador del Establecimiento',
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 7: Gratuidad de la Atención
-- =========================================================

-- 7.1: Tabla de verificación FUA vs Historia clínica
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional, has_tabla_extra, depende_de_codigo, depende_valor)
VALUES (
  gen_random_uuid(),
  '7. Gratuidad de la Atención',
  '7.1',
  'Muestra de la verificación de FUA vs Historia clínica',
  true, 1, true,
  NULL, NULL, NULL,
  'verificacion_fua_hc', NULL, NULL
);
