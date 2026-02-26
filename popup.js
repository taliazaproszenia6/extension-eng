// popup.js – Settings, saved words list, filtering & export (Anki / CSV)

// ── Elements ──────────────────────────────────────────────────────
const select = document.getElementById("targetLang");
const savedMsg = document.getElementById("saved");
const wordListEl = document.getElementById("wordList");
const statsEl = document.getElementById("stats");

// ── Tab switching ─────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document
            .querySelectorAll(".tab")
            .forEach((t) => t.classList.remove("active"));
        document
            .querySelectorAll(".tab-content")
            .forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document
            .getElementById("tab-" + tab.dataset.tab)
            .classList.add("active");
        if (tab.dataset.tab === "words") loadWords();
        if (tab.dataset.tab === "review") loadReviewQueue();
    });
});

// ── Voice & rate elements ─────────────────────────────────────────
const voiceSelect = document.getElementById("voiceSelect");
const rateRange = document.getElementById("rateRange");
const rateValue = document.getElementById("rateValue");

// ── Flash saved message ───────────────────────────────────────────
function flashSaved() {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

// ── Settings: load & save language ────────────────────────────────
chrome.storage.sync.get(
    { targetLang: "pl", speechVoice: "", speechRate: 0.95 },
    (data) => {
        select.value = data.targetLang;
        rateRange.value = data.speechRate;
        rateValue.textContent = parseFloat(data.speechRate).toFixed(2);
        // Load voices and set selection
        loadVoices(data.speechVoice);
    },
);

select.addEventListener("change", () => {
    chrome.storage.sync.set({ targetLang: select.value }, flashSaved);
});

// ── Hover Translate toggle ────────────────────────────────────────
const hoverToggle = document.getElementById("hoverTranslate");

chrome.storage.sync.get({ hoverTranslate: false }, (data) => {
    hoverToggle.checked = data.hoverTranslate;
});

hoverToggle.addEventListener("change", () => {
    chrome.storage.sync.set(
        { hoverTranslate: hoverToggle.checked },
        flashSaved,
    );
});

// ── Populate voices ───────────────────────────────────────────────
function loadVoices(selectedVoice) {
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">🔊 Domyślny</option>';
    voices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.name === selectedVoice) opt.selected = true;
        voiceSelect.appendChild(opt);
    });
}

// Voices may load async
window.speechSynthesis.onvoiceschanged = () => {
    chrome.storage.sync.get({ speechVoice: "" }, (data) => {
        loadVoices(data.speechVoice);
    });
};

voiceSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ speechVoice: voiceSelect.value }, flashSaved);
});

// ── Rate slider ───────────────────────────────────────────────────
rateRange.addEventListener("input", () => {
    rateValue.textContent = parseFloat(rateRange.value).toFixed(2);
});
rateRange.addEventListener("change", () => {
    chrome.storage.sync.set(
        { speechRate: parseFloat(rateRange.value) },
        flashSaved,
    );
});

// ── TTS Mode toggle (Browser / ElevenLabs) ───────────────────────
const modeBrowserBtn = document.getElementById("modeBrowser");
const modeELBtn = document.getElementById("modeEL");
const browserTtsSettings = document.getElementById("browserTtsSettings");
const elSettingsPanel = document.getElementById("elSettings");
const elApiKeyInput = document.getElementById("elApiKey");
const elVoiceSelect = document.getElementById("elVoiceSelect");
const elStatusEl = document.getElementById("elStatus");

function setTtsMode(mode) {
    if (mode === "elevenlabs") {
        modeBrowserBtn.classList.remove("active");
        modeELBtn.classList.add("active");
        browserTtsSettings.style.display = "none";
        elSettingsPanel.classList.add("visible");
    } else {
        modeELBtn.classList.remove("active");
        modeBrowserBtn.classList.add("active");
        browserTtsSettings.style.display = "";
        elSettingsPanel.classList.remove("visible");
    }
    chrome.storage.sync.set({ ttsMode: mode }, flashSaved);
}

modeBrowserBtn.addEventListener("click", () => setTtsMode("browser"));
modeELBtn.addEventListener("click", () => setTtsMode("elevenlabs"));

