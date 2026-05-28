<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sendly — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  /* ====== EDIT THESE THREE LINES TO REBRAND ====== */
  --brand-name:"Sendly";
  --brand:#0f9d58;          /* primary green */
  --brand-deep:#0b6e3f;     /* deep green for headers/CTAs */
  /* =============================================== */
  --brand-50:#e9f7ef;
  --brand-100:#cdeddc;
  --ink:#0c1f17;
  --muted:#5b6b63;
  --line:#e7ece9;
  --bg:#f4f7f5;
  --card:#ffffff;
  --gold:#e6a817;
  --shadow:0 1px 2px rgba(12,31,23,.04),0 8px 24px rgba(12,31,23,.06);
  --shadow-lg:0 12px 40px rgba(12,31,23,.12);
  --r:16px;
  --sidebar:84px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;
  background:var(--bg);color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4,.font-display{font-family:"Sora",sans-serif;letter-spacing:-.02em}
.app{display:flex;min-height:100vh}

/* ---------- SIDEBAR ---------- */
.side{
  width:var(--sidebar);background:linear-gradient(180deg,var(--brand-deep),#073d24);
  display:flex;flex-direction:column;align-items:center;padding:18px 0;gap:6px;
  position:sticky;top:0;height:100vh;flex-shrink:0;
}
.logo{
  width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.14);
  display:grid;place-items:center;margin-bottom:14px;color:#fff;
  border:1px solid rgba(255,255,255,.18);
}
.logo svg{width:24px;height:24px}
.nav-item{
  width:60px;padding:10px 0;border-radius:13px;color:rgba(255,255,255,.62);
  display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;
  font-size:10.5px;font-weight:600;transition:.18s;text-align:center;
}
.nav-item svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.8}
.nav-item:hover{color:#fff;background:rgba(255,255,255,.08)}
.nav-item.active{color:#fff;background:rgba(255,255,255,.16)}
.side .spacer{flex:1}
.avatar{
  width:40px;height:40px;border-radius:50%;background:#7bd6a3;color:#073d24;
  display:grid;place-items:center;font-weight:800;font-family:"Sora"
}

/* ---------- MAIN ---------- */
.main{flex:1;min-width:0}
.topbar{
  height:66px;background:var(--card);border-bottom:1px solid var(--line);
  display:flex;align-items:center;gap:18px;padding:0 26px;position:sticky;top:0;z-index:20;
}
.topbar h1{font-size:20px;font-weight:700}
.status-pill{
  display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);font-weight:600;
}
.dot{width:8px;height:8px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 4px var(--brand-50)}
.live{color:var(--brand);font-weight:700}
.topbar .right{margin-left:auto;display:flex;align-items:center;gap:14px}
.plan-tag{font-size:13px;color:var(--muted);font-weight:600}
.plan-tag b{color:var(--ink)}
.btn{
  border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:13.5px;
  padding:10px 18px;border-radius:11px;display:inline-flex;align-items:center;gap:8px;transition:.18s;
}
.btn-primary{background:var(--brand);color:#fff;box-shadow:0 6px 18px rgba(15,157,88,.32)}
.btn-primary:hover{background:var(--brand-deep);transform:translateY(-1px)}
.btn-ghost{background:var(--brand-50);color:var(--brand-deep)}
.btn-ghost:hover{background:var(--brand-100)}
.btn-outline{background:#fff;border:1.5px solid var(--line);color:var(--ink)}
.btn-outline:hover{border-color:var(--brand)}
.icon-btn{width:40px;height:40px;border-radius:11px;background:var(--bg);display:grid;place-items:center;cursor:pointer;border:1px solid var(--line)}
.icon-btn svg{width:19px;height:19px;stroke:var(--muted);fill:none;stroke-width:1.8}

.content{padding:26px;display:grid;grid-template-columns:1fr 340px;gap:22px;align-items:start}
@media(max-width:1100px){.content{grid-template-columns:1fr}}

/* banner */
.banner{
  grid-column:1/-1;border-radius:var(--r);padding:22px 26px;color:#fff;
  background:radial-gradient(120% 160% at 0% 0%,#13b06a 0%,var(--brand-deep) 55%,#063a23 100%);
  display:flex;align-items:center;gap:20px;box-shadow:var(--shadow);overflow:hidden;position:relative;
}
.banner::after{content:"";position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}
.banner .emoji{font-size:34px}
.banner h3{font-size:18px;margin-bottom:4px}
.banner p{font-size:13.5px;opacity:.9}
.tag-up{background:rgba(255,255,255,.2);font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:.06em;margin-left:8px;vertical-align:middle}
.banner .btn{margin-left:auto;background:#fff;color:var(--brand-deep);white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.18)}

.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.left-col{display:flex;flex-direction:column;gap:22px}
.right-col{display:flex;flex-direction:column;gap:22px}

/* stat row */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:22px 26px}
.stat{display:flex;flex-direction:column;gap:8px;padding-right:22px}
.stat+.stat{border-left:1px solid var(--line);padding-left:22px}
.stat .label{font-size:12.5px;color:var(--muted);font-weight:600;display:flex;align-items:center;gap:5px}
.badge{font-size:11px;font-weight:800;padding:5px 11px;border-radius:8px;width:max-content}
.badge.green{background:var(--brand-50);color:var(--brand-deep)}
.badge.amber{background:#fdf3dc;color:#92670a}
.stat .big{font-family:"Sora";font-size:26px;font-weight:700}

/* progress steps */
.steps-card{padding:24px 26px;background:linear-gradient(135deg,#0e6e42,#073d24);color:#fff;border:none}
.steps-card .head{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.steps-card .head .bag{font-size:26px}
.steps-card .head h3{font-size:16px}
.steps{display:flex;align-items:flex-start;justify-content:space-between;position:relative}
.step{display:flex;flex-direction:column;align-items:center;text-align:center;flex:1;position:relative;z-index:2;gap:8px}
.step .circle{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:14px}
.step.done .circle{background:#34c77b;color:#06351f}
.step.pending .circle{background:var(--gold);color:#3a2900}
.step .stitle{font-size:11px;font-weight:700;opacity:.9}
.step .sstate{font-size:9px;font-weight:800;letter-spacing:.08em;opacity:.85;margin-top:-3px}
.step .sdesc{font-size:11px;opacity:.7;line-height:1.3;max-width:110px}
.track{position:absolute;top:17px;left:8%;right:8%;height:3px;background:rgba(255,255,255,.18);z-index:1}
.track .fill{height:100%;width:18%;background:#34c77b;border-radius:3px}

/* setup card */
.setup{padding:24px 26px}
.setup .row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.setup h3{font-size:17px}
.setup .left-meta{font-size:12.5px;color:var(--muted);font-weight:600}
.next-pill{background:var(--brand-50);color:var(--brand-deep);font-size:10px;font-weight:800;padding:4px 10px;border-radius:7px;letter-spacing:.05em;width:max-content;margin:16px 0 8px}
.setup .task{background:var(--brand-50);border-radius:13px;padding:18px 20px;display:flex;gap:14px}
.task .ic{width:38px;height:38px;border-radius:11px;background:var(--gold);display:grid;place-items:center;flex-shrink:0;color:#3a2900}
.task h4{font-size:15px;margin-bottom:8px}
.task ul{margin:8px 0 0 2px;list-style:none;display:flex;flex-direction:column;gap:6px}
.task li{font-size:12.5px;color:var(--muted);padding-left:16px;position:relative}
.task li::before{content:"";position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:var(--brand)}
.task .btn{margin-top:16px}

/* right column cards */
.rc{padding:20px}
.rc h4{font-size:15px;margin-bottom:4px}
.rc p{font-size:12.5px;color:var(--muted);line-height:1.45}
.qr-wrap{display:grid;place-items:center;gap:14px;padding:22px}
.qr{width:140px;height:140px;border-radius:12px;background:
  repeating-conic-gradient(var(--ink) 0% 25%,#fff 0% 50%) 50%/14px 14px;
  border:6px solid #fff;box-shadow:var(--shadow)}
.store{display:flex;gap:8px}
.store span{background:var(--ink);color:#fff;font-size:11px;font-weight:600;padding:8px 12px;border-radius:9px}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.feat div{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px}
.feat div::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--brand)}

.profile{display:flex;align-items:center;gap:14px;padding:20px}
.profile .pic{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#ffd27a,#f0a82e);flex-shrink:0;display:grid;place-items:center;color:#5a3c00;font-weight:800}
.profile .num{font-family:"Sora";font-weight:700;font-size:17px}
.profile .ptag{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.06em}
.profile small{color:var(--muted);font-size:11.5px}

.wcc{padding:20px}
.wcc .meter{height:8px;background:var(--bg);border-radius:99px;margin:10px 0 6px;overflow:hidden}
.wcc .meter i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--brand),#34c77b)}
.wcc .scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-weight:600}
.wcc .price{display:flex;align-items:center;justify-content:space-between;margin-top:16px}
.wcc .price .amt{font-family:"Sora";font-size:22px;font-weight:700}

.muted-link{color:var(--brand-deep);font-weight:700;font-size:13px;text-decoration:none}
.divider{height:1px;background:var(--line);margin:16px 0}
.fab{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;background:var(--brand);display:grid;place-items:center;box-shadow:var(--shadow-lg);cursor:pointer}
.fab svg{width:26px;height:26px;stroke:#fff;fill:none;stroke-width:2}
.fab .ping{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:#ff5a5a;border:2px solid #fff}

/* load animation */
.fade{opacity:0;transform:translateY(14px);animation:rise .6s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes rise{to{opacity:1;transform:none}}
.d1{animation-delay:.05s}.d2{animation-delay:.12s}.d3{animation-delay:.2s}.d4{animation-delay:.28s}.d5{animation-delay:.36s}
</style>

<div class="app">
  <!-- SIDEBAR -->
  <aside class="side">
    <div class="logo" title="brand">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20Z"/><path d="M9 8.5c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5 0-.7.4s-.9.9-.9 2.1.9 2.5 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.1-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.4L9 8.5Z"/></svg>
    </div>
    <div class="nav-item active"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Home</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.6A8.4 8.4 0 1 1 21 11.5Z"/></svg>Chat</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>History</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/></svg>Contacts</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M3 11l18-7-7 18-2-7-9-4z"/></svg>Campaigns</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>Ads</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></svg>Flows</div>
    <div class="nav-item"><svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>Dev</div>
    <div class="spacer"></div>
    <div class="avatar">A</div>
  </aside>

  <!-- MAIN -->
  <div class="main">
    <header class="topbar">
      <h1 class="brand-name">Dashboard</h1>
      <span class="status-pill"><span class="dot"></span>WhatsApp API&nbsp;<span class="live">LIVE</span></span>
      <div class="right">
        <span class="plan-tag">Plan: <b>Free Forever</b></span>
        <button class="btn btn-ghost">✦ Explore Plans</button>
        <div class="icon-btn"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg></div>
      </div>
    </header>

    <div class="content">
      <!-- BANNER -->
      <div class="banner fade d1">
        <span class="emoji">💬</span>
        <div>
          <h3>You're on the new marketing API <span class="tag-up">PRO</span></h3>
          <p>30% better delivery and deeper insights with the latest WhatsApp marketing APIs.</p>
        </div>
        <button class="btn">⚡ Upgrade for Free</button>
      </div>

      <div class="left-col">
        <!-- STATS -->
        <div class="card stats fade d2">
          <div class="stat">
            <span class="label">API Status ⓘ</span>
            <span class="badge green">● LIVE</span>
          </div>
          <div class="stat">
            <span class="label">Quality Rating ⓘ</span>
            <span class="badge green">HIGH</span>
          </div>
          <div class="stat">
            <span class="label">Remaining Quota ⓘ</span>
            <span class="big">250</span>
          </div>
        </div>

        <!-- PROGRESS STEPS -->
        <div class="card steps-card fade d3">
          <div class="head"><span class="bag">💰</span><h3>Complete the steps &amp; win 200 Conversation Credits</h3></div>
          <div class="steps">
            <div class="track"><div class="fill"></div></div>
            <div class="step done"><div class="circle">✓</div><div class="stitle">Get API Live</div><div class="sstate" style="color:#34c77b">DONE</div></div>
            <div class="step pending"><div class="circle">!</div><div class="stitle">Business Verified</div><div class="sstate" style="color:var(--gold)">PENDING</div><div class="sdesc">FBM / KYC</div></div>
            <div class="step pending"><div class="circle">!</div><div class="stitle">Recharge Credits</div><div class="sstate" style="color:var(--gold)">PENDING</div></div>
            <div class="step pending"><div class="circle">!</div><div class="stitle">Spend 500</div><div class="sstate" style="color:var(--gold)">PENDING</div></div>
            <div class="step pending"><div class="circle">👑</div><div class="stitle">Reward Won</div></div>
          </div>
        </div>

        <!-- SETUP TASK -->
        <div class="card setup fade d4">
          <div class="row">
            <h3>🟢 Setup Free WhatsApp Business Account</h3>
            <span class="left-meta">3 steps left</span>
          </div>
          <span class="next-pill">NEXT</span>
          <div class="task">
            <div class="ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5"/></svg></div>
            <div>
              <h4>Increase your messaging limit &amp; get display name approved</h4>
              <p style="font-size:12.5px;color:var(--muted)">Complete KYC to boost your messaging limit to 2000 and get name approval.</p>
              <ul>
                <li>Legal / Trade name on GST and Business Manager should match</li>
                <li>Ensure you have an active website before applying for KYC</li>
                <li>Use director's ID listed on your GST document</li>
              </ul>
              <button class="btn btn-primary">Start KYC</button>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="right-col">
        <div class="card qr-wrap fade d2">
          <h4 style="align-self:flex-start">Scan to get the mobile app</h4>
          <div class="qr"></div>
          <div class="store"><span> Google Play</span><span> App Store</span></div>
          <div class="divider" style="width:100%"></div>
          <div style="align-self:flex-start;font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.04em">KEY FEATURES</div>
          <div class="feat" style="width:100%">
            <div>Real-time alerts</div><div>Live Chat</div>
            <div>Ads Management</div><div>Analytics</div>
          </div>
        </div>

        <div class="card profile fade d3">
          <div class="pic">P</div>
          <div>
            <div class="ptag">PROF_SERVICES</div>
            <div class="num">+1 555 730 9342</div>
            <small>wa.sendly.com/15557309342</small>
          </div>
        </div>

        <div class="card wcc fade d4">
          <h4>Free Service Conversations</h4>
          <div class="meter"><i></i></div>
          <div class="scale"><span>0</span><span>Unlimited</span></div>
          <div class="divider"></div>
          <h4>Conversation Credits</h4>
          <div class="price"><span class="amt">₹ 50.00</span><button class="btn btn-primary">Buy More</button></div>
        </div>

        <div class="card rc fade d5">
          <h4>Customize WhatsApp Link</h4>
          <p>Create shareable links &amp; QR codes for your WhatsApp business number.</p>
          <div style="margin-top:14px"><a class="muted-link" href="#">Create link →</a></div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="fab"><span class="ping"></span><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.6A8.4 8.4 0 1 1 21 11.5Z"/></svg></div>

<script>
  // Apply brand name from CSS variable everywhere
  const bn = getComputedStyle(document.documentElement).getPropertyValue('--brand-name').replace(/"/g,'').trim();
  document.title = bn + ' — Dashboard';
  // nav interactivity
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>{
    document.querySelector('.nav-item.active')?.classList.remove('active');
    n.classList.add('active');
  });
</script>
