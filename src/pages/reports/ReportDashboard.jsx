import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { exportSimpleTableToExcel } from "../../lib/exportExcel";
import { exportComplianceReportPdf } from "../../lib/exportPdf";

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6"];

export default function ReportDashboard() {
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [risFilter, setRisFilter] = useState("");
  const [risList, setRisList] = useState([]);

  // Data
  const [statusData, setStatusData] = useState([]);
  const [risCumplimiento, setRisCumplimiento] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [topIncumplimiento, setTopIncumplimiento] = useState([]);

  useEffect(() => {
    supabase
      .from("ris")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setRisList(data || []));
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fechaDesde, fechaHasta, risFilter]);

  const fetchReportData = async () => {
    setLoading(true);

    try {
      // 1. Distribucion por estado
      let statusQuery = supabase.from("supervisiones").select("estado");
      if (fechaDesde) statusQuery = statusQuery.gte("fecha", fechaDesde);
      if (fechaHasta) statusQuery = statusQuery.lte("fecha", fechaHasta);
      if (risFilter) statusQuery = statusQuery.eq("ris_id", risFilter);

      const { data: statusRows } = await statusQuery;
      const statusCount = {};
      (statusRows || []).forEach((s) => {
        statusCount[s.estado] = (statusCount[s.estado] || 0) + 1;
      });
      setStatusData(
        Object.entries(statusCount).map(([name, value]) => ({ name, value }))
      );

      // 2. Cumplimiento por RIS
      let supQuery = supabase
        .from("supervisiones")
        .select("id, ris_id, ris:ris_id(nombre)")
        .in("estado", ["completado", "revisado"]);
      if (fechaDesde) supQuery = supQuery.gte("fecha", fechaDesde);
      if (fechaHasta) supQuery = supQuery.lte("fecha", fechaHasta);
      if (risFilter) supQuery = supQuery.eq("ris_id", risFilter);

      const { data: sups } = await supQuery;
      const supIds = (sups || []).map((s) => s.id);

      if (supIds.length > 0) {
        const { data: allResp } = await supabase
          .from("respuestas")
          .select("supervision_id, valor_bool")
          .in("supervision_id", supIds);

        // Agrupar por RIS
        const risMap = {};
        for (const sup of sups || []) {
          const risName = sup.ris?.nombre || "Sin RIS";
          if (!risMap[risName]) risMap[risName] = { total: 0, si: 0, supervisiones: 0 };
          risMap[risName].supervisiones++;
        }

        for (const r of allResp || []) {
          const sup = sups.find((s) => s.id === r.supervision_id);
          const risName = sup?.ris?.nombre || "Sin RIS";
          if (!risMap[risName]) risMap[risName] = { total: 0, si: 0, supervisiones: 0 };
          risMap[risName].total++;
          if (r.valor_bool === true) risMap[risName].si++;
        }

        const risData = Object.entries(risMap).map(([name, d]) => ({
          ris_nombre: name,
          total_supervisiones: d.supervisiones,
          total_respuestas: d.total,
          respuestas_si: d.si,
          porcentaje: d.total > 0 ? Math.round((d.si / d.total) * 100) : 0,
        }));

        setRisCumplimiento(risData);
      } else {
        setRisCumplimiento([]);
      }

      // 3. Supervisiones por mes
      let monthQuery = supabase.from("supervisiones").select("fecha");
      if (fechaDesde) monthQuery = monthQuery.gte("fecha", fechaDesde);
      if (fechaHasta) monthQuery = monthQuery.lte("fecha", fechaHasta);
      if (risFilter) monthQuery = monthQuery.eq("ris_id", risFilter);

      const { data: monthRows } = await monthQuery;
      const monthMap = {};
      (monthRows || []).forEach((s) => {
        if (s.fecha) {
          const month = s.fecha.slice(0, 7); // YYYY-MM
          monthMap[month] = (monthMap[month] || 0) + 1;
        }
      });
      const sortedMonths = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, cantidad]) => ({ mes, cantidad }));
      setMonthlyData(sortedMonths);

      // 4. Parametros con mas incumplimiento
      if (supIds.length > 0) {
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

        setTopIncumplimiento(topNo);
      } else {
        setTopIncumplimiento([]);
      }
    } catch (e) {
      toast.error("Error cargando reportes: " + (e?.message || e));
    }

    setLoading(false);
  };

  const handleExportExcel = () => {
    if (risCumplimiento.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const data = risCumplimiento.map((r) => ({
      RIS: r.ris_nombre,
      Supervisiones: r.total_supervisiones,
      "Total Respuestas": r.total_respuestas,
      "Cumple (SI)": r.respuestas_si,
      "% Cumplimiento": r.porcentaje,
    }));
    exportSimpleTableToExcel(data, "Cumplimiento", `reporte_cumplimiento_${new Date().toISOString().slice(0, 10)}`);
    toast.success("Excel exportado");
  };

  const handleExportPdf = () => {
    if (risCumplimiento.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    exportComplianceReportPdf(risCumplimiento, { fechaDesde, fechaHasta });
    toast.success("PDF exportado");
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Reportes y Analiticas</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-success" onClick={handleExportExcel}>
            Exportar Excel
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={handleExportPdf}>
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>Desde</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" style={{ fontSize: "0.8rem" }}>RIS</label>
              <select
                className="form-select form-select-sm"
                value={risFilter}
                onChange={(e) => setRisFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {risList.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setFechaDesde(""); setFechaHasta(""); setRisFilter(""); }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
          <p className="mt-2 text-muted">Cargando reportes...</p>
        </div>
      ) : (
        <>
          {/* Row 1: Estado + Supervisiones por mes */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6>Distribucion por Estado</h6>
                  {statusData.length === 0 ? (
                    <p className="text-muted">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {statusData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6>Supervisiones por Mes</h6>
                  {monthlyData.length === 0 ? (
                    <p className="text-muted">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Cumplimiento por RIS */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h6>% Cumplimiento por RIS</h6>
                  {risCumplimiento.length === 0 ? (
                    <p className="text-muted">Sin datos de supervisiones completadas</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={risCumplimiento} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} unit="%" />
                        <YAxis dataKey="ris_nombre" type="category" width={150} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Bar dataKey="porcentaje" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Top incumplimiento */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h6>Top 10 Parametros con Mayor Incumplimiento</h6>
                  {topIncumplimiento.length === 0 ? (
                    <p className="text-muted">Sin datos</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Parametro</th>
                            <th>Incumplimientos</th>
                            <th>% Incumplimiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topIncumplimiento.map((t, i) => (
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

          {/* Tabla resumen */}
          {risCumplimiento.length > 0 && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <h6>Resumen por RIS</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                    <thead className="table-light">
                      <tr>
                        <th>RIS</th>
                        <th>Supervisiones</th>
                        <th>Total Resp.</th>
                        <th>Cumple (SI)</th>
                        <th>% Cumplimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risCumplimiento.map((r, i) => (
                        <tr key={i}>
                          <td>{r.ris_nombre}</td>
                          <td>{r.total_supervisiones}</td>
                          <td>{r.total_respuestas}</td>
                          <td>{r.respuestas_si}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="progress flex-grow-1" style={{ height: 8 }}>
                                <div
                                  className={`progress-bar ${r.porcentaje >= 80 ? "bg-success" : r.porcentaje >= 50 ? "bg-warning" : "bg-danger"}`}
                                  style={{ width: `${r.porcentaje}%` }}
                                />
                              </div>
                              <small className="fw-bold">{r.porcentaje}%</small>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
