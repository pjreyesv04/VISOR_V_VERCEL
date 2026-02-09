import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute({ allowedRoles, children }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !profile.activo) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger">
          <h5>Cuenta desactivada</h5>
          <p>Tu cuenta ha sido desactivada. Contacta al administrador.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning">
          <h5>Acceso denegado</h5>
          <p>No tienes permisos para acceder a esta seccion.</p>
        </div>
      </div>
    );
  }

  return children;
}