// Load saved mode
chrome.storage.sync.get(
    { ttsMode: "browser", elApiKey: "", elVoiceId: "" },
    (data) => {
        if (data.ttsMode === "elevenlabs") setTtsMode("elevenlabs");
        if (data.elApiKey) {
            elApiKeyInput.value = data.elApiKey;
            loadELVoices(data.elApiKey, data.elVoiceId);
        }
    },
);

// Save API key on change & load voices
let elKeyDebounce = null;
elApiKeyInput.addEventListener("input", () => {
    clearTimeout(elKeyDebounce);
    elKeyDebounce = setTimeout(() => {
        const key = elApiKeyInput.value.trim();
        chrome.storage.sync.set({ elApiKey: key }, flashSaved);
        if (key) loadELVoices(key);
    }, 600);
});

// Load ElevenLabs voices
async function loadELVoices(apiKey, selectedVoiceId) {
    elStatusEl.textContent = "Ładowanie głosów…";
    elStatusEl.className = "el-status";
    try {
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const voices = data.voices || [];
        elVoiceSelect.innerHTML = "";
        voices.forEach((v) => {
            const opt = document.createElement("option");
            opt.value = v.voice_id;
            const labels = v.labels ? Object.values(v.labels).join(", ") : "";
            opt.textContent = `${v.name}${labels ? " (" + labels + ")" : ""}`;
            if (v.voice_id === selectedVoiceId) opt.selected = true;
            elVoiceSelect.appendChild(opt);
        });
        elStatusEl.textContent = `✓ Załadowano ${voices.length} głosów`;
        elStatusEl.className = "el-status ok";
        // Auto-select first if none selected
        if (!selectedVoiceId && voices.length) {
            chrome.storage.sync.set({ elVoiceId: voices[0].voice_id });
        }
    } catch (err) {
        elStatusEl.textContent = `✗ Błąd: ${err.message}`;
        elStatusEl.className = "el-status err";
        elVoiceSelect.innerHTML = '<option value="">— Błąd API —</option>';
    }
}

elVoiceSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ elVoiceId: elVoiceSelect.value }, flashSaved);
});

// ── Filter state ──────────────────────────────────────────────────
let currentFilter = "all";

document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll(".filter-btn")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        loadWords();
    });
});

// ── Time helpers ──────────────────────────────────────────────────
function startOfDay() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return d.getTime();
}
function startOfMonth() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d.getTime();
}

// ── Filter words ──────────────────────────────────────────────────
function filterWords(words) {
    switch (currentFilter) {
        case "today":
            return words.filter((w) => w.timestamp >= startOfDay());
        case "week":
            return words.filter((w) => w.timestamp >= startOfWeek());
        case "month":
            return words.filter((w) => w.timestamp >= startOfMonth());
        case "new":
            return words.filter((w) => !w.downloaded);
        default:
            return words;
    }
}

// ── Load & render words ───────────────────────────────────────────
function loadWords() {
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const all = data.savedWords || [];
        const filtered = filterWords(all);

        statsEl.textContent = `${filtered.length} z ${all.length} słów`;

        if (filtered.length === 0) {
            wordListEl.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <div>Brak zapisanych słów</div>
                </div>`;
            return;
        }

        // Sort newest first
        const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

        wordListEl.innerHTML = sorted
            .map((w, i) => {
                const date = new Date(w.timestamp).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const isNew = !w.downloaded ? " new-item" : "";
                let sentenceHtml = "";
                if (w.sentence) {
                    const esc = escapeHtml(w.sentence);
                    const escWord = escapeHtml(w.original);
                    const highlighted = esc.replace(
                        new RegExp(
                            `(${escWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                            "i",
                        ),
                        '<span class="wi-cloze">$1</span>',
                    );
                    sentenceHtml = `<div class="wi-sentence">${highlighted}</div>`;
                    if (w.sentenceTranslated) {
                        sentenceHtml += `<div class="wi-sentence" style="color:rgba(255,255,255,0.25);">${escapeHtml(w.sentenceTranslated)}</div>`;
                    }
                }
                return `<div class="word-item${isNew}" data-index="${i}">
                    <div class="wi-texts">
                        <div class="wi-original">${escapeHtml(w.original)}</div>
                        <div class="wi-translated">${escapeHtml(w.translated)}</div>
                        ${sentenceHtml}
                        <div class="wi-meta">${date} · ${(w.srcLang || "?").toUpperCase()}→${(w.tgtLang || "?").toUpperCase()}</div>
                    </div>
                    <button class="wi-delete" data-original="${escapeAttr(w.original)}" data-ts="${w.timestamp}" title="Usuń">✕</button>
                </div>`;
            })
            .join("");

        // Delete handlers
        wordListEl.querySelectorAll(".wi-delete").forEach((btn) => {
            btn.addEventListener("click", () => {
                const orig = btn.dataset.original;
                const ts = parseInt(btn.dataset.ts);
                deleteWord(orig, ts);
            });
        });
    });
}

