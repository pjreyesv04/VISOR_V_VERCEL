import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { BiPlusCircle, BiListUl, BiCheckCircle, BiTimeFive, BiUser, BiBuilding, BiPackage, BiDesktop } from "react-icons/bi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const nav = useNavigate();
  const { profile, isAdmin, isViewer, user, role } = useAuth();
  const isSupervisorIT = role === "supervisor_informatico";
  const [stats, setStats] = useState({ total: 0, completadas: 0, borradores: 0, revisadas: 0 });
  const [statsIT, setStatsIT] = useState({ total: 0, completadas: 0, borradores: 0, revisadas: 0 });
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Métricas adicionales para admin
  const [adminStats, setAdminStats] = useState({
    supervisionesPorMedico: [],
    establecimientosMasVisitados: [],
    establecimientosSinInsumos: 0
  });

  // Métricas de cumplimiento para viewer
  const [viewerRisCumplimiento, setViewerRisCumplimiento] = useState([]);
  const [viewerTopIncumplimiento, setViewerTopIncumplimiento] = useState([]);

  useEffect(() => {
    // No ejecutar hasta que el rol esté definido
    if (!role || !user?.id) return;

    const fetchData = async () => {
      // Filtrar por auditor_id si no es admin
      const baseQuery = (query) => {
        if (!isAdmin && user?.id) {
          return query.eq("auditor_id", user.id);
        }
        return query;
      };

      // Stats: cada rol solo consulta lo que le corresponde
      if (role === "auditor" || isAdmin) {
        // Stats generales (excluir tipo informatico)
        const baseQueryGeneral = (q) => {
          let query = baseQuery(q);
          return query.or("tipo.eq.general,tipo.is.null");
        };

        const { count: total } = await baseQueryGeneral(supabase.from("supervisiones").select("id", { count: "exact", head: true }));
        const { count: completadas } = await baseQueryGeneral(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "completado"));
        const { count: borradores } = await baseQueryGeneral(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "borrador"));
        const { count: revisadas } = await baseQueryGeneral(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "revisado"));

        setStats({
          total: total || 0,
          completadas: completadas || 0,
          borradores: borradores || 0,
          revisadas: revisadas || 0,
        });
      }

      // Stats IT
      if (isAdmin || isSupervisorIT) {
        const baseQueryIT = (q) => {
          let query = q.eq("tipo", "informatico");
          if (isSupervisorIT && user?.id) query = query.eq("auditor_id", user.id);
          return query;
        };
        const { count: totalIT } = await baseQueryIT(supabase.from("supervisiones").select("id", { count: "exact", head: true }));
        const { count: completadasIT } = await baseQueryIT(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "completado"));
        const { count: borradoresIT } = await baseQueryIT(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "borrador"));
        const { count: revisadasIT } = await baseQueryIT(supabase.from("supervisiones").select("id", { count: "exact", head: true }).eq("estado", "revisado"));
        setStatsIT({ total: totalIT || 0, completadas: completadasIT || 0, borradores: borradoresIT || 0, revisadas: revisadasIT || 0 });
      }

      // Ultimas 5 supervisiones - filtrar por tipo según rol
      let recientesQuery = supabase
        .from("supervisiones")
        .select("id, correlativo, fecha, estado, tipo, ris:ris_id(nombre), establecimiento:establecimiento_id(nombre)")
        .order("fecha", { ascending: false })
        .limit(5);
      recientesQuery = baseQuery(recientesQuery);

      // Filtrar por tipo según el rol del usuario
      if (isSupervisorIT) {
        recientesQuery = recientesQuery.eq("tipo", "informatico");
      } else if (role === "auditor") {
        recientesQuery = recientesQuery.or("tipo.eq.general,tipo.is.null");
      }
      // Admin ve todas sin filtro de tipo

      const { data } = await recientesQuery;

      setRecientes(data || []);

      // Métricas adicionales para admin
      if (isAdmin) {
        // 1. Supervisiones por médico jefe
        const { data: porMedico } = await supabase
          .from("supervisiones")
          .select("medico_jefe")
          .not("medico_jefe", "is", null);

        const medicoCounts = {};
        (porMedico || []).forEach(s => {
          const medico = s.medico_jefe || "Sin médico";
          medicoCounts[medico] = (medicoCounts[medico] || 0) + 1;
        });

        const topMedicos = Object.entries(medicoCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nombre, cantidad]) => ({ nombre, cantidad }));

        // 2. Establecimientos más visitados
        const { data: supervisiones } = await supabase
          .from("supervisiones")
          .select("establecimiento_id, establecimiento:establecimiento_id(nombre)");

        const eessCounts = {};
        (supervisiones || []).forEach(s => {
          const nombre = s.establecimiento?.nombre || "Sin establecimiento";
          eessCounts[nombre] = (eessCounts[nombre] || 0) + 1;
        });

        const topEess = Object.entries(eessCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nombre, cantidad]) => ({ nombre, cantidad }));

        // 3. Establecimientos sin registro de insumos (buscar "desabastecido" en observaciones)
        const { data: conProblemas } = await supabase
          .from("supervisiones")
          .select("observaciones")
          .or("observaciones.ilike.%desabastecido%,observaciones.ilike.%sin insumos%,observaciones.ilike.%falta%");

        setAdminStats({
          supervisionesPorMedico: topMedicos,
          establecimientosMasVisitados: topEess,
          establecimientosSinInsumos: conProblemas?.length || 0
        });
      }

      // Métricas de cumplimiento para Viewer
      if (isViewer) {
        const { data: sups } = await supabase
          .from("supervisiones")
          .select("id, ris_id, ris:ris_id(nombre)")
          .in("estado", ["completado", "revisado"])
          .or("tipo.eq.general,tipo.is.null");

        const supIds = (sups || []).map((s) => s.id);

        if (supIds.length > 0) {
          // Cumplimiento por RIS
          const { data: allResp } = await supabase
            .from("respuestas")
            .select("supervision_id, valor_bool")
            .in("supervision_id", supIds);

          const risMap = {};
          for (const sup of sups || []) {
            const risName = sup.ris?.nombre || "Sin RIS";
            if (!risMap[risName]) risMap[risName] = { total: 0, si: 0 };
          }
          for (const r of allResp || []) {
            const sup = sups.find((s) => s.id === r.supervision_id);
            const risName = sup?.ris?.nombre || "Sin RIS";
            if (!risMap[risName]) risMap[risName] = { total: 0, si: 0 };
            risMap[risName].total++;
            if (r.valor_bool === true) risMap[risName].si++;
          }
          const risData = Object.entries(risMap).map(([ris_nombre, d]) => ({
            ris_nombre,
            porcentaje: d.total > 0 ? Math.round((d.si / d.total) * 100) : 0,
          }));
          setViewerRisCumplimiento(risData);

          // Top 10 incumplimientos
          const { data: params } = await supabase
            .from("parametros")
            .select("id, codigo, descripcion")
            .eq("activo", true);

          const { data: allResp2 } = await supabase
            .from("respuestas")
            .select("parametro_id, valor_bool")
            .in("supervision_id", supIds);

          const paramCount = {};
          (allResp2 || []).forEach((r) => {
            if (!paramCount[r.parametro_id]) paramCount[r.parametro_id] = { total: 0, no: 0 };
            paramCount[r.parametro_id].total++;
            if (r.valor_bool === false) paramCount[r.parametro_id].no++;
          });

          const topNo = Object.entries(paramCount)
            .filter(([, d]) => d.no > 0)
            .sort(([, a], [, b]) => b.no - a.no)
            .slice(0, 10)
            .map(([paramId, d]) => {
              const p = (params || []).find((x) => x.id === paramId);
              return {
                parametro: p ? `${p.codigo || ""} ${p.descripcion}`.trim() : paramId,
                incumplimientos: d.no,
                porcentaje: d.total > 0 ? Math.round((d.no / d.total) * 100) : 0,
              };
            });
          setViewerTopIncumplimiento(topNo);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [role, isAdmin, isViewer, isSupervisorIT, user?.id]);

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
        <div className="d-flex gap-2">
          {/* Médico Auditor - Solo ve supervisión general */}
          {role === "auditor" && (
            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => nav("/nueva-supervision")}>
              <BiPlusCircle /> Nueva Supervisión de Médico Auditor
            </button>
          )}

          {/* Supervisor Informático - Solo ve supervisión informática */}
          {role === "supervisor_informatico" && (
            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => nav("/nueva-supervision-informatica")}>
              <BiDesktop /> Nueva Supervisión Informática
            </button>
          )}

          {/* Admin - Ve ambos botones */}
          {isAdmin && (
            <>
              <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => nav("/nueva-supervision")}>
                <BiPlusCircle /> Nueva Supervisión General
              </button>
              <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => nav("/nueva-supervision-informatica")}>
                <BiDesktop /> Nueva Supervisión Informática
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards - Mostrar SOLO lo correspondiente al rol */}

      {/* AUDITOR - Ve SOLO estadísticas generales */}
      {role === "auditor" && (
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
      )}

      {/* SUPERVISOR IT - Ve SOLO estadísticas informáticas */}
      {role === "supervisor_informatico" && (
        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm">
              <div className="card-body d-flex align-items-center gap-3">
                <div className="rounded-3 p-2" style={{ background: "#e0f2fe" }}>
                  <BiDesktop size={28} color="#0284c7" />
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Total IT</div>
                  <h4 className="mb-0">{loading ? "..." : statsIT.total}</h4>
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
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Borradores IT</div>
                  <h4 className="mb-0">{loading ? "..." : statsIT.borradores}</h4>
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
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Completadas IT</div>
                  <h4 className="mb-0">{loading ? "..." : statsIT.completadas}</h4>
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
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Revisadas IT</div>
                  <h4 className="mb-0">{loading ? "..." : statsIT.revisadas}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN - Ve AMBAS */}
      {isAdmin && (
        <>
          <h6 className="text-muted mb-3">Supervisiones Generales</h6>
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

          <h6 className="text-muted mb-3 mt-4">Supervisiones Informáticas</h6>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-xl-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex align-items-center gap-3">
                  <div className="rounded-3 p-2" style={{ background: "#e0f2fe" }}>
                    <BiDesktop size={28} color="#0284c7" />
                  </div>
                  <div>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>Total IT</div>
                    <h4 className="mb-0">{loading ? "..." : statsIT.total}</h4>
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
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>Borradores IT</div>
                    <h4 className="mb-0">{loading ? "..." : statsIT.borradores}</h4>
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
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>Completadas IT</div>
                    <h4 className="mb-0">{loading ? "..." : statsIT.completadas}</h4>
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
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>Revisadas IT</div>
                    <h4 className="mb-0">{loading ? "..." : statsIT.revisadas}</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEWER — Gráficos de cumplimiento */}
      {isViewer && (
        <div className="row g-3 mb-4">
          {/* Gráfico % Cumplimiento por RIS */}
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h6 className="mb-3">% Cumplimiento por RIS</h6>
                {loading ? (
                  <div className="text-center text-muted py-3">Cargando...</div>
                ) : viewerRisCumplimiento.length === 0 ? (
                  <p className="text-muted">Sin datos de supervisiones completadas</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, viewerRisCumplimiento.length * 45)}>
                    <BarChart data={viewerRisCumplimiento} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="ris_nombre" type="category" width={160} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="porcentaje" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Tabla Top 10 Parámetros con Mayor Incumplimiento */}
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h6 className="mb-3">Top 10 Parámetros con Mayor Incumplimiento</h6>
                {loading ? (
                  <div className="text-center text-muted py-3">Cargando...</div>
                ) : viewerTopIncumplimiento.length === 0 ? (
                  <p className="text-muted">Sin datos</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Parámetro</th>
                          <th>Incumplimientos</th>
                          <th>% Incumplimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewerTopIncumplimiento.map((t, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{t.parametro}</td>
                            <td><span className="badge bg-danger">{t.incumplimientos}</span></td>
                            <td>{t.porcentaje}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                          onClick={() => {
                            const base = s.tipo === "informatico" ? "/supervision-informatica" : "/supervision";
                            s.estado === "borrador" && !isViewer
                              ? nav(`${base}/${s.id}`)
                              : nav(`${base}/${s.id}/ver`);
                          }}
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

      {/* Métricas adicionales para Admin */}
      {isAdmin && (
        <div className="row g-3 mt-3">
          {/* Supervisiones por Médico */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex align-items-center gap-2">
                <BiUser size={20} className="text-primary" />
                <h6 className="mb-0">Top 5 Médicos Jefes Supervisados</h6>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center text-muted py-3">Cargando...</div>
                ) : adminStats.supervisionesPorMedico.length === 0 ? (
                  <div className="text-center text-muted py-3">Sin datos</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {adminStats.supervisionesPorMedico.map((m, idx) => (
                      <div key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <span style={{ fontSize: "0.9rem" }}>{m.nombre}</span>
                        <span className="badge bg-primary rounded-pill">{m.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Establecimientos más visitados */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex align-items-center gap-2">
                <BiBuilding size={20} className="text-success" />
                <h6 className="mb-0">Top 5 Establecimientos Supervisados</h6>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center text-muted py-3">Cargando...</div>
                ) : adminStats.establecimientosMasVisitados.length === 0 ? (
                  <div className="text-center text-muted py-3">Sin datos</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {adminStats.establecimientosMasVisitados.map((e, idx) => (
                      <div key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <span style={{ fontSize: "0.9rem" }}>{e.nombre}</span>
                        <span className="badge bg-success rounded-pill">{e.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerta de establecimientos con problemas de insumos */}
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderLeft: "4px solid #dc3545" }}>
              <div className="card-body d-flex align-items-center gap-3">
                <div className="rounded-3 p-2" style={{ background: "#fee" }}>
                  <BiPackage size={28} color="#dc3545" />
                </div>
                <div className="flex-grow-1">
                  <h6 className="mb-1">Establecimientos con Problemas de Insumos</h6>
                  <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                    Supervisiones con registro de desabastecimiento o falta de insumos
                  </p>
                </div>
                <div className="text-end">
                  <h3 className="mb-0 text-danger">{adminStats.establecimientosSinInsumos}</h3>
                  <small className="text-muted">registros</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
