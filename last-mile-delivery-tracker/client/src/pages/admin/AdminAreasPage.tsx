import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from "../../components/ui";
import type { Area, Zone } from "../../types";

export default function AdminAreasPage() {
  const { push } = useToast();
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({ name: "", postcode: "", zoneId: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [areasRes, zonesRes] = await Promise.all([api.get("/areas"), api.get("/zones")]);
    setAreas(areasRes.data);
    setZones(zonesRes.data);
    setForm((f) => ({ ...f, zoneId: f.zoneId || zonesRes.data[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch(() => setAreas([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/areas", form);
      push("Area mapped to zone", "success");
      setForm((f) => ({ ...f, name: "", postcode: "" }));
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not create area", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Areas & postcodes</h1>
        <Card>
          {areas === null ? (
            <Spinner />
          ) : areas.length === 0 ? (
            <EmptyState title="No areas mapped yet" subtitle="Map postcodes to zones so orders can be zoned automatically." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Area</th>
                  <th className="px-5 py-3 font-medium">Postcode</th>
                  <th className="px-5 py-3 font-medium">Zone</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">{a.name}</td>
                    <td className="px-5 py-3 text-slate-600">{a.postcode}</td>
                    <td className="px-5 py-3 text-slate-600">{a.zone?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 mt-1 md:mt-11">Map a new area</h2>
        <Card className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Area name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rohini" />
            </Field>
            <Field label="Postcode">
              <Input required value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} placeholder="110085" />
            </Field>
            <Field label="Zone">
              <Select required value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={submitting || !zones.length} className="w-full">
              {submitting ? "Mapping..." : "Map area"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
