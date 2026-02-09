import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://coxrhjgmjokqyjhmmhfx.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveHJoamdtam9rcXlqaG1taGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU2MzkyMSwiZXhwIjoyMDg2MTM5OTIxfQ.PBYnNnoIIrGnhq2HD8eJl_ZK7qTY8IVe9av_AAiY17w";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    console.log("Cambiando contraseña para pablor.sist04@gmail.com...");

    const { data, error } = await supabase.auth.admin.updateUserById(
      "e6cc5f9f-8e3a-476c-829a-bac9fe222e2f",
      {
        password: "Admin2026",
      }
    );

    if (error) {
      console.error("Error:", error.message);
    } else {
      console.log("✅ Contraseña cambiada correctamente");
      console.log("Email:", data.user.email);
      console.log("Usuario ID:", data.user.id);
    }
  } catch (err) {
    console.error("Exception:", err.message);
  }
  process.exit(0);
})();
