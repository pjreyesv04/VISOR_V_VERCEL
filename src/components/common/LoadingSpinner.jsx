export default function LoadingSpinner({ message = "Cargando..." }) {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center py-5">
      <div className="spinner-border text-primary mb-2" role="status">
        <span className="visually-hidden">{message}</span>
      </div>
      <span className="text-muted">{message}</span>
    </div>
  );
}
