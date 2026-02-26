// background.js – Badge updates & review notifications (Spaced Repetition)

// ── Update badge with number of due reviews ───────────────────────
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
            // Schedule alarm for the next word that becomes due
            scheduleNextDueAlarm(words, now);
        }
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

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updateBadge") updateBadge();
    if (alarm.name === "nextDueReview") updateBadge(); // precise trigger
    if (alarm.name === "reviewNotification") checkAndNotify();
});

// ── Lifecycle events ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

// ── Refresh badge when storage changes ────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.savedWords) {
        updateBadge();
    }
});
