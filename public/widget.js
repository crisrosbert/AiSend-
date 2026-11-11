/* AiSend Website Chat Widget
 * Embed (single agent):  <script src=".../widget.js" data-org="USER_ID"></script>
 * Embed (multi-agent):   <script src=".../widget.js" data-org="USER_ID" data-agent="AGENT_ID"></script>
 *
 * Renders a floating chat button, shows a notification bubble after a
 * delay, and opens an in-page chat panel powered by your AI agent.
 * No iframe — everything is injected into the host page.
 */
(function () {
  'use strict';

  // ── Read config from the script tag ──
  var scriptTag = document.currentScript ||
    document.querySelector('script[data-org]');
  if (!scriptTag) return;

  var ORG_ID = scriptTag.getAttribute('data-org');
  if (!ORG_ID) { console.error('[AiSend] data-org is required'); return; }

  // Optional agent id — when present, this widget runs a specific agent.
  var AGENT_ID = scriptTag.getAttribute('data-agent') || null;

  // Derive the API base from wherever this script was actually served from,
  // so the same file works on any deployment without being rebuilt.
  var API_BASE = (function () {
    try {
      return new URL(scriptTag.src, window.location.href).origin;
    } catch (e) {
      return window.location.origin;
    }
  })();

  // ── Visitor ID (persistent across sessions, per agent) ──
  var VISITOR_KEY = 'aisend_visitor_' + ORG_ID + (AGENT_ID ? '_' + AGENT_ID : '');
  var visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  // ── State ──
  var config = {
    bot_name: 'Assistant',
    bubble_message: 'Hi! 👋 Have a question?',
    welcome_message: 'Hello! How can I help you today?',
    primary_color: '#25D366',
    trigger_delay_seconds: 10,
    business_phone: null,
    // The business's own logo, read off their site when the agent was
    // trained. Null falls back to the generic chat icon.
    avatar_url: null,
    // Up to three questions shown as tappable chips under the greeting.
    // These are what turn an open panel into a conversation: a visitor
    // who has to think of a question usually closes the window instead.
    suggested_questions: [],
    // Optional slim WhatsApp line under the header. OFF unless the server says
    // so (owner switched it on AND a valid number is saved).
    whatsapp_button_enabled: false,
    whatsapp_button_text: ''
  };
  var isOpen = false;
  var messages = []; // {role:'user'|'bot', text}
  var bubbleShown = false;
  // Once details are captured we never show the form again this session, even
  // if the model calls submit_lead a second time.
  var leadCaptured = localStorage.getItem(VISITOR_KEY + '_lead') === '1';

  // ── Fetch config (by agent if provided, else org), then build UI ──
  var configUrl = API_BASE + '/api/widget/config?org=' + encodeURIComponent(ORG_ID) +
    (AGENT_ID ? '&agent=' + encodeURIComponent(AGENT_ID) : '');
  fetch(configUrl)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) {
      if (c) { for (var k in c) if (c[k] != null) config[k] = c[k]; }
      buildWidget();
    })
    .catch(function () { buildWidget(); });

  function buildWidget() {
    injectStyles();
    // ── Floating button ──
    var btn = el('div', 'aisend-btn');
    btn.innerHTML = chatIcon();
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
    // ── Notification bubble (after delay) ──
    setTimeout(function () {
      if (!isOpen && !bubbleShown) {
        bubbleShown = true;
        var bubble = el('div', 'aisend-bubble');
        bubble.innerHTML =
          '<div class="aisend-bubble-close">&times;</div>' +
          '<div class="aisend-bubble-text">' + esc(config.bubble_message) + '</div>';
        bubble.querySelector('.aisend-bubble-close').onclick = function (e) {
          e.stopPropagation();
          bubble.remove();
        };
        bubble.onclick = function () { bubble.remove(); togglePanel(); };
        document.body.appendChild(bubble);
        setTimeout(function () { if (bubble.parentNode) bubble.remove(); }, 15000);
      }
    }, (config.trigger_delay_seconds || 10) * 1000);
    // ── Chat panel (hidden initially) ──
    var panel = el('div', 'aisend-panel');
    panel.id = 'aisend-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="aisend-header">' +
        '<div class="aisend-header-info">' +
          '<div class="aisend-avatar">' + avatarInner() + '</div>' +
          '<div>' +
            '<div class="aisend-bot-name">' + esc(config.bot_name) + '</div>' +
            '<div class="aisend-status">● Online</div>' +
          '</div>' +
        '</div>' +
        // No WhatsApp button here any more. A green badge sitting in the
        // header offered every visitor a way out of the chat before they
        // had asked anything — the most prominent control on screen was
        // "leave". The handoff button still appears mid-conversation,
        // where wanting a human is something the visitor has actually
        // expressed rather than something we suggest to them on arrival.
        '<div class="aisend-header-actions">' +
          '<div class="aisend-close" id="aisend-close">&times;</div>' +
        '</div>' +
      '</div>' +
      // Optional WhatsApp strip: a flex row between the header and the
      // messages. Empty string (nothing at all) unless it is switched on.
      waStripHtml() +
      '<div class="aisend-messages" id="aisend-messages"></div>' +
      '<div class="aisend-input-row">' +
        '<input type="text" class="aisend-input" id="aisend-input" placeholder="Type your message..." />' +
        '<button class="aisend-send" id="aisend-send">' + sendIcon() + '</button>' +
      '</div>';
    document.body.appendChild(panel);
    wireWaStrip(panel);
    document.getElementById('aisend-close').onclick = togglePanel;
    document.getElementById('aisend-send').onclick = sendMessage;
    // The keyboard animates in: re-fit once it has settled.
    document.getElementById('aisend-input').addEventListener('focus', function () {
      setTimeout(fitPanel, 300);
      setTimeout(fitPanel, 700);
    });
    document.getElementById('aisend-input').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendMessage();
    });
    document.documentElement.style.setProperty('--aisend-primary', config.primary_color);
  }

  /**
   * The header avatar: the business's logo if we have one.
   *
   * onerror matters more than it looks. This URL was read off the
   * merchant's own site — a favicon path that 404s, an image behind
   * hotlink protection, a CDN that later expires it. A broken-image
   * icon in the chat header looks worse than no logo at all, so a
   * failed load swaps the generic icon back in.
   */
  function avatarInner() {
    // Stashed on window so the inline onerror above can reach it — the
    // handler runs in global scope, not inside this closure.
    window.__aisendChatIcon = chatIcon(true);
    if (!config.avatar_url) return chatIcon(true);
    return '<img src="' + esc(config.avatar_url) + '" alt="" class="aisend-avatar-img" ' +
      'onerror="this.parentNode.innerHTML=window.__aisendChatIcon||\'\'">';
  }

  /**
   * Tappable questions under the greeting.
   *
   * Removed as soon as one is tapped, or as soon as the visitor types.
   * Leaving them up through a conversation turns the panel into a menu
   * that keeps interrupting whatever is actually being discussed.
   */
  function renderSuggestions() {
    var questions = config.suggested_questions || [];
    if (!questions.length) return;
    if (document.getElementById('aisend-suggestions')) return;

    var body = document.getElementById('aisend-messages');
    if (!body) return;

    var wrap = document.createElement('div');
    wrap.className = 'aisend-suggestions';
    wrap.id = 'aisend-suggestions';

    questions.slice(0, 3).forEach(function (question) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'aisend-chip';
      chip.textContent = question;
      chip.addEventListener('click', function () {
        clearSuggestions();
        addMessage('user', question);
        deliver(question);
      });
      wrap.appendChild(chip);
    });

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function clearSuggestions() {
    var el = document.getElementById('aisend-suggestions');
    if (el) el.remove();
  }

  // Phones: when the on-screen keyboard opens, Chrome shrinks only the
  // VISUAL viewport, so a fixed panel anchored to the page keeps its size
  // and its top (the header) is pushed off screen. While the keyboard is
  // up, fit the panel exactly inside the visible area; when it closes,
  // hand control back to the stylesheet.
  function fitPanel() {
    var panel = document.getElementById('aisend-panel');
    if (!panel || !isOpen) return;
    var vv = window.visualViewport;
    var phone = window.matchMedia && window.matchMedia('(max-width:480px)').matches;
    var keyboard = !!(vv && phone && vv.height < window.innerHeight - 120);
    if (keyboard) {
      panel.style.top = Math.max(0, vv.offsetTop + 8) + 'px';
      panel.style.bottom = 'auto';
      panel.style.height = Math.max(200, vv.height - 16) + 'px';
      panel.style.maxHeight = 'none';
    } else {
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.height = '';
      panel.style.maxHeight = '';
    }
    var box = document.getElementById('aisend-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitPanel);
    window.visualViewport.addEventListener('scroll', fitPanel);
  }

  function togglePanel() {
    var panel = document.getElementById('aisend-panel');
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) setTimeout(fitPanel, 50); else { panel.style.top = ''; panel.style.bottom = ''; panel.style.height = ''; panel.style.maxHeight = ''; }
    // No waves around the button while the chat is open: they spread over
    // the panel edge on phones and look like an overlap.
    var launcher = document.querySelector('.aisend-btn');
    if (launcher) launcher.className = isOpen ? 'aisend-btn aisend-open' : 'aisend-btn';
    var b = document.querySelector('.aisend-bubble');
    if (b) b.remove();
    if (isOpen && messages.length === 0) {
      addMessage('bot', config.welcome_message);
      renderSuggestions();
    }
    if (isOpen) {
      setTimeout(function () {
        var inp = document.getElementById('aisend-input');
        if (inp) inp.focus();
      }, 100);
    }
  }

  function sendMessage() {
    var input = document.getElementById('aisend-input');
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    clearSuggestions();
    addMessage('user', text);
    deliver(text);
  }

  /**
   * Send text that is already on screen.
   *
   * Split out of sendMessage so a tapped suggestion travels the exact
   * same path as a typed message — same endpoint, same typing
   * indicator, same media, handoff and lead-form handling. A second
   * copy of this would drift, and the chip path would quietly stop
   * rendering images or lead forms one day.
   */
  function deliver(text) {
    showTyping();
    fetch(API_BASE + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
        agent_id: AGENT_ID,
        visitor_id: visitorId,
        message: text,
        page_url: window.location.href,
        page_title: document.title
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        addMessage('bot', data.reply || 'Sorry, please try again.');
        // Render any media the AI sent (images, PDFs, videos)
        if (data.media && data.media.length > 0) {
          data.media.forEach(function (m) { addMediaCard(m); });
        }
        if (data.handoff && data.business_phone) {
          addWhatsAppButton(data.business_phone, text);
        }
        // After a handoff the bot stays quiet until a person returns the chat
        // to it. Say so once and let the visitor start fresh, so an unrelated
        // question is not stuck behind "our team has your message".
        if (data.handoff) addNewChatButton();
        // The AI decided it is time to ask for contact details.
        if (data.lead_form && data.lead_form.fields && !leadCaptured) {
          addLeadForm(data.lead_form.fields);
        }
      })
      .catch(function () {
        hideTyping();
        addMessage('bot', 'Sorry, I had trouble connecting. Please try again.');
      });
  }

  // Offered once per handoff. A new chat is a new visitor id, which the server
  // treats as a new conversation; the team keeps the flagged one.
  function addNewChatButton() {
    if (document.getElementById('aisend-newchat')) return;
    var container = document.getElementById('aisend-messages');
    var wrap = el('div', 'aisend-msg aisend-msg-bot');
    wrap.id = 'aisend-newchat';
    wrap.innerHTML = '<button type="button" class="aisend-newchat-btn">Have a different question? Start a new chat</button>';
    wrap.querySelector('button').onclick = startNewChat;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function startNewChat() {
    visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      localStorage.setItem(VISITOR_KEY, visitorId);
      localStorage.removeItem(VISITOR_KEY + '_lead');
    } catch (e) { /* private mode */ }
    leadCaptured = false;
    messages = [];
    var container = document.getElementById('aisend-messages');
    container.innerHTML = '';
    addMessage('bot', config.welcome_message);
    renderSuggestions();
  }

  function addMessage(role, text) {
    messages.push({ role: role, text: text });
    var container = document.getElementById('aisend-messages');
    var msg = el('div', 'aisend-msg aisend-msg-' + role);
    msg.innerHTML = '<div class="aisend-bubble-msg">' + esc(text) + '</div>';
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  // â”€â”€ Lead capture form â”€â”€
  // Rendered inline in the transcript when the AI calls submit_lead. Kept in
  // the message flow (rather than a modal) so the visitor never loses the
  // conversation context that earned their interest.
  function addLeadForm(fields) {
    if (document.getElementById('aisend-lead-form')) return;

    var container = document.getElementById('aisend-messages');
    var wrap = el('div', 'aisend-lead');
    wrap.id = 'aisend-lead-form';

    var html = '<div class="aisend-lead-title">Share your details</div>' +
      '<div class="aisend-lead-sub">Our team will get back to you shortly.</div>';

    fields.forEach(function (f) {
      html += '<input class="aisend-lead-input" data-key="' + esc(f.key) + '"' +
        ' type="' + esc(f.type || 'text') + '"' +
        ' placeholder="' + esc(f.label) + (f.required ? ' *' : '') + '"' +
        (f.required ? ' required' : '') + ' />';
    });

    html += '<div class="aisend-lead-err" id="aisend-lead-err"></div>' +
      '<button class="aisend-lead-btn" id="aisend-lead-submit">Submit</button>';

    wrap.innerHTML = html;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;

    document.getElementById('aisend-lead-submit').onclick = function () {
      submitLeadForm(wrap, fields);
    };
    // Enter anywhere in the form submits it.
    wrap.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitLeadForm(wrap, fields); }
    });
  }

  function submitLeadForm(wrap, fields) {
    var button = document.getElementById('aisend-lead-submit');
    var errorBox = document.getElementById('aisend-lead-err');
    var values = {};
    var missing = false;

    wrap.querySelectorAll('.aisend-lead-input').forEach(function (input) {
      var value = (input.value || '').trim();
      values[input.getAttribute('data-key')] = value;
      var required = fields.filter(function (f) {
        return f.key === input.getAttribute('data-key');
      })[0];
      if (required && required.required && !value) {
        input.classList.add('aisend-lead-invalid');
        missing = true;
      } else {
        input.classList.remove('aisend-lead-invalid');
      }
    });

    if (missing) { errorBox.textContent = 'Please fill in the required fields.'; return; }
    if (!values.phone && !values.email) {
      errorBox.textContent = 'Please add a phone number or email so we can reach you.';
      return;
    }

    errorBox.textContent = '';
    button.disabled = true;
    button.textContent = 'Submittingâ€¦';

    fetch(API_BASE + '/api/widget/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
        agent_id: AGENT_ID,
        visitor_id: visitorId,
        page_url: window.location.href,
        fields: values
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          button.disabled = false;
          button.textContent = 'Submit';
          errorBox.textContent = (res.data && res.data.error) || 'Could not save. Please try again.';
          return;
        }
        leadCaptured = true;
        try { localStorage.setItem(VISITOR_KEY + '_lead', '1'); } catch (e) { /* private mode */ }
        wrap.innerHTML = '<div class="aisend-lead-done">âœ“ Thank you! Our team will contact you shortly.</div>';
        // Let the AI acknowledge it in its own voice and carry on the chat.
        sendSystemNote('The customer has submitted their contact details.');
      })
      .catch(function () {
        button.disabled = false;
        button.textContent = 'Submit';
        errorBox.textContent = 'Network error. Please try again.';
      });
  }

  // Tells the agent what happened without showing the note as a visitor message.
  function sendSystemNote(note) {
    showTyping();
    fetch(API_BASE + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
        agent_id: AGENT_ID,
        visitor_id: visitorId,
        message: note,
        page_url: window.location.href,
        page_title: document.title
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        if (data.reply) addMessage('bot', data.reply);
      })
      .catch(function () { hideTyping(); });
  }

  function addMediaCard(m) {
    var container = document.getElementById('aisend-messages');
    var card = el('div', 'aisend-media-card');
    if (m.type === 'image') {
      var img = document.createElement('img');
      img.src = m.url; img.alt = m.title || ''; img.className = 'aisend-media-img';
      img.onclick = function () { window.open(m.url, '_blank'); };
      card.appendChild(img);
      if (m.title) { var cap = el('div', 'aisend-media-cap'); cap.textContent = m.title; card.appendChild(cap); }
    } else if (m.type === 'video') {
      var vid = (m.url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
      var a = document.createElement('a');
      a.href = m.url; a.target = '_blank'; a.className = 'aisend-media-video';
      if (vid) {
        var thumb = document.createElement('img');
        thumb.src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
        thumb.className = 'aisend-media-img';
        a.appendChild(thumb);
      }
      var play = el('div', 'aisend-media-cap'); play.textContent = '▶ ' + (m.title || 'Watch video');
      a.appendChild(play);
      card.appendChild(a);
    } else {
      var a2 = document.createElement('a');
      a2.href = m.url; a2.target = '_blank'; a2.className = 'aisend-media-file';
      a2.innerHTML = '<span class="aisend-media-fileicon">📄</span>' +
        '<span class="aisend-media-filetext">' + esc(m.title || 'Download') +
        '<br><small>' + esc(m.type === 'pdf' ? 'PDF' : m.type) + ' • tap to open</small></span>';
      card.appendChild(a2);
    }
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  function addWhatsAppButton(phone, context) {
    // Kept on purpose even when the WhatsApp strip is on: this button carries
    // what the visitor just asked, the strip does not. The number is reduced
    // to digits first, so a saved "+91 98201 23987" still makes a working link
    // and nothing unescaped reaches innerHTML.
    var digits = waDigits(phone) || String(phone).replace(/\D/g, '');
    if (!digits) return;
    var container = document.getElementById('aisend-messages');
    var wrap = el('div', 'aisend-msg aisend-msg-bot');
    var waText = encodeURIComponent('Hi, I was chatting on your website about: ' + context);
    wrap.innerHTML =
      '<a class="aisend-wa-btn" href="https://wa.me/' + digits + '?text=' + waText + '" target="_blank" rel="noopener noreferrer">' +
      'Continue on WhatsApp →</a>';
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    var container = document.getElementById('aisend-messages');
    var t = el('div', 'aisend-msg aisend-msg-bot');
    t.id = 'aisend-typing';
    t.innerHTML = '<div class="aisend-bubble-msg aisend-typing"><span></span><span></span><span></span></div>';
    container.appendChild(t);
    container.scrollTop = container.scrollHeight;
  }
  function hideTyping() {
    var t = document.getElementById('aisend-typing');
    if (t) t.remove();
  }

  // ── WhatsApp strip (optional, OFF unless the server turns it on) ──
  // Shown only when BOTH: the owner switched "Add WhatsApp button" on (the
  // server then sends whatsapp_button_enabled = true) AND the saved number
  // is usable. A click opens https://wa.me/<digits>?text=<message> in a new tab.
  function waStripOn() {
    return config.whatsapp_button_enabled === true && !!waDigits(config.business_phone);
  }
  // Only static markup plus esc()-escaped text, never raw config values.
  function waStripHtml() {
    if (!waStripOn()) return '';
    return '<a class="aisend-wa-strip" id="aisend-wa-strip" href="#" target="_blank" rel="noopener noreferrer">' +
      waIcon() +
      '<span class="aisend-wa-strip-text">' + esc(waStripText(config.whatsapp_button_text)) + '</span>' +
      '<span class="aisend-wa-strip-arrow" aria-hidden="true">&rarr;</span>' +
      '</a>';
  }
  // The link is rebuilt just before it is used, so the message carries the
  // page the visitor is on NOW (single-page sites change title and URL
  // without reloading the widget).
  function wireWaStrip(panel) {
    var a = panel.querySelector('#aisend-wa-strip');
    if (!a) return;
    var refresh = function () {
      a.href = waLink(waDigits(config.business_phone), document.title, window.location.href);
    };
    refresh();
    a.addEventListener('mouseenter', refresh);
    a.addEventListener('focus', refresh);
    a.addEventListener('click', refresh);
  }
  function waIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z" fill="#0f6a37"/>' +
      '<path d="M8.6 7.8c-.4 0-.9.3-1 1.1-.2 1.9 1.2 4.1 2.8 5.5 1.5 1.3 3.4 2.1 4.7 1.7.7-.2 1.1-.9 1.1-1.5 0-.2-.1-.3-.3-.4l-1.8-.9c-.2-.1-.4 0-.5.1l-.6.7c-.1.1-.3.2-.5.1-1-.4-2-1.2-2.6-2.2-.1-.2-.1-.3 0-.5l.5-.6c.1-.1.1-.3.1-.4l-.8-1.8c-.1-.2-.3-.3-.5-.3z" fill="#e8f7ee"/>' +
      '</svg>';
  }

  // WA-HELPERS-START
  // Pure helpers (no DOM, no network). Unit-tested by
  // src/lib/widget/whatsapp-strip.test.ts, which cuts this block out of the
  // file and runs it, so keep the START/END markers.
  var WA_TEXT_DEFAULT = 'Talk to the clinic team directly';
  var WA_TEXT_MAX = 50;

  // One line, no control characters.
  function waClean(s) {
    var str = s == null ? '' : String(s);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      out += (c < 32 || (c >= 127 && c <= 159) || c === 8232 || c === 8233) ? ' ' : str.charAt(i);
    }
    return out.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }
  // Cut to max characters (never half an emoji); dots=true ends with "...".
  function waCut(s, max, dots) {
    if (s.length <= max) return s;
    var keep = dots ? max - 3 : max;
    var t = s.slice(0, keep);
    var last = t.charCodeAt(t.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1);
    t = t.replace(/\s+$/g, '');
    return dots ? t + '...' : t;
  }
  // The strip text: owner's text (plain, one line, max 50), else the default.
  function waStripText(raw) {
    var t = waCut(waClean(raw).replace(/[<>]/g, ''), WA_TEXT_MAX, false);
    return t || WA_TEXT_DEFAULT;
  }
  // Digits for wa.me, or null. Accepts 10-digit Indian mobile, 91XXXXXXXXXX,
  // +91..., 0091..., and other international numbers (8 to 15 digits).
  function waDigits(raw) {
    if (raw == null) return null;
    var s = String(raw).replace(/^\s+|\s+$/g, '');
    if (/[a-z]/i.test(s)) return null;
    var plus = s.charAt(0) === '+';
    var d = s.replace(/\D/g, '');
    if (!plus && d.slice(0, 2) === '00') d = d.slice(2);
    if (!plus) {
      if (d.length === 10) { if (!/^[6-9]/.test(d)) return null; d = '91' + d; }
      else if (d.length === 11 && d.charAt(0) === '0' && /^[6-9]/.test(d.slice(1))) d = '91' + d.slice(1);
    }
    if (d.length < 8 || d.length > 15 || d.charAt(0) === '0') return null;
    return d;
  }
  // "Hi, I'm on "<title>" <url> and I'd like to talk to the team."
  // Title max 60 characters. The URL is the page address WITHOUT ?query and
  // #hash (they can hold tracking codes or personal data); if it is still
  // longer than 150 characters only the site address is used.
  function waPrefill(title, url) {
    var t = waCut(waClean(title).replace(/"/g, "'"), 60, true);
    var u = waClean(url).replace(/\s/g, '').split('#')[0].split('?')[0];
    if (u.length > 150) { var m = u.match(/^https?:\/\/[^\/]+/i); u = m ? m[0] : ''; }
    u = waCut(u, 150, false);
    var where = t && u ? '"' + t + '" ' + u : (t ? '"' + t + '"' : u);
    return where
      ? "Hi, I'm on " + where + " and I'd like to talk to the team."
      : "Hi, I'd like to talk to the team.";
  }
  function waLink(digits, title, url) {
    if (!digits) return '';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(waPrefill(title, url));
  }
  // WA-HELPERS-END

  // ── Helpers ──
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chatIcon(white) {
    // White speech bubble with three dots in the brand colour. The dots
    // read the same CSS variable as the button, so every client's colour
    // is picked up automatically.
    var color = white ? '#fff' : '#fff';
    var dot = 'style="fill:var(--aisend-primary)"';
    return '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
      '<path d="M14 3C7.9 3 3 7.4 3 12.8c0 2.8 1.3 5.3 3.4 7.1L5.6 25l4.9-2.6c1.1.3 2.3.5 3.5.5 6.1 0 11-4.4 11-9.8S20.1 3 14 3z" fill="' + color + '"/>' +
      '<circle cx="9.5" cy="12.9" r="1.6" ' + dot + '/>' +
      '<circle cx="14" cy="12.9" r="1.6" ' + dot + '/>' +
      '<circle cx="18.5" cy="12.9" r="1.6" ' + dot + '/>' +
      '</svg>';
  }
  function sendIcon() {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff"/></svg>';
  }
  function injectStyles() {
    var css =
      ':root{--aisend-primary:' + config.primary_color + '}' +
      '.aisend-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:var(--aisend-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22),inset 0 0 0 2px rgba(255,255,255,.22);z-index:999998;transition:transform .2s,box-shadow .2s}' +
      '.aisend-btn:hover{transform:scale(1.08);box-shadow:0 8px 24px rgba(0,0,0,.28),inset 0 0 0 2px rgba(255,255,255,.3)}' +
      '.aisend-btn::before,.aisend-btn::after{content:"";position:absolute;inset:0;border-radius:50%;border:3px solid var(--aisend-primary);opacity:0;pointer-events:none;animation:aisendRing 2.2s ease-out 1s 6}' +
      '.aisend-btn::before{animation-delay:1.8s}' +
      '@keyframes aisendRing{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(2)}}' +
      '.aisend-btn.aisend-open::before,.aisend-btn.aisend-open::after{animation:none;opacity:0}' +
      '@media (prefers-reduced-motion:reduce){.aisend-btn::before,.aisend-btn::after{animation:none}}' +
      '.aisend-bubble{position:fixed;bottom:90px;right:20px;max-width:260px;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:999998;cursor:pointer;animation:aisendPop .3s ease}' +
      '.aisend-bubble-close{position:absolute;top:6px;right:10px;font-size:18px;color:#999;cursor:pointer;line-height:1}' +
      '.aisend-bubble-text{font-size:14px;color:#222;line-height:1.5;padding-right:12px;font-family:-apple-system,system-ui,sans-serif}' +
      '@keyframes aisendPop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
      /* Lead capture form */
      '.aisend-lead{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin:8px 0;animation:aisendPop .25s ease}' +
      '.aisend-lead-title{font-size:14px;font-weight:700;color:#111827;margin-bottom:2px}' +
      '.aisend-lead-sub{font-size:12px;color:#6b7280;margin-bottom:10px}' +
      '.aisend-lead-input{width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:9px;padding:9px 11px;font-size:13px;margin-bottom:7px;outline:none;font-family:inherit;color:#111827;background:#fff}' +
      '.aisend-lead-input:focus{border-color:var(--aisend-primary)}' +
      '.aisend-lead-invalid{border-color:#ef4444;background:#fef2f2}' +
      '.aisend-lead-err{font-size:11.5px;color:#dc2626;min-height:15px;margin-bottom:4px}' +
      '.aisend-lead-btn{width:100%;border:0;border-radius:9px;padding:10px;background:var(--aisend-primary);color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
      '.aisend-lead-btn:disabled{opacity:.6;cursor:default}' +
      '.aisend-lead-done{font-size:13px;font-weight:600;color:#047857;text-align:center;padding:6px 0}' +
      '.aisend-panel{position:fixed;bottom:20px;right:20px;width:370px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 40px);background:#fff;border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,.24);z-index:999999;flex-direction:column;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}' +
      '.aisend-header{background:var(--aisend-primary);padding:16px;display:flex;align-items:center;justify-content:space-between}' +
      '.aisend-header-info{display:flex;align-items:center;gap:10px}' +
      '.aisend-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}' +
      // object-fit:cover, not contain: a logo letterboxed inside a
      // circle with bands of white either side looks like a mistake.
      '.aisend-avatar-img{width:100%;height:100%;object-fit:cover;display:block}' +
      // Suggested-question chips. Right-aligned because they are things
      // the VISITOR is about to say, and every other visitor message in
      // this panel sits on the right.
      '.aisend-suggestions{display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin:2px 0 4px}' +
      '.aisend-chip{max-width:85%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;text-align:left;font:inherit;font-size:13px;line-height:1.4;' +
        'padding:9px 14px;border-radius:16px 16px 4px 16px;cursor:pointer;' +
        'background:#fff;color:var(--aisend-primary);border:1.5px solid var(--aisend-primary);' +
        'transition:background .15s,color .15s}' +
      '.aisend-chip:hover{background:var(--aisend-primary);color:#fff}' +
      '.aisend-chip:active{transform:translateY(1px)}' +
      '.aisend-bot-name{color:#fff;font-weight:600;font-size:15px}' +
      '.aisend-status{color:rgba(255,255,255,.85);font-size:12px;margin-top:1px}' +
      '.aisend-header-actions{display:flex;align-items:center;gap:10px}' +
      '.aisend-close{color:#fff;font-size:26px;cursor:pointer;line-height:1;opacity:.9}' +
      '.aisend-close:hover{opacity:1}' +
      // WhatsApp strip: one 28px row between the header and the messages.
      // flex-shrink:0 keeps it a fixed height, so the messages area (flex:1,
      // scrolls) simply starts below it, on desktop and in the mobile sheet.
      '.aisend-wa-strip{display:flex;align-items:center;gap:6px;flex-shrink:0;box-sizing:border-box;height:28px;padding:0 14px;background:#e8f7ee;border-bottom:1px solid #bfe5cd;color:#0f6a37;font-family:inherit;font-size:12px;line-height:1;font-weight:500;text-decoration:none;cursor:pointer}' +
      '.aisend-wa-strip:hover,.aisend-wa-strip:focus,.aisend-wa-strip:visited{background:#dcf2e5;color:#0f6a37;text-decoration:none}' +
      '.aisend-wa-strip:focus-visible{outline:2px solid #0f6a37;outline-offset:-2px}' +
      '.aisend-wa-strip svg{flex-shrink:0;display:block}' +
      '.aisend-wa-strip-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.aisend-wa-strip-arrow{flex-shrink:0;font-size:13px}' +
      // Patterned message ground.
      //
      // A flat panel makes the bubbles float in nothing; a texture
      // behind them reads as a place a conversation happens. It is
      // drawn in currentColor at 4% via an inline SVG data URI, so it
      // tints itself to whatever brand colour the merchant set and
      // costs no network request.
      //
      // The opacity is the whole design decision: high enough to feel
      // deliberate, low enough that message text never fights it. Any
      // stronger and the pattern competes with the words, which is the
      // only thing in this panel that matters.
      '.aisend-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;' +
        'color:var(--aisend-primary);background-color:#f7f9fb;' +
        'background-image:url("data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
            '<g fill="none" stroke="' + config.primary_color + '" stroke-opacity=".10" ' +
              'stroke-width="1.4" stroke-linecap="round">' +
            '<circle cx="14" cy="14" r="4.5"/>' +
            '<path d="M35 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 3v-3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"/>' +
            '<path d="M9 40l4 4 8-9"/>' +
            '<circle cx="42" cy="42" r="4.5"/>' +
            '</g></svg>'
          ) + '")}' +
      '.aisend-msg{display:flex;max-width:80%}' +
      '.aisend-msg-user{align-self:flex-end}' +
      '.aisend-msg-bot{align-self:flex-start}' +
      '.aisend-bubble-msg{padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
      '.aisend-msg-user .aisend-bubble-msg{background:var(--aisend-primary);color:#fff;border-bottom-right-radius:4px}' +
      '.aisend-msg-bot .aisend-bubble-msg{background:#fff;color:#222;border:1px solid #e5e9ee;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
      '.aisend-media-card{align-self:flex-start;max-width:80%;margin:2px 0}' +
      '.aisend-media-img{width:100%;border-radius:10px;cursor:pointer;display:block}' +
      '.aisend-media-cap{font-size:12px;color:#555;margin-top:3px;padding:0 2px}' +
      '.aisend-media-video{display:block;text-decoration:none}' +
      '.aisend-media-file{display:flex;align-items:center;gap:10px;padding:12px;background:#fff;border:1px solid #e7ece9;border-radius:10px;text-decoration:none;color:#0c1f17}' +
      '.aisend-media-fileicon{font-size:24px}' +
      '.aisend-media-filetext{font-size:13px;font-weight:600;line-height:1.3}' +
      '.aisend-input-row{display:flex;padding:12px;gap:8px;border-top:1px solid #eef1f4;background:#fff}' +
      '.aisend-input{flex:1;border:1px solid #dde2e8;border-radius:22px;padding:10px 16px;font-size:14px;outline:none;font-family:inherit}' +
      '.aisend-input:focus{border-color:var(--aisend-primary)}' +
      '.aisend-send{width:42px;height:42px;border:none;border-radius:50%;background:var(--aisend-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.aisend-wa-btn{display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:22px;text-decoration:none;font-size:14px;font-weight:600}' +
      '.aisend-newchat-btn{font:inherit;font-size:13px;padding:8px 14px;border-radius:18px;cursor:pointer;background:#fff;color:var(--aisend-primary);border:1.5px solid var(--aisend-primary)}' +
      '.aisend-newchat-btn:hover{background:var(--aisend-primary);color:#fff}' +
      '.aisend-typing{display:flex;gap:4px;align-items:center}' +
      '.aisend-typing span{width:7px;height:7px;border-radius:50%;background:#bbb;animation:aisendBlink 1.4s infinite both}' +
      '.aisend-typing span:nth-child(2){animation-delay:.2s}' +
      '.aisend-typing span:nth-child(3){animation-delay:.4s}' +
      '@keyframes aisendBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}' +
      // Phones: a compact sheet that leaves the page visible above it and the
      // round button visible below, instead of covering the whole screen.
      '@media(max-width:480px){.aisend-panel{left:10px;right:10px;bottom:96px;width:auto;max-width:none;height:min(58vh,420px);height:min(58dvh,420px);max-height:calc(100vh - 120px);border-radius:16px}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
