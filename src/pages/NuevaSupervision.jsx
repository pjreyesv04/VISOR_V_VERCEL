import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function NuevaSupervision() {
  const nav = useNavigate();
  const [ris, setRis] = useState([]);
  const [eess, setEess] = useState([]);
  const [digitadores, setDigitadores] = useState([]);

  const [risId, setRisId] = useState("");
  const [eessId, setEessId] = useState("");
  const [digitadorId, setDigitadorId] = useState("");

  // Usar fecha local sin conversión de zona horaria
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [fecha, setFecha] = useState(getLocalDate());
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("ris").select("id,nombre").order("nombre")
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setRis(data || []);
      });
  }, []);

  useEffect(() => {
    if (!risId) { setEess([]); setEessId(""); return; }
    supabase.from("establecimientos").select("id,nombre").eq("ris_id", risId).order("nombre")
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setEess(data || []);
      });
  }, [risId]);

  // Cargar digitadores al seleccionar establecimiento
  useEffect(() => {
    if (!eessId) { setDigitadores([]); setDigitadorId(""); return; }
    supabase
      .from("digitadores")
      .select("id, apellidos_nombres")
      .eq("establecimiento_id", eessId)
      .eq("activo", true)
      .order("apellidos_nombres")
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        const list = data || [];
        setDigitadores(list);
        // Auto-seleccionar si solo hay uno
        if (list.length === 1) setDigitadorId(list[0].id);
        else setDigitadorId("");
      });
  }, [eessId]);

  const crear = async () => {
    setErr("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return setErr("Sesión no válida");

    // Obtener nombre del digitador seleccionado para guardar como texto también
    const digitadorSeleccionado = digitadores.find(d => d.id === digitadorId);

    const { data, error } = await supabase
      .from("supervisiones")
      .insert([{
        auditor_id: user.id,
        ris_id: risId,
        establecimiento_id: eessId,
        digitador_id: digitadorId || null,
        digitador: digitadorSeleccionado?.apellidos_nombres || null,
        fecha,
        hora_inicio: new Date().toISOString(),
        estado: "borrador",
        tipo: "general"  // Supervisión de Médico Auditor
      }])
      .select("id")
      .single();

    if (error) return setErr(error.message);
    nav(`/supervision/${data.id}`);
  };

  return (
    <div className="container py-4" style={{ maxWidth: 900 }}>
      <h4>Nueva supervisión</h4>

      <div className="row mt-3 g-3">
        <div className="col-md-4">
          <label className="form-label">RIS</label>
          <select className="form-select" value={risId} onChange={(e) => setRisId(e.target.value)}>
            <option value="">Seleccione...</option>
            {ris.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        <div className="col-md-5">
          <label className="form-label">Establecimiento</label>
          <select className="form-select" value={eessId} onChange={(e) => setEessId(e.target.value)} disabled={!risId}>
            <option value="">Seleccione...</option>
            {eess.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Fecha</label>
          <input type="date" className="form-control" value={fecha} readOnly disabled style={{ backgroundColor: "#e9ecef" }} />
        </div>

        {/* Selector de digitador(es) */}
        <div className="col-md-12">
          <label className="form-label">Digitador del Establecimiento</label>
          <select
            className="form-select"
            value={digitadorId}
            onChange={(e) => setDigitadorId(e.target.value)}
            disabled={!eessId || digitadores.length === 0}
          >
            <option value="">
              {!eessId
                ? "Seleccione establecimiento primero..."
                : digitadores.length === 0
                  ? "(Sin digitadores registrados)"
                  : "Seleccione digitador..."}
            </option>
            {digitadores.map(d => (
              <option key={d.id} value={d.id}>{d.apellidos_nombres}</option>
            ))}
          </select>
          {eessId && digitadores.length > 1 && (
            <small className="text-muted">{digitadores.length} digitador(es) disponibles</small>
          )}
        </div>
      </div>

      {err && <div className="alert alert-danger mt-3">{err}</div>}

      <button className="btn btn-primary mt-3" disabled={!risId || !eessId} onClick={crear}>
        Crear y continuar
      </button>
    </div>
  );
}
