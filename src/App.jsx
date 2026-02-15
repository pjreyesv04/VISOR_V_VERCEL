import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Layout from "./components/layout/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NuevaSupervision from "./pages/NuevaSupervision";
import SupervisionForm from "./pages/SupervisionForm";
import SupervisionList from "./pages/SupervisionList";
import SupervisionView from "./pages/SupervisionView";

// Admin
import UserManagement from "./pages/admin/UserManagement";
import ParameterManagement from "./pages/admin/ParameterManagement";
import RisManagement from "./pages/admin/RisManagement";
import EstablishmentManagement from "./pages/admin/EstablishmentManagement";
import DigitadorManagement from "./pages/admin/DigitadorManagement";

// Supervisión Informática
import NuevaSupervisionInformatica from "./pages/NuevaSupervisionInformatica";
import SupervisionInformaticaForm from "./pages/SupervisionInformaticaForm";
import SupervisionInformaticaList from "./pages/SupervisionInformaticaList";
import SupervisionInformaticaView from "./pages/SupervisionInformaticaView";

// Reportes
import ReportDashboard from "./pages/reports/ReportDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas con Layout */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["admin", "auditor", "viewer", "supervisor_informatico"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />

            <Route
              path="nueva-supervision"
              element={
                <ProtectedRoute allowedRoles={["admin", "auditor"]}>
                  <NuevaSupervision />
                </ProtectedRoute>
              }
            />

            <Route path="supervisiones" element={<SupervisionList />} />

            <Route
              path="supervision/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "auditor"]}>
                  <SupervisionForm />
                </ProtectedRoute>
              }
            />

            <Route path="supervision/:id/ver" element={<SupervisionView />} />

            {/* Supervisión Informática */}
            <Route
              path="nueva-supervision-informatica"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor_informatico"]}>
                  <NuevaSupervisionInformatica />
                </ProtectedRoute>
              }
            />

            <Route
              path="supervisiones-informatica"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor_informatico", "viewer"]}>
                  <SupervisionInformaticaList />
                </ProtectedRoute>
              }
            />

            <Route
              path="supervision-informatica/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor_informatico"]}>
                  <SupervisionInformaticaForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="supervision-informatica/:id/ver"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor_informatico", "viewer"]}>
                  <SupervisionInformaticaView />
                </ProtectedRoute>
              }
            />

            <Route
              path="reportes"
              element={
                <ProtectedRoute allowedRoles={["admin", "viewer"]}>
                  <ReportDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="admin/usuarios"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/parametros"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ParameterManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/ris"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <RisManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/establecimientos"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <EstablishmentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/digitadores"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <DigitadorManagement />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
