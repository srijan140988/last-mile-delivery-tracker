import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    const fallback = user.role === "CUSTOMER" ? "/customer" : user.role === "AGENT" ? "/agent" : "/admin";
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
