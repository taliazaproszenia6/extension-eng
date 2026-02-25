/**
 * Quick Translator – YouTube Module
 * Subtitle (CC) word-level hover-to-translate and click-to-speak.
 *
 * Depends on: core.js (window.QT)
 */
(() => {
    "use strict";
    if (!window.location.hostname.includes("youtube.com")) return;

    const {
        PREFIX,
        SVG,
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
        addDismissHandler,
        pauseVideo,
        resumeVideo,
    } = QT;

    // ── Shared instances ───────────────────────────────────────────
    const cache = createTranslateCache();
    const buffer = createSubtitleBuffer();
    const hint = createHint(`${PREFIX}yt-sub-hint`);

    const WORD_CLASS = `${PREFIX}yt-word`;
    const LOG = "[Quick Translator – YT CC]";

    // ── State ──────────────────────────────────────────────────────
    let hoverTimer = null;
    let isHovering = false;
    let wasPlayingBeforeHover = false;
    let clickLocked = false;
    let clickWasPlaying = false;

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

    // ── Filter YT UI text that leaks into captions ─────────────────
    function isYTUIText(text) {
        return /\(auto-generated\)|Click for settings|\bsubtitles?\/CC\b/i.test(
            text,
        );
    }

    // ── Get fallback full-line text from visible segments ──────────
    function getFallbackLine(wordSpan) {
        const el = wordSpan.closest(".ytp-caption-segment");
        const container =
            el?.closest(".captions-text") ||
            el?.closest(".ytp-caption-window-container") ||
            el?.parentElement;
        if (!container) return null;

        const segments = container.querySelectorAll(".ytp-caption-segment");
        return (
            Array.from(segments)
                .map((s) => s.textContent)
                .join(" ")
                .trim() || null
        );
    }

    // ── Hover handler ──────────────────────────────────────────────
    async function handleWordHover(wordSpan) {
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
        e.preventDefault();
        clearTimeout(hoverTimer);
        clickLocked = true;

        const word = wordSpan.textContent.trim();
        if (!word) return;

        if (pauseVideo()) clickWasPlaying = true;

        // Try to extract full sentence from buffer, fallback to visible segments
        let fullLine =
            buffer.extractSentence(word) || getFallbackLine(wordSpan);
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

    // ── Make subtitle segment interactive ──────────────────────────
    function makeSubtitleClickable(el) {
        if (el.dataset[PREFIX + "bound"]) return;
        el.dataset[PREFIX + "bound"] = "1";
        el.classList.add(`${PREFIX}clickable`);

        splitIntoWordSpans(el, WORD_CLASS);

        // Hover
        el.addEventListener("mouseover", (e) => {
            const w = e.target.closest(`.${WORD_CLASS}`);
            if (w) handleWordHover(w);
        });
        el.addEventListener("mouseleave", handleWordLeave);

        // Click
        el.addEventListener("click", (e) => {
            const w = e.target.closest(`.${WORD_CLASS}`);
            if (w) handleWordClick(w, e);
        });
    }

    function isActualSubtitle(el) {
        return !!el.closest(".ytp-caption-window-container");
    }

    // ── DOM observer ───────────────────────────────────────────────
    function observeSubtitles() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    if (
                        node.classList?.contains("ytp-caption-segment") &&
                        isActualSubtitle(node)
                    ) {
                        const text = node.textContent;
                        if (!isYTUIText(text)) buffer.append(text);
                        makeSubtitleClickable(node);
                    }

                    node.querySelectorAll?.(
                        ".ytp-caption-window-container .ytp-caption-segment",
                    ).forEach((seg) => {
                        const text = seg.textContent;
                        if (!isYTUIText(text)) buffer.append(text);
                        makeSubtitleClickable(seg);
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Process existing subtitles
        document
            .querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            )
            .forEach((seg) => {
                const text = seg.textContent;
                if (!isYTUIText(text)) buffer.append(text);
                makeSubtitleClickable(seg);
            });
    }

    // ── Init ───────────────────────────────────────────────────────
    function init() {
        observeSubtitles();
        hint.show(
            "Najedź na słowo w CC = tłumaczenie · Kliknij = wymów + całe zdanie ✨",
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // SPA navigation re-observe
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
})();
