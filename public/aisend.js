/* AiSend lead capture — one line for any website (HTML, PHP, WordPress, Shopify...)
 *
 *   <script src="https://YOUR-APP/aisend.js" data-key="pk_xxxxxxxx" async></script>
 *
 * Works with ANY form builder (Ninja Forms, Contact Form 7, WPForms, Elementor,
 * Gravity, a hand-written PHP form...) because it does not hook into one plugin.
 * It watches the form being submitted, and the AJAX request most builders send
 * instead, and when the visitor's phone or email is in it and the server
 * accepted it, the lead goes to your dashboard with where the visitor came from.
 *
 *   • Form submitted        -> lead (name, phone, email, message, source)
 *   • "Call now" tapped     -> recorded as a call click for that page / ad
 *   • WhatsApp button tapped-> recorded; a short "(Ref ABC123)" is added to the
 *                              pre-filled message so the lead that follows
 *                              keeps its Google Ads / UTM source.
 *                              Turn this off with data-wa-ref="false".
 *   • Google Ads / UTM / referrer are remembered for 30 days.
 *   • window.AiSend.track({name, phone, email, message}) for custom code.
 *
 * The key is PUBLIC and safe in page source: it can only create leads for your
 * account, and only from the domains you listed in the dashboard. Password and
 * card fields are never read; search boxes and login forms are ignored.
 */
