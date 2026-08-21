import type { OrderStatus } from "../types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  ASSIGNED: "bg-blue-50 text-blue-700 border-blue-200",
  PICKED_UP: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_TRANSIT: "bg-violet-50 text-violet-700 border-violet-200",
  OUT_FOR_DELIVERY: "bg-amber-50 text-amber-700 border-amber-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  RESCHEDULED: "bg-orange-50 text-orange-700 border-orange-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
