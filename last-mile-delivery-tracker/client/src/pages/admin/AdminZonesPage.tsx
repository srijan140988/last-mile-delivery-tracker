import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, Field, Input, Spinner } from "../../components/ui";
import type { Zone } from "../../types";

export default function AdminZonesPage() {
  const { push } = useToast();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await api.get("/zones");
    setZones(res.data);
  }

  useEffect(() => {
    load().catch(() => setZones([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/zones", { name, description: description || undefined });
      push("Zone created", "success");
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not create zone", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/zones/${id}`);
      push("Zone deleted", "success");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not delete zone", "error");
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Zones</h1>
        <Card>
          {zones === null ? (
            <Spinner />
          ) : zones.length === 0 ? (
            <EmptyState title="No zones yet" subtitle="Create your first zone to start mapping areas and rates." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Areas</th>
                  <th className="px-5 py-3 font-medium">Agents</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">{z.name}</td>
                    <td className="px-5 py-3 text-slate-500">{z.description || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{z._count?.areas ?? 0}</td>
                    <td className="px-5 py-3 text-slate-500">{z._count?.agents ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(z.id)} className="text-red-500 text-xs font-medium hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 mt-1 md:mt-11">Add a zone</h2>
        <Card className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Zone name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="North Zone" />
            </Field>
            <Field label="Description (optional)">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Northern metro area" />
            </Field>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating..." : "Create zone"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
