// background.js – Badge updates, review notifications & cross-device sync

// ══════════════════════════════════════════════════════════════════
//  Cross-device sync (chrome.storage.sync, chunked)
// ══════════════════════════════════════════════════════════════════
const SYNC_CHUNK_MAX = 7000; // chars per chunk (under QUOTA_BYTES_PER_ITEM 8192)
let _skipSyncPush = false; // flag to prevent push→pull→push loop

function wordKey(w) {
    return (w.original || "") + "|" + (w.translated || "");
}

/** Push local savedWords → sync (chunked strings) */
async function pushWordsToSync(words) {
    try {
        // Remove old chunks first
        const old = await chrome.storage.sync.get(null);
        const oldKeys = Object.keys(old).filter((k) => k.startsWith("sw_"));
        if (oldKeys.length) await chrome.storage.sync.remove(oldKeys);

        // Serialize & chunk
        const json = JSON.stringify(
            words.map((w) => ({
                o: w.original,
                t: w.translated,
                s: w.sentence || "",
                st: w.sentenceTranslated || "",
                sl: w.srcLang || "",
                tl: w.tgtLang || "",
                ts: w.timestamp || 0,
                url: w.url || "",
                dl: w.downloaded || false,
                sr: w.sr || null,
            })),
        );

        const chunks = {};
        let i = 0;
        for (let pos = 0; pos < json.length; pos += SYNC_CHUNK_MAX) {
            chunks[`sw_${i}`] = json.slice(pos, pos + SYNC_CHUNK_MAX);
            i++;
        }
        chunks.sw_n = i;
        chunks.sw_ts = Date.now();

        await chrome.storage.sync.set(chunks);
    } catch (err) {
        // Quota exceeded or other error – non-fatal
        console.warn("[QT] Sync push failed (quota?):", err.message || err);
    }
}

/** Pull words from sync storage → array (or null on failure) */
async function pullWordsFromSync() {
    try {
        const data = await chrome.storage.sync.get(null);
        const count = data.sw_n || 0;
        if (count === 0) return null;

        let json = "";
        for (let i = 0; i < count; i++) {
            json += data[`sw_${i}`] || "";
        }
        const arr = JSON.parse(json);
        return arr.map((c) => ({
            original: c.o,
            translated: c.t,
            sentence: c.s || "",
            sentenceTranslated: c.st || "",
            srcLang: c.sl || "",
            tgtLang: c.tl || "",
            timestamp: c.ts || 0,
            url: c.url || "",
            downloaded: c.dl || false,
            sr: c.sr || null,
        }));
    } catch (err) {
        console.warn("[QT] Sync pull failed:", err);
        return null;
    }
}

/**
 * Merge two word arrays. Union by key, most-recent SR wins.
 * Returns merged array.
 */
function mergeWords(localWords, syncWords) {
    const map = new Map();

    for (const w of localWords) {
        map.set(wordKey(w), { ...w });
    }

    for (const sw of syncWords) {
        const key = wordKey(sw);
        const existing = map.get(key);
        if (!existing) {
            map.set(key, sw); // new word from other device
        } else {
            // Keep the SR data that is more recent
            const eLR = existing.sr?.lastReview || 0;
            const sLR = sw.sr?.lastReview || 0;
            if (sLR > eLR) {
                existing.sr = sw.sr;
            }
            // Also fill in missing fields
            if (!existing.sentence && sw.sentence)
                existing.sentence = sw.sentence;
            if (!existing.sentenceTranslated && sw.sentenceTranslated)
                existing.sentenceTranslated = sw.sentenceTranslated;
        }
    }
    return Array.from(map.values());
}

// Debounce push to avoid hammering sync API
let _pushTimer = null;
function debouncedPushToSync(words) {
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => pushWordsToSync(words), 2000);
}

/** Handle incoming sync changes from another device */
async function onSyncChanged(changes) {
    // Only react to our word-sync keys
    if (!changes.sw_n && !changes.sw_ts) return;

    const syncWords = await pullWordsFromSync();
    if (!syncWords) return;

    const localData = await chrome.storage.local.get({ savedWords: [] });
    const localWords = localData.savedWords || [];

    const merged = mergeWords(localWords, syncWords);

    // Only write if something actually changed
    if (
        merged.length !== localWords.length ||
        JSON.stringify(merged) !== JSON.stringify(localWords)
    ) {
        _skipSyncPush = true; // prevent push back
        await chrome.storage.local.set({ savedWords: merged });
        _skipSyncPush = false;
    }
}

