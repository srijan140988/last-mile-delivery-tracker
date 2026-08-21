import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Card, EmptyState, Select, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import type { Order, OrderStatus } from "../../types";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<OrderStatus | "">("");

  useEffect(() => {
    let cancelled = false;
    setOrders(null);
    api
      .get("/orders", { params: status ? { status } : {} })
      .then((res) => !cancelled && setOrders(res.data.orders))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My orders</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")} className="w-48">
          <option value="">All statuses</option>
          {["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RESCHEDULED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {orders === null ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders found" subtitle="Create your first order to see it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Order #</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Charge</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/customer/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {o.pickupZone?.name ?? "—"} → {o.dropZone?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {o.orderType} / {o.paymentType}
                    </td>
                    <td className="px-5 py-3 text-slate-900 font-medium">₹{o.totalCharge.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</td>
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
