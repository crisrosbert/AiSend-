"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  CheckCircle,
  XCircle,
  MessageSquare,
  RefreshCw,
  Shield,
  TrendingUp,
  Clock,
  Search,
  MoreVertical,
  LogOut,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  whatsapp_connected: boolean;
  phone_number_id: string | null;
  created_at: string;
  owner_id: string;
  full_name: string | null;
  email: string | null;
}

interface Stats {
  total: number;
  active: number;
  whatsappConnected: number;
  thisMonth: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, whatsappConnected: 0, thisMonth: 0 });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients");
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setClients(data.clients);
      setFiltered(data.clients);

      // Calculate stats
      const now = new Date();
      const thisMonth = data.clients.filter((c: Client) => {
        const d = new Date(c.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        total: data.clients.length,
        active: data.clients.filter((c: Client) => c.status === 'active').length,
        whatsappConnected: data.clients.filter((c: Client) => c.whatsapp_connected).length,
        thisMonth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Search filter
  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFiltered(clients);
      return;
    }
    setFiltered(clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q)
    ));
  }, [search, clients]);

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    setUpdating(client.id);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: client.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Update local state
      setClients(prev => prev.map(c =>
        c.id === client.id ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const planColor = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'text-yellow-400 bg-yellow-400/10';
      case 'growth': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">Clickstream WA — Client Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchClients}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              onClick={() => { window.location.href = '/login'; }}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Clients", value: stats.total, icon: Users, color: "text-violet-400" },
            { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-400" },
            { label: "WhatsApp Connected", value: stats.whatsappConnected, icon: MessageSquare, color: "text-blue-400" },
            { label: "Joined This Month", value: stats.thisMonth, icon: TrendingUp, color: "text-yellow-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-400">
            {filtered.length} clients
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
            <span className="ml-3 text-slate-400">Loading clients...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-slate-400">No clients found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Slug / URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">WhatsApp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Client info */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-sm font-medium text-violet-400">
                          {(client.name || client.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {client.name || client.full_name || "—"}
                          </p>
                          <p className="text-xs text-slate-400">{client.email || "—"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-4">
                      <a
                        href={`/${client.slug}/dashboard`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-violet-400 hover:text-violet-300 hover:underline"
                      >
                        /{client.slug}/dashboard
                      </a>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${planColor(client.plan)}`}>
                        {client.plan || 'starter'}
                      </span>
                    </td>

                    {/* WhatsApp */}
                    <td className="px-4 py-4">
                      {client.whatsapp_connected ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs">Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs">Not connected</span>
                        </div>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">{formatDate(client.created_at)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        client.status === 'active'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}>
                        {client.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleStatus(client)}
                        disabled={updating === client.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          client.status === 'active'
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        {updating === client.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : client.status === 'active' ? (
                          'Suspend'
                        ) : (
                          'Activate'
                        )}
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
