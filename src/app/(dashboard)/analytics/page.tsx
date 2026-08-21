"use client";

// src/app/(dashboard)/analytics/page.tsx
//
// ── WHAT THIS PAGE IS FOR ────────────────────────────────────────────
// One question: is the agent working, and is it worth what it costs?
//
// The reference layout charts three message counts and two agent
// counters. Those are worth having — they are the shape of the day —
// but on their own they answer "how busy was it", never "is this
// working". So the headline row leads with the numbers that do:
//
//   Handled by AI   — conversations with no human message at all. This
//                     is the entire reason to buy an AI agent, and the
//                     number a merchant should see first.
//   Median reply    — how long a customer waits. A fast wrong answer
//                     and a slow right one are both failures; this
//                     catches the second.
//   Website leads   — what the whole thing was for.
//
// ── NO CHARTING LIBRARY ──────────────────────────────────────────────
// Deliberate, and consistent with conversations-chart.tsx. Adding
// recharts means editing package.json AND package-lock.json, and this
// project is deployed by copying files through a web editor — a
// hand-edited lock file is a broken `npm ci` and a red deploy. The SVG
// below is less clever and costs nothing to ship.

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, Clock, Users, Inbox, Loader2, AlertCircle } from "lucide-react";

interface DayPoint {
  date: string;
  user: number;
  bot: number;
  business: number;
  closed: number;
  intervened: number;
}

