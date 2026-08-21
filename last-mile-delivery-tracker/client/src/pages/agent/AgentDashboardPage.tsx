import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Card, Spinner } from "../../components/ui";
import type { AgentSummary, Order } from "../../types";

export default function AgentDashboardPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<AgentSummary | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.get("/agents/me").then((res) => setMe(res.data)).catch(() => setMe(null));
    api
      .get("/orders")
      .then((res) => setOrders(res.data.orders))
      .catch(() => setOrders([]));
  }, []);

  const active = orders?.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length ?? 0;
  const delivered = orders?.filter((o) => o.status === "DELIVERED").length ?? 0;

  if (!orders) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hi, {user?.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Your delivery summary for today.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Active deliveries</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{active}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Delivered</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{delivered}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Availability</p>
          <p className={`text-lg font-semibold mt-1 ${me?.isAvailable ? "text-emerald-600" : "text-amber-600"}`}>
            {me ? (me.isAvailable ? "Available" : "Busy") : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
