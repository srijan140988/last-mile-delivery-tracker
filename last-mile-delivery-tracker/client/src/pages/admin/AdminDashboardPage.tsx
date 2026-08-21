import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, EmptyState, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import type { Order } from "../../types";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .get("/orders", { params: { pageSize: 8 } })
      .then((res) => setOrders(res.data.orders))
      .catch(() => setOrders([]));
    api
      .get("/agents")
      .then((res) => setAgentCount(res.data.length))
      .catch(() => setAgentCount(0));
    api
      .get("/admin/customers")
      .then((res) => setCustomerCount(res.data.length))
      .catch(() => setCustomerCount(0));
  }, []);

  const failed = orders?.filter((o) => o.status === "FAILED").length ?? 0;
  const inTransit = orders?.filter((o) => ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(o.status)).length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Operations overview</h1>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Active agents" value={agentCount} />
        <StatCard label="Customers" value={customerCount} />
        <StatCard label="In transit" value={inTransit} />
        <StatCard label="Failed deliveries" value={failed} accent="text-red-600" />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm text-brand-600 font-medium hover:underline">
            View all orders
          </Link>
        </div>
        {orders === null ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <ul className="divide-y divide-slate-50">
            {orders.map((o) => (
              <li key={o.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <Link to={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="text-sm text-slate-500">{o.customer?.user.name}</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | null; accent?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${accent ?? "text-slate-900"}`}>{value ?? "—"}</p>
    </Card>
  );
}
