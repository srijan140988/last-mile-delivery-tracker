import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Input, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import { TrackingTimeline } from "../../components/TrackingTimeline";
import type { Order } from "../../types";

export default function CustomerOrderDetailPage() {
  const { id } = useParams();
  const { push } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await api.get(`/orders/${id}`);
    setOrder(res.data);
  }

  useEffect(() => {
    load().catch(() => setOrder(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleReschedule(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/orders/${id}/reschedule`, { requestedDate: new Date(rescheduleDate).toISOString() });
      push("Delivery rescheduled — a new agent is being assigned", "success");
      await load();
      setRescheduleDate("");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not reschedule", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!order) return <Spinner />;

  const activeAssignment = order.assignments?.find((a) => a.status === "ACTIVE");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-900">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-slate-500">Placed on {new Date(order.createdAt).toLocaleString()}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Shipment</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Pickup" value={`${order.pickupAddress} (${order.pickupZone?.name ?? order.pickupPincode})`} />
            <Row label="Drop" value={`${order.dropAddress} (${order.dropZone?.name ?? order.dropPincode})`} />
            <Row label="Dimensions" value={`${order.lengthCm} × ${order.breadthCm} × ${order.heightCm} cm`} />
            <Row label="Chargeable weight" value={`${order.chargeableWeightKg} kg`} />
            <Row label="Order / Payment" value={`${order.orderType} / ${order.paymentType}`} />
            <Row label="Total charge" value={`₹${order.totalCharge.toFixed(2)}`} bold />
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Delivery agent</h2>
          {activeAssignment ? (
            <div className="text-sm space-y-2">
              <Row label="Name" value={activeAssignment.agent?.user.name ?? "—"} />
              <Row label="Phone" value={activeAssignment.agent?.user.phone ?? "—"} />
              <Row label="Assigned via" value={activeAssignment.assignmentMethod} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">No agent assigned yet.</p>
          )}

          {order.status === "FAILED" && (
            <form onSubmit={handleReschedule} className="mt-6 pt-6 border-t border-slate-100 space-y-3">
              <p className="text-sm font-medium text-slate-900">Delivery failed — pick a new date</p>
              <Field label="Requested delivery date">
                <Input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Rescheduling..." : "Reschedule delivery"}
              </Button>
            </form>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Tracking timeline</h2>
        <TrackingTimeline events={order.trackingEvents ?? []} />
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right ${bold ? "font-semibold text-slate-900" : "text-slate-700"}`}>{value}</dd>
    </div>
  );
}
