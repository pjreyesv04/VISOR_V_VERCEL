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

export default function SupervisionForm() {
  const { id } = useParams(); // /supervision/:id
  const supervisionId = id;
  const navigate = useNavigate();
  const { user } = useAuth(); // Obtener usuario actual para auditoría

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sessionUser, setSessionUser] = useState(null);

  // Cabecera (solo lectura en pantalla, se guarda en supervisiones)
  const [correlativo, setCorrelativo] = useState(null);
  const [risNombre, setRisNombre] = useState("");
  const [establecimientoNombre, setEstablecimientoNombre] = useState("");

  const [fechaTxt, setFechaTxt] = useState("");       // para imprimir bonito
  const [horaInicioTxt, setHoraInicioTxt] = useState(""); // para imprimir bonito
  const [horaFinTxt, setHoraFinTxt] = useState("");   // para imprimir bonito

  const [medicoJefeNombre, setMedicoJefeNombre] = useState("");
  const [digitadorNombre, setDigitadorNombre] = useState("");

  // Observaciones globales
  const [observaciones, setObservaciones] = useState("");
  const [lecturaDrive, setLecturaDrive] = useState("");

  // Parámetros (dinámicos) -> SOLO SI/NO
  const [parametros, setParametros] = useState([]);
  const [respuestas, setRespuestas] = useState({}); 
  // respuestas[parametro_id] = { valor_bool: true/false/null, observacion: "" }

  // Firmas (al final)
  const sigSupervisorRef = useRef(null);
  const sigDigitadorRef = useRef(null);
  const sigMedicoJefeRef = useRef(null);

  // Firmas guardadas (paths)
  const [firmaSupervisorPath, setFirmaSupervisorPath] = useState(null);
  const [firmaDigitadorPath, setFirmaDigitadorPath] = useState(null);
  const [firmaMedicoJefePath, setFirmaMedicoJefePath] = useState(null);

  // Firmas para mostrar (signed url)
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

  const nowAsText = () => {
    const now = new Date();
    return {
      fecha: now.toLocaleDateString(),
      hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      iso: now.toISOString(),
    };
  };

  // Formatear fecha ISO a formato local DD/MM/YYYY evitando desfases de zona horaria
  const formatFechaISO = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const setResp = (paramId, patch) => {
    setRespuestas((prev) => {
      const current = prev[paramId] || { valor_bool: null, observacion: "" };
      return { ...prev, [paramId]: { ...current, ...patch } };
    });
  };

  const refreshFirmasSignedUrls = async (pSup, pDig, pJefe) => {
    // bucket privado -> signed url
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
  // CARGA INICIAL + AUTO HORA INICIO ACTUAL
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
          "id,auditor_id,ris_id,establecimiento_id,correlativo,fecha,hora_inicio,hora_fin,medico_jefe,digitador,observaciones,lectura_drive,firma_url,firma_digitador_url,firma_medico_jefe_url"
        )
        .eq("id", supervisionId)
        .single();

      if (supErr) {
        toast.error("Error cargando supervision: " + supErr.message);
        setLoading(false);
        return;
      }

      // 2) Si NO hay hora_inicio, se asigna AHORA (automático)
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

      // 3) Set textos para imprimir
      setFechaTxt(formatFechaISO(fechaISO || new Date().toISOString()));
      setHoraInicioTxt(new Date(horaInicioISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

      if (sup.hora_fin) {
        setHoraFinTxt(new Date(sup.hora_fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        setHoraFinTxt(""); // todavía no finaliza
      }

      setCorrelativo(sup.correlativo ?? null);

      setMedicoJefeNombre(sup.medico_jefe || "");
      setDigitadorNombre(sup.digitador || "");

      setObservaciones(sup.observaciones || "");
      setLecturaDrive(sup.lectura_drive || "");

      setFirmaSupervisorPath(sup.firma_url || null);
      setFirmaDigitadorPath(sup.firma_digitador_url || null);
      setFirmaMedicoJefePath(sup.firma_medico_jefe_url || null);

      // 4) Correlativo por auditor (si no tiene)
      if (sup.correlativo == null) {
        const { count } = await supabase
          .from("supervisiones")
          .select("id", { count: "exact", head: true })
          .eq("auditor_id", user.id);

        const next = (count || 0) + 1;
        setCorrelativo(next);
        await supabase.from("supervisiones").update({ correlativo: next }).eq("id", supervisionId);
      }

      // 5) Nombre RIS / EESS
      const { data: ris } = await supabase.from("ris").select("nombre").eq("id", sup.ris_id).single();
      setRisNombre(ris?.nombre || "");

      const { data: est } = await supabase
        .from("establecimientos")
        .select("nombre")
        .eq("id", sup.establecimiento_id)
        .single();
      setEstablecimientoNombre(est?.nombre || "");

      // 6) Parámetros
      const { data: params, error: pErr } = await supabase
        .from("parametros")
        .select("id,seccion,codigo,descripcion,requiere_observacion,orden,activo")
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true });

      if (pErr) toast.error("Error cargando parametros: " + pErr.message);
      setParametros(params || []);

      // 7) Respuestas existentes
      const { data: resp } = await supabase
        .from("respuestas")
        .select("parametro_id,valor_bool,observacion")
        .eq("supervision_id", supervisionId);

      const map = {};
      (resp || []).forEach((r) => {
        map[r.parametro_id] = {
          valor_bool: r.valor_bool ?? null,
          observacion: r.observacion ?? "",
        };
      });
      setRespuestas(map);

      // 8) Evidencias + firmas (signed urls)
      await refreshEvidencias();
      await refreshFirmasSignedUrls(sup.firma_url, sup.firma_digitador_url, sup.firma_medico_jefe_url);

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisionId]);

  // =========================
  // SUBIR FIRMA (se guarda en supervisiones)
  // =========================
  const subirFirma = async (tipo) => {
    // tipo: "supervisor" | "digitador" | "medico_jefe"
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

      // Mostrar toast de registro
      const toastId = toast.loading("Registrando cambios... Acción siendo auditada");

      // Insertar registro de auditoría
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
        toast.success(
          "Cambios registrados y auditados exitosamente",
          { id: toastId }
        );
      }
    } catch (e) {
      console.error("Exception en registrarAuditoria:", e.message);
      toast.error("Error de auditoría: " + (e?.message || e));
    }
  };

  // =========================
  // GUARDAR TODO (finaliza: pone hora_fin = AHORA)
  // =========================
  const guardarTodoFinalizar = async () => {
    try {
      setSaving(true);

      // 1) Hora fin = AHORA
      const fin = nowAsText();
      setHoraFinTxt(fin.hora);

      // 2) Guardar cabecera + observaciones + hora_fin
      const { error: supErr } = await supabase
        .from("supervisiones")
        .update({
          medico_jefe: medicoJefeNombre || null,
          digitador: digitadorNombre || null,
          observaciones: observaciones || null,
          lectura_drive: lecturaDrive || null,
          hora_fin: fin.iso,
          estado: "completado",
        })
        .eq("id", supervisionId);

      if (supErr) throw supErr;

      // 3) Guardar respuestas (solo si/no y observación por parámetro)
      const rows = Object.entries(respuestas).map(([parametro_id, r]) => ({
        supervision_id: supervisionId,
        parametro_id,
        valor_bool: r.valor_bool ?? null,
        observacion: r.observacion ?? null,
      }));

      if (rows.length > 0) {
        const { error: rErr } = await supabase
          .from("respuestas")
          .upsert(rows, { onConflict: "supervision_id,parametro_id" });

        if (rErr) throw rErr;
      }

      // 4) Registrar en auditoría
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

  const imprimir = () => window.print();

  const renderParametroSiNo = (p) => {
    const r = respuestas[p.id] || { valor_bool: null, observacion: "" };

    return (
      <div className="mb-3" key={p.id}>
        <div className="fw-semibold">
          {p.codigo ? `${p.codigo}. ` : ""}
          {p.descripcion}
        </div>

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

        {/* Observación por ítem (si el parámetro lo pide) */}
        {p.requiere_observacion ? (
          <div className="mt-2">
            <label className="form-label">Observación</label>
            <textarea
              className="form-control"
              rows={3}
              value={r.observacion || ""}
              onChange={(e) => setResp(p.id, { observacion: e.target.value })}
              placeholder="Detalle / sustento..."
            />
          </div>
        ) : null}
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
      {/* ==================== CABECERA (IMPRIMIBLE) ==================== */}
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
            <input
              className="form-control"
              value={digitadorNombre}
              onChange={(e) => setDigitadorNombre(e.target.value)}
              placeholder="Apellidos y nombres"
            />
          </div>
        </div>
      </div>

      {/* ==================== SECCIONES DINÁMICAS (SOLO SI/NO) ==================== */}
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

      {/* ==================== OBSERVACIONES + LECTURA DRIVE ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Observaciones</h5>
        <div className="text-muted" style={{ fontSize: 13 }}>
          (Incluye “Lectura de Drive” como textarea)
        </div>

        <hr className="my-3" />

        <div className="mb-3">
          <label className="form-label fw-semibold">Observación general</label>
          <textarea
            className="form-control"
            rows={5}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Escriba observaciones generales..."
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">Lectura de Drive</label>
          <textarea
            className="form-control"
            rows={4}
            value={lecturaDrive}
            onChange={(e) => setLecturaDrive(e.target.value)}
            placeholder="Detalle de lectura/validación en Drive..."
          />
        </div>

        {/* Firma del Médico Jefe (aquí, como pediste) */}
        <div className="mt-3">
          <div className="fw-semibold mb-2">Firma del Médico Jefe</div>
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
            <button className="btn btn-success btn-sm" disabled={saving} onClick={() => subirFirma("medico_jefe")}>
              Guardar firma Médico Jefe
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

      {/* ==================== FIRMAS (AL FINAL) ==================== */}
      <div className="acta-box p-3 mb-4">
        <h5 className="m-0">Firmas</h5>
        <div className="text-muted" style={{ fontSize: 13 }}>
          (Supervisor y Digitador al final del acta)
        </div>

        <hr className="my-3" />

        <div className="row g-3">
          <div className="col-md-6">
            <div className="fw-semibold mb-2">Firma Médico Supervisor</div>
            <div className="firma-box">
              {firmaSupervisorUrl ? (
                <img
                  src={firmaSupervisorUrl}
                  alt="Firma Supervisor"
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
              <button className="btn btn-success btn-sm" disabled={saving} onClick={() => subirFirma("supervisor")}>
                Guardar firma Supervisor
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

          <div className="col-md-6">
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
              <button className="btn btn-success btn-sm" disabled={saving} onClick={() => subirFirma("digitador")}>
                Guardar firma Digitador
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
        <button className="btn btn-outline-dark" onClick={imprimir}>
          Exportar / Imprimir (PDF)
        </button>
      </div>

    </div>
  );
}
