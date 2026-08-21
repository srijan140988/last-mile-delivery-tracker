import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, EmptyState, Select, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import type { AgentSummary, Order, Zone } from "../../types";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [filters, setFilters] = useState({ status: "", zone: "", agentId: "" });

  async function load() {
    const [ordersRes, zonesRes, agentsRes] = await Promise.all([
      api.get("/orders", {
        params: {
          status: filters.status || undefined,
          zone: filters.zone || undefined,
          agentId: filters.agentId || undefined,
          pageSize: 50,
        },
      }),
      api.get("/zones"),
      api.get("/agents"),
    ]);
    setOrders(ordersRes.data.orders);
    setZones(zonesRes.data);
    setAgents(agentsRes.data);
  }

  useEffect(() => {
    load().catch(() => setOrders([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">All orders</h1>
        <div className="flex flex-wrap gap-2">
          <Select className="w-40" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RESCHEDULED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Select className="w-40" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <Select className="w-40" value={filters.agentId} onChange={(e) => setFilters({ ...filters, agentId: e.target.value })}>
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.user.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        {orders === null ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Order #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Agent</th>
                  <th className="px-5 py-3 font-medium">Charge</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{o.customer?.user.name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {o.pickupZone?.name} → {o.dropZone?.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {o.assignments?.find((a) => a.status === "ACTIVE")?.agent?.user.name ?? "Unassigned"}
                    </td>
                    <td className="px-5 py-3 text-slate-900 font-medium">₹{o.totalCharge.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
