import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, EmptyState, Spinner } from "../../components/ui";

interface CustomerRow {
  id: string;
  companyName?: string | null;
  user: { name: string; email: string; phone?: string | null };
  _count: { orders: number };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);

  useEffect(() => {
    api
      .get("/admin/customers")
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Customers</h1>
      <Card>
        {customers === null ? (
          <Spinner />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Orders</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">{c.user.name}</td>
                  <td className="px-5 py-3 text-slate-600">{c.user.email}</td>
                  <td className="px-5 py-3 text-slate-600">{c.companyName || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c._count.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