// ══════════════════════════════════════════════════════════════════
//  Initial sync on startup
// ══════════════════════════════════════════════════════════════════
async function initialSync() {
    const syncWords = await pullWordsFromSync();
    const localData = await chrome.storage.local.get({ savedWords: [] });
    const localWords = localData.savedWords || [];

    if (syncWords && syncWords.length > 0) {
        const merged = mergeWords(localWords, syncWords);
        if (
            merged.length !== localWords.length ||
            JSON.stringify(merged) !== JSON.stringify(localWords)
        ) {
            _skipSyncPush = true;
            await chrome.storage.local.set({ savedWords: merged });
            _skipSyncPush = false;
        }
    } else if (localWords.length > 0) {
        // No sync data yet – push local words for the first time
        await pushWordsToSync(localWords);
    }
}

// ══════════════════════════════════════════════════════════════════
//  Badge updates
// ══════════════════════════════════════════════════════════════════
async function updateBadge() {
    try {
        const data = await chrome.storage.local.get({ savedWords: [] });
        const words = data.savedWords || [];
        const now = Date.now();
        const dueCount = words.filter((w) => {
            if (!w.sr) return true; // old word without SR data – due
            return w.sr.nextReview <= now;
        }).length;

        if (dueCount > 0) {
            chrome.action.setBadgeText({ text: String(dueCount) });
            chrome.action.setBadgeBackgroundColor({ color: "#4a6cf7" });
        } else {
            chrome.action.setBadgeText({ text: "" });
        }
        // Always schedule alarm for the next word that becomes due
        scheduleNextDueAlarm(words, now);
    } catch (err) {
        console.warn("[QT] Badge update error:", err);
    }
}

// ── Schedule alarm for the exact moment the next review is due ────
async function scheduleNextDueAlarm(words, now) {
    // Find the soonest future nextReview
    let soonest = Infinity;
    for (const w of words) {
        if (w.sr && w.sr.nextReview > now && w.sr.nextReview < soonest) {
            soonest = w.sr.nextReview;
        }
    }

    // Clear old precise alarm
    await chrome.alarms.clear("nextDueReview");

    if (soonest < Infinity) {
        const delayMs = soonest - now;
        // Chrome alarms minimum is ~0.5 min, so use at least that
        const delayMinutes = Math.max(delayMs / 60000, 0.5);
        chrome.alarms.create("nextDueReview", { delayInMinutes: delayMinutes });
    }
}

// ── Notification for reviews ──────────────────────────────────────
async function checkAndNotify() {
    try {
        const data = await chrome.storage.local.get({ savedWords: [] });
        const words = data.savedWords || [];
        const now = Date.now();
        const dueCount = words.filter((w) => {
            if (!w.sr) return true;
            return w.sr.nextReview <= now;
        }).length;

        if (dueCount > 0) {
            chrome.notifications.create("reviewReminder", {
                type: "basic",
                iconUrl: "icon128.png",
                title: "Quick Translator – Powtórki",
                message: `Masz ${dueCount} słów do powtórki! 🧠`,
                priority: 1,
            });
        }
    } catch (err) {
        console.warn("[QT] Notification error:", err);
    }
}

// ── Alarms ────────────────────────────────────────────────────────
chrome.alarms.create("updateBadge", { periodInMinutes: 5 });
chrome.alarms.create("reviewNotification", { periodInMinutes: 360 }); // every 6h

/** Notify all tabs that reviews just became due */
async function notifyTabsReviewDue(dueCount) {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.id) {
                chrome.tabs
                    .sendMessage(tab.id, {
                        type: "QT_REVIEW_DUE",
                        count: dueCount,
                    })
                    .catch(() => {}); // tab may not have content script
            }
        }
    } catch (e) {
        // ignore
    }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "updateBadge") updateBadge();
    if (alarm.name === "nextDueReview") {
        // This alarm fires exactly when a review becomes due
        const data = await chrome.storage.local.get({ savedWords: [] });
        const words = data.savedWords || [];
        const now = Date.now();
        const dueCount = words.filter((w) => {
            if (!w.sr) return false; // new words without SR – don't notify
            return w.sr.nextReview <= now;
        }).length;
        if (dueCount > 0) {
            notifyTabsReviewDue(dueCount);
        }
        updateBadge();
    }
    if (alarm.name === "reviewNotification") checkAndNotify();
});

// ── Lifecycle events ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    initialSync().then(updateBadge);
});
chrome.runtime.onStartup.addListener(() => {
    initialSync().then(updateBadge);
});

// ── Refresh badge & push sync when storage changes ────────────────
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.savedWords) {
        updateBadge();
        // Push to sync (unless we just merged from sync)
        if (!_skipSyncPush) {
            const newWords = changes.savedWords.newValue || [];
            debouncedPushToSync(newWords);
        }
    }
    if (area === "sync") {
        onSyncChanged(changes);
    }
});
