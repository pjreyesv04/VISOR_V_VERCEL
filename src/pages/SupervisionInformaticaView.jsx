import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item) ?? "SIN_SECCION";
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

const safeJsonParse = (str) => {
  if (!str) return [];
  try { return JSON.parse(str); } catch { return []; }
};

export default function SupervisionInformaticaView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [supervision, setSupervision] = useState(null);
  const [risNombre, setRisNombre] = useState("");
  const [eessNombre, setEessNombre] = useState("");
  const [auditorNombre, setAuditorNombre] = useState("");
  const [parametros, setParametros] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [evidencias, setEvidencias] = useState([]);
  const [firmaUrls, setFirmaUrls] = useState({ supervisor: null, digitador: null, medicoJefe: null });
  const [archivamientoRows, setArchivamientoRows] = useState([]);
  const [controlCalidadRows, setControlCalidadRows] = useState([]);
  const [sepelioRows, setSepelioRows] = useState([]);
  const [indicadoresDiabetes, setIndicadoresDiabetes] = useState({});
  const [imagenesPorParametro, setImagenesPorParametro] = useState({});

  const seccionesAgrupadas = useMemo(() => {
    const activos = (parametros || []).filter((p) => p.activo !== false);
    const grouped = groupBy(activos, (p) => p.seccion || "SIN_SECCION");
    Object.keys(grouped).forEach((k) => {
      grouped[k] = grouped[k].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    });
    return grouped;
  }, [parametros]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Supervisión
      const { data: sup } = await supabase
        .from("supervisiones")
        .select("*, auditor:user_profiles!auditor_id(nombre)")
        .eq("id", id)
        .single();

      if (!sup) { setLoading(false); return; }
      setSupervision(sup);
      setAuditorNombre(sup.auditor_eliminado ? `Eliminado (${sup.auditor_nombre_eliminado || "Desconocido"})` : sup.auditor?.nombre || "—");

      // RIS / EESS
      const { data: ris } = await supabase.from("ris").select("nombre").eq("id", sup.ris_id).single();
      setRisNombre(ris?.nombre || "");
      const { data: est } = await supabase.from("establecimientos").select("nombre").eq("id", sup.establecimiento_id).single();
      setEessNombre(est?.nombre || "");

      // Parámetros IT (incluyendo nuevas columnas)
      const { data: params } = await supabase
        .from("parametros")
        .select("id,seccion,codigo,descripcion,requiere_observacion,orden,activo,tipo_campo_condicional,condicion_campo,etiqueta_campo_condicional,has_tabla_extra,parametro_padre_id,es_grupo,opciones_si,opciones_no,campos_si,campos_no")
        .eq("tipo_supervision", "informatico")
        .order("seccion").order("orden");
      setParametros(params || []);

      // Respuestas
      const { data: resp } = await supabase
        .from("respuestas")
        .select("parametro_id,valor_bool,observacion,valor_fecha,valor_cantidad,valor_cantidad_2,valor_cantidad_3,valor_texto")
        .eq("supervision_id", id);
      const map = {};
      (resp || []).forEach((r) => { map[r.parametro_id] = r; });
      setRespuestas(map);

      // Archivamiento
      const { data: archData } = await supabase
        .from("archivamiento_supervisado").select("*")
        .eq("supervision_id", id).order("fila_numero");
      setArchivamientoRows(archData || []);

      // Control Calidad
      const { data: ccData } = await supabase
        .from("control_calidad_fua").select("*")
        .eq("supervision_id", id).order("fila_numero");
      setControlCalidadRows(ccData || []);

      // Sepelios
      const { data: sepData } = await supabase
        .from("sepelios_supervisados").select("*")
        .eq("supervision_id", id).order("fila_numero");
      setSepelioRows(sepData || []);

      // Indicadores prestacionales
      const { data: ipData } = await supabase
        .from("indicadores_prestacionales").select("*")
        .eq("supervision_id", id);
      if (ipData && ipData.length > 0) {
        const diabetesData = {};
        ipData.forEach(ip => {
          if (ip.indicador_codigo === 'IP.1' && ip.sub_indicador) {
            diabetesData[ip.sub_indicador] = ip.valor_cantidad ?? "";
          }
        });
        setIndicadoresDiabetes(diabetesData);
      }

      // Evidencias
      const { data: evData } = await supabase
        .from("evidencias").select("id,archivo_url,tipo,created_at,descripcion")
        .eq("supervision_id", id).order("created_at", { ascending: false });
      const withSigned = [];
      for (const ev of (evData || [])) {
        let signedUrl = null;
        try {
          const { data: sdata } = await supabase.storage.from("evidencias").createSignedUrl(ev.archivo_url, 3600);
          signedUrl = sdata?.signedUrl || null;
        } catch { /* ignore */ }
        withSigned.push({ ...ev, signedUrl });
      }
      setEvidencias(withSigned);

      // Imágenes por parámetro (B.3)
      const paramsConImagen = (params || []).filter(p => p.codigo === "B.3");
      for (const p of paramsConImagen) {
        const { data: imgData } = await supabase
          .from("evidencias").select("archivo_url")
          .eq("supervision_id", id).like("descripcion", `%${p.id}%`);
        if (imgData && imgData.length > 0) {
          const imgs = [];
          for (const ev of imgData) {
            const { data: sdata } = await supabase.storage.from("evidencias").createSignedUrl(ev.archivo_url, 3600);
            imgs.push({ path: ev.archivo_url, signedUrl: sdata?.signedUrl || null });
          }
          setImagenesPorParametro(prev => ({ ...prev, [p.id]: imgs }));
        }
      }

      // Firmas
      const makeFirmaUrl = async (path) => {
        if (!path) return null;
        const { data } = await supabase.storage.from("firmas").createSignedUrl(path, 3600);
        return data?.signedUrl || null;
      };
      setFirmaUrls({
        supervisor: await makeFirmaUrl(sup.firma_url),
        digitador: await makeFirmaUrl(sup.firma_digitador_url),
        medicoJefe: await makeFirmaUrl(sup.firma_medico_jefe_url),
      });

      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-2 text-muted">Cargando supervisión informática...</p>
      </div>
    );
  }

  if (!supervision) {
    return <div className="alert alert-danger">No se encontró la supervisión.</div>;
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const estadoBadge = (estado) => {
    const map = { borrador: "bg-warning text-dark", completado: "bg-success", revisado: "bg-primary" };
    return map[estado] || "bg-secondary";
  };

  const marcarRevisado = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("supervisiones")
      .update({ estado: "revisado", revisado_por: userData?.user?.id, revisado_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Error al marcar como revisado"); }
    else { toast.success("Supervisión marcada como revisada"); nav("/supervisiones-informatica"); }
  };

  // ========== Render de sub-parámetros (B.1, B.4) en vista ==========
  const renderGrupoSubParametrosView = (padre) => {
    const hijos = (parametros || []).filter(p => p.parametro_padre_id === padre.id && p.activo !== false)
      .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    if (hijos.length === 0) return null;

    const esB4 = padre.codigo === 'B.4';

    return (
      <div className="mt-2 ms-3">
        <div className="table-responsive">
          <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
            <thead className="table-light">
              <tr>
                <th>Sistema</th>
                <th style={{ width: 60 }}>{esB4 ? "No" : "Sí"}</th>
                <th style={{ width: 60 }}>{esB4 ? "Sí" : "No"}</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {hijos.map(hijo => {
                const r = respuestas[hijo.id];
                const valorBool = r?.valor_bool;
                const mostrarDetalle = esB4 ? valorBool === true : valorBool === false;
                const detalle = r?.valor_texto || r?.observacion || "";

                return (
                  <tr key={hijo.id}>
                    <td className="fw-semibold">{hijo.descripcion}</td>
                    <td className="text-center">
                      {esB4
                        ? (valorBool === false ? <span className="text-success">●</span> : "")
                        : (valorBool === true ? <span className="text-success">●</span> : "")
                      }
                    </td>
                    <td className="text-center">
                      {esB4
                        ? (valorBool === true ? <span className="text-danger">●</span> : "")
                        : (valorBool === false ? <span className="text-danger">●</span> : "")
                      }
                    </td>
                    <td>{mostrarDetalle && detalle ? detalle : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ========== Render campos condicionales en vista ==========
  const renderCamposCondicionales = (p, r) => {
    if (!r) return null;

    const camposSi = safeJsonParse(p.campos_si);
    const opcionesNo = safeJsonParse(p.opciones_no);

    const items = [];

    // Campos para Sí
    if (r.valor_bool === true && camposSi.length > 0) {
      if (camposSi.includes("velocidad_mbps") && r.valor_cantidad != null) {
        items.push(<small key="vel" className="text-info d-block"><strong>Velocidad:</strong> {r.valor_cantidad} Mbps</small>);
      }
      if (camposSi.includes("estado_internet") && r.valor_texto) {
        items.push(<small key="estado_i" className="text-info d-block"><strong>Estado:</strong> {r.valor_texto}</small>);
      }
      if (camposSi.includes("hora_registro") && r.valor_texto) {
        items.push(<small key="hora_reg" className="text-info d-block"><strong>Hora de registro:</strong> {r.valor_texto}</small>);
      }
      if (camposSi.includes("fecha_hora_ultima_carga") && r.valor_texto) {
        items.push(<small key="ultima_carga" className="text-info d-block"><strong>Última carga:</strong> {r.valor_texto}</small>);
      }
      if (camposSi.includes("version_arfsis") && r.valor_texto) {
        items.push(<small key="version" className="text-info d-block"><strong>Versión ARFSIS:</strong> {r.valor_texto}</small>);
      }
      if (camposSi.includes("fecha_act_maestros") && r.valor_fecha) {
        items.push(<small key="maestros" className="text-info d-block"><strong>Últ. actualización maestros:</strong> {r.valor_fecha}</small>);
      }
      if (camposSi.includes("fecha_act_afiliados") && r.valor_texto_2) {
        items.push(<small key="afiliados" className="text-info d-block"><strong>Últ. actualización afiliados:</strong> {r.valor_texto_2}</small>);
      }
      if (camposSi.includes("numeracion_inicial") && r.valor_texto) {
        items.push(<small key="num_ini" className="text-info d-block"><strong>Numeración Inicial:</strong> {r.valor_texto}</small>);
      }
      if (camposSi.includes("numeracion_final") && r.valor_texto_2) {
        items.push(<small key="num_fin" className="text-info d-block"><strong>Numeración Final:</strong> {r.valor_texto_2}</small>);
      }
      if ((camposSi.includes("cantidad_fuas_entregados") || camposSi.includes("cantidad_fuas_devueltos") || camposSi.includes("cantidad_fuas_observadas")) && r.valor_cantidad != null) {
        items.push(<small key="cant" className="text-info d-block"><strong>{p.etiqueta_campo_condicional || "Cantidad"}:</strong> {r.valor_cantidad}</small>);
      }
      if (camposSi.includes("cantidad_fuas_anuladas") && r.valor_cantidad_2 != null) {
        items.push(<small key="anuladas" className="text-info d-block"><strong>FUAs Anuladas:</strong> {r.valor_cantidad_2}</small>);
      }
      if (camposSi.includes("fecha_ultimo_tomo") && r.valor_fecha) {
        items.push(<small key="ult_tomo" className="text-info d-block"><strong>Fecha último Tomo:</strong> {r.valor_fecha}</small>);
      }
    }

    // Dropdown para No
    if (r.valor_bool === false && opcionesNo.length > 0 && r.valor_texto) {
      items.push(<small key="motivo_no" className="text-warning d-block"><strong>Motivo:</strong> {r.valor_texto}</small>);
      if (r.valor_texto === "Otro" && r.observacion) {
        items.push(<small key="otro_detalle" className="text-muted d-block"><strong>Detalle:</strong> {r.observacion}</small>);
      }
    }

    // Campo condicional genérico (sin campos_si)
    if (camposSi.length === 0) {
      if (r.valor_cantidad != null && p.tipo_campo_condicional === "cantidad") {
        items.push(<small key="cant_gen" className="text-info d-block"><strong>{p.etiqueta_campo_condicional || "Cantidad"}:</strong> {r.valor_cantidad}</small>);
      }
      if (r.valor_texto && p.tipo_campo_condicional === "texto" && !p.es_grupo) {
        items.push(<small key="txt_gen" className="text-info d-block"><strong>{p.etiqueta_campo_condicional || "Detalle"}:</strong> {r.valor_texto}</small>);
      }
      if (r.valor_fecha && p.tipo_campo_condicional === "fecha") {
        items.push(<small key="fecha_gen" className="text-info d-block"><strong>{p.etiqueta_campo_condicional || "Fecha"}:</strong> {r.valor_fecha}</small>);
      }
    }

    return items.length > 0 ? <div className="mt-1">{items}</div> : null;
  };

  // ========== Render parámetro individual en vista ==========
  const renderParametroView = (p) => {
    // No renderizar hijos directamente
    if (p.parametro_padre_id) return null;

    const r = respuestas[p.id];
    const isTableOnly = ["tabla_archivamiento", "tabla_control_calidad", "tabla_sepelios", "tabla_indicadores_diabetes"].includes(p.has_tabla_extra);
    const isCantidadOnly = p.tipo_campo_condicional === "cantidad" && p.condicion_campo === "siempre" && !p.has_tabla_extra;
    const ocultarBadge = isTableOnly || isCantidadOnly || p.es_grupo;

    return (
      <div key={p.id} className="d-flex justify-content-between align-items-start border-bottom py-2">
        <div style={{ flex: 1 }}>
          <div>{p.codigo ? `${p.codigo}. ` : ""}{p.descripcion}</div>

          {/* Grupo de sub-parámetros */}
          {p.es_grupo && renderGrupoSubParametrosView(p)}

          {/* Campos condicionales */}
          {renderCamposCondicionales(p, r)}

          {/* Observación */}
          {r?.observacion && !(r.valor_bool === false && safeJsonParse(p.opciones_no).length > 0) && !p.es_grupo && (
            <small className="text-muted d-block mt-1">Obs: {r.observacion}</small>
          )}

          {/* Imágenes de B.3 */}
          {p.codigo === "B.3" && (imagenesPorParametro[p.id] || []).length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {imagenesPorParametro[p.id].map((img, idx) => (
                <div key={idx} style={{ width: 120 }}>
                  {img.signedUrl ? (
                    <a href={img.signedUrl} target="_blank" rel="noreferrer">
                      <img src={img.signedUrl} alt={`Evidencia ${idx + 1}`} className="img-thumbnail" style={{ width: 120, height: 90, objectFit: "cover" }} />
                    </a>
                  ) : (
                    <span className="text-muted" style={{ fontSize: "0.8rem" }}>Sin imagen</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {!ocultarBadge && (
          <div className="ms-3">
            {r?.valor_bool === true && <span className="badge bg-success">SI</span>}
            {r?.valor_bool === false && <span className="badge bg-danger">NO</span>}
            {r?.valor_bool == null && <span className="badge bg-secondary">—</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Cabecera */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h5 className="mb-1">ACTA DE SUPERVISIÓN — INFORMÁTICA</h5>
              <div className="text-muted">
                <strong>N:</strong> {supervision.correlativo ?? "—"} |{" "}
                <strong>RIS:</strong> {risNombre || "—"} |{" "}
                <strong>EESS:</strong> {eessNombre || "—"}
              </div>
            </div>
            <div className="text-end">
              <span className={`badge ${estadoBadge(supervision.estado)} mb-1`}>{supervision.estado}</span>
              <div style={{ fontSize: "0.85rem" }}>
                <div><strong>Fecha:</strong> {fmt(supervision.fecha)}</div>
                <div><strong>Inicio:</strong> {fmtTime(supervision.hora_inicio)}</div>
                <div><strong>Fin:</strong> {fmtTime(supervision.hora_fin)}</div>
              </div>
            </div>
          </div>
          <hr />
          <div className="row g-3">
            <div className="col-md-3">
              <small className="text-muted">Supervisor Informático</small>
              <div className="fw-semibold">{auditorNombre}</div>
            </div>
            <div className="col-md-3">
              <small className="text-muted">Sector de Trabajo</small>
              <div className="fw-semibold">{supervision.sector_trabajo || "—"}</div>
            </div>
            <div className="col-md-3">
              <small className="text-muted">Médico Jefe</small>
              <div className="fw-semibold">{supervision.medico_jefe || "—"}</div>
            </div>
            <div className="col-md-3">
              <small className="text-muted">Digitador</small>
              <div className="fw-semibold">{supervision.digitador || "—"}</div>
            </div>
            {supervision.cel_correo_locador && (
              <div className="col-md-6">
                <small className="text-muted">Cel/Correo Locador</small>
                <div className="fw-semibold">{supervision.cel_correo_locador}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Evaluación */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Aspectos de Evaluación</h6>
          <hr />
          {Object.keys(seccionesAgrupadas).length === 0 ? (
            <p className="text-muted">No hay parámetros registrados.</p>
          ) : (
            Object.entries(seccionesAgrupadas).map(([seccion, items]) => (
              <div key={seccion} className="mb-4">
                <div className="fw-bold text-uppercase mb-2" style={{ fontSize: "0.85rem", letterSpacing: "0.4px" }}>{seccion}</div>
                {items.map((p) => renderParametroView(p))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Archivamiento Supervisado */}
      {archivamientoRows.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6>Archivamiento Supervisado</h6>
            <hr />
            <div className="table-responsive">
              <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
                <thead className="table-light">
                  <tr>
                    <th>N°</th><th>Año</th><th>Mes Inicio</th><th>Mes Fin</th><th>N° Caja</th><th>N° Tomo</th><th>Cant. Foleo</th><th>Cant. FUAs</th><th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {archivamientoRows.map((a) => (
                    <tr key={a.fila_numero}>
                      <td>{a.fila_numero}</td><td>{a.anio || "—"}</td><td>{a.mes_inicio || "—"}</td><td>{a.mes_fin || "—"}</td>
                      <td>{a.nro_caja || "—"}</td><td>{a.nro_tomo || "—"}</td><td>{a.cantidad_foleo ?? "—"}</td><td>{a.cantidad_fuas ?? "—"}</td><td>{a.observacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Control de Calidad */}
      {controlCalidadRows.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6>Ficha de Control de Calidad del Registro de Digitación de las FUAs</h6>
            <hr />
            <div className="table-responsive">
              <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
                <thead className="table-light">
                  <tr>
                    <th>N°</th><th>FUA</th><th>Fecha Atención</th><th>Cód. Prest.</th><th>Nombre Profesional</th><th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {controlCalidadRows.map((c) => (
                    <tr key={c.fila_numero}>
                      <td>{c.fila_numero}</td><td>{c.fua || "—"}</td>
                      <td>{c.fecha_atencion ? new Date(c.fecha_atencion + "T00:00:00").toLocaleDateString() : "—"}</td>
                      <td>{c.cod_prestacional || "—"}</td><td>{c.nombre_profesional || "—"}</td><td>{c.observacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sepelios */}
      {sepelioRows.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6>Registro de Sepelios</h6>
            <hr />
            <div className="table-responsive">
              <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
                <thead className="table-light">
                  <tr>
                    <th>N°</th><th>DNI</th><th>Nombre del Afiliado</th><th>Fecha de Registro</th><th>Estado</th><th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {sepelioRows.map((s) => (
                    <tr key={s.fila_numero}>
                      <td>{s.fila_numero}</td><td>{s.dni || "—"}</td><td>{s.nombre_afiliado || "—"}</td>
                      <td>{s.fecha_registro ? new Date(s.fecha_registro + "T00:00:00").toLocaleDateString() : "—"}</td>
                      <td>{s.estado || "—"}</td><td>{s.observacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Indicadores Prestacionales - Diabetes */}
      {Object.keys(indicadoresDiabetes).length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6>Indicadores Prestacionales — Diabetes Mellitus (IP.1)</h6>
            <hr />
            <div className="table-responsive">
              <table className="table table-bordered table-sm" style={{ fontSize: "0.85rem" }}>
                <thead className="table-light">
                  <tr>
                    <th>Indicador</th>
                    <th style={{ width: 200 }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>HBA1c (Hemoglobina Glicosilada)</td>
                    <td>{indicadoresDiabetes.hba1c ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>Microalbuminuria sérica</td>
                    <td>{indicadoresDiabetes.microalbuminuria ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>Creatinina</td>
                    <td>{indicadoresDiabetes.creatinina ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Otras Actividades */}
      {supervision.otras_actividades && Object.values(supervision.otras_actividades).some((v) => v) && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6>Otras Actividades del Supervisor Informático</h6>
            <hr />
            {["A", "B", "C", "D", "E", "F"].map((letra) =>
              supervision.otras_actividades[letra] ? (
                <div key={letra} className="mb-2">
                  <strong>{letra}.</strong> {supervision.otras_actividades[letra]}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Observaciones y Recomendaciones */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6>Observaciones y Recomendaciones</h6>
          <hr />
          <div className="mb-3">
            <small className="text-muted">Observaciones en General</small>
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
                    <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>{ev.archivo_url.split("/").slice(-1)[0]}</div>
                    <small className="text-muted">{ev.tipo || "archivo"} — {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}</small>
                  </div>
                  {ev.signedUrl && (
                    <a className="btn btn-sm btn-outline-primary" href={ev.signedUrl} target="_blank" rel="noreferrer">Abrir</a>
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
              { label: "Médico Jefe del EESS", url: firmaUrls.medicoJefe },
              { label: "Locador de Servicio OFSEG", url: firmaUrls.digitador },
              { label: "Supervisor Informático OFSEG", url: firmaUrls.supervisor },
            ].map((f) => (
              <div key={f.label} className="col-md-4 text-center">
                <div className="border rounded bg-light d-flex align-items-center justify-content-center" style={{ height: 150 }}>
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
        <button className="btn btn-outline-secondary" onClick={() => nav("/supervisiones-informatica")}>Volver</button>
        <button className="btn btn-outline-dark" onClick={() => window.print()}>Imprimir / PDF</button>
        {isAdmin && supervision.estado === "completado" && (
          <button className="btn btn-success" onClick={marcarRevisado}>Marcar como Revisada</button>
        )}
      </div>
    </div>
  );
}
