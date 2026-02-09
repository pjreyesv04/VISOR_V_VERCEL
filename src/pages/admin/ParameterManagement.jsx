import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

export default function ParameterManagement() {
  const [parametros, setParametros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeccion, setFilterSeccion] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    seccion: "",
    codigo: "",
    descripcion: "",
    requiere_observacion: true,
    orden: 0,
    activo: true,
    tipo_campo_condicional: "",
    condicion_campo: "",
    etiqueta_campo_condicional: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parametros")
      .select("*")
      .order("seccion", { ascending: true })
      .order("orden", { ascending: true });

    if (error) toast.error("Error: " + error.message);
    setParametros(data || []);
    setLoading(false);
  };

  const secciones = [...new Set(parametros.map((p) => p.seccion || "SIN_SECCION"))];

  const filtered = filterSeccion
    ? parametros.filter((p) => (p.seccion || "SIN_SECCION") === filterSeccion)
    : parametros;

  const openCreate = () => {
    setEditing(null);
    setFormData({ seccion: "", codigo: "", descripcion: "", requiere_observacion: true, orden: 0, activo: true, tipo_campo_condicional: "", condicion_campo: "", etiqueta_campo_condicional: "" });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setFormData({
      seccion: p.seccion || "",
      codigo: p.codigo || "",
      descripcion: p.descripcion || "",
      requiere_observacion: p.requiere_observacion ?? true,
      orden: p.orden || 0,
      activo: p.activo !== false,
      tipo_campo_condicional: p.tipo_campo_condicional || "",
      condicion_campo: p.condicion_campo || "",
      etiqueta_campo_condicional: p.etiqueta_campo_condicional || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.descripcion.trim()) {
      toast.error("La descripcion es requerida");
      return;
    }

    setSaving(true);

    const payload = {
      seccion: formData.seccion || null,
      codigo: formData.codigo || null,
      descripcion: formData.descripcion,
      requiere_observacion: formData.requiere_observacion,
      orden: formData.orden,
      activo: formData.activo,
      tipo_campo_condicional: formData.tipo_campo_condicional || null,
      condicion_campo: formData.condicion_campo || null,
      etiqueta_campo_condicional: formData.etiqueta_campo_condicional || null,
    };

    if (editing) {
      const { error } = await supabase.from("parametros").update(payload).eq("id", editing.id);
      if (error) {
        toast.error("Error: " + error.message);
      } else {
        toast.success("Parametro actualizado");
        setShowModal(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("parametros").insert([payload]);
      if (error) {
        toast.error("Error: " + error.message);
      } else {
        toast.success("Parametro creado");
        setShowModal(false);
        fetchData();
      }
    }

    setSaving(false);
  };

  const toggleActivo = async (p) => {
    const { error } = await supabase.from("parametros").update({ activo: !p.activo }).eq("id", p.id);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(p.activo ? "Parametro desactivado" : "Parametro activado");
      fetchData();
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestion de Parametros</h4>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nuevo Parametro
        </button>
      </div>

      {/* Filtro por seccion */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0" style={{ fontSize: "0.85rem" }}>Seccion:</label>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 300 }}
              value={filterSeccion}
              onChange={(e) => setFilterSeccion(e.target.value)}
            >
              <option value="">Todas ({parametros.length})</option>
              {secciones.map((s) => (
                <option key={s} value={s}>
                  {s} ({parametros.filter((p) => (p.seccion || "SIN_SECCION") === s).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-4 text-muted">No hay parametros</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{ fontSize: "0.875rem" }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>Orden</th>
                    <th style={{ width: 80 }}>Codigo</th>
                    <th>Seccion</th>
                    <th>Descripcion</th>
                    <th style={{ width: 80 }}>Obs.</th>
                    <th style={{ width: 120 }}>Tipo Campo</th>
                    <th style={{ width: 80 }}>Estado</th>
                    <th className="text-end" style={{ width: 150 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className={!p.activo ? "table-secondary" : ""}>
                      <td>{p.orden}</td>
                      <td>{p.codigo || "—"}</td>
                      <td>{p.seccion || "—"}</td>
                      <td>{p.descripcion}</td>
                      <td>{p.requiere_observacion ? "Si" : "No"}</td>
                      <td>
                        {p.tipo_campo_condicional ? (
                          <span className="badge bg-info text-dark">
                            {p.tipo_campo_condicional} ({p.condicion_campo || "?"})
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`badge ${p.activo ? "bg-success" : "bg-danger"}`}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(p)}>
                            Editar
                          </button>
                          <button
                            className={`btn btn-sm ${p.activo ? "btn-outline-danger" : "btn-outline-success"}`}
                            onClick={() => toggleActivo(p)}
                          >
                            {p.activo ? "Desact." : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">{editing ? "Editar Parametro" : "Nuevo Parametro"}</h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Seccion</label>
                      <input
                        className="form-control"
                        value={formData.seccion}
                        onChange={(e) => setFormData({ ...formData, seccion: e.target.value })}
                        placeholder="Ej: INFRAESTRUCTURA"
                        list="secciones-list"
                      />
                      <datalist id="secciones-list">
                        {secciones.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Codigo</label>
                      <input
                        className="form-control"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        placeholder="Ej: 1.1"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Orden</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.orden}
                        onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="form-label">Descripcion</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Descripcion del parametro a evaluar..."
                    />
                  </div>

                  <div className="mt-3 d-flex gap-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={formData.requiere_observacion}
                        onChange={(e) => setFormData({ ...formData, requiere_observacion: e.target.checked })}
                        id="reqObs"
                      />
                      <label className="form-check-label" htmlFor="reqObs">Requiere observacion</label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                        id="activo"
                      />
                      <label className="form-check-label" htmlFor="activo">Activo</label>
                    </div>
                  </div>

                  {/* Campo condicional */}
                  <div className="mt-3">
                    <label className="form-label fw-semibold">Campo condicional</label>
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: "0.8rem" }}>Tipo de campo</label>
                        <select
                          className="form-select form-select-sm"
                          value={formData.tipo_campo_condicional}
                          onChange={(e) => setFormData({ ...formData, tipo_campo_condicional: e.target.value })}
                        >
                          <option value="">Ninguno (solo Si/No)</option>
                          <option value="fecha">Fecha</option>
                          <option value="cantidad">Cantidad (numero)</option>
                          <option value="texto">Texto (nombre)</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: "0.8rem" }}>Mostrar cuando</label>
                        <select
                          className="form-select form-select-sm"
                          value={formData.condicion_campo}
                          onChange={(e) => setFormData({ ...formData, condicion_campo: e.target.value })}
                          disabled={!formData.tipo_campo_condicional}
                        >
                          <option value="">--</option>
                          <option value="si">Respuesta es Si</option>
                          <option value="no">Respuesta es No</option>
                          <option value="siempre">Siempre visible</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: "0.8rem" }}>Etiqueta del campo</label>
                        <input
                          className="form-control form-control-sm"
                          value={formData.etiqueta_campo_condicional}
                          onChange={(e) => setFormData({ ...formData, etiqueta_campo_condicional: e.target.value })}
                          placeholder="Ej: Fecha de capacitacion"
                          disabled={!formData.tipo_campo_condicional}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
