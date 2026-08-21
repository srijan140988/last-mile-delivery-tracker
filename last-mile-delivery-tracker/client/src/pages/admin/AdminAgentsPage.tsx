import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from "../../components/ui";
import type { AgentSummary, Zone } from "../../types";

export default function AdminAgentsPage() {
  const { push } = useToast();
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", currentZoneId: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [agentsRes, zonesRes] = await Promise.all([api.get("/agents"), api.get("/zones")]);
    setAgents(agentsRes.data);
    setZones(zonesRes.data);
    setForm((f) => ({ ...f, currentZoneId: f.currentZoneId || zonesRes.data[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch(() => setAgents([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/admin/agents", form);
      push("Delivery agent created", "success");
      setForm((f) => ({ ...f, name: "", email: "", password: "", phone: "" }));
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not create agent", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Delivery agents</h1>
        <Card>
          {agents === null ? (
            <Spinner />
          ) : agents.length === 0 ? (
            <EmptyState title="No agents yet" subtitle="Create your first delivery agent account." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Zone</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{a.user.name}</p>
                      <p className="text-xs text-slate-400">{a.user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.currentZone?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          !a.isActive
                            ? "bg-slate-100 text-slate-500 border-slate-200"
                            : a.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {!a.isActive ? "Inactive" : a.isAvailable ? "Available" : "Busy"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{(a as any)._count?.assignments ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 mt-1 md:mt-11">Add delivery agent</h2>
        <Card className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Full name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ravi Kumar" />
            </Field>
            <Field label="Email">
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ravi.agent@example.com" />
            </Field>
            <Field label="Temporary password" hint="At least 6 characters">
              <Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Phone (optional)">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
            </Field>
            <Field label="Home zone">
              <Select value={form.currentZoneId} onChange={(e) => setForm({ ...form, currentZoneId: e.target.value })}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={submitting || !zones.length} className="w-full">
              {submitting ? "Creating..." : "Create agent"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