(function () {
  'use strict';

  var tag = document.currentScript || document.querySelector('script[data-key][src*="aisend"]');
  if (!tag) return;
  var KEY = tag.getAttribute('data-key');
  if (!KEY) { try { console.error('[AiSend] data-key is required'); } catch (e) {} return; }
  var DEBUG = tag.getAttribute('data-debug') === 'true';
  var WA_REF = tag.getAttribute('data-wa-ref') !== 'false';

  // Post back to wherever this script was served from, so the same file
  // works on any deployment without being rebuilt.
  var API = (function () {
    try { return new URL(tag.src).origin + '/api/leads/capture'; } catch (e) { return '/api/leads/capture'; }
  })();

  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[AiSend]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ── Who is this visitor, and where did they come from? ─────────────
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function rand(n, chars) {
    var s = '';
    for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }

  var VID = load('aisend_vid');
  if (!VID) { VID = rand(20, 'abcdefghijklmnopqrstuvwxyz0123456789'); store('aisend_vid', VID); }

  var ATTR_KEY = 'aisend_attr';
  var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  var PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function captureAttribution() {
    var prev = null;
    try {
      prev = JSON.parse(load(ATTR_KEY) || 'null');
      if (prev && !(prev.ts && Date.now() - prev.ts < THIRTY_DAYS)) prev = null;
    } catch (e) { prev = null; }

    var q = {};
    try {
      var sp = new URLSearchParams(location.search);
      PARAMS.forEach(function (k) { var v = sp.get(k); if (v) q[k] = v; });
    } catch (e) {}
    var hasNew = Object.keys(q).length > 0;
    // A fresh ad click replaces the old source; a plain revisit keeps it.
    if (prev && !hasNew) return prev;

    var ref = '';
    try { if (document.referrer && new URL(document.referrer).host !== location.host) ref = document.referrer; } catch (e) {}
    var a = { ts: Date.now(), landing_page: location.href, referrer: ref, params: q };
    store(ATTR_KEY, JSON.stringify(a));
    return a;
  }
  var attr = captureAttribution();

  function attribution() {
    var p = (attr && attr.params) || {};
    return {
      gclid: p.gclid, gbraid: p.gbraid, wbraid: p.wbraid, fbclid: p.fbclid,
      utm_source: p.utm_source, utm_medium: p.utm_medium, utm_campaign: p.utm_campaign,
      referrer: attr && attr.referrer, landing_page: attr && attr.landing_page
    };
  }

  // ── Sending (never uses our own fetch/XHR wrapper below) ───────────
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  function post(payload) {
    var body = JSON.stringify(payload);
    log('sending', payload);
    // text/plain avoids the CORS preflight, and keepalive lets the request
    // finish even when the page navigates away right after the click.
    try {
      if (nativeFetch) {
        nativeFetch(API, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(function () {});
        return;
      }
    } catch (e) {}
    try { navigator.sendBeacon(API, new Blob([body], { type: 'text/plain' })); } catch (e2) {}
  }

  function merge(a, b) { for (var k in b) { if (b[k] !== undefined && b[k] !== null && b[k] !== '') a[k] = b[k]; } return a; }

  var recent = {};
  function once(id, ms) {
    var now = Date.now();
    if (recent[id] && now - recent[id] < ms) return false;
    recent[id] = now;
    return true;
  }

  function sendLead(d) {
    if (!d || (!d.phone && !d.email)) return;
    if (!once('lead|' + (d.phone || '') + '|' + (d.email || ''), 15000)) { log('duplicate lead skipped'); return; }
    post(merge({
      key: KEY, visitor_id: VID, page_url: location.href,
      name: d.name, phone: d.phone, email: d.email, message: d.message, interest: d.interest, form: d.form
    }, attribution()));
  }

  function sendClick(kind, target, token) {
    if (!once('click|' + kind + '|' + target, 3000)) return;
    post(merge({
      key: KEY, type: 'click', kind: kind, target: target, token: token,
      visitor_id: VID, page_url: location.href
    }, attribution()));
  }

  // ── Reading fields without knowing which plugin made the form ──────
  // Everything below works on a flat list of { name, value, type } so a DOM
  // form and an AJAX request body go through exactly the same logic.
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // Not 'nonce'/'token': WordPress AJAX forms send those on every submit.
  var SECRET_RE = /pass(word)?|pwd|cvv|cvc|card[-_ ]?n|iban|(^|[^a-z])otp([^a-z]|$)|secret/;

  function classify(list, formName) {
    var out = { form: formName || '' };
    var first = '', last = '', full = '';

    for (var i = 0; i < list.length; i++) {
      var name = String(list[i].name || '').toLowerCase();
      var type = String(list[i].type || '').toLowerCase();
      if (SECRET_RE.test(name) || type === 'password') return null;
    }

    for (var j = 0; j < list.length; j++) {
      var f = list[j];
      var v = String(f.value == null ? '' : f.value).trim();
      if (!v || v.length > 600) continue;
      var l = (String(f.name || '') + ' ' + String(f.type || '')).toLowerCase();
      var t = String(f.type || '').toLowerCase();

      if (!out.phone && (t === 'tel' || /phone|mobile|whats|contact\s*(no|num)|\btel\b|\bcell\b|number/.test(l))) {
        var digits = v.replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(v)) { out.phone = v; continue; }
      }
      if (!out.email && EMAIL_RE.test(v)) { out.email = v; continue; }

      if (f.isSelect && /service|treat|procedure|interest|subject|product|department|enquiry|inquiry/.test(l)) {
        out.interest = v; continue;
      }
      if (f.isTextarea || /message|comment|query|enquiry|inquiry|requirement|details|note/.test(l)) {
        if (!out.message) out.message = v;
        continue;
      }
      if (/name/.test(l) && !/user|company|business|domain|file|nick|last|sur|family/.test(l)) {
        if (/first|fname|given/.test(l)) first = v; else if (!full) full = v;
      } else if (/last|lname|surname|family/.test(l)) {
        last = v;
      }
    }

    out.name = (first || last) ? (first + ' ' + last).trim() : full;
    return (out.phone || out.email) ? out : null;
  }

  // A <form> in the page.
  function readDomForm(form) {
    var list = [];
    for (var i = 0; i < form.elements.length; i++) {
      var el = form.elements[i];
      var type = (el.type || '').toLowerCase();
      if (/^(hidden|file|checkbox|radio|submit|button|reset|image|range|color)$/.test(type)) continue;
      var value = el.value;
      if (el.tagName === 'SELECT') {
        var opt = el.options[el.selectedIndex];
        value = opt && opt.text ? opt.text : el.value;
      }
      list.push({
        name: [el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' '),
        type: type, value: value,
        isSelect: el.tagName === 'SELECT', isTextarea: el.tagName === 'TEXTAREA'
      });
    }
    return classify(list, (form.id || form.getAttribute('name') || form.getAttribute('class') || '').toString().slice(0, 80));
  }

  // A request body: FormData, urlencoded string, JSON — and JSON nested inside
  // a urlencoded field, which is how Ninja Forms ships its fields.
  function flatten(val, prefix, out, depth) {
    if (out.length > 300 || depth > 6) return;
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      var t = val.trim();
      if ((t.charAt(0) === '{' || t.charAt(0) === '[') && t.length < 20000) {
        try { flatten(JSON.parse(t), prefix, out, depth + 1); return; } catch (e) {}
      }
      out.push({ name: prefix, value: val });
      return;
    }
    if (typeof val === 'number' || typeof val === 'boolean') { out.push({ name: prefix, value: String(val) }); return; }
    if (Array.isArray(val)) { for (var i = 0; i < val.length; i++) flatten(val[i], prefix, out, depth + 1); return; }
    if (typeof val === 'object') {
      // A builder field object like {key:'phone', label:'Phone', value:'98..'}
      if ('value' in val && (typeof val.value === 'string' || typeof val.value === 'number') &&
          (val.key || val.label || val.name || val.type)) {
        out.push({ name: [prefix, val.key, val.label, val.name].join(' '), type: val.type, value: String(val.value) });
        return;
      }
      for (var k in val) {
        if (Object.prototype.hasOwnProperty.call(val, k)) flatten(val[k], prefix ? prefix + '.' + k : k, out, depth + 1);
      }
    }
  }

  function readBody(body) {
    var out = [];
    try {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        body.forEach(function (v, k) { if (typeof v === 'string') flatten(v, k, out, 0); });
      } else if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        body.forEach(function (v, k) { flatten(v, k, out, 0); });
      } else if (typeof body === 'string') {
        var t = body.trim();
        if (t.charAt(0) === '{' || t.charAt(0) === '[') flatten(JSON.parse(t), '', out, 0);
        else new URLSearchParams(t).forEach(function (v, k) { flatten(v, k, out, 0); });
      }
    } catch (e) { return null; }
    return out.length ? classify(out, 'ajax') : null;
  }

  // ── 1) Plain form submits ──────────────────────────────────────────
  function isSearchForm(form) {
    var role = (form.getAttribute('role') || '').toLowerCase();
    var action = (form.getAttribute('action') || '').toLowerCase();
    return role === 'search' || /[?&/]s=|search/.test(action) || !!form.querySelector('input[type="search"]');
  }

  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      if (!form || form.tagName !== 'FORM' || isSearchForm(form)) return;
      sendLead(readDomForm(form));
    } catch (err) { log('error', err); }
  }, true);

  // ── 2) AJAX submits (Ninja Forms, CF7, WPForms, Elementor, ...) ────
  // Only counted once the server answered 2xx, so a form that failed
  // validation does not become a lead.
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var p = nativeFetch.apply(window, arguments);
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'POST' && init && init.body && url.indexOf(API) !== 0) {
          var data = readBody(init.body);
          if (data) p.then(function (res) { if (res && res.ok) sendLead(data); }, function () {});
        }
      } catch (e) {}
      return p;
    };
  }

  if (window.XMLHttpRequest) {
    var xo = XMLHttpRequest.prototype.open;
    var xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__ai = { m: String(m).toUpperCase(), u: String(u) };
      return xo.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        var meta = this.__ai;
        if (meta && meta.m === 'POST' && body && meta.u.indexOf(API) !== 0) {
          var data = readBody(body);
          if (data) {
            this.addEventListener('load', function () {
              if (this.status >= 200 && this.status < 300) sendLead(data);
            });
          }
        }
      } catch (e) {}
      return xs.apply(this, arguments);
    };
  }

  // ── 3) Call-now and WhatsApp buttons ───────────────────────────────
  var WA_RE = /^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\b|^whatsapp:\/\//i;

  function tagWhatsApp(href) {
    // Returns { href, token } with "(Ref ABC123)" added to the pre-filled text.
    var token = rand(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    var out = { href: href, token: token };
    if (!WA_REF) return out;
    try {
      var u = new URL(href.indexOf('://') > -1 ? href : 'https://' + href);
      var text = u.searchParams.get('text') || '';
      if (/\(ref [A-Z0-9]{6}\)/i.test(text)) return { href: href, token: text.match(/\(ref ([A-Z0-9]{6})\)/i)[1].toUpperCase() };
      // Build the query by hand: searchParams would write spaces as '+',
      // which WhatsApp does not always decode in a pre-filled message.
      var pairs = [];
      u.searchParams.forEach(function (v, k) { if (k !== 'text') pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
      pairs.push('text=' + encodeURIComponent((text ? text + ' ' : '') + '(Ref ' + token + ')'));
      out.href = u.origin + u.pathname + '?' + pairs.join('&');
      if (u.protocol === 'whatsapp:') out.href = 'whatsapp://' + u.host + u.pathname + '?' + pairs.join('&');
    } catch (e) {}
    return out;
  }

  document.addEventListener('click', function (e) {
    try {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';

      if (/^tel:/i.test(href)) {
        sendClick('call_click', href.replace(/^tel:/i, '').replace(/\s/g, ''));
        return;
      }
      if (WA_RE.test(href)) {
        var t = tagWhatsApp(href);
        // Setting href inside the click handler is honoured by the browser.
        if (t.href !== href) a.setAttribute('href', t.href);
        sendClick('whatsapp_click', href.replace(/[?#].*$/, '').slice(0, 120), t.token);
      }
    } catch (err) { log('error', err); }
  }, true);

  // Chat widgets that open WhatsApp from JavaScript instead of a link.
  var nativeOpen = window.open;
  if (nativeOpen) {
    window.open = function (url) {
      try {
        if (typeof url === 'string' && WA_RE.test(url)) {
          var t = tagWhatsApp(url);
          sendClick('whatsapp_click', url.replace(/[?#].*$/, '').slice(0, 120), t.token);
          var args = [].slice.call(arguments);
          args[0] = t.href;
          return nativeOpen.apply(window, args);
        }
      } catch (e) {}
      return nativeOpen.apply(window, arguments);
    };
  }

  // ── 4) Custom code ─────────────────────────────────────────────────
  //   AiSend.track({ name: 'Amit', phone: '98xxxxxx', message: 'Hi' })
  window.AiSend = window.AiSend || {};
  window.AiSend.track = function (d) {
    if (!d) return;
    sendLead({ name: d.name, phone: d.phone, email: d.email, message: d.message, interest: d.interest, form: d.form || 'custom' });
  };
  log('ready, posting to', API);
})();
