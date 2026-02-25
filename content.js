/**
 * Quick Translator – Content Script
 * Google Translate free API · TTS · floating translate icon + tooltip
 */

(() => {
    "use strict";

    // ── Constants ──────────────────────────────────────────────────
    const PREFIX = "__qt_";
    const ICON_ID = PREFIX + "icon";
    const TOOLTIP_ID = PREFIX + "tooltip";

    // Pre-load voices so they're available when TTS is first used
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            const v = window.speechSynthesis.getVoices();
            console.log(
                "[QuickTranslator] Available voices:",
                v.map((x) => `${x.name} (${x.lang})`),
            );
        };
    }

    // ── SVG icons (inline) ─────────────────────────────────────────
    const SVG_TRANSLATE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`;

    const SVG_SPEAKER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

    const SVG_SAVE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
    const SVG_SAVE_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#4ecdc4" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

    const SVG_SAVE_SENTENCE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const SVG_SAVE_SENTENCE_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#4ecdc4" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

    const SVG_READ = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

    // ── CSS injection ──────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
    /* ── Icon toolbar (2 buttons) ── */
    #${ICON_ID} {
      position: absolute;
      z-index: 2147483647;
      display: flex; align-items: center; gap: 3px;
      padding: 3px;
      border-radius: 14px;
      background: rgba(15, 15, 35, 0.8);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset;
      border: 1px solid rgba(255,255,255,0.1);
      opacity: 0; transform: scale(0.6);
      transition: opacity .18s ease, transform .18s cubic-bezier(.34,1.56,.64,1);
      pointer-events: auto;
    }
    #${ICON_ID}.visible {
      opacity: 1; transform: scale(1);
    }
    .${PREFIX}tb-btn {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 10px;
      color: #fff;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.1);
      padding: 0;
      transition: all .2s ease;
    }
    .${PREFIX}tb-translate {
      background: rgba(74, 108, 247, 0.55);
    }
    .${PREFIX}tb-translate:hover {
      background: rgba(74, 108, 247, 0.85);
      transform: scale(1.08);
      box-shadow: 0 4px 12px rgba(74,108,247,0.35);
    }
    .${PREFIX}tb-read {
      background: rgba(78, 205, 196, 0.4);
    }
    .${PREFIX}tb-read:hover {
      background: rgba(78, 205, 196, 0.7);
      transform: scale(1.08);
      box-shadow: 0 4px 12px rgba(78,205,196,0.3);
    }
    .${PREFIX}tb-read.reading {
      background: rgba(78, 205, 196, 0.8);
      animation: ${PREFIX}pulse 1.5s ease-in-out infinite;
    }
    @keyframes ${PREFIX}pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(78,205,196,0.4); }
      50% { box-shadow: 0 0 0 6px rgba(78,205,196,0); }
    }

    /* ── Reading highlight (entire selection) ── */
    .${PREFIX}reading-hl {
      background: rgba(78, 205, 196, 0.2) !important;
      border-radius: 4px;
      box-shadow: 0 0 12px rgba(78, 205, 196, 0.15);
      outline: 1px solid rgba(78, 205, 196, 0.25);
      outline-offset: 2px;
      transition: background .3s ease, box-shadow .3s ease;
    }

    /* ── Tooltip panel ── */
    #${TOOLTIP_ID} {
      position: absolute;
      z-index: 2147483647;
      max-width: 420px; min-width: 220px;
      border-radius: 16px;
      background: rgba(15, 15, 35, 0.75);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      color: #fff;
      font: 14px/1.5 'Inter', -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      pointer-events: auto;
      user-select: text;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset;
      border: 1px solid rgba(255,255,255,0.08);
      opacity: 0; transform: translateY(8px) scale(0.96);
      transition: opacity .2s ease, transform .2s cubic-bezier(.34,1.3,.64,1);
      overflow: hidden;
    }
    #${TOOLTIP_ID}.visible {
      opacity: 1; transform: translateY(0) scale(1);
    }

    /* Tooltip inner layout */
    .${PREFIX}header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
      font-size: 11px; text-transform: uppercase; letter-spacing: .8px;
      font-weight: 600;
      color: rgba(255,255,255,0.35);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.02);
    }
    .${PREFIX}body { padding: 12px 14px 14px; }
    .${PREFIX}row {
      display: flex; align-items: flex-start; gap: 8px;
      margin-bottom: 8px;
    }
    .${PREFIX}row:last-child { margin-bottom: 0; }
    .${PREFIX}label {
      flex-shrink: 0;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .4px;
      color: rgba(255,255,255,0.3);
      padding-top: 3px; min-width: 30px;
    }
    .${PREFIX}text {
      font-size: 14px; line-height: 1.5;
      word-break: break-word;
    }
    .${PREFIX}translated {
      color: rgba(255,255,255,0.65);
    }
    .${PREFIX}original {
      color: #4ecdc4; font-weight: 600;
    }
    .${PREFIX}speak {
      flex-shrink: 0;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.4);
      cursor: pointer; padding: 4px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: all .2s ease;
    }
    .${PREFIX}speak:hover {
      color: #fff; background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.15);
    }
    .${PREFIX}speak.speaking {
      color: #4ecdc4;
      border-color: rgba(78,205,196,0.3);
      background: rgba(78,205,196,0.1);
    }
    .${PREFIX}error {
      color: #ff6b6b; font-size: 13px; padding: 12px 14px;
    }
    .${PREFIX}loading {
      display: flex; align-items: center; gap: 10px;
      padding: 14px;
      color: rgba(255,255,255,0.5);
      font-size: 13px;
    }
    .${PREFIX}spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #4a6cf7;
      border-radius: 50%;
      animation: ${PREFIX}spin .6s linear infinite;
    }
    @keyframes ${PREFIX}spin {
      to { transform: rotate(360deg); }
    }

    /* ── Save button (icon-only in header) ── */
    .${PREFIX}save-btn {
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.35);
      cursor: pointer; padding: 4px; border-radius: 8px;
      transition: all .2s ease;
      flex-shrink: 0;
    }
    .${PREFIX}save-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.15);
      transform: scale(1.1);
    }
    .${PREFIX}save-btn.saved {
      color: #4ecdc4;
      border-color: rgba(78,205,196,0.3);
      background: rgba(78,205,196,0.1);
    }
    .${PREFIX}save-sentence-btn {
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.35);
      cursor: pointer; padding: 4px; border-radius: 8px;
      transition: all .2s ease;
      flex-shrink: 0;
      margin-left: 4px;
    }
    .${PREFIX}save-sentence-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.15);
      transform: scale(1.1);
    }
    .${PREFIX}save-sentence-btn.saved {
      color: #4ecdc4;
      border-color: rgba(78,205,196,0.3);
      background: rgba(78,205,196,0.1);
    }

    /* ── YouTube CC subtitle click-to-translate ── */
    .ytp-caption-segment.${PREFIX}clickable {
      position: relative;
    }
    .${PREFIX}yt-word {
      cursor: pointer !important;
      border-radius: 3px;
      transition: background .15s ease, box-shadow .15s ease;
      display: inline;
      padding: 1px 2px;
    }
    .${PREFIX}yt-word:hover {
      background: rgba(74, 108, 247, 0.45) !important;
      box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.3);
    }

    /* YouTube subtitle tooltip adjustments */
    .${PREFIX}yt-sub-hint {
      position: fixed;
      z-index: 2147483647;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(74, 108, 247, 0.9);
      color: #fff;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .4s ease;
      white-space: nowrap;
    }
    .${PREFIX}yt-sub-hint.visible {
      opacity: 1;
    }

    /* ── Netflix CC subtitle click-to-translate ── */
    /* Fix subtitle text wrapping — Netflix uses flex which prevents wrapping */
    .player-timedtext-text-container {
      text-align: center !important;
    }
    .player-timedtext-text-container > div {
      display: block !important;
      text-align: center !important;
    }
    .player-timedtext-text-container span {
      display: inline !important;
      white-space: normal !important;
    }
    .player-timedtext-text-container span.${PREFIX}clickable {
      position: relative;
      display: inline !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }
    .${PREFIX}nf-word {
      cursor: pointer !important;
      border-radius: 3px;
      transition: background .15s ease, box-shadow .15s ease;
      display: inline !important;
      padding: 1px 2px;
      white-space: normal !important;
    }
    .${PREFIX}nf-word.${PREFIX}nf-word-hover {
      background: rgba(74, 108, 247, 0.45) !important;
      box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.3);
    }

    /* Netflix subtitle hint */
    .${PREFIX}nf-sub-hint {
      position: fixed;
      z-index: 2147483647;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(74, 108, 247, 0.9);
      color: #fff;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .4s ease;
      white-space: nowrap;
    }
    .${PREFIX}nf-sub-hint.visible {
      opacity: 1;
    }

    /* ── X.com (Twitter) TTS button ── */
    .${PREFIX}x-speak-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      background: transparent;
      color: #4ecdc4;
      border-radius: 50%;
      cursor: pointer;
      transition: background .2s, color .2s;
      padding: 0;
      margin: 0;
      vertical-align: middle;
    }
    .${PREFIX}x-speak-btn:hover {
      background: rgba(78, 205, 196, 0.1);
      color: #4ecdc4;
    }
    .${PREFIX}x-speak-btn.${PREFIX}x-speaking {
      color: #4ecdc4;
      animation: ${PREFIX}x-pulse 1s ease-in-out infinite;
    }
    @keyframes ${PREFIX}x-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }

    /* ── X.com (Twitter) word-level translate ── */
    .${PREFIX}x-word {
      cursor: pointer !important;
      border-radius: 3px;
      transition: background .15s ease, box-shadow .15s ease;
      display: inline;
      padding: 1px 1px;
    }
    .${PREFIX}x-word:hover,
    .${PREFIX}x-word.${PREFIX}x-word-hover {
      background: rgba(74, 108, 247, 0.35) !important;
      box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.2);
    }
    .${PREFIX}x-sub-hint {
      position: fixed;
      z-index: 2147483647;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(74, 108, 247, 0.9);
      color: #fff;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .4s ease;
      white-space: nowrap;
    }
    .${PREFIX}x-sub-hint.visible {
      opacity: 1;
    }

    /* ── X.com (Twitter) translate-post button ── */
    .${PREFIX}x-translate-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      background: transparent;
      color: #4a6cf7;
      border-radius: 50%;
      cursor: pointer;
      transition: background .2s, color .2s;
      padding: 0;
      margin: 0;
      vertical-align: middle;
    }
    .${PREFIX}x-translate-btn:hover {
      background: rgba(74, 108, 247, 0.1);
      color: #4a6cf7;
    }
    .${PREFIX}x-translate-btn.${PREFIX}x-translating {
      color: #4a6cf7;
      animation: ${PREFIX}x-pulse 1s ease-in-out infinite;
    }
    .${PREFIX}x-translate-btn.${PREFIX}x-translated-active {
      color: #4ecdc4;
    }

    /* ── X.com inline translation block below tweet ── */
    .${PREFIX}x-post-translation {
      margin-top: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(74, 108, 247, 0.08);
      border: 1px solid rgba(74, 108, 247, 0.15);
      font-size: 14px;
      line-height: 1.5;
      color: rgb(113, 118, 123);
      word-break: break-word;
      animation: ${PREFIX}x-fade-in .25s ease;
    }
    .${PREFIX}x-post-translation .${PREFIX}x-trans-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #4a6cf7;
      margin-bottom: 4px;
    }
    @keyframes ${PREFIX}x-fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Netflix-style subtitles for lookmovie2 ── */
    .vjs-text-track-display {
      pointer-events: none !important;
    }
    .vjs-text-track-display > div {
      margin: 0 !important;
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-end !important;
      align-items: center !important;
      padding-bottom: 4% !important;
      pointer-events: none !important;
    }
    .vjs-text-track-cue {
      position: relative !important;
      inset: auto !important;
      width: auto !important;
      max-width: 80% !important;
      height: auto !important;
      background-color: transparent !important;
      text-align: center !important;
      font: 700 2.2vw "Netflix Sans", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      line-height: 1.3 !important;
      white-space: pre-line !important;
      padding: 0 !important;
      margin: 0 !important;
      pointer-events: auto !important;
      cursor: text !important;
      -webkit-user-select: text !important;
      user-select: text !important;
    }
    .vjs-text-track-cue > div,
    .vjs-text-track-cue div {
      background-color: transparent !important;
      color: #ffffff !important;
      font-family: "Netflix Sans", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      font-weight: 700 !important;
      font-size: 2.2vw !important;
      line-height: 1.3 !important;
      text-shadow:
        0 0 5px rgba(0,0,0,0.9),
        0 0 10px rgba(0,0,0,0.7),
        2px 2px 4px rgba(0,0,0,0.9),
        -2px -2px 4px rgba(0,0,0,0.9),
        2px -2px 4px rgba(0,0,0,0.9),
        -2px 2px 4px rgba(0,0,0,0.9),
        0 2px 4px rgba(0,0,0,0.9) !important;
      display: inline !important;
      position: relative !important;
      inset: auto !important;
      padding: 2px 8px !important;
      pointer-events: auto !important;
      cursor: text !important;
      -webkit-user-select: text !important;
      user-select: text !important;
    }

    /* ── LookMovie2 word-level click-to-translate ── */
    .${PREFIX}lm-word {
      cursor: pointer !important;
      border-radius: 3px;
      transition: background .15s ease, box-shadow .15s ease;
      display: inline !important;
      padding: 1px 2px;
      white-space: normal !important;
    }
    .${PREFIX}lm-word:hover,
    .${PREFIX}lm-word.${PREFIX}lm-word-hover {
      background: rgba(74, 108, 247, 0.45) !important;
      box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.3);
    }
    .${PREFIX}lm-sub-hint {
      position: fixed;
      z-index: 2147483647;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(74, 108, 247, 0.9);
      color: #fff;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .4s ease;
      white-space: nowrap;
    }
    .${PREFIX}lm-sub-hint.visible {
      opacity: 1;
    }

    /* ── Subtitle in-place translation (E key) ── */
    .${PREFIX}sub-translated {
      color: #ffffff !important;
      text-shadow: 0 0 8px rgba(78, 205, 196, 0.4) !important;
    }
    .${PREFIX}sub-word {
      display: inline;
      opacity: 0;
      animation: ${PREFIX}wordIn .25s ease forwards;
    }
    @keyframes ${PREFIX}wordIn {
      from { opacity: 0; transform: translateY(4px); filter: blur(2px); }
      to   { opacity: 1; transform: translateY(0);  filter: blur(0); }
    }

  `;
    document.head.appendChild(style);

    // ── State ──────────────────────────────────────────────────────
    let iconEl = null;
    let tooltipEl = null;
    let currentText = "";
    let currentRect = null;
    let currentRange = null;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isReading = false;
    let ytDismissClickFn = null; // assigned by YouTube CC module

    // Track mouse position for smart icon placement
    document.addEventListener("mousemove", (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    // ── Helpers: Icon ──────────────────────────────────────────────
    function getIcon() {
        if (iconEl) return iconEl;
        iconEl = document.createElement("div");
        iconEl.id = ICON_ID;

        const translateBtn = document.createElement("button");
        translateBtn.className = `${PREFIX}tb-btn ${PREFIX}tb-translate`;
        translateBtn.innerHTML = SVG_TRANSLATE;
        translateBtn.title = "Przetłumacz";
        translateBtn.addEventListener("click", onIconClick);

        const readBtn = document.createElement("button");
        readBtn.className = `${PREFIX}tb-btn ${PREFIX}tb-read`;
        readBtn.innerHTML = SVG_READ;
        readBtn.title = "Czytaj na głos";
        readBtn.addEventListener("click", onReadClick);

        iconEl.appendChild(translateBtn);
        iconEl.appendChild(readBtn);
        document.body.appendChild(iconEl);
        return iconEl;
    }

    function showIcon(rect) {
        const icon = getIcon();
        icon.classList.remove("visible");

        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const ICON_W = 79;
        const ICON_H = 42;
        const GAP = 8;
        const vpW = document.documentElement.clientWidth;
        const vpH = document.documentElement.clientHeight;

        // Mouse position in viewport coords
        const mx = lastMouseX;
        const my = lastMouseY;

        // Selection rect in viewport coords
        const selTop = rect.top;
        const selBottom = rect.bottom;
        const selLeft = rect.left;
        const selRight = rect.right;

        // Try positions in order: right of mouse, left of mouse, below, above
        // Always avoid overlapping the selected text rect
        let bestX = mx + GAP;
        let bestY = my - ICON_H / 2;

        // Check if toolbar at (ix, iy) overlaps selection
        function overlapsSelection(ix, iy) {
            const iconRight = ix + ICON_W;
            const iconBottom = iy + ICON_H;
            return !(
                ix > selRight ||
                iconRight < selLeft ||
                iy > selBottom ||
                iconBottom < selTop
            );
        }

        // Strategy 1: Right of mouse, vertically centered on mouse
        if (bestX + ICON_W <= vpW && !overlapsSelection(bestX, bestY)) {
            // good
        }
        // Strategy 2: Left of mouse
        else if (
            mx - GAP - ICON_W >= 0 &&
            !overlapsSelection(mx - GAP - ICON_W, bestY)
        ) {
            bestX = mx - GAP - ICON_W;
        }
        // Strategy 3: Below selection, horizontally near mouse
        else if (selBottom + GAP + ICON_H <= vpH) {
            bestX = Math.max(4, Math.min(mx - ICON_W / 2, vpW - ICON_W - 4));
            bestY = selBottom + GAP;
        }
        // Strategy 4: Above selection
        else if (selTop - GAP - ICON_H >= 0) {
            bestX = Math.max(4, Math.min(mx - ICON_W / 2, vpW - ICON_W - 4));
            bestY = selTop - GAP - ICON_H;
        }
        // Fallback: right of selection
        else {
            bestX = selRight + GAP;
            bestY = selTop + (rect.height - ICON_H) / 2;
        }

        // Clamp to viewport
        bestX = Math.max(4, Math.min(bestX, vpW - ICON_W - 4));
        bestY = Math.max(4, Math.min(bestY, vpH - ICON_H - 4));

        icon.style.left = `${bestX + scrollX}px`;
        icon.style.top = `${bestY + scrollY}px`;

        requestAnimationFrame(() => icon.classList.add("visible"));
    }

    function hideIcon() {
        if (iconEl) iconEl.classList.remove("visible");
    }

    // ── Helpers: Tooltip ───────────────────────────────────────────
    // Returns the best parent for overlay UI (tooltip, hint).
    // In fullscreen the browser only renders children of the fullscreen element,
    // so we must attach there; otherwise use document.body.
    function getOverlayParent() {
        const fs =
            document.fullscreenElement || document.webkitFullscreenElement;
        return fs || document.body;
    }

    function getTooltip() {
        if (tooltipEl) {
            // Re-parent into fullscreen element if needed
            const parent = getOverlayParent();
            if (tooltipEl.parentElement !== parent) {
                parent.appendChild(tooltipEl);
            }
            return tooltipEl;
        }
        tooltipEl = document.createElement("div");
        tooltipEl.id = TOOLTIP_ID;
        getOverlayParent().appendChild(tooltipEl);
        return tooltipEl;
    }

    function showTooltip(html, rect) {
        const tip = getTooltip();
        tip.innerHTML = html;
        tip.classList.remove("visible");

        const inFullscreen = !!(
            document.fullscreenElement || document.webkitFullscreenElement
        );
        const gap = 10;

        // In fullscreen use fixed positioning (no scroll offsets)
        if (inFullscreen) {
            tip.style.position = "fixed";
            tip.style.left = "0px";
            tip.style.top = "0px";

            const tipRect = tip.getBoundingClientRect();

            let left = rect.left + (rect.width - tipRect.width) / 2;
            let top = rect.top - tipRect.height - gap;

            left = Math.max(
                4,
                Math.min(left, window.innerWidth - tipRect.width - 4),
            );
            if (top < 4) {
                top = rect.bottom + gap;
            }

            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
        } else {
            tip.style.position = "absolute";
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            tip.style.left = "0px";
            tip.style.top = "0px";

            const tipRect = tip.getBoundingClientRect();

            let left = rect.left + scrollX + (rect.width - tipRect.width) / 2;
            let top = rect.top + scrollY - tipRect.height - gap;

            left = Math.max(
                scrollX + 4,
                Math.min(
                    left,
                    scrollX +
                        document.documentElement.clientWidth -
                        tipRect.width -
                        4,
                ),
            );

            if (top < scrollY + 4) {
                top = rect.bottom + scrollY + gap;
            }

            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
        }

        requestAnimationFrame(() => tip.classList.add("visible"));
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.classList.remove("visible");
            setTimeout(() => {
                if (tooltipEl) tooltipEl.innerHTML = "";
            }, 180);
        }
    }

    function hideAll() {
        hideIcon();
        hideTooltip();
        if (isReading) cleanupReading();
    }

    // ── Read-aloud with selection highlight ───────────────────────
    let readingHighlightEl = null;

    function cleanupReading() {
        window.speechSynthesis.cancel();
        if (elAudioEl) {
            elAudioEl.pause();
            elAudioEl = null;
        }
        isReading = false;
        // Remove highlight wrapper
        if (readingHighlightEl) {
            const parent = readingHighlightEl.parentNode;
            if (parent) {
                while (readingHighlightEl.firstChild) {
                    parent.insertBefore(
                        readingHighlightEl.firstChild,
                        readingHighlightEl,
                    );
                }
                parent.removeChild(readingHighlightEl);
                parent.normalize();
            }
            readingHighlightEl = null;
        }
        // Remove reading state from read button
        if (iconEl) {
            const rb = iconEl.querySelector(`.${PREFIX}tb-read`);
            if (rb) rb.classList.remove("reading");
        }
    }

    function onReadClick(e) {
        e.stopPropagation();
        e.preventDefault();

        // Toggle off if already reading
        if (isReading) {
            cleanupReading();
            return;
        }

        if (!currentText) return;

        isReading = true;
        hideIcon();

        // Mark read button as active
        if (iconEl) {
            const rb = iconEl.querySelector(`.${PREFIX}tb-read`);
            if (rb) rb.classList.add("reading");
        }

        const utterText = cleanTextForTTS(currentText);
        if (!utterText) {
            cleanupReading();
            return;
        }

        // Wrap selection in a highlight element
        try {
            if (currentRange) {
                const hlSpan = document.createElement("span");
                hlSpan.className = `${PREFIX}reading-hl`;
                currentRange.surroundContents(hlSpan);
                readingHighlightEl = hlSpan;
            }
        } catch (_) {
            // surroundContents can fail on partial selections spanning elements
            readingHighlightEl = null;
        }

        // Detect language from page
        const pageLang =
            document.documentElement.lang || navigator.language || "en";

        speak(utterText, pageLang).then((result) => {
            // If browser TTS (SpeechSynthesisUtterance), attach cleanup handlers
            if (result && typeof result.onend !== "undefined") {
                result.onend = () => cleanupReading();
                result.onerror = () => cleanupReading();
            } else if (result instanceof HTMLAudioElement) {
                result.onended = () => cleanupReading();
                result.onerror = () => cleanupReading();
            }
        });
    }

    // ── Google Translate (free, no key) ────────────────────────────
    async function googleTranslate(text, targetLang) {
        const url =
            "https://translate.googleapis.com/translate_a/single" +
            "?client=gtx&sl=auto&tl=" +
            encodeURIComponent(targetLang) +
            "&dt=t&q=" +
            encodeURIComponent(text);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // data[0] is array of [translatedChunk, originalChunk, …]
        const translated = data[0].map((s) => s[0]).join("");
        const detectedLang = data[2] || "auto";
        return { translated, detectedLang };
    }

    // ── Clean text for TTS (remove symbols read aloud) ─────────────
    function cleanTextForTTS(text) {
        return text
            .replace(/#/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    // ── Pick best available voice ──────────────────────────────────
    // Prefers: user-saved voice > natural/neural voices > Google voices
    function pickBestVoice(savedVoiceName, lang) {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;

        // If user explicitly saved a voice, use it
        if (savedVoiceName) {
            const exact = voices.find((v) => v.name === savedVoiceName);
            if (exact) return exact;
        }

        // Determine base language code (e.g. "en" from "en-US")
        const baseLang = (lang || "en").split("-")[0].toLowerCase();

        // Filter voices matching the language
        const langVoices = voices.filter((v) =>
            v.lang.toLowerCase().startsWith(baseLang),
        );
        if (!langVoices.length) return null;

        // Priority patterns for natural/realistic voices (ordered best→worst)
        const naturalPatterns = [
            /microsoft\s+(aria|jenny).*natural/i,
            /microsoft\s+(aria|jenny)/i,
            /natural/i,
            /neural/i,
            /online/i,
            /enhanced/i,
            /premium/i,
            /microsoft.*(guy|ana|christopher|eric|michelle|steffan)/i,
            /google\s+u[sk]/i,
            /google/i,
        ];

        for (const pattern of naturalPatterns) {
            const match = langVoices.find((v) => pattern.test(v.name));
            if (match) return match;
        }

        // Fallback: any non-local (remote) voice, or just the first one
        return langVoices.find((v) => !v.localService) || langVoices[0];
    }

    // ── ElevenLabs TTS ─────────────────────────────────────────────
    let elAudioEl = null; // reusable <audio> element
    async function speakElevenLabs(text, apiKey, voiceId) {
        try {
            const res = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    method: "POST",
                    headers: {
                        "xi-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        text: cleanTextForTTS(text),
                        model_id: "eleven_multilingual_v2",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                },
            );
            if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            if (elAudioEl) {
                elAudioEl.pause();
                URL.revokeObjectURL(elAudioEl.src);
            }
            elAudioEl = new Audio(url);
            elAudioEl.play();
            return elAudioEl;
        } catch (err) {
            console.warn("[QuickTranslator] ElevenLabs TTS failed:", err);
            return null;
        }
    }

    // ── TTS (unified – Browser or ElevenLabs) ─────────────────────
    function speak(text, lang) {
        window.speechSynthesis.cancel();
        if (elAudioEl) {
            elAudioEl.pause();
            elAudioEl = null;
        }

        return new Promise((resolve) => {
            if (!chrome?.storage?.sync) {
                // Fallback: browser TTS without settings
                const utter = new SpeechSynthesisUtterance(
                    cleanTextForTTS(text),
                );
                utter.lang = lang;
                const voice = pickBestVoice("", lang);
                if (voice) utter.voice = voice;
                utter.rate = 0.95;
                window.speechSynthesis.speak(utter);
                resolve(utter);
                return;
            }

            chrome.storage.sync.get(
                {
                    ttsMode: "browser",
                    elApiKey: "",
                    elVoiceId: "",
                    speechVoice: "",
                    speechRate: 0.95,
                },
                async (data) => {
                    if (
                        data.ttsMode === "elevenlabs" &&
                        data.elApiKey &&
                        data.elVoiceId
                    ) {
                        const audio = await speakElevenLabs(
                            text,
                            data.elApiKey,
                            data.elVoiceId,
                        );
                        resolve(audio);
                    } else {
                        const utter = new SpeechSynthesisUtterance(
                            cleanTextForTTS(text),
                        );
                        utter.lang = lang;
                        utter.rate = data.speechRate;
                        const voice = pickBestVoice(data.speechVoice, lang);
                        if (voice) utter.voice = voice;
                        window.speechSynthesis.speak(utter);
                        resolve(utter);
                    }
                },
            );
        });
    }

    // ── Target language from settings ──────────────────────────────
    function getTargetLang() {
        return new Promise((resolve) => {
            if (chrome?.storage?.sync) {
                chrome.storage.sync.get({ targetLang: "pl" }, (d) =>
                    resolve(d.targetLang),
                );
            } else {
                resolve("pl");
            }
        });
    }

    // ── Language code → display name ───────────────────────────────
    const LANG_NAMES = {
        pl: "PL",
        en: "EN",
        de: "DE",
        fr: "FR",
        es: "ES",
        it: "IT",
        pt: "PT",
        uk: "UK",
        ru: "RU",
        cs: "CZ",
        nl: "NL",
        sv: "SV",
        ja: "JA",
        ko: "KO",
        zh: "ZH",
        ar: "AR",
        hi: "HI",
        tr: "TR",
    };

    function langTag(code) {
        return LANG_NAMES[code] || code?.toUpperCase() || "?";
    }

    // ── Icon click → translate ─────────────────────────────────────
    async function onIconClick(e) {
        e.stopPropagation();
        e.preventDefault();

        if (!currentText || !currentRect) return;

        const text = currentText;
        const rect = currentRect;

        hideIcon();

        // Show loading
        showTooltip(
            `<div class="${PREFIX}loading"><div class="${PREFIX}spinner">`,
            rect,
        );

        try {
            const targetLang = await getTargetLang();
            const { translated, detectedLang } = await googleTranslate(
                text,
                targetLang,
            );

            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            const html = `
                <div class="${PREFIX}header">
                    <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                    <button class="${PREFIX}save-btn" data-src="${escapeAttr(text)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" data-sentence="" data-sentence-translated="" title="Zapisz do kolekcji">${SVG_SAVE}</button>
                </div>
                <div class="${PREFIX}body">
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(srcLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}original">${escapeHtml(text)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(text)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(targetLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}translated">${escapeHtml(translated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG_SPEAKER}</button>
                    </div>
                </div>`;

            showTooltip(html, rect);

            // Attach TTS handlers
            tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const t = btn.getAttribute("data-text");
                    const l = btn.getAttribute("data-lang");
                    btn.classList.add("speaking");
                    speak(t, l).then((utter) => {
                        utter.onend = () => btn.classList.remove("speaking");
                        utter.onerror = () => btn.classList.remove("speaking");
                    });
                });
            });

            // Attach save handler
            const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
            if (saveBtn) {
                saveBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveBtn.getAttribute("data-src"),
                        translated: saveBtn.getAttribute("data-translated"),
                        srcLang: saveBtn.getAttribute("data-src-lang"),
                        tgtLang: saveBtn.getAttribute("data-tgt-lang"),
                        sentence: "",
                        sentenceTranslated: "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveBtn.innerHTML = SVG_SAVE_CHECK;
                    saveBtn.classList.add("saved");
                });
            }
        } catch (err) {
            console.error("[Quick Translator]", err);
            showTooltip(
                `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                rect,
            );
        }
    }

    // ── Selection listener (mouseup covers both dblclick & drag) ──
    document.addEventListener("mouseup", (e) => {
        // Ignore clicks inside our own UI
        if (iconEl?.contains(e.target) || tooltipEl?.contains(e.target)) return;

        // Small delay to let selection finalize
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();

            if (!text || text.length === 0 || text.length > 5000) {
                hideAll();
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            currentText = text;
            currentRect = rect;
            currentRange = range.cloneRange();

            hideTooltip();
            showIcon(rect);
        }, 10);
    });

    // ── Click-away to dismiss ──────────────────────────────────────
    document.addEventListener("mousedown", (e) => {
        if (iconEl?.contains(e.target) || tooltipEl?.contains(e.target)) return;
        // If YouTube click-locked, dismiss it and resume video
        if (ytDismissClickFn) ytDismissClickFn();
        hideAll();
    });

    // ── Escape to dismiss ──────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (ytDismissClickFn) ytDismissClickFn();
            hideAll();
        }
    });

    // ── Save word to storage ───────────────────────────────────────
    function saveWord(entry) {
        if (!chrome?.storage?.local) return;
        chrome.storage.local.get({ savedWords: [] }, (data) => {
            const words = data.savedWords || [];
            // Avoid exact duplicates (same original + translated)
            const exists = words.some(
                (w) =>
                    w.original === entry.original &&
                    w.translated === entry.translated,
            );
            if (!exists) {
                words.push(entry);
                chrome.storage.local.set({ savedWords: words });
            }
        });
    }

    // ── Utils ──────────────────────────────────────────────────────
    function escapeHtml(str) {
        const d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // Strip [bracketed] content (e.g. [Applause], [Music]) from text
    function stripBrackets(text) {
        return text
            .replace(/\[.*?\]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    // ══════════════════════════════════════════════════════════════
    // ── YouTube CC Subtitle Click-to-Translate ────────────────────
    // ══════════════════════════════════════════════════════════════

    const isYouTube = window.location.hostname.includes("youtube.com");

    if (isYouTube) {
        let ytHintEl = null;
        let ytHintTimer = null;

        function showYTHint(msg) {
            if (!ytHintEl) {
                ytHintEl = document.createElement("div");
                ytHintEl.className = `${PREFIX}yt-sub-hint`;
                document.body.appendChild(ytHintEl);
            }
            ytHintEl.textContent = msg;
            ytHintEl.classList.add("visible");
            clearTimeout(ytHintTimer);
            ytHintTimer = setTimeout(() => {
                ytHintEl.classList.remove("visible");
            }, 3000);
        }

        // Translation cache to avoid repeated API calls on hover
        let ytTranslateCache = new Map();
        let ytHoverTimer = null;
        let ytIsHovering = false;
        let ytWasPlayingBeforeHover = false;
        let ytClickLocked = false;
        let ytClickWasPlaying = false;

        // Dismiss a click-locked YT tooltip and resume video
        function dismissYTClick() {
            if (!ytClickLocked) return;
            ytClickLocked = false;
            hideTooltip();
            if (ytClickWasPlaying) {
                ytClickWasPlaying = false;
                const video = document.querySelector("video");
                if (video && video.paused) video.play();
            }
        }
        ytDismissClickFn = dismissYTClick;

        // ── Subtitle history buffer ──
        // Accumulates CC text over time so we can extract full sentences
        let ytSubtitleBuffer = "";
        let ytLastSegmentText = "";

        function appendToSubtitleBuffer(text) {
            const trimmed = text.trim();
            if (!trimmed) return;
            // Skip YouTube UI text that leaks into captions
            if (
                /\(auto-generated\)|Click for settings|\bsubtitles?\/CC\b/i.test(
                    trimmed,
                )
            )
                return;
            // Avoid duplicating the same segment if it re-renders
            if (trimmed === ytLastSegmentText) return;
            // Check if the new text overlaps with the end of buffer
            // (YouTube sometimes re-shows overlapping text)
            if (ytSubtitleBuffer.endsWith(trimmed)) return;
            // If buffer ends with part of the new text, find overlap
            let overlap = 0;
            const maxOverlap = Math.min(
                trimmed.length,
                ytSubtitleBuffer.length,
            );
            for (let i = 1; i <= maxOverlap; i++) {
                if (ytSubtitleBuffer.endsWith(trimmed.substring(0, i))) {
                    overlap = i;
                }
            }
            const newPart = trimmed.substring(overlap);
            if (newPart) {
                ytSubtitleBuffer +=
                    (ytSubtitleBuffer && !ytSubtitleBuffer.endsWith(" ")
                        ? " "
                        : "") + newPart;
            }
            ytLastSegmentText = trimmed;
            // Keep buffer from growing too large (keep last ~2000 chars)
            if (ytSubtitleBuffer.length > 3000) {
                ytSubtitleBuffer = ytSubtitleBuffer.substring(
                    ytSubtitleBuffer.length - 2000,
                );
            }
        }

        function extractSentence(buffer, word) {
            // Find the word in the buffer (search from end for most recent occurrence)
            const idx = buffer.lastIndexOf(word);
            if (idx === -1) return null;

            // Sentence-ending punctuation
            const sentenceEnders = /[.!?…]/;

            // Find start of sentence: search backwards from word position
            let start = 0;
            for (let i = idx - 1; i >= 0; i--) {
                if (sentenceEnders.test(buffer[i])) {
                    start = i + 1;
                    break;
                }
            }

            // Find end of sentence: search forwards from word position
            let end = buffer.length;
            for (let i = idx + word.length; i < buffer.length; i++) {
                if (sentenceEnders.test(buffer[i])) {
                    end = i + 1;
                    break;
                }
            }

            const sentence = buffer.substring(start, end).trim();
            // Only return if it's meaningfully longer than the word itself
            return sentence.length > word.length + 2 ? sentence : null;
        }

        async function cachedTranslate(text, targetLang) {
            const key = `${text}|${targetLang}`;
            if (ytTranslateCache.has(key)) return ytTranslateCache.get(key);
            const result = await googleTranslate(text, targetLang);
            ytTranslateCache.set(key, result);
            if (ytTranslateCache.size > 200) {
                const first = ytTranslateCache.keys().next().value;
                ytTranslateCache.delete(first);
            }
            return result;
        }

        // Build tooltip HTML
        function buildYTTooltipHtml(
            srcLang,
            targetLang,
            original,
            translated,
            fullLine,
            fullTranslated,
        ) {
            let fullLineHtml = "";
            const cleanFullLine = fullLine ? stripBrackets(fullLine) : "";
            const cleanFullTranslated = fullTranslated
                ? stripBrackets(fullTranslated)
                : "";
            if (fullLine && fullTranslated) {
                if (cleanFullLine) {
                    fullLineHtml = `
                    <div class="${PREFIX}row" style="margin-top:6px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                        <span class="${PREFIX}label">ALL</span>
                        <span class="${PREFIX}text ${PREFIX}original" style="font-size:12px;">${escapeHtml(cleanFullLine)}</span>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label"></span>
                        <span class="${PREFIX}text ${PREFIX}translated" style="font-size:12px;">${escapeHtml(cleanFullTranslated)}</span>
                    </div>`;
                }
            }
            // Build save-sentence button (only if we have a sentence)
            const saveSentenceBtn = cleanFullLine
                ? `<button class="${PREFIX}save-sentence-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" data-sentence="${escapeAttr(cleanFullLine)}" data-sentence-translated="${escapeAttr(cleanFullTranslated)}" title="Zapisz zdanie">${SVG_SAVE_SENTENCE}</button>`
                : "";
            return `
                <div class="${PREFIX}header">
                    <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                    <div style="display:flex;align-items:center;">
                        <button class="${PREFIX}save-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" title="Zapisz słowo">${SVG_SAVE}</button>
                        ${saveSentenceBtn}
                    </div>
                </div>
                <div class="${PREFIX}body">
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(srcLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}original">${escapeHtml(original)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(original)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(targetLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}translated">${escapeHtml(translated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG_SPEAKER}</button>
                    </div>
                    ${fullLineHtml}
                </div>`;
        }

        // Attach TTS + save handlers to tooltip buttons
        function attachYTTooltipHandlers() {
            if (!tooltipEl) return;
            tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const t = btn.getAttribute("data-text");
                    const l = btn.getAttribute("data-lang");
                    btn.classList.add("speaking");
                    speak(t, l).then((utter) => {
                        utter.onend = () => btn.classList.remove("speaking");
                        utter.onerror = () => btn.classList.remove("speaking");
                    });
                });
            });
            const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
            if (saveBtn) {
                saveBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveBtn.getAttribute("data-src"),
                        translated: saveBtn.getAttribute("data-translated"),
                        srcLang: saveBtn.getAttribute("data-src-lang"),
                        tgtLang: saveBtn.getAttribute("data-tgt-lang"),
                        sentence: "",
                        sentenceTranslated: "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveBtn.innerHTML = SVG_SAVE_CHECK;
                    saveBtn.classList.add("saved");
                });
            }
            // Save sentence button handler
            const saveSentenceBtn = tooltipEl.querySelector(
                `.${PREFIX}save-sentence-btn`,
            );
            if (saveSentenceBtn) {
                saveSentenceBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveSentenceBtn.getAttribute("data-src"),
                        translated:
                            saveSentenceBtn.getAttribute("data-translated"),
                        srcLang: saveSentenceBtn.getAttribute("data-src-lang"),
                        tgtLang: saveSentenceBtn.getAttribute("data-tgt-lang"),
                        sentence:
                            saveSentenceBtn.getAttribute("data-sentence") || "",
                        sentenceTranslated:
                            saveSentenceBtn.getAttribute(
                                "data-sentence-translated",
                            ) || "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveSentenceBtn.innerHTML = SVG_SAVE_SENTENCE_CHECK;
                    saveSentenceBtn.classList.add("saved");
                });
            }
        }

        // Split subtitle segment text into individual word spans
        function splitSegmentIntoWords(el) {
            const text = el.textContent;
            if (!text.trim()) return;
            el.textContent = "";
            const parts = text.match(/\S+|\s+/g) || [];
            for (const part of parts) {
                if (/\S/.test(part)) {
                    const wordSpan = document.createElement("span");
                    wordSpan.className = `${PREFIX}yt-word`;
                    wordSpan.textContent = part;
                    el.appendChild(wordSpan);
                } else {
                    el.appendChild(document.createTextNode(part));
                }
            }
        }

        // Make subtitle segment interactive: HOVER on word = translate word, CLICK = speak + full sentence
        function makeSubtitleClickable(el) {
            if (el.dataset[PREFIX + "bound"]) return;
            el.dataset[PREFIX + "bound"] = "1";
            el.classList.add(`${PREFIX}clickable`);

            // Split into word spans
            splitSegmentIntoWords(el);

            // ── HOVER on individual word → translate that single word ──
            el.addEventListener(
                "mouseenter",
                (e) => {
                    // Only react if hovering a word span
                    if (!e.target.classList?.contains(`${PREFIX}yt-word`))
                        return;
                },
                true,
            );

            el.addEventListener("mouseover", async (e) => {
                const wordSpan = e.target.closest(`.${PREFIX}yt-word`);
                if (!wordSpan) return;

                // Don't show hover tooltip if click-locked
                if (ytClickLocked) return;

                ytIsHovering = true;
                clearTimeout(ytHoverTimer);

                // Pause video on hover
                const video = document.querySelector("video");
                if (video && !video.paused) {
                    ytWasPlayingBeforeHover = true;
                    video.pause();
                }

                const word = wordSpan.textContent.trim();
                if (!word) return;

                const rect = wordSpan.getBoundingClientRect();
                currentText = word;
                currentRect = rect;

                // Debounce 250ms to avoid flicker
                ytHoverTimer = setTimeout(async () => {
                    if (!ytIsHovering) return;

                    showTooltip(
                        `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                        rect,
                    );

                    try {
                        const targetLang = await getTargetLang();
                        const { translated, detectedLang } =
                            await cachedTranslate(word, targetLang);
                        const srcLang =
                            typeof detectedLang === "string"
                                ? detectedLang
                                : "auto";

                        if (!ytIsHovering) return;

                        const html = buildYTTooltipHtml(
                            srcLang,
                            targetLang,
                            word,
                            translated,
                            null,
                            null,
                        );
                        showTooltip(html, rect);
                        attachYTTooltipHandlers();

                        // Auto-speak the hovered word in source language
                        speak(word, srcLang);
                    } catch (err) {
                        console.error("[Quick Translator – YT CC hover]", err);
                        showTooltip(
                            `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                            rect,
                        );
                    }
                }, 250);
            });

            el.addEventListener("mouseleave", () => {
                ytIsHovering = false;
                clearTimeout(ytHoverTimer);
                // Don't hide if click-locked
                if (ytClickLocked) return;
                // Delay hiding so user can interact with tooltip
                setTimeout(() => {
                    if (
                        !ytIsHovering &&
                        !ytClickLocked &&
                        !tooltipEl?.matches(":hover")
                    ) {
                        hideTooltip();
                        // Resume video if it was playing before hover
                        if (ytWasPlayingBeforeHover) {
                            ytWasPlayingBeforeHover = false;
                            const video = document.querySelector("video");
                            if (video && video.paused) video.play();
                        }
                    }
                }, 400);
            });

            // ── CLICK on word → speak word + translate full sentence (sticky) ──
            el.addEventListener("click", async (e) => {
                const wordSpan = e.target.closest(`.${PREFIX}yt-word`);
                if (!wordSpan) return;

                e.stopPropagation();
                e.preventDefault();
                clearTimeout(ytHoverTimer);

                // Lock the tooltip so it stays visible
                ytClickLocked = true;

                const clickedWord = wordSpan.textContent.trim();
                if (!clickedWord) return;

                // Pause the video and remember state
                const video = document.querySelector("video");
                if (video && !video.paused) {
                    ytClickWasPlaying = true;
                    video.pause();
                }

                // Try to extract full sentence from subtitle buffer
                let fullLine = extractSentence(ytSubtitleBuffer, clickedWord);
                // Fallback: gather from visible segments
                if (!fullLine) {
                    const container =
                        el.closest(".captions-text") ||
                        el.closest(".ytp-caption-window-container") ||
                        el.parentElement;
                    const segments = container
                        ? container.querySelectorAll(".ytp-caption-segment")
                        : [el];
                    fullLine = Array.from(segments)
                        .map((s) => s.textContent)
                        .join(" ")
                        .trim();
                }

                const rect = wordSpan.getBoundingClientRect();
                currentText = clickedWord;
                currentRect = rect;

                try {
                    const targetLang = await getTargetLang();
                    const { translated: wordTranslated, detectedLang } =
                        await cachedTranslate(clickedWord, targetLang);
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";

                    // Speak the clicked word immediately
                    speak(clickedWord, srcLang);

                    // Show loading for full sentence
                    showTooltip(
                        `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                        rect,
                    );

                    // Translate full line
                    let fullTranslated = null;
                    const showFullLine = fullLine && fullLine !== clickedWord;
                    if (showFullLine) {
                        const result = await cachedTranslate(
                            fullLine,
                            targetLang,
                        );
                        fullTranslated = result.translated;
                    }

                    const html = buildYTTooltipHtml(
                        srcLang,
                        targetLang,
                        clickedWord,
                        wordTranslated,
                        showFullLine ? fullLine : null,
                        fullTranslated,
                    );

                    showTooltip(html, rect);
                    attachYTTooltipHandlers();
                } catch (err) {
                    console.error("[Quick Translator – YT CC click]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            });
        }

        // Check if a caption segment is inside the actual subtitle overlay
        function isActualSubtitle(el) {
            return !!el.closest(".ytp-caption-window-container");
        }

        // Observe DOM for subtitle elements appearing
        function observeSubtitles() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        // Direct match
                        if (
                            node.classList?.contains("ytp-caption-segment") &&
                            isActualSubtitle(node)
                        ) {
                            appendToSubtitleBuffer(node.textContent);
                            makeSubtitleClickable(node);
                        }
                        // Children match
                        const segments =
                            node.querySelectorAll?.(
                                ".ytp-caption-window-container .ytp-caption-segment",
                            ) || [];
                        segments.forEach((seg) => {
                            appendToSubtitleBuffer(seg.textContent);
                            makeSubtitleClickable(seg);
                        });
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            // Also process any subtitles already on the page
            document
                .querySelectorAll(
                    ".ytp-caption-window-container .ytp-caption-segment",
                )
                .forEach((seg) => {
                    appendToSubtitleBuffer(seg.textContent);
                    makeSubtitleClickable(seg);
                });
        }

        // Start observing when YouTube player is ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                observeSubtitles();
                showYTHint(
                    "Najedź na słowo w CC = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
                );
            });
        } else {
            observeSubtitles();
            showYTHint(
                "Najedź na słowo w CC = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
            );
        }

        // Re-observe on YouTube SPA navigation
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(() => {
                    document
                        .querySelectorAll(".ytp-caption-segment")
                        .forEach(makeSubtitleClickable);
                }, 2000);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ══════════════════════════════════════════════════════════════
    // ── Netflix CC Subtitle Click-to-Translate ────────────────────
    // ══════════════════════════════════════════════════════════════

    const isNetflix = window.location.hostname.includes("netflix.com");

    if (isNetflix) {
        let nfHintEl = null;
        let nfHintTimer = null;

        function showNFHint(msg) {
            if (!nfHintEl) {
                nfHintEl = document.createElement("div");
                nfHintEl.className = `${PREFIX}nf-sub-hint`;
                getOverlayParent().appendChild(nfHintEl);
            }
            // Re-parent into fullscreen element if needed
            const parent = getOverlayParent();
            if (nfHintEl.parentElement !== parent) {
                parent.appendChild(nfHintEl);
            }
            nfHintEl.textContent = msg;
            nfHintEl.classList.add("visible");
            clearTimeout(nfHintTimer);
            nfHintTimer = setTimeout(() => {
                nfHintEl.classList.remove("visible");
            }, 4000);
        }

        // Translation cache
        let nfTranslateCache = new Map();
        let nfHoverTimer = null;
        let nfIsHovering = false;
        let nfWasPlayingBeforeHover = false;
        let nfClickLocked = false;
        let nfClickWasPlaying = false;

        // Dismiss click-locked tooltip and resume video
        function dismissNFClick() {
            if (!nfClickLocked) return;
            nfClickLocked = false;
            hideTooltip();
            if (nfClickWasPlaying) {
                nfClickWasPlaying = false;
                const video = document.querySelector("video");
                if (video && video.paused) video.play();
            }
        }

        // Allow Escape / click-away to dismiss Netflix tooltip too
        const origYtDismiss = ytDismissClickFn;
        ytDismissClickFn = () => {
            if (origYtDismiss) origYtDismiss();
            dismissNFClick();
        };

        // ── Subtitle history buffer ──
        let nfSubtitleBuffer = "";
        let nfLastSegmentText = "";

        function nfAppendToBuffer(text) {
            const trimmed = text.trim();
            if (!trimmed) return;
            if (trimmed === nfLastSegmentText) return;
            if (nfSubtitleBuffer.endsWith(trimmed)) return;
            let overlap = 0;
            const maxOverlap = Math.min(
                trimmed.length,
                nfSubtitleBuffer.length,
            );
            for (let i = 1; i <= maxOverlap; i++) {
                if (nfSubtitleBuffer.endsWith(trimmed.substring(0, i))) {
                    overlap = i;
                }
            }
            const newPart = trimmed.substring(overlap);
            if (newPart) {
                nfSubtitleBuffer +=
                    (nfSubtitleBuffer && !nfSubtitleBuffer.endsWith(" ")
                        ? " "
                        : "") + newPart;
            }
            nfLastSegmentText = trimmed;
            if (nfSubtitleBuffer.length > 3000) {
                nfSubtitleBuffer = nfSubtitleBuffer.substring(
                    nfSubtitleBuffer.length - 2000,
                );
            }
        }

        function nfExtractSentence(buffer, word) {
            const idx = buffer.lastIndexOf(word);
            if (idx === -1) return null;
            const sentenceEnders = /[.!?…]/;
            let start = 0;
            for (let i = idx - 1; i >= 0; i--) {
                if (sentenceEnders.test(buffer[i])) {
                    start = i + 1;
                    break;
                }
            }
            let end = buffer.length;
            for (let i = idx + word.length; i < buffer.length; i++) {
                if (sentenceEnders.test(buffer[i])) {
                    end = i + 1;
                    break;
                }
            }
            const sentence = buffer.substring(start, end).trim();
            return sentence.length > word.length + 2 ? sentence : null;
        }

        async function nfCachedTranslate(text, targetLang) {
            const key = `${text}|${targetLang}`;
            if (nfTranslateCache.has(key)) return nfTranslateCache.get(key);
            const result = await googleTranslate(text, targetLang);
            nfTranslateCache.set(key, result);
            if (nfTranslateCache.size > 200) {
                const first = nfTranslateCache.keys().next().value;
                nfTranslateCache.delete(first);
            }
            return result;
        }

        // Build tooltip HTML (reuse buildYTTooltipHtml logic)
        function buildNFTooltipHtml(
            srcLang,
            targetLang,
            original,
            translated,
            fullLine,
            fullTranslated,
        ) {
            let fullLineHtml = "";
            const cleanFullLine = fullLine ? stripBrackets(fullLine) : "";
            const cleanFullTranslated = fullTranslated
                ? stripBrackets(fullTranslated)
                : "";
            if (fullLine && fullTranslated) {
                if (cleanFullLine) {
                    fullLineHtml = `
                    <div class="${PREFIX}row" style="margin-top:6px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                        <span class="${PREFIX}label">ALL</span>
                        <span class="${PREFIX}text ${PREFIX}original" style="font-size:12px;">${escapeHtml(cleanFullLine)}</span>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label"></span>
                        <span class="${PREFIX}text ${PREFIX}translated" style="font-size:12px;">${escapeHtml(cleanFullTranslated)}</span>
                    </div>`;
                }
            }
            const saveSentenceBtn = cleanFullLine
                ? `<button class="${PREFIX}save-sentence-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" data-sentence="${escapeAttr(cleanFullLine)}" data-sentence-translated="${escapeAttr(cleanFullTranslated)}" title="Zapisz zdanie">${SVG_SAVE_SENTENCE}</button>`
                : "";
            return `
                <div class="${PREFIX}header">
                    <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                    <div style="display:flex;align-items:center;">
                        <button class="${PREFIX}save-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" title="Zapisz słowo">${SVG_SAVE}</button>
                        ${saveSentenceBtn}
                    </div>
                </div>
                <div class="${PREFIX}body">
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(srcLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}original">${escapeHtml(original)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(original)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(targetLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}translated">${escapeHtml(translated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG_SPEAKER}</button>
                    </div>
                    ${fullLineHtml}
                </div>`;
        }

        // Attach TTS + save handlers (same pattern as YT)
        function attachNFTooltipHandlers() {
            if (!tooltipEl) return;
            tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const t = btn.getAttribute("data-text");
                    const l = btn.getAttribute("data-lang");
                    btn.classList.add("speaking");
                    speak(t, l).then((utter) => {
                        utter.onend = () => btn.classList.remove("speaking");
                        utter.onerror = () => btn.classList.remove("speaking");
                    });
                });
            });
            const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
            if (saveBtn) {
                saveBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveBtn.getAttribute("data-src"),
                        translated: saveBtn.getAttribute("data-translated"),
                        srcLang: saveBtn.getAttribute("data-src-lang"),
                        tgtLang: saveBtn.getAttribute("data-tgt-lang"),
                        sentence: "",
                        sentenceTranslated: "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveBtn.innerHTML = SVG_SAVE_CHECK;
                    saveBtn.classList.add("saved");
                });
            }
            const saveSentenceBtn = tooltipEl.querySelector(
                `.${PREFIX}save-sentence-btn`,
            );
            if (saveSentenceBtn) {
                saveSentenceBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveSentenceBtn.getAttribute("data-src"),
                        translated:
                            saveSentenceBtn.getAttribute("data-translated"),
                        srcLang: saveSentenceBtn.getAttribute("data-src-lang"),
                        tgtLang: saveSentenceBtn.getAttribute("data-tgt-lang"),
                        sentence:
                            saveSentenceBtn.getAttribute("data-sentence") || "",
                        sentenceTranslated:
                            saveSentenceBtn.getAttribute(
                                "data-sentence-translated",
                            ) || "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveSentenceBtn.innerHTML = SVG_SAVE_SENTENCE_CHECK;
                    saveSentenceBtn.classList.add("saved");
                });
            }
        }

        // Split subtitle text node into individual word spans
        function nfSplitIntoWords(el) {
            const text = el.textContent;
            if (!text.trim()) return;
            el.textContent = "";
            const parts = text.match(/\S+|\s+/g) || [];
            for (const part of parts) {
                if (/\S/.test(part)) {
                    const wordSpan = document.createElement("span");
                    wordSpan.className = `${PREFIX}nf-word`;
                    wordSpan.textContent = part;
                    el.appendChild(wordSpan);
                } else {
                    el.appendChild(document.createTextNode(part));
                }
            }
        }

        // Get all subtitle text spans in Netflix player
        function getNFSubtitleSpans() {
            // Netflix uses .player-timedtext-text-container for subtitles
            // Inside that, the actual text lines are nested spans
            return document.querySelectorAll(
                ".player-timedtext-text-container span",
            );
        }

        // Make a Netflix subtitle span interactive (split into words only)
        function makeNFSubtitleClickable(el) {
            // Skip if already processed or if it's one of our word spans
            if (el.dataset[PREFIX + "nfBound"]) return;
            if (el.classList.contains(`${PREFIX}nf-word`)) return;
            // Only process leaf spans that contain direct text
            if (!el.textContent.trim()) return;
            // Only process leaf spans (no child spans except our own word spans)
            const childSpan = el.querySelector(`span:not(.${PREFIX}nf-word)`);
            if (childSpan) return;

            el.dataset[PREFIX + "nfBound"] = "1";
            el.classList.add(`${PREFIX}clickable`);

            // Split text into word spans
            nfSplitIntoWords(el);
        }

        // ── Helper: find .__qt_nf-word at given screen coordinates ──
        // Uses elementsFromPoint to "see through" Netflix overlay divs
        // (e.target is the overlay, NOT the subtitle – so closest() won't work)
        function findNFWordAtPoint(x, y) {
            const els = document.elementsFromPoint(x, y);
            for (const el of els) {
                if (el.classList && el.classList.contains(`${PREFIX}nf-word`))
                    return el;
            }
            return null;
        }

        // ── Document-level event delegation via elementsFromPoint ──
        // Netflix has invisible overlay divs sitting on top of subtitle text.
        // e.target is ALWAYS the overlay, never the subtitle word span.
        // elementsFromPoint() returns ALL elements at the coordinates,
        // including ones underneath overlays, so we can find our word spans.

        let nfLastHoveredWord = null;

        // MOUSEMOVE – detect hover via elementsFromPoint (not mouseover)
        document.addEventListener(
            "mousemove",
            (e) => {
                // Only run on Netflix watch pages with subtitles
                if (!document.querySelector(".player-timedtext")) return;

                const wordSpan = findNFWordAtPoint(e.clientX, e.clientY);

                if (wordSpan && wordSpan !== nfLastHoveredWord) {
                    // Entered a new word
                    if (nfLastHoveredWord) {
                        nfLastHoveredWord.classList.remove(
                            `${PREFIX}nf-word-hover`,
                        );
                    }
                    nfLastHoveredWord = wordSpan;
                    wordSpan.classList.add(`${PREFIX}nf-word-hover`);
                    handleNFWordEnter(wordSpan);
                } else if (!wordSpan && nfLastHoveredWord) {
                    // Left the word area
                    nfLastHoveredWord.classList.remove(
                        `${PREFIX}nf-word-hover`,
                    );
                    nfLastHoveredWord = null;
                    handleNFWordLeave();
                }
            },
            true, // capturing phase
        );

        async function handleNFWordEnter(wordSpan) {
            if (nfClickLocked) return;

            nfIsHovering = true;
            clearTimeout(nfHoverTimer);

            // Pause video on hover
            const video = document.querySelector("video");
            if (video && !video.paused) {
                nfWasPlayingBeforeHover = true;
                video.pause();
            }

            const word = wordSpan.textContent.trim();
            if (!word) return;

            const rect = wordSpan.getBoundingClientRect();
            currentText = word;
            currentRect = rect;

            nfHoverTimer = setTimeout(async () => {
                if (!nfIsHovering) return;

                showTooltip(
                    `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                    rect,
                );

                try {
                    const targetLang = await getTargetLang();
                    const { translated, detectedLang } =
                        await nfCachedTranslate(word, targetLang);
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";

                    if (!nfIsHovering) return;

                    const html = buildNFTooltipHtml(
                        srcLang,
                        targetLang,
                        word,
                        translated,
                        null,
                        null,
                    );
                    showTooltip(html, rect);
                    attachNFTooltipHandlers();

                    // Auto-speak the hovered word
                    speak(word, srcLang);
                } catch (err) {
                    console.error("[Quick Translator – NF CC hover]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            }, 250);
        }

        function handleNFWordLeave() {
            nfIsHovering = false;
            clearTimeout(nfHoverTimer);
            if (nfClickLocked) return;
            setTimeout(() => {
                if (
                    !nfIsHovering &&
                    !nfClickLocked &&
                    !tooltipEl?.matches(":hover")
                ) {
                    hideTooltip();
                    if (nfWasPlayingBeforeHover) {
                        nfWasPlayingBeforeHover = false;
                        const video = document.querySelector("video");
                        if (video && video.paused) video.play();
                    }
                }
            }, 400);
        }

        // CLICK – find word through overlays via elementsFromPoint
        document.addEventListener(
            "click",
            async (e) => {
                const wordSpan = findNFWordAtPoint(e.clientX, e.clientY);
                if (!wordSpan) return;

                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                clearTimeout(nfHoverTimer);

                nfClickLocked = true;

                const clickedWord = wordSpan.textContent.trim();
                if (!clickedWord) return;

                // Pause video
                const video = document.querySelector("video");
                if (video && !video.paused) {
                    nfClickWasPlaying = true;
                    video.pause();
                }

                // Try to extract full sentence from buffer
                let fullLine = nfExtractSentence(nfSubtitleBuffer, clickedWord);
                // Fallback: gather from visible subtitle container
                if (!fullLine) {
                    const container = wordSpan.closest(
                        ".player-timedtext-text-container",
                    );
                    if (container) {
                        fullLine = container.textContent.trim();
                    }
                }

                const rect = wordSpan.getBoundingClientRect();
                currentText = clickedWord;
                currentRect = rect;

                try {
                    const targetLang = await getTargetLang();
                    const { translated: wordTranslated, detectedLang } =
                        await nfCachedTranslate(clickedWord, targetLang);
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";

                    // Speak the clicked word
                    speak(clickedWord, srcLang);

                    showTooltip(
                        `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                        rect,
                    );

                    let fullTranslated = null;
                    const showFullLine = fullLine && fullLine !== clickedWord;
                    if (showFullLine) {
                        const result = await nfCachedTranslate(
                            fullLine,
                            targetLang,
                        );
                        fullTranslated = result.translated;
                    }

                    const html = buildNFTooltipHtml(
                        srcLang,
                        targetLang,
                        clickedWord,
                        wordTranslated,
                        showFullLine ? fullLine : null,
                        fullTranslated,
                    );

                    showTooltip(html, rect);
                    attachNFTooltipHandlers();
                } catch (err) {
                    console.error("[Quick Translator – NF CC click]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            },
            true, // capturing phase
        );

        // Block Netflix play/pause toggle when clicking on subtitle words
        for (const evtName of [
            "mousedown",
            "mouseup",
            "pointerdown",
            "pointerup",
        ]) {
            document.addEventListener(
                evtName,
                (e) => {
                    if (findNFWordAtPoint(e.clientX, e.clientY)) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                    }
                },
                true, // capturing phase
            );
        }

        // Process all currently visible Netflix subtitle elements
        function processNFSubtitles() {
            getNFSubtitleSpans().forEach((span) => {
                // Only process leaf text spans (no child spans except our word spans)
                const hasRealChildSpan = span.querySelector(
                    `span:not(.${PREFIX}nf-word)`,
                );
                if (!hasRealChildSpan && span.textContent.trim()) {
                    nfAppendToBuffer(span.textContent);
                    makeNFSubtitleClickable(span);
                }
            });
        }

        // Observe DOM for Netflix subtitle elements
        function observeNFSubtitles() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        // Check if it's inside the subtitle container
                        if (
                            node.closest?.(
                                ".player-timedtext-text-container",
                            ) ||
                            node.classList?.contains(
                                "player-timedtext-text-container",
                            )
                        ) {
                            const spans =
                                node.tagName === "SPAN"
                                    ? [node]
                                    : node.querySelectorAll("span");
                            spans.forEach((span) => {
                                const hasRealChild = span.querySelector(
                                    `span:not(.${PREFIX}nf-word)`,
                                );
                                if (!hasRealChild && span.textContent.trim()) {
                                    nfAppendToBuffer(span.textContent);
                                    makeNFSubtitleClickable(span);
                                }
                            });
                        }
                        // Also check for the container being added
                        const containers =
                            node.querySelectorAll?.(
                                ".player-timedtext-text-container span",
                            ) || [];
                        containers.forEach((span) => {
                            const hasRealChild = span.querySelector(
                                `span:not(.${PREFIX}nf-word)`,
                            );
                            if (!hasRealChild && span.textContent.trim()) {
                                nfAppendToBuffer(span.textContent);
                                makeNFSubtitleClickable(span);
                            }
                        });
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            // Process any subtitles already on the page
            processNFSubtitles();
        }

        // Start observing
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                observeNFSubtitles();
                showNFHint(
                    "Najedź na słowo w napisach = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
                );
            });
        } else {
            observeNFSubtitles();
            showNFHint(
                "Najedź na słowo w napisach = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
            );
        }

        // Netflix is a SPA – re-check on URL changes
        let nfLastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== nfLastUrl) {
                nfLastUrl = location.href;
                nfSubtitleBuffer = "";
                nfLastSegmentText = "";
                nfTranslateCache.clear();
                setTimeout(processNFSubtitles, 2000);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ══════════════════════════════════════════════════════════════
    // ── LookMovie2 CC Subtitle Click-to-Translate ─────────────────
    // ══════════════════════════════════════════════════════════════

    const isLookMovie = window.location.hostname.includes("lookmovie");

    if (isLookMovie) {
        let lmHintEl = null;
        let lmHintTimer = null;

        function showLMHint(msg) {
            if (!lmHintEl) {
                lmHintEl = document.createElement("div");
                lmHintEl.className = `${PREFIX}lm-sub-hint`;
                document.body.appendChild(lmHintEl);
            }
            lmHintEl.textContent = msg;
            lmHintEl.classList.add("visible");
            clearTimeout(lmHintTimer);
            lmHintTimer = setTimeout(() => {
                lmHintEl.classList.remove("visible");
            }, 4000);
        }

        let lmTranslateCache = new Map();
        let lmHoverTimer = null;
        let lmIsHovering = false;
        let lmWasPlayingBeforeHover = false;
        let lmClickLocked = false;
        let lmClickWasPlaying = false;

        function dismissLMClick() {
            if (!lmClickLocked) return;
            lmClickLocked = false;
            hideTooltip();
            if (lmClickWasPlaying) {
                lmClickWasPlaying = false;
                const video = document.querySelector("video");
                if (video && video.paused) video.play();
            }
        }

        const origDismissForLM = ytDismissClickFn;
        ytDismissClickFn = () => {
            if (origDismissForLM) origDismissForLM();
            dismissLMClick();
        };

        // Subtitle history buffer
        let lmSubtitleBuffer = "";
        let lmLastSegmentText = "";

        function lmAppendToBuffer(text) {
            const trimmed = text.trim();
            if (!trimmed) return;
            if (trimmed === lmLastSegmentText) return;
            if (lmSubtitleBuffer.endsWith(trimmed)) return;
            let overlap = 0;
            const maxOverlap = Math.min(
                trimmed.length,
                lmSubtitleBuffer.length,
            );
            for (let i = 1; i <= maxOverlap; i++) {
                if (lmSubtitleBuffer.endsWith(trimmed.substring(0, i))) {
                    overlap = i;
                }
            }
            const newPart = trimmed.substring(overlap);
            if (newPart) {
                lmSubtitleBuffer +=
                    (lmSubtitleBuffer && !lmSubtitleBuffer.endsWith(" ")
                        ? " "
                        : "") + newPart;
            }
            lmLastSegmentText = trimmed;
            if (lmSubtitleBuffer.length > 3000) {
                lmSubtitleBuffer = lmSubtitleBuffer.substring(
                    lmSubtitleBuffer.length - 2000,
                );
            }
        }

        function lmExtractSentence(buffer, word) {
            const idx = buffer.lastIndexOf(word);
            if (idx === -1) return null;
            const sentenceEnders = /[.!?…]/;
            let start = 0;
            for (let i = idx - 1; i >= 0; i--) {
                if (sentenceEnders.test(buffer[i])) {
                    start = i + 1;
                    break;
                }
            }
            let end = buffer.length;
            for (let i = idx + word.length; i < buffer.length; i++) {
                if (sentenceEnders.test(buffer[i])) {
                    end = i + 1;
                    break;
                }
            }
            const sentence = buffer.substring(start, end).trim();
            return sentence.length > word.length + 2 ? sentence : null;
        }

        async function lmCachedTranslate(text, targetLang) {
            const key = `${text}|${targetLang}`;
            if (lmTranslateCache.has(key)) return lmTranslateCache.get(key);
            const result = await googleTranslate(text, targetLang);
            lmTranslateCache.set(key, result);
            if (lmTranslateCache.size > 200) {
                const first = lmTranslateCache.keys().next().value;
                lmTranslateCache.delete(first);
            }
            return result;
        }

        function buildLMTooltipHtml(
            srcLang,
            targetLang,
            original,
            translated,
            fullLine,
            fullTranslated,
        ) {
            let fullLineHtml = "";
            const cleanFullLine = fullLine ? stripBrackets(fullLine) : "";
            const cleanFullTranslated = fullTranslated
                ? stripBrackets(fullTranslated)
                : "";
            if (fullLine && fullTranslated) {
                if (cleanFullLine) {
                    fullLineHtml = `
                    <div class="${PREFIX}row" style="margin-top:6px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                        <span class="${PREFIX}label">ALL</span>
                        <span class="${PREFIX}text ${PREFIX}original" style="font-size:12px;">${escapeHtml(cleanFullLine)}</span>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label"></span>
                        <span class="${PREFIX}text ${PREFIX}translated" style="font-size:12px;">${escapeHtml(cleanFullTranslated)}</span>
                    </div>`;
                }
            }
            const saveSentenceBtn = cleanFullLine
                ? `<button class="${PREFIX}save-sentence-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" data-sentence="${escapeAttr(cleanFullLine)}" data-sentence-translated="${escapeAttr(cleanFullTranslated)}" title="Zapisz zdanie">${SVG_SAVE_SENTENCE}</button>`
                : "";
            return `
                <div class="${PREFIX}header">
                    <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                    <div style="display:flex;align-items:center;">
                        <button class="${PREFIX}save-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" title="Zapisz słowo">${SVG_SAVE}</button>
                        ${saveSentenceBtn}
                    </div>
                </div>
                <div class="${PREFIX}body">
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(srcLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}original">${escapeHtml(original)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(original)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(targetLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}translated">${escapeHtml(translated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG_SPEAKER}</button>
                    </div>
                    ${fullLineHtml}
                </div>`;
        }

        function attachLMTooltipHandlers() {
            if (!tooltipEl) return;
            tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const t = btn.getAttribute("data-text");
                    const l = btn.getAttribute("data-lang");
                    btn.classList.add("speaking");
                    speak(t, l).then((utter) => {
                        utter.onend = () => btn.classList.remove("speaking");
                        utter.onerror = () => btn.classList.remove("speaking");
                    });
                });
            });
            const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
            if (saveBtn) {
                saveBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveBtn.getAttribute("data-src"),
                        translated: saveBtn.getAttribute("data-translated"),
                        srcLang: saveBtn.getAttribute("data-src-lang"),
                        tgtLang: saveBtn.getAttribute("data-tgt-lang"),
                        sentence: "",
                        sentenceTranslated: "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveBtn.innerHTML = SVG_SAVE_CHECK;
                    saveBtn.classList.add("saved");
                });
            }
            const saveSentenceBtn = tooltipEl.querySelector(
                `.${PREFIX}save-sentence-btn`,
            );
            if (saveSentenceBtn) {
                saveSentenceBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveSentenceBtn.getAttribute("data-src"),
                        translated:
                            saveSentenceBtn.getAttribute("data-translated"),
                        srcLang: saveSentenceBtn.getAttribute("data-src-lang"),
                        tgtLang: saveSentenceBtn.getAttribute("data-tgt-lang"),
                        sentence:
                            saveSentenceBtn.getAttribute("data-sentence") || "",
                        sentenceTranslated:
                            saveSentenceBtn.getAttribute(
                                "data-sentence-translated",
                            ) || "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveSentenceBtn.innerHTML = SVG_SAVE_SENTENCE_CHECK;
                    saveSentenceBtn.classList.add("saved");
                });
            }
        }

        // Split subtitle text into individual clickable word spans
        function lmSplitIntoWords(el) {
            const text = el.textContent;
            if (!text.trim()) return;
            el.textContent = "";
            const parts = text.match(/\S+|\s+/g) || [];
            for (const part of parts) {
                if (/\S/.test(part)) {
                    const wordSpan = document.createElement("span");
                    wordSpan.className = `${PREFIX}lm-word`;
                    wordSpan.textContent = part;
                    el.appendChild(wordSpan);
                } else {
                    el.appendChild(document.createTextNode(part));
                }
            }
        }

        // Find word span at given coordinates (works through overlays)
        function findLMWordAtPoint(x, y) {
            const els = document.elementsFromPoint(x, y);
            for (const el of els) {
                if (el.classList && el.classList.contains(`${PREFIX}lm-word`))
                    return el;
            }
            return null;
        }

        // Make a subtitle cue div interactive
        function makeLMSubtitleClickable(el) {
            if (el.dataset[PREFIX + "lmBound"]) return;
            if (el.classList.contains(`${PREFIX}lm-word`)) return;
            if (!el.textContent.trim()) return;
            // Only process leaf divs that contain direct text (innermost div)
            const childDiv = el.querySelector(`div:not(.${PREFIX}lm-word)`);
            if (childDiv) return;
            el.dataset[PREFIX + "lmBound"] = "1";
            lmSplitIntoWords(el);
        }

        let lmLastHoveredWord = null;

        // MOUSEMOVE – hover detection
        document.addEventListener(
            "mousemove",
            (e) => {
                if (!document.querySelector(".vjs-text-track-display")) return;

                const wordSpan = findLMWordAtPoint(e.clientX, e.clientY);

                if (wordSpan && wordSpan !== lmLastHoveredWord) {
                    if (lmLastHoveredWord)
                        lmLastHoveredWord.classList.remove(
                            `${PREFIX}lm-word-hover`,
                        );
                    lmLastHoveredWord = wordSpan;
                    wordSpan.classList.add(`${PREFIX}lm-word-hover`);
                    handleLMWordEnter(wordSpan);
                } else if (!wordSpan && lmLastHoveredWord) {
                    lmLastHoveredWord.classList.remove(
                        `${PREFIX}lm-word-hover`,
                    );
                    lmLastHoveredWord = null;
                    handleLMWordLeave();
                }
            },
            true,
        );

        async function handleLMWordEnter(wordSpan) {
            if (lmClickLocked) return;
            lmIsHovering = true;
            clearTimeout(lmHoverTimer);

            const video = document.querySelector("video");
            if (video && !video.paused) {
                lmWasPlayingBeforeHover = true;
                video.pause();
            }

            const word = wordSpan.textContent.trim();
            if (!word) return;

            const rect = wordSpan.getBoundingClientRect();
            currentText = word;
            currentRect = rect;

            lmHoverTimer = setTimeout(async () => {
                if (!lmIsHovering) return;
                showTooltip(
                    `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                    rect,
                );
                try {
                    const targetLang = await getTargetLang();
                    const { translated, detectedLang } =
                        await lmCachedTranslate(word, targetLang);
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";
                    if (!lmIsHovering) return;
                    const html = buildLMTooltipHtml(
                        srcLang,
                        targetLang,
                        word,
                        translated,
                        null,
                        null,
                    );
                    showTooltip(html, rect);
                    attachLMTooltipHandlers();
                    speak(word, srcLang);
                } catch (err) {
                    console.error("[Quick Translator – LM CC hover]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            }, 250);
        }

        function handleLMWordLeave() {
            lmIsHovering = false;
            clearTimeout(lmHoverTimer);
            if (lmClickLocked) return;
            setTimeout(() => {
                if (
                    !lmIsHovering &&
                    !lmClickLocked &&
                    !tooltipEl?.matches(":hover")
                ) {
                    hideTooltip();
                    if (lmWasPlayingBeforeHover) {
                        lmWasPlayingBeforeHover = false;
                        const video = document.querySelector("video");
                        if (video && video.paused) video.play();
                    }
                }
            }, 400);
        }

        // CLICK – translate word + full sentence
        document.addEventListener(
            "click",
            async (e) => {
                const wordSpan = findLMWordAtPoint(e.clientX, e.clientY);
                if (!wordSpan) return;

                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                clearTimeout(lmHoverTimer);

                lmClickLocked = true;

                const clickedWord = wordSpan.textContent.trim();
                if (!clickedWord) return;

                const video = document.querySelector("video");
                if (video && !video.paused) {
                    lmClickWasPlaying = true;
                    video.pause();
                }

                // Try to extract full sentence from buffer
                let fullLine = lmExtractSentence(lmSubtitleBuffer, clickedWord);
                // Fallback: gather from visible cue
                if (!fullLine) {
                    const cue = wordSpan.closest(".vjs-text-track-cue");
                    if (cue) fullLine = cue.textContent.trim();
                }

                const rect = wordSpan.getBoundingClientRect();
                currentText = clickedWord;
                currentRect = rect;

                try {
                    const targetLang = await getTargetLang();
                    const { translated: wordTranslated, detectedLang } =
                        await lmCachedTranslate(clickedWord, targetLang);
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";

                    speak(clickedWord, srcLang);

                    showTooltip(
                        `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                        rect,
                    );

                    let fullTranslated = null;
                    const showFullLine = fullLine && fullLine !== clickedWord;
                    if (showFullLine) {
                        const result = await lmCachedTranslate(
                            fullLine,
                            targetLang,
                        );
                        fullTranslated = result.translated;
                    }

                    const html = buildLMTooltipHtml(
                        srcLang,
                        targetLang,
                        clickedWord,
                        wordTranslated,
                        showFullLine ? fullLine : null,
                        fullTranslated,
                    );
                    showTooltip(html, rect);
                    attachLMTooltipHandlers();
                } catch (err) {
                    console.error("[Quick Translator – LM CC click]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            },
            true,
        );

        // Block video play/pause toggle when clicking on subtitle words
        for (const evtName of [
            "mousedown",
            "mouseup",
            "pointerdown",
            "pointerup",
        ]) {
            document.addEventListener(
                evtName,
                (e) => {
                    if (findLMWordAtPoint(e.clientX, e.clientY)) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                    }
                },
                true,
            );
        }

        // Process visible subtitle cue elements
        function processLMSubtitles() {
            document
                .querySelectorAll(".vjs-text-track-cue div")
                .forEach((div) => {
                    if (div.textContent.trim() && !div.querySelector(`div`)) {
                        lmAppendToBuffer(div.textContent);
                        makeLMSubtitleClickable(div);
                    }
                });
        }

        // Observe DOM for new subtitle cues
        function observeLMSubtitles() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (
                            node.closest?.(".vjs-text-track-cue") ||
                            node.classList?.contains("vjs-text-track-cue")
                        ) {
                            const divs =
                                node.tagName === "DIV"
                                    ? [node]
                                    : node.querySelectorAll("div");
                            divs.forEach((div) => {
                                if (
                                    div.textContent.trim() &&
                                    !div.querySelector("div")
                                ) {
                                    lmAppendToBuffer(div.textContent);
                                    makeLMSubtitleClickable(div);
                                }
                            });
                        }
                    }
                    // Also handle characterData changes (subtitle text updates)
                    if (mutation.type === "characterData") {
                        const cueDiv = mutation.target.parentElement?.closest?.(
                            ".vjs-text-track-cue div",
                        );
                        if (cueDiv && !cueDiv.querySelector("div")) {
                            cueDiv.dataset[PREFIX + "lmBound"] = "";
                            lmAppendToBuffer(cueDiv.textContent);
                            makeLMSubtitleClickable(cueDiv);
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            processLMSubtitles();
            // Re-process periodically (subtitle cues can be replaced without mutation events)
            setInterval(processLMSubtitles, 500);
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                observeLMSubtitles();
                showLMHint(
                    "Najedź na słowo w napisach = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
                );
            });
        } else {
            observeLMSubtitles();
            showLMHint(
                "Najedź na słowo w napisach = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
            );
        }
    }

    // ══════════════════════════════════════════════════════════════
    // ── X.com (Twitter) – Hover/Click word translate (like YT) ────
    // ══════════════════════════════════════════════════════════════

    const isX = /^(x\.com|twitter\.com)$/.test(window.location.hostname);

    if (isX) {
        const X_SPEAK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
        const X_TRANSLATE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`;

        let xHintEl = null;
        let xHintTimer = null;
        let xCurrentSpeakingBtn = null;

        function showXHint(msg) {
            if (!xHintEl) {
                xHintEl = document.createElement("div");
                xHintEl.className = `${PREFIX}x-sub-hint`;
                document.body.appendChild(xHintEl);
            }
            xHintEl.textContent = msg;
            xHintEl.classList.add("visible");
            clearTimeout(xHintTimer);
            xHintTimer = setTimeout(() => {
                xHintEl.classList.remove("visible");
            }, 4000);
        }

        // Translation cache
        let xTranslateCache = new Map();
        let xHoverTimer = null;
        let xIsHovering = false;
        let xClickLocked = false;

        // Dismiss click-locked tooltip
        function dismissXClick() {
            if (!xClickLocked) return;
            xClickLocked = false;
            hideTooltip();
        }
        // Hook into global dismiss
        const origDismissFnX = ytDismissClickFn;
        ytDismissClickFn = () => {
            if (origDismissFnX) origDismissFnX();
            dismissXClick();
        };

        async function xCachedTranslate(text, targetLang) {
            const key = `${text}|${targetLang}`;
            if (xTranslateCache.has(key)) return xTranslateCache.get(key);
            const result = await googleTranslate(text, targetLang);
            xTranslateCache.set(key, result);
            if (xTranslateCache.size > 300) {
                const first = xTranslateCache.keys().next().value;
                xTranslateCache.delete(first);
            }
            return result;
        }

        // Get the full text content of a tweet article
        function getPostText(article) {
            const textEl = article.querySelector('[data-testid="tweetText"]');
            if (!textEl) return "";
            return textEl.innerText.trim();
        }

        // Extract sentence from tweet text containing the given word
        function xExtractSentence(fullText, word) {
            const idx = fullText.lastIndexOf(word);
            if (idx === -1) return fullText; // fallback: whole tweet
            const sentenceEnders = /[.!?…\n]/;
            let start = 0;
            for (let i = idx - 1; i >= 0; i--) {
                if (sentenceEnders.test(fullText[i])) {
                    start = i + 1;
                    break;
                }
            }
            let end = fullText.length;
            for (let i = idx + word.length; i < fullText.length; i++) {
                if (sentenceEnders.test(fullText[i])) {
                    end = i + 1;
                    break;
                }
            }
            const sentence = fullText.substring(start, end).trim();
            return sentence.length > word.length + 2 ? sentence : fullText;
        }

        // Build tooltip HTML (same pattern as YouTube)
        function buildXTooltipHtml(
            srcLang,
            targetLang,
            original,
            translated,
            fullLine,
            fullTranslated,
        ) {
            let fullLineHtml = "";
            const cleanFullLine = fullLine ? stripBrackets(fullLine) : "";
            const cleanFullTranslated = fullTranslated
                ? stripBrackets(fullTranslated)
                : "";
            if (fullLine && fullTranslated && cleanFullLine) {
                fullLineHtml = `
                    <div class="${PREFIX}row" style="margin-top:6px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                        <span class="${PREFIX}label">ALL</span>
                        <span class="${PREFIX}text ${PREFIX}original" style="font-size:12px;">${escapeHtml(cleanFullLine)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(cleanFullLine)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj zdanie">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label"></span>
                        <span class="${PREFIX}text ${PREFIX}translated" style="font-size:12px;">${escapeHtml(cleanFullTranslated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(cleanFullTranslated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie zdania">${SVG_SPEAKER}</button>
                    </div>`;
            }
            const saveSentenceBtn = cleanFullLine
                ? `<button class="${PREFIX}save-sentence-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" data-sentence="${escapeAttr(cleanFullLine)}" data-sentence-translated="${escapeAttr(cleanFullTranslated)}" title="Zapisz zdanie">${SVG_SAVE_SENTENCE}</button>`
                : "";
            return `
                <div class="${PREFIX}header">
                    <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                    <div style="display:flex;align-items:center;">
                        <button class="${PREFIX}save-btn" data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}" data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}" title="Zapisz słowo">${SVG_SAVE}</button>
                        ${saveSentenceBtn}
                    </div>
                </div>
                <div class="${PREFIX}body">
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(srcLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}original">${escapeHtml(original)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(original)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG_SPEAKER}</button>
                    </div>
                    <div class="${PREFIX}row">
                        <span class="${PREFIX}label">${langTag(targetLang)}</span>
                        <span class="${PREFIX}text ${PREFIX}translated">${escapeHtml(translated)}</span>
                        <button class="${PREFIX}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG_SPEAKER}</button>
                    </div>
                    ${fullLineHtml}
                </div>`;
        }

        // Attach TTS + save handlers to tooltip buttons (same pattern as YT/NF)
        function attachXTooltipHandlers() {
            if (!tooltipEl) return;
            tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const t = btn.getAttribute("data-text");
                    const l = btn.getAttribute("data-lang");
                    btn.classList.add("speaking");
                    speak(t, l).then((utter) => {
                        utter.onend = () => btn.classList.remove("speaking");
                        utter.onerror = () => btn.classList.remove("speaking");
                    });
                });
            });
            const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
            if (saveBtn) {
                saveBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveBtn.getAttribute("data-src"),
                        translated: saveBtn.getAttribute("data-translated"),
                        srcLang: saveBtn.getAttribute("data-src-lang"),
                        tgtLang: saveBtn.getAttribute("data-tgt-lang"),
                        sentence: "",
                        sentenceTranslated: "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveBtn.innerHTML = SVG_SAVE_CHECK;
                    saveBtn.classList.add("saved");
                });
            }
            const saveSentenceBtn = tooltipEl.querySelector(
                `.${PREFIX}save-sentence-btn`,
            );
            if (saveSentenceBtn) {
                saveSentenceBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    saveWord({
                        original: saveSentenceBtn.getAttribute("data-src"),
                        translated:
                            saveSentenceBtn.getAttribute("data-translated"),
                        srcLang: saveSentenceBtn.getAttribute("data-src-lang"),
                        tgtLang: saveSentenceBtn.getAttribute("data-tgt-lang"),
                        sentence:
                            saveSentenceBtn.getAttribute("data-sentence") || "",
                        sentenceTranslated:
                            saveSentenceBtn.getAttribute(
                                "data-sentence-translated",
                            ) || "",
                        url: window.location.href,
                        timestamp: Date.now(),
                        downloaded: false,
                    });
                    saveSentenceBtn.innerHTML = SVG_SAVE_SENTENCE_CHECK;
                    saveSentenceBtn.classList.add("saved");
                });
            }
        }

        // ── TTS button in tweet header (keep from original) ──
        function stopXSpeaking() {
            window.speechSynthesis.cancel();
            if (elAudioEl) {
                elAudioEl.pause();
                elAudioEl = null;
            }
            if (xCurrentSpeakingBtn) {
                xCurrentSpeakingBtn.classList.remove(`${PREFIX}x-speaking`);
                xCurrentSpeakingBtn = null;
            }
        }

        function onXSpeakClick(e) {
            e.stopPropagation();
            e.preventDefault();
            const btn = e.currentTarget;
            const article = btn.closest("article");
            if (!article) return;
            if (btn.classList.contains(`${PREFIX}x-speaking`)) {
                stopXSpeaking();
                return;
            }
            stopXSpeaking();
            const text = getPostText(article);
            if (!text) return;
            btn.classList.add(`${PREFIX}x-speaking`);
            xCurrentSpeakingBtn = btn;
            const lang = document.documentElement.lang || "en";
            speak(text, lang).then((result) => {
                const onDone = () => {
                    btn.classList.remove(`${PREFIX}x-speaking`);
                    if (xCurrentSpeakingBtn === btn) xCurrentSpeakingBtn = null;
                };
                if (result && typeof result.onend !== "undefined") {
                    result.onend = onDone;
                    result.onerror = onDone;
                } else if (result instanceof HTMLAudioElement) {
                    result.onended = onDone;
                    result.onerror = onDone;
                }
            });
        }

        // ── Translate post: show translation inline below tweet ──
        async function onXTranslateClick(e) {
            e.stopPropagation();
            e.preventDefault();
            const btn = e.currentTarget;
            const article = btn.closest("article");
            if (!article) return;

            const textEl = article.querySelector('[data-testid="tweetText"]');
            if (!textEl) return;

            // Toggle off if already showing translation
            const existing = textEl.parentElement.querySelector(
                `.${PREFIX}x-post-translation`,
            );
            if (existing) {
                existing.remove();
                btn.classList.remove(`${PREFIX}x-translated-active`);
                return;
            }

            const text = getPostText(article);
            if (!text) return;

            btn.classList.add(`${PREFIX}x-translating`);

            try {
                const targetLang = await getTargetLang();
                const { translated, detectedLang } = await xCachedTranslate(
                    text,
                    targetLang,
                );
                const srcLang =
                    typeof detectedLang === "string" ? detectedLang : "auto";

                // Don't show if source and target are same
                // (still show — user explicitly asked)

                const translationDiv = document.createElement("div");
                translationDiv.className = `${PREFIX}x-post-translation`;
                translationDiv.innerHTML = `
                    <div class="${PREFIX}x-trans-label">${langTag(srcLang)} → ${langTag(targetLang)}</div>
                    <div>${escapeHtml(translated)}</div>`;

                // Insert after the tweet text element
                textEl.parentElement.insertBefore(
                    translationDiv,
                    textEl.nextSibling,
                );

                btn.classList.remove(`${PREFIX}x-translating`);
                btn.classList.add(`${PREFIX}x-translated-active`);
            } catch (err) {
                console.error("[Quick Translator – X translate post]", err);
                btn.classList.remove(`${PREFIX}x-translating`);
            }
        }

        // Inject speak + translate buttons into tweet header
        function injectXSpeakButton(article) {
            if (article.dataset[PREFIX + "xSpeak"]) return;
            article.dataset[PREFIX + "xSpeak"] = "1";
            const text = getPostText(article);
            if (!text) return;
            const grokBtn = article.querySelector(
                '[aria-label="Grok actions"]',
            );
            const caretBtn = article.querySelector('[data-testid="caret"]');
            const headerActionsRow =
                grokBtn?.closest(
                    '[class*="r-1awozwy"][class*="r-18u37iz"][class*="r-1cmwbt1"]',
                ) ||
                caretBtn?.closest(
                    '[class*="r-1awozwy"][class*="r-18u37iz"][class*="r-1cmwbt1"]',
                );
            if (!headerActionsRow) return;

            // Translate post button
            const translateBtn = document.createElement("button");
            translateBtn.className = `${PREFIX}x-translate-btn`;
            translateBtn.title = "Przetłumacz posta";
            translateBtn.innerHTML = X_TRANSLATE_SVG;
            translateBtn.addEventListener("click", onXTranslateClick);

            // Speak button
            const btn = document.createElement("button");
            btn.className = `${PREFIX}x-speak-btn`;
            btn.title = "Czytaj na głos";
            btn.innerHTML = X_SPEAK_SVG;
            btn.addEventListener("click", onXSpeakClick);

            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.marginRight = "4px";
            wrapper.appendChild(translateBtn);
            wrapper.appendChild(btn);
            headerActionsRow.insertBefore(wrapper, headerActionsRow.firstChild);
        }

        // ── Split tweet text into word spans ──
        function xSplitTextIntoWords(textEl) {
            if (textEl.dataset[PREFIX + "xWordBound"]) return;
            textEl.dataset[PREFIX + "xWordBound"] = "1";

            // Process all direct text nodes and inline elements
            const walker = document.createTreeWalker(
                textEl,
                NodeFilter.SHOW_TEXT,
                null,
                false,
            );
            const textNodes = [];
            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }

            for (const textNode of textNodes) {
                const text = textNode.textContent;
                if (!text.trim()) continue;

                // Skip text nodes inside links (hashtags, mentions, urls)
                const parentTag = textNode.parentElement?.tagName;
                const parentIsLink = textNode.parentElement?.closest("a");

                const frag = document.createDocumentFragment();
                const parts = text.match(/\S+|\s+/g) || [];
                for (const part of parts) {
                    if (/\S/.test(part)) {
                        // If parent is a link, wrap inside link context
                        if (parentIsLink) {
                            // Still make it a word span but keep it within the link
                            const wordSpan = document.createElement("span");
                            wordSpan.className = `${PREFIX}x-word`;
                            wordSpan.textContent = part;
                            frag.appendChild(wordSpan);
                        } else {
                            const wordSpan = document.createElement("span");
                            wordSpan.className = `${PREFIX}x-word`;
                            wordSpan.textContent = part;
                            frag.appendChild(wordSpan);
                        }
                    } else {
                        frag.appendChild(document.createTextNode(part));
                    }
                }
                textNode.parentNode.replaceChild(frag, textNode);
            }
        }

        // ── Hover handler: translate single word ──
        async function handleXWordHover(wordSpan) {
            if (xClickLocked) return;

            xIsHovering = true;
            clearTimeout(xHoverTimer);

            const word = wordSpan.textContent.trim();
            if (!word || word.length > 60) return;

            const rect = wordSpan.getBoundingClientRect();
            currentText = word;
            currentRect = rect;

            xHoverTimer = setTimeout(async () => {
                if (!xIsHovering) return;

                showTooltip(
                    `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                    rect,
                );

                try {
                    const targetLang = await getTargetLang();
                    const { translated, detectedLang } = await xCachedTranslate(
                        word,
                        targetLang,
                    );
                    const srcLang =
                        typeof detectedLang === "string"
                            ? detectedLang
                            : "auto";

                    if (!xIsHovering) return;

                    const html = buildXTooltipHtml(
                        srcLang,
                        targetLang,
                        word,
                        translated,
                        null,
                        null,
                    );
                    showTooltip(html, rect);
                    attachXTooltipHandlers();
                } catch (err) {
                    console.error("[Quick Translator – X hover]", err);
                    showTooltip(
                        `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                        rect,
                    );
                }
            }, 300);
        }

        function handleXWordLeave() {
            xIsHovering = false;
            clearTimeout(xHoverTimer);
            if (xClickLocked) return;
            setTimeout(() => {
                if (
                    !xIsHovering &&
                    !xClickLocked &&
                    !tooltipEl?.matches(":hover")
                ) {
                    hideTooltip();
                }
            }, 400);
        }

        // ── Click handler: translate word + full sentence (sticky) ──
        async function handleXWordClick(wordSpan, e) {
            e.stopPropagation();
            e.preventDefault();
            clearTimeout(xHoverTimer);

            xClickLocked = true;

            const clickedWord = wordSpan.textContent.trim();
            if (!clickedWord) return;

            // Get full tweet text from the article
            const article = wordSpan.closest("article");
            const fullText = article ? getPostText(article) : clickedWord;
            const fullLine = xExtractSentence(fullText, clickedWord);

            const rect = wordSpan.getBoundingClientRect();
            currentText = clickedWord;
            currentRect = rect;

            // Show loading
            showTooltip(
                `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
                rect,
            );

            try {
                const targetLang = await getTargetLang();
                const { translated: wordTranslated, detectedLang } =
                    await xCachedTranslate(clickedWord, targetLang);
                const srcLang =
                    typeof detectedLang === "string" ? detectedLang : "auto";

                // Speak the clicked word immediately
                speak(clickedWord, srcLang);

                // Translate full sentence
                let fullTranslated = null;
                const showFullLine = fullLine && fullLine !== clickedWord;
                if (showFullLine) {
                    const result = await xCachedTranslate(fullLine, targetLang);
                    fullTranslated = result.translated;
                }

                const html = buildXTooltipHtml(
                    srcLang,
                    targetLang,
                    clickedWord,
                    wordTranslated,
                    showFullLine ? fullLine : null,
                    fullTranslated,
                );

                showTooltip(html, rect);
                attachXTooltipHandlers();
            } catch (err) {
                console.error("[Quick Translator – X click]", err);
                showTooltip(
                    `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                    rect,
                );
            }
        }

        // ── Event delegation on tweet text ──
        let xLastHoveredWord = null;

        document.addEventListener(
            "mouseover",
            (e) => {
                const wordSpan = e.target.closest?.(`.${PREFIX}x-word`);
                if (wordSpan && wordSpan !== xLastHoveredWord) {
                    if (xLastHoveredWord) {
                        xLastHoveredWord.classList.remove(
                            `${PREFIX}x-word-hover`,
                        );
                    }
                    xLastHoveredWord = wordSpan;
                    wordSpan.classList.add(`${PREFIX}x-word-hover`);
                    handleXWordHover(wordSpan);
                }
            },
            true,
        );

        document.addEventListener(
            "mouseout",
            (e) => {
                const wordSpan = e.target.closest?.(`.${PREFIX}x-word`);
                if (wordSpan) {
                    wordSpan.classList.remove(`${PREFIX}x-word-hover`);
                    if (xLastHoveredWord === wordSpan) xLastHoveredWord = null;
                    handleXWordLeave();
                }
            },
            true,
        );

        document.addEventListener(
            "click",
            (e) => {
                const wordSpan = e.target.closest?.(`.${PREFIX}x-word`);
                if (wordSpan) {
                    handleXWordClick(wordSpan, e);
                }
            },
            true,
        );

        // ── Process tweets: inject TTS button + split text into words ──
        function processXPosts() {
            document.querySelectorAll("article").forEach((article) => {
                injectXSpeakButton(article);
                const textEl = article.querySelector(
                    '[data-testid="tweetText"]',
                );
                if (textEl) {
                    xSplitTextIntoWords(textEl);
                }
            });
        }

        // Observe for new tweets (infinite scroll, navigation)
        function observeXPosts() {
            const observer = new MutationObserver(() => {
                processXPosts();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            processXPosts();
        }

        // Start observing
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                observeXPosts();
                showXHint(
                    "Najedź na słowo = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
                );
            });
        } else {
            observeXPosts();
            showXHint(
                "Najedź na słowo = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
            );
        }

        // X.com is a SPA – re-process on URL changes
        let xLastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== xLastUrl) {
                xLastUrl = location.href;
                xTranslateCache.clear();
                setTimeout(processXPosts, 1000);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ══════════════════════════════════════════════════════════════
    // ── Keyboard Subtitle/Sentence Navigation (all videos) ───────
    // ══════════════════════════════════════════════════════════════
    // A / ← = previous sentence
    // D / → = next sentence
    // W / ↑ = play/pause toggle
    // S / ↓ = repeat current sentence
    // E = show translation of current subtitle

    (function setupSubtitleNavigation() {
        const FALLBACK_SKIP = 5; // seconds to skip when no cues available

        /** Find the most relevant <video> on the page */
        function getActiveVideo() {
            const videos = document.querySelectorAll("video");
            if (videos.length === 0) return null;
            if (videos.length === 1) return videos[0];
            // Prefer a currently playing video
            for (const v of videos) {
                if (!v.paused && v.readyState >= 2) return v;
            }
            // Otherwise return the largest by area (most likely the main player)
            let best = videos[0];
            let bestArea = 0;
            videos.forEach((v) => {
                const area =
                    v.videoWidth * v.videoHeight ||
                    v.clientWidth * v.clientHeight;
                if (area > bestArea) {
                    bestArea = area;
                    best = v;
                }
            });
            return best;
        }

        /** Collect all cues from active/showing text tracks, sorted by startTime */
        function getAllCues(video) {
            if (!video || !video.textTracks) return [];
            const cues = [];
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (track.mode === "disabled") continue;
                if (!track.cues) continue;
                for (let j = 0; j < track.cues.length; j++) {
                    cues.push(track.cues[j]);
                }
            }
            // De-duplicate by startTime and sort
            const seen = new Set();
            const unique = cues.filter((c) => {
                const key = `${c.startTime.toFixed(3)}-${c.endTime.toFixed(3)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            unique.sort((a, b) => a.startTime - b.startTime);
            return unique;
        }

        /** Find the index of the cue at or just before currentTime */
        function getCurrentCueIndex(cues, currentTime) {
            let idx = 0;
            for (let i = cues.length - 1; i >= 0; i--) {
                if (currentTime >= cues[i].startTime - 0.05) {
                    idx = i;
                    break;
                }
            }
            return idx;
        }

        /** Get the current on-screen subtitle text (from DOM or textTrack cues) */
        function getCurrentSubtitleText(video) {
            // 1. Try YouTube caption segments
            const ytSegs = document.querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            );
            if (ytSegs.length > 0) {
                return Array.from(ytSegs)
                    .map((s) => s.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            }
            // 2. Try Netflix subtitles
            const nfSpans = document.querySelectorAll(
                ".player-timedtext-text-container span",
            );
            if (nfSpans.length > 0) {
                return Array.from(nfSpans)
                    .map((s) => s.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            }
            // 3. Try video.js / LookMovie subtitles
            const vjsCues = document.querySelectorAll(
                ".vjs-text-track-cue div",
            );
            if (vjsCues.length > 0) {
                return Array.from(vjsCues)
                    .map((d) => d.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            }
            // 4. Fallback: active cue from textTracks API
            if (video && video.textTracks) {
                for (let i = 0; i < video.textTracks.length; i++) {
                    const track = video.textTracks[i];
                    if (track.mode === "disabled" || !track.activeCues)
                        continue;
                    for (let j = 0; j < track.activeCues.length; j++) {
                        const text = track.activeCues[j].text;
                        if (text && text.trim()) return text.trim();
                    }
                }
            }
            return null;
        }

        /** State for E-key subtitle translation toggle */
        let eTranslateActive = false;
        let eOriginalContents = []; // [{el, html}]
        let eWasPlaying = false;

        /** Get all visible subtitle DOM elements */
        function getSubtitleElements() {
            // YouTube
            let els = document.querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            );
            if (els.length > 0) return Array.from(els);
            // Netflix
            els = document.querySelectorAll(
                ".player-timedtext-text-container span",
            );
            if (els.length > 0) return Array.from(els);
            // video.js / LookMovie
            els = document.querySelectorAll(".vjs-text-track-cue div");
            if (els.length > 0)
                return Array.from(els).filter(
                    (d) => d.textContent.trim() && !d.querySelector("div"),
                );
            return [];
        }

        /** Replace subtitle text with word-by-word animated translation */
        function applyTranslation(translatedText) {
            const subEls = getSubtitleElements();
            if (subEls.length === 0) return;
            // Save originals
            eOriginalContents = subEls.map((el) => ({
                el,
                html: el.innerHTML,
            }));
            // Build word-by-word HTML
            const words = translatedText.split(/\s+/);
            const wordHTML = words
                .map(
                    (w, i) =>
                        `<span class="${PREFIX}sub-word" style="animation-delay:${i * 0.07}s">${w}</span>`,
                )
                .join(" ");
            // Put translated text into first subtitle element, clear others
            subEls.forEach((el, idx) => {
                el.classList.add(PREFIX + "sub-translated");
                if (idx === 0) {
                    el.innerHTML = wordHTML;
                } else {
                    el.innerHTML = "";
                }
            });
            eTranslateActive = true;
        }

        /** Restore original subtitle text */
        function restoreOriginal() {
            for (const { el, html } of eOriginalContents) {
                el.classList.remove(PREFIX + "sub-translated");
                el.innerHTML = html;
            }
            eOriginalContents = [];
            eTranslateActive = false;
        }

        document.addEventListener(
            "keydown",
            (e) => {
                // Don't interfere with text inputs
                const tag = e.target.tagName;
                if (
                    tag === "INPUT" ||
                    tag === "TEXTAREA" ||
                    tag === "SELECT" ||
                    e.target.isContentEditable
                )
                    return;

                const key = e.key;
                const isNavKey =
                    key === "a" ||
                    key === "A" ||
                    key === "ArrowLeft" ||
                    key === "d" ||
                    key === "D" ||
                    key === "ArrowRight" ||
                    key === "w" ||
                    key === "W" ||
                    key === "ArrowUp" ||
                    key === "s" ||
                    key === "S" ||
                    key === "ArrowDown" ||
                    key === "e" ||
                    key === "E" ||
                    key === "Enter";

                if (!isNavKey) return;

                const video = getActiveVideo();
                if (!video) return;

                e.preventDefault();
                e.stopPropagation();

                // ── E = toggle subtitle translation in-place ──
                if (key === "e" || key === "E" || key === "Enter") {
                    if (eTranslateActive) {
                        // Second press: restore original + resume
                        restoreOriginal();
                        if (eWasPlaying) video.play();
                        eWasPlaying = false;
                        return;
                    }

                    // Capture subtitle text IMMEDIATELY (before pause can remove DOM elements)
                    const immediateText = getCurrentSubtitleText(video);
                    const capturedTime = video.currentTime;

                    // Pause video
                    eWasPlaying = !video.paused;
                    video.pause();

                    /** Find subtitle text by trying multiple strategies */
                    function resolveSubtitleText() {
                        // Strategy 1: text captured before pause (most reliable)
                        if (immediateText) return immediateText;

                        // Strategy 2: try DOM again after pause
                        const postPauseText = getCurrentSubtitleText(video);
                        if (postPauseText) return postPauseText;

                        // Strategy 3: find cue from textTracks by captured timestamp
                        const cues = getAllCues(video);
                        if (cues.length > 0) {
                            // Find a cue that contains the captured time
                            for (const cue of cues) {
                                if (
                                    capturedTime >= cue.startTime - 0.1 &&
                                    capturedTime <= cue.endTime + 0.1
                                ) {
                                    const t = cue.text?.trim();
                                    if (t) return t;
                                }
                            }
                            // Fallback: nearest cue before captured time
                            const idx = getCurrentCueIndex(cues, capturedTime);
                            const t = cues[idx]?.text?.trim();
                            if (t) return t;
                        }

                        return null;
                    }

                    // Small delay so DOM/cues settle, then translate
                    setTimeout(() => {
                        const subText = resolveSubtitleText();
                        if (!subText) {
                            // No subtitle found – resume if was playing
                            if (eWasPlaying) video.play();
                            eWasPlaying = false;
                            return;
                        }
                        getTargetLang().then((targetLang) => {
                            googleTranslate(subText, targetLang).then(
                                (result) => {
                                    applyTranslation(result.translated);
                                },
                            );
                        });
                    }, 30);
                    return;
                }

                const cues = getAllCues(video);
                const hasCues = cues.length > 0;

                // ── W / ArrowUp = toggle play/pause ──
                if (key === "w" || key === "W" || key === "ArrowUp") {
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                    return;
                }

                // ── S / ArrowDown = repeat current sentence ──
                if (key === "s" || key === "S" || key === "ArrowDown") {
                    if (hasCues) {
                        const idx = getCurrentCueIndex(cues, video.currentTime);
                        video.currentTime = cues[idx].startTime;
                    } else {
                        video.currentTime = Math.max(0, video.currentTime - 3);
                    }
                    if (video.paused) video.play();
                    return;
                }

                // ── A / ArrowLeft = previous sentence ──
                if (key === "a" || key === "A" || key === "ArrowLeft") {
                    if (hasCues) {
                        const idx = getCurrentCueIndex(cues, video.currentTime);
                        if (
                            video.currentTime - cues[idx].startTime > 1.5 &&
                            idx >= 0
                        ) {
                            video.currentTime = cues[idx].startTime;
                        } else {
                            const prevIdx = Math.max(0, idx - 1);
                            video.currentTime = cues[prevIdx].startTime;
                        }
                    } else {
                        video.currentTime = Math.max(
                            0,
                            video.currentTime - FALLBACK_SKIP,
                        );
                    }
                    if (video.paused) video.play();
                    return;
                }

                // ── D / ArrowRight = next sentence ──
                if (key === "d" || key === "D" || key === "ArrowRight") {
                    if (hasCues) {
                        const idx = getCurrentCueIndex(cues, video.currentTime);
                        const nextIdx = Math.min(cues.length - 1, idx + 1);
                        video.currentTime = cues[nextIdx].startTime;
                    } else {
                        video.currentTime = Math.min(
                            video.duration || Infinity,
                            video.currentTime + FALLBACK_SKIP,
                        );
                    }
                    if (video.paused) video.play();
                    return;
                }
            },
            true, // capture phase – intercept before site's own handlers
        );
    })();
})();
