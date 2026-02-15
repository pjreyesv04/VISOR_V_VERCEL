import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// Configuración
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const PROFILE_FETCH_TIMEOUT = 8000; // 8 segundos
const MAX_RETRIES = 2;

const logger = {
  info: (...args) => console.log('ℹ️ [AUTH]', ...args),
  warn: (...args) => console.warn('⚠️ [AUTH]', ...args),
  error: (...args) => console.error('❌ [AUTH]', ...args),
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const inactivityTimerRef = useRef(null);
  const isSigningOut = useRef(false);

  // ─── Cache de perfil ───
  const cacheProfile = (userId, profileData) => {
    try {
      localStorage.setItem(`profile_${userId}`, JSON.stringify(profileData));
    } catch (e) { /* silencioso */ }
  };

  const getCachedProfile = (userId) => {
    try {
      const cached = localStorage.getItem(`profile_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* silencioso */ }
    return null;
  };

  const clearProfileCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('profile_')) localStorage.removeItem(key);
    });
  };

  // ─── Fetch de perfil optimizado ───
  const fetchProfile = useCallback(async (userId, retryCount = 0) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT);

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, user_id, nombre, role, activo")
        .eq("user_id", userId)
        .single()
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        if (error.message?.includes('row-level security') || error.message?.includes('infinite recursion')) {
          logger.error("Error RLS en user_profiles");
          setAuthError("Error de permisos al cargar perfil. Contacte al administrador.");
          return null;
        }

        if (error.code === 'PGRST116') {
          logger.error("Perfil no encontrado para usuario:", userId);
          setAuthError("No se encontro el perfil de usuario.");
          return null;
        }

        if (retryCount < MAX_RETRIES) {
          logger.info(`Reintentando perfil... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }

        const cached = getCachedProfile(userId);
        if (cached) {
          logger.warn("Usando perfil de cache local");
          return cached;
        }

        return { user_id: userId, nombre: "", role: "auditor", activo: true };
      }

      if (!data) {
        const cached = getCachedProfile(userId);
        return cached || { user_id: userId, nombre: "", role: "auditor", activo: true };
      }

      cacheProfile(userId, data);
      setAuthError(null);
      return data;

    } catch (e) {
      if (e.name === 'AbortError' && retryCount < MAX_RETRIES) {
        logger.warn(`Timeout, reintentando... (${retryCount + 1}/${MAX_RETRIES})`);
        return fetchProfile(userId, retryCount + 1);
      }

      const cached = getCachedProfile(userId);
      if (cached) {
        logger.warn("Usando perfil de cache tras error");
        return cached;
      }
      return { user_id: userId, nombre: "", role: "auditor", activo: true };
    }
  }, []);

  // ─── Timer de inactividad ───
  const stopInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    logger.info("Cerrando sesión...");
    isSigningOut.current = true;
    stopInactivityTimer();

    // Limpiar estado INMEDIATAMENTE
    setSession(null);
    setProfile(null);
    setAuthError(null);
    setLoading(false);
    clearProfileCache();

    try {
      await supabase.auth.signOut();
    } catch (err) {
      logger.error("Error al cerrar sesión:", err.message);
    } finally {
      isSigningOut.current = false;
    }
  }, [stopInactivityTimer]);

  // ─── Inicialización: una sola fuente de verdad ───
  useEffect(() => {
    let isMount = true;

    // 1. Obtener sesión inicial y setear estado base
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMount) return;

      if (initialSession?.user) {
        setSession(initialSession);
        // El perfil se cargará cuando onAuthStateChange dispare INITIAL_SESSION o SIGNED_IN
      } else {
        // No hay sesión → dejar de cargar
        setLoading(false);
      }
    });

    // 2. Listener único: maneja TODOS los eventos de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!isMount) return;

      logger.info(`Auth event: ${event}`);

      // Ignorar durante logout
      if (isSigningOut.current) return;

      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN': {
          if (!s?.user) {
            setLoading(false);
            break;
          }

          setSession(s);

          // Cargar perfil
          const p = await fetchProfile(s.user.id);
          if (!isMount) return;

          if (!p) {
            logger.error("Perfil no disponible, forzando logout");
            isSigningOut.current = true;
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            setLoading(false);
            isSigningOut.current = false;
            return;
          }

          setProfile(p);
          setLoading(false);
          break;
        }

        case 'TOKEN_REFRESHED':
          if (s) setSession(s);
          // No re-fetch de perfil, ya lo tenemos
          break;

        case 'SIGNED_OUT':
          setSession(null);
          setProfile(null);
          setAuthError(null);
          stopInactivityTimer();
          setLoading(false);
          break;

        case 'USER_UPDATED':
          if (s?.user) {
            const p = await fetchProfile(s.user.id);
            if (isMount && p) setProfile(p);
          }
          break;
      }
    });

    return () => {
      isMount = false;
      subscription?.unsubscribe();
      stopInactivityTimer();
    };
  }, [fetchProfile, stopInactivityTimer]);

  // ─── Detector de inactividad ───
  useEffect(() => {
    if (!session?.user) return;

    const resetTimer = () => {
      stopInactivityTimer();
      inactivityTimerRef.current = setTimeout(() => {
        logger.info("Timeout de inactividad");
        signOut();
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    let throttle = null;

    const handler = () => {
      if (!throttle) {
        throttle = setTimeout(() => {
          resetTimer();
          throttle = null;
        }, 2000);
      }
    };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (throttle) clearTimeout(throttle);
      stopInactivityTimer();
    };
  }, [session?.user, signOut, stopInactivityTimer]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    authError,
    signOut,
    isAdmin: profile?.role === "admin",
    isAuditor: profile?.role === "auditor",
    isViewer: profile?.role === "viewer",
    isSupervisorInformatico: profile?.role === "supervisor_informatico",
    hasRole: (...roles) => roles.includes(profile?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
