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
        }
    } catch (err) {
        console.warn("[QT] Badge update error:", err);
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
chrome.alarms.create("updateBadge", { periodInMinutes: 30 });
chrome.alarms.create("reviewNotification", { periodInMinutes: 360 }); // every 6h

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updateBadge") updateBadge();
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
