/* AiSend Website Chat Widget
 * Embed: <script src="https://app.performancemktg.net/widget.js" data-org="USER_ID"></script>
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
  var AGENT_ID = script.getAttribute('data-agent') || null;
  if (!scriptTag) return;

  var ORG_ID = scriptTag.getAttribute('data-org');
  if (!ORG_ID) { console.error('[AiSend] data-org is required'); return; }

  // Derive API base from the script src
  var API_BASE = (function () {
    try {
      var u = new URL(scriptTag.src);
      return u.origin;
    } catch (e) {
      return 'https://app.performancemktg.net';
    }
  })();

  // ── Visitor ID (persistent across sessions) ──
  var VISITOR_KEY = 'aisend_visitor_' + ORG_ID;
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
    business_phone: null
  };
  var isOpen = false;
  var messages = []; // {role:'user'|'bot', text}
  var bubbleShown = false;

  // ── Fetch config, then build UI ──
  fetch(API_BASE + '/api/widget/config?org=' + encodeURIComponent(ORG_ID))
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
        // auto-dismiss after 15s
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
          '<div class="aisend-avatar">' + chatIcon(true) + '</div>' +
          '<div>' +
            '<div class="aisend-bot-name">' + esc(config.bot_name) + '</div>' +
            '<div class="aisend-status">● Online</div>' +
          '</div>' +
        '</div>' +
        '<div class="aisend-header-actions">' +
          (config.business_phone ? '<a class="aisend-wa-header" id="aisend-wa-header" href="https://wa.me/' + config.business_phone + '" target="_blank" title="Chat on WhatsApp">' + waIcon() + '</a>' : '') +
          '<div class="aisend-close" id="aisend-close">&times;</div>' +
        '</div>' +
      '</div>' +
      '<div class="aisend-messages" id="aisend-messages"></div>' +
      '<div class="aisend-input-row">' +
        '<input type="text" class="aisend-input" id="aisend-input" placeholder="Type your message..." />' +
        '<button class="aisend-send" id="aisend-send">' + sendIcon() + '</button>' +
      '</div>';
    document.body.appendChild(panel);

    document.getElementById('aisend-close').onclick = togglePanel;
    document.getElementById('aisend-send').onclick = sendMessage;
    document.getElementById('aisend-input').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendMessage();
    });

    // Set theme color
    document.documentElement.style.setProperty('--aisend-primary', config.primary_color);
  }

  function togglePanel() {
    var panel = document.getElementById('aisend-panel');
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    // Remove any bubble
    var b = document.querySelector('.aisend-bubble');
    if (b) b.remove();

    if (isOpen && messages.length === 0) {
      // Show welcome message
      addMessage('bot', config.welcome_message);
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

    addMessage('user', text);
    showTyping();

    fetch(API_BASE + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG_ID,
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
        // If handoff requested and we have a phone, show WhatsApp button
        if (data.handoff && data.business_phone) {
          addWhatsAppButton(data.business_phone, text);
        }
      })
      .catch(function () {
        hideTyping();
        addMessage('bot', 'Sorry, I had trouble connecting. Please try again.');
      });
  }

  function addMessage(role, text) {
    messages.push({ role: role, text: text });
    var container = document.getElementById('aisend-messages');
    var msg = el('div', 'aisend-msg aisend-msg-' + role);
    msg.innerHTML = '<div class="aisend-bubble-msg">' + esc(text) + '</div>';
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addWhatsAppButton(phone, context) {
    var container = document.getElementById('aisend-messages');
    var wrap = el('div', 'aisend-msg aisend-msg-bot');
    var waText = encodeURIComponent('Hi, I was chatting on your website about: ' + context);
    wrap.innerHTML =
      '<a class="aisend-wa-btn" href="https://wa.me/' + phone + '?text=' + waText + '" target="_blank">' +
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

  // ── Helpers ──
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chatIcon(white) {
    var color = white ? '#fff' : '#fff';
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.5 1.14 4.75 3 6.36V22l3.6-2c1.06.32 2.2.5 3.4.5 5.52 0 10-4.04 10-9S17.52 2 12 2z" fill="' + color + '"/></svg>';
  }
  function waIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2"/></svg>';
  }
  function sendIcon() {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff"/></svg>';
  }

  function injectStyles() {
    var css =
      ':root{--aisend-primary:' + config.primary_color + '}' +
      '.aisend-btn{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:var(--aisend-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:999998;transition:transform .2s}' +
      '.aisend-btn:hover{transform:scale(1.08)}' +
      '.aisend-bubble{position:fixed;bottom:90px;right:20px;max-width:260px;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:999998;cursor:pointer;animation:aisendPop .3s ease}' +
      '.aisend-bubble-close{position:absolute;top:6px;right:10px;font-size:18px;color:#999;cursor:pointer;line-height:1}' +
      '.aisend-bubble-text{font-size:14px;color:#222;line-height:1.5;padding-right:12px;font-family:-apple-system,system-ui,sans-serif}' +
      '@keyframes aisendPop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
      '.aisend-panel{position:fixed;bottom:20px;right:20px;width:370px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 40px);background:#fff;border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,.24);z-index:999999;flex-direction:column;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}' +
      '.aisend-header{background:var(--aisend-primary);padding:16px;display:flex;align-items:center;justify-content:space-between}' +
      '.aisend-header-info{display:flex;align-items:center;gap:10px}' +
      '.aisend-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}' +
      '.aisend-bot-name{color:#fff;font-weight:600;font-size:15px}' +
      '.aisend-status{color:rgba(255,255,255,.85);font-size:12px;margin-top:1px}' +
      '.aisend-header-actions{display:flex;align-items:center;gap:10px}' +
      '.aisend-wa-header{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.18);transition:background .2s}' +
      '.aisend-wa-header:hover{background:rgba(255,255,255,.32)}' +
      '.aisend-close{color:#fff;font-size:26px;cursor:pointer;line-height:1;opacity:.9}' +
      '.aisend-close:hover{opacity:1}' +
      '.aisend-messages{flex:1;overflow-y:auto;padding:16px;background:#f7f9fb;display:flex;flex-direction:column;gap:10px}' +
      '.aisend-msg{display:flex;max-width:80%}' +
      '.aisend-msg-user{align-self:flex-end}' +
      '.aisend-msg-bot{align-self:flex-start}' +
      '.aisend-bubble-msg{padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
      '.aisend-msg-user .aisend-bubble-msg{background:var(--aisend-primary);color:#fff;border-bottom-right-radius:4px}' +
      '.aisend-msg-bot .aisend-bubble-msg{background:#fff;color:#222;border:1px solid #e5e9 ;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
      '.aisend-input-row{display:flex;padding:12px;gap:8px;border-top:1px solid #eef1f4;background:#fff}' +
      '.aisend-input{flex:1;border:1px solid #dde2e8;border-radius:22px;padding:10px 16px;font-size:14px;outline:none;font-family:inherit}' +
      '.aisend-input:focus{border-color:var(--aisend-primary)}' +
      '.aisend-send{width:42px;height:42px;border:none;border-radius:50%;background:var(--aisend-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.aisend-wa-btn{display:inline-block;background:#25D366;color:#fff;padding:10px 18px;border-radius:22px;text-decoration:none;font-size:14px;font-weight:600}' +
      '.aisend-typing{display:flex;gap:4px;align-items:center}' +
      '.aisend-typing span{width:7px;height:7px;border-radius:50%;background:#bbb;animation:aisendBlink 1.4s infinite both}' +
      '.aisend-typing span:nth-child(2){animation-delay:.2s}' +
      '.aisend-typing span:nth-child(3){animation-delay:.4s}' +
      '@keyframes aisendBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}' +
      '@media(max-width:480px){.aisend-panel{width:100vw;height:100vh;max-width:100vw;max-height:100vh;bottom:0;right:0;border-radius:0}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