// ── Delete word ───────────────────────────────────────────────────
function deleteWord(original, timestamp) {
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const words = data.savedWords.filter(
            (w) => !(w.original === original && w.timestamp === timestamp),
        );
        chrome.storage.local.set({ savedWords: words }, loadWords);
    });
}

// ── Google TTS URL helper ─────────────────────────────────────────
function googleTtsUrl(text, lang) {
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
}

// ── Fetch audio as blob ───────────────────────────────────────────
async function fetchAudioBlob(text, lang) {
    try {
        const url = googleTtsUrl(text, lang);
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.blob();
    } catch {
        return null;
    }
}

// ── Simple ZIP builder (no library needed) ────────────────────────
function buildZip(files) {
    // files: [{name: string, data: Uint8Array}]
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const file of files) {
        const nameBytes = new TextEncoder().encode(file.name);
        const data = file.data;

        // Local file header
        const local = new Uint8Array(30 + nameBytes.length + data.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true); // signature
        lv.setUint16(4, 20, true); // version needed
        lv.setUint16(6, 0, true); // flags
        lv.setUint16(8, 0, true); // compression (store)
        lv.setUint16(10, 0, true); // mod time
        lv.setUint16(12, 0, true); // mod date
        lv.setUint32(14, crc32(data), true); // crc32
        lv.setUint32(18, data.length, true); // compressed size
        lv.setUint32(22, data.length, true); // uncompressed size
        lv.setUint16(26, nameBytes.length, true); // name length
        lv.setUint16(28, 0, true); // extra length
        local.set(nameBytes, 30);
        local.set(data, 30 + nameBytes.length);
        localHeaders.push(local);

        // Central directory header
        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true);
        cv.setUint16(14, 0, true);
        cv.setUint32(16, crc32(data), true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0x20, true); // external attrs
        cv.setUint32(42, offset, true); // local header offset
        central.set(nameBytes, 46);
        centralHeaders.push(central);

        offset += local.length;
    }

    const centralSize = centralHeaders.reduce((s, c) => s + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const total = offset + centralSize + 22;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const lh of localHeaders) {
        result.set(lh, pos);
        pos += lh.length;
    }
    for (const ch of centralHeaders) {
        result.set(ch, pos);
        pos += ch.length;
    }
    result.set(eocd, pos);
    return result;
}

