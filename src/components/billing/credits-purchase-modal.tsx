"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Wallet, Zap, Info } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  /** Called after a successful credit so the parent can refresh the balance. */
  onSuccess?: (newBalance: number) => void;
}

const PRESETS = [1000, 2500, 5000, 10000, 50000];

/** Bonus tiers — mirror your CREDIT_PACKS in plans.ts. */
function bonusFor(amount: number): number {
  if (amount >= 5000) return Math.round(amount * 0.1); // 10%
  if (amount >= 2500) return 200;
  if (amount >= 1000) return 50;
  return 0;
}

export function CreditsPurchaseModal({ open, onClose, currentBalance, onSuccess }: Props) {
  const [amount, setAmount] = useState<number>(1000);
  const [busy, setBusy] = useState(false);
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [minAmount, setMinAmount] = useState<number>(500);
  const [rechargeAmount, setRechargeAmount] = useState<number>(5000);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const bonus = bonusFor(amount);

  async function loadRazorpayScript(): Promise<boolean> {
    if (window.Razorpay) return true;
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function handlePurchase() {
    if (amount < 100) { toast.error("Minimum recharge is ₹100"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, bonus }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Recharge failed");
        return;
      }

      // Manual fallback mode — wallet already credited server-side.
      if (data.mode === "manual") {
        toast.success(`₹${amount} added${bonus ? ` (+₹${bonus} bonus)` : ""}!`);
        onSuccess?.(Number(data.newBalance));
        onClose();
        return;
      }

      // Razorpay mode — open checkout.
      if (data.mode === "razorpay") {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          toast.error("Couldn't load payment gateway");
          return;
        }
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "AiSend",
          description: `Conversation credits recharge ₹${amount}`,
          order_id: data.order.id,
          theme: { color: "#16a34a" },
          handler: async (resp: Record<string, string>) => {
            // Verify + credit on the server.
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...resp, amount, bonus }),
            });
            const vd = await v.json();
            if (v.ok) {
              toast.success(`₹${amount} added to your wallet!`);
              onSuccess?.(Number(vd.newBalance));
              onClose();
            } else {
              toast.error(vd.error || "Payment verification failed");
            }
          },
        });
        rzp.open();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="cc-overlay" onClick={onClose}>
      <style>{styles}</style>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cc-head">
          <div className="cc-head-title">
            <div className="cc-head-ic"><Wallet size={16} /></div>
            Purchase Conversation Credits
          </div>
          <button className="cc-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cc-body">
          {/* Current balance pill */}
          <div className="cc-balance">
            Current balance <strong>₹{currentBalance.toFixed(2)}</strong>
          </div>

          {/* Enter amount */}
          <div className="cc-card">
            <label className="cc-label">Enter Credit Amount</label>
            <p className="cc-hint">Minimum purchase of ₹100 credits is allowed</p>
            <div className="cc-input-wrap">
              <span className="cc-rupee">₹</span>
              <input
                type="number" min={100} value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="cc-input"
              />
            </div>

            <div className="cc-presets">
              {PRESETS.map((p) => (
                <button key={p}
                  className={`cc-preset ${amount === p ? "active" : ""}`}
                  onClick={() => setAmount(p)}>
                  +{p.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            {bonus > 0 && (
              <div className="cc-bonus"><Zap size={13} /> You get ₹{bonus} bonus credits on this recharge!</div>
            )}

            <button className="cc-buy" onClick={handlePurchase} disabled={busy}>
              {busy ? <><Loader2 size={16} className="cc-spin" /> Processing…</>
                    : <>Purchase Now · ₹{(amount + bonus).toLocaleString("en-IN")}</>}
            </button>
          </div>

          {/* Auto-recharge */}
          <div className="cc-card">
            <div className="cc-auto-head">
              <span>Enable auto-recharge</span>
              <button
                className={`cc-toggle ${autoRecharge ? "on" : ""}`}
                onClick={() => setAutoRecharge((v) => !v)}
                aria-label="Toggle auto-recharge">
                <span className="cc-knob" />
              </button>
            </div>

            <div className={`cc-auto-body ${autoRecharge ? "" : "disabled"}`}>
              <label className="cc-label-sm">
                Minimum balance <Info size={11} />
              </label>
              <div className="cc-input-wrap sm">
                <span className="cc-rupee">₹</span>
                <input type="number" value={minAmount} disabled={!autoRecharge}
                  onChange={(e) => setMinAmount(Number(e.target.value))} className="cc-input" />
              </div>

              <label className="cc-label-sm">
                Auto-recharge amount <Info size={11} />
              </label>
              <div className="cc-input-wrap sm">
                <span className="cc-rupee">₹</span>
                <input type="number" value={rechargeAmount} disabled={!autoRecharge}
                  onChange={(e) => setRechargeAmount(Number(e.target.value))} className="cc-input" />
              </div>

              <p className="cc-hint">
                auto-recharge of ₹{rechargeAmount.toLocaleString("en-IN")} will be initiated
                when balance goes below ₹{minAmount.toLocaleString("en-IN")}
              </p>

              <button className="cc-save" disabled={!autoRecharge}
                onClick={() => toast.success("Auto-recharge settings saved")}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles = `
.cc-overlay{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;padding:16px;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;animation:ccFade .18s ease}
@keyframes ccFade{from{opacity:0}to{opacity:1}}
.cc-modal{background:#fff;border-radius:18px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;
  box-shadow:0 24px 60px rgba(15,23,42,.28);animation:ccPop .2s cubic-bezier(.2,.7,.3,1)}
@keyframes ccPop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.cc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eef2f0;position:sticky;top:0;background:#fff;z-index:1}
.cc-head-title{display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:800;color:#0f172a;font-family:"Sora",sans-serif;letter-spacing:-.01em}
.cc-head-ic{width:28px;height:28px;border-radius:8px;background:#f0fdf4;color:#15803d;display:grid;place-items:center;flex-shrink:0}
.cc-x{background:#f1f5f9;border:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:#64748b;transition:.15s}
.cc-x:hover{background:#e2e8f0;color:#0f172a}
.cc-body{padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.cc-balance{font-size:12.5px;color:#64748b;background:#f8fafc;border:1px solid #eef2f0;border-radius:10px;padding:9px 13px}
.cc-balance strong{color:#15803d;font-family:"Sora";font-weight:800;margin-left:4px}
.cc-card{border:1px solid #eef2f0;border-radius:14px;padding:16px}
.cc-label{font-size:14px;font-weight:800;color:#0f172a;font-family:"Sora";display:block}
.cc-label-sm{font-size:12px;font-weight:700;color:#475569;display:flex;align-items:center;gap:4px;margin:10px 0 5px}
.cc-label-sm svg{color:#94a3b8}
.cc-hint{font-size:11.5px;color:#94a3b8;margin:3px 0 12px;line-height:1.4}
.cc-input-wrap{display:flex;align-items:center;border:1.5px solid #e2e8f0;border-radius:11px;padding:0 13px;transition:.15s}
.cc-input-wrap:focus-within{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.cc-input-wrap.sm{padding:0 11px}
.cc-rupee{color:#64748b;font-weight:700;font-size:15px}
.cc-input{border:none;outline:none;padding:11px 8px;font-size:15px;font-weight:700;width:100%;font-family:"Sora",sans-serif;color:#0f172a;background:transparent}
.cc-input:disabled{color:#94a3b8}
.cc-presets{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:11px}
.cc-preset{border:1.5px solid #e2e8f0;background:#fff;border-radius:9px;padding:8px 4px;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer;transition:.15s;font-family:inherit;white-space:nowrap}
.cc-preset:hover{border-color:#16a34a;color:#15803d}
.cc-preset.active{background:#f0fdf4;border-color:#16a34a;color:#15803d}
.cc-bonus{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#15803d;background:#f0fdf4;border-radius:9px;padding:8px 11px;margin-top:11px}
.cc-bonus svg{color:#f59e0b}
.cc-buy{width:100%;margin-top:13px;background:#16a34a;color:#fff;border:none;border-radius:11px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:.16s;font-family:inherit;box-shadow:0 6px 18px rgba(22,163,74,.3)}
.cc-buy:hover:not(:disabled){background:#15803d;transform:translateY(-1px)}
.cc-buy:disabled{opacity:.7;cursor:default}
.cc-auto-head{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:800;color:#0f172a;font-family:"Sora"}
.cc-toggle{width:42px;height:24px;border-radius:99px;background:#cbd5e1;border:none;cursor:pointer;position:relative;transition:.2s;padding:0}
.cc-toggle.on{background:#16a34a}
.cc-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.cc-toggle.on .cc-knob{left:21px}
.cc-auto-body.disabled{opacity:.55}
.cc-save{margin-top:12px;width:100%;background:#f1f5f9;color:#475569;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s}
.cc-save:not(:disabled):hover{background:#e2e8f0}
.cc-save:disabled{cursor:default;opacity:.6}
.cc-spin{animation:ccSpin .8s linear infinite}
@keyframes ccSpin{to{transform:rotate(360deg)}}
`;
