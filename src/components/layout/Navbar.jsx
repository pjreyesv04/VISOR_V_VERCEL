import { useAuth } from "../../hooks/useAuth";
import { BiMenu, BiLogOut } from "react-icons/bi";

export default function Navbar({ onToggleSidebar }) {
  const { user, profile, role, signOut } = useAuth();

  return (
    <div className="app-navbar">
      <div className="d-flex align-items-center gap-3">
        <button className="hamburger-btn" onClick={onToggleSidebar}>
          <BiMenu />
        </button>
      </div>

      <div className="user-info">
        <span className="d-none d-sm-inline text-muted" style={{ fontSize: "0.875rem" }}>
          {profile?.nombre || user?.email || ""}
        </span>
        <span className={`role-badge ${role || ""}`}>
          {role || "---"}
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={signOut} title="Cerrar sesion">
          <BiLogOut />
        </button>
      </div>
    </div>
  );
}