function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// ── Export: Anki Cloze with audio (.zip) ──────────────────────────
document.getElementById("exportAnki").addEventListener("click", async () => {
    const btn = document.getElementById("exportAnki");
    const origText = btn.textContent;
    btn.textContent = "⏳ Pobieram audio…";
    btn.disabled = true;

    try {
        const data = await new Promise((r) =>
            chrome.storage.local.get({ savedWords: [] }, r),
        );
        const words = filterWords(data.savedWords || []);
        if (words.length === 0) {
            btn.textContent = origText;
            btn.disabled = false;
            return;
        }

        const files = [];
        const lines = [];

        for (let i = 0; i < words.length; i++) {
            const w = words[i];

            // Build Cloze text: sentence with the word as {{c1::word::translation}}
            let clozeText;
            if (w.sentence) {
                // Replace the word in sentence with cloze deletion
                const regex = new RegExp(
                    `(${w.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                    "i",
                );
                clozeText = w.sentence.replace(
                    regex,
                    `{{c1::$1::${w.translated}}}`,
                );
            } else {
                clozeText = `{{c1::${w.original}::${w.translated}}}`;
            }

            // Back side: translation + sentence translation + audio
            let backText = w.translated;
            if (w.sentenceTranslated) {
                backText += `<br><br><i>${w.sentenceTranslated}</i>`;
            }

            // One sound on back only: sentence audio if sentence exists, otherwise word audio
            const audioText = w.sentence || w.original;
            const slug = audioText
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_|_$/g, "")
                .substring(0, 40);
            const ts = (w.timestamp || Date.now()).toString(36);
            const audioFile = `qt_${slug}_${ts}.mp3`;
            backText += ` [sound:${audioFile}]`;
            lines.push(`${clozeText}\t${backText}`);

            // Fetch TTS audio – only what we need
            const ttsLang = w.srcLang || "en";
            if (w.sentence) {
                const sentenceBlob = await fetchAudioBlob(w.sentence, ttsLang);
                if (sentenceBlob) {
                    const audioData = new Uint8Array(
                        await sentenceBlob.arrayBuffer(),
                    );
                    files.push({ name: audioFile, data: audioData });
                }
            } else {
                const wordBlob = await fetchAudioBlob(w.original, ttsLang);
                if (wordBlob) {
                    const audioData = new Uint8Array(
                        await wordBlob.arrayBuffer(),
                    );
                    files.push({ name: audioFile, data: audioData });
                }
            }
        }

        // Add the text file
        const txtContent = lines.join("\n");
        const txtData = new TextEncoder().encode(txtContent);
        files.push({ name: `anki-cloze-${dateTag()}.txt`, data: txtData });

        // Build and download ZIP
        const zipData = buildZip(files);
        const blob = new Blob([zipData], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `anki-cloze-${dateTag()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Mark as downloaded
        markAsDownloaded(words, data.savedWords);
    } catch (err) {
        console.error("Anki export error:", err);
        alert("Błąd eksportu: " + err.message);
    } finally {
        btn.textContent = origText;
        btn.disabled = false;
    }
});

// ── Export: CSV (Excel) ───────────────────────────────────────────
document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const words = filterWords(data.savedWords || []);
        if (words.length === 0) return;

        // BOM for Excel UTF-8
        const BOM = "\uFEFF";
        const header = "Oryginał;Tłumaczenie;Język źr.;Język doc.;Data;URL";
        const rows = words.map((w) => {
            const date = new Date(w.timestamp).toLocaleString("pl-PL");
            return [
                csvCell(w.original),
                csvCell(w.translated),
                w.srcLang || "",
                w.tgtLang || "",
                date,
                w.url || "",
            ].join(";");
        });
        const content = BOM + header + "\n" + rows.join("\n");
        downloadFile(
            content,
            `translator-export-${dateTag()}.csv`,
            "text/csv;charset=utf-8",
        );

        // Mark as downloaded
        markAsDownloaded(words, data.savedWords);
    });
});

// ── Clear visible words ───────────────────────────────────────────
document.getElementById("clearAll").addEventListener("click", () => {
    if (!confirm("Usunąć widoczne słowa?")) return;
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const toRemove = new Set(
            filterWords(data.savedWords).map(
                (w) => w.original + "|" + w.timestamp,
            ),
        );
        const remaining = data.savedWords.filter(
            (w) => !toRemove.has(w.original + "|" + w.timestamp),
        );
        chrome.storage.local.set({ savedWords: remaining }, loadWords);
    });
});

// ── Mark exported words as downloaded ─────────────────────────────
function markAsDownloaded(exportedWords, allWords) {
    const exportedSet = new Set(
        exportedWords.map((w) => w.original + "|" + w.timestamp),
    );
    const updated = allWords.map((w) => {
        if (exportedSet.has(w.original + "|" + w.timestamp)) {
            return { ...w, downloaded: true };
        }
        return w;
    });
    chrome.storage.local.set({ savedWords: updated }, loadWords);
}

