import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Spinner } from "../../components/ui";
import type { AgentSummary } from "../../types";

export default function AgentAvailabilityPage() {
  const { push } = useToast();
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [updating, setUpdating] = useState(false);
  const [locating, setLocating] = useState(false);

  async function load() {
    const res = await api.get("/agents/me");
    setAgent(res.data);
  }

  useEffect(() => {
    load().catch(() => setAgent(null));
  }, []);

  async function toggleAvailability() {
    if (!agent) return;
    setUpdating(true);
    try {
      await api.patch(`/agents/${agent.id}/availability`, { isAvailable: !agent.isAvailable });
      push("Availability updated", "success");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not update availability", "error");
    } finally {
      setUpdating(false);
    }
  }

  function shareLocation() {
    if (!agent) return;
    if (!navigator.geolocation) {
      push("Geolocation is not supported by this browser", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.patch(`/agents/${agent.id}/location`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          push("Location updated", "success");
          await load();
        } catch (err) {
          push(err instanceof Error ? err.message : "Could not update location", "error");
        } finally {
          setLocating(false);
        }
      },
      () => {
        push("Could not access your location", "error");
        setLocating(false);
      }
    );
  }

  if (!agent) return <Spinner />;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Availability & location</h1>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Current status</p>
            <p className={`text-sm ${agent.isAvailable ? "text-emerald-600" : "text-amber-600"}`}>
              {agent.isAvailable ? "Available for new deliveries" : "Busy — not receiving new assignments"}
            </p>
          </div>
          <Button variant={agent.isAvailable ? "secondary" : "primary"} onClick={toggleAvailability} disabled={updating}>
            {updating ? "Updating..." : agent.isAvailable ? "Set as busy" : "Set as available"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Current location</p>
          <p className="text-sm text-slate-500">
            {agent.currentLat != null && agent.currentLng != null
              ? `${agent.currentLat.toFixed(4)}, ${agent.currentLng.toFixed(4)}`
              : "Not shared yet"}
          </p>
          {agent.currentZone && <p className="text-xs text-slate-400 mt-1">Zone: {agent.currentZone.name}</p>}
        </div>
        <Button variant="secondary" onClick={shareLocation} disabled={locating}>
          {locating ? "Locating..." : "Share current location"}
        </Button>
      </Card>
    </div>
  );
}
