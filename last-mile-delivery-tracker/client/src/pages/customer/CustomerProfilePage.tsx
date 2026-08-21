import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui";

export default function CustomerProfilePage() {
  const { user } = useAuth();
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Profile</h1>
      <Card className="p-6 space-y-4 text-sm">
        <Row label="Name" value={user?.name ?? "—"} />
        <Row label="Email" value={user?.email ?? "—"} />
        <Row label="Role" value={user?.role ?? "—"} />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
