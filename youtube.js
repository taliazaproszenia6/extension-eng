/**
 * Quick Translator – YouTube Module
 * Subtitle (CC) word-level hover-to-translate and click-to-speak.
 * Includes Reels-style karaoke caption mode (R key toggle).
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

    // ── Reels / Karaoke Caption Mode ───────────────────────────────
    let reelsMode = false; // OFF by default (normal subtitles)
    let reelsContainer = null; // wrapper
    let reelsBigWord = null; // the single current word element
    let reelsPrevText = "";
    let reelsPrevWordCount = 0;
    let reelsCurrentIdx = 0;
    let reelsPollTimer = null;
    let reelsFadeTimer = null;
    let reelsClickLocked = false;
    let reelsWasPlaying = false;
    let reelsCurrentWord = ""; // the word currently displayed big

    /** Detect subtitle language from YT text tracks */
    function getCaptionLang() {
        const video = document.querySelector("video");
        if (video) {
            for (const track of video.textTracks) {
                if (track.mode === "showing" || track.mode === "hidden") {
                    return track.language || "en";
                }
            }
        }
        return document.documentElement.lang || "en";
    }

    function getPlayerContainer() {
        return (
            document.querySelector("#movie_player") ||
            document.querySelector(".html5-video-player")
        );
    }

    function createReelsOverlay() {
        if (reelsContainer) return;

        reelsContainer = document.createElement("div");
        reelsContainer.id = `${PREFIX}reels-container`;
        reelsContainer.className = `${PREFIX}reels-container`;

        // Big current word – only element, clickable
        reelsBigWord = document.createElement("div");
        reelsBigWord.className = `${PREFIX}reels-bigword`;
        reelsContainer.appendChild(reelsBigWord);

        // Block content.js from seeing these events (selection listener)
        reelsBigWord.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            // Prevent text selection on the word
            e.preventDefault();
        });
        reelsBigWord.addEventListener("mouseup", (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        // Click on the big word → translate it (like normal click handler)
        reelsBigWord.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Clear any accidental selection so content.js icon won't appear
            window.getSelection()?.removeAllRanges();
            handleReelsWordClick();
        });

        const player = getPlayerContainer();
        if (player) {
            player.appendChild(reelsContainer);
        } else {
            document.body.appendChild(reelsContainer);
        }
    }

    // ── Reels click → translate displayed word ─────────────────────
    function reelsDismiss() {
        if (!reelsClickLocked) return;
        reelsClickLocked = false;
        hideTooltip();
        // Stop TTS
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (reelsWasPlaying) {
            reelsWasPlaying = false;
            resumeVideo();
        }
        // Resume polling so captions keep updating
        startReelsPoll();
    }

    async function handleReelsWordClick() {
        // If already locked (tooltip open) → dismiss first
        if (reelsClickLocked) {
            reelsDismiss();
            return;
        }

        // Always read the word directly from what's displayed on screen
        const word = (reelsBigWord?.textContent || "").trim();
        if (!word) return;

        reelsClickLocked = true;
        // Pause video
        if (pauseVideo()) reelsWasPlaying = true;
        // Freeze captions (stop polling so word doesn't change)
        stopReelsPoll();

        // Position tooltip relative to the big word element
        const rect = reelsBigWord.getBoundingClientRect();

        try {
            const targetLang = await getTargetLang();
            showLoading(rect);

            // Clean the word: remove punctuation for translation
            const cleanWord = word.replace(/[.,!?;:"""''()[\]{}]/g, "").trim();
            const wordToTranslate = cleanWord || word;

            const { translated, detectedLang } = await cache.get(
                wordToTranslate,
                targetLang,
            );
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            // TTS reads the TRANSLATION (target language)
            speak(translated, targetLang);

            showTooltip(
                buildTooltipHtml({
                    srcLang,
                    targetLang,
                    original: wordToTranslate,
                    translated,
                }),
                rect,
            );
            attachTooltipHandlers();
        } catch (err) {
            console.error(LOG + " reels click", err);
            showTooltip(
                `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                rect,
            );
        }
    }

    function removeReelsOverlay() {
        if (reelsContainer) {
            reelsContainer.remove();
            reelsContainer = null;
            reelsBigWord = null;
        }
    }

    /** Read text from all visible caption segments right now */
    function readCaptionText() {
        const segments = document.querySelectorAll(
            ".ytp-caption-window-container .ytp-caption-segment",
        );
        const parts = [];
        segments.forEach((seg) => {
            const t = seg.textContent.trim();
            if (t && !isYTUIText(t)) parts.push(t);
        });
        return parts.join(" ").trim();
    }

    /** Main polling loop */
    function reelsPoll() {
        if (!reelsMode) return;

        const text = readCaptionText();

        if (!text) {
            // No captions → fade out
            if (reelsContainer) reelsContainer.classList.remove("visible");
            reelsPrevText = "";
            reelsPrevWordCount = 0;
            reelsCurrentIdx = 0;
            return;
        }

        if (text === reelsPrevText) return;

        const words = text.split(/\s+/).filter(Boolean);
        const prevWords = reelsPrevText
            ? reelsPrevText.split(/\s+/).filter(Boolean)
            : [];

        // Figure out which word is "new" (last added)
        // YouTube auto-captions often replace the whole segment,
        // so we compare word arrays to find the newest word.
        if (prevWords.length === 0) {
            // Brand new segment → show last word
            reelsCurrentIdx = words.length - 1;
        } else {
            // Find how many words at the start are the same
            let commonPrefix = 0;
            for (let i = 0; i < Math.min(prevWords.length, words.length); i++) {
                if (words[i] === prevWords[i]) {
                    commonPrefix = i + 1;
                } else {
                    break;
                }
            }

            if (words.length > prevWords.length) {
                // New words added → point to the last new one
                reelsCurrentIdx = words.length - 1;
            } else if (commonPrefix > 0 && commonPrefix < words.length) {
                // Some words changed after the common prefix
                reelsCurrentIdx = words.length - 1;
            } else {
                // Completely new text (no common prefix) → last word
                reelsCurrentIdx = words.length - 1;
            }
        }

        reelsPrevText = text;
        reelsPrevWordCount = words.length;

        renderReels(words, reelsCurrentIdx);
    }

    function renderReels(allWords, currentIdx) {
        if (!reelsContainer) createReelsOverlay();
        if (allWords.length === 0) {
            reelsContainer.classList.remove("visible");
            return;
        }

        // Don't update display if click-locked (user is reading translation)
        if (reelsClickLocked) return;

        currentIdx = Math.max(0, Math.min(currentIdx, allWords.length - 1));
        const word = allWords[currentIdx];
        reelsCurrentWord = word;

        // ── Single big word only ──
        reelsBigWord.textContent = word;
        // Force re-trigger pop animation
        reelsBigWord.classList.remove(`${PREFIX}reels-pop`);
        void reelsBigWord.offsetWidth; // reflow
        reelsBigWord.classList.add(`${PREFIX}reels-pop`);

        reelsContainer.classList.add("visible");

        // Auto-hide after 4s of no updates
        clearTimeout(reelsFadeTimer);
        reelsFadeTimer = setTimeout(() => {
            if (reelsContainer) reelsContainer.classList.remove("visible");
        }, 4000);
    }

    function startReelsPoll() {
        stopReelsPoll();
        reelsPollTimer = setInterval(reelsPoll, 120);
    }

    function stopReelsPoll() {
        if (reelsPollTimer) {
            clearInterval(reelsPollTimer);
            reelsPollTimer = null;
        }
    }

    function setReelsMode(on) {
        reelsMode = on;
        if (on) {
            createReelsOverlay();
            document.body.classList.add(`${PREFIX}reels-active`);
            startReelsPoll();
            hint.show("Reels ON 🎬 kliknij słowo = tłumacz (R = wyłącz)", 3000);
        } else {
            stopReelsPoll();
            if (reelsClickLocked) reelsDismiss();
            removeReelsOverlay();
            document.body.classList.remove(`${PREFIX}reels-active`);
            reelsPrevText = "";
            reelsPrevWordCount = 0;
            reelsCurrentIdx = 0;
            reelsCurrentWord = "";
            hint.show("Reels OFF – normalne napisy", 2500);
        }
    }

    // ── Keyboard shortcuts ──────────────────────────────────────
    const TRANSLATE_KEYS = new Set(["s", "S", "ArrowDown", "e", "E", "Enter"]);

    document.addEventListener(
        "keydown",
        (e) => {
            const tag = e.target.tagName;
            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                e.target.isContentEditable
            )
                return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            // Toggle reels with R
            if (e.key === "r") {
                setReelsMode(!reelsMode);
                return;
            }

            // Toggle subtitle styles with U
            if (e.key === "u" || e.key === "U") {
                QT.toggleSubtitleStyles();
                return;
            }

            // S / E / Enter / ArrowDown → translate displayed word in reels mode
            if (reelsMode && TRANSLATE_KEYS.has(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleReelsTranslateKey();
            }
        },
        true,
    );

    async function handleReelsTranslateKey() {
        // If already showing translation → dismiss
        if (reelsClickLocked) {
            reelsDismiss();
            return;
        }

        const word = (reelsBigWord?.textContent || "").trim();
        if (!word) return;

        reelsClickLocked = true;
        if (pauseVideo()) reelsWasPlaying = true;
        stopReelsPoll();

        const rect = reelsBigWord.getBoundingClientRect();

        try {
            const targetLang = await getTargetLang();
            showLoading(rect);

            const cleanWord = word.replace(/[.,!?;:"""''()\[\]{}]/g, "").trim();
            const wordToTranslate = cleanWord || word;

            const { translated, detectedLang } = await cache.get(
                wordToTranslate,
                targetLang,
            );
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            // TTS reads the TRANSLATION (target language, e.g. Polish)
            speak(translated, targetLang);

            showTooltip(
                buildTooltipHtml({
                    srcLang,
                    targetLang,
                    original: wordToTranslate,
                    translated,
                }),
                rect,
            );
            attachTooltipHandlers();
        } catch (err) {
            console.error(LOG + " reels key", err);
            showTooltip(
                `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                rect,
            );
        }
    }

    // Register reels dismiss in the global dismiss chain
    addDismissHandler(() => reelsDismiss());

    // ── Dismiss (normal mode) ──────────────────────────────────────
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
        if (reelsMode) return; // Reels mode handles its own interaction
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
        if (reelsMode) return; // Reels mode handles its own interaction
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
                        if (!reelsMode) makeSubtitleClickable(node);
                    }

                    node.querySelectorAll?.(
                        ".ytp-caption-window-container .ytp-caption-segment",
                    ).forEach((seg) => {
                        const text = seg.textContent;
                        if (!isYTUIText(text)) buffer.append(text);
                        if (!reelsMode) makeSubtitleClickable(seg);
                    });
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Process existing subtitles
        document
            .querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            )
            .forEach((seg) => {
                const text = seg.textContent;
                if (!isYTUIText(text)) buffer.append(text);
                if (!reelsMode) makeSubtitleClickable(seg);
            });
    }

    // ── Init ───────────────────────────────────────────────────────
    function init() {
        observeSubtitles();
        // Start Reels mode by default
        setReelsMode(false);
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
