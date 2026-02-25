/**
 * Quick Translator – Netflix Module
 * Subtitle word-level hover-to-translate and click-to-speak.
 * Uses elementsFromPoint to see through Netflix's overlay divs.
 *
 * Depends on: core.js (window.QT)
 */
(() => {
    "use strict";
    if (!window.location.hostname.includes("netflix.com")) return;

    const {
        PREFIX,
        showTooltip,
        hideTooltip,
        showLoading,
        speak,
        getTargetLang,
        escapeHtml,
        buildTooltipHtml,
        attachTooltipHandlers,
        createTranslateCache,
        createSubtitleBuffer,
        splitIntoWordSpans,
        createHint,
        findWordAtPoint,
        addDismissHandler,
        getOverlayParent,
        pauseVideo,
        resumeVideo,
    } = QT;

    // ── Shared instances ───────────────────────────────────────────
    const cache = createTranslateCache();
    const buffer = createSubtitleBuffer();
    const hint = createHint(`${PREFIX}nf-sub-hint`, getOverlayParent);

    const WORD_CLASS = `${PREFIX}nf-word`;
    const LOG = "[Quick Translator – NF CC]";

    // ── State ──────────────────────────────────────────────────────
    let hoverTimer = null;
    let isHovering = false;
    let wasPlayingBeforeHover = false;
    let clickLocked = false;
    let clickWasPlaying = false;
    let lastHoveredWord = null;

    // ── Dismiss ────────────────────────────────────────────────────
    function dismiss() {
        if (!clickLocked) return;
        clickLocked = false;
        hideTooltip();
        if (clickWasPlaying) {
            clickWasPlaying = false;
            resumeVideo();
        }
    }
    addDismissHandler(dismiss);

    // ── Hover handler ──────────────────────────────────────────────
    async function handleWordEnter(wordSpan) {
        if (clickLocked) return;
        isHovering = true;
        clearTimeout(hoverTimer);

        if (pauseVideo()) wasPlayingBeforeHover = true;

        const word = wordSpan.textContent.trim();
        if (!word) return;

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
                speak(word, srcLang);
            } catch (err) {
                console.error(LOG + " hover", err);
                showTooltip(
                    `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                    rect,
                );
            }
        }, 250);
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
                if (wasPlayingBeforeHover) {
                    wasPlayingBeforeHover = false;
                    resumeVideo();
                }
            }
        }, 400);
    }

    // ── Click handler ──────────────────────────────────────────────
    async function handleWordClick(wordSpan, e) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        clearTimeout(hoverTimer);
        clickLocked = true;

        const word = wordSpan.textContent.trim();
        if (!word) return;

        if (pauseVideo()) clickWasPlaying = true;

        // Try sentence from buffer, fallback to visible subtitle container
        let fullLine = buffer.extractSentence(word);
        if (!fullLine) {
            const container = wordSpan.closest(
                ".player-timedtext-text-container",
            );
            if (container) fullLine = container.textContent.trim();
        }

        const rect = wordSpan.getBoundingClientRect();

        try {
            const targetLang = await getTargetLang();
            const { translated: wordTranslated, detectedLang } =
                await cache.get(word, targetLang);
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            speak(word, srcLang);
            showLoading(rect);

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

    // ── Make subtitle span interactive ─────────────────────────────
    function makeClickable(el) {
        if (el.dataset[PREFIX + "nfBound"]) return;
        if (el.classList.contains(WORD_CLASS)) return;
        if (!el.textContent.trim()) return;
        if (el.querySelector(`span:not(.${WORD_CLASS})`)) return;

        el.dataset[PREFIX + "nfBound"] = "1";
        el.classList.add(`${PREFIX}clickable`);
        splitIntoWordSpans(el, WORD_CLASS);
    }

    // ── Document-level event delegation via elementsFromPoint ──────
    // Netflix has invisible overlay divs on top of subtitle text.

    document.addEventListener(
        "mousemove",
        (e) => {
            if (!document.querySelector(".player-timedtext")) return;

            const wordSpan = findWordAtPoint(e.clientX, e.clientY, WORD_CLASS);

            if (wordSpan && wordSpan !== lastHoveredWord) {
                if (lastHoveredWord)
                    lastHoveredWord.classList.remove(`${PREFIX}nf-word-hover`);
                lastHoveredWord = wordSpan;
                wordSpan.classList.add(`${PREFIX}nf-word-hover`);
                handleWordEnter(wordSpan);
            } else if (!wordSpan && lastHoveredWord) {
                lastHoveredWord.classList.remove(`${PREFIX}nf-word-hover`);
                lastHoveredWord = null;
                handleWordLeave();
            }
        },
        true,
    );

    document.addEventListener(
        "click",
        (e) => {
            const wordSpan = findWordAtPoint(e.clientX, e.clientY, WORD_CLASS);
            if (wordSpan) handleWordClick(wordSpan, e);
        },
        true,
    );

    // Block Netflix play/pause when clicking subtitle words
    for (const evt of ["mousedown", "mouseup", "pointerdown", "pointerup"]) {
        document.addEventListener(
            evt,
            (e) => {
                if (findWordAtPoint(e.clientX, e.clientY, WORD_CLASS)) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            },
            true,
        );
    }

    // ── DOM observer ───────────────────────────────────────────────
    function processSubtitles() {
        document
            .querySelectorAll(".player-timedtext-text-container span")
            .forEach((span) => {
                if (
                    !span.querySelector(`span:not(.${WORD_CLASS})`) &&
                    span.textContent.trim()
                ) {
                    buffer.append(span.textContent);
                    makeClickable(span);
                }
            });
    }

    function observeSubtitles() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    if (
                        node.closest?.(".player-timedtext-text-container") ||
                        node.classList?.contains(
                            "player-timedtext-text-container",
                        )
                    ) {
                        const spans =
                            node.tagName === "SPAN"
                                ? [node]
                                : node.querySelectorAll("span");
                        spans.forEach((span) => {
                            if (
                                !span.querySelector(
                                    `span:not(.${WORD_CLASS})`,
                                ) &&
                                span.textContent.trim()
                            ) {
                                buffer.append(span.textContent);
                                makeClickable(span);
                            }
                        });
                    }

                    node.querySelectorAll?.(
                        ".player-timedtext-text-container span",
                    ).forEach((span) => {
                        if (
                            !span.querySelector(`span:not(.${WORD_CLASS})`) &&
                            span.textContent.trim()
                        ) {
                            buffer.append(span.textContent);
                            makeClickable(span);
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        processSubtitles();
    }

    // ── Init ───────────────────────────────────────────────────────
    function init() {
        observeSubtitles();
        hint.show(
            "Najedź na słowo w napisach = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // Netflix SPA – re-check on URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            buffer.clear();
            cache.clear();
            setTimeout(processSubtitles, 2000);
        }
    }).observe(document.body, { childList: true, subtree: true });
})();
