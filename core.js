/**
 * Quick Translator – Core Module
 * Shared constants, utilities, UI, translation, TTS, storage,
 * and reusable subtitle helpers used by all site-specific modules.
 *
 * Exposes: window.QT
 */
(() => {
    "use strict";

    // ── Constants ──────────────────────────────────────────────────
    const PREFIX = "__qt_";
    const ICON_ID = PREFIX + "icon";
    const TOOLTIP_ID = PREFIX + "tooltip";

    // ── SVG Icons ──────────────────────────────────────────────────
    const SVG = {
        TRANSLATE: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`,
        SPEAKER: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
        SAVE: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        SAVE_CHECK: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#4ecdc4" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        SAVE_SENTENCE: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        SAVE_SENTENCE_CHECK: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#4ecdc4" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        READ: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
        SPEAKER_FULL: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    };

    // ── Language Names ─────────────────────────────────────────────
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

    // ── Pre-load Voices ────────────────────────────────────────────
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }

    // ── Internal State ─────────────────────────────────────────────
    let tooltipEl = null;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let elAudioEl = null;

    const cleanupHandlers = [];
    const dismissHandlers = [];

    // ── Review-due toast notification ──────────────────────────────
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "QT_REVIEW_DUE" && msg.count > 0) {
            showReviewDueToast(msg.count);
        }
    });

    function showReviewDueToast(count) {
        // Don't duplicate
        const existing = document.getElementById(PREFIX + "review_toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = PREFIX + "review_toast";
        toast.innerHTML = `<span style="margin-right:6px">🧠</span> ${count === 1 ? "Pojawiła się powtórka!" : `Pojawiły się ${count} powtórki!`}`;
        document.body.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add(PREFIX + "toast_visible");
            });
        });

        // Auto-dismiss after 4s
        setTimeout(() => {
            toast.classList.remove(PREFIX + "toast_visible");
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    document.addEventListener("mousemove", (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    // ═══════════════════════════════════════════════════════════════
    //  Utility Functions
    // ═══════════════════════════════════════════════════════════════

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

    /** Strip [bracketed] content (e.g. [Applause], [Music]) */
    function stripBrackets(text) {
        return text
            .replace(/\[.*?\]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    /** Clean text for TTS – remove symbols that are read aloud */
    function cleanTextForTTS(text) {
        return text
            .replace(/#/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    /** Check if a DOM element is part of our UI */
    function isOwnUI(target) {
        return !!target?.closest?.(`#${ICON_ID}, #${TOOLTIP_ID}`);
    }

    // ═══════════════════════════════════════════════════════════════
    //  UI – Overlay Parent
    // ═══════════════════════════════════════════════════════════════

    /**
     * Returns the best parent for overlay UI.
     * In fullscreen, the browser only renders children of the fullscreen element.
     */
    function getOverlayParent() {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.body
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  UI – Tooltip
    // ═══════════════════════════════════════════════════════════════

    function getTooltip() {
        if (tooltipEl) {
            const parent = getOverlayParent();
            if (tooltipEl.parentElement !== parent)
                parent.appendChild(tooltipEl);
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
            if (top < 4) top = rect.bottom + gap;

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
            if (top < scrollY + 4) top = rect.bottom + scrollY + gap;

            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
        }

        requestAnimationFrame(() => tip.classList.add("visible"));
    }

    function hideTooltip() {
        if (!tooltipEl) return;
        tooltipEl.classList.remove("visible");
        setTimeout(() => {
            if (tooltipEl) tooltipEl.innerHTML = "";
        }, 180);
    }

    function showLoading(rect) {
        showTooltip(
            `<div class="${PREFIX}loading"><div class="${PREFIX}spinner"></div></div>`,
            rect,
        );
    }

    /** Hide all UI: tooltip + registered cleanup handlers */
    function hideAll() {
        hideTooltip();
        cleanupHandlers.forEach((fn) => fn());
    }

    // ═══════════════════════════════════════════════════════════════
    //  Dismiss & Cleanup Registration
    // ═══════════════════════════════════════════════════════════════

    function addCleanup(fn) {
        cleanupHandlers.push(fn);
    }
    function addDismissHandler(fn) {
        dismissHandlers.push(fn);
    }
    function runDismiss() {
        dismissHandlers.forEach((fn) => fn());
    }

    // ═══════════════════════════════════════════════════════════════
    //  Google Translate (free, no key)
    // ═══════════════════════════════════════════════════════════════

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

        const translated = data[0].map((s) => s[0]).join("");
        const detectedLang = data[2] || "auto";
        return { translated, detectedLang };
    }

    // ═══════════════════════════════════════════════════════════════
    //  Translation Cache Factory
    // ═══════════════════════════════════════════════════════════════

    function createTranslateCache(maxSize = 200) {
        const cache = new Map();
        return {
            async get(text, targetLang) {
                const key = `${text}|${targetLang}`;
                if (cache.has(key)) return cache.get(key);
                const result = await googleTranslate(text, targetLang);
                cache.set(key, result);
                if (cache.size > maxSize)
                    cache.delete(cache.keys().next().value);
                return result;
            },
            clear() {
                cache.clear();
            },
            get size() {
                return cache.size;
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  TTS – Voice Selection
    // ═══════════════════════════════════════════════════════════════

    /**
     * Pick the best available voice.
     * Priority: user-saved > natural/neural > Google > remote > any
     */
    function pickBestVoice(savedVoiceName, lang) {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;

        if (savedVoiceName) {
            const exact = voices.find((v) => v.name === savedVoiceName);
            if (exact) return exact;
        }

        const baseLang = (lang || "en").split("-")[0].toLowerCase();
        const langVoices = voices.filter((v) =>
            v.lang.toLowerCase().startsWith(baseLang),
        );
        if (!langVoices.length) return null;

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

        return langVoices.find((v) => !v.localService) || langVoices[0];
    }

    // ═══════════════════════════════════════════════════════════════
    //  TTS – ElevenLabs
    // ═══════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════
    //  TTS – Unified (Browser or ElevenLabs)
    // ═══════════════════════════════════════════════════════════════

    function speak(text, lang) {
        window.speechSynthesis.cancel();
        if (elAudioEl) {
            elAudioEl.pause();
            elAudioEl = null;
        }

        return new Promise((resolve) => {
            if (!chrome?.storage?.sync) {
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
                        resolve(
                            await speakElevenLabs(
                                text,
                                data.elApiKey,
                                data.elVoiceId,
                            ),
                        );
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

    // ═══════════════════════════════════════════════════════════════
    //  Storage
    // ═══════════════════════════════════════════════════════════════

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

    function saveWord(entry) {
        if (!chrome?.storage?.local) return;
        chrome.storage.local.get({ savedWords: [] }, (data) => {
            const words = data.savedWords || [];
            const exists = words.some(
                (w) =>
                    w.original === entry.original &&
                    w.translated === entry.translated,
            );
            if (!exists) {
                // Attach spaced-repetition metadata
                if (!entry.sr) {
                    entry.sr = {
                        step: 0, // position in interval ladder
                        interval: 0, // current interval in days
                        nextReview: Date.now(), // due immediately
                        lastReview: null,
                    };
                }
                entry.updatedAt = Date.now();
                words.push(entry);
                chrome.storage.local.set({ savedWords: words });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Shared Tooltip HTML Builder
    // ═══════════════════════════════════════════════════════════════

    /**
     * Build a standard translation tooltip.
     * @param {Object} opts
     * @param {string} opts.srcLang       - detected source language code
     * @param {string} opts.targetLang    - target language code
     * @param {string} opts.original      - original word/phrase
     * @param {string} opts.translated    - translated word/phrase
     * @param {string|null} opts.fullLine        - full sentence (original)
     * @param {string|null} opts.fullTranslated  - full sentence (translated)
     * @param {boolean} opts.speakFullLine       - show speak buttons on full-line rows
     */
    function buildTooltipHtml({
        srcLang,
        targetLang,
        original,
        translated,
        fullLine = null,
        fullTranslated = null,
        speakFullLine = false,
    }) {
        const P = PREFIX;
        const cleanFullLine = fullLine ? stripBrackets(fullLine) : "";
        const cleanFullTranslated = fullTranslated
            ? stripBrackets(fullTranslated)
            : "";

        // Full-line section (sentence context)
        let fullLineHtml = "";
        if (fullLine && fullTranslated && cleanFullLine) {
            const speakOrig = speakFullLine
                ? `<button class="${P}speak" data-text="${escapeAttr(cleanFullLine)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj zdanie">${SVG.SPEAKER}</button>`
                : "";
            const speakTrans = speakFullLine
                ? `<button class="${P}speak" data-text="${escapeAttr(cleanFullTranslated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie zdania">${SVG.SPEAKER}</button>`
                : "";

            fullLineHtml = `
                <div class="${P}row" style="margin-top:6px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                    <span class="${P}label">ALL</span>
                    <span class="${P}text ${P}original" style="font-size:12px;">${escapeHtml(cleanFullLine)}</span>
                    ${speakOrig}
                </div>
                <div class="${P}row">
                    <span class="${P}label"></span>
                    <span class="${P}text ${P}translated" style="font-size:12px;">${escapeHtml(cleanFullTranslated)}</span>
                    ${speakTrans}
                </div>`;
        }

        // Save-sentence button (only if we have a sentence)
        const saveSentenceBtn = cleanFullLine
            ? `<button class="${P}save-sentence-btn"
                    data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}"
                    data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}"
                    data-sentence="${escapeAttr(cleanFullLine)}"
                    data-sentence-translated="${escapeAttr(cleanFullTranslated)}"
                    title="Zapisz zdanie">${SVG.SAVE_SENTENCE}</button>`
            : "";

        return `
            <div class="${P}header">
                <span>${langTag(srcLang)} → ${langTag(targetLang)}</span>
                <div style="display:flex;align-items:center;">
                    <button class="${P}save-btn"
                        data-src="${escapeAttr(original)}" data-translated="${escapeAttr(translated)}"
                        data-src-lang="${escapeAttr(srcLang)}" data-tgt-lang="${escapeAttr(targetLang)}"
                        title="Zapisz słowo">${SVG.SAVE}</button>
                    ${saveSentenceBtn}
                </div>
            </div>
            <div class="${P}body">
                <div class="${P}row">
                    <span class="${P}label">${langTag(srcLang)}</span>
                    <span class="${P}text ${P}original">${escapeHtml(original)}</span>
                    <button class="${P}speak" data-text="${escapeAttr(original)}" data-lang="${escapeAttr(srcLang)}" title="Odczytaj oryginał">${SVG.SPEAKER}</button>
                </div>
                <div class="${P}row">
                    <span class="${P}label">${langTag(targetLang)}</span>
                    <span class="${P}text ${P}translated">${escapeHtml(translated)}</span>
                    <button class="${P}speak" data-text="${escapeAttr(translated)}" data-lang="${escapeAttr(targetLang)}" title="Odczytaj tłumaczenie">${SVG.SPEAKER}</button>
                </div>
                ${fullLineHtml}
            </div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Shared Tooltip Handler Attacher
    // ═══════════════════════════════════════════════════════════════

    /** Attach TTS + save handlers to all buttons in the current tooltip */
    function attachTooltipHandlers() {
        if (!tooltipEl) return;

        // TTS speak buttons
        tooltipEl.querySelectorAll(`.${PREFIX}speak`).forEach((btn) => {
            btn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                btn.classList.add("speaking");
                speak(btn.dataset.text, btn.dataset.lang).then((result) => {
                    const onDone = () => btn.classList.remove("speaking");
                    if (result && typeof result.onend !== "undefined") {
                        result.onend = onDone;
                        result.onerror = onDone;
                    } else if (result instanceof HTMLAudioElement) {
                        result.onended = onDone;
                        result.onerror = onDone;
                    }
                });
            });
        });

        // Save word button
        const saveBtn = tooltipEl.querySelector(`.${PREFIX}save-btn`);
        if (saveBtn) {
            saveBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                saveWord({
                    original: saveBtn.dataset.src,
                    translated: saveBtn.dataset.translated,
                    srcLang: saveBtn.dataset.srcLang,
                    tgtLang: saveBtn.dataset.tgtLang,
                    sentence: "",
                    sentenceTranslated: "",
                    url: window.location.href,
                    timestamp: Date.now(),
                    downloaded: false,
                });
                saveBtn.innerHTML = SVG.SAVE_CHECK;
                saveBtn.classList.add("saved");
            });
        }

        // Save sentence button
        const saveSentenceBtn = tooltipEl.querySelector(
            `.${PREFIX}save-sentence-btn`,
        );
        if (saveSentenceBtn) {
            saveSentenceBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                saveWord({
                    original: saveSentenceBtn.dataset.src,
                    translated: saveSentenceBtn.dataset.translated,
                    srcLang: saveSentenceBtn.dataset.srcLang,
                    tgtLang: saveSentenceBtn.dataset.tgtLang,
                    sentence: saveSentenceBtn.dataset.sentence || "",
                    sentenceTranslated:
                        saveSentenceBtn.dataset.sentenceTranslated || "",
                    url: window.location.href,
                    timestamp: Date.now(),
                    downloaded: false,
                });
                saveSentenceBtn.innerHTML = SVG.SAVE_SENTENCE_CHECK;
                saveSentenceBtn.classList.add("saved");
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Subtitle – Buffer Factory
    // ═══════════════════════════════════════════════════════════════

    /**
     * Creates a subtitle history buffer.
     * Accumulates subtitle text over time for sentence extraction.
     */
    function createSubtitleBuffer(maxSize = 3000, keepSize = 2000) {
        let buffer = "";
        let lastSegment = "";

        return {
            /** Append new subtitle text, de-duplicating overlaps */
            append(text) {
                const trimmed = text.trim();
                if (!trimmed || trimmed === lastSegment) return;
                if (buffer.endsWith(trimmed)) return;

                let overlap = 0;
                const maxOvl = Math.min(trimmed.length, buffer.length);
                for (let i = 1; i <= maxOvl; i++) {
                    if (buffer.endsWith(trimmed.substring(0, i))) overlap = i;
                }

                const newPart = trimmed.substring(overlap);
                if (newPart) {
                    buffer +=
                        (buffer && !buffer.endsWith(" ") ? " " : "") + newPart;
                }
                lastSegment = trimmed;

                if (buffer.length > maxSize) {
                    buffer = buffer.substring(buffer.length - keepSize);
                }
            },

            /** Extract the sentence containing the given word */
            extractSentence(word) {
                const idx = buffer.lastIndexOf(word);
                if (idx === -1) return null;

                const enders = /[.!?…]/;
                let start = 0;
                for (let i = idx - 1; i >= 0; i--) {
                    if (enders.test(buffer[i])) {
                        start = i + 1;
                        break;
                    }
                }
                let end = buffer.length;
                for (let i = idx + word.length; i < buffer.length; i++) {
                    if (enders.test(buffer[i])) {
                        end = i + 1;
                        break;
                    }
                }

                const sentence = buffer.substring(start, end).trim();
                return sentence.length > word.length + 2 ? sentence : null;
            },

            clear() {
                buffer = "";
                lastSegment = "";
            },
            get text() {
                return buffer;
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  Subtitle – Word Splitter
    // ═══════════════════════════════════════════════════════════════

    /** Split an element's text content into individual clickable word spans */
    function splitIntoWordSpans(el, wordClass) {
        const text = el.textContent;
        if (!text.trim()) return;
        el.textContent = "";

        const parts = text.match(/\S+|\s+/g) || [];
        for (const part of parts) {
            if (/\S/.test(part)) {
                const span = document.createElement("span");
                span.className = wordClass;
                span.textContent = part;
                el.appendChild(span);
            } else {
                el.appendChild(document.createTextNode(part));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Subtitle – Hint Factory
    // ═══════════════════════════════════════════════════════════════

    /** Create a popup hint element (e.g. "hover on a word to translate") */
    function createHint(className, getParent) {
        let el = null;
        let timer = null;
        const parentFn = getParent || (() => document.body);

        return {
            show(msg, duration = 4000) {
                if (!el) {
                    el = document.createElement("div");
                    el.className = className;
                    parentFn().appendChild(el);
                }
                const parent = parentFn();
                if (el.parentElement !== parent) parent.appendChild(el);

                el.textContent = msg;
                el.classList.add("visible");
                clearTimeout(timer);
                timer = setTimeout(
                    () => el.classList.remove("visible"),
                    duration,
                );
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  Subtitle – Find Word at Point
    // ═══════════════════════════════════════════════════════════════

    /**
     * Find a word span at screen coordinates using elementsFromPoint.
     * Works through invisible overlay divs (Netflix, LookMovie, etc.)
     */
    function findWordAtPoint(x, y, wordClass) {
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
            if (el.classList?.contains(wordClass)) return el;
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Video Control Helpers
    // ═══════════════════════════════════════════════════════════════

    function getVideo() {
        return document.querySelector("video");
    }

    /** Pause the video if playing. Returns true if it was playing. */
    function pauseVideo() {
        const v = getVideo();
        if (v && !v.paused) {
            v.pause();
            return true;
        }
        return false;
    }

    /** Resume the video if it's paused. */
    function resumeVideo() {
        const v = getVideo();
        if (v && v.paused) v.play();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Expose Global Namespace
    // ═══════════════════════════════════════════════════════════════

    window.QT = {
        // Constants
        PREFIX,
        ICON_ID,
        TOOLTIP_ID,
        SVG,

        // Utilities
        escapeHtml,
        escapeAttr,
        stripBrackets,
        cleanTextForTTS,
        langTag,
        isOwnUI,

        // UI
        getOverlayParent,
        showTooltip,
        hideTooltip,
        hideAll,
        showLoading,
        getTooltipEl: () => tooltipEl,
        getMousePos: () => ({ x: lastMouseX, y: lastMouseY }),

        // Translation
        translate: googleTranslate,
        createTranslateCache,

        // TTS
        speak,
        pickBestVoice,
        getElAudioEl: () => elAudioEl,
        setElAudioEl: (v) => {
            elAudioEl = v;
        },

        // Storage
        getTargetLang,
        saveWord,

        // Tooltip
        buildTooltipHtml,
        attachTooltipHandlers,

        // Subtitle utilities
        createSubtitleBuffer,
        splitIntoWordSpans,
        createHint,
        findWordAtPoint,

        // Cleanup & dismiss
        addCleanup,
        addDismissHandler,
        runDismiss,

        // Video
        getVideo,
        pauseVideo,
        resumeVideo,
    };
})();
