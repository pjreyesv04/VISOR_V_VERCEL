import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

const PAGE_SIZE = 10;

export default function SupervisionList() {
  const nav = useNavigate();
  const { isAdmin, isViewer, user, isAuditor } = useAuth();

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [risFilter, setRisFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");

  const [risList, setRisList] = useState([]);

  useEffect(() => {
    supabase
      .from("ris")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setRisList(data || []));
  }, []);

  useEffect(() => {
    fetchData();
  }, [page, fechaDesde, fechaHasta, risFilter, estadoFilter, isAuditor, user?.id]);

  const fetchData = async () => {
    setLoading(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("supervisiones")
      .select(
        "id, correlativo, fecha, hora_inicio, hora_fin, estado, medico_jefe, auditor_eliminado, auditor_nombre_eliminado, auditor:user_profiles!auditor_id(nombre), ris:ris_id(nombre), establecimiento:establecimiento_id(nombre)",
        { count: "exact" }
      )
      .order("fecha", { ascending: false })
      .range(from, to);

    // Filtro por rol: auditors solo ven sus propias supervisiones
    if (isAuditor && user?.id) {
      query = query.eq("auditor_id", user.id);
    }

    if (fechaDesde) query = query.gte("fecha", fechaDesde);
    if (fechaHasta) query = query.lte("fecha", fechaHasta);
    if (risFilter) query = query.eq("ris_id", risFilter);
    if (estadoFilter) query = query.eq("estado", estadoFilter);

    const { data: rows, count, error } = await query;
    if (error) console.error("Error:", error.message);

    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setRisFilter("");
    setEstadoFilter("");
    setPage(0);
  };

  const estadoBadge = (estado) => {
    const map = {
      borrador: "bg-warning text-dark",
      completado: "bg-success",
      revisado: "bg-primary",
    };
    return map[estado] || "bg-secondary";
  };

  // Función para mostrar el nombre del auditor o "Auditor eliminado"
  const mostrarAuditor = (supervision) => {
    if (supervision.auditor_eliminado) {
      return (
        <span className="text-muted" style={{ fontStyle: "italic" }}>
          Auditor eliminado ({supervision.auditor_nombre_eliminado || "Desconocido"})
        </span>
      );
    }
    return supervision.auditor?.nombre || "—";
  };

  const marcarRevisado = async (id) => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("supervisiones")
      .update({
        estado: "revisado",
        revisado_por: userData?.user?.id,
        revisado_at: new Date().toISOString(),
      })
      .eq("id", id);
    fetchData();
  };

  const eliminarSupervision = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar esta supervisión? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      // 1. Eliminar respuestas asociadas
      await supabase.from("respuestas").delete().eq("supervision_id", id);
      
      // 2. Eliminar evidencias asociadas (registros en tabla, archivos en storage se pueden borrar después)
      await supabase.from("evidencias").delete().eq("supervision_id", id);
      
      // 3. Eliminar la supervisión
      const { error } = await supabase.from("supervisiones").delete().eq("id", id);
      
      if (error) {
        alert("Error al eliminar: " + error.message);
      } else {
        alert("Supervisión eliminada correctamente");
        fetchData();
      }
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Supervisiones</h4>
        <span className="text-muted">{total} registros</span>
      </div>

      {/* Filtros */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>Desde</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setPage(0); }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setPage(0); }}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>RIS</label>
              <select
                className="form-select form-select-sm"
                value={risFilter}
                onChange={(e) => { setRisFilter(e.target.value); setPage(0); }}
              >
                <option value="">Todos</option>
                {risList.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>Estado</label>
              <select
                className="form-select form-select-sm"
                value={estadoFilter}
                onChange={(e) => { setEstadoFilter(e.target.value); setPage(0); }}
              >
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="completado">Completado</option>
                <option value="revisado">Revisado</option>
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn btn-sm btn-outline-secondary" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border spinner-border-sm text-primary" />
              <span className="ms-2 text-muted">Cargando...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center p-4 text-muted">No se encontraron supervisiones</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>N</th>
                    <th>Fecha</th>
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                    {isAdmin && <th>Auditor</th>}
                    <th>RIS</th>
                    <th>Establecimiento</th>
                    <th>Medico Jefe</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.correlativo ?? "—"}</td>
                      <td>{s.fecha ? new Date(s.fecha + "T00:00:00").toLocaleDateString() : "—"}</td>
                      <td>{s.hora_inicio ? new Date(s.hora_inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td>{s.hora_fin ? new Date(s.hora_fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      {isAdmin && <td>{mostrarAuditor(s)}</td>}
                      <td>{s.ris?.nombre || "—"}</td>
                      <td>{s.establecimiento?.nombre || "—"}</td>
                      <td>{s.medico_jefe || "—"}</td>
                      <td>
                        <span className={`badge ${estadoBadge(s.estado)}`}>{s.estado}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => nav(`/supervision/${s.id}/ver`)}
                          >
                            Ver
                          </button>
                          {s.estado === "borrador" && !isViewer && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => nav(`/supervision/${s.id}`)}
                            >
                              Editar
                            </button>
                          )}
                          {isAdmin && s.estado === "completado" && (
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => marcarRevisado(s.id)}
                            >
                              Revisar
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminarSupervision(s.id)}
                              title="Eliminar supervisión"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="card-footer bg-white d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Pagina {page + 1} de {totalPages}
            </small>
            <div className="d-flex gap-1">
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
