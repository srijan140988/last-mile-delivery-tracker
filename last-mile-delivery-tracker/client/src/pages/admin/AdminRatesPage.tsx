import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from "../../components/ui";
import type { OrderType, RateCard, RateType, Zone } from "../../types";

export default function AdminRatesPage() {
  const { push } = useToast();
  const [rates, setRates] = useState<RateCard[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({
    orderType: "B2C" as OrderType,
    rateType: "INTRA_ZONE" as RateType,
    zoneId: "",
    fromZoneId: "",
    toZoneId: "",
    ratePerKg: "",
  });
  const [cod, setCod] = useState({ orderType: "B2C" as OrderType, flatFee: "", percentage: "" });
  const [submitting, setSubmitting] = useState(false);
  const [codSubmitting, setCodSubmitting] = useState(false);

  async function load() {
    const [ratesRes, zonesRes] = await Promise.all([api.get("/rates"), api.get("/zones")]);
    setRates(ratesRes.data);
    setZones(zonesRes.data);
    setForm((f) => ({ ...f, zoneId: f.zoneId || zonesRes.data[0]?.id || "", fromZoneId: f.fromZoneId || zonesRes.data[0]?.id || "", toZoneId: f.toZoneId || zonesRes.data[1]?.id || zonesRes.data[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch(() => setRates([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload =
        form.rateType === "INTRA_ZONE"
          ? { orderType: form.orderType, rateType: form.rateType, zoneId: form.zoneId, ratePerKg: Number(form.ratePerKg) }
          : {
              orderType: form.orderType,
              rateType: form.rateType,
              fromZoneId: form.fromZoneId,
              toZoneId: form.toZoneId,
              ratePerKg: Number(form.ratePerKg),
            };
      await api.post("/rates", payload);
      push("Rate card saved", "success");
      setForm((f) => ({ ...f, ratePerKg: "" }));
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save rate card", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodSave(e: FormEvent) {
    e.preventDefault();
    setCodSubmitting(true);
    try {
      await api.post("/rates/cod-surcharge", {
        orderType: cod.orderType,
        flatFee: Number(cod.flatFee || 0),
        percentage: Number(cod.percentage || 0),
      });
      push("COD surcharge configuration saved", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save COD surcharge", "error");
    } finally {
      setCodSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Rate cards</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            {rates === null ? (
              <Spinner />
            ) : rates.length === 0 ? (
              <EmptyState title="No rate cards configured" subtitle="Add intra-zone and inter-zone rates below." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Rate type</th>
                    <th className="px-5 py-3 font-medium">Lane</th>
                    <th className="px-5 py-3 font-medium">Rate / kg</th>
                    <th className="px-5 py-3 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-900">{r.orderType}</td>
                      <td className="px-5 py-3 text-slate-600">{r.rateType === "INTRA_ZONE" ? "Intra-zone" : "Inter-zone"}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {r.rateType === "INTRA_ZONE" ? r.zone?.name : `${r.fromZone?.name} → ${r.toZone?.name}`}
                      </td>
                      <td className="px-5 py-3 text-slate-900">₹{r.ratePerKg}</td>
                      <td className="px-5 py-3">{r.isActive ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card className="p-5 h-fit">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Add rate card</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Order type">
              <Select value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as OrderType })}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </Select>
            </Field>
            <Field label="Rate type">
              <Select value={form.rateType} onChange={(e) => setForm({ ...form, rateType: e.target.value as RateType })}>
                <option value="INTRA_ZONE">Intra-zone</option>
                <option value="INTER_ZONE">Inter-zone</option>
              </Select>
            </Field>
            {form.rateType === "INTRA_ZONE" ? (
              <Field label="Zone">
                <Select value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="From zone">
                  <Select value={form.fromZoneId} onChange={(e) => setForm({ ...form, fromZoneId: e.target.value })}>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="To zone">
                  <Select value={form.toZoneId} onChange={(e) => setForm({ ...form, toZoneId: e.target.value })}>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Field label="Rate per kg (₹)">
              <Input required type="number" min="0.01" step="0.01" value={form.ratePerKg} onChange={(e) => setForm({ ...form, ratePerKg: e.target.value })} />
            </Field>
            <Button type="submit" disabled={submitting || !zones.length} className="w-full">
              {submitting ? "Saving..." : "Save rate card"}
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">COD surcharge</h2>
        <Card className="p-5 max-w-md">
          <form onSubmit={handleCodSave} className="space-y-4">
            <Field label="Order type">
              <Select value={cod.orderType} onChange={(e) => setCod({ ...cod, orderType: e.target.value as OrderType })}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Flat fee (₹)">
                <Input type="number" min="0" step="0.01" value={cod.flatFee} onChange={(e) => setCod({ ...cod, flatFee: e.target.value })} placeholder="20" />
              </Field>
              <Field label="Percentage (%)">
                <Input type="number" min="0" step="0.01" value={cod.percentage} onChange={(e) => setCod({ ...cod, percentage: e.target.value })} placeholder="2" />
              </Field>
            </div>
            <Button type="submit" disabled={codSubmitting} className="w-full">
              {codSubmitting ? "Saving..." : "Save COD surcharge"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
