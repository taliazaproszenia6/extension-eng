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
                },
                async (data) => {
                    if (
                        data.ttsMode === "elevenlabs" &&
                        data.elApiKey &&
                        data.elVoiceId
                    ) {
                        const audio = await QT.speak(text, lang);
                        if (audio instanceof HTMLAudioElement) {
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
    //  S/↓ = repeat, E/Enter = translate subtitle in-place
    // ═══════════════════════════════════════════════════════════════

    (function setupSubtitleNavigation() {
        const FALLBACK_SKIP = 5;

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

        function applyTranslation(translatedText) {
            const subEls = getSubtitleElements();
            if (subEls.length === 0) return;
            eOriginalContents = subEls.map((el) => ({
                el,
                html: el.innerHTML,
            }));

            const wordHTML = translatedText
                .split(/\s+/)
                .map(
                    (w, i) =>
                        `<span class="${PREFIX}sub-word" style="animation-delay:${i * 0.07}s">${w}</span>`,
                )
                .join(" ");

            subEls.forEach((el, idx) => {
                el.classList.add(PREFIX + "sub-translated");
                el.innerHTML = idx === 0 ? wordHTML : "";
            });
            eTranslateActive = true;
        }

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

                // E / Enter = toggle subtitle translation in-place
                if (key === "e" || key === "E" || key === "Enter") {
                    if (eTranslateActive) {
                        restoreOriginal();
                        if (eWasPlaying) video.play();
                        eWasPlaying = false;
                        return;
                    }

                    const immediateText = getCurrentSubtitleText(video);
                    const capturedTime = video.currentTime;
                    eWasPlaying = !video.paused;
                    video.pause();

                    function resolveSubtitleText() {
                        if (immediateText) return immediateText;
                        const post = getCurrentSubtitleText(video);
                        if (post) return post;
                        const cues = getAllCues(video);
                        if (cues.length > 0) {
                            for (const cue of cues) {
                                if (
                                    capturedTime >= cue.startTime - 0.1 &&
                                    capturedTime <= cue.endTime + 0.1
                                ) {
                                    if (cue.text?.trim())
                                        return cue.text.trim();
                                }
                            }
                            const idx = getCurrentCueIndex(cues, capturedTime);
                            if (cues[idx]?.text?.trim())
                                return cues[idx].text.trim();
                        }
                        return null;
                    }

                    setTimeout(() => {
                        const subText = resolveSubtitleText();
                        if (!subText) {
                            if (eWasPlaying) video.play();
                            eWasPlaying = false;
                            return;
                        }
                        getTargetLang().then((lang) =>
                            googleTranslate(subText, lang).then((r) =>
                                applyTranslation(r.translated),
                            ),
                        );
                    }, 30);
                    return;
                }

                const cues = getAllCues(video);
                const hasCues = cues.length > 0;

                // W / ArrowUp = play/pause
                if (key === "w" || key === "W" || key === "ArrowUp") {
                    video.paused ? video.play() : video.pause();
                    return;
                }

                // S / ArrowDown = repeat current
                if (key === "s" || key === "S" || key === "ArrowDown") {
                    if (hasCues) {
                        video.currentTime =
                            cues[
                                getCurrentCueIndex(cues, video.currentTime)
                            ].startTime;
                    } else {
                        video.currentTime = Math.max(0, video.currentTime - 3);
                    }
                    if (video.paused) video.play();
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
