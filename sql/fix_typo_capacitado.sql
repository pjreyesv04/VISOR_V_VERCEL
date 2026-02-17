-- Fix typo: "Se capito al Digitador" → "Se capacitó al Digitador"
-- Affects parameters E.1 and E.2 in informatico supervision type

UPDATE parametros SET
  opciones_no = REPLACE(opciones_no::text, 'Se capito al Digitador', 'Se capacitó al Digitador')::jsonb
WHERE tipo_supervision = 'informatico'
  AND opciones_no::text LIKE '%Se capito al Digitador%';
