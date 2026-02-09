-- ====================================================================
-- Seed: Parámetros del Acta de Supervisión de Auditoría
-- V.I.S.O.R - Ejecutar DESPUÉS de add_conditional_fields.sql
--
-- IMPORTANTE: Si ya tienes parámetros existentes, primero desactívalos
-- o elimínalos antes de ejecutar este script.
-- Opción segura: UPDATE parametros SET activo = false;
-- ====================================================================

-- =========================================================
-- SECCIÓN 1: Capacitación Profesional (1 pregunta)
-- =========================================================
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '1. Capacitación Profesional',
  '1.1',
  'Profesionales se encuentran capacitados en los procesos que incluyen los indicadores solicitados en el convenio para lograr el cumplimiento en el periodo solicitado.',
  true, 1, true,
  'fecha', 'si', 'Fecha de la capacitación'
);

-- =========================================================
-- SECCIÓN 2: IP 02-03 Indicador de Pacientes con Diabetes Mellitus (6 preguntas)
-- =========================================================

-- Q1: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.1',
  '¿Cuenta con Equipo Automatizado para realizar HBA1c - microalbuminuria - creatinina sérica?',
  true, 1, true,
  NULL, NULL, NULL
);

-- Q2: Sí/No + fecha condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.2',
  'Cuenta con reactivos e insumos para realizar HBA1c (hemoglobina glicosilada) microalbuminuria y creatinina sérica.',
  true, 2, true,
  'fecha', 'si', 'Fecha de Abastecimiento (Farmacia/Laboratorio)'
);

-- Q3: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.3',
  'Tomas procesadas de muestra de HBA1c, microalbuminuria y creatinina (SI AUTOMATIZADO).',
  true, 3, true,
  'cantidad', 'si', 'Cantidad de HBA1c - Microalb - Creat.'
);

-- Q4: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.4',
  'Tomas realizadas de muestra de HBA1c, microalbuminuria y creatinina (NO AUTOMATIZADO).',
  true, 4, true,
  'cantidad', 'si', 'Cantidad de HBA1c - Microalb - Creat.'
);

-- Q5: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.5',
  '¿Cuenta con Flujograma socializado por Oficina de Seguros?',
  true, 5, true,
  NULL, NULL, NULL
);

-- Q6: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '2. IP 02-03 Diabetes Mellitus',
  '2.6',
  '¿Realiza correcto llenado del FUA 071 Laboratorio?',
  true, 6, true,
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 3: IP 04 Indicador de Pacientes con Hipertensión Arterial (3 preguntas)
-- =========================================================

-- Q1: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.1',
  '¿Se realiza toma de la presión arterial correctamente al paciente que llega al EESS?',
  true, 1, true,
  NULL, NULL, NULL
);

-- Q2: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.2',
  '¿Cuentan con Pacientes con HTA?',
  true, 2, true,
  'cantidad', 'si', 'Cuántos derivados a Medicina'
);

-- Q3: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '3. IP 04 Hipertensión Arterial',
  '3.3',
  '¿Cuenta con Flujograma socializado por Oficina de Seguros?',
  true, 3, true,
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 4: IP 05 Indicador de Mamografías (3 preguntas)
-- =========================================================

-- Q1: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.1',
  '¿Pacientes mayores de 40 años acuden al EESS y pasan por obstetricia?',
  true, 1, true,
  'cantidad', 'si', 'Cantidad de pacientes'
);

-- Q2: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.2',
  '¿Derivan a pacientes para mamografías a los EESS que cuentan con el mamógrafo operativo?',
  true, 2, true,
  'cantidad', 'si', 'Cantidad de pacientes'
);

-- Q3: Sí/No + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '4. IP 05 Mamografías',
  '4.3',
  '¿Se registran pacientes en DRIVE y se verificó el registro?',
  true, 3, true,
  NULL, NULL, NULL
);

-- =========================================================
-- SECCIÓN 5: IP 06 Indicador de Teleinterconsulta (2 preguntas)
-- =========================================================

-- Q1: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '5. IP 06 Teleinterconsulta',
  '5.1',
  '¿Se realizan interconsultas (CP 300)?',
  true, 1, true,
  'cantidad', 'si', 'Cantidad realizada'
);

-- Q2: Sí/No + cantidad condicional + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '5. IP 06 Teleinterconsulta',
  '5.2',
  '¿Se registra el CPMS 99499.11 en el FUA?',
  true, 2, true,
  'cantidad', 'si', 'Cantidad realizada'
);

-- =========================================================
-- SECCIÓN 6: Power BI (2 preguntas)
-- =========================================================

-- Q1: Sí/No + texto SIEMPRE visible + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '6. Power BI',
  '6.1',
  '¿Digitador corrige las Observaciones?',
  true, 1, true,
  'texto', 'siempre', 'Nombre del Digitador del Establecimiento'
);

-- Q2: Sí/No + texto SIEMPRE visible + observación
INSERT INTO parametros (id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional)
VALUES (
  gen_random_uuid(),
  '6. Power BI',
  '6.2',
  '¿Digitador realiza envío Oportuno de Backups a Supervisor?',
  true, 2, true,
  'texto', 'siempre', 'Nombre del Digitador del Establecimiento'
);
