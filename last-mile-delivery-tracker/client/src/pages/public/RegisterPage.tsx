import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Input } from "../../components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", companyName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await register(form);
      push(`Account created — welcome, ${user.name.split(" ")[0]}!`, "success");
      navigate("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-950 via-brand-900 to-brand-700 px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold mb-3">L</div>
          <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Register as a customer to start booking deliveries</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name">
            <Input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint="At least 6 characters">
            <Input type="password" required minLength={6} value={form.password} onChange={(e) => update("password", e.target.value)} />
          </Field>
          <Field label="Phone (optional)">
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="9999900000" />
          </Field>
          <Field label="Company name (optional — for B2B accounts)">
            <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Acme Retail Pvt Ltd" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="text-sm text-slate-500 text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
