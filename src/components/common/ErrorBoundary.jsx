import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-5">
          <div className="alert alert-danger">
            <h5>Algo salio mal</h5>
            <p>{this.state.error?.message || "Error desconocido"}</p>
            <button className="btn btn-outline-danger btn-sm" onClick={() => window.location.reload()}>
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
