"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, CheckCircle, XCircle, MessageSquare, RefreshCw, Shield, TrendingUp, Clock, Search, LogOut } from "lucide-react";
interface Client { id: string; name: string; slug: string; plan: string; status: string; whatsapp_connected: boolean; created_at: string; full_name: string | null; email: string | null; }
export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: a } = await sb.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();
      if (!a) { window.location.href = "/dashboard"; return; }
      setReady(true);
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (!data.error) { setClients(data.clients); setFiltered(data.clients); }
      else setError(data.error);
      setLoading(false);
    })();
  }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(!q ? clients : clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q)));
  }, [search, clients]);
  const toggle = async (c: Client) => {
    const s = c.status === "active" ? "inactive" : "active";
    setUpdating(c.id);
    await fetch("/api/admin/clients", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org_id: c.id, status: s }) });
    setClients(p => p.map(x => x.id === c.id ? { ...x, status: s } : x));
    setUpdating(null);
  };
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-slate-950"><RefreshCw className="h-6 w-6 animate-spin text-violet-500" /></div>;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500"><Shield className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-lg font-semibold">Admin Dashboard</h1><p className="text-xs text-slate-400">Clickstream WA</p></div>
        </div>
        <button onClick={() => window.location.href = "/dashboard"} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"><LogOut className="h-3.5 w-3.5" />Back to CRM</button>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[{l:"Total",v:clients.length,I:Users},{l:"Active",v:clients.filter(c=>c.status==="active").length,I:CheckCircle},{l:"WhatsApp",v:clients.filter(c=>c.whatsapp_connected).length,I:MessageSquare},{l:"This Month",v:clients.filter(c=>new Date(c.created_at).getMonth()===new Date().getMonth()).length,I:TrendingUp}].map(s=>(
            <div key={s.l} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between"><p className="text-sm text-slate-400">{s.l}</p><s.I className="h-4 w-4 text-violet-400" /></div>
              <p className="mt-2 text-3xl font-bold">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none" />
        </div>
        {loading ? <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-violet-500" /><span className="ml-3 text-slate-400">Loading...</span></div>
        : error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">{error}</div>
        : <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead><tr className="border-b border-slate-800 bg-slate-900">{["Client","Slug","Plan","WhatsApp","Joined","Status","Action"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {filtered.length===0 ? <tr><td colSpan={7} className="py-12 text-center text-slate-400">No clients</td></tr>
                : filtered.map(c=>(
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-sm font-medium text-violet-400">{(c.name||"?").charAt(0).toUpperCase()}</div><div><p className="text-sm font-medium text-white">{c.name||"—"}</p><p className="text-xs text-slate-400">{c.email||"—"}</p></div></div></td>
                    <td className="px-4 py-4"><a href={`/${c.slug}/dashboard`} target="_blank" className="font-mono text-xs text-violet-400 hover:underline">/{c.slug}</a></td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs capitalize text-slate-300">{c.plan||"starter"}</span></td>
                    <td className="px-4 py-4">{c.whatsapp_connected?<span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3.5 w-3.5"/>Connected</span>:<span className="flex items-center gap-1 text-xs text-slate-500"><XCircle className="h-3.5 w-3.5"/>Not set</span>}</td>
                    <td className="px-4 py-4"><span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3.5 w-3.5"/>{new Date(c.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span></td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${c.status==="active"?"bg-green-400/10 text-green-400":"bg-red-400/10 text-red-400"}`}>{c.status}</span></td>
                    <td className="px-4 py-4"><button onClick={()=>toggle(c)} disabled={updating===c.id} className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${c.status==="active"?"bg-red-500/10 text-red-400 hover:bg-red-500/20":"bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{updating===c.id?"...":c.status==="active"?"Suspend":"Activate"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}
