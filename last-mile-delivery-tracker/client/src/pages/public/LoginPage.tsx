import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Input } from "../../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      push(`Welcome back, ${user.name.split(" ")[0]}!`, "success");
      if (user.role === "CUSTOMER") navigate("/customer");
      else if (user.role === "AGENT") navigate("/agent");
      else navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-950 via-brand-900 to-brand-700 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold mb-3">L</div>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to LastMile</h1>
          <p className="text-sm text-slate-500 mt-1">Delivery tracker for customers, agents & admins</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-sm text-slate-500 text-center mt-6">
          New customer?{" "}
          <Link to="/register" className="text-brand-600 font-medium hover:underline">
            Create an account
          </Link>
        </p>
        <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-500">Demo credentials (password: Password123!)</p>
          <p>Admin: admin@example.com</p>
          <p>Customer: customer@example.com</p>
          <p>Agent: ravi.agent@example.com</p>
        </div>
      </Card>
    </div>
  );
}
