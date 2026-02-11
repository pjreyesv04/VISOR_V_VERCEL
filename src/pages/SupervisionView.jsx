import { useParams, useNavigate } from "react-router-dom";
import { useSupervisionData } from "../hooks/useSupervisionData";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

export default function SupervisionView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();

  const { loading, supervision, risNombre, eessNombre, auditorNombre, respuestas, evidencias, firmaUrls, seccionesAgrupadas } =
    useSupervisionData(id);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-2 text-muted">Cargando supervision...</p>
      </div>
    );
  }

  if (!supervision) {
    return <div className="alert alert-danger">No se encontro la supervision.</div>;
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const marcarRevisado = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("supervisiones")
      .update({
        estado: "revisado",
        revisado_por: userData?.user?.id,
        revisado_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al marcar como revisado");
    } else {
      toast.success("Supervision marcada como revisada");
      nav("/supervisiones");
    }
  };

  const estadoBadge = (estado) => {
    const map = {
      borrador: "bg-warning text-dark",
      completado: "bg-success",
      revisado: "bg-primary",
    };
    return map[estado] || "bg-secondary";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Cabecera */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h5 className="mb-1">ACTA DE SUPERVISION — AUDITORES</h5>
              <div className="text-muted">
                <strong>N:</strong> {supervision.correlativo ?? "—"} |{" "}
                <strong>RIS:</strong> {risNombre || "—"} |{" "}
                <strong>EESS:</strong> {eessNombre || "—"}
              </div>
            </div>
            <div className="text-end">
              <span className={`badge ${estadoBadge(supervision.estado)} mb-1`}>
                {supervision.estado}
              </span>
              <div style={{ fontSize: "0.85rem" }}>
                <div><strong>Fecha:</strong> {fmt(supervision.fecha)}</div>
                <div><strong>Inicio:</strong> {fmtTime(supervision.hora_inicio)}</div>
                <div><strong>Fin:</strong> {fmtTime(supervision.hora_fin)}</div>
              </div>
            </div>
          </div>

          <hr />

          <div className="row g-3">
            <div className="col-md-4">
              <small className="text-muted">Auditor</small>
              <div className="fw-semibold" style={supervision.auditor_eliminado ? { fontStyle: "italic", color: "#6c757d" } : {}}>
                {auditorNombre}
              </div>
            </div>
            <div className="col-md-4">
              <small className="text-muted">Medico Jefe</small>
              <div className="fw-semibold">{supervision.medico_jefe || "\u2014"}</div>
            </div>
            <div className="col-md-4">
              <small className="text-muted">Digitador</small>
              <div className="fw-semibold">{supervision.digitador || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluacion */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Evaluacion</h6>
          <hr />

          {Object.keys(seccionesAgrupadas).length === 0 ? (
            <p className="text-muted">No hay parametros registrados.</p>
          ) : (
            Object.entries(seccionesAgrupadas).map(([seccion, items]) => (
              <div key={seccion} className="mb-4">
                <div className="fw-bold text-uppercase mb-2" style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}>
                  {seccion}
                </div>
                {items.map((p) => {
                  const r = respuestas[p.id];
                  return (
                    <div key={p.id} className="d-flex justify-content-between align-items-start border-bottom py-2">
                      <div style={{ flex: 1 }}>
                        <div>
                          {p.codigo ? `${p.codigo}. ` : ""}
                          {p.descripcion}
                        </div>
                        {/* Valores condicionales */}
                        {r?.valor_fecha && (
                          <small className="text-info d-block mt-1">
                            <strong>{p.etiqueta_campo_condicional || "Fecha"}:</strong>{" "}
                            {new Date(r.valor_fecha + "T00:00:00").toLocaleDateString()}
                          </small>
                        )}
                        {r?.valor_cantidad != null && (
                          <small className="text-info d-block mt-1">
                            <strong>{p.etiqueta_campo_condicional || "Cantidad"}:</strong> {r.valor_cantidad}
                          </small>
                        )}
                        {r?.valor_texto && (
                          <small className="text-info d-block mt-1">
                            <strong>{p.etiqueta_campo_condicional || "Detalle"}:</strong> {r.valor_texto}
                          </small>
                        )}
                        {r?.observacion && (
                          <small className="text-muted d-block mt-1">
                            Obs: {r.observacion}
                          </small>
                        )}
                      </div>
                      <div className="ms-3">
                        {r?.valor_bool === true && <span className="badge bg-success">SI</span>}
                        {r?.valor_bool === false && <span className="badge bg-danger">NO</span>}
                        {(r?.valor_bool == null) && <span className="badge bg-secondary">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Observaciones y Recomendaciones */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Observaciones y Recomendaciones</h6>
          <hr />
          <div className="mb-3">
            <small className="text-muted">Observaciones</small>
            <div className="border rounded p-2 bg-light" style={{ minHeight: 60 }}>
              {supervision.observaciones || "Sin observaciones"}
            </div>
          </div>
          <div>
            <small className="text-muted">Recomendaciones</small>
            <div className="border rounded p-2 bg-light" style={{ minHeight: 60 }}>
              {supervision.recomendaciones || "Sin recomendaciones"}
            </div>
          </div>
        </div>
      </div>

      {/* Evidencias */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Evidencias ({evidencias.length})</h6>
          <hr />
          {evidencias.length === 0 ? (
            <p className="text-muted">No hay evidencias registradas.</p>
          ) : (
            <div className="list-group">
              {evidencias.map((ev) => (
                <div key={ev.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                      {ev.archivo_url.split("/").slice(-1)[0]}
                    </div>
                    <small className="text-muted">
                      {ev.tipo || "archivo"} — {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                    </small>
                  </div>
                  {ev.signedUrl && (
                    <a className="btn btn-sm btn-outline-primary" href={ev.signedUrl} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Firmas */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Firmas</h6>
          <hr />
          <div className="row g-3">
            {[
              { label: "Medico Jefe", url: firmaUrls.medicoJefe },
              { label: "Supervisor", url: firmaUrls.supervisor },
              { label: "Digitador", url: firmaUrls.digitador },
            ].map((f) => (
              <div key={f.label} className="col-md-4 text-center">
                <div
                  className="border rounded bg-light d-flex align-items-center justify-content-center"
                  style={{ height: 150 }}
                >
                  {f.url ? (
                    <img src={f.url} alt={f.label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <span className="text-muted">Sin firma</span>
                  )}
                </div>
                <small className="text-muted">{f.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="d-flex gap-2 mb-4 no-print">
        <button className="btn btn-outline-secondary" onClick={() => nav("/supervisiones")}>
          Volver
        </button>
        <button className="btn btn-outline-dark" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
        {isAdmin && supervision.estado === "completado" && (
          <button className="btn btn-success" onClick={marcarRevisado}>
            Marcar como Revisada
          </button>
        )}
      </div>
    </div>
  );
}
