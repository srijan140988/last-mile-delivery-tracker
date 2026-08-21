import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import type { Order } from "../../types";

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api
      .get("/orders", { params: { pageSize: 5 } })
      .then((res) => setOrders(res.data.orders))
      .catch(() => setOrders([]));
  }, []);

  const active = orders?.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length ?? 0;
  const delivered = orders?.filter((o) => o.status === "DELIVERED").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user?.name.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">Here's what's happening with your shipments.</p>
        </div>
        <Link to="/customer/orders/new">
          <Button>+ Create order</Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Active orders" value={active} />
        <StatCard label="Delivered" value={delivered} />
        <StatCard label="Total shown" value={orders?.length ?? 0} />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
          <Link to="/customer/orders" className="text-sm text-brand-600 font-medium hover:underline">
            View all
          </Link>
        </div>
        {orders === null ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" subtitle="Create your first delivery order to get started." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {orders.map((o) => (
              <li key={o.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <Link to={`/customer/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="text-sm text-slate-500">
                  {o.pickupZone?.name} → {o.dropZone?.name}
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
    </Card>
  );
}
