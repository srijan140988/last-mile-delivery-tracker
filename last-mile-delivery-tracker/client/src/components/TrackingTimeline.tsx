import type { TrackingEvent } from "../types";
import { StatusBadge } from "./StatusBadge";

export function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-400">No tracking events yet.</p>;
  }
  return (
    <ol className="relative border-l border-slate-200 ml-3">
      {events.map((e, i) => (
        <li key={e.id} className="mb-6 ml-6 last:mb-0">
          <span
            className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white ${
              i === events.length - 1 ? "bg-brand-600" : "bg-slate-300"
            }`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.newStatus} />
            {e.isAdminOverride && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                Admin override
              </span>
            )}
            <span className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
          </div>
          {e.remarks && <p className="text-sm text-slate-600 mt-1">{e.remarks}</p>}
          <p className="text-xs text-slate-400 mt-0.5">by {e.actorRole.toLowerCase()}</p>
        </li>
      ))}
    </ol>
  );
}
