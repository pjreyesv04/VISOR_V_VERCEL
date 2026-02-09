import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

export default function RisManagement() {
  const [risList, setRisList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Traer RIS
    const { data, error } = await supabase
      .from("ris")
      .select("id, nombre")
      .order("nombre");

    if (error) toast.error("Error: " + error.message);

    setRisList(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setNombre("");
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setNombre(r.nombre);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setSaving(true);

    if (editing) {
      const { error } = await supabase.from("ris").update({ nombre: nombre.trim() }).eq("id", editing.id);
      if (error) {
        toast.error("Error: " + error.message);
      } else {
        toast.success("RIS actualizado");
        setShowModal(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("ris").insert([{ nombre: nombre.trim() }]);
      if (error) {
        toast.error("Error: " + error.message);
      } else {
        toast.success("RIS creado");
        setShowModal(false);
        fetchData();
      }
    }

    setSaving(false);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestion de RIS</h4>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nuevo RIS
        </button>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          ) : risList.length === 0 ? (
            <div className="text-center p-4 text-muted">No hay RIS registrados</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {risList.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(r)}>
                          Editar
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

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">{editing ? "Editar RIS" : "Nuevo RIS"}</h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-control"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre del RIS"
                  />
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
