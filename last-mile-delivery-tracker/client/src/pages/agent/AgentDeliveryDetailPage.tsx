import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Input, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import { TrackingTimeline } from "../../components/TrackingTimeline";
import type { Order, OrderStatus } from "../../types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ASSIGNED: ["PICKED_UP"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
};

export default function AgentDeliveryDetailPage() {
  const { id } = useParams();
  const { push } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [showFailureForm, setShowFailureForm] = useState(false);
  const [updating, setUpdating] = useState<OrderStatus | null>(null);

  async function load() {
    const res = await api.get(`/orders/${id}`);
    setOrder(res.data);
  }

  useEffect(() => {
    load().catch(() => setOrder(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: OrderStatus, remarks?: string) {
    setUpdating(status);
    try {
      await api.patch(`/orders/${id}/status`, { status, remarks, failureReason: status === "FAILED" ? remarks : undefined });
      push(`Order marked as ${status.replace(/_/g, " ").toLowerCase()}`, "success");
      setShowFailureForm(false);
      setFailureReason("");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not update status", "error");
    } finally {
      setUpdating(null);
    }
  }

  if (!order) return <Spinner />;

  const nextOptions = NEXT_STATUS[order.status] ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Delivery details</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Pickup" value={order.pickupAddress} />
          <Row label="Drop" value={order.dropAddress} />
          <Row label="Payment" value={order.paymentType} />
          <Row label="Charge" value={`₹${order.totalCharge.toFixed(2)}`} />
          <Row label="Customer" value={order.customer?.user.name ?? "—"} />
          <Row label="Customer phone" value={order.customer?.user.phone ?? "—"} />
        </dl>
      </Card>

      {nextOptions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Update status</h2>
          <div className="flex flex-wrap gap-3">
            {nextOptions
              .filter((s) => s !== "FAILED")
              .map((s) => (
                <Button key={s} onClick={() => updateStatus(s)} disabled={updating !== null}>
                  {updating === s ? "Updating..." : `Mark as ${s.replace(/_/g, " ").toLowerCase()}`}
                </Button>
              ))}
            {nextOptions.includes("FAILED") && (
              <Button variant="danger" onClick={() => setShowFailureForm(true)} disabled={updating !== null}>
                Mark as failed
              </Button>
            )}
          </div>

          {showFailureForm && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <Field label="Failure reason">
                <Input required value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Customer not available" />
              </Field>
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => updateStatus("FAILED", failureReason)} disabled={!failureReason || updating !== null}>
                  {updating === "FAILED" ? "Submitting..." : "Confirm failure"}
                </Button>
                <Button variant="ghost" onClick={() => setShowFailureForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Tracking timeline</h2>
        <TrackingTimeline events={order.trackingEvents ?? []} />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
