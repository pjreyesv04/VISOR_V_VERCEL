-- Migración: Renombrar columna lectura_drive a recomendaciones
-- Fecha: 2026-02-11
-- Descripción: La sección "Lectura de Drive" se reemplaza por "Recomendaciones"

-- 1) Renombrar la columna
ALTER TABLE supervisiones RENAME COLUMN lectura_drive TO recomendaciones;

-- 2) Actualizar comentario de la columna
COMMENT ON COLUMN supervisiones.recomendaciones IS 'Recomendaciones generales de la supervisión';
