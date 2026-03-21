/**
 * VerifyBot Floating Chat Widget
 * Connects the Flask frontend to the FastAPI chatbot at localhost:8000
 */
(function () {
  'use strict';

  const CHATBOT_API = 'http://127.0.0.1:8000';
  let sessionId = 'vb-' + Math.random().toString(36).substr(2, 9);
  let isOpen = false;
  let isTyping = false;
  let messageCount = 0;

  // ── Inject CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* VerifyBot Widget — scoped to #vb-* */
    #vb-trigger {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: #F2EDE4;
      border: 1.5px solid #D4C9B8;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08);
      transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s;
      animation: vb-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    }
    #vb-trigger:hover {
      transform: scale(1.10);
      box-shadow: 0 8px 28px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10);
    }
    #vb-trigger img {
      width: 80%; height: 80%;
      border-radius: 50%; object-fit: cover;
      pointer-events: none;
    }
    /* Dark mode: launcher */
    body.dark-mode #vb-trigger,
    body.night-mode #vb-trigger,
    [data-theme="dark"] #vb-trigger {
      background: #14213D;
      border-color: #2A3F60;
    }
    @keyframes vb-pop {
      from { transform: scale(0); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    #vb-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 700;
      width: 18px; height: 18px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
      display: none;
    }

    #vb-window {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      width: 380px; height: 560px;
      background: #F2EDE4;
      border-radius: 16px;
      border: 1px solid #D4C9B8;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      display: flex; flex-direction: column;
      overflow: hidden;
      transform: scale(0.85) translateY(30px);
      transform-origin: bottom right;
      opacity: 0;
      pointer-events: none;
      transition: transform .3s cubic-bezier(.34,1.2,.64,1), opacity .25s ease;
      font-family: 'Inter', 'Source Sans 3', -apple-system, sans-serif;
    }
    #vb-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    #vb-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      background: #FFFFFF;
      border-bottom: 1px solid #E0D8CC;
      flex-shrink: 0;
    }
    #vb-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: #F2EDE4;
      border: 1.5px solid #D4C9B8;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    #vb-avatar img {
      width: 82%; height: 82%;
      border-radius: 50%; object-fit: cover;
    }
    #vb-header-info { flex: 1; }
    #vb-header-info h3 { font-size: 13px; font-weight: 700; color: #1A1A2E; margin: 0; }
    .vb-header-status-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .vb-online-badge {
      display: inline-flex; align-items: center;
      background: #E1F5EE; color: #0F6E56;
      padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: 600;
    }
    .vb-status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #0F6E56; display: inline-block; margin-right: 4px;
      animation: vb-pulse 2s infinite;
    }
    @keyframes vb-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

    #vb-close {
      background: none; border: none; cursor: pointer;
      color: #1A1A2E; font-size: 18px; line-height: 1;
      padding: 4px;
      transition: color .2s, transform .2s;
    }
    #vb-close:hover { color: #666666; transform: rotate(90deg); }
    #vb-move-btn { color: #1A1A2E !important; }

    /* Messages */
    #vb-messages {
      flex: 1; overflow-y: auto;
      padding: 16px 14px;
      display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(108,99,255,0.3) transparent;
    }
    #vb-messages::-webkit-scrollbar { width: 4px; }
    #vb-messages::-webkit-scrollbar-track { background: #F2EDE4; }
    #vb-messages::-webkit-scrollbar-thumb { background: #C8BFB0; border-radius: 4px; }

    .vb-row { display: flex; gap: 8px; animation: vb-fadeup .3s ease; }
    .vb-row.user { flex-direction: row-reverse; }
    @keyframes vb-fadeup {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .vb-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
      overflow: hidden;
    }
    .vb-row.bot  .vb-msg-avatar {
      background: #F2EDE4;
      border: 1.5px solid #D4C9B8;
    }
    .vb-row.user .vb-msg-avatar { background: #1A1A2E; color: #FFFFFF; font-size: 13px; }

    .vb-bubble-wrap { display: flex; flex-direction: column; gap: 4px; max-width: 82%; }
    .vb-row.user .vb-bubble-wrap { align-items: flex-end; }

    .vb-bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px; line-height: 1.55;
    }
    .vb-row.bot .vb-bubble {
      background: #FFFFFF;
      color: #1A1A2E;
      border: 0.5px solid #E0D8CC;
      border-top-left-radius: 4px;
    }
    .vb-row.user .vb-bubble {
      background: #1A1A2E;
      color: #FFFFFF;
      border-top-right-radius: 4px;
    }

    /* Markdown in bot bubbles */
    .vb-bubble p  { margin: 0 0 0.6rem; }
    .vb-bubble p:last-child { margin-bottom: 0; }
    .vb-bubble ul, .vb-bubble ol { margin: 0.3rem 0 0.6rem 1.1rem; }
    .vb-bubble li { margin-bottom: 0.3rem; }
    .vb-bubble strong { font-weight: 700; color: inherit; }
    .vb-bubble code  { background: rgba(0,0,0,.05); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    .vb-bubble h2, .vb-bubble h3 { font-size: 13px; margin: 0.5rem 0 0.3rem; }

    /* Quick replies mode buttons */
    .vb-qr-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .vb-qr {
      padding: 5px 11px; border-radius: 6px;
      border: none;
      background: #E8E2D8;
      color: #666666; font-size: 11px;
      cursor: pointer; transition: all .2s ease;
      font-family: inherit; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
    }
    .vb-qr:hover { background: #E0D8CC; }
    .vb-qr.active { background: #1A1A2E; color: #FFFFFF; }

    /* Typing indicator */
    #vb-typing {
      display: flex; gap: 8px;
      padding: 0 14px 8px;
      align-items: center;
      min-height: 0;
      overflow: hidden;
      max-height: 0;
      transition: max-height .25s ease, padding .25s ease;
    }
    #vb-typing.active { max-height: 40px; padding: 0 14px 8px; }
    .vb-tdots {
      background: #FFFFFF; border: 0.5px solid #E0D8CC;
      border-radius: 14px; border-top-left-radius: 4px;
      padding: 8px 14px; display: flex; gap: 5px; align-items: center;
    }
    .vb-tdot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #1A1A2E;
    }
    .vb-tdot:nth-child(1){animation:vb-bounce .9s 0s infinite}
    .vb-tdot:nth-child(2){animation:vb-bounce .9s .15s infinite}
    .vb-tdot:nth-child(3){animation:vb-bounce .9s .3s infinite}
    @keyframes vb-bounce {
      0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)}
    }

    /* Input */
    #vb-input-area {
      padding: 10px 12px 12px;
      background: #F2EDE4;
      border-top: 1px solid #D4C9B8;
      flex-shrink: 0;
    }
    #vb-input-row {
      display: flex; gap: 8px; align-items: flex-end;
    }
    #vb-input {
      flex: 1;
      background: #FFFFFF;
      border: 1px solid #D4C9B8;
      border-radius: 10px;
      padding: 10px 14px;
      color: #1A1A2E;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 40px;
      max-height: 90px;
      outline: none;
      transition: border-color .2s;
    }
    #vb-input:focus { border-color: #1A1A2E; outline: none; }
    #vb-input::placeholder { color: #999999; }
    #vb-send {
      width: 40px; height: 40px; border-radius: 50%;
      border: none;
      background: #1A1A2E;
      color: #fff; font-size: 16px; cursor: pointer;
      transition: all .2s ease; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #vb-send:hover { background: #2C3E50; transform: scale(1.05); }
    #vb-send:disabled { opacity: .45; cursor: not-allowed; transform: none; }

    #vb-hint { font-size: 10px; color: rgba(26,26,46,.5); text-align: center; margin-top: 6px; }

    /* Offline banner */
    #vb-offline-banner {
      display: none;
      background: #FFF3CD;
      border-bottom: 1px solid #FFEAA7;
      color: #856404;
      font-size: 12px; padding: 6px 14px;
      text-align: center;
      flex-shrink: 0;
    }
    #vb-offline-banner.show { display: block; }

    /* Drag handle */
    #vb-drag-handle {
      display: flex; flex-direction: column; gap: 3px;
      padding: 6px 8px; cursor: grab; opacity: 0.5;
      transition: opacity 0.15s; border-radius: 4px;
    }
    #vb-drag-handle:hover { opacity: 1; }
    #vb-drag-handle:active { cursor: grabbing; }
    #vb-drag-handle span {
      display: block; width: 14px; height: 2px;
      background: rgba(26,26,46,0.5); border-radius: 1px;
    }

    #vb-window.dragging {
      opacity: 0.95; box-shadow: 0 28px 70px rgba(0,0,0,0.25);
      transition: none !important;
    }

    /* Resize handle */
    #vb-resize-handle {
      position: absolute; bottom: 0; right: 0;
      width: 18px; height: 18px; cursor: se-resize;
      opacity: 0.3; transition: opacity 0.15s;
    }
    #vb-resize-handle:hover { opacity: 0.8; }
    #vb-resize-handle::before {
      content: ''; position: absolute; bottom: 4px; right: 4px;
      width: 8px; height: 8px; border-right: 2px solid #1A1A2E; border-bottom: 2px solid #1A1A2E; border-radius: 0 0 2px 0;
    }

    /* Position Panel */
    #vb-position-panel {
      display: none; position: absolute; top: 56px; right: 12px;
      background: #FFFFFF; border: 1px solid #D4C9B8;
      border-radius: 12px; padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      z-index: 10; width: 220px;
    }
    #vb-position-panel.open { display: block; }
    .vb-pos-title {
      font-size: 11px; font-weight: 600; color: #666666;
      letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;
    }
    .vb-pos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
    .vb-pos-btn, .vb-size-btn {
      padding: 8px 6px; border-radius: 8px; border: 1px solid #D4C9B8;
      background: #F2EDE4; font-size: 11px; font-weight: 500; color: #1A1A2E;
      cursor: pointer; text-align: center; transition: all 0.15s;
    }
    .vb-pos-btn:hover, .vb-size-btn:hover { background: #1A1A2E; border-color: #1A1A2E; color: #fff; }
    .vb-pos-divider { height: 1px; background: #E0D8CC; margin: 6px 0; }
    .vb-size-row { display: flex; gap: 6px; }
    .vb-size-btn { flex: 1; padding: 7px 4px; }

    .vb-chips-row {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 6px 6px 42px;
      animation: vb-pop 0.2s ease;
    }
    .vb-chip {
      font-size: 12px; font-weight: 500; padding: 6px 14px;
      border-radius: 20px; border: 1px solid #C8BFB0;
      background: #FFFFFF; color: #1A1A2E;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s ease;
      white-space: nowrap;
    }
    .vb-chip:hover {
      background: #1A1A2E; border-color: #1A1A2E; color: #FFFFFF;
    }
    .vb-list-item { display: flex; gap: 8px; align-items: flex-start; margin: 3px 0; line-height: 1.5; }
    .vb-list-num {
      min-width: 18px; height: 18px; background: #1A1A2E; color: #fff; border-radius: 50%;
      font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
    }
    .vb-bullet-item { display: flex; gap: 8px; align-items: flex-start; margin: 2px 0; line-height: 1.5; }
    .vb-bullet-dot { color: #1A1A2E; font-weight: 700; flex-shrink: 0; margin-top: 1px; }

    /* Dark mode overrides */
    body.dark-mode #vb-window, body.night-mode #vb-window, [data-theme="dark"] #vb-window { background: #1A1A2E; border-color: #2A3F60; }
    body.dark-mode #vb-header, body.night-mode #vb-header, [data-theme="dark"] #vb-header { background: #16213E; border-color: #2A3F60; }
    body.dark-mode #vb-header-info h3, body.night-mode #vb-header-info h3, [data-theme="dark"] #vb-header-info h3 { color: #FFFFFF; }
    body.dark-mode #vb-header-info p, body.night-mode #vb-header-info p, [data-theme="dark"] #vb-header-info p { color: #CCCCCC; }
    body.dark-mode #vb-close, body.night-mode #vb-close, [data-theme="dark"] #vb-close { color: #CCCCCC; }
    body.dark-mode #vb-move-btn, body.night-mode #vb-move-btn, [data-theme="dark"] #vb-move-btn { color: #CCCCCC !important; }
    body.dark-mode .vb-row.bot .vb-bubble, body.night-mode .vb-row.bot .vb-bubble, [data-theme="dark"] .vb-row.bot .vb-bubble { background: #16213E; color: #FFFFFF; border-color: #2A3F60; }
    body.dark-mode #vb-input-area, body.night-mode #vb-input-area, [data-theme="dark"] #vb-input-area { background: #1A1A2E; border-color: #2A3F60; }
    body.dark-mode #vb-input, body.night-mode #vb-input, [data-theme="dark"] #vb-input { background: #16213E; color: #FFFFFF; border-color: #2A3F60; }
    body.dark-mode .vb-qr, body.night-mode .vb-qr, [data-theme="dark"] .vb-qr { background: #2D2B55; color: #CCCCCC; }
    body.dark-mode .vb-chip, body.night-mode .vb-chip, [data-theme="dark"] .vb-chip { background: #16213E; color: #FFFFFF; border-color: #2A3F60; }
    body.dark-mode .vb-chip:hover, body.night-mode .vb-chip:hover, [data-theme="dark"] .vb-chip:hover { background: #2D2B55; color: #FFFFFF; border-color: #2D2B55; }
    body.dark-mode .vb-tdots, body.night-mode .vb-tdots, [data-theme="dark"] .vb-tdots { background: #16213E; border-color: #2A3F60; }
    body.dark-mode .vb-tdot, body.night-mode .vb-tdot, [data-theme="dark"] .vb-tdot { background: #FFFFFF; }
    body.dark-mode .vb-msg-avatar, body.night-mode .vb-msg-avatar, [data-theme="dark"] .vb-msg-avatar { background: #14213D; border-color: #2A3F60; }
    body.dark-mode #vb-position-panel, body.night-mode #vb-position-panel, [data-theme="dark"] #vb-position-panel { background: #16213E; border-color: #2A3F60; }

    /* Mobile responsive */
    @media (max-width: 480px) {
      #vb-window {
        width: calc(100vw - 24px);
        right: 12px; bottom: 90px;
        height: 70vh; min-height: 400px;
      }
      #vb-trigger { bottom: 18px; right: 18px; }
    }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ──────────────────────────────────────────────────────
  const html = `
  <!-- VerifyBot Trigger Button -->
  <button id="vb-trigger" title="Chat with VerifyBot" aria-label="Open VerifyBot">
    <img src="/static/images/CHATBOT_ICON.png" alt="VerifyBot" style="width:38px;height:38px;border-radius:50%;object-fit:cover;pointer-events:none;">
    <span id="vb-badge">1</span>
  </button>

  <!-- VerifyBot Chat Window -->
  <div id="vb-window" role="dialog" aria-label="VerifyBot Chat">
    
    <!-- Position Panel -->
    <div id="vb-position-panel">
      <div class="vb-pos-title">Move to corner</div>
      <div class="vb-pos-grid">
        <button class="vb-pos-btn" onclick="window.vbSnapToCorner('top-left')">↖ Top Left</button>
        <button class="vb-pos-btn" onclick="window.vbSnapToCorner('top-right')">↗ Top Right</button>
        <button class="vb-pos-btn" onclick="window.vbSnapToCorner('bottom-left')">↙ Bottom Left</button>
        <button class="vb-pos-btn" onclick="window.vbSnapToCorner('bottom-right')">↘ Bottom Right</button>
      </div>
      <div class="vb-pos-divider"></div>
      <div class="vb-pos-title">Window size</div>
      <div class="vb-size-row">
        <button class="vb-size-btn" onclick="window.vbSetWindowSize('small')">Small</button>
        <button class="vb-size-btn" onclick="window.vbSetWindowSize('medium')">Medium</button>
        <button class="vb-size-btn" onclick="window.vbSetWindowSize('large')">Large</button>
      </div>
      <div class="vb-pos-divider"></div>
      <button class="vb-pos-btn" style="width:100%;margin-top:2px" onclick="window.vbResetPosition()">↺ Reset to default</button>
    </div>

    <!-- Header -->
    <div id="vb-header">
      <div id="vb-drag-handle" title="Drag to move"><span></span><span></span><span></span></div>
      <div id="vb-avatar"><img src="/static/images/CHATBOT_ICON.png" alt="VerifyBot" style="width:34px;height:34px;border-radius:50%;object-fit:cover;"></div>
      <div id="vb-header-info">
        <h3>VerifyBot</h3>
        <div class="vb-header-status-row">
          <div class="vb-online-badge"><span class="vb-status-dot"></span>Online</div>
          <span id="vb-mode-badge" style="display:none;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;color:#fff;"></span>
        </div>
      </div>
      <button onclick="document.getElementById('vb-position-panel').classList.toggle('open')" title="Move / resize" id="vb-move-btn" style="background:none;border:none;color:#9095b4;cursor:pointer;font-size:16px;">⤢</button>
      <button id="vb-close" aria-label="Close chat" style="background:none;border:none;color:#9095b4;cursor:pointer;font-size:18px;margin-left:4px;">✕</button>
    </div>

    <!-- Offline Banner -->
    <div id="vb-offline-banner">⚠️ Chatbot server offline. Start it with: <code>python fake_news_chatbot/api.py</code></div>

    <!-- Messages -->
    <div id="vb-messages"></div>

    <!-- Quick Actions -->
    <div id="vb-quick-actions" style="padding: 0 14px 4px; display:flex; gap:6px;">
      <button class="vb-qr" onclick="window.vbSetModeQuick('auto')" title="Switch to auto answers"><img src="/static/images/CHATBOT_ICON.png" alt="" style="width:12px;height:12px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:2px;margin-bottom:2px;">Auto</button>
      <button class="vb-qr" onclick="window.vbSetModeQuick('brief')" title="Switch to brief answers">⚡ Brief</button>
      <button class="vb-qr" onclick="window.vbSetModeQuick('detailed')" title="Switch to detailed answers">📖 Detailed</button>
    </div>

    <!-- Typing Indicator -->
    <div id="vb-typing">
      <div style="width:28px;"></div>
      <div class="vb-tdots">
        <div class="vb-tdot"></div>
        <div class="vb-tdot"></div>
        <div class="vb-tdot"></div>
      </div>
    </div>

    <!-- Input Area -->
    <div id="vb-input-area">
      <div id="vb-input-row">
        <textarea id="vb-input" placeholder="Ask me anything or paste a news claim..." rows="1"></textarea>
        <button id="vb-send" aria-label="Send message">&#10148;</button>
      </div>
      <div id="vb-hint">⌨️ Press Enter to send · Shift+Enter for new line</div>
    </div>
    
    <!-- Resize handle -->
    <div id="vb-resize-handle"></div>
  </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  // ── DOM References ───────────────────────────────────────────────────
  const trigger    = document.getElementById('vb-trigger');
  const win        = document.getElementById('vb-window');
  const closeBtn   = document.getElementById('vb-close');
  const messages   = document.getElementById('vb-messages');
  const typingEl   = document.getElementById('vb-typing');
  const input      = document.getElementById('vb-input');
  const sendBtn    = document.getElementById('vb-send');
  const badge      = document.getElementById('vb-badge');
  const offlineBanner = document.getElementById('vb-offline-banner');

  /* ── State & Detection ── */
  let RESPONSE_MODE = 'auto'; 
  
  function detectModeChange(text) {
    const t = text.toLowerCase().trim();

    /* Brief triggers */
    const briefWords = [
      'brief','short','quick','summarize','summary',
      'briefly','in short','tldr','tl;dr',
      'short answer','brief answer','give me brief',
      'keep it short','simple answer','just tell me',
      'one line','one sentence','quickly',
      'chota','chhota','short mein','brief mein',
      'short me','short batao','short ma',
    ];

    /* Detailed triggers */
    const detailWords = [
      'detail','detailed','explain','elaborate',
      'in depth','more info','tell me more',
      'full answer','complete answer','everything',
      'step by step','full detail','poora',
      'pura batao','detail mein','explain fully',
      'give me all','full explanation',
    ];

    const wordCount = t.split(/\s+/).length;

    /* If message is short (≤5 words) and contains mode trigger → pure mode change */
    if (wordCount <= 5) {
      if (briefWords.some(w => t.includes(w))) return 'brief';
      if (detailWords.some(w => t === w || t === 'be ' + w || t.startsWith(w + ' mode'))) return 'detailed';
      if (['auto', 'normal', 'reset'].some(w => t.includes(w))) return 'auto';
    }

    /* For longer messages: only switch if message STARTS with a mode trigger word */
    const modeOnlyPhrases = [
      'brief mode', 'short mode', 'detailed mode',
      'give brief', 'give short', 'give detailed',
      'answer brief', 'answer short', 'answer detailed',
      'be brief', 'be short', 'be detailed',
    ];

    if (modeOnlyPhrases.some(p => t.startsWith(p)))  {
      if (briefWords.some(w => t.includes(w))) return 'brief';
      if (detailWords.some(w => t.includes(w))) return 'detailed';
    }

    return null;
  }

  function updateModeIndicator() {
    const el = document.getElementById('vb-mode-badge');
    if (!el) return;
    const labels = {
      'brief':   { text: '⚡ Brief', bg: '#EF9F27' },
      'detailed':{ text: '📖 Detailed', bg: '#378ADD' },
      'auto':    { text: '<img src="/static/images/CHATBOT_ICON.png" alt="" style="width:10px;height:10px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:2px;margin-bottom:1px;">Auto', bg: '#22c55e' },
    };
    const m = labels[RESPONSE_MODE];
    el.innerHTML = m.text;
    el.style.background = m.bg;
    el.style.display = 'inline-block';

    const btns = document.querySelectorAll('#vb-quick-actions .vb-qr');
    btns.forEach(b => {
      if (b.getAttribute('onclick').includes("('" + RESPONSE_MODE + "')")) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  function getAutoComplexity(text) {
    const words = text.trim().split(/\\s+/).length;
    const simple = ['what is', 'where is', 'how to', 'kya hai', 'kahan hai'];
    const complex = ['explain', 'how does', 'why does', 'compare', 'analyze'];
    if (words > 20) return 'detailed';
    if (complex.some(q => text.toLowerCase().includes(q))) return 'detailed';
    if (simple.some(q => text.toLowerCase().includes(q))) return 'brief';
    if (words <= 6) return 'brief';
    return 'medium';
  }

  function getModeInstruction(text) {
    const effective = RESPONSE_MODE === 'auto' ? getAutoComplexity(text) : RESPONSE_MODE;
    return {
      'brief': 'RESPONSE MODE: BRIEF. Max 3 sentences. No bullet points unless essential. Just the key point.',
      'medium': 'RESPONSE MODE: MEDIUM. 4-6 sentences or short list. Be helpful but concise.',
      'detailed': 'RESPONSE MODE: DETAILED. Complete thorough answer. Use numbered steps, bullets, examples.'
    }[effective] || 'RESPONSE MODE: MEDIUM. 4-6 sentences or short list.';
  }

  function getCurrentPage() {
    const meta = document.querySelector('meta[name="current-page"]');
    if (meta) {
      let p = meta.getAttribute('content') || '/';
      return p.toLowerCase().trim();
    }
    let p = window.location.pathname || '/';
    p = p.split('?')[0].split('#')[0].toLowerCase().trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }

  // ── Smart Text formatter ─────────
  function formatBotText(text) {
    if (!text) return '';

    // ── Detect FCM Section 7A verdict block ──────────────────────
    // Pattern: starts with ━━ line, then Verdict: / Confidence: lines
    if (/^━+\s*\nVerdict:/m.test(text) || /^━{10,}/.test(text.trim())) {
      return renderVerdictCard(text);
    }

    let formatted = text
      /* Escape HTML first */
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')

      /* Bold: **text** → <strong>text</strong> */
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

      /* Numbered list: "1. item" → styled list item */
      .replace(/^(\d+)\.\s(.+)$/gm,
        '<div class="vb-list-item">' +
        '<span class="vb-list-num">$1</span>' +
        '<span>$2</span></div>')

      /* Bullet: "• item" or "- item" */
      .replace(/^[•\-]\s(.+)$/gm,
        '<div class="vb-bullet-item">' +
        '<span class="vb-bullet-dot">•</span>' +
        '<span>$1</span></div>')

      /* Line breaks */
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')

      /* Arrow → */
      .replace(/→/g, '<span style="color:#6c63ff">→</span>');

    return formatted;
  }

  // ── FCM Verdict Card Renderer ─────────────────────────────────
  function renderVerdictCard(text) {
    const lines = text.split('\n');
    let verdict = '', confidence = '', explanation = [], signals = [], correct = [], inSignals = false, inCorrect = false, inExplain = false;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^━+$/.test(line)) { inSignals = false; inCorrect = false; inExplain = false; continue; }

      if (line.startsWith('Verdict:'))     { verdict     = line.replace('Verdict:', '').trim(); inSignals=false; inCorrect=false; inExplain=false; continue; }
      if (line.startsWith('Confidence:'))  { confidence  = line.replace('Confidence:', '').trim(); inSignals=false; inCorrect=false; inExplain=false; continue; }
      if (line.startsWith('Explanation:')) { inExplain=true; inSignals=false; inCorrect=false; continue; }
      if (line.startsWith('Key Signals:')) { inSignals=true; inExplain=false; inCorrect=false; continue; }
      if (line.startsWith('Correct Information:')) { inCorrect=true; inSignals=false; inExplain=false; continue; }

      if (inSignals && line.startsWith('-')) { signals.push(line.slice(1).trim()); continue; }
      if (inCorrect && line) { correct.push(line); continue; }
      if (inExplain && line) { explanation.push(line); continue; }
    }

    const colors = { REAL:'#22c55e', FAKE:'#ef4444', MISLEADING:'#f59e0b' };
    const icons  = { REAL:'✅', FAKE:'❌', MISLEADING:'⚠️' };
    const vKey   = verdict.toUpperCase();
    const vColor = colors[vKey] || '#a78bfa';
    const vIcon  = icons[vKey]  || '🔍';

    const confColor = { High:'#22c55e', Medium:'#f59e0b', Low:'#9ca3af' }[confidence] || '#9ca3af';

    let html = `<div style="border:1px solid ${vColor}33;border-radius:12px;overflow:hidden;margin:-2px;font-size:12.5px;">`;

    // Header strip
    html += `<div style="background:${vColor}22;padding:10px 13px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${vColor}33;">`;
    html += `<span style="font-size:18px">${vIcon}</span>`;
    html += `<div style="flex:1"><div style="font-weight:700;font-size:13px;color:${vColor}">${verdict}</div>`;
    html += `<div style="font-size:11px;color:${confColor};margin-top:1px;">Confidence: ${confidence}</div></div></div>`;

    // Body
    html += `<div style="padding:10px 13px;display:flex;flex-direction:column;gap:8px;">`;

    if (explanation.length) {
      html += `<div style="color:#d1d5db;line-height:1.5">${explanation.map(l=>escapeHtml(l)).join('<br>')}</div>`;
    }

    if (signals.length) {
      html += `<div><div style="font-size:10px;font-weight:600;color:#9095b4;letter-spacing:.5px;margin-bottom:4px">KEY SIGNALS</div>`;
      html += signals.map(s => `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:3px"><span style="color:#ef4444;flex-shrink:0">🚩</span><span style="color:#d1d5db">${escapeHtml(s)}</span></div>`).join('');
      html += `</div>`;
    }

    if (correct.length) {
      html += `<div style="background:rgba(34,197,94,.1);border-left:3px solid #22c55e;border-radius:0 6px 6px 0;padding:8px 10px;">`;
      html += `<div style="font-size:10px;font-weight:600;color:#22c55e;margin-bottom:3px">✅ CORRECT INFORMATION</div>`;
      html += `<div style="color:#d1d5db;line-height:1.4">${correct.map(l=>escapeHtml(l)).join('<br>')}</div></div>`;
    }

    // CTA link
    html += `<div style="font-size:10.5px;color:#6c63ff;border-top:1px solid rgba(108,99,255,.15);padding-top:7px;margin-top:2px">`;
    html += `<a href="/" style="color:#6c63ff;text-decoration:none">🚀 Get full 3-layer AI analysis on the Home page →</a></div>`;

    html += `</div></div>`;
    return html;
  }


  // ── Helpers ──────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    isTyping = true;
    typingEl.classList.add('active');
    scrollToBottom();
  }

  function hideTyping() {
    isTyping = false;
    typingEl.classList.remove('active');
  }

  function showBadge() {
    if (!isOpen) {
      badge.style.display = 'flex';
      badge.textContent = '!';
    }
  }

  // ── Add a message row ────────────────────────────────────────────────
  function addBotMessage(text, showChips = false) {
    const row = document.createElement('div');
    row.className = 'vb-row bot';

    row.innerHTML = `
      <div class="vb-msg-avatar"><img src="/static/images/CHATBOT_ICON.png" alt="VerifyBot" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>
      <div class="vb-bubble-wrap">
        <div class="vb-bubble">${formatBotText(text)}</div>
      </div>`;
    messages.appendChild(row);

    if (showChips) {
      addSuggestionChips(messages);
    }

    scrollToBottom();
  }

  function addSuggestionChips(container) {
    const existing = document.getElementById('vb-suggestion-chips');
    if (existing) existing.remove();

    const chips = document.createElement('div');
    chips.id = 'vb-suggestion-chips';
    chips.className = 'vb-chips-row';
    chips.innerHTML = `
      <button class="vb-chip" onclick="window.vbSendQuick('How to check a news source?')">🔍 Check a source</button>
      <button class="vb-chip" onclick="window.vbSendQuick('How to verify an article?')">📰 Verify article</button>
      <button class="vb-chip" onclick="window.vbSendQuick('Show me what I can do here')">🗺️ What can I do here?</button>
      <button class="vb-chip" onclick="window.vbSendQuick('How to report fake news?')">📝 Report news</button>
    `;
    container.appendChild(chips);
    scrollToBottom();
  }

  function addUserMessage(text) {
    const row = document.createElement('div');
    row.className = 'vb-row user';
    row.innerHTML = `
      <div class="vb-msg-avatar">👤</div>
      <div class="vb-bubble-wrap">
        <div class="vb-bubble">${escapeHtml(text)}</div>
      </div>`;
    messages.appendChild(row);
    scrollToBottom();
  }

  // ── API Calls ────────────────────────────────────────────────────────
  async function checkServerOnline() {
    try {
      const r = await fetch(CHATBOT_API + '/', { signal: AbortSignal.timeout(2500) });
      offlineBanner.classList.toggle('show', !r.ok);
      return r.ok;
    } catch {
      offlineBanner.classList.add('show');
      return false;
    }
  }

  async function sendToBot(userText) {
    if (isTyping) return;
    showTyping();
    sendBtn.disabled = true;

    try {
      const reqBody = { 
        session_id: sessionId, 
        message: userText,
        page: getCurrentPage(),
        response_mode: RESPONSE_MODE,
        mode_instruction: getModeInstruction(userText)
      };

      const res = await fetch(CHATBOT_API + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });

      hideTyping();

      if (!res.ok) {
        addBotMessage('⚠️ Sorry, something went wrong on the server. Please try again.');
        return;
      }

      const data = await res.json();
      
      const t = userText.toLowerCase().trim();
      const isHelpMenuRequested = ['help', 'menu', 'options', 'what can i do here', 'show menu'].some(w => t.includes(w));
      addBotMessage(data.message, isHelpMenuRequested);
      
      offlineBanner.classList.remove('show');

    } catch (err) {
      hideTyping();
      offlineBanner.classList.add('show');
      addBotMessage('⚠️ Cannot reach VerifyBot server. Please make sure the chatbot API is running:\n\n`cd fake_news_chatbot && python api.py`');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ── Open / Close ─────────────────────────────────────────────────────
  async function openChat() {
    isOpen = true;
    win.classList.add('open');
    badge.style.display = 'none';
    input.focus();

    // First open: check server & load welcome from API
    if (messageCount === 0) {
      checkServerOnline();
      showTyping();
      try {
        const res = await fetch(CHATBOT_API + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, message: 'Hello' })
        });
        hideTyping();
        if (res.ok) {
          addBotMessage(
            "Hi! I'm VerifyBot 👋\\n\\n" +
            "I can help you:\\n" +
            "🔍 Check if news is fake — paste it here!\\n" +
            "📊 Understand the dashboard & charts\\n" +
            "📝 Report suspicious news\\n" +
            "📚 Learn how to spot misinformation\\n\\n" +
            "What would you like to do? 😊", 
            true
          );
          offlineBanner.classList.remove('show');
        } else {
          loadOfflineWelcome();
        }
      } catch {
        hideTyping();
        loadOfflineWelcome();
        offlineBanner.classList.add('show');
      }
    }
  }

  function loadOfflineWelcome() {
    addBotMessage(
      "Hi! I'm VerifyBot 👋 — your AI guide and mini fact-checker!\n\n" +
      "⚠️ I'm currently unable to connect to the API server. Please start it:\n\n" +
      "`python fake_news_chatbot/api.py`\n\n" +
      "Once it's running, refresh the page to chat with me!",
      []
    );
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
  }

  // ── Send message ─────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isTyping) return;

    /* Mode change logic BEFORE API call */
    const newMode = detectModeChange(text);
    if (newMode && newMode !== RESPONSE_MODE) {
      RESPONSE_MODE = newMode;
      updateModeIndicator();
      
      const wordCount = text.split(/\\s+/).length;
      if (wordCount <= 5) {
        input.value = ''; input.style.height = 'auto';
        addUserMessage(text);
        const confirmMsg = {
          'brief': '⚡ Brief mode on! Short answers from now on.',
          'detailed': '📖 Detailed mode on! Full answers now.',
          'auto': '🤖 Back to auto mode!'
        }[newMode];
        addBotMessage(confirmMsg);
        return; // Stop here, pure mode switch
      }
    }

    input.value = '';
    input.style.height = 'auto';
    addUserMessage(text);
    await sendToBot(text);
  }

  // Global function for quick reply buttons (they use onclick in HTML)
  window.vbSendQuick = async function(text) {
    if (isTyping) return;
    const chips = document.getElementById('vb-suggestion-chips');
    if (chips) chips.remove();
    input.value = text;
    sendMessage();
  };
  
  window.vbSetModeQuick = function(mode) {
    RESPONSE_MODE = mode;
    updateModeIndicator();
    const msgs = {
      'brief':   '⚡ Brief mode on! Short answers from now.',
      'detailed':'📖 Detailed mode on! Full answers from now.',
      'auto':    '🤖 Auto mode enabled!' // Note: We keep this one as emoji because it is raw text inserted into a message bubble that already has its own avatar
    };
    addBotMessage(msgs[mode]);
  };

  // ── Events ───────────────────────────────────────────────────────────
  trigger.addEventListener('click', () => { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  sendBtn.addEventListener('click', sendMessage);
  
  // Optional: Close position panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('vb-position-panel');
    const moveBtn = document.getElementById('vb-move-btn');
    if (panel && !panel.contains(e.target) && e.target !== moveBtn) {
      panel.classList.remove('open');
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !win.contains(e.target) && e.target !== trigger) {
      closeChat();
    }
  });

  /* ── Drag and window logic ── */
  const DEFAULT_POS = { bottom: 90, right: 28, width: 380, height: 560 };
  const SIZE_PRESETS = {
    small:  { width: 320, height: 460 },
    medium: { width: 380, height: 560 },
    large:  { width: 440, height: 680 },
  };
  const dragState = { dragging: false, resizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, startW: 0, startH: 0 };

  function applyWindowPosition() {
    if (!win) return;
    try {
      const s = localStorage.getItem('vb_position');
      const saved = s ? JSON.parse(s) : null;
      if (saved) {
        win.style.position = 'fixed';
        win.style.left = saved.left + 'px';
        win.style.top = saved.top + 'px';
        win.style.width = saved.width + 'px';
        win.style.height = saved.height + 'px';
        win.style.right = 'auto'; win.style.bottom = 'auto';
      } else { applyDefaultPosition(); }
    } catch(e) { applyDefaultPosition(); }
  }

  function applyDefaultPosition() {
    if (!win) return;
    const vw = window.innerWidth; const vh = window.innerHeight;
    win.style.position = 'fixed';
    win.style.right = DEFAULT_POS.right + 'px';
    win.style.bottom = DEFAULT_POS.bottom + 'px';
    win.style.left = 'auto'; win.style.top = 'auto';
    win.style.width = DEFAULT_POS.width + 'px';
    win.style.height = DEFAULT_POS.height + 'px';
  }

  function savePosition(left, top, width, height) {
    try { localStorage.setItem('vb_position', JSON.stringify({ left, top, width, height })); } catch(e) {}
  }

  window.vbSnapToCorner = function(corner) {
    if (!win) return;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const w = parseInt(win.style.width) || DEFAULT_POS.width;
    const h = parseInt(win.style.height) || DEFAULT_POS.height;
    const pad = 16;
    const pos = {
      'top-left': { left: pad, top: pad },
      'top-right': { left: vw - w - pad, top: pad },
      'bottom-left': { left: pad, top: vh - h - pad },
      'bottom-right': { left: vw - w - pad, top: vh - h - 100 }
    }[corner];
    if (!pos) return;
    win.style.transition = 'left 0.3s ease, top 0.3s ease';
    win.style.left = pos.left + 'px'; win.style.top = pos.top + 'px';
    win.style.right = 'auto'; win.style.bottom = 'auto';
    savePosition(pos.left, pos.top, w, h);
    document.getElementById('vb-position-panel').classList.remove('open');
    setTimeout(() => win.style.transition = '', 350);
  };

  window.vbSetWindowSize = function(size) {
    if (!win) return;
    const p = SIZE_PRESETS[size]; if (!p) return;
    win.style.width = p.width + 'px'; win.style.height = p.height + 'px';
    savePosition(parseInt(win.style.left)||0, parseInt(win.style.top)||0, p.width, p.height);
    document.getElementById('vb-position-panel').classList.remove('open');
  };

  window.vbResetPosition = function() {
    try { localStorage.removeItem('vb_position'); } catch(e) {}
    applyDefaultPosition();
    document.getElementById('vb-position-panel').classList.remove('open');
  };

  function initDrag() {
    const handle = document.getElementById('vb-drag-handle');
    const resize = document.getElementById('vb-resize-handle');
    if (!handle || !win) return;
    handle.addEventListener('mousedown', startDrag);
    if (resize) resize.addEventListener('mousedown', startResize);

    function startDrag(e) {
      e.preventDefault();
      const rect = win.getBoundingClientRect();
      dragState.dragging = true; dragState.startX = e.clientX; dragState.startY = e.clientY;
      dragState.startLeft = rect.left; dragState.startTop = rect.top;
      win.classList.add('dragging');
      win.style.right = 'auto'; win.style.bottom = 'auto';
      document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', stopDrag);
    }
    function onDrag(e) {
      if (!dragState.dragging) return;
      e.preventDefault();
      const dx = e.clientX - dragState.startX; const dy = e.clientY - dragState.startY;
      const vw = window.innerWidth; const vh = window.innerHeight;
      const w = parseInt(win.style.width)||380; const h = parseInt(win.style.height)||560;
      let left = dragState.startLeft + dx; let top = dragState.startTop + dy;
      left = Math.max(-w+80, Math.min(left, vw-80));
      top = Math.max(0, Math.min(top, vh-80));
      win.style.left = left + 'px'; win.style.top = top + 'px';
    }
    function stopDrag() {
      if (!dragState.dragging) return;
      dragState.dragging = false; win.classList.remove('dragging');
      document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag);
      savePosition(parseInt(win.style.left)||0, parseInt(win.style.top)||0, parseInt(win.style.width)||380, parseInt(win.style.height)||560);
    }
    function startResize(e) {
      e.preventDefault(); const rect = win.getBoundingClientRect();
      dragState.resizing = true; dragState.startX = e.clientX; dragState.startY = e.clientY;
      dragState.startW = rect.width; dragState.startH = rect.height;
      document.addEventListener('mousemove', onResize); document.addEventListener('mouseup', stopResize);
    }
    function onResize(e) {
      if (!dragState.resizing) return;
      e.preventDefault();
      const newW = Math.max(280, Math.min(dragState.startW + (e.clientX - dragState.startX), 600));
      const newH = Math.max(360, Math.min(dragState.startH + (e.clientY - dragState.startY), 800));
      win.style.width = newW + 'px'; win.style.height = newH + 'px';
    }
    function stopResize() {
      dragState.resizing = false;
      document.removeEventListener('mousemove', onResize); document.removeEventListener('mouseup', stopResize);
      savePosition(parseInt(win.style.left)||0, parseInt(win.style.top)||0, parseInt(win.style.width)||380, parseInt(win.style.height)||560);
    }
  }

  updateModeIndicator();
  applyWindowPosition();
  initDrag();

  // Show badge after 3s to draw attention
  setTimeout(() => {
    if (!isOpen) showBadge();
  }, 3000);

})();
