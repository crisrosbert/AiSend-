"use client"

// src/app/(dashboard)/automations/page.tsx
//
// ── WHAT THIS PAGE IS ────────────────────────────────────────────────
// Automation Rules — background workflows that react to WhatsApp events.
// Not to be confused with Chat Flows (/journeys), the visual canvas that
// designs what the customer actually sees. Rules do things TO your data:
// tag, assign, create a deal, send a follow-up.
//
// ── WHY IT WAS REDESIGNED ────────────────────────────────────────────
// The page was dark slate + violet while the rest of the product is
// light. It read as a different application, and the vertical list gave
// every rule the same visual weight — you could not tell at a glance
// which were live, which had ever run, or which were doing nothing.
//
// It now uses the same card grid as /agents, so the two builders feel
// like one product, and each card leads with the state that matters:
// live or paused, what fires it, and whether it has actually run.
//
// ── COLOUR ───────────────────────────────────────────────────────────
// WhatsApp's own palette, used the way WhatsApp uses it:
//   #25D366  the signature green — status dots, accents, tinted fills
//   #128C7E  mid teal-green — secondary emphasis
//   #075E54  deep teal — primary buttons, because white text on the
//            bright green fails contrast badly (≈2.9:1). The deep tone
//            passes AA comfortably and reads more considered.
//   #DCF8C6  the outgoing chat-bubble green, used sparingly for chips.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Zap, Plus, MoreVertical, Copy, Pencil, Trash2, FileText,
  MessageCircle, Clock, Users, PhoneCall, Loader2, Search,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Automation } from "@/types"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import { triggerMeta, formatRelative } from "@/lib/automations/trigger-meta"
import { useBusiness } from "@/hooks/use-business";

const TEMPLATE_ORDER: TemplateSlug[] = [
  "welcome_message",
  "out_of_office",
  "lead_qualifier",
  "follow_up_reminder",
]

const TEMPLATE_ICON: Record<TemplateSlug, typeof Zap> = {
  welcome_message: MessageCircle,
  out_of_office: Clock,
  lead_qualifier: Users,
  follow_up_reminder: PhoneCall,
}

