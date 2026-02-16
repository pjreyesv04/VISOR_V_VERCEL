import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../hooks/useAuth.js";

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item) ?? "SIN_SECCION";
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

async function dataURLToBlob(dataURL) {
  const res = await fetch(dataURL);
  return await res.blob();
}

const EMPTY_ARCHIVAMIENTO = {
  anio: "", mes_inicio: "", mes_fin: "", nro_caja: "", nro_tomo: "",
  cantidad_foleo: "", cantidad_fuas: "", observacion: "",
};

const EMPTY_CONTROL_CALIDAD = {
  fua: "", fecha_atencion: "", cod_prestacional: "", nombre_profesional: "", observacion: "",
};

const EMPTY_SEPELIO = {
  dni: "", nombre_afiliado: "", fecha_registro: "", estado: "", observacion: "",
};

export default function SupervisionInformaticaForm() {
  const { id } = useParams();
  const supervisionId = id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  // Cabecera
  const [correlativo, setCorrelativo] = useState(null);
  const [risNombre, setRisNombre] = useState("");
  const [establecimientoNombre, setEstablecimientoNombre] = useState("");
  const [sectorTrabajo, setSectorTrabajo] = useState("");
  const [celCorreoLocador, setCelCorreoLocador] = useState("");

  const [fechaTxt, setFechaTxt] = useState("");
  const [horaInicioTxt, setHoraInicioTxt] = useState("");
  const [horaFinTxt, setHoraFinTxt] = useState("");

  const [medicoJefeNombre, setMedicoJefeNombre] = useState("");
  const [digitadorNombre, setDigitadorNombre] = useState("");
  const [digitadorId, setDigitadorId] = useState(null);
  const [digitadoresDisponibles, setDigitadoresDisponibles] = useState([]);

  // Observaciones globales
  const [observaciones, setObservaciones] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");

  // Otras actividades (A-F)
  const [otrasActividades, setOtrasActividades] = useState({
    A: "", B: "", C: "", D: "", E: "", F: "",
  });

  // Parámetros dinámicos
  const [parametros, setParametros] = useState([]);
  const [respuestas, setRespuestas] = useState({});

  // Tablas extra IT
  const [archivamientoRows, setArchivamientoRows] = useState(
    Array.from({ length: 10 }, () => ({ ...EMPTY_ARCHIVAMIENTO }))
  );
  const [controlCalidadRows, setControlCalidadRows] = useState(
    Array.from({ length: 40 }, () => ({ ...EMPTY_CONTROL_CALIDAD }))
  );

  // Tabla sepelios (C.5)
  const [sepelioRows, setSepelioRows] = useState(
    Array.from({ length: 10 }, () => ({ ...EMPTY_SEPELIO }))
  );

  // Indicadores prestacionales (IP)
  const [indicadoresDiabetes, setIndicadoresDiabetes] = useState({
    hba1c: "", microalbuminuria: "", creatinina: "",
  });

  // Firmas
  const sigSupervisorRef = useRef(null);
  const sigDigitadorRef = useRef(null);
  const sigMedicoJefeRef = useRef(null);

  const [firmaSupervisorPath, setFirmaSupervisorPath] = useState(null);
  const [firmaDigitadorPath, setFirmaDigitadorPath] = useState(null);
  const [firmaMedicoJefePath, setFirmaMedicoJefePath] = useState(null);

  const [firmaSupervisorUrl, setFirmaSupervisorUrl] = useState(null);
  const [firmaDigitadorUrl, setFirmaDigitadorUrl] = useState(null);
  const [firmaMedicoJefeUrl, setFirmaMedicoJefeUrl] = useState(null);

  // Imagenes por parámetro
  const [imagenesPorParametro, setImagenesPorParametro] = useState({});
  const [subiendoImagenParametro, setSubiendoImagenParametro] = useState({});

  // Evidencias
  const [evidencias, setEvidencias] = useState([]);
  const [subiendoEvidencias, setSubiendoEvidencias] = useState(false);

  const seccionesAgrupadas = useMemo(() => {
    const activos = (parametros || []).filter((p) => p.activo !== false);
    const grouped = groupBy(activos, (p) => p.seccion || "SIN_SECCION");
    Object.keys(grouped).forEach((k) => {
      grouped[k] = grouped[k].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    });
    return grouped;
  }, [parametros]);

  const nowAsText = () => {
    const now = new Date();
    return {
      fecha: now.toLocaleDateString(),
      hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      iso: now.toISOString(),
    };
  };

  const formatFechaISO = (isoString) => {
    if (!isoString) return "";
    const fechaSolo = isoString.split("T")[0];
    const date = new Date(fechaSolo + "T00:00:00");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const setResp = (paramId, patch) => {
    setRespuestas((prev) => {
      const current = prev[paramId] || {
        valor_bool: null, observacion: "", valor_fecha: null,
        valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "",
      };
      return { ...prev, [paramId]: { ...current, ...patch } };
    });
  };

  // ========== Firmas ==========
  const refreshFirmasSignedUrls = async (pSup, pDig, pJefe) => {
    const make = async (path) => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from("firmas").createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl || null;
    };
    try {
      setFirmaSupervisorUrl(await make(pSup));
      setFirmaDigitadorUrl(await make(pDig));
      setFirmaMedicoJefeUrl(await make(pJefe));
    } catch { /* ignore */ }
  };

  // ========== Imagenes por parámetro ==========
  const subirImagenParametro = async (parametroId, file) => {
    if (!file) return;
    setSubiendoImagenParametro(prev => ({ ...prev, [parametroId]: true }));
    try {
      const cleanName = file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${supervisionId}/param_${parametroId}_${Date.now()}_${cleanName}`;
      const { error: upErr } = await supabase.storage.from("evidencias").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const tipo = file.type || "image/png";
      const { error: insErr } = await supabase.from("evidencias").insert([{ supervision_id: supervisionId, archivo_url: path, tipo, descripcion: `Imagen del parámetro ${parametroId}` }]);
      if (insErr) throw insErr;
      // Obtener URL firmada
      const { data: sdata } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60);
      const signedUrl = sdata?.signedUrl || null;
      setImagenesPorParametro(prev => ({
        ...prev,
        [parametroId]: [...(prev[parametroId] || []), { path, signedUrl }]
      }));
      toast.success("Imagen subida correctamente");
    } catch (e) {
      toast.error("Error subiendo imagen: " + (e?.message || e));
    } finally {
      setSubiendoImagenParametro(prev => ({ ...prev, [parametroId]: false }));
    }
  };

  const eliminarImagenParametro = async (parametroId, path) => {
    try {
      await supabase.storage.from("evidencias").remove([path]);
      await supabase.from("evidencias").delete().eq("archivo_url", path);
      setImagenesPorParametro(prev => ({
        ...prev,
        [parametroId]: (prev[parametroId] || []).filter(img => img.path !== path)
      }));
      toast.success("Imagen eliminada");
    } catch (e) {
      toast.error("Error eliminando imagen: " + (e?.message || e));
    }
  };

  const cargarImagenesParametro = async (parametroId) => {
    const { data } = await supabase
      .from("evidencias")
      .select("archivo_url")
      .eq("supervision_id", supervisionId)
      .like("descripcion", `%${parametroId}%`);
    if (!data || data.length === 0) return;
    const imgs = [];
    for (const ev of data) {
      const { data: sdata } = await supabase.storage.from("evidencias").createSignedUrl(ev.archivo_url, 60 * 60);
      imgs.push({ path: ev.archivo_url, signedUrl: sdata?.signedUrl || null });
    }
    setImagenesPorParametro(prev => ({ ...prev, [parametroId]: imgs }));
  };

  // ========== Evidencias ==========
  const refreshEvidencias = async () => {
    const { data, error } = await supabase
      .from("evidencias")
      .select("id,archivo_url,tipo,created_at,descripcion")
      .eq("supervision_id", supervisionId)
      .order("created_at", { ascending: false });
    if (error) return;
    const rows = data || [];
    const withSigned = [];
    for (const ev of rows) {
      let signedUrl = null;
      try {
        const { data: sdata, error: serr } = await supabase.storage
          .from("evidencias").createSignedUrl(ev.archivo_url, 60 * 60);
        if (!serr) signedUrl = sdata?.signedUrl || null;
      } catch { /* ignore */ }
      withSigned.push({ ...ev, signedUrl });
    }
    setEvidencias(withSigned);
  };

  // ========== CARGA INICIAL ==========
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const { data: s } = await supabase.auth.getSession();
      const currentUser = s?.session?.user || null;
      setSessionUser(currentUser);
      if (!currentUser) { navigate("/login"); return; }

      // 1) Traer supervisión
      const { data: sup, error: supErr } = await supabase
        .from("supervisiones")
        .select("id,auditor_id,ris_id,establecimiento_id,correlativo,fecha,hora_inicio,hora_fin,medico_jefe,digitador,digitador_id,observaciones,recomendaciones,firma_url,firma_digitador_url,firma_medico_jefe_url,sector_trabajo,cel_correo_locador,otras_actividades")
        .eq("id", supervisionId)
        .single();

      if (supErr) {
        toast.error("Error cargando supervisión: " + supErr.message);
        setLoading(false);
        return;
      }

      // 2) Auto hora inicio
      let horaInicioISO = sup.hora_inicio;
      let fechaISO = sup.fecha;
      if (!horaInicioISO) {
        const n = nowAsText();
        horaInicioISO = n.iso;
        fechaISO = n.iso;
        await supabase.from("supervisiones").update({ hora_inicio: horaInicioISO, fecha: fechaISO }).eq("id", supervisionId);
      }

      setFechaTxt(formatFechaISO(fechaISO || new Date().toISOString()));
      setHoraInicioTxt(new Date(horaInicioISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (sup.hora_fin) {
        setHoraFinTxt(new Date(sup.hora_fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        setHoraFinTxt("");
      }

      setCorrelativo(sup.correlativo ?? null);
      setMedicoJefeNombre(sup.medico_jefe || "");
      setDigitadorNombre(sup.digitador || "");
      setDigitadorId(sup.digitador_id || null);
      setObservaciones(sup.observaciones || "");
      setRecomendaciones(sup.recomendaciones || "");
      setSectorTrabajo(sup.sector_trabajo || "");
      setCelCorreoLocador(sup.cel_correo_locador || "");
      setOtrasActividades(sup.otras_actividades || { A: "", B: "", C: "", D: "", E: "", F: "" });

      setFirmaSupervisorPath(sup.firma_url || null);
      setFirmaDigitadorPath(sup.firma_digitador_url || null);
      setFirmaMedicoJefePath(sup.firma_medico_jefe_url || null);

      // Correlativo
      if (sup.correlativo == null) {
        const { count } = await supabase
          .from("supervisiones")
          .select("id", { count: "exact", head: true })
          .eq("auditor_id", currentUser.id)
          .eq("tipo", "informatico");
        const next = (count || 0) + 1;
        setCorrelativo(next);
        await supabase.from("supervisiones").update({ correlativo: next }).eq("id", supervisionId);
      }

      // RIS / EESS
      const { data: ris } = await supabase.from("ris").select("nombre").eq("id", sup.ris_id).single();
      setRisNombre(ris?.nombre || "");
      const { data: est } = await supabase.from("establecimientos").select("nombre").eq("id", sup.establecimiento_id).single();
      setEstablecimientoNombre(est?.nombre || "");

      // Digitadores del establecimiento
      const { data: digData } = await supabase
        .from("digitadores").select("id, apellidos_nombres")
        .eq("establecimiento_id", sup.establecimiento_id).eq("activo", true)
        .order("apellidos_nombres");
      setDigitadoresDisponibles(digData || []);
      if (sup.digitador_id && digData) {
        const dig = digData.find((d) => d.id === sup.digitador_id);
        if (dig) setDigitadorNombre(dig.apellidos_nombres);
      }

      // Parámetros (solo informatico)
      const { data: params, error: pErr } = await supabase
        .from("parametros")
        .select("id,seccion,codigo,descripcion,requiere_observacion,orden,activo,tipo_campo_condicional,condicion_campo,etiqueta_campo_condicional,depende_de_codigo,depende_valor,has_tabla_extra,parametro_padre_id,es_grupo,opciones_si,opciones_no,campos_si,campos_no")
        .eq("tipo_supervision", "informatico")
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true });
      if (pErr) toast.error("Error cargando parámetros: " + pErr.message);
      setParametros(params || []);

      // Respuestas
      const { data: resp } = await supabase
        .from("respuestas")
        .select("parametro_id,valor_bool,observacion,valor_fecha,valor_cantidad,valor_cantidad_2,valor_cantidad_3,valor_texto")
        .eq("supervision_id", supervisionId);

      const map = {};
      (params || []).forEach((p) => {
        map[p.id] = {
          valor_bool: null, observacion: "", valor_fecha: null,
          valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "",
        };
      });
      (resp || []).forEach((r) => {
        map[r.parametro_id] = {
          valor_bool: r.valor_bool ?? null, observacion: r.observacion ?? "",
          valor_fecha: r.valor_fecha ?? null, valor_cantidad: r.valor_cantidad ?? null,
          valor_cantidad_2: r.valor_cantidad_2 ?? null, valor_cantidad_3: r.valor_cantidad_3 ?? null,
          valor_texto: r.valor_texto ?? "",
        };
      });
      setRespuestas(map);

      // Tabla extra: Archivamiento
      const { data: archData } = await supabase
        .from("archivamiento_supervisado").select("*")
        .eq("supervision_id", supervisionId).order("fila_numero", { ascending: true });
      if (archData && archData.length > 0) {
        const rows = Array.from({ length: 10 }, (_, i) => {
          const existing = archData.find((x) => x.fila_numero === i + 1);
          return existing
            ? { anio: existing.anio || "", mes_inicio: existing.mes_inicio || "", mes_fin: existing.mes_fin || "", nro_caja: existing.nro_caja || "", nro_tomo: existing.nro_tomo || "", cantidad_foleo: existing.cantidad_foleo ?? "", cantidad_fuas: existing.cantidad_fuas ?? "", observacion: existing.observacion || "" }
            : { ...EMPTY_ARCHIVAMIENTO };
        });
        setArchivamientoRows(rows);
      }

      // Tabla extra: Control de Calidad
      const { data: ccData } = await supabase
        .from("control_calidad_fua").select("*")
        .eq("supervision_id", supervisionId).order("fila_numero", { ascending: true });
      if (ccData && ccData.length > 0) {
        const rows = Array.from({ length: 40 }, (_, i) => {
          const existing = ccData.find((x) => x.fila_numero === i + 1);
          return existing
            ? { fua: existing.fua || "", fecha_atencion: existing.fecha_atencion || "", cod_prestacional: existing.cod_prestacional || "", nombre_profesional: existing.nombre_profesional || "", observacion: existing.observacion || "" }
            : { ...EMPTY_CONTROL_CALIDAD };
        });
        setControlCalidadRows(rows);
      }

      // Tabla sepelios
      const { data: sepData } = await supabase
        .from("sepelios_supervisados").select("*")
        .eq("supervision_id", supervisionId).order("fila_numero", { ascending: true });
      if (sepData && sepData.length > 0) {
        const rows = Array.from({ length: 10 }, (_, i) => {
          const existing = sepData.find((x) => x.fila_numero === i + 1);
          return existing
            ? { dni: existing.dni || "", nombre_afiliado: existing.nombre_afiliado || "", fecha_registro: existing.fecha_registro || "", estado: existing.estado || "", observacion: existing.observacion || "" }
            : { ...EMPTY_SEPELIO };
        });
        setSepelioRows(rows);
      }

      // Indicadores prestacionales
      const { data: ipData } = await supabase
        .from("indicadores_prestacionales").select("*")
        .eq("supervision_id", supervisionId);
      if (ipData && ipData.length > 0) {
        const diabetesData = {};
        ipData.forEach(ip => {
          if (ip.indicador_codigo === 'IP.1' && ip.sub_indicador) {
            diabetesData[ip.sub_indicador] = ip.valor_cantidad ?? "";
          }
        });
        if (Object.keys(diabetesData).length > 0) {
          setIndicadoresDiabetes(prev => ({ ...prev, ...diabetesData }));
        }
      }

      // Evidencias + firmas
      await refreshEvidencias();
      await refreshFirmasSignedUrls(sup.firma_url, sup.firma_digitador_url, sup.firma_medico_jefe_url);

      // Cargar imágenes asociadas a parámetros (solo B.3)
      const paramsConImagen = (params || []).filter(p => p.codigo === "B.3");
      for (const p of paramsConImagen) {
        await cargarImagenesParametro(p.id);
      }

      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisionId]);

  // ========== SUBIR FIRMA ==========
  const subirFirma = async (tipo) => {
    const ref = tipo === "supervisor" ? sigSupervisorRef : tipo === "digitador" ? sigDigitadorRef : sigMedicoJefeRef;
    if (!ref.current || ref.current.isEmpty()) { toast.error("Firma vacía. Firma primero."); return; }
    try {
      setSaving(true);
      const dataURL = ref.current.getTrimmedCanvas().toDataURL("image/png");
      const blob = await dataURLToBlob(dataURL);
      const fileName = `${tipo}_${Date.now()}.png`;
      const path = `${supervisionId}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("firmas").upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const updatePayload = tipo === "supervisor" ? { firma_url: path } : tipo === "digitador" ? { firma_digitador_url: path } : { firma_medico_jefe_url: path };
      const { error: dbErr } = await supabase.from("supervisiones").update(updatePayload).eq("id", supervisionId);
      if (dbErr) throw dbErr;
      if (tipo === "supervisor") setFirmaSupervisorPath(path);
      if (tipo === "digitador") setFirmaDigitadorPath(path);
      if (tipo === "medico_jefe") setFirmaMedicoJefePath(path);
      await refreshFirmasSignedUrls(
        tipo === "supervisor" ? path : firmaSupervisorPath,
        tipo === "digitador" ? path : firmaDigitadorPath,
        tipo === "medico_jefe" ? path : firmaMedicoJefePath
      );
      toast.success("Firma guardada correctamente");
    } catch (e) {
      toast.error("Error guardando firma: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  // ========== SUBIR EVIDENCIAS ==========
  const onUploadEvidencias = async (files) => {
    if (!files || files.length === 0) return;
    setSubiendoEvidencias(true);
    try {
      for (const file of files) {
        const cleanName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const path = `${supervisionId}/${Date.now()}_${cleanName}`;
        const { error: upErr } = await supabase.storage.from("evidencias").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const tipo = file.type || "application/octet-stream";
        const { error: insErr } = await supabase.from("evidencias").insert([{ supervision_id: supervisionId, archivo_url: path, tipo, descripcion: null }]);
        if (insErr) throw insErr;
      }
      await refreshEvidencias();
      toast.success("Evidencias subidas correctamente");
    } catch (e) {
      toast.error("Error subiendo evidencias: " + (e?.message || e));
    } finally { setSubiendoEvidencias(false); }
  };

  // ========== AUDITORÍA ==========
  const registrarAuditoria = async (action, description, cambios) => {
    try {
      if (!user?.id) return;
      await supabase.from("audit_logs").insert({
        supervision_id: supervisionId, user_id: user.id, action,
        description: description || `${action === "update" ? "Actualización" : "Creación"} de acta de supervisión informática`,
        field_name: cambios?.field || null,
        old_value: cambios?.oldValue ? JSON.stringify(cambios.oldValue) : null,
        new_value: cambios?.newValue ? JSON.stringify(cambios.newValue) : null,
      });
    } catch (e) {
      console.error("Error auditoría:", e.message);
    }
  };

  // ========== GUARDAR TODO ==========
  const guardarTodoFinalizar = async () => {
    try {
      setSaving(true);
      const fin = nowAsText();
      setHoraFinTxt(fin.hora);

      // Subir firmas pendientes
      for (const tipo of ["supervisor", "digitador", "medico_jefe"]) {
        const ref = tipo === "supervisor" ? sigSupervisorRef : tipo === "digitador" ? sigDigitadorRef : sigMedicoJefeRef;
        const existingUrl = tipo === "supervisor" ? firmaSupervisorUrl : tipo === "digitador" ? firmaDigitadorUrl : firmaMedicoJefeUrl;
        if (ref.current && !ref.current.isEmpty() && !existingUrl) {
          await subirFirma(tipo);
        }
      }

      // Cabecera
      const { error: supErr } = await supabase
        .from("supervisiones")
        .update({
          medico_jefe: medicoJefeNombre || null,
          digitador: digitadorNombre || null,
          digitador_id: digitadorId || null,
          observaciones: observaciones || null,
          recomendaciones: recomendaciones || null,
          hora_fin: fin.iso,
          estado: "completado",
          sector_trabajo: sectorTrabajo || null,
          cel_correo_locador: celCorreoLocador || null,
          otras_actividades: otrasActividades,
        })
        .eq("id", supervisionId);
      if (supErr) throw supErr;

      // Respuestas
      const rows = Object.entries(respuestas).map(([parametro_id, r]) => ({
        supervision_id: supervisionId, parametro_id,
        valor_bool: r.valor_bool ?? null, observacion: r.observacion ?? null,
        valor_fecha: r.valor_fecha ?? null, valor_cantidad: r.valor_cantidad ?? null,
        valor_cantidad_2: r.valor_cantidad_2 ?? null, valor_cantidad_3: r.valor_cantidad_3 ?? null,
        valor_texto: r.valor_texto ?? null,
      }));
      if (rows.length > 0) {
        const { error: rErr } = await supabase.from("respuestas").upsert(rows, { onConflict: "supervision_id,parametro_id" });
        if (rErr) throw rErr;
      }

      // Guardar archivamiento_supervisado
      await supabase.from("archivamiento_supervisado").delete().eq("supervision_id", supervisionId);
      const archRows = archivamientoRows
        .map((a, i) => ({ ...a, fila_numero: i + 1 }))
        .filter((a) => a.anio || a.nro_caja || a.nro_tomo || a.cantidad_fuas);
      if (archRows.length > 0) {
        const { error: archErr } = await supabase.from("archivamiento_supervisado").insert(
          archRows.map((a) => ({
            supervision_id: supervisionId, fila_numero: a.fila_numero,
            anio: a.anio ? parseInt(a.anio, 10) : null,
            mes_inicio: a.mes_inicio || null, mes_fin: a.mes_fin || null,
            nro_caja: a.nro_caja || null, nro_tomo: a.nro_tomo || null,
            cantidad_foleo: a.cantidad_foleo ? parseInt(a.cantidad_foleo, 10) : null,
            cantidad_fuas: a.cantidad_fuas ? parseInt(a.cantidad_fuas, 10) : null,
            observacion: a.observacion || null,
          }))
        );
        if (archErr) throw archErr;
      }

      // Guardar control_calidad_fua
      await supabase.from("control_calidad_fua").delete().eq("supervision_id", supervisionId);
      const ccRows = controlCalidadRows
        .map((c, i) => ({ ...c, fila_numero: i + 1 }))
        .filter((c) => c.fua || c.nombre_profesional || c.cod_prestacional);
      if (ccRows.length > 0) {
        const { error: ccErr } = await supabase.from("control_calidad_fua").insert(
          ccRows.map((c) => ({
            supervision_id: supervisionId, fila_numero: c.fila_numero,
            fua: c.fua || null, fecha_atencion: c.fecha_atencion || null,
            cod_prestacional: c.cod_prestacional || null,
            nombre_profesional: c.nombre_profesional || null,
            observacion: c.observacion || null,
          }))
        );
        if (ccErr) throw ccErr;
      }

      // Guardar sepelios_supervisados
      await supabase.from("sepelios_supervisados").delete().eq("supervision_id", supervisionId);
      const sepRows = sepelioRows
        .map((s, i) => ({ ...s, fila_numero: i + 1 }))
        .filter((s) => s.dni || s.nombre_afiliado);
      if (sepRows.length > 0) {
        const { error: sepErr } = await supabase.from("sepelios_supervisados").insert(
          sepRows.map((s) => ({
            supervision_id: supervisionId, fila_numero: s.fila_numero,
            dni: s.dni || null, nombre_afiliado: s.nombre_afiliado || null,
            fecha_registro: s.fecha_registro || null, estado: s.estado || null,
            observacion: s.observacion || null,
          }))
        );
        if (sepErr) throw sepErr;
      }

      // Guardar indicadores_prestacionales
      await supabase.from("indicadores_prestacionales").delete().eq("supervision_id", supervisionId);
      const ipRows = [];
      // IP.1 - Diabetes (sub-indicadores)
      if (indicadoresDiabetes.hba1c || indicadoresDiabetes.microalbuminuria || indicadoresDiabetes.creatinina) {
        ['hba1c', 'microalbuminuria', 'creatinina'].forEach(sub => {
          if (indicadoresDiabetes[sub]) {
            ipRows.push({
              supervision_id: supervisionId, indicador_codigo: 'IP.1',
              sub_indicador: sub, valor_cantidad: parseInt(indicadoresDiabetes[sub], 10) || null,
            });
          }
        });
      }
      if (ipRows.length > 0) {
        const { error: ipErr } = await supabase.from("indicadores_prestacionales").insert(ipRows);
        if (ipErr) throw ipErr;
      }

      // Auditoría
      await registrarAuditoria("update", "Acta de supervisión informática finalizada y guardada", {
        field: "estado", oldValue: "borrador", newValue: "completado",
      });

      toast.success("Guardado correctamente. Hora fin registrada.");
    } catch (e) {
      toast.error("Error al guardar: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  const limpiarFormulario = () => {
    if (!window.confirm("¿Está seguro de limpiar todo el formulario?")) return;
    setMedicoJefeNombre("");
    setDigitadorNombre("");
    setDigitadorId(null);
    setObservaciones("");
    setRecomendaciones("");
    setSectorTrabajo("");
    setCelCorreoLocador("");
    setOtrasActividades({ A: "", B: "", C: "", D: "", E: "", F: "" });
    const respVacias = {};
    Object.keys(respuestas).forEach((paramId) => {
      respVacias[paramId] = { valor_bool: null, observacion: "", valor_fecha: null, valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "" };
    });
    setRespuestas(respVacias);
    setArchivamientoRows(Array.from({ length: 10 }, () => ({ ...EMPTY_ARCHIVAMIENTO })));
    setControlCalidadRows(Array.from({ length: 40 }, () => ({ ...EMPTY_CONTROL_CALIDAD })));
    setSepelioRows(Array.from({ length: 10 }, () => ({ ...EMPTY_SEPELIO })));
    setIndicadoresDiabetes({ hba1c: "", microalbuminuria: "", creatinina: "" });
    sigSupervisorRef.current?.clear();
    sigDigitadorRef.current?.clear();
    sigMedicoJefeRef.current?.clear();
    toast.success("Formulario limpiado");
  };

  const imprimir = () => window.print();

  // ========== HELPERS TABLAS ==========
  const updateArchivamiento = (index, field, value) => {
    setArchivamientoRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateControlCalidad = (index, field, value) => {
    setControlCalidadRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateSepelio = (index, field, value) => {
    setSepelioRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // ========== RENDER: Tabla Sepelios (C.5) ==========
  const renderTablaSepelios = (parametroC5) => {
    // Cantidad de filas = valor_cantidad del parámetro C.5
    const r = respuestas[parametroC5?.id] || {};
    const cantidadFilas = Math.max(r.valor_cantidad || 0, 1);

    // Ajustar sepelioRows si cambió la cantidad
    if (sepelioRows.length !== cantidadFilas) {
      const nuevas = Array.from({ length: cantidadFilas }, (_, i) =>
        sepelioRows[i] ? { ...sepelioRows[i] } : { ...EMPTY_SEPELIO }
      );
      // No usar setSepelioRows aquí directamente para evitar loop,
      // se ajustará mediante useEffect o al renderizar
    }

    const filasAMostrar = cantidadFilas;

    return (
      <div className="mt-3 mb-3">
        <label className="form-label fw-semibold text-primary">Registro de Sepelios ({filasAMostrar} filas)</label>
        <div className="table-responsive">
          <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: 40 }}>N°</th>
                <th style={{ width: 120 }}>DNI</th>
                <th>Nombre del Afiliado</th>
                <th style={{ width: 130 }}>Fecha de Registro</th>
                <th style={{ width: 120 }}>Estado</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: filasAMostrar }, (_, i) => {
                const row = sepelioRows[i] || { ...EMPTY_SEPELIO };
                return (
                  <tr key={i}>
                    <td className="text-center align-middle">{i + 1}</td>
                    <td><input type="text" className="form-control form-control-sm" value={row.dni || ""} onChange={(e) => {
                      // Expandir sepelioRows si es necesario
                      if (i >= sepelioRows.length) {
                        const expanded = [...sepelioRows];
                        while (expanded.length <= i) expanded.push({ ...EMPTY_SEPELIO });
                        expanded[i] = { ...expanded[i], dni: e.target.value };
                        setSepelioRows(expanded);
                      } else {
                        updateSepelio(i, "dni", e.target.value);
                      }
                    }} placeholder="DNI" maxLength={8} /></td>
                    <td><input type="text" className="form-control form-control-sm" value={row.nombre_afiliado || ""} onChange={(e) => {
                      if (i >= sepelioRows.length) {
                        const expanded = [...sepelioRows];
                        while (expanded.length <= i) expanded.push({ ...EMPTY_SEPELIO });
                        expanded[i] = { ...expanded[i], nombre_afiliado: e.target.value };
                        setSepelioRows(expanded);
                      } else {
                        updateSepelio(i, "nombre_afiliado", e.target.value);
                      }
                    }} placeholder="Nombre" /></td>
                    <td><input type="date" className="form-control form-control-sm" value={row.fecha_registro || ""} onChange={(e) => {
                      if (i >= sepelioRows.length) {
                        const expanded = [...sepelioRows];
                        while (expanded.length <= i) expanded.push({ ...EMPTY_SEPELIO });
                        expanded[i] = { ...expanded[i], fecha_registro: e.target.value };
                        setSepelioRows(expanded);
                      } else {
                        updateSepelio(i, "fecha_registro", e.target.value);
                      }
                    }} /></td>
                    <td><input type="text" className="form-control form-control-sm" value={row.estado || ""} onChange={(e) => {
                      if (i >= sepelioRows.length) {
                        const expanded = [...sepelioRows];
                        while (expanded.length <= i) expanded.push({ ...EMPTY_SEPELIO });
                        expanded[i] = { ...expanded[i], estado: e.target.value };
                        setSepelioRows(expanded);
                      } else {
                        updateSepelio(i, "estado", e.target.value);
                      }
                    }} placeholder="Estado" /></td>
                    <td><input type="text" className="form-control form-control-sm" value={row.observacion || ""} onChange={(e) => {
                      if (i >= sepelioRows.length) {
                        const expanded = [...sepelioRows];
                        while (expanded.length <= i) expanded.push({ ...EMPTY_SEPELIO });
                        expanded[i] = { ...expanded[i], observacion: e.target.value };
                        setSepelioRows(expanded);
                      } else {
                        updateSepelio(i, "observacion", e.target.value);
                      }
                    }} placeholder="Obs." /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ========== RENDER: Tabla Indicadores Diabetes (IP.1) ==========
  const renderTablaIndicadoresDiabetes = () => (
    <div className="mt-3 mb-3">
      <div className="table-responsive">
        <table className="table table-bordered table-sm" style={{ fontSize: "0.85rem" }}>
          <thead className="table-light">
            <tr>
              <th>Indicador</th>
              <th style={{ width: 200 }}>Cantidad a la fecha de supervisión</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HBA1c (Hemoglobina Glicosilada)</td>
              <td><input type="number" className="form-control form-control-sm" min={0} value={indicadoresDiabetes.hba1c} onChange={(e) => setIndicadoresDiabetes(prev => ({ ...prev, hba1c: e.target.value }))} /></td>
            </tr>
            <tr>
              <td>Microalbuminuria sérica</td>
              <td><input type="number" className="form-control form-control-sm" min={0} value={indicadoresDiabetes.microalbuminuria} onChange={(e) => setIndicadoresDiabetes(prev => ({ ...prev, microalbuminuria: e.target.value }))} /></td>
            </tr>
            <tr>
              <td>Creatinina</td>
              <td><input type="number" className="form-control form-control-sm" min={0} value={indicadoresDiabetes.creatinina} onChange={(e) => setIndicadoresDiabetes(prev => ({ ...prev, creatinina: e.target.value }))} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== RENDER: Tabla Archivamiento ==========
  const renderTablaArchivamiento = () => (
    <div className="mt-3 mb-3">
      <label className="form-label fw-semibold text-primary">Archivamiento Supervisado (10 filas)</label>
      <div className="table-responsive">
        <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>N°</th>
              <th style={{ width: 80 }}>Año</th>
              <th>Mes Inicio</th>
              <th>Mes Fin</th>
              <th>N° Caja</th>
              <th>N° Tomo</th>
              <th>Cant. Foleo</th>
              <th>Cant. FUAs</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {archivamientoRows.map((row, i) => (
              <tr key={i}>
                <td className="text-center align-middle">{i + 1}</td>
                <td>
                  <input type="number" className="form-control form-control-sm" value={row.anio} onChange={(e) => updateArchivamiento(i, "anio", e.target.value)} placeholder="Año" />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.mes_inicio} onChange={(e) => updateArchivamiento(i, "mes_inicio", e.target.value)} placeholder="Mes" />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.mes_fin} onChange={(e) => updateArchivamiento(i, "mes_fin", e.target.value)} placeholder="Mes" />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.nro_caja} onChange={(e) => updateArchivamiento(i, "nro_caja", e.target.value)} />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.nro_tomo} onChange={(e) => updateArchivamiento(i, "nro_tomo", e.target.value)} />
                </td>
                <td>
                  <input type="number" className="form-control form-control-sm" value={row.cantidad_foleo} onChange={(e) => updateArchivamiento(i, "cantidad_foleo", e.target.value)} min={0} />
                </td>
                <td>
                  <input type="number" className="form-control form-control-sm" value={row.cantidad_fuas} onChange={(e) => updateArchivamiento(i, "cantidad_fuas", e.target.value)} min={0} />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.observacion} onChange={(e) => updateArchivamiento(i, "observacion", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== RENDER: Tabla Control Calidad ==========
  const renderTablaControlCalidad = () => (
    <div className="mt-3 mb-3">
      <label className="form-label fw-semibold text-primary">Ficha de Control de Calidad del Registro de Digitación de las FUAs (40 filas)</label>
      <div className="table-responsive">
        <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>N°</th>
              <th>FUA</th>
              <th style={{ width: 130 }}>Fecha Atención</th>
              <th style={{ width: 100 }}>Cód. Prest.</th>
              <th>Nombre del Profesional</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {controlCalidadRows.map((row, i) => (
              <tr key={i}>
                <td className="text-center align-middle">{i + 1}</td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.fua} onChange={(e) => updateControlCalidad(i, "fua", e.target.value)} placeholder="N° FUA" />
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={row.fecha_atencion} onChange={(e) => updateControlCalidad(i, "fecha_atencion", e.target.value)} />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.cod_prestacional} onChange={(e) => updateControlCalidad(i, "cod_prestacional", e.target.value)} placeholder="Código" />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.nombre_profesional} onChange={(e) => updateControlCalidad(i, "nombre_profesional", e.target.value)} placeholder="Nombre" />
                </td>
                <td>
                  <input type="text" className="form-control form-control-sm" value={row.observacion} onChange={(e) => updateControlCalidad(i, "observacion", e.target.value)} placeholder="Obs." />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== RENDER: Sub-parámetros (grupo B.1, B.4) ==========
  const renderGrupoSubParametros = (padre) => {
    const hijos = (parametros || []).filter(p => p.parametro_padre_id === padre.id && p.activo !== false)
      .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

    if (hijos.length === 0) return null;

    // B.4 invierte: No/Si (No es default izquierdo)
    const esB4 = padre.codigo === 'B.4';

    return (
      <div className="mt-2">
        <div className="table-responsive">
          <table className="table table-bordered table-sm" style={{ fontSize: "0.85rem" }}>
            <thead className="table-light">
              <tr>
                <th>Sistema</th>
                <th style={{ width: 60 }}>{esB4 ? "No" : "Sí"}</th>
                <th style={{ width: 60 }}>{esB4 ? "Sí" : "No"}</th>
                <th>{esB4 ? "Acción Realizada" : "Detalle"}</th>
              </tr>
            </thead>
            <tbody>
              {hijos.map(hijo => {
                const r = respuestas[hijo.id] || { valor_bool: null, observacion: "", valor_texto: "" };
                // B.4: Sí = tiene inconveniente → mostrar opciones_si (acción realizada)
                //       No = sin inconveniente → mostrar opciones_no si existen
                // B.1: Sí = tiene acceso → no dropdown. No = sin acceso → opciones_no
                let opcionesDropdown = [];
                let mostrarDropdown = false;
                if (esB4) {
                  if (r.valor_bool === true && safeJsonParse(hijo.opciones_si).length > 0) {
                    opcionesDropdown = safeJsonParse(hijo.opciones_si);
                    mostrarDropdown = true;
                  } else if (r.valor_bool === false && safeJsonParse(hijo.opciones_no).length > 0) {
                    opcionesDropdown = safeJsonParse(hijo.opciones_no);
                    mostrarDropdown = true;
                  }
                } else {
                  if (r.valor_bool === false && safeJsonParse(hijo.opciones_no).length > 0) {
                    opcionesDropdown = safeJsonParse(hijo.opciones_no);
                    mostrarDropdown = true;
                  }
                }

                return (
                  <tr key={hijo.id}>
                    <td className="align-middle fw-semibold">{hijo.descripcion}</td>
                    <td className="text-center align-middle">
                      <input type="radio" name={`si_no_${hijo.id}`}
                        checked={esB4 ? r.valor_bool === false : r.valor_bool === true}
                        onChange={() => setResp(hijo.id, { valor_bool: esB4 ? false : true })} />
                    </td>
                    <td className="text-center align-middle">
                      <input type="radio" name={`si_no_${hijo.id}`}
                        checked={esB4 ? r.valor_bool === true : r.valor_bool === false}
                        onChange={() => setResp(hijo.id, { valor_bool: esB4 ? true : false })} />
                    </td>
                    <td>
                      {mostrarDropdown && opcionesDropdown.length > 0 && (
                        <select className="form-select form-select-sm" value={r.valor_texto || ""} onChange={(e) => setResp(hijo.id, { valor_texto: e.target.value })}>
                          <option value="">Seleccione motivo...</option>
                          {opcionesDropdown.map((op, i) => (
                            <option key={i} value={op}>{op}</option>
                          ))}
                        </select>
                      )}
                      {mostrarDropdown && opcionesDropdown.length === 0 && (
                        <input type="text" className="form-control form-control-sm" value={r.observacion || ""} onChange={(e) => setResp(hijo.id, { observacion: e.target.value })} placeholder="Detalle..." />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper para parsear JSON seguro
  const safeJsonParse = (str) => {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
  };

  // ========== RENDER: Parámetro individual ==========
  const renderParametroSiNo = (p) => {
    // No renderizar hijos directamente (se renderizan dentro del grupo padre)
    if (p.parametro_padre_id) return null;

    const r = respuestas[p.id] || { valor_bool: null, observacion: "", valor_fecha: null, valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "" };

    const mostrarCampoCondicional = () => {
      if (!p.tipo_campo_condicional) return false;
      if (p.condicion_campo === "siempre") return true;
      if (p.condicion_campo === "si" && r.valor_bool === true) return true;
      if (p.condicion_campo === "no" && r.valor_bool === false) return true;
      return false;
    };

    const showConditional = mostrarCampoCondicional();
    const showTablaArch = p.has_tabla_extra === "tabla_archivamiento";
    const showTablaCC = p.has_tabla_extra === "tabla_control_calidad";
    const showTablaSep = p.has_tabla_extra === "tabla_sepelios";
    const showTablaIPDiabetes = p.has_tabla_extra === "tabla_indicadores_diabetes";

    // Para secciones C, D, G que son solo CANTIDAD, ocultar radios Si/No
    const esSoloCantidad = p.tipo_campo_condicional === "cantidad" && p.condicion_campo === "siempre" && !p.has_tabla_extra;
    // Para tablas y grupos, ocultar radios
    const ocultarRadiosSiNo = showTablaArch || showTablaCC || showTablaSep || showTablaIPDiabetes || esSoloCantidad || p.es_grupo;

    // Opciones dropdown condicionales
    const opcionesSi = safeJsonParse(p.opciones_si);
    const opcionesNo = safeJsonParse(p.opciones_no);
    const camposSi = safeJsonParse(p.campos_si);
    const camposNo = safeJsonParse(p.campos_no);

    return (
      <div className="mb-3" key={p.id}>
        <div className="fw-semibold">
          {p.codigo ? `${p.codigo}. ` : ""}
          {p.descripcion}
        </div>

        <>
          {/* Radios Si/No */}
          {!ocultarRadiosSiNo && (
            <div className="d-flex gap-4 mt-2">
              <label className="form-check">
                <input className="form-check-input" type="radio" name={`si_no_${p.id}`} checked={r.valor_bool === true} onChange={() => setResp(p.id, { valor_bool: true })} />
                <span className="form-check-label">Sí</span>
              </label>
              <label className="form-check">
                <input className="form-check-input" type="radio" name={`si_no_${p.id}`} checked={r.valor_bool === false} onChange={() => setResp(p.id, { valor_bool: false })} />
                <span className="form-check-label">No</span>
              </label>
            </div>
          )}

          {/* Grupo de sub-parámetros (B.1, B.4) */}
          {p.es_grupo && renderGrupoSubParametros(p)}

          {/* Campo condicional: Cantidad (solo si NO tiene campos_si que ya lo manejan) */}
          {showConditional && p.tipo_campo_condicional === "cantidad" && camposSi.length === 0 && (
            <div className="mt-2">
              <label className="form-label text-primary fw-semibold">
                {p.etiqueta_campo_condicional || "Cantidad"}
              </label>
              <input
                type="number"
                className="form-control"
                style={{ maxWidth: 200 }}
                min={0}
                value={r.valor_cantidad ?? ""}
                onChange={(e) => setResp(p.id, { valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
              />
            </div>
          )}

          {/* Campos extra para Sí (E.1 numeración, B.3 versiones, etc.) */}
          {r.valor_bool === true && camposSi.length > 0 && (
            <div className="mt-2 ps-3 border-start border-primary border-2">
              {camposSi.includes("cantidad_fuas_entregados") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Cantidad de FUAs entregados</label>
                  <input type="number" className="form-control" style={{ maxWidth: 200 }} min={0} value={r.valor_cantidad ?? ""} onChange={(e) => setResp(p.id, { valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                </div>
              )}
              {camposSi.includes("numeracion_inicial") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Numeración Inicial</label>
                  <input type="text" className="form-control" style={{ maxWidth: 300 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })} placeholder="xxxxxxx-xx-xxxxxxxx" />
                </div>
              )}
              {camposSi.includes("numeracion_final") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Numeración Final</label>
                  <input type="text" className="form-control" style={{ maxWidth: 300 }} value={r.valor_texto_2 || ""} onChange={(e) => setResp(p.id, { valor_texto_2: e.target.value })} placeholder="xxxxxxx-xx-xxxxxxxx" />
                </div>
              )}
              {camposSi.includes("cantidad_fuas_devueltos") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Cantidad de FUAs devueltos</label>
                  <input type="number" className="form-control" style={{ maxWidth: 200 }} min={0} value={r.valor_cantidad ?? ""} onChange={(e) => setResp(p.id, { valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                </div>
              )}
              {camposSi.includes("cantidad_fuas_anuladas") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Cantidad de FUAs Anuladas</label>
                  <input type="number" className="form-control" style={{ maxWidth: 200 }} min={0} value={r.valor_cantidad_2 ?? ""} onChange={(e) => setResp(p.id, { valor_cantidad_2: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                </div>
              )}
              {camposSi.includes("fecha_ultimo_tomo") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Fecha del último Tomo</label>
                  <input type="date" className="form-control" style={{ maxWidth: 250 }} value={r.valor_fecha || ""} onChange={(e) => setResp(p.id, { valor_fecha: e.target.value || null })} />
                </div>
              )}
              {camposSi.includes("hora_registro") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Hora de ingreso del día de la Supervisión</label>
                  <input type="time" className="form-control" style={{ maxWidth: 200 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })} />
                </div>
              )}
              {camposSi.includes("velocidad_mbps") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Velocidad (Mbps)</label>
                  <input type="number" className="form-control" style={{ maxWidth: 200 }} min={0} value={r.valor_cantidad ?? ""} onChange={(e) => setResp(p.id, { valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                </div>
              )}
              {camposSi.includes("estado_internet") && opcionesSi.length > 0 && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Estado</label>
                  <select className="form-select" style={{ maxWidth: 250 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })}>
                    <option value="">Seleccione...</option>
                    {opcionesSi.map((op, i) => <option key={i} value={op}>{op}</option>)}
                  </select>
                </div>
              )}
              {camposSi.includes("fecha_hora_ultima_carga") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Fecha y hora de última carga</label>
                  <input type="datetime-local" className="form-control" style={{ maxWidth: 300 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })} />
                </div>
              )}
              {camposSi.includes("version_arfsis") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Versión del ARFSIS Web</label>
                  <input type="text" className="form-control" style={{ maxWidth: 300 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })} placeholder="Ej: 3.2.1" />
                </div>
              )}
              {camposSi.includes("fecha_act_maestros") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Fecha última actualización de maestros</label>
                  <input type="date" className="form-control" style={{ maxWidth: 250 }} value={r.valor_fecha || ""} onChange={(e) => setResp(p.id, { valor_fecha: e.target.value || null })} />
                </div>
              )}
              {camposSi.includes("fecha_act_afiliados") && (
                <div className="mb-2">
                  <label className="form-label text-primary fw-semibold">Fecha última actualización de afiliados</label>
                  <input type="date" className="form-control" style={{ maxWidth: 250 }} value={r.valor_texto_2 || ""} onChange={(e) => setResp(p.id, { valor_texto_2: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* Dropdown para "No" con opciones configurables */}
          {r.valor_bool === false && opcionesNo.length > 0 && !p.es_grupo && (
            <div className="mt-2">
              <label className="form-label text-primary fw-semibold">Motivo</label>
              <select className="form-select" style={{ maxWidth: 400 }} value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })}>
                <option value="">Seleccione...</option>
                {opcionesNo.map((op, i) => <option key={i} value={op}>{op}</option>)}
              </select>
              {r.valor_texto === "Otro" && (
                <input type="text" className="form-control mt-2" style={{ maxWidth: 400 }} value={r.observacion || ""} onChange={(e) => setResp(p.id, { observacion: e.target.value })} placeholder="Especifique..." />
              )}
            </div>
          )}

          {/* Campo condicional: Fecha (sin campos_si, ej: fallback) */}
          {showConditional && p.tipo_campo_condicional === "fecha" && camposSi.length === 0 && (
            <div className="mt-2">
              <label className="form-label text-primary fw-semibold">
                {p.etiqueta_campo_condicional || "Fecha"}
              </label>
              <input type="date" className="form-control" style={{ maxWidth: 250 }} value={r.valor_fecha || ""} onChange={(e) => setResp(p.id, { valor_fecha: e.target.value || null })} />
            </div>
          )}

          {/* Campo condicional: Texto (sin campos_si, ej: A.7 piso) */}
          {showConditional && p.tipo_campo_condicional === "texto" && camposSi.length === 0 && !p.es_grupo && (
            <div className="mt-2">
              <label className="form-label text-primary fw-semibold">
                {p.etiqueta_campo_condicional || "Texto"}
              </label>
              <input type="text" className="form-control" value={r.valor_texto || ""} onChange={(e) => setResp(p.id, { valor_texto: e.target.value })} placeholder="Ingrese..." />
            </div>
          )}

          {/* Tabla Archivamiento */}
          {showTablaArch && renderTablaArchivamiento()}

          {/* Tabla Control Calidad */}
          {showTablaCC && renderTablaControlCalidad()}

          {/* Tabla Sepelios */}
          {showTablaSep && renderTablaSepelios(p)}

          {/* Tabla Indicadores Diabetes */}
          {showTablaIPDiabetes && renderTablaIndicadoresDiabetes()}

          {/* Observación por ítem (solo si no tiene opciones_no con dropdown) */}
          {p.requiere_observacion && !(r.valor_bool === false && opcionesNo.length > 0) && !p.es_grupo && (
            <div className="mt-2">
              <label className="form-label">Observación</label>
              <textarea className="form-control" rows={2} value={r.observacion || ""} onChange={(e) => setResp(p.id, { observacion: e.target.value })} placeholder="Detalle / sustento..." />
            </div>
          )}

          {/* Carga de imagen por parámetro (solo B.3 ahora, quitamos A.3 y B.4) */}
          {["B.3"].includes(p.codigo) && (
            <div className="mt-2">
              <label className="form-label fw-semibold text-primary">
                Adjuntar pantallazo / imagen
              </label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                disabled={subiendoImagenParametro[p.id]}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    subirImagenParametro(p.id, e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />
              {subiendoImagenParametro[p.id] && <small className="text-muted">Subiendo...</small>}
              {(imagenesPorParametro[p.id] || []).length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {imagenesPorParametro[p.id].map((img, idx) => (
                    <div key={idx} className="position-relative" style={{ width: 120 }}>
                      <img src={img.signedUrl} alt={`Evidencia ${idx + 1}`} className="img-thumbnail" style={{ width: 120, height: 90, objectFit: "cover" }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger position-absolute top-0 end-0"
                        style={{ padding: "1px 5px", fontSize: 10 }}
                        onClick={() => eliminarImagenParametro(p.id, img.path)}
                        title="Eliminar imagen"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container my-4">
        <div className="alert alert-info">Cargando supervisión informática...</div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      {/* ==================== CABECERA ==================== */}
      <div className="acta-box p-3 mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h4 className="m-0">ACTA DE SUPERVISIÓN — INFORMÁTICA</h4>
            <div className="text-muted">
              <strong>N°:</strong> {correlativo ?? "—"}{" "}
              <span className="mx-2">|</span>
              <strong>RIS:</strong> {risNombre || "—"}{" "}
              <span className="mx-2">|</span>
              <strong>EESS:</strong> {establecimientoNombre || "—"}
            </div>
          </div>
          <div className="text-end">
            <div><strong>Fecha:</strong> {fechaTxt || "—"}</div>
            <div><strong>Hora inicio:</strong> {horaInicioTxt || "—"}</div>
            <div><strong>Hora fin:</strong> {horaFinTxt || "—"}</div>
          </div>
        </div>

        <hr className="my-3" />

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold">Médico Jefe del Establecimiento</label>
            <input className="form-control" value={medicoJefeNombre} onChange={(e) => setMedicoJefeNombre(e.target.value)} placeholder="Apellidos y nombres" />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Digitador Supervisado</label>
            {digitadoresDisponibles.length > 0 ? (
              <select className="form-select" value={digitadorId || ""} onChange={(e) => { const selId = e.target.value || null; setDigitadorId(selId); const dig = digitadoresDisponibles.find((d) => d.id === selId); setDigitadorNombre(dig?.apellidos_nombres || ""); }}>
                <option value="">Seleccione digitador...</option>
                {digitadoresDisponibles.map((d) => (
                  <option key={d.id} value={d.id}>{d.apellidos_nombres}</option>
                ))}
              </select>
            ) : (
              <input className="form-control" value={digitadorNombre} onChange={(e) => setDigitadorNombre(e.target.value)} placeholder="Apellidos y nombres" />
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Cel / Correo del Locador</label>
            <input className="form-control" value={celCorreoLocador} onChange={(e) => setCelCorreoLocador(e.target.value)} placeholder="Celular o correo electrónico" />
          </div>
        </div>
      </div>

      {/* ==================== SECCIONES DINÁMICAS ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Aspectos de Evaluación</h5>
        <hr className="my-3" />

        {Object.keys(seccionesAgrupadas).length === 0 ? (
          <div className="alert alert-warning">No hay parámetros de supervisión informática en la tabla <b>parametros</b>.</div>
        ) : (
          Object.entries(seccionesAgrupadas).map(([seccion, items]) => (
            <div key={seccion} className="mb-4">
              <div className="section-title mb-2">{seccion}</div>
              <div className="section-box p-3">
                {items.map((p) => renderParametroSiNo(p))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ==================== OTRAS ACTIVIDADES ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Otras Actividades Realizadas por el Supervisor Informático</h5>
        <hr className="my-3" />
        {["A", "B", "C", "D", "E", "F"].map((letra) => (
          <div key={letra} className="mb-3">
            <label className="form-label fw-semibold">{letra}.</label>
            <input
              type="text"
              className="form-control"
              value={otrasActividades[letra] || ""}
              onChange={(e) => setOtrasActividades((prev) => ({ ...prev, [letra]: e.target.value }))}
              placeholder={`Descripción de actividad ${letra}...`}
            />
          </div>
        ))}
      </div>

      {/* ==================== OBSERVACIONES Y RECOMENDACIONES ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Observaciones y Recomendaciones</h5>
        <hr className="my-3" />
        <div className="mb-3">
          <label className="form-label fw-semibold">Observaciones en General</label>
          <textarea className="form-control" rows={5} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Escriba observaciones generales..." />
        </div>
        <div className="mb-3">
          <label className="form-label fw-semibold">Recomendaciones</label>
          <textarea className="form-control" rows={4} value={recomendaciones} onChange={(e) => setRecomendaciones(e.target.value)} placeholder="Escriba recomendaciones..." />
        </div>
      </div>

      {/* ==================== EVIDENCIAS ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Evidencias</h5>
        <div className="text-muted" style={{ fontSize: 13 }}>Adjunta fotos/PDF/Excel u otros archivos.</div>
        <div className="mt-3 no-print">
          <input type="file" className="form-control" multiple onChange={(e) => onUploadEvidencias(Array.from(e.target.files || []))} disabled={subiendoEvidencias} />
          {subiendoEvidencias && <div className="mt-2">Subiendo archivos...</div>}
        </div>
        <hr className="my-3" />
        {evidencias.length === 0 ? (
          <div className="text-muted">Aún no hay evidencias registradas.</div>
        ) : (
          <div className="list-group">
            {evidencias.map((ev) => (
              <div key={ev.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">{ev.archivo_url.split("/").slice(-1)[0]}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {ev.tipo || "archivo"} — {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                  </div>
                </div>
                <div className="no-print">
                  {ev.signedUrl ? (
                    <a className="btn btn-outline-primary btn-sm" href={ev.signedUrl} target="_blank" rel="noreferrer">Abrir</a>
                  ) : (
                    <span className="text-muted">Sin URL</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== FIRMAS ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Firmas</h5>
        <hr className="my-3" />
        <div className="row g-3">
          {/* Médico Jefe */}
          <div className="col-12 col-md-4">
            <div className="fw-semibold mb-2">Firma y Sello Médico Jefe del EESS</div>
            <div className="firma-box">
              {firmaMedicoJefeUrl ? (
                <img src={firmaMedicoJefeUrl} alt="Firma Médico Jefe" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <SignatureCanvas ref={sigMedicoJefeRef} penColor="black" canvasProps={{ className: "firma-canvas" }} />
              )}
            </div>
            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigMedicoJefeRef.current?.clear()}>Limpiar</button>
              {firmaMedicoJefeUrl && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => { setFirmaMedicoJefeUrl(null); setFirmaMedicoJefePath(null); }}>Re-firmar</button>
              )}
            </div>
          </div>

          {/* Locador/Digitador */}
          <div className="col-12 col-md-4">
            <div className="fw-semibold mb-2">Firma Locador de Servicio OFSEG del EESS</div>
            <div className="firma-box">
              {firmaDigitadorUrl ? (
                <img src={firmaDigitadorUrl} alt="Firma Locador" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <SignatureCanvas ref={sigDigitadorRef} penColor="black" canvasProps={{ className: "firma-canvas" }} />
              )}
            </div>
            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigDigitadorRef.current?.clear()}>Limpiar</button>
              {firmaDigitadorUrl && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => { setFirmaDigitadorUrl(null); setFirmaDigitadorPath(null); }}>Re-firmar</button>
              )}
            </div>
          </div>

          {/* Supervisor Informático */}
          <div className="col-12 col-md-4">
            <div className="fw-semibold mb-2">Firma y Sello Supervisor Informático OFSEG</div>
            <div className="firma-box">
              {firmaSupervisorUrl ? (
                <img src={firmaSupervisorUrl} alt="Firma Supervisor IT" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <SignatureCanvas ref={sigSupervisorRef} penColor="black" canvasProps={{ className: "firma-canvas" }} />
              )}
            </div>
            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigSupervisorRef.current?.clear()}>Limpiar</button>
              {firmaSupervisorUrl && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => { setFirmaSupervisorUrl(null); setFirmaSupervisorPath(null); }}>Re-firmar</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ACCIONES ==================== */}
      <div className="d-flex gap-2 mt-4 no-print">
        <button className="btn btn-outline-secondary" onClick={() => navigate("/supervisiones-informatica")}>Volver</button>
        <button className="btn btn-primary" disabled={saving} onClick={guardarTodoFinalizar}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="btn btn-outline-danger" onClick={limpiarFormulario}>Limpiar</button>
        <button className="btn btn-outline-dark" onClick={imprimir}>Exportar / Imprimir (PDF)</button>
      </div>
    </div>
  );
}
