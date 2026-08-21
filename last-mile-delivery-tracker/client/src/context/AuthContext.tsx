import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: { name: string; email: string; password: string; phone?: string; companyName?: string }) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("lmd_token");
    const cachedUser = localStorage.getItem("lmd_user");
    if (token && cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        localStorage.removeItem("lmd_user");
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: u } = res.data;
    localStorage.setItem("lmd_token", token);
    localStorage.setItem("lmd_user", JSON.stringify(u));
    setUser(u);
    return u as AuthUser;
  }

  async function register(data: { name: string; email: string; password: string; phone?: string; companyName?: string }) {
    const res = await api.post("/auth/register", data);
    const { token, user: u } = res.data;
    localStorage.setItem("lmd_token", token);
    localStorage.setItem("lmd_user", JSON.stringify(u));
    setUser(u);
    return u as AuthUser;
  }

  function logout() {
    localStorage.removeItem("lmd_token");
    localStorage.removeItem("lmd_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
