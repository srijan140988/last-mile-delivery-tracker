import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Select, Spinner } from "../../components/ui";
import { StatusBadge } from "../../components/StatusBadge";
import { TrackingTimeline } from "../../components/TrackingTimeline";
import type { AgentSummary, Order, OrderStatus } from "../../types";

const ALL_STATUSES: OrderStatus[] = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
  "CANCELLED",
];

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { push } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<OrderStatus>("CREATED");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [orderRes, agentsRes] = await Promise.all([api.get(`/orders/${id}`), api.get("/agents")]);
    setOrder(orderRes.data);
    setAgents(agentsRes.data);
    setOverrideStatus(orderRes.data.status);
  }

  useEffect(() => {
    load().catch(() => setOrder(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleManualAssign() {
    if (!selectedAgent) return;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/assign`, { agentId: selectedAgent });
      push("Agent manually assigned", "success");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not assign agent", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoAssign() {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/auto-assign`, {});
      push("Nearest available agent auto-assigned", "success");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not auto-assign", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleOverride() {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: overrideStatus, override: true, remarks: "Manually overridden by admin" });
      push("Status overridden", "success");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not override status", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <Spinner />;

  const activeAssignment = order.assignments?.find((a) => a.status === "ACTIVE");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Shipment</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Customer" value={order.customer?.user.name ?? "—"} />
            <Row label="Pickup" value={`${order.pickupAddress} (${order.pickupZone?.name})`} />
            <Row label="Drop" value={`${order.dropAddress} (${order.dropZone?.name})`} />
            <Row label="Chargeable weight" value={`${order.chargeableWeightKg} kg`} />
            <Row label="Type / payment" value={`${order.orderType} / ${order.paymentType}`} />
            <Row label="Total charge" value={`₹${order.totalCharge.toFixed(2)}`} bold />
          </dl>
        </Card>

        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Agent assignment</h2>
            <p className="text-sm text-slate-600 mb-3">
              {activeAssignment ? `Currently: ${activeAssignment.agent?.user.name}` : "No agent assigned yet"}
            </p>
            <div className="flex gap-2">
              <Select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="flex-1">
                <option value="">Select agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.user.name} {a.isAvailable ? "(available)" : "(busy)"}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={handleManualAssign} disabled={busy || !selectedAgent}>
                Assign
              </Button>
            </div>
            <Button variant="ghost" className="mt-2 px-0" onClick={handleAutoAssign} disabled={busy}>
              Or auto-assign nearest available agent →
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Override status</h2>
            <Field label="New status">
              <Select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value as OrderStatus)}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="danger" className="mt-3 w-full" onClick={handleOverride} disabled={busy}>
              Force status change
            </Button>
          </div>
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
