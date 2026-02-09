#!/usr/bin/env node

/**
 * Script para crear la tabla audit_logs en Supabase
 * Ejecutar: node createAuditTable.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coxrhjgmjokqyjhmmhfx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveHJoamdtam9rcXlqaG1taGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjQ5MDQsImV4cCI6MTc0NDA0MDcwNH0.ZKsHslvXJXoiZRJz6Y3zp_LfEd37nCo6KuZ0LN9r-Yw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAuditLogsTable() {
  try {
    console.log('Creando tabla audit_logs...');

    const { error } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          field_name VARCHAR(100),
          old_value TEXT,
          new_value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          description TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_supervision_id ON audit_logs(supervision_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      `
    });

    if (error) {
      console.error('Error creando tabla:', error);
    } else {
      console.log('✓ Tabla audit_logs creada exitosamente');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createAuditLogsTable();
