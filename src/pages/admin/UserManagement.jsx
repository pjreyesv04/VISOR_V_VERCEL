import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";
import ConfirmModal from "../../components/common/ConfirmModal";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal crear/editar
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", email: "", password: "", role: "auditor" });
  const [saving, setSaving] = useState(false);

  // Modal confirmar
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, user_id, nombre, role, activo, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error cargando usuarios: " + error.message);
    }
    setUsers(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ nombre: "", email: "", password: "", role: "auditor" });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setFormData({ nombre: u.nombre, email: "", password: "", role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);

    if (editingUser) {
      // Actualizar perfil existente
      const { error } = await supabase
        .from("user_profiles")
        .update({ nombre: formData.nombre, role: formData.role })
        .eq("id", editingUser.id);

      if (error) {
        toast.error("Error actualizando: " + error.message);
      } else {
        toast.success("Usuario actualizado");
        setShowModal(false);
        fetchUsers();
      }
    } else {
      // Crear nuevo usuario via Supabase Auth
      // Nota: esto requiere que el admin tenga permisos o una Edge Function
      // Por ahora usamos signUp con metadata
      if (!formData.email || !formData.password) {
        toast.error("Email y contrasena son requeridos");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { nombre: formData.nombre, role: formData.role },
        },
      });

      if (error) {
        toast.error("Error creando usuario: " + error.message);
      } else {
        // Actualizar el rol en user_profiles (el trigger crea con 'auditor' por defecto)
        if (data?.user?.id && formData.role !== "auditor") {
          await supabase
            .from("user_profiles")
            .update({ role: formData.role, nombre: formData.nombre })
            .eq("user_id", data.user.id);
        }
        toast.success("Usuario creado correctamente");
        setShowModal(false);
        fetchUsers();
      }
    }

    setSaving(false);
  };

  const toggleActivo = (u) => {
    if (u.user_id === currentUser?.id) {
      toast.error("No puedes desactivarte a ti mismo");
      return;
    }

    const action = u.activo ? "desactivar" : "activar";
    setConfirmModal({
      show: true,
      title: `${u.activo ? "Desactivar" : "Activar"} usuario`,
      message: `Seguro que deseas ${action} a "${u.nombre}"?`,
      onConfirm: async () => {
        const { error } = await supabase
          .from("user_profiles")
          .update({ activo: !u.activo })
          .eq("id", u.id);

        if (error) {
          toast.error("Error: " + error.message);
        } else {
          toast.success(`Usuario ${action === "desactivar" ? "desactivado" : "activado"}`);
          fetchUsers();
        }
        setConfirmModal({ show: false });
      },
    });
  };

  const roleBadge = (role) => {
    const map = { admin: "bg-warning text-dark", auditor: "bg-primary", viewer: "bg-success" };
    return map[role] || "bg-secondary";
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Gestion de Usuarios</h4>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nuevo Usuario
        </button>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Fecha Registro</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={!u.activo ? "table-secondary" : ""}>
                      <td>{u.nombre}</td>
                      <td>
                        <span className={`badge ${roleBadge(u.role)}`}>{u.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.activo ? "bg-success" : "bg-danger"}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(u)}>
                            Editar
                          </button>
                          <button
                            className={`btn btn-sm ${u.activo ? "btn-outline-danger" : "btn-outline-success"}`}
                            onClick={() => toggleActivo(u)}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
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

      {/* Modal Crear/Editar */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre</label>
                    <input
                      className="form-control"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>

                  {!editingUser && (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Correo electronico</label>
                        <input
                          type="email"
                          className="form-control"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Contrasena</label>
                        <input
                          type="password"
                          className="form-control"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Rol</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="auditor">Auditor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false })}
      />
    </div>
  );
}
