"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { loadMetrics, loadActivity } from "@/lib/dashboard/queries";
import type { MetricsBundle, ActivityItem } from "@/lib/dashboard/types";
import {
  MessageSquare, Users, Send, TrendingUp, Zap, QrCode,
  Crown, CheckCircle2, AlertCircle, Sparkles, ArrowRight,
  RefreshCw, Smartphone, BarChart3, Radio, Link2,
} from "lucide-react";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(() => {
    const db = createClient();
    void loadMetrics(db).then(setMetrics).catch(console.error).finally(() => setLoading(false));
    void loadActivity(db, 5).then(setActivity).catch(console.error);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const businessName = profile?.business_name || "Your Business";
  const remainingQuota = metrics?.messagesSentToday ? 250 - (metrics.messagesSentToday.current || 0) : 250;

  return (
    <div className="cwa-dash">
      <style>{cssStyles}</style>

      {/* Top banner */}
      <div className="cwa-banner cwa-fade cwa-d1">
        <span className="cwa-banner-emoji"><Sparkles size={30} /></span>
        <div>
          <h3>You&apos;re on the new marketing API <span className="cwa-tag-up">PRO</span></h3>
          <p>30% better delivery and deeper insights with the latest WhatsApp marketing APIs.</p>
        </div>
        <button className="cwa-btn cwa-btn-white"><Zap size={15} /> Upgrade for Free</button>
      </div>

      <div className="cwa-grid">
        {/* LEFT COLUMN */}
        <div className="cwa-left">
          {/* Stats */}
          <div className="cwa-card cwa-stats cwa-fade cwa-d2">
            <div className="cwa-stat">
              <span className="cwa-stat-label">API Status</span>
              <span className="cwa-badge cwa-badge-green">● LIVE</span>
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Quality Rating</span>
              <span className="cwa-badge cwa-badge-green">HIGH</span>
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Remaining Quota</span>
              <span className="cwa-stat-big">{loading ? "—" : remainingQuota}</span>
            </div>
          </div>

          {/* Real metrics row */}
          <div className="cwa-metrics cwa-fade cwa-d2">
            <MetricMini icon={<MessageSquare size={16} />} label="Active Chats" value={metrics?.activeConversations.current ?? 0} loading={loading} />
            <MetricMini icon={<Users size={16} />} label="New Contacts" value={metrics?.newContactsToday.current ?? 0} loading={loading} />
            <MetricMini icon={<Send size={16} />} label="Sent Today" value={metrics?.messagesSentToday.current ?? 0} loading={loading} />
            <MetricMini icon={<TrendingUp size={16} />} label="Open Deals" value={metrics?.openDealsCount ?? 0} loading={loading} />
          </div>

          {/* Progress steps */}
          <div className="cwa-card cwa-steps-card cwa-fade cwa-d3">
            <div className="cwa-steps-head">
              <Crown size={24} className="cwa-bag" />
              <h3>Complete the steps &amp; win 200 Conversation Credits</h3>
            </div>
            <div className="cwa-steps">
              <div className="cwa-track"><div className="cwa-track-fill" /></div>
              <Step state="done" title="Get API Live" />
              <Step state="pending" title="Business Verified" desc="FBM / KYC" />
              <Step state="pending" title="Recharge Credits" />
              <Step state="pending" title="Spend 500" />
              <Step state="reward" title="Reward Won" />
            </div>
          </div>

          {/* Setup task */}
          <div className="cwa-card cwa-setup cwa-fade cwa-d4">
            <div className="cwa-setup-row">
              <h3>🟢 Setup WhatsApp Business Account</h3>
              <span className="cwa-meta">3 steps left</span>
            </div>
            <span className="cwa-next-pill">NEXT</span>
            <div className="cwa-task">
              <div className="cwa-task-ic"><AlertCircle size={20} /></div>
              <div>
                <h4>Increase messaging limit &amp; get display name approved</h4>
                <p className="cwa-task-desc">Complete KYC to boost your messaging limit to 2000 and get name approval.</p>
                <ul className="cwa-task-list">
                  <li>Legal / Trade name on GST and Business Manager should match</li>
                  <li>Ensure you have an active website before applying for KYC</li>
                  <li>Use director&apos;s ID listed on your GST document</li>
                </ul>
                <button className="cwa-btn cwa-btn-primary">Start KYC</button>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          {activity && activity.length > 0 && (
            <div className="cwa-card cwa-activity cwa-fade cwa-d5">
              <h4 style={{ marginBottom: 14 }}>Recent Activity</h4>
              {activity.map((a) => (
                <div key={a.id} className="cwa-activity-row">
                  <div className="cwa-activity-ic"><Users size={15} /></div>
               <span className="cwa-activity-text">{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="cwa-right">
          {/* QR card */}
          <div className="cwa-card cwa-qr-wrap cwa-fade cwa-d2">
            <h4 style={{ alignSelf: "flex-start" }}>Scan to get the mobile app</h4>
            <div className="cwa-qr"><QrCode size={70} strokeWidth={1} /></div>
            <div className="cwa-store">
              <span>Google Play</span><span>App Store</span>
            </div>
            <div className="cwa-divider" style={{ width: "100%" }} />
            <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--cwa-muted)", fontWeight: 700, letterSpacing: ".04em" }}>KEY FEATURES</div>
            <div className="cwa-feat">
              <div><Radio size={13} /> Real-time alerts</div>
              <div><MessageSquare size={13} /> Live Chat</div>
              <div><BarChart3 size={13} /> Ads Management</div>
              <div><TrendingUp size={13} /> Analytics</div>
            </div>
          </div>

          {/* Profile / number */}
          <div className="cwa-card cwa-profile cwa-fade cwa-d3">
            <div className="cwa-profile-pic">{businessName.charAt(0).toUpperCase()}</div>
            <div>
              <div className="cwa-ptag">{businessName.toUpperCase()}</div>
              <div className="cwa-num">{profile?.slug ? `+91 ••••• •••••` : "Not connected"}</div>
              <small>wa.clickstream.com/{profile?.slug || "yourbiz"}</small>
            </div>
          </div>

          {/* Conversation credits */}
          <div className="cwa-card cwa-wcc cwa-fade cwa-d4">
            <h4>Free Service Conversations</h4>
            <div className="cwa-meter"><i /></div>
            <div className="cwa-scale"><span>0</span><span>Unlimited</span></div>
            <div className="cwa-divider" />
            <h4>Conversation Credits</h4>
            <div className="cwa-price">
              <span className="cwa-amt">₹ 50.00</span>
              <button className="cwa-btn cwa-btn-primary">Buy More</button>
            </div>
          </div>

          {/* Link card */}
          <div className="cwa-card cwa-rc cwa-fade cwa-d5">
            <h4>Customize WhatsApp Link</h4>
            <p>Create shareable links &amp; QR codes for your WhatsApp business number.</p>
            <div style={{ marginTop: 14 }}>
              <a className="cwa-link" href="#">Create link <ArrowRight size={13} style={{ verticalAlign: -2 }} /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricMini({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <div className="cwa-card cwa-metric-mini">
      <div className="cwa-metric-icon">{icon}</div>
      <div>
        <div className="cwa-metric-value">{loading ? "—" : value}</div>
        <div className="cwa-metric-label">{label}</div>
      </div>
    </div>
  );
}

function Step({ state, title, desc }: { state: "done" | "pending" | "reward"; title: string; desc?: string }) {
  return (
    <div className={`cwa-step cwa-step-${state}`}>
      <div className="cwa-step-circle">
        {state === "done" ? <CheckCircle2 size={16} /> : state === "reward" ? <Crown size={16} /> : "!"}
      </div>
      <div className="cwa-step-title">{title}</div>
      {state !== "reward" && (
        <div className="cwa-step-state" style={{ color: state === "done" ? "#34c77b" : "#e6a817" }}>
          {state === "done" ? "DONE" : "PENDING"}
        </div>
      )}
      {desc && <div className="cwa-step-desc">{desc}</div>}
    </div>
  );
}

const cssStyles = `
.cwa-dash {
  --cwa-brand:#10b981;
  --cwa-brand-deep:#059669;
  --cwa-brand-50:#ecfdf5;
  --cwa-brand-100:#d1fae5;
  --cwa-ink:#0c1f17;
  --cwa-muted:#5b6b63;
  --cwa-line:#e7ece9;
  --cwa-card:#ffffff;
  --cwa-gold:#e6a817;
  --cwa-r:16px;
  --cwa-shadow:0 1px 2px rgba(12,31,23,.04),0 8px 24px rgba(12,31,23,.06);
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;
  padding:24px;
  color:var(--cwa-ink);
}
.cwa-dash h1,.cwa-dash h2,.cwa-dash h3,.cwa-dash h4{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.02em}
.cwa-grid{display:grid;grid-template-columns:1fr 340px;gap:22px;align-items:start;margin-top:22px}
@media(max-width:1100px){.cwa-grid{grid-template-columns:1fr}}
.cwa-left{display:flex;flex-direction:column;gap:22px}
.cwa-right{display:flex;flex-direction:column;gap:22px}
.cwa-card{background:var(--cwa-card);border:1px solid var(--cwa-line);border-radius:var(--cwa-r);box-shadow:var(--cwa-shadow)}
.cwa-banner{border-radius:var(--cwa-r);padding:22px 26px;color:#fff;background:radial-gradient(120% 160% at 0% 0%,#13d188 0%,var(--cwa-brand-deep) 55%,#065f46 100%);display:flex;align-items:center;gap:20px;box-shadow:var(--cwa-shadow);overflow:hidden;position:relative}
.cwa-banner::after{content:"";position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}
.cwa-banner-emoji{display:grid;place-items:center}
.cwa-banner h3{font-size:18px;margin-bottom:4px}
.cwa-banner p{font-size:13.5px;opacity:.9}
.cwa-tag-up{background:rgba(255,255,255,.2);font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:.06em;margin-left:8px;vertical-align:middle}
.cwa-btn{border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:13.5px;padding:10px 18px;border-radius:11px;display:inline-flex;align-items:center;gap:8px;transition:.18s}
.cwa-btn-primary{background:var(--cwa-brand);color:#fff;box-shadow:0 6px 18px rgba(16,185,129,.32)}
.cwa-btn-primary:hover{background:var(--cwa-brand-deep);transform:translateY(-1px)}
.cwa-btn-white{margin-left:auto;background:#fff;color:var(--cwa-brand-deep);white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.cwa-stats{display:grid;grid-template-columns:repeat(3,1fr);padding:22px 26px}
.cwa-stat{display:flex;flex-direction:column;gap:8px;padding-right:22px}
.cwa-stat+.cwa-stat{border-left:1px solid var(--cwa-line);padding-left:22px}
.cwa-stat-label{font-size:12.5px;color:var(--cwa-muted);font-weight:600}
.cwa-badge{font-size:11px;font-weight:800;padding:5px 11px;border-radius:8px;width:max-content}
.cwa-badge-green{background:var(--cwa-brand-50);color:var(--cwa-brand-deep)}
.cwa-stat-big{font-family:"Sora";font-size:26px;font-weight:700}
.cwa-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.cwa-metric-mini{display:flex;align-items:center;gap:10px;padding:16px}
.cwa-metric-icon{width:36px;height:36px;border-radius:10px;background:var(--cwa-brand-50);color:var(--cwa-brand-deep);display:grid;place-items:center;flex-shrink:0}
.cwa-metric-value{font-family:"Sora";font-size:20px;font-weight:700;line-height:1}
.cwa-metric-label{font-size:11px;color:var(--cwa-muted);font-weight:600;margin-top:3px}
.cwa-steps-card{padding:24px 26px;background:linear-gradient(135deg,#059669,#065f46);color:#fff;border:none}
.cwa-steps-head{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.cwa-bag{flex-shrink:0}
.cwa-steps-head h3{font-size:16px}
.cwa-steps{display:flex;align-items:flex-start;justify-content:space-between;position:relative}
.cwa-step{display:flex;flex-direction:column;align-items:center;text-align:center;flex:1;position:relative;z-index:2;gap:8px}
.cwa-step-circle{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:14px}
.cwa-step-done .cwa-step-circle{background:#34c77b;color:#06351f}
.cwa-step-pending .cwa-step-circle{background:var(--cwa-gold);color:#3a2900}
.cwa-step-reward .cwa-step-circle{background:rgba(255,255,255,.2);color:#fff}
.cwa-step-title{font-size:11px;font-weight:700;opacity:.9}
.cwa-step-state{font-size:9px;font-weight:800;letter-spacing:.08em;opacity:.85;margin-top:-3px}
.cwa-step-desc{font-size:11px;opacity:.7;line-height:1.3;max-width:110px}
.cwa-track{position:absolute;top:17px;left:8%;right:8%;height:3px;background:rgba(255,255,255,.18);z-index:1}
.cwa-track-fill{height:100%;width:18%;background:#34c77b;border-radius:3px}
.cwa-setup{padding:24px 26px}
.cwa-setup-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.cwa-setup h3{font-size:17px}
.cwa-meta{font-size:12.5px;color:var(--cwa-muted);font-weight:600}
.cwa-next-pill{background:var(--cwa-brand-50);color:var(--cwa-brand-deep);font-size:10px;font-weight:800;padding:4px 10px;border-radius:7px;letter-spacing:.05em;width:max-content;margin:16px 0 8px;display:inline-block}
.cwa-task{background:var(--cwa-brand-50);border-radius:13px;padding:18px 20px;display:flex;gap:14px}
.cwa-task-ic{width:38px;height:38px;border-radius:11px;background:var(--cwa-gold);display:grid;place-items:center;flex-shrink:0;color:#3a2900}
.cwa-task h4{font-size:15px;margin-bottom:8px}
.cwa-task-desc{font-size:12.5px;color:var(--cwa-muted)}
.cwa-task-list{margin:8px 0 0 2px;list-style:none;display:flex;flex-direction:column;gap:6px}
.cwa-task-list li{font-size:12.5px;color:var(--cwa-muted);padding-left:16px;position:relative}
.cwa-task-list li::before{content:"";position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:var(--cwa-brand)}
.cwa-task .cwa-btn{margin-top:16px}
.cwa-activity{padding:20px 24px}
.cwa-activity-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--cwa-line)}
.cwa-activity-row:last-child{border-bottom:none}
.cwa-activity-ic{width:32px;height:32px;border-radius:9px;background:var(--cwa-brand-50);color:var(--cwa-brand-deep);display:grid;place-items:center;flex-shrink:0}
.cwa-activity-text{font-size:13px;color:var(--cwa-ink)}
.cwa-qr-wrap{display:grid;place-items:center;gap:14px;padding:22px}
.cwa-qr{width:140px;height:140px;border-radius:12px;display:grid;place-items:center;background:var(--cwa-brand-50);color:var(--cwa-brand-deep);border:6px solid #fff;box-shadow:var(--cwa-shadow)}
.cwa-store{display:flex;gap:8px}
.cwa-store span{background:var(--cwa-ink);color:#fff;font-size:11px;font-weight:600;padding:8px 12px;border-radius:9px}
.cwa-feat{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;width:100%}
.cwa-feat div{font-size:12px;color:var(--cwa-muted);display:flex;align-items:center;gap:7px}
.cwa-profile{display:flex;align-items:center;gap:14px;padding:20px}
.cwa-profile-pic{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#6ee7b7,#10b981);flex-shrink:0;display:grid;place-items:center;color:#053b2a;font-weight:800;font-family:"Sora"}
.cwa-num{font-family:"Sora";font-weight:700;font-size:17px}
.cwa-ptag{font-size:10px;font-weight:800;color:var(--cwa-muted);letter-spacing:.06em}
.cwa-profile small{color:var(--cwa-muted);font-size:11.5px}
.cwa-wcc{padding:20px}
.cwa-meter{height:8px;background:#f1f5f4;border-radius:99px;margin:10px 0 6px;overflow:hidden}
.cwa-meter i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--cwa-brand),#34c77b)}
.cwa-scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--cwa-muted);font-weight:600}
.cwa-price{display:flex;align-items:center;justify-content:space-between;margin-top:16px}
.cwa-amt{font-family:"Sora";font-size:22px;font-weight:700}
.cwa-rc{padding:20px}
.cwa-rc h4{font-size:15px;margin-bottom:4px}
.cwa-rc p{font-size:12.5px;color:var(--cwa-muted);line-height:1.45}
.cwa-link{color:var(--cwa-brand-deep);font-weight:700;font-size:13px;text-decoration:none}
.cwa-divider{height:1px;background:var(--cwa-line);margin:16px 0}
.cwa-fade{opacity:0;transform:translateY(14px);animation:cwaRise .6s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes cwaRise{to{opacity:1;transform:none}}
.cwa-d1{animation-delay:.05s}.cwa-d2{animation-delay:.12s}.cwa-d3{animation-delay:.2s}.cwa-d4{animation-delay:.28s}.cwa-d5{animation-delay:.36s}
`;
