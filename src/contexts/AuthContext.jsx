import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchProfile = async (userId) => {
    try {
      console.log("fetchProfile: Iniciando para userId:", userId);
      
      // Timeout de 5 segundos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout fetchProfile")), 5000)
      );

      const queryPromise = supabase
        .from("user_profiles")
        .select("id, user_id, nombre, role, activo")
        .eq("user_id", userId)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn("fetchProfile: Error en query:", error.message);
        return { user_id: userId, nombre: "", role: "auditor", activo: true };
      }
      
      console.log("fetchProfile: Datos obtenidos:", data);
      return data;
    } catch (e) {
      console.warn("fetchProfile: Exception:", e.message);
      return { user_id: userId, nombre: "", role: "auditor", activo: true };
    }
  };

  useEffect(() => {
    console.log("AuthProvider: Iniciando...");
    let isMount = true;

    // Solo usar onAuthStateChange - es más confiable
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      console.log("AuthProvider: onAuthStateChange disparado", _event);
      
      if (!isMount) return;

      setSession(s);
      if (s?.user) {
        console.log("AuthProvider: Hay usuario, obteniendo perfil...");
        const p = await fetchProfile(s.user.id);
        console.log("AuthProvider: Perfil obtenido", p);
        setProfile(p);
      } else {
        console.log("AuthProvider: Sin usuario");
        setProfile(null);
      }

      console.log("AuthProvider: Carga completada");
      setLoading(false);
    });

    return () => {
      isMount = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signOut,
    isAdmin: profile?.role === "admin",
    isAuditor: profile?.role === "auditor",
    isViewer: profile?.role === "viewer",
    hasRole: (...roles) => roles.includes(profile?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