// ── Download helper ───────────────────────────────────────────────
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Utils ─────────────────────────────────────────────────────────
function dateTag() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function csvCell(str) {
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

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

// ═══════════════════════════════════════════════════════════════════
//  SPACED REPETITION  –  Step-based intervals (1d→3d→7d→14d→30d→90d)
// ═══════════════════════════════════════════════════════════════════

// ── Interval steps (in days): 1d → 3d → 7d → 14d → 30d → 90d ────
const SR_STEPS = [1, 3, 7, 14, 30, 90];

// ── In-session delays (in minutes) for grades 1-4 ────────────────
const SESSION_DELAYS = {
    1: 1, // Nie wiem  → 1 minuta
    2: 3, // Źle       → 3 minuty
    3: 10, // Trudne    → 10 minut
    4: 60, // OK        → 1 godzina
};

/**
 * Calculate new SR data after rating.
 *
 * Grades 1-4 → short in-session delay (minutes), step goes DOWN or stays.
 *   1 (Nie wiem)  → reset step to 0, come back in 1 min
 *   2 (Źle)       → step - 2 (min 0), come back in 3 min
 *   3 (Trudne)    → step - 1 (min 0), come back in 10 min
 *   4 (OK)        → stay at same step, come back in 1 hour
 *
 * Grade 5 (Łatwe) → advance step, next review in days (1d→3d→7d→…)
 */
function srUpdate(sr, grade) {
    let step = sr.step;

    if (grade === 5) {
        // Advance to next long-term step
        step = step + 1;
        const intervalDays = getIntervalForStep(step);
        return {
            step,
            interval: intervalDays,
            nextReview: Date.now() + intervalDays * 24 * 60 * 60 * 1000,
            lastReview: Date.now(),
        };
    }

    // Grades 1-4: short delay, adjust step downward
    if (grade === 1) {
        step = 0;
    } else if (grade === 2) {
        step = Math.max(0, step - 2);
    } else if (grade === 3) {
        step = Math.max(0, step - 1);
    }
    // grade 4: step stays

    const delayMinutes = SESSION_DELAYS[grade];
    return {
        step,
        interval: sr.interval, // keep last long-term interval for reference
        nextReview: Date.now() + delayMinutes * 60 * 1000,
        lastReview: Date.now(),
    };
}

/** Get interval in days for a given step */
function getIntervalForStep(step) {
    if (step < SR_STEPS.length) return SR_STEPS[step];
    // Beyond last step: keep growing (90 * 1.5^n)
    const extra = step - SR_STEPS.length + 1;
    return Math.round(SR_STEPS[SR_STEPS.length - 1] * Math.pow(1.5, extra));
}

/** Preview what the next review time label will be for a given grade */
function previewLabel(sr, grade) {
    if (grade === 5) {
        const step = sr.step + 1;
        const days = getIntervalForStep(step);
        return formatIntervalDays(days);
    }
    const mins = SESSION_DELAYS[grade];
    return formatIntervalMinutes(mins);
}

function formatIntervalDays(days) {
    if (days <= 1) return "1 dzień";
    if (days < 7) return `${days} dni`;
    if (days === 7) return "1 tydz.";
    if (days < 30) {
        const w = Math.round(days / 7);
        return w === 1 ? "1 tydz." : `${w} tyg.`;
    }
    if (days === 30) return "1 mies.";
    const m = Math.round(days / 30);
    return m === 1 ? "1 mies." : `${m} mies.`;
}

function formatIntervalMinutes(mins) {
    if (mins < 60) return `${mins} min`;
    const h = Math.round(mins / 60);
    return h === 1 ? "1 godz." : `${h} godz.`;
}

// ── Review state ──────────────────────────────────────────────────
let reviewQueue = [];
let reviewIndex = 0;
let reviewAnswerShown = false;
let reviewTotalDue = 0;

// ── Default SR data for words that don't have it ──────────────────
function ensureSR(word) {
    if (!word.sr) {
        word.sr = {
            step: 0,
            interval: 0,
            nextReview: 0,
            lastReview: null,
        };
    }
    // Migrate old SM-2 format → new step format
    if (word.sr.step === undefined) {
        // Try to guess step from old interval
        const oldInterval = word.sr.interval || 0;
        let step = 0;
        for (let i = SR_STEPS.length - 1; i >= 0; i--) {
            if (oldInterval >= SR_STEPS[i]) {
                step = i;
                break;
            }
        }
        word.sr = {
            step,
            interval: word.sr.interval || 0,
            nextReview: word.sr.nextReview || 0,
            lastReview: word.sr.lastReview || null,
        };
    }
    return word;
}

// ── Load due reviews ──────────────────────────────────────────────
function loadReviewQueue() {
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const words = data.savedWords || [];
        const now = Date.now();

        reviewQueue = words
            .filter((w) => {
                if (!w.sr) return true;
                return w.sr.nextReview <= now;
            })
            .map(ensureSR);

        // Shuffle
        for (let i = reviewQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [reviewQueue[i], reviewQueue[j]] = [reviewQueue[j], reviewQueue[i]];
        }

        reviewTotalDue = reviewQueue.length;
        reviewIndex = 0;
        reviewAnswerShown = false;
        renderReview();
    });
}

