/**
 * Quick Translator – X.com (Twitter) Module
 * Word-level hover/click translate on tweets, TTS speak button,
 * and inline post translation.
 *
 * Depends on: core.js (window.QT)
 */
(() => {
    "use strict";
    if (!/^(x\.com|twitter\.com)$/.test(window.location.hostname)) return;

    const {
        PREFIX,
        SVG,
        showTooltip,
        hideTooltip,
        showLoading,
        speak,
        getTargetLang,
        escapeHtml,
        escapeAttr,
        langTag,
        buildTooltipHtml,
        attachTooltipHandlers,
        createTranslateCache,
        createHint,
        addDismissHandler,
        getElAudioEl,
        setElAudioEl,
    } = QT;

    // ── Shared instances ───────────────────────────────────────────
    const cache = createTranslateCache(300);
    const hint = createHint(`${PREFIX}x-sub-hint`);

    const WORD_CLASS = `${PREFIX}x-word`;
    const LOG = "[Quick Translator – X]";

    // ── State ──────────────────────────────────────────────────────
    let hoverTimer = null;
    let isHovering = false;
    let clickLocked = false;
    let lastHoveredWord = null;
    let currentSpeakingBtn = null;

    // ── Dismiss ────────────────────────────────────────────────────
    function dismiss() {
        if (!clickLocked) return;
        clickLocked = false;
        hideTooltip();
    }
    addDismissHandler(dismiss);

    // ── Tweet text extraction ──────────────────────────────────────
    function getPostText(article) {
        const textEl = article.querySelector('[data-testid="tweetText"]');
        return textEl ? textEl.innerText.trim() : "";
    }

    function extractSentence(fullText, word) {
        const idx = fullText.lastIndexOf(word);
        if (idx === -1) return fullText;

        const enders = /[.!?…\n]/;
        let start = 0;
        for (let i = idx - 1; i >= 0; i--) {
            if (enders.test(fullText[i])) {
                start = i + 1;
                break;
            }
        }
        let end = fullText.length;
        for (let i = idx + word.length; i < fullText.length; i++) {
            if (enders.test(fullText[i])) {
                end = i + 1;
                break;
            }
        }

        const sentence = fullText.substring(start, end).trim();
        return sentence.length > word.length + 2 ? sentence : fullText;
    }

    // ── Hover handler ──────────────────────────────────────────────
    async function handleWordHover(wordSpan) {
        if (clickLocked) return;
        isHovering = true;
        clearTimeout(hoverTimer);

        const word = wordSpan.textContent.trim();
        if (!word || word.length > 60) return;

        const rect = wordSpan.getBoundingClientRect();

        hoverTimer = setTimeout(async () => {
            if (!isHovering) return;
            showLoading(rect);

            try {
                const targetLang = await getTargetLang();
                const { translated, detectedLang } = await cache.get(
                    word,
                    targetLang,
                );
                const srcLang =
                    typeof detectedLang === "string" ? detectedLang : "auto";

                if (!isHovering) return;

                showTooltip(
                    buildTooltipHtml({
                        srcLang,
                        targetLang,
                        original: word,
                        translated,
                    }),
                    rect,
                );
                attachTooltipHandlers();
            } catch (err) {
                console.error(LOG + " hover", err);
                showTooltip(
                    `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                    rect,
                );
            }
        }, 300);
    }

    function handleWordLeave() {
        isHovering = false;
        clearTimeout(hoverTimer);
        if (clickLocked) return;

        setTimeout(() => {
            if (
                !isHovering &&
                !clickLocked &&
                !QT.getTooltipEl()?.matches(":hover")
            ) {
                hideTooltip();
            }
        }, 400);
    }

    // ── Click handler ──────────────────────────────────────────────
    async function handleWordClick(wordSpan, e) {
        e.stopPropagation();
        e.preventDefault();
        clearTimeout(hoverTimer);
        clickLocked = true;

        const word = wordSpan.textContent.trim();
        if (!word) return;

        const article = wordSpan.closest("article");
        const fullText = article ? getPostText(article) : word;
        const fullLine = extractSentence(fullText, word);

        const rect = wordSpan.getBoundingClientRect();
        showLoading(rect);

        try {
            const targetLang = await getTargetLang();
            const { translated: wordTranslated, detectedLang } =
                await cache.get(word, targetLang);
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            speak(word, srcLang);

            let fullTranslated = null;
            const showFullLine = fullLine && fullLine !== word;
            if (showFullLine)
                fullTranslated = (await cache.get(fullLine, targetLang))
                    .translated;

            showTooltip(
                buildTooltipHtml({
                    srcLang,
                    targetLang,
                    original: word,
                    translated: wordTranslated,
                    fullLine: showFullLine ? fullLine : null,
                    fullTranslated,
                    speakFullLine: true,
                }),
                rect,
            );
            attachTooltipHandlers();
        } catch (err) {
            console.error(LOG + " click", err);
            showTooltip(
                `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                rect,
            );
        }
    }

    // ── Event delegation for word hover/click ──────────────────────

    document.addEventListener(
        "mouseover",
        (e) => {
            const w = e.target.closest?.(`.${WORD_CLASS}`);
            if (w && w !== lastHoveredWord) {
                if (lastHoveredWord)
                    lastHoveredWord.classList.remove(`${PREFIX}x-word-hover`);
                lastHoveredWord = w;
                w.classList.add(`${PREFIX}x-word-hover`);
                handleWordHover(w);
            }
        },
        true,
    );

    document.addEventListener(
        "mouseout",
        (e) => {
            const w = e.target.closest?.(`.${WORD_CLASS}`);
            if (w) {
                w.classList.remove(`${PREFIX}x-word-hover`);
                if (lastHoveredWord === w) lastHoveredWord = null;
                handleWordLeave();
            }
        },
        true,
    );

    document.addEventListener(
        "click",
        (e) => {
            const w = e.target.closest?.(`.${WORD_CLASS}`);
            if (w) handleWordClick(w, e);
        },
        true,
    );

    // ═══════════════════════════════════════════════════════════════
    //  TTS Speak Button (tweet header)
    // ═══════════════════════════════════════════════════════════════

    function stopSpeaking() {
        window.speechSynthesis.cancel();
        const audio = getElAudioEl();
        if (audio) {
            audio.pause();
            setElAudioEl(null);
        }
        if (currentSpeakingBtn) {
            currentSpeakingBtn.classList.remove(`${PREFIX}x-speaking`);
            currentSpeakingBtn = null;
        }
    }

    function onSpeakClick(e) {
        e.stopPropagation();
        e.preventDefault();
        const btn = e.currentTarget;
        const article = btn.closest("article");
        if (!article) return;

        if (btn.classList.contains(`${PREFIX}x-speaking`)) {
            stopSpeaking();
            return;
        }
        stopSpeaking();

        const text = getPostText(article);
        if (!text) return;

        btn.classList.add(`${PREFIX}x-speaking`);
        currentSpeakingBtn = btn;

        speak(text, document.documentElement.lang || "en").then((result) => {
            const onDone = () => {
                btn.classList.remove(`${PREFIX}x-speaking`);
                if (currentSpeakingBtn === btn) currentSpeakingBtn = null;
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

    // ═══════════════════════════════════════════════════════════════
    //  Translate Post Button (inline translation below tweet)
    // ═══════════════════════════════════════════════════════════════

    async function onTranslateClick(e) {
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
            const { translated, detectedLang } = await cache.get(
                text,
                targetLang,
            );
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            const div = document.createElement("div");
            div.className = `${PREFIX}x-post-translation`;
            div.innerHTML = `
                <div class="${PREFIX}x-trans-label">${langTag(srcLang)} → ${langTag(targetLang)}</div>
                <div>${escapeHtml(translated)}</div>`;

            textEl.parentElement.insertBefore(div, textEl.nextSibling);
            btn.classList.remove(`${PREFIX}x-translating`);
            btn.classList.add(`${PREFIX}x-translated-active`);
        } catch (err) {
            console.error(LOG + " translate post", err);
            btn.classList.remove(`${PREFIX}x-translating`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Tweet Processing – Inject Buttons + Split Text
    // ═══════════════════════════════════════════════════════════════

    function injectButtons(article) {
        if (article.dataset[PREFIX + "xSpeak"]) return;
        article.dataset[PREFIX + "xSpeak"] = "1";
        if (!getPostText(article)) return;

        const headerRow =
            article
                .querySelector('[aria-label="Grok actions"]')
                ?.closest(
                    '[class*="r-1awozwy"][class*="r-18u37iz"][class*="r-1cmwbt1"]',
                ) ||
            article
                .querySelector('[data-testid="caret"]')
                ?.closest(
                    '[class*="r-1awozwy"][class*="r-18u37iz"][class*="r-1cmwbt1"]',
                );
        if (!headerRow) return;

        const translateBtn = document.createElement("button");
        translateBtn.className = `${PREFIX}x-translate-btn`;
        translateBtn.title = "Przetłumacz posta";
        translateBtn.innerHTML = SVG.TRANSLATE;
        translateBtn.addEventListener("click", onTranslateClick);

        const speakBtn = document.createElement("button");
        speakBtn.className = `${PREFIX}x-speak-btn`;
        speakBtn.title = "Czytaj na głos";
        speakBtn.innerHTML = SVG.SPEAKER_FULL;
        speakBtn.addEventListener("click", onSpeakClick);

        const wrapper = document.createElement("div");
        wrapper.style.cssText =
            "display:flex;align-items:center;margin-right:4px;";
        wrapper.appendChild(translateBtn);
        wrapper.appendChild(speakBtn);
        headerRow.insertBefore(wrapper, headerRow.firstChild);
    }

    function splitTweetText(textEl) {
        if (textEl.dataset[PREFIX + "xWordBound"]) return;
        textEl.dataset[PREFIX + "xWordBound"] = "1";

        const walker = document.createTreeWalker(
            textEl,
            NodeFilter.SHOW_TEXT,
            null,
            false,
        );
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const textNode of textNodes) {
            const text = textNode.textContent;
            if (!text.trim()) continue;

            const frag = document.createDocumentFragment();
            const parts = text.match(/\S+|\s+/g) || [];
            for (const part of parts) {
                if (/\S/.test(part)) {
                    const span = document.createElement("span");
                    span.className = WORD_CLASS;
                    span.textContent = part;
                    frag.appendChild(span);
                } else {
                    frag.appendChild(document.createTextNode(part));
                }
            }
            textNode.parentNode.replaceChild(frag, textNode);
        }
    }

    function processPosts() {
        document.querySelectorAll("article").forEach((article) => {
            injectButtons(article);
            const textEl = article.querySelector('[data-testid="tweetText"]');
            if (textEl) splitTweetText(textEl);
        });
    }

    // ── Init & Observe ─────────────────────────────────────────────
    function init() {
        new MutationObserver(processPosts).observe(document.body, {
            childList: true,
            subtree: true,
        });
        processPosts();
        hint.show(
            "Najedź na słowo = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // X.com SPA re-process on URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            cache.clear();
            setTimeout(processPosts, 1000);
        }
    }).observe(document.body, { childList: true, subtree: true });
})();
