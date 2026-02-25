/**
 * Quick Translator – LookMovie2 Module
 * Subtitle word-level hover-to-translate and click-to-speak.
 * Uses elementsFromPoint and periodic re-processing for video.js cues.
 *
 * Depends on: core.js (window.QT)
 */
(() => {
    "use strict";
    if (!window.location.hostname.includes("lookmovie")) return;

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
        pauseVideo,
        resumeVideo,
    } = QT;

    // ── Shared instances ───────────────────────────────────────────
    const cache = createTranslateCache();
    const buffer = createSubtitleBuffer();
    const hint = createHint(`${PREFIX}lm-sub-hint`);

    const WORD_CLASS = `${PREFIX}lm-word`;
    const LOG = "[Quick Translator – LM CC]";

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

        // Try sentence from buffer, fallback to visible cue
        let fullLine = buffer.extractSentence(word);
        if (!fullLine) {
            const cue = wordSpan.closest(".vjs-text-track-cue");
            if (cue) fullLine = cue.textContent.trim();
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

    // ── Make subtitle cue div interactive ──────────────────────────
    function makeClickable(el) {
        if (el.dataset[PREFIX + "lmBound"]) return;
        if (el.classList.contains(WORD_CLASS)) return;
        if (!el.textContent.trim()) return;
        if (el.querySelector(`div:not(.${WORD_CLASS})`)) return;

        el.dataset[PREFIX + "lmBound"] = "1";
        splitIntoWordSpans(el, WORD_CLASS);
    }

    // ── Document-level event delegation via elementsFromPoint ──────

    document.addEventListener(
        "mousemove",
        (e) => {
            if (!document.querySelector(".vjs-text-track-display")) return;

            const wordSpan = findWordAtPoint(e.clientX, e.clientY, WORD_CLASS);

            if (wordSpan && wordSpan !== lastHoveredWord) {
                if (lastHoveredWord)
                    lastHoveredWord.classList.remove(`${PREFIX}lm-word-hover`);
                lastHoveredWord = wordSpan;
                wordSpan.classList.add(`${PREFIX}lm-word-hover`);
                handleWordEnter(wordSpan);
            } else if (!wordSpan && lastHoveredWord) {
                lastHoveredWord.classList.remove(`${PREFIX}lm-word-hover`);
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

    // Block video play/pause when clicking subtitle words
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
        document.querySelectorAll(".vjs-text-track-cue div").forEach((div) => {
            if (div.textContent.trim() && !div.querySelector("div")) {
                buffer.append(div.textContent);
                makeClickable(div);
            }
        });
    }

    function observeSubtitles() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
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
                                buffer.append(div.textContent);
                                makeClickable(div);
                            }
                        });
                    }
                }

                // Handle characterData changes (text updates within cues)
                if (m.type === "characterData") {
                    const cueDiv = m.target.parentElement?.closest?.(
                        ".vjs-text-track-cue div",
                    );
                    if (cueDiv && !cueDiv.querySelector("div")) {
                        cueDiv.dataset[PREFIX + "lmBound"] = "";
                        buffer.append(cueDiv.textContent);
                        makeClickable(cueDiv);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        processSubtitles();

        // Periodic re-process (cues can be replaced without mutation events)
        setInterval(processSubtitles, 500);
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
})();
