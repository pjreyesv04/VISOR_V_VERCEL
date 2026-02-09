-- Crear tabla audit_logs para registrar cambios en supervisiones
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'update', 'create', 'delete', 'finalize'
  field_name VARCHAR(100), -- nombre del campo que cambió (puede ser NULL para create/delete)
  old_value TEXT, -- valor anterior
  new_value TEXT, -- valor nuevo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT -- descripción del cambio
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_logs_supervision_id ON audit_logs(supervision_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE audit_logs IS 'Registro de auditoría: registra todos los cambios realizados en superviciones';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción: update, create, delete, finalize';
COMMENT ON COLUMN audit_logs.field_name IS 'Nombre del campo que fue modificado';
COMMENT ON COLUMN audit_logs.old_value IS 'Valor anterior (antes del cambio)';
COMMENT ON COLUMN audit_logs.new_value IS 'Valor nuevo (después del cambio)';