// ── Badge on review tab ───────────────────────────────────────────
function updateReviewTabBadge(count) {
    const tab = document.getElementById("tabReview");
    if (!tab) return;
    if (count > 0) {
        tab.innerHTML = `🧠 Powtórki <span class="tab-badge">${count}</span>`;
    } else {
        tab.textContent = "🧠 Powtórki";
    }
}

// ── On popup open → load badge count ──────────────────────────────
function initReviewBadge() {
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const words = data.savedWords || [];
        const now = Date.now();
        const dueCount = words.filter((w) => {
            if (!w.sr) return true;
            return w.sr.nextReview <= now;
        }).length;
        updateReviewTabBadge(dueCount);
    });
}
initReviewBadge();

// ── Render review card ────────────────────────────────────────────
function renderReview() {
    const card = document.getElementById("reviewCard");
    const countEl = document.getElementById("reviewCount");
    const progressBar = document.getElementById("reviewProgressBar");

    if (reviewQueue.length === 0) {
        countEl.textContent = "";
        progressBar.style.width = "100%";
        card.innerHTML = `
            <div class="review-empty">
                <div class="review-empty-icon">✅</div>
                <div class="review-empty-text">Brak słów do powtórki!</div>
                <div class="review-empty-sub">Dodaj nowe słowa lub wróć później.</div>
            </div>`;
        updateReviewTabBadge(0);
        return;
    }

    if (reviewIndex >= reviewQueue.length) {
        countEl.textContent = `${reviewTotalDue}/${reviewTotalDue}`;
        progressBar.style.width = "100%";
        card.innerHTML = `
            <div class="review-done">
                <div class="review-done-icon">🎉</div>
                <div class="review-done-text">Gratulacje!</div>
                <div class="review-done-sub">Wykonałeś wszystkie ${reviewTotalDue} powtórek na dziś!</div>
            </div>`;
        updateReviewTabBadge(0);
        return;
    }

    const w = reviewQueue[reviewIndex];
    countEl.textContent = `${reviewIndex + 1}/${reviewTotalDue}`;
    progressBar.style.width = `${Math.round((reviewIndex / reviewTotalDue) * 100)}%`;

    if (!reviewAnswerShown) {
        card.innerHTML = `
            <div class="review-question">
                <div class="review-word">${escapeHtml(w.original)}</div>
                ${w.sentence ? `<div class="review-context">${escapeHtml(w.sentence)}</div>` : ""}
                <div class="review-meta">${(w.srcLang || "?").toUpperCase()} → ${(w.tgtLang || "?").toUpperCase()}</div>
            </div>
            <button class="review-reveal-btn" id="revealBtn">▸ Pokaż odpowiedź</button>
            <div class="review-hint">Naciśnij <kbd>Spacja</kbd> aby odsłonić</div>`;

        document
            .getElementById("revealBtn")
            .addEventListener("click", revealAnswer);
    } else {
        renderAnswer(w);
    }
}

function revealAnswer() {
    reviewAnswerShown = true;
    renderAnswer(reviewQueue[reviewIndex]);
}

