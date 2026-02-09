import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// Tiempo de inactividad antes del logout automático (10 minutos)
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const inactivityTimerRef = useRef(null);

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

  // Detener el timer de inactividad
  const stopInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  // Reiniciar el timer de inactividad
  const resetInactivityTimer = () => {
    stopInactivityTimer();
    
    // Solo iniciar el timer si hay una sesión activa
    if (session?.user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log("AuthProvider: Timeout de inactividad - cerrando sesión");
        signOut();
      }, INACTIVITY_TIMEOUT);
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
        // Iniciar el timer de inactividad cuando hay sesión activa
        resetInactivityTimer();
      } else {
        console.log("AuthProvider: Sin usuario");
        setProfile(null);
        // Detener el timer cuando no hay sesión
        stopInactivityTimer();
      }

      console.log("AuthProvider: Carga completada");
      setLoading(false);
    });

    return () => {
      isMount = false;
      subscription?.unsubscribe();
      stopInactivityTimer();
    };
  }, []);

  // Detectar actividad del usuario y reiniciar el timer
  useEffect(() => {
    // Solo agregar listeners si hay una sesión activa
    if (!session?.user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Agregar event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Iniciar el timer al montar
    resetInactivityTimer();

    // Limpiar event listeners al desmontar
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      stopInactivityTimer();
    };
  }, [session?.user]);

  const signOut = async () => {
    stopInactivityTimer();
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