interface Analytics {
  from: string;
  to: string;
  days: DayPoint[];
  totals: {
    user: number; bot: number; business: number;
    closed: number; intervened: number;
    conversations: number; deflected: number; deflectionRate: number | null;
    leads: number; medianResponseSeconds: number | null;
  };
  broadcasts: { sent: number; delivered: number; read: number; replied: number; failed: number };
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const;

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => isoDaysAgo(6));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not load analytics."); return; }
      setData(json);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(days: number) {
    setFrom(isoDaysAgo(days - 1));
    setTo(today());
  }

  const activePreset = useMemo(
    () => PRESETS.find((p) => from === isoDaysAgo(p.days - 1) && to === today())?.days ?? null,
    [from, to],
  );

  return (
    <div className="an">
      <style>{css}</style>

      <header className="an-head">
        <div>
          <h1>Analytics</h1>
          <p className="an-sub">How much your agent handled, and what it produced.</p>
        </div>

        <div className="an-range">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={activePreset === p.days ? "an-preset on" : "an-preset"}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </button>
          ))}
          <input type="date" className="an-date" value={from} max={to}
            onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <span className="an-dash">→</span>
          <input type="date" className="an-date" value={to} min={from} max={today()}
            onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
      </header>

      {error && <div className="an-error"><AlertCircle size={15} /> {error}</div>}

      {loading && !data && (
        <div className="an-loading"><Loader2 size={20} className="an-spin" /> Loading…</div>
      )}

      {data && (
        <>
          <div className="an-kpis">
            <Kpi
              icon={<TrendingUp size={16} />}
              label="Handled by AI"
              value={data.totals.deflectionRate === null ? "—" : `${data.totals.deflectionRate}%`}
              foot={
                data.totals.conversations === 0
                  ? "No conversations yet"
                  : `${data.totals.deflected} of ${data.totals.conversations} conversations, no human needed`
              }
              good
            />
            <Kpi
              icon={<Clock size={16} />}
              label="Median reply time"
              value={formatDuration(data.totals.medianResponseSeconds)}
              foot="Customer message → first reply"
            />
            <Kpi
              icon={<Inbox size={16} />}
              label="Website leads"
              value={String(data.totals.leads)}
              foot="Captured in this range"
            />
            <Kpi
              icon={<Users size={16} />}
              label="Human interventions"
              value={String(data.totals.intervened)}
              foot={`${data.totals.closed} conversations closed`}
            />
          </div>

          <Panel
            title="Chats"
            subtitle="per day"
            legend={[
              { key: "user", label: "User messages", color: "#F2C14E", total: data.totals.user },
              { key: "bot", label: "Chatbot messages", color: "#F78154", total: data.totals.bot },
              { key: "business", label: "Business messages", color: "#4babda", total: data.totals.business },
            ]}
          >
            <LineChart
              days={data.days}
              series={[
                { key: "user", color: "#F2C14E" },
                { key: "bot", color: "#F78154" },
                { key: "business", color: "#4babda" },
              ]}
            />
          </Panel>

          <Panel
            title="Agent activity"
            subtitle="per day"
            legend={[
              { key: "closed", label: "Closed", color: "#5FAD56", total: data.totals.closed },
              { key: "intervened", label: "Intervened", color: "#a48ed2", total: data.totals.intervened },
            ]}
          >
            <LineChart
              days={data.days}
              series={[
                { key: "closed", color: "#5FAD56" },
                { key: "intervened", color: "#a48ed2" },
              ]}
            />
          </Panel>

          {/* A funnel rather than five counters: the only interesting
              thing about "read" is what fraction of "delivered" it is. */}
          {data.broadcasts.sent > 0 && (
            <Panel title="Campaign delivery" subtitle="campaigns started in this range" legend={[]}>
              <Funnel
                steps={[
                  { label: "Sent", value: data.broadcasts.sent, color: "#4babda" },
                  { label: "Delivered", value: data.broadcasts.delivered, color: "#5FAD56" },
                  { label: "Read", value: data.broadcasts.read, color: "#F2C14E" },
                  { label: "Replied", value: data.broadcasts.replied, color: "#F78154" },
                ]}
                failed={data.broadcasts.failed}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────────────── pieces ────────────────────────── */

function Kpi({ icon, label, value, foot, good }: {
  icon: React.ReactNode; label: string; value: string; foot: string; good?: boolean;
}) {
  return (
    <div className="an-k">
      <div className="an-k-top">{icon}<span>{label}</span></div>
      <div className={good ? "an-k-val good" : "an-k-val"}>{value}</div>
      <div className="an-k-foot">{foot}</div>
    </div>
  );
}

function Panel({ title, subtitle, legend, children }: {
  title: string; subtitle: string;
  legend: Array<{ key: string; label: string; color: string; total: number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="an-p">
      <div className="an-p-head">
        <h2>{title}</h2><span className="an-p-sub">({subtitle})</span>
      </div>
      {legend.length > 0 && (
        <div className="an-legend">
          {legend.map((l) => (
            <div className="an-leg" key={l.key}>
              <span className="an-dot" style={{ background: l.color }} />
              <div>
                <div className="an-leg-label">{l.label}</div>
                <div className="an-leg-total">{l.total.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

const VB_W = 900;
const VB_H = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 38 };

/**
 * Multi-series line chart over the day buckets.
 *
 * Every day in the range is present in the data — zeros included — so a
 * quiet Sunday draws a dip rather than a straight line across to
 * Monday, which would overstate what happened.
 */
function LineChart({ days, series }: {
  days: DayPoint[];
  series: Array<{ key: keyof DayPoint; color: string }>;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const d of days) for (const s of series) m = Math.max(m, Number(d[s.key]) || 0);
    return niceCeil(m);
  }, [days, series]);

  if (days.length === 0) {
    return <p className="an-empty">Nothing in this range.</p>;
  }

  const innerW = VB_W - PAD.left - PAD.right;
  const innerH = VB_H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (max === 0 ? 0 : (v / max) * innerH);

  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
    .map((v) => Math.round(v))
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="an-lc">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img"
        aria-label={`Daily chart from ${days[0].date} to ${days[days.length - 1].date}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={VB_W - PAD.right} y1={y(t)} y2={y(t)}
              stroke="#eef2f0" strokeDasharray="3 3" />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="11" fill="#9aa8a0">{t}</text>
          </g>
        ))}

        {series.map((s) => (
          <polyline
            key={String(s.key)}
            points={days.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(" ")}
            fill="none" stroke={s.color} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
          />
        ))}

        {/* Endpoints only — a tick per day is unreadable at 90 days. */}
        <text x={PAD.left} y={VB_H - 6} fontSize="11" fill="#9aa8a0">
          {shortDate(days[0].date)}
        </text>
        {days.length > 1 && (
          <text x={VB_W - PAD.right} y={VB_H - 6} textAnchor="end" fontSize="11" fill="#9aa8a0">
            {shortDate(days[days.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  );
}

/**
 * Campaign funnel.
 *
 * Bars scale against the FIRST step rather than each against itself, so
 * the drop-off is the visible thing. Percentages are of sent, because
 * "62% read" only means something relative to how many went out.
 */
function Funnel({ steps, failed }: {
  steps: Array<{ label: string; value: number; color: string }>;
  failed: number;
}) {
  const base = steps[0]?.value || 1;
  return (
    <div className="an-f">
      {steps.map((s) => {
        const pct = Math.round((s.value / base) * 100);
        return (
          <div className="an-f-row" key={s.label}>
            <div className="an-f-label">{s.label}</div>
            <div className="an-f-track">
              <div className="an-f-bar" style={{ width: `${Math.max(pct, 1)}%`, background: s.color }} />
            </div>
            <div className="an-f-val">
              {s.value.toLocaleString()}<span className="an-f-pct">{pct}%</span>
            </div>
          </div>
        );
      })}
      {failed > 0 && (
        <p className="an-f-failed">
          <AlertCircle size={12} /> {failed.toLocaleString()} failed to send — usually an
          invalid number or an expired 24-hour window.
        </p>
      )}
    </div>
  );
}

/* ────────────────────────── helpers ────────────────────────── */

/** Round the axis up to a number a human would have chosen. */
function niceCeil(max: number): number {
  if (max <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / mag) * mag;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "2m 10s" reads faster than "130 seconds" at a glance. */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const css = `
.an { padding: 20px 24px 60px; max-width: 1100px; margin: 0 auto; }
.an-head { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start;
  justify-content:space-between; margin-bottom:20px }
.an-head h1 { font-size:20px; font-weight:700; margin:0; color:#0c1f17 }
.an-sub { margin:3px 0 0; font-size:12.5px; color:#6b7c73 }
.an-range { display:flex; align-items:center; gap:6px; flex-wrap:wrap }
.an-preset { border:1.5px solid #e7ece9; background:#fff; border-radius:9px;
  padding:7px 11px; font-size:12.5px; font-weight:600; color:#5b6b63;
  cursor:pointer; font-family:inherit; transition:.15s }
.an-preset:hover { border-color:#cfd8d3 }
.an-preset.on { background:#10b981; border-color:#10b981; color:#fff }
.an-date { border:1.5px solid #e7ece9; border-radius:9px; padding:6px 9px;
  font-size:12.5px; font-family:inherit; color:#0c1f17; background:#fff }
.an-dash { color:#9aa8a0; font-size:12px }
.an-error { display:flex; align-items:center; gap:8px; background:#fef2f2;
  border:1px solid #fecaca; color:#b91c1c; border-radius:10px;
  padding:11px 14px; font-size:13px; margin-bottom:16px }
.an-loading { display:flex; align-items:center; gap:9px; color:#6b7c73;
  font-size:13.5px; padding:50px 0; justify-content:center }
.an-spin { animation: an-rot 1s linear infinite }
@keyframes an-rot { to { transform: rotate(360deg) } }

.an-kpis { display:grid; gap:12px; margin-bottom:18px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) }
.an-k { background:#fff; border:1px solid #e7ece9; border-radius:14px; padding:15px 16px }
.an-k-top { display:flex; align-items:center; gap:7px; font-size:12px;
  font-weight:600; color:#6b7c73 }
.an-k-val { font-size:27px; font-weight:700; color:#0c1f17; margin:7px 0 2px;
  letter-spacing:-.02em; font-variant-numeric: tabular-nums }
.an-k-val.good { color:#059669 }
.an-k-foot { font-size:11.5px; color:#8a978f; line-height:1.4 }

.an-p { background:#fff; border:1px solid #e7ece9; border-radius:14px;
  padding:18px 20px 12px; margin-bottom:16px }
.an-p-head { display:flex; align-items:baseline; gap:6px }
.an-p-head h2 { font-size:15px; font-weight:700; margin:0; color:#0c1f17 }
.an-p-sub { font-size:12px; color:#8a978f }
.an-legend { display:flex; flex-wrap:wrap; gap:22px; margin:14px 0 4px }
.an-leg { display:flex; align-items:flex-start; gap:7px }
.an-dot { width:9px; height:9px; border-radius:50%; margin-top:5px; flex-shrink:0 }
.an-leg-label { font-size:11.5px; color:#6b7c73; font-weight:600 }
.an-leg-total { font-size:17px; font-weight:700; color:#0c1f17;
  font-variant-numeric: tabular-nums }

.an-lc { margin-top:6px }
.an-empty { color:#8a978f; font-size:13px; padding:40px 0; text-align:center }

.an-f { padding:6px 0 10px }
.an-f-row { display:flex; align-items:center; gap:12px; margin-bottom:9px }
.an-f-label { width:78px; font-size:12.5px; color:#5b6b63; font-weight:600; flex-shrink:0 }
.an-f-track { flex:1; height:22px; background:#f4f7f5; border-radius:6px; overflow:hidden }
.an-f-bar { height:100%; border-radius:6px; transition:width .3s ease }
.an-f-val { width:96px; text-align:right; font-size:13px; font-weight:700;
  color:#0c1f17; font-variant-numeric: tabular-nums; flex-shrink:0 }
.an-f-pct { display:inline-block; width:44px; font-size:11.5px; font-weight:600; color:#8a978f }
.an-f-failed { display:flex; align-items:center; gap:5px; margin:10px 0 0;
  font-size:11.5px; color:#b45309 }

@media (max-width: 640px) {
  .an { padding: 16px 14px 50px }
  .an-f-label { width:62px }
  .an-f-val { width:80px }
}
`;
