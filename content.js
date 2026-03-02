/**
 * Quick Translator – Content Script (General Web Pages)
 * Handles: text selection → translate/read icon, read-aloud with
 * sentence highlighting, dismiss handlers, keyboard subtitle navigation.
 *
 * Depends on: core.js (window.QT)
 */
(() => {
    "use strict";

    const {
        PREFIX,
        ICON_ID,
        SVG,
        showTooltip,
        hideTooltip,
        hideAll,
        showLoading,
        speak,
        getTargetLang,
        translate: googleTranslate,
        escapeHtml,
        escapeAttr,
        langTag,
        isOwnUI,
        saveWord,
        buildTooltipHtml,
        attachTooltipHandlers,
        addCleanup,
        addDismissHandler,
        runDismiss,
        cleanTextForTTS,
        pickBestVoice,
        getElAudioEl,
        setElAudioEl,
    } = QT;

    // ═══════════════════════════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════════════════════════

    let iconEl = null;
    let currentText = "";
    let currentRect = null;
    let currentRange = null;
    let isReading = false;
    let readingHighlightEl = null;

    // Register cleanup handlers with core
    addCleanup(() => {
        if (iconEl) iconEl.classList.remove("visible");
    });
    addCleanup(() => {
        if (isReading) cleanupReading();
    });

    // ═══════════════════════════════════════════════════════════════
    //  Icon – Create & Position
    // ═══════════════════════════════════════════════════════════════

    function getIcon() {
        if (iconEl) return iconEl;
        iconEl = document.createElement("div");
        iconEl.id = ICON_ID;

        const translateBtn = document.createElement("button");
        translateBtn.className = `${PREFIX}tb-btn ${PREFIX}tb-translate`;
        translateBtn.innerHTML = SVG.TRANSLATE;
        translateBtn.title = "Przetłumacz";
        translateBtn.addEventListener("click", onIconClick);

        const readBtn = document.createElement("button");
        readBtn.className = `${PREFIX}tb-btn ${PREFIX}tb-read`;
        readBtn.innerHTML = SVG.READ;
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
        const ICON_W = 79,
            ICON_H = 42,
            GAP = 8;
        const vpW = document.documentElement.clientWidth;
        const vpH = document.documentElement.clientHeight;

        const { x: mx, y: my } = QT.getMousePos();
        const {
            top: selTop,
            bottom: selBottom,
            left: selLeft,
            right: selRight,
            height,
        } = rect;

        let bestX = mx + GAP;
        let bestY = my - ICON_H / 2;

        function overlapsSelection(ix, iy) {
            return !(
                ix > selRight ||
                ix + ICON_W < selLeft ||
                iy > selBottom ||
                iy + ICON_H < selTop
            );
        }

        if (bestX + ICON_W <= vpW && !overlapsSelection(bestX, bestY)) {
            // good – right of mouse
        } else if (
            mx - GAP - ICON_W >= 0 &&
            !overlapsSelection(mx - GAP - ICON_W, bestY)
        ) {
            bestX = mx - GAP - ICON_W;
        } else if (selBottom + GAP + ICON_H <= vpH) {
            bestX = Math.max(4, Math.min(mx - ICON_W / 2, vpW - ICON_W - 4));
            bestY = selBottom + GAP;
        } else if (selTop - GAP - ICON_H >= 0) {
            bestX = Math.max(4, Math.min(mx - ICON_W / 2, vpW - ICON_W - 4));
            bestY = selTop - GAP - ICON_H;
        } else {
            bestX = selRight + GAP;
            bestY = selTop + (height - ICON_H) / 2;
        }

        bestX = Math.max(4, Math.min(bestX, vpW - ICON_W - 4));
        bestY = Math.max(4, Math.min(bestY, vpH - ICON_H - 4));

        icon.style.left = `${bestX + scrollX}px`;
        icon.style.top = `${bestY + scrollY}px`;
        requestAnimationFrame(() => icon.classList.add("visible"));
    }

    function hideIcon() {
        if (iconEl) iconEl.classList.remove("visible");
    }

    // ═══════════════════════════════════════════════════════════════
    //  Icon Click → Translate
    // ═══════════════════════════════════════════════════════════════

    async function onIconClick(e) {
        e.stopPropagation();
        e.preventDefault();
        if (!currentText || !currentRect) return;

        const text = currentText;
        const rect = currentRect;
        hideIcon();
        showLoading(rect);

        try {
            const targetLang = await getTargetLang();
            const { translated, detectedLang } = await googleTranslate(
                text,
                targetLang,
            );
            const srcLang =
                typeof detectedLang === "string" ? detectedLang : "auto";

            const html = buildTooltipHtml({
                srcLang,
                targetLang,
                original: text,
                translated,
            });
            showTooltip(html, rect);
            attachTooltipHandlers();
        } catch (err) {
            console.error("[Quick Translator]", err);
            showTooltip(
                `<div class="${PREFIX}error">⚠ ${escapeHtml(err.message)}</div>`,
                rect,
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Read-Aloud – Sentence-by-Sentence Highlighting
    // ═══════════════════════════════════════════════════════════════

    function getTextNodesInRange(range) {
        const result = [];
        const ancestor = range.commonAncestorContainer;

        if (ancestor.nodeType === Node.TEXT_NODE) {
            return [
                {
                    node: ancestor,
                    start: range.startOffset,
                    end: range.endOffset,
                },
            ];
        }

        const walker = document.createTreeWalker(
            ancestor,
            NodeFilter.SHOW_TEXT,
        );
        let node;
        while ((node = walker.nextNode())) {
            if (!range.intersectsNode(node)) continue;
            if (!node.textContent.trim()) continue;
            let start = 0,
                end = node.textContent.length;
            if (node === range.startContainer) start = range.startOffset;
            if (node === range.endContainer) end = range.endOffset;
            if (end > start) result.push({ node, start, end });
        }
        return result;
    }

    function splitIntoSentencesWithOffsets(text) {
        const results = [];
        const regex = /[.!?]+[\s]*/g;
        let lastEnd = 0,
            match;
        while ((match = regex.exec(text))) {
            const end = match.index + match[0].length;
            if (end > lastEnd) {
                results.push({
                    text: text.substring(lastEnd, end),
                    start: lastEnd,
                    end,
                });
            }
            lastEnd = end;
        }
        if (lastEnd < text.length) {
            results.push({
                text: text.substring(lastEnd),
                start: lastEnd,
                end: text.length,
            });
        }
        if (results.length === 0) {
            results.push({ text, start: 0, end: text.length });
        }
        return results;
    }

    function buildSentenceRanges(textInfos, sentencesWithOffsets) {
        let totalOffset = 0;
        const charMap = [];
        textInfos.forEach((info, i) => {
            if (i > 0) totalOffset += 1;
            const len = info.end - info.start;
            charMap.push({
                node: info.node,
                nodeStart: info.start,
                globalStart: totalOffset,
                globalEnd: totalOffset + len,
            });
            totalOffset += len;
        });

        function findNodeOffset(charIdx) {
            for (const seg of charMap) {
                if (charIdx >= seg.globalStart && charIdx <= seg.globalEnd) {
                    return {
                        node: seg.node,
                        offset: seg.nodeStart + (charIdx - seg.globalStart),
                    };
                }
            }
            const last = charMap[charMap.length - 1];
            return {
                node: last.node,
                offset: last.nodeStart + (last.globalEnd - last.globalStart),
            };
        }

        const ranges = [];
        for (const sentence of sentencesWithOffsets) {
            try {
                const r = document.createRange();
                const s = findNodeOffset(sentence.start);
                const e = findNodeOffset(sentence.end);
                r.setStart(s.node, s.offset);
                r.setEnd(e.node, e.offset);
                ranges.push(r);
            } catch (err) {
                console.warn("[QuickTranslator] sentence range error:", err);
            }
        }
        return ranges;
    }

    function clearSentenceHighlight() {
        try {
            if (typeof CSS !== "undefined" && CSS.highlights)
                CSS.highlights.delete("qt-reading-sentence");
        } catch (_) {}
    }

    function cleanupReading() {
        window.speechSynthesis.cancel();
        const audio = getElAudioEl();
        if (audio) {
            audio.pause();
            setElAudioEl(null);
        }
        isReading = false;
        clearSentenceHighlight();

        if (readingHighlightEl) {
            const parent = readingHighlightEl.parentNode;
            if (parent) {
                while (readingHighlightEl.firstChild)
                    parent.insertBefore(
                        readingHighlightEl.firstChild,
                        readingHighlightEl,
                    );
                parent.removeChild(readingHighlightEl);
                parent.normalize();
            }
            readingHighlightEl = null;
        }

        if (iconEl) {
            const rb = iconEl.querySelector(`.${PREFIX}tb-read`);
            if (rb) rb.classList.remove("reading");
        }
    }

    function readSentenceBySentence(sentences, sentenceRanges, lang) {
        let idx = 0;

        function highlightSentence(i) {
            try {
                if (
                    typeof CSS !== "undefined" &&
                    CSS.highlights &&
                    sentenceRanges[i]
                ) {
                    CSS.highlights.set(
                        "qt-reading-sentence",
                        new Highlight(sentenceRanges[i]),
                    );
                }
            } catch (_) {}
        }

        function readNext() {
            if (!isReading || idx >= sentences.length) {
                clearSentenceHighlight();
                cleanupReading();
                return;
            }

            highlightSentence(idx);
            const text = cleanTextForTTS(sentences[idx].text);
            if (!text?.trim()) {
                idx++;
                readNext();
                return;
            }

            if (!chrome?.storage?.sync) {
                const utter = new SpeechSynthesisUtterance(text);
                utter.lang = lang;
                const voice = pickBestVoice("", lang);
                if (voice) utter.voice = voice;
                utter.rate = 0.95;
                utter.onend = () => {
                    idx++;
                    readNext();
                };
                utter.onerror = () => cleanupReading();
                window.speechSynthesis.speak(utter);
                return;
            }

            chrome.storage.sync.get(
                {
                    ttsMode: "browser",
                    elApiKey: "",
                    elVoiceId: "",
                    speechVoice: "",
                    speechRate: 0.95,
                    ttsVolume: 1,
                },
                async (data) => {
                    const vol =
                        data.ttsVolume !== undefined ? data.ttsVolume : 1;
                    if (
                        data.ttsMode === "elevenlabs" &&
                        data.elApiKey &&
                        data.elVoiceId
                    ) {
                        const audio = await QT.speak(text, lang);
                        if (audio instanceof HTMLAudioElement) {
                            audio.volume = vol;
                            audio.onended = () => {
                                idx++;
                                readNext();
                            };
                            audio.onerror = () => cleanupReading();
                        } else if (audio) {
                            audio.onend = () => {
                                idx++;
                                readNext();
                            };
                            audio.onerror = () => cleanupReading();
                        } else {
                            cleanupReading();
                        }
                    } else {
                        const utter = new SpeechSynthesisUtterance(text);
                        utter.lang = lang;
                        utter.rate = data.speechRate;
                        utter.volume = vol;
                        const voice = pickBestVoice(data.speechVoice, lang);
                        if (voice) utter.voice = voice;
                        utter.onend = () => {
                            idx++;
                            readNext();
                        };
                        utter.onerror = () => cleanupReading();
                        window.speechSynthesis.speak(utter);
                    }
                },
            );
        }
        readNext();
    }

    function onReadClick(e) {
        e.stopPropagation();
        e.preventDefault();

        if (isReading) {
            cleanupReading();
            return;
        }
        if (!currentText) return;

        isReading = true;
        hideIcon();

        if (iconEl) {
            const rb = iconEl.querySelector(`.${PREFIX}tb-read`);
            if (rb) rb.classList.add("reading");
        }

        const utterText = cleanTextForTTS(currentText);
        if (!utterText) {
            cleanupReading();
            return;
        }

        const pageLang =
            document.documentElement.lang || navigator.language || "en";

        // Try sentence-by-sentence reading with CSS Highlight API
        let started = false;
        if (currentRange && typeof CSS !== "undefined" && CSS.highlights) {
            try {
                const textInfos = getTextNodesInRange(currentRange);
                if (textInfos.length > 0) {
                    const fullText = textInfos
                        .map((i) =>
                            i.node.textContent.substring(i.start, i.end),
                        )
                        .join(" ");
                    const sents = splitIntoSentencesWithOffsets(fullText);
                    const ranges = buildSentenceRanges(textInfos, sents);
                    window.getSelection().removeAllRanges();
                    readSentenceBySentence(sents, ranges, pageLang);
                    started = true;
                }
            } catch (err) {
                console.warn(
                    "[QuickTranslator] Sentence highlight failed:",
                    err,
                );
            }
        }

        if (!started) window.getSelection().removeAllRanges();
        if (started) return;

        // Fallback: read entire text at once
        speak(utterText, pageLang).then((result) => {
            if (result && typeof result.onend !== "undefined") {
                result.onend = () => cleanupReading();
                result.onerror = () => cleanupReading();
            } else if (result instanceof HTMLAudioElement) {
                result.onended = () => cleanupReading();
                result.onerror = () => cleanupReading();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Selection Listener
    // ═══════════════════════════════════════════════════════════════

    document.addEventListener("mouseup", (e) => {
        if (isOwnUI(e.target)) return;

        setTimeout(() => {
            // Skip if hover-translate module just handled a click
            if (QT.hoverClickActive) return;

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

    // ═══════════════════════════════════════════════════════════════
    //  Dismiss Handlers (click-away + Escape)
    // ═══════════════════════════════════════════════════════════════

    document.addEventListener("mousedown", (e) => {
        if (isOwnUI(e.target)) return;
        // Don't dismiss when hover-translate module is handling a word click
        if (QT.hoverClickActive) return;
        runDismiss();
        hideAll();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            runDismiss();
            hideAll();
        }
    });

    // ═══════════════════════════════════════════════════════════════
    //  Keyboard Subtitle Navigation (all video sites)
    //  A/← = prev sentence, D/→ = next, W/↑ = play/pause,
    //  S/↓/E/Enter = translate subtitle in-place
    // ═══════════════════════════════════════════════════════════════

    (function setupSubtitleNavigation() {
        const FALLBACK_SKIP = 3;

        function getActiveVideo() {
            const videos = document.querySelectorAll("video");
            if (videos.length === 0) return null;
            if (videos.length === 1) return videos[0];
            for (const v of videos) {
                if (!v.paused && v.readyState >= 2) return v;
            }
            let best = videos[0],
                bestArea = 0;
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

        function getAllCues(video) {
            if (!video?.textTracks) return [];
            const cues = [];
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (track.mode === "disabled" || !track.cues) continue;
                for (let j = 0; j < track.cues.length; j++)
                    cues.push(track.cues[j]);
            }
            const seen = new Set();
            return cues
                .filter((c) => {
                    const key = `${c.startTime.toFixed(3)}-${c.endTime.toFixed(3)}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                })
                .sort((a, b) => a.startTime - b.startTime);
        }

        function getCurrentCueIndex(cues, time) {
            let idx = 0;
            for (let i = cues.length - 1; i >= 0; i--) {
                if (time >= cues[i].startTime - 0.05) {
                    idx = i;
                    break;
                }
            }
            return idx;
        }

        function getCurrentSubtitleText(video) {
            // YouTube
            const ytSegs = document.querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            );
            if (ytSegs.length > 0)
                return Array.from(ytSegs)
                    .map((s) => s.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            // Netflix
            const nfSpans = document.querySelectorAll(
                ".player-timedtext-text-container span",
            );
            if (nfSpans.length > 0)
                return Array.from(nfSpans)
                    .map((s) => s.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            // video.js / LookMovie
            const vjsCues = document.querySelectorAll(
                ".vjs-text-track-cue div",
            );
            if (vjsCues.length > 0)
                return Array.from(vjsCues)
                    .map((d) => d.textContent.trim())
                    .filter(Boolean)
                    .join(" ");
            // Fallback: textTracks API
            if (video?.textTracks) {
                for (let i = 0; i < video.textTracks.length; i++) {
                    const track = video.textTracks[i];
                    if (track.mode === "disabled" || !track.activeCues)
                        continue;
                    for (let j = 0; j < track.activeCues.length; j++) {
                        const t = track.activeCues[j].text;
                        if (t?.trim()) return t.trim();
                    }
                }
            }
            return null;
        }

        // E-key subtitle translation state
        let eTranslateActive = false;
        let eOriginalContents = [];
        let eWasPlaying = false;

        function getSubtitleElements() {
            let els = document.querySelectorAll(
                ".ytp-caption-window-container .ytp-caption-segment",
            );
            if (els.length > 0) return Array.from(els);
            els = document.querySelectorAll(
                ".player-timedtext-text-container span",
            );
            if (els.length > 0) return Array.from(els);
            els = document.querySelectorAll(".vjs-text-track-cue div");
            if (els.length > 0)
                return Array.from(els).filter(
                    (d) => d.textContent.trim() && !d.querySelector("div"),
                );
            return [];
        }

        let translationOverlay = null;

        function getSubtitleRect() {
            const els = getSubtitleElements();
            if (els.length === 0) return null;
            let top = Infinity,
                bottom = -Infinity,
                left = Infinity,
                right = -Infinity;
            for (const el of els) {
                const r = el.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
                top = Math.min(top, r.top);
                bottom = Math.max(bottom, r.bottom);
                left = Math.min(left, r.left);
                right = Math.max(right, r.right);
            }
            if (top === Infinity) return null;
            return { top, bottom, left, right, width: right - left };
        }

        function createOverlay() {
            removeOverlay();
            translationOverlay = document.createElement("div");
            translationOverlay.className = PREFIX + "sub-overlay";
            // Use fullscreen-aware parent so overlay is visible in fullscreen
            const parent =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.body;
            parent.appendChild(translationOverlay);
            return translationOverlay;
        }

        function removeOverlay() {
            if (translationOverlay) {
                translationOverlay.remove();
                translationOverlay = null;
            }
        }

        function positionOverlay() {
            if (!translationOverlay) return;
            const rect = getSubtitleRect();
            if (!rect) return;

            // Match subtitle font size
            const subEls = getSubtitleElements();
            if (subEls.length > 0) {
                const cs = window.getComputedStyle(subEls[0]);
                translationOverlay.style.fontSize = cs.fontSize;
                translationOverlay.style.fontFamily = cs.fontFamily;
            }

            translationOverlay.style.position = "fixed";
            translationOverlay.style.left = rect.left + "px";
            translationOverlay.style.width = rect.width + "px";
            // Measure after content + font are set
            const overlayH = translationOverlay.offsetHeight || 40;
            translationOverlay.style.top = rect.top - overlayH - 4 + "px";
        }

        function showSubLoading() {
            const overlay = createOverlay();
            overlay.innerHTML =
                `<div class="${PREFIX}shimmer-bar">` +
                `<div class="${PREFIX}shimmer-line"></div>` +
                `<div class="${PREFIX}shimmer-line ${PREFIX}shimmer-short"></div>` +
                `</div>`;
            positionOverlay();
        }

        function clearSubLoading() {
            // overlay will be replaced by translation or removed
        }

        function applyTranslation(translatedText) {
            const subEls = getSubtitleElements();
            if (subEls.length === 0) {
                removeOverlay();
                return;
            }

            const overlay = translationOverlay || createOverlay();
            const words = translatedText.split(/\s+/).filter(Boolean);

            if (subEls.length <= 1) {
                overlay.textContent = words.join(" ");
            } else {
                // Distribute words proportionally across lines
                const origLengths = subEls.map(
                    (el) => el.textContent.trim().length || 1,
                );
                const totalOrigLen = origLengths.reduce((a, b) => a + b, 0);
                const totalWords = words.length;
                let wordIdx = 0;
                const lines = [];

                subEls.forEach((el, i) => {
                    if (i === subEls.length - 1) {
                        lines.push(words.slice(wordIdx).join(" "));
                    } else {
                        const share = Math.max(
                            1,
                            Math.round(
                                (origLengths[i] / totalOrigLen) * totalWords,
                            ),
                        );
                        lines.push(
                            words.slice(wordIdx, wordIdx + share).join(" "),
                        );
                        wordIdx += share;
                    }
                });

                overlay.innerHTML = lines
                    .map((line) => `<div>${line}</div>`)
                    .join("");
            }

            positionOverlay();
            eTranslateActive = true;
        }

        function restoreOriginal() {
            removeOverlay();
            eOriginalContents = [];
            eTranslateActive = false;
            // Stop any TTS that was reading the translated text
            window.speechSynthesis.cancel();
            const audio = getElAudioEl();
            if (audio) {
                audio.pause();
                setElAudioEl(null);
            }
        }

        // CSS-based control-bar suppression: add __qt_hide-controls to .video-js
        // so the control bar is hidden by CSS. Only mousemove temporarily removes it.
        let _controlBarTimer = null;
        function ensureControlsHidden() {
            const vjsEl = document.querySelector(".video-js");
            if (vjsEl && !vjsEl.classList.contains("__qt_hide-controls")) {
                vjsEl.classList.add("__qt_hide-controls");
            }
        }
        function initControlBarHide() {
            const vjsEl = document.querySelector(".video-js");
            if (!vjsEl || vjsEl.__qtMouseBound) return;
            vjsEl.__qtMouseBound = true;
            vjsEl.classList.add("__qt_hide-controls");
            vjsEl.addEventListener("mousemove", () => {
                vjsEl.classList.remove("__qt_hide-controls");
                clearTimeout(_controlBarTimer);
                _controlBarTimer = setTimeout(() => {
                    vjsEl.classList.add("__qt_hide-controls");
                }, 3000);
            });
            vjsEl.addEventListener("mouseleave", () => {
                clearTimeout(_controlBarTimer);
                vjsEl.classList.add("__qt_hide-controls");
            });
        }
        initControlBarHide();
        document.addEventListener("fullscreenchange", () =>
            setTimeout(initControlBarHide, 200),
        );
        document.addEventListener("webkitfullscreenchange", () =>
            setTimeout(initControlBarHide, 200),
        );

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

                const key = e.key;
                const NAV_KEYS = [
                    "a",
                    "A",
                    "ArrowLeft",
                    "d",
                    "D",
                    "ArrowRight",
                    "w",
                    "W",
                    "ArrowUp",
                    "s",
                    "S",
                    "ArrowDown",
                    "e",
                    "E",
                    "Enter",
                ];
                if (!NAV_KEYS.includes(key)) return;

                const video = getActiveVideo();
                if (!video) return;

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Ensure control bar stays hidden on keyboard nav
                ensureControlsHidden();
                clearTimeout(_controlBarTimer);

                // If translation overlay is active, ANY nav key dismisses it
                if (eTranslateActive) {
                    restoreOriginal();
                    video.play();
                    eWasPlaying = false;
                    return;
                }

                // S / ArrowDown / E / Enter = toggle subtitle translation in-place
                if (
                    key === "s" ||
                    key === "S" ||
                    key === "ArrowDown" ||
                    key === "e" ||
                    key === "E" ||
                    key === "Enter"
                ) {
                    // Capture text IMMEDIATELY from all sources before anything else
                    const capturedTime = video.currentTime;
                    let subText = getCurrentSubtitleText(video);

                    // If DOM didn't have it, try textTracks cues right away
                    if (!subText) {
                        const cues = getAllCues(video);
                        for (const cue of cues) {
                            if (
                                capturedTime >= cue.startTime - 0.5 &&
                                capturedTime <= cue.endTime + 0.5
                            ) {
                                if (cue.text?.trim()) {
                                    subText = cue.text.trim();
                                    break;
                                }
                            }
                        }
                        if (!subText && cues.length > 0) {
                            const idx = getCurrentCueIndex(cues, capturedTime);
                            if (cues[idx]?.text?.trim())
                                subText = cues[idx].text.trim();
                        }
                    }

                    eWasPlaying = !video.paused;
                    video.pause();

                    // Show loading immediately so user sees feedback
                    showSubLoading();

                    if (subText) {
                        // Text found – translate right away
                        getTargetLang().then((lang) =>
                            googleTranslate(subText, lang)
                                .then((r) => {
                                    applyTranslation(r.translated);
                                    // Speak translated text if subtitleTTS is enabled
                                    if (chrome?.storage?.sync) {
                                        chrome.storage.sync.get(
                                            { subtitleTTS: false },
                                            (data) => {
                                                if (data.subtitleTTS) {
                                                    speak(r.translated, lang);
                                                }
                                            },
                                        );
                                    }
                                })
                                .catch(() => restoreOriginal()),
                        );
                    } else {
                        // Rare fallback: DOM might update after pause, retry briefly
                        let attempt = 0;
                        const RETRY_DELAYS = [50, 150];

                        function retryResolve() {
                            const post = getCurrentSubtitleText(video);
                            if (post) {
                                getTargetLang().then((lang) =>
                                    googleTranslate(post, lang)
                                        .then((r) =>
                                            applyTranslation(r.translated),
                                        )
                                        .catch(() => restoreOriginal()),
                                );
                                return;
                            }
                            attempt++;
                            if (attempt < RETRY_DELAYS.length) {
                                setTimeout(retryResolve, RETRY_DELAYS[attempt]);
                            } else {
                                restoreOriginal();
                                if (eWasPlaying) video.play();
                                eWasPlaying = false;
                            }
                        }

                        setTimeout(retryResolve, RETRY_DELAYS[0]);
                    }
                    return;
                }

                const cues = getAllCues(video);
                const hasCues = cues.length > 0;

                // W / ArrowUp = play/pause
                if (key === "w" || key === "W" || key === "ArrowUp") {
                    video.paused ? video.play() : video.pause();
                    return;
                }

                // A / ArrowLeft = previous
                if (key === "a" || key === "A" || key === "ArrowLeft") {
                    if (hasCues) {
                        const idx = getCurrentCueIndex(cues, video.currentTime);
                        video.currentTime =
                            video.currentTime - cues[idx].startTime > 1.5 &&
                            idx >= 0
                                ? cues[idx].startTime
                                : cues[Math.max(0, idx - 1)].startTime;
                    } else {
                        video.currentTime = Math.max(
                            0,
                            video.currentTime - FALLBACK_SKIP,
                        );
                    }
                    if (video.paused) video.play();
                    return;
                }

                // D / ArrowRight = next
                if (key === "d" || key === "D" || key === "ArrowRight") {
                    if (hasCues) {
                        const idx = getCurrentCueIndex(cues, video.currentTime);
                        video.currentTime =
                            cues[Math.min(cues.length - 1, idx + 1)].startTime;
                    } else {
                        video.currentTime = Math.min(
                            video.duration || Infinity,
                            video.currentTime + FALLBACK_SKIP,
                        );
                    }
                    if (video.paused) video.play();
                }
            },
            true,
        );
    })();
})();
