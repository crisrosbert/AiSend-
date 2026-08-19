// src/components/auth/signup-styles.ts
//
// Styles for /signup only.
//
// ── WHY SIGNUP HAS ITS OWN SHEET ─────────────────────────────────────
// Signup and login sit either side of the same decision, but they are
// not the same job. Somebody logging in is already sold and wants speed;
// somebody signing up is deciding. So signup carries a value panel and
// login stays lean. Sharing one stylesheet would have meant every
// persuasion change risking the page people use every day.
//
// ── THE MOBILE ORDERING DECISION ─────────────────────────────────────
// On a phone the form comes FIRST and the value panel sits below it.
// Most SaaS pages do the opposite and make visitors scroll past
// marketing to reach the thing they came to do. Anybody who tapped
// "Sign up" has already decided; the panel below is there for the ones
// who want reassurance before committing, not as a toll gate.
//
// Everything is scoped under `.sg` so none of it leaks into the app.

export const signupCss = `
.sg{
  /* WhatsApp's own palette, because that is the product being sold.
     Deep teal for anything carrying text — white on #25D366 is about
     2.9:1 and fails contrast, which is why the bright green is used
     only for fills and never behind words. */
  --teal:#075E54; --teal-deep:#054C44; --green:#128C4A; --green-bright:#25D366;
  --mint:#E7F7EE; --mint-line:#C9EBD9;
  --ink:#0B1F1C; --muted:#5A6B66; --faint:#8A9995;
  --line:#E1E8E4; --surface:#fff; --ground:#F5F9F7;

  min-height:100vh; background:var(--ground); color:var(--ink);
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.sg *{box-sizing:border-box}
.sg h1,.sg h2,.sg h3{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.028em;margin:0}
.sg-spin{animation:sgSpin .8s linear infinite}
@keyframes sgSpin{to{transform:rotate(360deg)}}

/* ── Shell ──────────────────────────────────────────────────────── */
.sg-shell{display:grid;grid-template-columns:1fr;max-width:1220px;margin:0 auto}
@media(min-width:980px){
  .sg-shell{grid-template-columns:1fr minmax(430px,46%);gap:0;align-items:stretch}
}

/* ── Top bar ────────────────────────────────────────────────────── */
.sg-top{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:16px 20px;max-width:1220px;margin:0 auto}
.sg-brand{display:inline-flex;align-items:center;gap:9px;font-family:"Sora",sans-serif;
  font-weight:800;font-size:17px;color:var(--ink);text-decoration:none}
.sg-logo{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;
  background:linear-gradient(140deg,var(--green-bright),var(--teal));color:#fff}
.sg-top-alt{font-size:13.5px;color:var(--muted)}
.sg-top-alt a{color:var(--teal);font-weight:700;text-decoration:none}
.sg-top-alt a:hover{text-decoration:underline}

/* ── Value panel ────────────────────────────────────────────────── */
/* Order 2 on mobile: below the form. Order 1 (left) on desktop. */
.sg-value{order:2;padding:8px 20px 40px}
@media(min-width:980px){
  .sg-value{order:1;padding:34px 44px 44px 20px;display:flex;flex-direction:column;justify-content:center}
}

.sg-value-inner{max-width:560px}
.sg-eyebrow{display:inline-flex;align-items:center;gap:7px;background:var(--mint);
  color:var(--teal);border:1px solid var(--mint-line);border-radius:999px;
  padding:6px 13px;font-size:11.5px;font-weight:800;letter-spacing:.02em;margin-bottom:16px}
.sg-value h1{font-size:clamp(25px,4.4vw,40px);line-height:1.1;font-weight:800}
.sg-value h1 em{font-style:normal;color:var(--green)}
.sg-value-sub{margin:13px 0 0;font-size:15.5px;line-height:1.6;color:var(--muted);max-width:46ch}

/* Benefit list — the "what you get" that earns the form */
.sg-benefits{list-style:none;margin:24px 0 0;padding:0;display:flex;flex-direction:column;gap:12px}
.sg-benefits li{display:flex;gap:11px;align-items:flex-start;font-size:14.5px;line-height:1.5}
.sg-tick{flex:0 0 auto;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;
  background:var(--green);color:#fff;margin-top:1px}
.sg-benefits b{font-weight:750}
.sg-benefits span{color:var(--muted)}

/* Free-plan card — the offer, stated plainly */
.sg-offer{margin-top:26px;background:var(--surface);border:1px solid var(--line);
  border-radius:15px;padding:17px 18px 18px}
.sg-offer-head{display:flex;align-items:center;gap:10px;padding-bottom:13px;
  border-bottom:1px solid var(--line);margin-bottom:13px}
.sg-offer-ic{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;
  background:var(--mint);color:var(--teal);flex:0 0 auto}
.sg-offer-head strong{display:block;font-size:14.5px;font-weight:780}
.sg-offer-head span{display:block;font-size:12.5px;color:var(--muted);margin-top:1px}
.sg-offer-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.sg-offer-list li{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;line-height:1.45}
.sg-offer-list li svg{flex:0 0 auto;color:var(--green);margin-top:2px}
.sg-offer-list b{font-weight:720}
.sg-offer-list em{font-style:normal;display:block;color:var(--faint);font-size:12px;margin-top:1px}

/* Assurances — product facts, not invented testimonials */
.sg-assure{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;padding-top:18px;
  border-top:1px solid var(--line)}
.sg-assure div{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;
  color:var(--muted);font-weight:600}
.sg-assure svg{color:var(--green);flex:0 0 auto}

/* ── Form panel ─────────────────────────────────────────────────── */
.sg-form-wrap{order:1;padding:8px 20px 26px}
@media(min-width:980px){
  .sg-form-wrap{order:2;padding:30px 20px 44px;display:flex;align-items:center}
}
.sg-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;
  padding:24px 22px 26px;width:100%;box-shadow:0 1px 2px rgba(11,31,28,.04),0 12px 34px rgba(11,31,28,.05)}
@media(min-width:560px){.sg-card{padding:28px 30px 30px}}

.sg-card-head h2{font-size:22px;font-weight:800}
.sg-card-head p{margin:6px 0 0;font-size:13.5px;color:var(--muted);line-height:1.55}

.sg-error{display:flex;gap:8px;align-items:flex-start;background:#fef2f2;border:1px solid #fecaca;
  color:#991b1b;border-radius:11px;padding:10px 12px;font-size:13px;margin:16px 0 0;line-height:1.45}
.sg-error svg{flex:0 0 auto;margin-top:1px}

.sg-divider{display:flex;align-items:center;gap:12px;margin:18px 0;
  font-size:11.5px;color:var(--faint);font-weight:600}
.sg-divider::before,.sg-divider::after{content:"";height:1px;flex:1;background:var(--line)}

.sg-form{display:flex;flex-direction:column;gap:14px;margin-top:18px}
.sg-row{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:520px){.sg-row.two{grid-template-columns:1fr 1fr}}

.sg-field{display:flex;flex-direction:column;gap:6px}
.sg-field label{font-size:12.5px;font-weight:700;color:#374151}
.sg-field label span{font-weight:500;color:var(--faint)}
.sg-input{width:100%;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);
  /* 16px exactly. iOS Safari zooms the whole page when a focused input
     is under 16px, and the form jumps out from under the visitor's
     thumb mid-typing. 15px looks slightly better and still triggers it. */
  padding:12px 13px;font-family:inherit;font-size:16px;color:var(--ink);outline:none;
  transition:border-color .15s,box-shadow .15s;min-height:46px}
.sg-input::placeholder{color:#a8b4b0}
.sg-input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(18,140,74,.13)}
.sg-input:disabled{background:#f6f8f7;color:var(--faint)}
.sg-hint{font-size:11.5px;color:var(--faint);line-height:1.45;margin:0}
.sg-hint.good{color:var(--green);font-weight:600}
.sg-hint.bad{color:#dc2626;font-weight:600}

/* Phone: country select welded to the number box */
.sg-phone{display:grid;grid-template-columns:minmax(96px,34%) 1fr;gap:8px}
.sg-phone select{appearance:none;background-image:none}

/* Workspace URL, shown as a real address so it reads as something owned */
.sg-url{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;
  overflow:hidden;background:var(--surface);transition:border-color .15s,box-shadow .15s}
.sg-url:focus-within{border-color:var(--green);box-shadow:0 0 0 3px rgba(18,140,74,.13)}
.sg-url-prefix{padding:0 2px 0 13px;font-size:13px;color:var(--faint);white-space:nowrap;
  font-family:ui-monospace,monospace}
.sg-url input{flex:1;min-width:0;border:0;outline:none;padding:12px 10px 12px 2px;
  font-size:16px;font-family:ui-monospace,monospace;color:var(--ink);background:transparent;min-height:46px}
.sg-url-state{padding-right:12px;display:grid;place-items:center}

/* Password */
.sg-pw{position:relative}
.sg-pw .sg-input{padding-right:44px}
.sg-reveal{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;
  color:var(--faint);cursor:pointer;padding:8px;border-radius:8px;display:grid;place-items:center}
.sg-reveal:hover{color:var(--ink);background:#f1f5f3}
.sg-meter{display:flex;gap:4px;margin-top:2px}
.sg-meter i{height:3px;flex:1;border-radius:2px;background:#e5eae7;transition:background .2s}
.sg-meter i.on1{background:#ef4444}.sg-meter i.on2{background:#f59e0b}
.sg-meter i.on3{background:#84cc16}.sg-meter i.on4{background:var(--green)}

/* Buttons */
.sg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;
  font-family:inherit;font-size:14.5px;font-weight:750;cursor:pointer;border:1.5px solid transparent;
  padding:13px 18px;transition:.15s;min-height:50px;width:100%}
.sg-btn:disabled{opacity:.55;cursor:not-allowed}
.sg-primary{background:var(--teal);color:#fff;border-color:var(--teal)}
.sg-primary:hover:not(:disabled){background:var(--teal-deep);border-color:var(--teal-deep)}
.sg-outline{background:var(--surface);color:var(--ink);border-color:var(--line)}
.sg-outline:hover{border-color:var(--teal);background:#fafdfb}

/* SocialAuthButtons is shared with /login and writes au-* class names.
   Aliasing them here means the component needs no changes and the login
   page keeps its own styling — one shared component, two skins. */
.sg-social,.sg .au-social{display:flex;flex-direction:column;gap:9px}
.sg-social-btn,.sg .au-social-btn{display:flex;align-items:center;justify-content:center;gap:10px;
  width:100%;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);
  color:var(--ink);font-family:inherit;font-size:14.5px;font-weight:700;padding:12px;
  cursor:pointer;transition:.15s;min-height:50px}
.sg-social-btn:hover:not(:disabled),.sg .au-social-btn:hover:not(:disabled){
  border-color:#c7d3ce;background:#fafdfb}
.sg-social-btn:disabled,.sg .au-social-btn:disabled{opacity:.55;cursor:not-allowed}
.sg .au-spin{animation:sgSpin .8s linear infinite}

.sg-legal{margin:14px 0 0;font-size:11.5px;color:var(--faint);line-height:1.55;text-align:center}
.sg-legal a{color:var(--muted);text-decoration:underline}
.sg-switch{margin:16px 0 0;text-align:center;font-size:13.5px;color:var(--muted)}
.sg-switch a{color:var(--teal);font-weight:750;text-decoration:none}
.sg-switch a:hover{text-decoration:underline}

/* ── Confirmation ───────────────────────────────────────────────── */
.sg-confirm{min-height:100vh;display:grid;place-items:center;padding:24px 20px}
.sg-confirm-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;
  padding:34px 28px;max-width:460px;width:100%;text-align:center;
  box-shadow:0 12px 34px rgba(11,31,28,.06)}
.sg-confirm-ic{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;
  background:var(--mint);color:var(--teal);margin:0 auto 16px}
.sg-confirm-card h1{font-size:22px;font-weight:800}
.sg-confirm-card p{margin:10px 0 0;font-size:14px;color:var(--muted);line-height:1.6}
.sg-confirm-url{background:var(--ground);border:1px solid var(--line);border-radius:11px;
  padding:12px;margin:18px 0}
.sg-confirm-url span{display:block;font-size:11px;color:var(--faint);text-transform:uppercase;
  letter-spacing:.08em;font-weight:700;margin-bottom:4px}
.sg-confirm-url code{font-family:ui-monospace,monospace;font-size:13px;color:var(--teal);
  word-break:break-all}
.sg-confirm-hint{font-size:12.5px;color:var(--faint);margin-top:14px}

@media(prefers-reduced-motion:reduce){.sg *{transition:none!important;animation:none!important}}
`;
