"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, CheckCircle, XCircle, MessageSquare, RefreshCw, Shield, TrendingUp, Clock, Search, LogOut } from "lucide-react";

interface Client {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  whatsapp_connected: boolean;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: adminCheck } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!adminCheck) { window.location.href = "/dashboard"; return; }
      setIsAdmin(true);
      setChecking(false);
      fetchClients();
    };
    checkAdmin();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClients(data.clients);
      setFiltered(data.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(!q ? clients : clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q)
    ));
  }, [search, clients]);

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    setUpdating(client.id);
    try {
      await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: client.id, status: newStatus }),
      });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
    } finally {
      setUpdating(null);
    }
  };

  if (checking) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">Clickstream WA — Client Management</p>
            </div>
          </div>
          <button onClick={() => { window.location.href = "/dashboard"; }}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            <LogOut className="h-3.5 w-3.5" /> Back to CRM
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Clients", value: clients.length, icon: Users },
            { label: "Active", value: clients.filter(c => c.status === "active").length, icon: CheckCircle },
            { label: "WhatsApp Connected", value: clients.filter(c => c.whatsapp_connected).length, icon: MessageSquare },
            { label: "This Month", value: clients.filter(c => new Date(c.created_at).getMonth() === new Date().getMonth()).length, icon: TrendingUp },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{s.label}</p>
                <s.icon className="h-4 w-4 text-violet-400" />
              </div>
              <p className="mt-2 text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search clients..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
            <span className="ml-3 text-slate-400">Loading clients...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  {["Client","Slug","Plan","WhatsApp","Joined","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No clients found</td></tr>
                ) : filtered.map(client => (
                  <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-sm font-medium text-violet-400">
                          {(client.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{client.name || "—"}</p>
                          <p className="text-xs text-slate-400">{client.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <a href={`/${client.slug}/dashboard`} target="_blank"
                        className="font-mono text-xs text-violet-400 hover:underline">/{client.slug}</a>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs capitalize text-slate-300">
                        {client.plan || "starter"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {client.whatsapp_connected
                        ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3.5 w-3.5" />Connected</span>
                        : <span className="flex items-center gap-1 text-xs text-slate-500"><XCircle className="h-3.5 w-3.5" />Not set</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(client.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${client.status === "active" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => toggleStatus(client)} disabled={updating === client.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${client.status === "active" ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                        {updating === client.id ? "..." : client.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
