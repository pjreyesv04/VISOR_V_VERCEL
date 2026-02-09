import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { BiPlusCircle, BiListUl, BiCheckCircle, BiTimeFive } from "react-icons/bi";

export default function Dashboard() {
  const nav = useNavigate();
  const { profile, isAdmin, isViewer } = useAuth();
  const [stats, setStats] = useState({ total: 0, completadas: 0, borradores: 0, revisadas: 0 });
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Stats
      const { count: total } = await supabase
        .from("supervisiones")
        .select("id", { count: "exact", head: true });

      const { count: completadas } = await supabase
        .from("supervisiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "completado");

      const { count: borradores } = await supabase
        .from("supervisiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "borrador");

      const { count: revisadas } = await supabase
        .from("supervisiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "revisado");

      setStats({
        total: total || 0,
        completadas: completadas || 0,
        borradores: borradores || 0,
        revisadas: revisadas || 0,
      });

      // Ultimas 5 supervisiones
      const { data } = await supabase
        .from("supervisiones")
        .select("id, correlativo, fecha, estado, ris:ris_id(nombre), establecimiento:establecimiento_id(nombre)")
        .order("fecha", { ascending: false })
        .limit(5);

      setRecientes(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const estadoBadge = (estado) => {
    const map = {
      borrador: "bg-warning text-dark",
      completado: "bg-success",
      revisado: "bg-primary",
    };
    return map[estado] || "bg-secondary";
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1">Bienvenido, {profile?.nombre || "Usuario"}</h4>
          <p className="text-muted mb-0">Panel de control del sistema de supervision</p>
        </div>
        {!isViewer && (
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => nav("/nueva")}>
            <BiPlusCircle /> Nueva Supervision
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 p-2" style={{ background: "#ede9fe" }}>
                <BiListUl size={28} color="#7c3aed" />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Total</div>
                <h4 className="mb-0">{loading ? "..." : stats.total}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 p-2" style={{ background: "#fef3c7" }}>
                <BiTimeFive size={28} color="#d97706" />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Borradores</div>
                <h4 className="mb-0">{loading ? "..." : stats.borradores}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 p-2" style={{ background: "#d1fae5" }}>
                <BiCheckCircle size={28} color="#059669" />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Completadas</div>
                <h4 className="mb-0">{loading ? "..." : stats.completadas}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 p-2" style={{ background: "#dbeafe" }}>
                <BiCheckCircle size={28} color="#2563eb" />
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Revisadas</div>
                <h4 className="mb-0">{loading ? "..." : stats.revisadas}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supervisiones Recientes */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Supervisiones Recientes</h6>
          <button className="btn btn-sm btn-outline-primary" onClick={() => nav("/supervisiones")}>
            Ver todas
          </button>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3 text-center text-muted">Cargando...</div>
          ) : recientes.length === 0 ? (
            <div className="p-3 text-center text-muted">No hay supervisiones registradas</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>N</th>
                    <th>Fecha</th>
                    <th>RIS</th>
                    <th>Establecimiento</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((s) => (
                    <tr key={s.id}>
                      <td>{s.correlativo ?? "—"}</td>
                      <td>{s.fecha ? new Date(s.fecha).toLocaleDateString() : "—"}</td>
                      <td>{s.ris?.nombre || "—"}</td>
                      <td>{s.establecimiento?.nombre || "—"}</td>
                      <td>
                        <span className={`badge ${estadoBadge(s.estado)}`}>{s.estado}</span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() =>
                            s.estado === "borrador" && !isViewer
                              ? nav(`/supervision/${s.id}`)
                              : nav(`/supervision/${s.id}/ver`)
                          }
                        >
                          {s.estado === "borrador" && !isViewer ? "Editar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
