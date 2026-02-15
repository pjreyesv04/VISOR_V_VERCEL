import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  BiHomeAlt,
  BiPlusCircle,
  BiListUl,
  BiBarChartAlt2,
  BiGroup,
  BiTask,
  BiBuildings,
  BiMapAlt,
  BiIdCard,
  BiDesktop,
  BiAddToQueue,
} from "react-icons/bi";

const menuItems = [
  {
    section: "Principal",
    items: [
      { to: "/", icon: BiHomeAlt, label: "Dashboard", roles: ["admin", "auditor", "viewer", "supervisor_informatico"] },
      { to: "/nueva-supervision", icon: BiPlusCircle, label: "Nueva Supervisión Médica", roles: ["admin", "auditor"] },
      { to: "/supervisiones", icon: BiListUl, label: "Supervisiones Médicas", roles: ["admin", "auditor", "viewer"] },
      { to: "/reportes", icon: BiBarChartAlt2, label: "Reportes", roles: ["admin", "viewer"] },
    ],
  },
  {
    section: "Supervisión Informática",
    items: [
      { to: "/nueva-supervision-informatica", icon: BiAddToQueue, label: "Nueva Supervisión IT", roles: ["admin", "supervisor_informatico"] },
      { to: "/supervisiones-informatica", icon: BiDesktop, label: "Supervisiones IT", roles: ["admin", "supervisor_informatico", "viewer"] },
    ],
  },
  {
    section: "Administracion",
    roles: ["admin"],
    items: [
      { to: "/admin/usuarios", icon: BiGroup, label: "Usuarios", roles: ["admin"] },
      { to: "/admin/parametros", icon: BiTask, label: "Parametros", roles: ["admin"] },
      { to: "/admin/ris", icon: BiMapAlt, label: "RIS", roles: ["admin"] },
      { to: "/admin/establecimientos", icon: BiBuildings, label: "Establecimientos", roles: ["admin"] },
      { to: "/admin/digitadores", icon: BiIdCard, label: "Digitadores", roles: ["admin"] },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const { role } = useAuth();

  return (
    <>
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={onClose} />

      <aside className={`app-sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <img src="/logo.svg" alt="V.I.S.O.R Logo" className="sidebar-logo" width="40" height="40" style={{ marginRight: "10px" }} />
          <div>
            <h5>SPVS Auditores</h5>
            <small>Sistema de Supervision</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((section) => {
            if (section.roles && !section.roles.includes(role)) return null;

            const visibleItems = section.items.filter((item) => item.roles.includes(role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <div className="sidebar-divider" />
                <div className="sidebar-section">{section.section}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                    onClick={onClose}
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <small className="text-muted">v1.0.0</small>
        </div>
      </aside>
    </>
  );
}
