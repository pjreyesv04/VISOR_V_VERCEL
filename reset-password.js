import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://coxrhjgmjokqyjhmmhfx.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveHJoamdtam9rcXlqaG1taGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU2MzkyMSwiZXhwIjoyMDg2MTM5OTIxfQ.PBYnNnoIIrGnhq2HD8eJl_ZK7qTY8IVe9av_AAiY17w";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    console.log("🔍 Buscando usuario miguelixyu@gmail.com...");
    
    // Listar todos los usuarios para encontrar el ID
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("❌ Error al listar usuarios:", listError.message);
      process.exit(1);
    }
    
    const targetUser = users.users.find(u => u.email === 'miguelixyu@gmail.com');
    
    if (!targetUser) {
      console.error("❌ Usuario miguelixyu@gmail.com no encontrado");
      process.exit(1);
    }
    
    console.log("✅ Usuario encontrado:", targetUser.id);
    console.log("📧 Email:", targetUser.email);
    console.log("📅 Creado:", targetUser.created_at);
    console.log("\n🔄 Reseteando contraseña a 'doc12345'...\n");

    const { data, error } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      {
        password: "doc12345",
      }
    );

    if (error) {
      console.error("❌ Error:", error.message);
    } else {
      console.log("✅ ¡Contraseña cambiada correctamente!");
      console.log("📧 Email:", data.user.email);
      console.log("🆔 Usuario ID:", data.user.id);
      console.log("🔑 Nueva contraseña: doc12345");
      console.log("\n🎯 Ahora puedes intentar iniciar sesión con estas credenciales.");
    }
  } catch (err) {
    console.error("❌ Exception:", err.message);
  }
  process.exit(0);
})();
