"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Gift, Loader2, Check, Copy, Users, MessageSquareHeart,
  Handshake, TrendingUp, ArrowRight, Infinity as InfinityIcon,
} from "lucide-react";

/* All dashboard promo cards in one component. Professional palette:
 * deep emerald brand + slate neutrals + restrained accent tints.
 * Each card fetches its own data client-side (matches existing pattern). */
export function PromoSection() {
  const { profile } = useAuth();

  const [referralCode, setReferralCode] = useState<string>("");
  const [referralCount, setReferralCount] = useState<number>(0);
  const [referralEarned, setReferralEarned] = useState<number>(0);
  const [freeUsed, setFreeUsed] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Offer code state
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!profile?.org_id) return;
    const db = createClient();
    (async () => {
      // Referral code + stats
      const { data: org } = await db
        .from("organizations")
        .select("referral_code")
        .eq("id", profile.org_id)
        .maybeSingle();
      if (org?.referral_code) setReferralCode(org.referral_code);

      const { data: refs } = await db
        .from("referrals")
        .select("reward_amount, rewarded")
        .eq("referrer_org", profile.org_id);
      if (refs) {
        setReferralCount(refs.length);
        setReferralEarned(
          refs.filter((r) => r.rewarded).reduce((s, r) => s + Number(r.reward_amount || 0), 0),
        );
      }

      // Free service conversations used this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count } = await db
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString());
      setFreeUsed(count ?? 0);
    })();
  }, [profile?.org_id]);

  const referralLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : "";

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function redeem() {
    if (!code.trim()) { toast.error("Enter a code"); return; }
    setRedeeming(true);
    try {
      const res = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Could not redeem"); return; }
      toast.success(`₹${data.credited} credited to your wallet!`);
      setCode("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRedeeming(false);
    }
  }

  // Free service: Meta gives 1000/mo. Show used vs that allowance.
  const FREE_ALLOWANCE = 1000;
  const freePct = Math.min(100, (freeUsed / FREE_ALLOWANCE) * 100);

  return (
    <div className="promo">
      <style>{styles}</style>

      {/* ── Offer code banner ── */}
      <div className="promo-offer">
        <div className="promo-offer-ic"><Gift size={22} /></div>
        <div className="promo-offer-text">
          <h4>Got an offer code?</h4>
          <p>Redeem it to add bonus credits to your wallet instantly.</p>
        </div>
        <div className="promo-offer-action">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="promo-offer-input"
            onKeyDown={(e) => e.key === "Enter" && redeem()}
          />
          <button className="promo-offer-btn" onClick={redeem} disabled={redeeming}>
            {redeeming ? <Loader2 size={14} className="promo-spin" /> : <>Redeem <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* ── Free Service Conversation bar ── */}
      <div className="promo-card promo-free">
        <div className="promo-free-head">
          <span>Free Service Conversations</span>
          <span className="promo-free-cap"><InfinityIcon size={15} /> {FREE_ALLOWANCE}/mo</span>
        </div>
        <div className="promo-bar"><div className="promo-bar-fill" style={{ width: `${freePct}%` }} /></div>
        <div className="promo-free-foot">
          <span>{freeUsed} used</span>
          <span>{Math.max(0, FREE_ALLOWANCE - freeUsed)} remaining</span>
        </div>
      </div>

      {/* ── 2x2 promo grid ── */}
      <div className="promo-grid">
        {/* Refer & Earn */}
        <div className="promo-card promo-refer">
          <div className="promo-card-head">
            <div className="promo-tag promo-tag-emerald"><Users size={15} /></div>
            <h4>Refer &amp; Earn</h4>
          </div>
          <p className="promo-desc">Invite other businesses and earn ₹500 in credits for each one that signs up.</p>
          <div className="promo-stats">
            <div className="promo-stat">
              <span className="promo-stat-val">₹{referralEarned}</span>
              <span className="promo-stat-lbl">Earned</span>
            </div>
            <div className="promo-stat">
              <span className="promo-stat-val">{referralCount}</span>
              <span className="promo-stat-lbl">Signed up</span>
            </div>
          </div>
          <div className="promo-link-row">
            <input readOnly value={referralLink || "Loading…"} className="promo-link-input" />
            <button className="promo-copy" onClick={copyLink}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
        </div>

        {/* Share Feedback */}
        <div className="promo-card promo-feedback">
          <div className="promo-card-head">
            <div className="promo-tag promo-tag-indigo"><MessageSquareHeart size={15} /></div>
            <h4>Share Feedback &amp; Earn Credits</h4>
          </div>
          <p className="promo-desc">Tell us how we&apos;re doing and earn credits instantly.</p>
          <ul className="promo-list">
            <li>Video review <strong>₹500</strong></li>
            <li>Written review <strong>₹150</strong></li>
            <li>App store rating <strong>₹100</strong></li>
          </ul>
          <button className="promo-ghost" onClick={() => toast("Feedback flow coming soon")}>
            Share now <ArrowRight size={13} />
          </button>
        </div>

        {/* Affiliate */}
        <div className="promo-card promo-affiliate">
          <div className="promo-card-head">
            <div className="promo-tag promo-tag-amber"><Handshake size={15} /></div>
            <h4>Affiliate Program</h4>
          </div>
          <p className="promo-desc">For agencies &amp; freelancers — earn 20% recurring commission on every plan, for life.</p>
          <button className="promo-ghost" onClick={() => toast("Affiliate signup coming soon")}>
            Become an affiliate <ArrowRight size={13} />
          </button>
        </div>

        {/* Grow / upsell */}
        <div className="promo-card promo-grow">
          <div className="promo-card-head">
            <div className="promo-tag promo-tag-slate"><TrendingUp size={15} /></div>
            <h4>Grow Faster</h4>
          </div>
          <p className="promo-desc">Unlock higher messaging limits, more team seats, and priority support.</p>
          <button className="promo-solid" onClick={() => { window.location.href = "/billing"; }}>
            Explore plans <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
.promo{
  --brand:#16a34a;--brand-deep:#15803d;--brand-50:#f0fdf4;
  --indigo:#4f46e5;--indigo-50:#eef2ff;--amber:#d97706;--amber-50:#fffbeb;
  --slate:#475569;--slate-50:#f8fafc;
  --ink:#0f172a;--muted:#64748b;--line:#e8edf0;
  display:flex;flex-direction:column;gap:14px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.promo h4{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.01em;margin:0;color:var(--ink)}
.promo-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.04),0 6px 20px rgba(15,23,42,.05)}

/* Offer banner */
.promo-offer{display:flex;align-items:center;gap:14px;padding:15px 18px;border-radius:16px;
  background:linear-gradient(110deg,#0f766e,#15803d);color:#fff;box-shadow:0 6px 20px rgba(15,23,42,.1);position:relative;overflow:hidden}
.promo-offer::after{content:"";position:absolute;right:-30px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.07)}
.promo-offer-ic{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.18);display:grid;place-items:center;flex-shrink:0}
.promo-offer-text{flex:1;min-width:0}
.promo-offer-text h4{color:#fff;font-size:15px}
.promo-offer-text p{margin:2px 0 0;font-size:12px;opacity:.88}
.promo-offer-action{display:flex;gap:8px;flex-shrink:0}
.promo-offer-input{border:none;border-radius:9px;padding:9px 12px;font-size:13px;font-weight:600;width:120px;outline:none;font-family:inherit;text-transform:uppercase}
.promo-offer-btn{background:#fff;color:var(--brand-deep);border:none;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit;white-space:nowrap;transition:.15s}
.promo-offer-btn:hover:not(:disabled){background:#f0fdf4}
.promo-offer-btn:disabled{opacity:.7}
@media(max-width:560px){.promo-offer{flex-wrap:wrap}.promo-offer-action{width:100%}.promo-offer-input{flex:1;width:auto}}

/* Free service bar */
.promo-free{padding:16px 18px}
.promo-free-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.promo-free-head span:first-child{font-size:13.5px;font-weight:700;color:var(--ink)}
.promo-free-cap{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--brand-deep);background:var(--brand-50);padding:3px 9px;border-radius:7px}
.promo-bar{height:8px;border-radius:99px;background:#eef2f0;overflow:hidden}
.promo-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#16a34a,#0f766e);transition:width .6s cubic-bezier(.2,.7,.3,1)}
.promo-free-foot{display:flex;justify-content:space-between;margin-top:8px;font-size:11.5px;color:var(--muted);font-weight:600}

/* Grid */
.promo-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:680px){.promo-grid{grid-template-columns:repeat(2,1fr)}}
.promo-card-head{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.promo-card-head h4{font-size:14.5px}
.promo-tag{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
.promo-tag-emerald{background:var(--brand-50);color:var(--brand-deep)}
.promo-tag-indigo{background:var(--indigo-50);color:var(--indigo)}
.promo-tag-amber{background:var(--amber-50);color:var(--amber)}
.promo-tag-slate{background:var(--slate-50);color:var(--slate)}
.promo-desc{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0}
.promo-refer,.promo-feedback,.promo-affiliate,.promo-grow{padding:18px}

/* Refer */
.promo-stats{display:flex;gap:10px;margin:13px 0}
.promo-stat{flex:1;background:var(--brand-50);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column}
.promo-stat-val{font-family:"Sora";font-size:18px;font-weight:800;color:var(--brand-deep)}
.promo-stat-lbl{font-size:11px;color:var(--muted);font-weight:600;margin-top:1px}
.promo-link-row{display:flex;gap:7px}
.promo-link-input{flex:1;min-width:0;border:1.5px solid var(--line);border-radius:9px;padding:8px 11px;font-size:11.5px;color:var(--muted);background:var(--slate-50);outline:none;font-family:inherit}
.promo-copy{background:var(--brand);color:#fff;border:none;border-radius:9px;padding:8px 13px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit;white-space:nowrap;transition:.15s}
.promo-copy:hover{background:var(--brand-deep)}

/* Feedback list */
.promo-list{list-style:none;margin:12px 0;padding:0;display:flex;flex-direction:column;gap:6px}
.promo-list li{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);padding:6px 11px;background:var(--slate-50);border-radius:8px}
.promo-list strong{color:var(--ink);font-family:"Sora";font-weight:700}

/* Buttons */
.promo-ghost{margin-top:auto;background:none;border:none;color:var(--brand-deep);font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit;padding:0}
.promo-ghost:hover{gap:8px}
.promo-solid{margin-top:13px;width:100%;background:var(--ink);color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:.15s}
.promo-solid:hover{background:#1e293b}
.promo-affiliate,.promo-grow{display:flex;flex-direction:column}

.promo-spin{animation:promoSpin .8s linear infinite}
@keyframes promoSpin{to{transform:rotate(360deg)}}
`;
