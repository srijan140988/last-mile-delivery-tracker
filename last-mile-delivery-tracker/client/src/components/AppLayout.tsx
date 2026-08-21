import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const NAV: Record<string, { to: string; label: string }[]> = {
  CUSTOMER: [
    { to: "/customer", label: "Dashboard" },
    { to: "/customer/orders/new", label: "Create Order" },
    { to: "/customer/orders", label: "My Orders" },
    { to: "/customer/profile", label: "Profile" },
  ],
  AGENT: [
    { to: "/agent", label: "Dashboard" },
    { to: "/agent/deliveries", label: "Assigned Deliveries" },
    { to: "/agent/availability", label: "Availability" },
  ],
  ADMIN: [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/agents", label: "Agents" },
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/zones", label: "Zones" },
    { to: "/admin/areas", label: "Areas" },
    { to: "/admin/rates", label: "Rate Cards" },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const links = NAV[user.role] ?? [];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed md:static z-40 inset-y-0 left-0 w-64 bg-ink-950 text-slate-200 flex flex-col transform transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white">L</div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">LastMile</p>
            <p className="text-[11px] text-slate-400">Delivery Tracker</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/customer" || l.to === "/agent" || l.to === "/admin"}
              onClick={() => setOpen(false)}
              className={({ isActive }: { isActive: boolean }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-2 py-2 mb-1">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <button className="md:hidden rounded-lg p-2 hover:bg-slate-100" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div className="hidden md:block" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{user.role} portal</span>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
