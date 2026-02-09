/**
 * Script para resetear contraseña del usuario miguelixyu@gmail.com
 * Requiere las credenciales de servicio de Supabase
 */

import { createClient } from '@supabase/supabase-js'

// Lee las variables de entorno o configúralas aquí
const supabaseUrl = 'https://your-project.supabase.co' // Reemplazar con tu URL
const supabaseServiceKey = 'your-service-role-key' // Reemplazar con tu SERVICE ROLE KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetPassword() {
  try {
    console.log('🔄 Reseteando contraseña para miguelixyu@gmail.com...')
    
    // Obtener el ID del usuario
    const { data: users, error: fetchError } = await supabase.auth.admin.listUsers()
    
    if (fetchError) {
      console.error('❌ Error al listar usuarios:', fetchError)
      return
    }
    
    const user = users.users.find(u => u.email === 'miguelixyu@gmail.com')
    
    if (!user) {
      console.error('❌ Usuario no encontrado')
      return
    }
    
    console.log('✅ Usuario encontrado:', user.id)
    
    // Actualizar la contraseña
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'doc12345' }
    )
    
    if (error) {
      console.error('❌ Error al actualizar contraseña:', error)
      return
    }
    
    console.log('✅ ¡Contraseña actualizada exitosamente!')
    console.log('📧 Email:', 'miguelixyu@gmail.com')
    console.log('🔑 Nueva contraseña:', 'doc12345')
    console.log('\n🎯 Ahora puedes intentar iniciar sesión con estas credenciales.')
    
  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

resetPassword()
