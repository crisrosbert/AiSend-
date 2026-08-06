// src/components/auth/auth-styles.ts
//
// One stylesheet shared by /signup and /login. These two pages sit either
// side of the same decision, so a visitor bouncing between them notices
// instantly when spacing, buttons or colours drift apart — keeping the
// rules in a single string makes drift impossible.
//
// Scoped under `.au` so nothing here leaks into the app shell.

export const authCss = `
.au{
  --brand:#16a34a;--brand-deep:#15803d;--brand-50:#f0fdf4;
  --ink:#0c1f17;--muted:#64748b;--line:#e3e9e5;
  min-height:100vh;display:grid;grid-template-columns:1fr;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:var(--ink);background:#fff}
@media(min-width:1000px){.au{grid-template-columns:minmax(380px,44%) 1fr}}
.au h1,.au h2,.au h3{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.03em;margin:0}
.au-spin{animation:auSpin .8s linear infinite}
@keyframes auSpin{to{transform:rotate(360deg)}}
.au-ok{color:var(--brand)}.au-bad{color:#dc2626}.au-dim{color:#94a3b8}

/* left pitch panel */
.au-pitch{display:none;position:relative;overflow:hidden;padding:34px 40px;color:#fff;
  background:linear-gradient(155deg,#16a34a 0%,#15803d 48%,#0b3f26 100%);
  flex-direction:column;justify-content:space-between}
@media(min-width:1000px){.au-pitch{display:flex}}
.au-pitch::after{content:"";position:absolute;right:-120px;top:-120px;width:380px;height:380px;
  border-radius:50%;background:rgba(255,255,255,.07)}
.au-pitch::before{content:"";position:absolute;left:-90px;bottom:-140px;width:300px;height:300px;
  border-radius:50%;background:rgba(255,255,255,.05)}
.au-pitch>*{position:relative;z-index:1}
.au-brand{display:inline-flex;align-items:center;gap:9px;font-family:"Sora",sans-serif;font-weight:800;
  font-size:18px;letter-spacing:-.02em}
.au-logo{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;
  background:rgba(255,255,255,.18)}
.au-pitch-body{max-width:440px}
.au-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;
  background:rgba(255,255,255,.16);padding:5px 11px;border-radius:99px;margin-bottom:16px}
.au-pitch h1{font-size:38px;line-height:1.12;font-weight:800}
@media(min-width:1280px){.au-pitch h1{font-size:44px}}
.au-accent{color:#bbf7d0}
.au-pitch-sub{font-size:14px;line-height:1.6;opacity:.88;margin:14px 0 26px;max-width:38ch}
.au-benefits{list-style:none;padding:0;margin:0 0 26px;display:flex;flex-direction:column;gap:13px}
.au-benefits li{display:flex;gap:11px;align-items:flex-start}
.au-benefit-ic{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;flex-shrink:0;
  background:rgba(255,255,255,.16)}
.au-benefits strong{display:block;font-size:13.5px;font-weight:700;font-family:"Sora",sans-serif}
.au-benefits span{font-size:12px;opacity:.82;line-height:1.45}
.au-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:20px;
  border-top:1px solid rgba(255,255,255,.18)}
.au-stats strong{display:block;font-family:"Sora",sans-serif;font-size:22px;font-weight:800}
.au-stats span{font-size:11px;opacity:.78}
.au-quote{margin:0 0 26px;padding:14px 16px;background:rgba(255,255,255,.1);border-radius:14px;
  border-left:3px solid rgba(255,255,255,.4)}
.au-quote p{font-size:13px;line-height:1.55;margin:0 0 8px;opacity:.95}
.au-quote cite{font-style:normal;font-size:11.5px;opacity:.75}
.au-pitch-foot{font-size:11.5px;opacity:.62;margin:0}

/* right panel */
.au-panel{display:flex;flex-direction:column;background:#fbfdfc;min-height:100vh}
.au-panel-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 0}
@media(min-width:1000px){.au-panel-top{justify-content:flex-end;padding:26px 40px 0}}
.au-brand.mobile{color:var(--ink)}
.au-brand.mobile .au-logo{background:var(--brand);color:#fff}
@media(min-width:1000px){.au-brand.mobile{display:none}}
.au-have-account{font-size:13px;color:var(--muted)}
.au-have-account a{color:var(--brand-deep);font-weight:700;text-decoration:none}
.au-have-account a:hover{text-decoration:underline}
.au-form-wrap{width:100%;max-width:440px;margin:0 auto;padding:26px 22px 44px;flex:1}
@media(min-width:1000px){.au-form-wrap{padding:32px 22px 48px}}
.au-form-wrap.centered{display:flex;flex-direction:column;justify-content:center}
.au-form-head h2{font-size:26px;font-weight:800}
.au-form-head p{font-size:13.5px;color:var(--muted);margin:6px 0 22px;line-height:1.5}

.au-error{display:flex;align-items:flex-start;gap:9px;background:#fef2f2;border:1px solid #fecaca;
  color:#b91c1c;font-size:12.5px;padding:11px 13px;border-radius:12px;margin-bottom:16px;line-height:1.45}
.au-error svg{flex-shrink:0;margin-top:1px}

/* social */
.au-social{display:grid;grid-template-columns:1fr;gap:9px}
@media(min-width:420px){.au-social{grid-template-columns:1fr 1fr}}
.au-social-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:46px;
  border:1.5px solid var(--line);background:#fff;border-radius:13px;cursor:pointer;font-family:inherit;
  font-size:13px;font-weight:700;color:#1f2937;transition:.16s;padding:0 10px}
.au-social-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.au-social-btn:hover:not(:disabled){border-color:#cbd5d1;background:#f8fbfa;transform:translateY(-1px);
  box-shadow:0 6px 18px rgba(15,23,42,.07)}
.au-social-btn:disabled{opacity:.6;cursor:default}
@media(min-width:420px){.au-social-btn span{font-size:12.5px}}

.au-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#94a3b8;font-size:11.5px;
  font-weight:600}
.au-divider::before,.au-divider::after{content:"";flex:1;height:1px;background:var(--line)}

/* form */
.au-form{display:flex;flex-direction:column;gap:15px}
.au-row{display:grid;grid-template-columns:1fr;gap:15px}
@media(min-width:420px){.au-row{grid-template-columns:1fr 1fr}}
.au-field{display:flex;flex-direction:column;gap:6px}
.au-field label{font-size:12.5px;font-weight:700;color:#334155}
.au-field-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.au-field-row a{font-size:11.5px;font-weight:700;color:var(--brand-deep);text-decoration:none}
.au-field-row a:hover{text-decoration:underline}
.au input[type=text],.au input[type=email],.au input[type=password]{
  width:100%;height:46px;border:1.5px solid var(--line);border-radius:12px;background:#fff;
  padding:0 13px;font-family:inherit;font-size:14px;color:var(--ink);transition:.15s;outline:none}
.au input::placeholder{color:#adb8b3}
.au input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(22,163,74,.12)}
.au input[aria-invalid=true]{border-color:#f87171}
.au-field-hint{font-size:11px;color:#94a3b8;margin:0;word-break:break-all;line-height:1.4}
.au-field-error{font-size:11px;color:#dc2626;margin:0;font-weight:600}

.au-slug{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;background:#fff;
  transition:.15s;padding-right:11px}
.au-slug:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(22,163,74,.12)}
.au-slug-prefix{padding:0 2px 0 13px;color:#94a3b8;font-size:14px;font-weight:600}
.au-slug input{border:none!important;box-shadow:none!important;padding-left:2px}
.au-slug-state{display:grid;place-items:center;width:18px;flex-shrink:0}

.au-password{position:relative}
.au-password input{padding-right:44px}
.au-reveal{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;
  cursor:pointer;color:#94a3b8;padding:8px;border-radius:8px;display:grid;place-items:center}
.au-reveal:hover{color:#475569;background:#f1f5f4}
.au-strength{display:flex;align-items:center;gap:9px;margin-top:2px}
.au-strength-bars{display:flex;gap:4px;flex:1}
.au-strength-bars span{height:4px;flex:1;border-radius:99px;background:#e8edea;transition:.2s}
.au-strength-bars span.s1{background:#ef4444}.au-strength-bars span.s2{background:#f59e0b}
.au-strength-bars span.s3{background:#84cc16}.au-strength-bars span.s4{background:var(--brand)}
.au-strength-label{font-size:10.5px;font-weight:700;color:#94a3b8;min-width:52px;text-align:right}
.au-strength-label.s1{color:#ef4444}.au-strength-label.s2{color:#b45309}
.au-strength-label.s3{color:#4d7c0f}.au-strength-label.s4{color:var(--brand-deep)}

/* buttons */
.au-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;border:none;
  border-radius:13px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:800;transition:.16s;
  text-decoration:none}
.au-btn-full{width:100%}
.au-btn-primary{background:var(--brand);color:#fff;box-shadow:0 8px 22px rgba(22,163,74,.28)}
.au-btn-primary:hover:not(:disabled){background:var(--brand-deep);transform:translateY(-1px)}
.au-btn-primary:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}
.au-btn-outline{background:#fff;border:1.5px solid var(--line);color:var(--ink)}
.au-btn-outline:hover{border-color:var(--brand);color:var(--brand-deep)}

.au-trust{list-style:none;padding:0;margin:2px 0 0;display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.au-trust li{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);font-weight:600}
.au-trust svg{color:var(--brand)}
.au-legal{font-size:11px;color:#94a3b8;text-align:center;margin:6px 0 0;line-height:1.55}
.au-legal a{color:var(--muted);font-weight:600}
.au-switch{font-size:13px;color:var(--muted);text-align:center;margin:20px 0 0}
.au-switch a{color:var(--brand-deep);font-weight:700;text-decoration:none}
.au-switch a:hover{text-decoration:underline}

/* confirmation */
.au-confirm{grid-column:1/-1;display:grid;place-items:center;min-height:100vh;padding:24px;
  background:linear-gradient(160deg,#f0fdf4,#fbfdfc 45%)}
.au-confirm-card{width:100%;max-width:430px;background:#fff;border:1px solid var(--line);border-radius:20px;
  padding:32px 28px;text-align:center;box-shadow:0 16px 44px rgba(15,23,42,.09)}
.au-confirm-ic{width:60px;height:60px;border-radius:18px;background:var(--brand-50);color:var(--brand-deep);
  display:grid;place-items:center;margin:0 auto 16px}
.au-confirm-card h1{font-size:23px;font-weight:800}
.au-confirm-card p{font-size:13.5px;color:var(--muted);line-height:1.6;margin:10px 0 0}
.au-confirm-card strong{color:var(--ink)}
.au-confirm-url{margin:20px 0 14px;padding:13px;background:#f8faf9;border:1px solid var(--line);
  border-radius:13px;text-align:left}
.au-confirm-url span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
.au-confirm-url code{font-size:12.5px;color:var(--brand-deep);font-weight:700;word-break:break-all}
.au-confirm-hint{font-size:11.5px!important;margin-bottom:18px!important}

@media(prefers-reduced-motion:reduce){.au *{transition:none!important;animation:none!important}}
`;
