import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      setLoading(false);
      return setErr(error.message);
    }

    // Verificar si la cuenta esta activa
    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("activo")
      .eq("user_id", data.user.id)
      .single();

    if (profErr || !profile) {
      setLoading(false);
      return setErr("No se encontro el perfil de usuario.");
    }

    if (!profile.activo) {
      await supabase.auth.signOut();
      setLoading(false);
      return setErr("Tu cuenta ha sido desactivada. Contacta al administrador.");
    }

    nav("/");
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: "100vh", background: "#f0f2f5" }}
    >
      <div className="card shadow-sm" style={{ width: "100%", maxWidth: 420 }}>
        <div className="card-body p-4">
          <h4 className="text-center mb-1">Sistema de Supervision</h4>
          <p className="text-center text-muted mb-4">Ingresa tus credenciales</p>

          <form onSubmit={signIn}>
            <div className="mb-3">
              <label className="form-label">Correo</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-control"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>

            {err && <div className="alert alert-danger py-2">{err}</div>}

            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