function renderAnswer(w) {
    const card = document.getElementById("reviewCard");
    const sr = w.sr || { step: 0, interval: 0 };

    // Preview labels for each grade
    const labels = [1, 2, 3, 4, 5].map((g) => previewLabel(sr, g));

    card.innerHTML = `
        <div class="review-question">
            <div class="review-word">${escapeHtml(w.original)}</div>
            ${w.sentence ? `<div class="review-context">${escapeHtml(w.sentence)}</div>` : ""}
        </div>
        <div class="review-answer">
            <div class="review-translation">${escapeHtml(w.translated)}</div>
            ${w.sentenceTranslated ? `<div class="review-sentence-trans">${escapeHtml(w.sentenceTranslated)}</div>` : ""}
        </div>
        <div class="review-rating">
            <div class="review-rating-label">Jak dobrze znałeś?</div>
            <div class="review-rating-buttons">
                <button class="review-rate-btn rate-1" data-grade="1" title="Nie pamiętam">
                    <span class="rate-key">1</span>
                    <span class="rate-label">Nie wiem</span>
                    <span class="review-next-info">${labels[0]}</span>
                </button>
                <button class="review-rate-btn rate-2" data-grade="2" title="Źle">
                    <span class="rate-key">2</span>
                    <span class="rate-label">Źle</span>
                    <span class="review-next-info">${labels[1]}</span>
                </button>
                <button class="review-rate-btn rate-3" data-grade="3" title="Trudne">
                    <span class="rate-key">3</span>
                    <span class="rate-label">Trudne</span>
                    <span class="review-next-info">${labels[2]}</span>
                </button>
                <button class="review-rate-btn rate-4" data-grade="4" title="OK">
                    <span class="rate-key">4</span>
                    <span class="rate-label">OK</span>
                    <span class="review-next-info">${labels[3]}</span>
                </button>
                <button class="review-rate-btn rate-5" data-grade="5" title="Łatwe">
                    <span class="rate-key">5</span>
                    <span class="rate-label">Łatwe</span>
                    <span class="review-next-info">${labels[4]}</span>
                </button>
            </div>
            <div class="review-hint">Klawisze <kbd>1</kbd>-<kbd>5</kbd> = ocena</div>
        </div>`;

    // Attach rating handlers
    card.querySelectorAll(".review-rate-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            rateWord(parseInt(btn.dataset.grade));
        });
    });
}

// ── Rate word & update storage ────────────────────────────────────
function rateWord(grade) {
    const w = reviewQueue[reviewIndex];
    ensureSR(w);

    // Apply SR update
    w.sr = srUpdate(w.sr, grade);

    // Persist
    chrome.storage.local.get({ savedWords: [] }, (data) => {
        const words = data.savedWords || [];
        const idx = words.findIndex(
            (x) => x.original === w.original && x.translated === w.translated,
        );
        if (idx !== -1) {
            words[idx].sr = w.sr;
            chrome.storage.local.set({ savedWords: words }, () => {
                if (grade < 5) {
                    // Grades 1-4: re-insert word later in the queue
                    // so it comes back again in this session
                    reviewQueue.splice(reviewIndex, 1);
                    // Insert a few cards later (or at end if queue is short)
                    const insertAt = Math.min(
                        reviewIndex + 2 + Math.floor(Math.random() * 3),
                        reviewQueue.length,
                    );
                    reviewQueue.splice(insertAt, 0, w);
                    // Don't increment reviewIndex – current index now has next word
                    reviewTotalDue = reviewQueue.length;
                } else {
                    // Grade 5: word is done, advance
                    reviewIndex++;
                }
                reviewAnswerShown = false;
                renderReview();
            });
        } else {
            // word may have been deleted – just advance
            reviewIndex++;
            reviewAnswerShown = false;
            renderReview();
        }
    });
}

// ── Keyboard shortcuts for review (1-5 = rate, Space = reveal) ───
document.addEventListener("keydown", (e) => {
    const reviewTab = document.getElementById("tab-review");
    if (!reviewTab || !reviewTab.classList.contains("active")) return;
    if (reviewIndex >= reviewQueue.length || reviewQueue.length === 0) return;

    if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (!reviewAnswerShown) revealAnswer();
    }

    if (reviewAnswerShown && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        rateWord(parseInt(e.key));
    }
});