export default function AutomationsPage() {
  const router = useRouter()
  const { businessId, loading: businessLoading } = useBusiness();
  const [automations, setAutomations] = useState<Automation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState("")

  async function load() {
    try {
      if (businessLoading) return
      if (!businessId) { setAutomations([]); return }

      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from("automations")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
      if (fetchErr) throw fetchErr
      setAutomations((data ?? []) as Automation[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations")
    }
  }

  // businessId in the deps is what repaints this list when the
  // switcher changes business.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [businessId, businessLoading])

  async function toggleActive(a: Automation, next: boolean) {
    // Optimistic flip so the switch feels instant.
    setAutomations((prev) =>
      prev?.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)) ?? prev,
    )
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Roll back on error.
      setAutomations((prev) =>
        prev?.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)) ?? prev,
      )
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Failed to update")
      return
    }
    toast.success(next ? "Rule activated" : "Rule paused")
  }

  async function duplicate(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}/duplicate`, { method: "POST" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Failed to duplicate")
      return
    }
    toast.success("Rule duplicated")
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`/api/automations/${pendingDelete.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Failed to delete")
      return
    }
    toast.success("Rule deleted")
    setPendingDelete(null)
    load()
  }

  /* ── states ── */

  if (error) {
    return (
      <div className="au-rules">
        <style>{css}</style>
        <div className="ar-empty">
          <div className="ar-empty-ic"><Zap size={22} /></div>
          <h3>Couldn&apos;t load your rules</h3>
          <p>{error}</p>
          <button className="ar-btn ar-btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (automations === null) {
    return (
      <div className="au-rules">
        <style>{css}</style>
        <div className="ar-loading"><Loader2 size={20} className="ar-spin" /> Loading rules…</div>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? automations.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description ?? "").toLowerCase().includes(q),
      )
    : automations

  const liveCount = automations.filter((a) => a.is_active).length
  // Templates are a starting point, not permanent furniture — once a
  // merchant has a few rules of their own they know what they're doing.
  const showTemplates = automations.length < 3

  return (
    <div className="au-rules">
      <style>{css}</style>

      {/* ── Header ── */}
      <header className="ar-head">
        <div className="ar-head-left">
          <span className="ar-head-ic"><Zap size={19} /></span>
          <div>
            <h1>Automation Rules</h1>
            <p>Background workflows that react to WhatsApp events — tag, assign, follow up.</p>
          </div>
        </div>
        <button className="ar-btn ar-btn-primary" onClick={() => router.push("/automations/new")}>
          <Plus size={15} /> Create Rule
        </button>
      </header>

      {/* ── Counts + search ──
          Only worth showing once there is something to count or filter. */}
      {automations.length > 0 && (
        <div className="ar-toolbar">
          <div className="ar-counts">
            <span className="ar-count"><i className="ar-dot live" /> {liveCount} live</span>
            <span className="ar-count"><i className="ar-dot off" /> {automations.length - liveCount} paused</span>
          </div>
          <div className="ar-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search rules…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search rules"
            />
          </div>
        </div>
      )}

      {/* ── Quick-start templates ── */}
      {showTemplates && (
        <section className="ar-section">
          <h2 className="ar-section-label">Quick start</h2>
          <div className="ar-tpl-grid">
            {TEMPLATE_ORDER.map((slug) => {
              const t = AUTOMATION_TEMPLATES[slug]
              const Icon = TEMPLATE_ICON[slug]
              return (
                <button
                  key={slug}
                  className="ar-tpl"
                  onClick={() => router.push(`/automations/new?template=${slug}`)}
                >
                  <span className="ar-tpl-ic"><Icon size={17} /></span>
                  <span className="ar-tpl-body">
                    <strong>{t.name}</strong>
                    <span>{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── The rules ── */}
      {automations.length === 0 ? (
        <div className="ar-empty">
          <div className="ar-empty-ic"><Zap size={22} /></div>
          <h3>No rules yet</h3>
          <p>Start from a quick-start above, or build one from scratch.</p>
          <button className="ar-btn ar-btn-primary" onClick={() => router.push("/automations/new")}>
            <Plus size={15} /> Create Rule
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="ar-empty">
          <div className="ar-empty-ic"><Search size={22} /></div>
          <h3>Nothing matches “{query}”</h3>
          <p>Try a different search.</p>
        </div>
      ) : (
        <div className="ar-grid">
          {visible.map((a) => (
            <RuleCard
              key={a.id}
              automation={a}
              onToggle={(next) => toggleActive(a, next)}
              onEdit={() => router.push(`/automations/${a.id}/edit`)}
              onDuplicate={() => duplicate(a)}
              onLogs={() => router.push(`/automations/${a.id}/logs`)}
              onDelete={() => setPendingDelete(a)}
            />
          ))}
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rule</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{pendingDelete?.name}</strong> and its run
              history. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ────────────────────────────── card ────────────────────────────── */

function RuleCard({
  automation, onToggle, onEdit, onDuplicate, onLogs, onDelete,
}: {
  automation: Automation
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onLogs: () => void
  onDelete: () => void
}) {
  const meta = triggerMeta(automation.trigger_type)
  const runs = automation.execution_count ?? 0
  const live = automation.is_active

  return (
    <article className={`ar-card ${live ? "" : "paused"}`}>
      <div className="ar-card-top">
        <span className="ar-ic"><Zap size={16} /></span>
        <div className="ar-card-body">
          <div className="ar-card-title-row">
            <h3>{automation.name}</h3>
            <span className={`ar-pill ${live ? "live" : "off"}`}>
              <i className={`ar-dot ${live ? "live" : "off"}`} />
              {live ? "Live" : "Paused"}
            </span>
          </div>
          {automation.description && <p className="ar-card-desc">{automation.description}</p>}
        </div>
      </div>

      <div className="ar-chips">
        <span className="ar-chip trigger">{meta.label}</span>
        {/* A rule that has never run is the single most useful thing to
            surface — it usually means the trigger never matches. */}
        <span className={`ar-chip ${runs === 0 ? "quiet" : "runs"}`}>
          {runs === 0 ? "Never run" : `${runs.toLocaleString("en-IN")} run${runs === 1 ? "" : "s"}`}
        </span>
      </div>

      <p className="ar-meta">Last fired {formatRelative(automation.last_executed_at)}</p>

      <div className="ar-card-actions">
        <button className="ar-btn ar-btn-primary ar-btn-sm" onClick={onEdit}>
          <Pencil size={13} /> Edit
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label={live ? "Pause rule" : "Activate rule"}
          className={`ar-toggle ${live ? "on" : ""}`}
          onClick={() => onToggle(!live)}
        >
          <span className="ar-knob" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ar-icon-btn" aria-label="More actions">
            <MoreVertical size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onLogs}>
              <FileText className="h-4 w-4" /> Run history
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

/* ────────────────────────────── styles ────────────────────────────── */

const css = `
.au-rules{
  /* WhatsApp's own palette — see the note at the top of this file for
     why the deep teal carries the buttons rather than the bright green. */
  --wa:#25D366;
  --wa-mid:#128C7E;
  --wa-deep:#075E54;
  --wa-tint:#e8f8ef;
  --wa-bubble:#dcf8c6;

  --ink:#0b1f1a;
  --muted:#5f7069;
  --faint:#93a49d;
  --ground:#f4f7f5;
  --surface:#ffffff;
  --line:#e2eae6;
  --radius:16px;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;
  color:var(--ink);
  display:flex;flex-direction:column;gap:16px;padding-bottom:80px}
@media(min-width:1024px){.au-rules{padding-bottom:16px}}
.au-rules h1,.au-rules h2,.au-rules h3{font-family:"Sora","Plus Jakarta Sans",sans-serif;
  letter-spacing:-.03em;margin:0}
.ar-spin{animation:arSpin .8s linear infinite}
@keyframes arSpin{to{transform:rotate(360deg)}}
.ar-loading{display:flex;align-items:center;justify-content:center;gap:10px;height:220px;
  color:var(--muted);font-size:14px;font-weight:600}

/* header */
.ar-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
.ar-head-left{display:flex;align-items:center;gap:13px}
.ar-head-ic{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;flex-shrink:0;
  background:var(--wa-tint);color:var(--wa-deep)}
.ar-head h1{font-size:20px;font-weight:800}
.ar-head p{font-size:13px;color:var(--muted);margin:3px 0 0;line-height:1.45}

/* buttons */
.ar-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;cursor:pointer;
  font-family:inherit;font-size:13px;font-weight:700;padding:11px 18px;border-radius:11px;transition:.16s;
  white-space:nowrap;text-decoration:none}
.ar-btn:disabled{opacity:.55;cursor:default;transform:none!important}
.ar-btn-primary{background:var(--wa-deep);color:#fff}
.ar-btn-primary:hover:not(:disabled){background:var(--wa-mid);transform:translateY(-1px);
  box-shadow:0 6px 16px rgba(7,94,84,.24)}
.ar-btn-sm{padding:8px 14px;font-size:12.5px}
.ar-icon-btn{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;transition:.15s}
.ar-icon-btn:hover{background:var(--wa-tint);border-color:var(--wa);color:var(--wa-deep)}

/* toolbar */
.ar-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.ar-counts{display:flex;gap:14px}
.ar-count{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:650;color:var(--muted)}
.ar-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block}
.ar-dot.live{background:var(--wa);box-shadow:0 0 0 3px rgba(37,211,102,.18)}
.ar-dot.off{background:#c3cfca}
.ar-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);
  border-radius:11px;padding:0 14px;max-width:300px;flex:1;transition:.15s}
.ar-search:focus-within{border-color:var(--wa);box-shadow:0 0 0 3px rgba(37,211,102,.16)}
.ar-search svg{color:var(--faint);flex-shrink:0}
.ar-search input{border:none;outline:none;background:none;font-family:inherit;font-size:13.5px;
  padding:10px 0;width:100%;color:var(--ink)}

/* templates */
.ar-section{display:flex;flex-direction:column;gap:10px}
.ar-section-label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  color:var(--faint);font-family:"Plus Jakarta Sans",sans-serif}
.ar-tpl-grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:640px){.ar-tpl-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.ar-tpl-grid{grid-template-columns:repeat(4,1fr)}}
.ar-tpl{display:flex;gap:11px;align-items:flex-start;text-align:left;background:var(--surface);
  border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;font-family:inherit;
  transition:.16s}
.ar-tpl:hover{border-color:var(--wa);background:var(--wa-tint);transform:translateY(-1px)}
.ar-tpl-ic{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;
  background:var(--wa-tint);color:var(--wa-deep)}
.ar-tpl:hover .ar-tpl-ic{background:#fff}
.ar-tpl-body{min-width:0}
.ar-tpl-body strong{display:block;font-size:13.5px;font-weight:750;font-family:"Sora",sans-serif;
  letter-spacing:-.02em}
.ar-tpl-body span{display:block;font-size:11.5px;color:var(--muted);line-height:1.45;margin-top:2px}

/* rule cards */
.ar-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:680px){.ar-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.ar-grid{grid-template-columns:repeat(3,1fr)}}
.ar-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;
  display:flex;flex-direction:column;transition:.18s;position:relative;overflow:hidden}
/* A live rule gets a green edge — state you can read across the grid
   without parsing any text. */
.ar-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--wa)}
.ar-card.paused::before{background:#dfe7e3}
.ar-card:hover{border-color:#cfdad5;box-shadow:0 10px 30px rgba(11,31,26,.07);transform:translateY(-2px)}
.ar-card.paused{background:#fcfdfc}
.ar-card.paused .ar-card-body h3{color:var(--muted)}
.ar-card-top{display:flex;gap:12px;align-items:flex-start}
.ar-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;flex-shrink:0;
  background:var(--wa-tint);color:var(--wa-deep)}
.ar-card.paused .ar-ic{background:#f1f5f3;color:var(--faint)}
.ar-card-body{flex:1;min-width:0}
.ar-card-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.ar-card h3{font-size:14.5px;font-weight:750;line-height:1.3}
.ar-card-desc{font-size:12.5px;color:var(--muted);margin:4px 0 0;line-height:1.5}
.ar-pill{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;padding:3px 9px;
  border-radius:99px;white-space:nowrap;flex-shrink:0}
.ar-pill.live{background:var(--wa-tint);color:var(--wa-deep)}
.ar-pill.off{background:#f1f5f3;color:var(--faint)}
.ar-chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 8px;flex:1;align-content:flex-start}
.ar-chip{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:99px;white-space:nowrap}
.ar-chip.trigger{background:var(--wa-bubble);color:#2f5233}
.ar-chip.runs{background:var(--wa-tint);color:var(--wa-deep)}
.ar-chip.quiet{background:#fdf4e7;color:#a1660b}
.ar-meta{font-size:11px;color:var(--faint);margin:0 0 14px}
.ar-card-actions{display:flex;gap:8px;align-items:center}
.ar-card-actions .ar-btn{flex:1}

/* toggle */
.ar-toggle{position:relative;width:42px;height:24px;border-radius:99px;background:#d5ded9;border:none;
  cursor:pointer;transition:.2s;flex-shrink:0;padding:0}
.ar-toggle.on{background:var(--wa)}
.ar-toggle:focus-visible{outline:2px solid var(--wa-deep);outline-offset:2px}
.ar-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.24)}
.ar-toggle.on .ar-knob{left:21px}

/* empty */
.ar-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:56px 20px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.ar-empty-ic{display:grid;place-items:center;width:56px;height:56px;border-radius:17px;
  background:var(--wa-tint);color:var(--wa-deep);margin-bottom:4px}
.ar-empty h3{font-size:16px;font-weight:750}
.ar-empty p{font-size:13px;color:var(--muted);max-width:340px;line-height:1.55;margin:0 0 10px}

@media(prefers-reduced-motion:reduce){.au-rules *{transition:none!important;animation:none!important}}
`
