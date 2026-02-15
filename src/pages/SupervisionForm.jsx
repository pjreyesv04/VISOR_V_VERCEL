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

const GRUPOS_OCUPACIONALES = ["Médico", "Técnico", "Licenciado", "Tecnólogo"];

const EMPTY_PARTICIPANTE = { apellidos_nombres: "", dni: "", grupo_ocupacional: "" };
const EMPTY_FUA = { numero_fua: "", fecha_atencion: "", fecha_digitacion: "", codigo_prestacional: "", cpms: "", observacion: "" };
const EMPTY_VERIF = { numero_fua: "", numero_hc: "", receta: "", boleta: "", profesional: "", gratuidad: null, observacion: "" };

const REACTIVOS_NOMBRES = ["HBA1c (Hemoglobina Glicosilada)", "Microalbuminuria", "Creatinina sérica"];
const EMPTY_REACTIVO = { nombre_reactivo: "", disponible: null, fecha_abastecimiento: "" };

export default function SupervisionForm() {
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

  // Parámetros dinámicos
  const [parametros, setParametros] = useState([]);
  const [respuestas, setRespuestas] = useState({});

  // Tablas extra
  const [participantes, setParticipantes] = useState([{ ...EMPTY_PARTICIPANTE }]);
  const [fuaVerificados, setFuaVerificados] = useState(
    Array.from({ length: 10 }, () => ({ ...EMPTY_FUA }))
  );
  const [verificacionFuaHc, setVerificacionFuaHc] = useState(
    Array.from({ length: 10 }, () => ({ ...EMPTY_VERIF }))
  );

  // Reactivos e insumos (2.2)
  const [reactivosInsumos, setReactivosInsumos] = useState(
    REACTIVOS_NOMBRES.map((n) => ({ ...EMPTY_REACTIVO, nombre_reactivo: n }))
  );

  // Respuestas por digitador (secciones 6.1, 6.2)
  // Estructura: { "parametroId__digitadorId": true/false/null }
  const [respuestasDigitador, setRespuestasDigitador] = useState({});

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

  // Mapa de código -> parámetro para dependencias
  const codigoToParam = useMemo(() => {
    const map = {};
    (parametros || []).forEach((p) => {
      if (p.codigo) map[p.codigo] = p;
    });
    return map;
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
    const fechaSolo = isoString.split('T')[0];
    const date = new Date(fechaSolo + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const setResp = (paramId, patch) => {
    setRespuestas((prev) => {
      const current = prev[paramId] || { valor_bool: null, observacion: "", valor_fecha: null, valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "" };
      return { ...prev, [paramId]: { ...current, ...patch } };
    });
  };

  // Verificar si un parámetro está desactivado por dependencia
  const isDisabledByDependency = (p) => {
    // --- Dependencias hardcodeadas de 2.1 → 2.2, 2.3, 2.4 ---
    // Buscar en TODOS los parámetros con código 2.1 (puede haber duplicados en BD)
    if (["2.2", "2.3", "2.4"].includes(p.codigo)) {
      const all21 = (parametros || []).filter((x) => x.codigo === "2.1");
      // Obtener el valor_bool de cualquier 2.1 que tenga respuesta
      let val21 = null;
      for (const p21 of all21) {
        const r21 = respuestas[p21.id];
        if (r21 && r21.valor_bool !== null && r21.valor_bool !== undefined) {
          val21 = r21.valor_bool;
          break;
        }
      }
      // Si 2.1 = No → bloquear 2.2 y 2.3
      if (["2.2", "2.3"].includes(p.codigo) && val21 === false) return true;
      // Si 2.1 = Sí → bloquear 2.4
      if (p.codigo === "2.4" && val21 === true) return true;
    }

    // --- Dependencias genéricas vía base de datos ---
    if (!p.depende_de_codigo) return false;
    const parent = codigoToParam[p.depende_de_codigo];
    if (!parent) return false;
    const parentResp = respuestas[parent.id];
    if (!parentResp || parentResp.valor_bool === null) return false;

    // depende_valor = "no" significa: solo visible si el padre = No (valor_bool = false)
    if (p.depende_valor === "no" && parentResp.valor_bool === true) return true;
    if (p.depende_valor === "si" && parentResp.valor_bool === false) return true;
    return false;
  };

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
    } catch {
      // ignore
    }
  };

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
          .from("evidencias")
          .createSignedUrl(ev.archivo_url, 60 * 60);
        if (!serr) signedUrl = sdata?.signedUrl || null;
      } catch {}
      withSigned.push({ ...ev, signedUrl });
    }
    setEvidencias(withSigned);
  };

  // =========================
  // CARGA INICIAL
  // =========================
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const { data: s } = await supabase.auth.getSession();
      const user = s?.session?.user || null;
      setSessionUser(user);
      if (!user) {
        navigate("/login");
        return;
      }

      // 1) Traer supervisión
      const { data: sup, error: supErr } = await supabase
        .from("supervisiones")
        .select(
          "id,auditor_id,ris_id,establecimiento_id,correlativo,fecha,hora_inicio,hora_fin,medico_jefe,digitador,digitador_id,observaciones,recomendaciones,firma_url,firma_digitador_url,firma_medico_jefe_url"
        )
        .eq("id", supervisionId)
        .single();

      if (supErr) {
        toast.error("Error cargando supervision: " + supErr.message);
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

        await supabase
          .from("supervisiones")
          .update({ hora_inicio: horaInicioISO, fecha: fechaISO })
          .eq("id", supervisionId);
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

      setFirmaSupervisorPath(sup.firma_url || null);
      setFirmaDigitadorPath(sup.firma_digitador_url || null);
      setFirmaMedicoJefePath(sup.firma_medico_jefe_url || null);

      // Correlativo
      if (sup.correlativo == null) {
        const { count } = await supabase
          .from("supervisiones")
          .select("id", { count: "exact", head: true })
          .eq("auditor_id", user.id);

        const next = (count || 0) + 1;
        setCorrelativo(next);
        await supabase.from("supervisiones").update({ correlativo: next }).eq("id", supervisionId);
      }

      // RIS / EESS
      const { data: ris } = await supabase.from("ris").select("nombre").eq("id", sup.ris_id).single();
      setRisNombre(ris?.nombre || "");

      const { data: est } = await supabase
        .from("establecimientos")
        .select("nombre")
        .eq("id", sup.establecimiento_id)
        .single();
      setEstablecimientoNombre(est?.nombre || "");

      // Digitadores del establecimiento
      const { data: digData } = await supabase
        .from("digitadores")
        .select("id, apellidos_nombres")
        .eq("establecimiento_id", sup.establecimiento_id)
        .eq("activo", true)
        .order("apellidos_nombres");
      setDigitadoresDisponibles(digData || []);

      // Si hay digitador_id, obtener nombre actualizado
      if (sup.digitador_id && digData) {
        const dig = digData.find(d => d.id === sup.digitador_id);
        if (dig) setDigitadorNombre(dig.apellidos_nombres);
      }

      // Parámetros (solo de Supervisión General)
      const { data: params, error: pErr } = await supabase
        .from("parametros")
        .select("id,seccion,codigo,descripcion,requiere_observacion,orden,activo,tipo_campo_condicional,condicion_campo,etiqueta_campo_condicional,depende_de_codigo,depende_valor,has_tabla_extra")
        .eq("tipo_supervision", "general")
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true });

      if (pErr) toast.error("Error cargando parametros: " + pErr.message);
      setParametros(params || []);

      // Respuestas
      const { data: resp } = await supabase
        .from("respuestas")
        .select("parametro_id,valor_bool,observacion,valor_fecha,valor_cantidad,valor_cantidad_2,valor_cantidad_3,valor_texto")
        .eq("supervision_id", supervisionId);

      // Inicializar respuestas vacías para TODOS los parámetros
      const map = {};
      (params || []).forEach((p) => {
        map[p.id] = {
          valor_bool: null,
          observacion: "",
          valor_fecha: null,
          valor_cantidad: null,
          valor_cantidad_2: null,
          valor_cantidad_3: null,
          valor_texto: "",
        };
      });
      // Sobreescribir con respuestas guardadas en BD
      (resp || []).forEach((r) => {
        map[r.parametro_id] = {
          valor_bool: r.valor_bool ?? null,
          observacion: r.observacion ?? "",
          valor_fecha: r.valor_fecha ?? null,
          valor_cantidad: r.valor_cantidad ?? null,
          valor_cantidad_2: r.valor_cantidad_2 ?? null,
          valor_cantidad_3: r.valor_cantidad_3 ?? null,
          valor_texto: r.valor_texto ?? "",
        };
      });
      setRespuestas(map);

      // Tablas extra: Participantes
      const { data: partData } = await supabase
        .from("participantes_capacitacion")
        .select("*")
        .eq("supervision_id", supervisionId)
        .order("created_at", { ascending: true });

      if (partData && partData.length > 0) {
        setParticipantes(partData.map((p) => ({
          id: p.id,
          apellidos_nombres: p.apellidos_nombres || "",
          dni: p.dni || "",
          grupo_ocupacional: p.grupo_ocupacional || "",
        })));
      }

      // Tablas extra: FUA verificados
      const { data: fuaData } = await supabase
        .from("fua_verificados")
        .select("*")
        .eq("supervision_id", supervisionId)
        .order("fila_numero", { ascending: true });

      if (fuaData && fuaData.length > 0) {
        const fuaRows = Array.from({ length: 10 }, (_, i) => {
          const existing = fuaData.find((f) => f.fila_numero === i + 1);
          return existing
            ? { id: existing.id, numero_fua: existing.numero_fua || "", fecha_atencion: existing.fecha_atencion || "", fecha_digitacion: existing.fecha_digitacion || "", codigo_prestacional: existing.codigo_prestacional || "", cpms: existing.cpms || "", observacion: existing.observacion || "" }
            : { ...EMPTY_FUA };
        });
        setFuaVerificados(fuaRows);
      }

      // Tablas extra: Verificación FUA vs HC
      const { data: verifData } = await supabase
        .from("verificacion_fua_hc")
        .select("*")
        .eq("supervision_id", supervisionId)
        .order("fila_numero", { ascending: true });

      if (verifData && verifData.length > 0) {
        const verifRows = Array.from({ length: 10 }, (_, i) => {
          const existing = verifData.find((f) => f.fila_numero === i + 1);
          return existing
            ? { id: existing.id, numero_fua: existing.numero_fua || "", numero_hc: existing.numero_hc || "", receta: existing.receta || "", boleta: existing.boleta || "", profesional: existing.profesional || "", gratuidad: existing.gratuidad, observacion: existing.observacion || "" }
            : { ...EMPTY_VERIF };
        });
        setVerificacionFuaHc(verifRows);
      }

      // Tablas extra: Reactivos e insumos (2.2)
      const { data: reactData } = await supabase
        .from("reactivos_insumos")
        .select("*")
        .eq("supervision_id", supervisionId);

      if (reactData && reactData.length > 0) {
        const reactRows = REACTIVOS_NOMBRES.map((nombre) => {
          const existing = reactData.find((r) => r.nombre_reactivo === nombre);
          return existing
            ? { nombre_reactivo: nombre, disponible: existing.disponible, fecha_abastecimiento: existing.fecha_abastecimiento || "" }
            : { ...EMPTY_REACTIVO, nombre_reactivo: nombre };
        });
        setReactivosInsumos(reactRows);
      }

      // Respuestas por digitador (6.1, 6.2)
      const { data: respDigData } = await supabase
        .from("respuestas_digitador")
        .select("parametro_id, digitador_id, valor_bool")
        .eq("supervision_id", supervisionId);

      if (respDigData && respDigData.length > 0) {
        const rdMap = {};
        respDigData.forEach((rd) => {
          rdMap[`${rd.parametro_id}__${rd.digitador_id}`] = rd.valor_bool;
        });
        setRespuestasDigitador(rdMap);
      }

      // Evidencias + firmas
      await refreshEvidencias();
      await refreshFirmasSignedUrls(sup.firma_url, sup.firma_digitador_url, sup.firma_medico_jefe_url);

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisionId]);

  // =========================
  // SUBIR FIRMA
  // =========================
  const subirFirma = async (tipo) => {
    const ref =
      tipo === "supervisor" ? sigSupervisorRef : tipo === "digitador" ? sigDigitadorRef : sigMedicoJefeRef;

    if (!ref.current || ref.current.isEmpty()) {
      toast.error("Firma vacia. Firma primero.");
      return;
    }

    try {
      setSaving(true);

      const dataURL = ref.current.getTrimmedCanvas().toDataURL("image/png");
      const blob = await dataURLToBlob(dataURL);

      const fileName = `${tipo}_${Date.now()}.png`;
      const path = `${supervisionId}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("firmas")
        .upload(path, blob, { contentType: "image/png", upsert: true });

      if (upErr) throw upErr;

      const updatePayload =
        tipo === "supervisor"
          ? { firma_url: path }
          : tipo === "digitador"
          ? { firma_digitador_url: path }
          : { firma_medico_jefe_url: path };

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
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // SUBIR EVIDENCIAS
  // =========================
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

        const { error: insErr } = await supabase
          .from("evidencias")
          .insert([{ supervision_id: supervisionId, archivo_url: path, tipo, descripcion: null }]);

        if (insErr) throw insErr;
      }

      await refreshEvidencias();
      toast.success("Evidencias subidas correctamente");
    } catch (e) {
      toast.error("Error subiendo evidencias: " + (e?.message || e));
    } finally {
      setSubiendoEvidencias(false);
    }
  };

  // =========================
  // REGISTRAR EN AUDITORÍA
  // =========================
  const registrarAuditoria = async (action, description, cambios) => {
    try {
      if (!user?.id) {
        console.warn("No se puede registrar auditoría: usuario no disponible");
        return;
      }

      const toastId = toast.loading("Registrando cambios... Acción siendo auditada");

      const { error } = await supabase.from("audit_logs").insert({
        supervision_id: supervisionId,
        user_id: user.id,
        action,
        description:
          description ||
          `${action === "update" ? "Actualización" : "Creación"} de acta de supervisión`,
        field_name: cambios?.field ? cambios.field : null,
        old_value: cambios?.oldValue ? JSON.stringify(cambios.oldValue) : null,
        new_value: cambios?.newValue ? JSON.stringify(cambios.newValue) : null,
      });

      if (error) {
        console.error("Error registrando auditoría:", error);
        toast.error("No fue posible registrar el cambio en auditoría", { id: toastId });
      } else {
        toast.success("Cambios registrados y auditados exitosamente", { id: toastId });
      }
    } catch (e) {
      console.error("Exception en registrarAuditoria:", e.message);
      toast.error("Error de auditoría: " + (e?.message || e));
    }
  };

  // =========================
  // GUARDAR TODO
  // =========================
  const guardarTodoFinalizar = async () => {
    try {
      setSaving(true);

      const fin = nowAsText();
      setHoraFinTxt(fin.hora);

      // Cabecera + observaciones
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
        })
        .eq("id", supervisionId);

      if (supErr) throw supErr;

      // Respuestas
      const rows = Object.entries(respuestas).map(([parametro_id, r]) => ({
        supervision_id: supervisionId,
        parametro_id,
        valor_bool: r.valor_bool ?? null,
        observacion: r.observacion ?? null,
        valor_fecha: r.valor_fecha ?? null,
        valor_cantidad: r.valor_cantidad ?? null,
        valor_cantidad_2: r.valor_cantidad_2 ?? null,
        valor_cantidad_3: r.valor_cantidad_3 ?? null,
        valor_texto: r.valor_texto ?? null,
      }));

      if (rows.length > 0) {
        const { error: rErr } = await supabase
          .from("respuestas")
          .upsert(rows, { onConflict: "supervision_id,parametro_id" });

        if (rErr) throw rErr;
      }

      // Guardar participantes
      await supabase.from("participantes_capacitacion").delete().eq("supervision_id", supervisionId);
      const partRows = participantes
        .filter((p) => p.apellidos_nombres.trim() || p.dni.trim())
        .map((p) => ({
          supervision_id: supervisionId,
          apellidos_nombres: p.apellidos_nombres,
          dni: p.dni,
          grupo_ocupacional: p.grupo_ocupacional,
        }));
      if (partRows.length > 0) {
        const { error: partErr } = await supabase.from("participantes_capacitacion").insert(partRows);
        if (partErr) throw partErr;
      }

      // Guardar FUA verificados
      await supabase.from("fua_verificados").delete().eq("supervision_id", supervisionId);
      const fuaRows = fuaVerificados
        .map((f, i) => ({ ...f, fila_numero: i + 1 }))
        .filter((f) => f.numero_fua.trim() || f.codigo_prestacional.trim() || f.cpms.trim());
      if (fuaRows.length > 0) {
        const { error: fuaErr } = await supabase.from("fua_verificados").insert(
          fuaRows.map((f) => ({
            supervision_id: supervisionId,
            fila_numero: f.fila_numero,
            numero_fua: f.numero_fua,
            fecha_atencion: f.fecha_atencion || null,
            fecha_digitacion: f.fecha_digitacion || null,
            codigo_prestacional: f.codigo_prestacional,
            cpms: f.cpms,
            observacion: f.observacion,
          }))
        );
        if (fuaErr) throw fuaErr;
      }

      // Guardar verificación FUA vs HC
      await supabase.from("verificacion_fua_hc").delete().eq("supervision_id", supervisionId);
      const verifRows = verificacionFuaHc
        .map((v, i) => ({ ...v, fila_numero: i + 1 }))
        .filter((v) => v.numero_fua.trim() || v.numero_hc.trim());
      if (verifRows.length > 0) {
        const { error: verifErr } = await supabase.from("verificacion_fua_hc").insert(
          verifRows.map((v) => ({
            supervision_id: supervisionId,
            fila_numero: v.fila_numero,
            numero_fua: v.numero_fua,
            numero_hc: v.numero_hc,
            receta: v.receta || "",
            boleta: v.boleta || "",
            profesional: v.profesional || "",
            gratuidad: v.gratuidad,
            observacion: v.observacion,
          }))
        );
        if (verifErr) throw verifErr;
      }

      // Guardar reactivos e insumos (2.2)
      await supabase.from("reactivos_insumos").delete().eq("supervision_id", supervisionId);
      const reactRows = reactivosInsumos.filter((r) => r.disponible !== null);
      if (reactRows.length > 0) {
        const { error: reactErr } = await supabase.from("reactivos_insumos").insert(
          reactRows.map((r) => ({
            supervision_id: supervisionId,
            nombre_reactivo: r.nombre_reactivo,
            disponible: r.disponible,
            fecha_abastecimiento: r.fecha_abastecimiento || null,
          }))
        );
        if (reactErr) throw reactErr;
      }

      // Guardar respuestas por digitador (6.1, 6.2)
      await supabase.from("respuestas_digitador").delete().eq("supervision_id", supervisionId);
      const rdRows = Object.entries(respuestasDigitador)
        .filter(([, val]) => val !== null && val !== undefined)
        .map(([key, val]) => {
          const [parametro_id, digitador_id] = key.split("__");
          return {
            supervision_id: supervisionId,
            parametro_id,
            digitador_id,
            valor_bool: val,
          };
        });
      if (rdRows.length > 0) {
        const { error: rdErr } = await supabase.from("respuestas_digitador").insert(rdRows);
        if (rdErr) throw rdErr;
      }

      // Auditoría
      await registrarAuditoria("update", "Acta de supervisión finalizada y guardada", {
        field: "estado",
        oldValue: "borrador",
        newValue: "completado",
      });

      toast.success("Guardado correctamente. Hora fin registrada.");
    } catch (e) {
      toast.error("Error al guardar: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const limpiarFormulario = () => {
    if (!window.confirm("¿Está seguro de limpiar todo el formulario? Se perderán los datos no guardados.")) return;

    setMedicoJefeNombre("");
    setDigitadorNombre("");
    setDigitadorId(null);
    setRespuestasDigitador({});
    setObservaciones("");
    setRecomendaciones("");

    const respVacias = {};
    Object.keys(respuestas).forEach((paramId) => {
      respVacias[paramId] = { valor_bool: null, observacion: "", valor_fecha: null, valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "" };
    });
    setRespuestas(respVacias);

    setParticipantes([{ ...EMPTY_PARTICIPANTE }]);
    setFuaVerificados(Array.from({ length: 10 }, () => ({ ...EMPTY_FUA })));
    setVerificacionFuaHc(Array.from({ length: 10 }, () => ({ ...EMPTY_VERIF })));
    setReactivosInsumos(REACTIVOS_NOMBRES.map((n) => ({ ...EMPTY_REACTIVO, nombre_reactivo: n })));

    sigSupervisorRef.current?.clear();
    sigDigitadorRef.current?.clear();
    sigMedicoJefeRef.current?.clear();

    toast.success("Formulario limpiado");
  };

  const imprimir = () => window.print();

  // =========================
  // HELPERS PARA TABLAS DINÁMICAS
  // =========================
  const updateParticipante = (index, field, value) => {
    setParticipantes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addParticipante = () => {
    setParticipantes((prev) => [...prev, { ...EMPTY_PARTICIPANTE }]);
  };

  const removeParticipante = (index) => {
    setParticipantes((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const updateFua = (index, field, value) => {
    setFuaVerificados((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateVerif = (index, field, value) => {
    setVerificacionFuaHc((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // =========================
  // RENDER: Tabla de Participantes (Sección 1.1)
  // =========================
  const renderTablaParticipantes = () => (
    <div className="mt-3">
      <label className="form-label fw-semibold text-primary">Participantes de la capacitación</label>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Apellidos y Nombres</th>
              <th style={{ width: 140 }}>N° DNI</th>
              <th style={{ width: 160 }}>Grupo Ocupacional</th>
              <th style={{ width: 50 }} className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {participantes.map((p, i) => (
              <tr key={i}>
                <td className="text-center align-middle">{i + 1}</td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={p.apellidos_nombres}
                    onChange={(e) => updateParticipante(i, "apellidos_nombres", e.target.value)}
                    placeholder="Apellidos y nombres"
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={p.dni}
                    onChange={(e) => updateParticipante(i, "dni", e.target.value)}
                    placeholder="DNI"
                    maxLength={8}
                  />
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={p.grupo_ocupacional}
                    onChange={(e) => updateParticipante(i, "grupo_ocupacional", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {GRUPOS_OCUPACIONALES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </td>
                <td className="text-center no-print">
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => removeParticipante(i)}
                    title="Eliminar fila"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-outline-primary btn-sm no-print" onClick={addParticipante}>
        + Agregar participante
      </button>
    </div>
  );

  // =========================
  // RENDER: Tabla FUA Verificados (Sección 6)
  // =========================
  const renderTablaFuaVerificados = () => (
    <div className="mt-3 mb-3">
      <label className="form-label fw-semibold text-primary">Tabla de FUA Verificados (10 filas)</label>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>ITEM</th>
              <th>Numero FUA</th>
              <th style={{ width: 130 }}>Fecha Atención</th>
              <th style={{ width: 130 }}>Fecha Digitación</th>
              <th>Código Prestacional</th>
              <th>CPMS</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {fuaVerificados.map((f, i) => (
              <tr key={i}>
                <td className="text-center align-middle">{i + 1}</td>
                <td>
                  <input className="form-control form-control-sm" value={f.numero_fua} onChange={(e) => updateFua(i, "numero_fua", e.target.value)} placeholder="N° FUA" />
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={f.fecha_atencion} onChange={(e) => updateFua(i, "fecha_atencion", e.target.value)} />
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={f.fecha_digitacion} onChange={(e) => updateFua(i, "fecha_digitacion", e.target.value)} />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={f.codigo_prestacional} onChange={(e) => updateFua(i, "codigo_prestacional", e.target.value)} placeholder="Código" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={f.cpms} onChange={(e) => updateFua(i, "cpms", e.target.value)} placeholder="CPMS" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={f.observacion} onChange={(e) => updateFua(i, "observacion", e.target.value)} placeholder="Obs." />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =========================
  // RENDER: Tabla Verificación FUA vs HC (Sección 7.1)
  // =========================
  const renderTablaVerificacionFuaHc = () => (
    <div className="mt-3 mb-3">
      <label className="form-label fw-semibold text-primary">Verificación FUA vs Historia Clínica</label>
      <div className="table-responsive">
        <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>N° Historia Clínica</th>
              <th>FUA</th>
              <th>Receta</th>
              <th>Boleta</th>
              <th>Profesional</th>
              <th style={{ width: 130 }}>Gratuidad</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {verificacionFuaHc.map((v, i) => (
              <tr key={i}>
                <td className="text-center align-middle">{i + 1}</td>
                <td>
                  <input className="form-control form-control-sm" value={v.numero_hc} onChange={(e) => updateVerif(i, "numero_hc", e.target.value)} placeholder="N° HC" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={v.numero_fua} onChange={(e) => updateVerif(i, "numero_fua", e.target.value)} placeholder="N° FUA" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={v.receta || ""} onChange={(e) => updateVerif(i, "receta", e.target.value)} placeholder="Receta" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={v.boleta || ""} onChange={(e) => updateVerif(i, "boleta", e.target.value)} placeholder="Boleta" />
                </td>
                <td>
                  <input className="form-control form-control-sm" value={v.profesional || ""} onChange={(e) => updateVerif(i, "profesional", e.target.value)} placeholder="Profesional" />
                </td>
                <td>
                  <select className="form-select form-select-sm" value={v.gratuidad === null ? "" : v.gratuidad ? "cumple" : "no_cumple"} onChange={(e) => updateVerif(i, "gratuidad", e.target.value === "" ? null : e.target.value === "cumple")}>
                    <option value="">—</option>
                    <option value="cumple">Cumple</option>
                    <option value="no_cumple">No cumple</option>
                  </select>
                </td>
                <td>
                  <input className="form-control form-control-sm" value={v.observacion} onChange={(e) => updateVerif(i, "observacion", e.target.value)} placeholder="Obs." />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =========================
  // RENDER: Tabla Reactivos e Insumos (Sección 2.2)
  // =========================
  const updateReactivo = (index, field, value) => {
    setReactivosInsumos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const renderTablaReactivos = () => (
    <div className="mt-2 mb-2">
      <div className="table-responsive">
        <table className="table table-bordered table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>Reactivo / Insumo</th>
              <th style={{ width: 60 }} className="text-center">Sí</th>
              <th style={{ width: 60 }} className="text-center">No</th>
              <th>Indicar fecha de último abastecimiento</th>
            </tr>
          </thead>
          <tbody>
            {reactivosInsumos.map((r, i) => (
              <tr key={i}>
                <td className="align-middle fw-semibold" style={{ fontSize: "0.85rem" }}>{r.nombre_reactivo}</td>
                <td className="text-center align-middle">
                  <input
                    type="radio"
                    className="form-check-input"
                    name={`reactivo_${i}`}
                    checked={r.disponible === true}
                    onChange={() => updateReactivo(i, "disponible", true)}
                  />
                </td>
                <td className="text-center align-middle">
                  <input
                    type="radio"
                    className="form-check-input"
                    name={`reactivo_${i}`}
                    checked={r.disponible === false}
                    onChange={() => updateReactivo(i, "disponible", false)}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={r.fecha_abastecimiento || ""}
                    onChange={(e) => updateReactivo(i, "fecha_abastecimiento", e.target.value || null)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =========================
  // RENDER: Tabla de Digitadores (Secciones 6.1, 6.2)
  // =========================
  const setRespDigitador = (parametroId, digitadorId, value) => {
    setRespuestasDigitador((prev) => ({
      ...prev,
      [`${parametroId}__${digitadorId}`]: value,
    }));
  };

  const renderTablaDigitadores = (parametroId) => {
    if (!digitadoresDisponibles || digitadoresDisponibles.length === 0) {
      return (
        <div className="mt-2 text-muted" style={{ fontSize: 13 }}>
          No hay digitadores registrados para este establecimiento.
        </div>
      );
    }

    return (
      <div className="mt-2 mb-2">
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Nombre del Digitador</th>
                <th style={{ width: 80 }} className="text-center">Sí</th>
                <th style={{ width: 80 }} className="text-center">No</th>
              </tr>
            </thead>
            <tbody>
              {digitadoresDisponibles.map((d) => {
                const key = `${parametroId}__${d.id}`;
                const val = respuestasDigitador[key] ?? null;
                return (
                  <tr key={d.id}>
                    <td className="align-middle">{d.apellidos_nombres}</td>
                    <td className="text-center align-middle">
                      <input
                        type="radio"
                        className="form-check-input"
                        name={`dig_${parametroId}_${d.id}`}
                        checked={val === true}
                        onChange={() => setRespDigitador(parametroId, d.id, true)}
                      />
                    </td>
                    <td className="text-center align-middle">
                      <input
                        type="radio"
                        className="form-check-input"
                        name={`dig_${parametroId}_${d.id}`}
                        checked={val === false}
                        onChange={() => setRespDigitador(parametroId, d.id, false)}
                      />
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

  // =========================
  // RENDER: Parámetro individual
  // =========================
  const renderParametroSiNo = (p) => {
    const r = respuestas[p.id] || { valor_bool: null, observacion: "", valor_fecha: null, valor_cantidad: null, valor_cantidad_2: null, valor_cantidad_3: null, valor_texto: "" };

    const disabled = isDisabledByDependency(p);

    const mostrarCampoCondicional = () => {
      if (!p.tipo_campo_condicional) return false;
      if (p.condicion_campo === "siempre") return true;
      if (p.condicion_campo === "si" && r.valor_bool === true) return true;
      if (p.condicion_campo === "no" && r.valor_bool === false) return true;
      return false;
    };

    const showConditional = !disabled && mostrarCampoCondicional();

    // Para cantidad_multiple, parsear las etiquetas separadas por |
    const cantidadLabels = p.tipo_campo_condicional === "cantidad_multiple" && p.etiqueta_campo_condicional
      ? p.etiqueta_campo_condicional.split("|")
      : [];

    // Para texto_persona, parsear las etiquetas
    const textoPersonaLabels = p.tipo_campo_condicional === "texto_persona" && p.etiqueta_campo_condicional
      ? p.etiqueta_campo_condicional.split("|")
      : [];

    // Mostrar tabla participantes si 1.1 = Sí
    const showTablaParticipantes = p.has_tabla_extra === "participantes" && r.valor_bool === true;

    // Mostrar tabla reactivos (2.2)
    const showTablaReactivos = p.has_tabla_extra === "tabla_reactivos";

    // Mostrar tabla FUA verificados en la sección 6
    const showTablaFua = p.has_tabla_extra === "fua_verificados";

    // Mostrar tabla verificación FUA vs HC en sección 7
    const showTablaVerif = p.has_tabla_extra === "verificacion_fua_hc";

    // Mostrar tabla de digitadores (6.1, 6.2)
    const showTablaDigitadores = p.has_tabla_extra === "tabla_digitadores";

    // Para 6.1/6.2, 2.2 (reactivos) y 5.3 (FUA) ocultar radios Si/No globales
    const ocultarRadiosSiNo = showTablaDigitadores || showTablaReactivos || showTablaFua;

    return (
      <div className={`mb-3 ${disabled ? "opacity-50" : ""}`} style={disabled ? { pointerEvents: "none" } : {}} key={p.id}>
        <div className="fw-semibold">
          {p.codigo ? `${p.codigo}. ` : ""}
          {p.descripcion}
          {disabled && <span className="badge bg-secondary ms-2" style={{ fontSize: 10 }}>Desactivado (ver {p.depende_de_codigo || "2.1"})</span>}
        </div>

        {!disabled && (
          <>
            {/* Radios Si/No (ocultos para 6.1/6.2 que solo usan tabla digitadores) */}
            {!ocultarRadiosSiNo && (
              <div className="d-flex gap-4 mt-2">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name={`si_no_${p.id}`}
                    checked={r.valor_bool === true}
                    onChange={() => setResp(p.id, { valor_bool: true })}
                  />
                  <span className="form-check-label">Sí</span>
                </label>

                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name={`si_no_${p.id}`}
                    checked={r.valor_bool === false}
                    onChange={() => setResp(p.id, { valor_bool: false })}
                  />
                  <span className="form-check-label">No</span>
                </label>
              </div>
            )}

            {/* Campo condicional: Fecha (etiqueta dinámica para 1.1) */}
            {showConditional && p.tipo_campo_condicional === "fecha" && (
              <div className="mt-2">
                <label className="form-label text-primary fw-semibold">
                  {p.codigo === "1.1"
                    ? (r.valor_bool === true ? "Fecha de la capacitación" : "Fecha a realizar la capacitación")
                    : (p.etiqueta_campo_condicional || "Fecha")}
                </label>
                <input
                  type="date"
                  className="form-control"
                  style={{ maxWidth: 250 }}
                  value={r.valor_fecha || ""}
                  onChange={(e) => setResp(p.id, { valor_fecha: e.target.value || null })}
                />
              </div>
            )}

            {/* Campo condicional: Cantidad simple */}
            {showConditional && p.tipo_campo_condicional === "cantidad" && (
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
                  onChange={(e) =>
                    setResp(p.id, {
                      valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10),
                    })
                  }
                />
              </div>
            )}

            {/* Campo condicional: Cantidad múltiple (3 campos separados) */}
            {showConditional && p.tipo_campo_condicional === "cantidad_multiple" && (
              <div className="mt-2">
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label text-primary fw-semibold" style={{ fontSize: 13 }}>
                      {cantidadLabels[0] || "Cantidad 1"}
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={0}
                      value={r.valor_cantidad ?? ""}
                      onChange={(e) => setResp(p.id, { valor_cantidad: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-primary fw-semibold" style={{ fontSize: 13 }}>
                      {cantidadLabels[1] || "Cantidad 2"}
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={0}
                      value={r.valor_cantidad_2 ?? ""}
                      onChange={(e) => setResp(p.id, { valor_cantidad_2: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-primary fw-semibold" style={{ fontSize: 13 }}>
                      {cantidadLabels[2] || "Cantidad 3"}
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={0}
                      value={r.valor_cantidad_3 ?? ""}
                      onChange={(e) => setResp(p.id, { valor_cantidad_3: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Campo condicional: Texto / Nombre */}
            {showConditional && p.tipo_campo_condicional === "texto" && (
              <div className="mt-2">
                <label className="form-label text-primary fw-semibold">
                  {p.etiqueta_campo_condicional || "Texto"}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={r.valor_texto || ""}
                  onChange={(e) => setResp(p.id, { valor_texto: e.target.value })}
                  placeholder="Ingrese..."
                />
              </div>
            )}

            {/* Campo condicional: Texto persona (nombre + grupo ocupacional) */}
            {showConditional && p.tipo_campo_condicional === "texto_persona" && (
              <div className="mt-2">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label text-primary fw-semibold" style={{ fontSize: 13 }}>
                      {textoPersonaLabels[0] || "Nombres y Apellidos"}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={r.valor_texto || ""}
                      onChange={(e) => setResp(p.id, { valor_texto: e.target.value })}
                      placeholder="Apellidos y nombres"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-primary fw-semibold" style={{ fontSize: 13 }}>
                      {textoPersonaLabels[1] || "Grupo Ocupacional"}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={r.valor_fecha || ""}
                      onChange={(e) => setResp(p.id, { valor_fecha: e.target.value || null })}
                    >
                      <option value="">Seleccionar...</option>
                      {GRUPOS_OCUPACIONALES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de participantes (1.1) */}
            {showTablaParticipantes && renderTablaParticipantes()}

            {/* Tabla reactivos e insumos (2.2) */}
            {showTablaReactivos && renderTablaReactivos()}

            {/* Tabla de digitadores (6.1, 6.2) */}
            {showTablaDigitadores && renderTablaDigitadores(p.id)}

            {/* Tabla FUA verificados (6.1) */}
            {showTablaFua && renderTablaFuaVerificados()}

            {/* Tabla verificación FUA vs HC (7.1) */}
            {showTablaVerif && renderTablaVerificacionFuaHc()}

            {/* Observación por ítem */}
            {p.requiere_observacion ? (
              <div className="mt-2">
                <label className="form-label">Observación</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={r.observacion || ""}
                  onChange={(e) => setResp(p.id, { observacion: e.target.value })}
                  placeholder="Detalle / sustento..."
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container my-4">
        <div className="alert alert-info">Cargando supervisión...</div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      {/* ==================== CABECERA ==================== */}
      <div className="acta-box p-3 mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h4 className="m-0">ACTA DE SUPERVISIÓN — AUDITORES</h4>
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
            <input
              className="form-control"
              value={medicoJefeNombre}
              onChange={(e) => setMedicoJefeNombre(e.target.value)}
              placeholder="Apellidos y nombres"
            />
          </div>

          <div className="col-md-6">
            <label className="form-label fw-semibold">Digitador del Establecimiento</label>
            {digitadoresDisponibles.length > 0 ? (
              <select
                className="form-select"
                value={digitadorId || ""}
                onChange={(e) => {
                  const selId = e.target.value || null;
                  setDigitadorId(selId);
                  const dig = digitadoresDisponibles.find(d => d.id === selId);
                  setDigitadorNombre(dig?.apellidos_nombres || "");
                }}
              >
                <option value="">Seleccione digitador...</option>
                {digitadoresDisponibles.map(d => (
                  <option key={d.id} value={d.id}>{d.apellidos_nombres}</option>
                ))}
              </select>
            ) : (
              <input
                className="form-control"
                value={digitadorNombre}
                onChange={(e) => setDigitadorNombre(e.target.value)}
                placeholder="Apellidos y nombres"
              />
            )}
          </div>
        </div>
      </div>

      {/* ==================== SECCIONES DINÁMICAS ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Evaluación</h5>
        <hr className="my-3" />

        {Object.keys(seccionesAgrupadas).length === 0 ? (
          <div className="alert alert-warning">No hay parámetros en la tabla <b>parametros</b>.</div>
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

      {/* ==================== OBSERVACIONES Y RECOMENDACIONES ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Observaciones y Recomendaciones</h5>

        <hr className="my-3" />

        <div className="mb-3">
          <label className="form-label fw-semibold">Observaciones</label>
          <textarea
            className="form-control"
            rows={5}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Escriba observaciones generales..."
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">Recomendaciones</label>
          <textarea
            className="form-control"
            rows={4}
            value={recomendaciones}
            onChange={(e) => setRecomendaciones(e.target.value)}
            placeholder="Escriba recomendaciones..."
          />
        </div>
      </div>

      {/* ==================== EVIDENCIAS ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Evidencias</h5>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Adjunta fotos/PDF/Excel u otros archivos.
        </div>

        <div className="mt-3 no-print">
          <input
            type="file"
            className="form-control"
            multiple
            onChange={(e) => onUploadEvidencias(Array.from(e.target.files || []))}
            disabled={subiendoEvidencias}
          />
          {subiendoEvidencias ? <div className="mt-2">Subiendo archivos...</div> : null}
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
                    {ev.tipo || "archivo"} —{" "}
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                  </div>
                </div>
                <div className="no-print">
                  {ev.signedUrl ? (
                    <a className="btn btn-outline-primary btn-sm" href={ev.signedUrl} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
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
            <div className="fw-semibold mb-2">Firma Médico Jefe</div>
            <div className="firma-box">
              {firmaMedicoJefeUrl ? (
                <img
                  src={firmaMedicoJefeUrl}
                  alt="Firma Médico Jefe"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <SignatureCanvas
                  ref={sigMedicoJefeRef}
                  penColor="black"
                  canvasProps={{ className: "firma-canvas" }}
                />
              )}
            </div>

            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigMedicoJefeRef.current?.clear()}>
                Limpiar
              </button>
              {firmaMedicoJefeUrl ? (
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    setFirmaMedicoJefeUrl(null);
                    setFirmaMedicoJefePath(null);
                  }}
                >
                  Re-firmar
                </button>
              ) : null}
            </div>
          </div>

          {/* Digitador */}
          <div className="col-12 col-md-4">
            <div className="fw-semibold mb-2">Firma Digitador</div>
            <div className="firma-box">
              {firmaDigitadorUrl ? (
                <img
                  src={firmaDigitadorUrl}
                  alt="Firma Digitador"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <SignatureCanvas ref={sigDigitadorRef} penColor="black" canvasProps={{ className: "firma-canvas" }} />
              )}
            </div>

            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigDigitadorRef.current?.clear()}>
                Limpiar
              </button>
              {firmaDigitadorUrl ? (
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    setFirmaDigitadorUrl(null);
                    setFirmaDigitadorPath(null);
                  }}
                >
                  Re-firmar
                </button>
              ) : null}
            </div>
          </div>

          {/* Auditor/Supervisor */}
          <div className="col-12 col-md-4">
            <div className="fw-semibold mb-2">Firma Auditor/Supervisor</div>
            <div className="firma-box">
              {firmaSupervisorUrl ? (
                <img
                  src={firmaSupervisorUrl}
                  alt="Firma Auditor/Supervisor"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <SignatureCanvas ref={sigSupervisorRef} penColor="black" canvasProps={{ className: "firma-canvas" }} />
              )}
            </div>

            <div className="d-flex gap-2 mt-2 no-print">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => sigSupervisorRef.current?.clear()}>
                Limpiar
              </button>
              {firmaSupervisorUrl ? (
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    setFirmaSupervisorUrl(null);
                    setFirmaSupervisorPath(null);
                  }}
                >
                  Re-firmar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ACCIONES ==================== */}
      <div className="d-flex gap-2 mt-4 no-print">
        <button className="btn btn-outline-secondary" onClick={() => navigate("/supervisiones")}>
          Volver
        </button>
        <button className="btn btn-primary" disabled={saving} onClick={guardarTodoFinalizar}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="btn btn-outline-danger" onClick={limpiarFormulario}>
          Limpiar
        </button>
        <button className="btn btn-outline-dark" onClick={imprimir}>
          Exportar / Imprimir (PDF)
        </button>
      </div>

    </div>
  );
}
