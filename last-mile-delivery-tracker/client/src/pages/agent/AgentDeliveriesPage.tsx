import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, EmptyState, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import type { Order } from "../../types";

export default function AgentDeliveriesPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api
      .get("/orders")
      .then((res) => setOrders(res.data.orders))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Assigned deliveries</h1>
      <Card>
        {orders === null ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No deliveries assigned" subtitle="New assignments will show up here." />
        ) : (
          <ul className="divide-y divide-slate-50">
            {orders.map((o) => (
              <li key={o.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <Link to={`/agent/deliveries/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    {o.orderNumber}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {o.pickupAddress} → {o.dropAddress}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">{o.paymentType}</span>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
