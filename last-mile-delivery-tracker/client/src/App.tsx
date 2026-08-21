import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import LoginPage from "./pages/public/LoginPage";
import RegisterPage from "./pages/public/RegisterPage";

import CustomerDashboardPage from "./pages/customer/CustomerDashboardPage";
import CreateOrderPage from "./pages/customer/CreateOrderPage";
import CustomerOrdersPage from "./pages/customer/CustomerOrdersPage";
import CustomerOrderDetailPage from "./pages/customer/CustomerOrderDetailPage";
import CustomerProfilePage from "./pages/customer/CustomerProfilePage";

import AgentDashboardPage from "./pages/agent/AgentDashboardPage";
import AgentDeliveriesPage from "./pages/agent/AgentDeliveriesPage";
import AgentDeliveryDetailPage from "./pages/agent/AgentDeliveryDetailPage";
import AgentAvailabilityPage from "./pages/agent/AgentAvailabilityPage";

import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminOrderDetailPage from "./pages/admin/AdminOrderDetailPage";
import AdminAgentsPage from "./pages/admin/AdminAgentsPage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import AdminZonesPage from "./pages/admin/AdminZonesPage";
import AdminAreasPage from "./pages/admin/AdminAreasPage";
import AdminRatesPage from "./pages/admin/AdminRatesPage";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "CUSTOMER") return <Navigate to="/customer" replace />;
  if (user.role === "AGENT") return <Navigate to="/agent" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/customer"
              element={
                <ProtectedRoute role="CUSTOMER">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CustomerDashboardPage />} />
              <Route path="orders/new" element={<CreateOrderPage />} />
              <Route path="orders" element={<CustomerOrdersPage />} />
              <Route path="orders/:id" element={<CustomerOrderDetailPage />} />
              <Route path="profile" element={<CustomerProfilePage />} />
            </Route>

            <Route
              path="/agent"
              element={
                <ProtectedRoute role="AGENT">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AgentDashboardPage />} />
              <Route path="deliveries" element={<AgentDeliveriesPage />} />
              <Route path="deliveries/:id" element={<AgentDeliveryDetailPage />} />
              <Route path="availability" element={<AgentAvailabilityPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute role="ADMIN">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="agents" element={<AdminAgentsPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="zones" element={<AdminZonesPage />} />
              <Route path="areas" element={<AdminAreasPage />} />
              <Route path="rates" element={<AdminRatesPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
