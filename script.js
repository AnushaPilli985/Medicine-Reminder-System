/* ============================================
   SMART MEDICINE REMINDER - script.js
   Features: LocalStorage, Browser Notifications,
             EmailJS, Real-time clock check
============================================ */

// ──────────────────────────────────────────
// 🔧 CONFIG — Replace with your real values
// ──────────────────────────────────────────
const EMAILJS_CONFIG = {
  publicKey:  "PLx85iggUgmbvXX8h",
  serviceId:  "service_ttaza3p",
  templateId: "template_b6i5ixu",
};

// ──────────────────────────────────────────
// 🗄️  LocalStorage helpers
// ──────────────────────────────────────────

/** Return all saved reminders as an array */
function getReminders() {
  return JSON.parse(localStorage.getItem("medReminders") || "[]");
}

/** Save the full array back to LocalStorage */
function saveReminders(arr) {
  localStorage.setItem("medReminders", JSON.stringify(arr));
}

/** Add a new reminder object */
function addReminder(reminder) {
  const list = getReminders();
  list.push(reminder);
  saveReminders(list);
}

/** Delete a reminder by its id */
function deleteReminder(id) {
  const list = getReminders().filter(r => r.id !== id);
  saveReminders(list);
}

/** Mark a reminder status (pending | taken | missed) */
function updateStatus(id, status) {
  const list = getReminders().map(r => r.id === id ? { ...r, status } : r);
  saveReminders(list);
}

// ──────────────────────────────────────────
// 🔔 Browser Notifications
// ──────────────────────────────────────────

/** Request notification permission on first load */
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/** Show a browser notification */
function showBrowserNotification(reminder) {
  if (Notification.permission !== "granted") return;
  const n = new Notification("💊 Medicine Reminder", {
    body: `Time to take ${reminder.name} — ${reminder.dosage}\n⏰ ${reminder.time}`,
    icon: "https://cdn-icons-png.flaticon.com/512/822/822116.png",
    tag:  reminder.id, // prevents duplicate toasts
  });
  // Auto-close after 8 s
  setTimeout(() => n.close(), 8000);
}

/** Play a soft alert beep using the Web Audio API */
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // silently ignore if audio not available
  }
}

// ──────────────────────────────────────────
// 📧 EmailJS Integration
// ──────────────────────────────────────────

/** Initialise EmailJS with the public key */
function initEmailJS() {
  if (typeof emailjs !== "undefined") {
    emailjs.init(EMAILJS_CONFIG.publicKey);
  }
}

/** Send reminder email via EmailJS */
function sendReminderEmail(reminder) {
  if (typeof emailjs === "undefined") {
    console.warn("EmailJS not loaded.");
    return;
  }
  emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    {
      to_email:      reminder.email,
      medicine_name: reminder.name,
      dosage:        reminder.dosage,
      reminder_time: reminder.time,
      reminder_date: reminder.date,
      notes:         reminder.notes || "—",
    }
  )
  .then(() => console.log(`✅ Email sent to ${reminder.email}`))
  .catch(err => console.error("EmailJS error:", err));
}

// ──────────────────────────────────────────
// ⏰ Real-time Clock Check  (every 30 s)
// ──────────────────────────────────────────

/** Set of IDs already notified this session — avoids duplicates */
const notifiedIds = new Set();

function checkReminders() {
  const now   = new Date();
  const today = now.toISOString().split("T")[0];          // YYYY-MM-DD
  const hhmm  = now.toTimeString().slice(0, 5);           // HH:MM

  getReminders().forEach(r => {
    if (r.status !== "pending") return;                   // skip taken / missed
    if (r.date !== today)       return;                   // not today
    if (r.time !== hhmm)        return;                   // not this minute
    if (notifiedIds.has(r.id))  return;                   // already notified

    // Mark as notified in this session
    notifiedIds.add(r.id);

    // 1. Browser notification + sound
    showBrowserNotification(r);
    playAlertSound();

    // 2. In-page toast
    showToast(`💊 Time to take <strong>${r.name}</strong> (${r.dosage})`, "info");

    // 3. Email
    sendReminderEmail(r);

    // 4. Refresh the list so the card updates (if on index page)
    if (typeof renderReminders === "function") renderReminders();
  });
}

// Live clock display (updates every second)
function startClock() {
  const el = document.getElementById("liveClock");
  if (!el) return;
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };
  tick();
  setInterval(tick, 1000);
}

// ──────────────────────────────────────────
// 🍞 Toast helper
// ──────────────────────────────────────────
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const icon  = type === "success" ? "✅" : type === "error" ? "❌" : "💊";
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 320);
  }, 4000);
}

// ──────────────────────────────────────────
// 📋 INDEX PAGE — Render Reminders
// ──────────────────────────────────────────
function renderReminders() {
  const container = document.getElementById("remindersContainer");
  if (!container) return;

  const list = getReminders();

  // Stats
  const total   = list.length;
  const taken   = list.filter(r => r.status === "taken").length;
  const missed  = list.filter(r => r.status === "missed").length;
  const pending = total - taken - missed;

  const statsEl = document.getElementById("statsStrip");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-pill"><span class="dot dot-pending"></span>${pending} Pending</div>
      <div class="stat-pill"><span class="dot dot-taken"></span>${taken} Taken</div>
      <div class="stat-pill"><span class="dot dot-missed"></span>${missed} Missed</div>
    `;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💊</div>
        <h3>No reminders yet</h3>
        <p>Click <strong>+ Add Reminder</strong> to get started.</p>
      </div>`;
    return;
  }

  // Sort: pending first, then by date-time
  const sorted = [...list].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return  1;
    return (a.date + a.time).localeCompare(b.date + b.time);
  });

  container.innerHTML = sorted.map(r => reminderCardHTML(r)).join("");

  // Attach event listeners
  container.querySelectorAll(".btn-mark-taken").forEach(btn => {
    btn.addEventListener("click", () => {
      updateStatus(btn.dataset.id, "taken");
      renderReminders();
      showToast("Marked as taken! 🎉", "success");
    });
  });
  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this reminder?")) {
        deleteReminder(btn.dataset.id);
        renderReminders();
        showToast("Reminder deleted.", "error");
      }
    });
  });
}

/** Build the HTML string for one reminder card */
function reminderCardHTML(r) {
  const statusClass = `status-${r.status}`;
  const badgeClass  = `badge-${r.status}`;
  const badgeLabel  = r.status === "taken"   ? "✓ Taken"
                    : r.status === "missed"  ? "✗ Missed"
                    : "⏳ Pending";
  const icon = r.status === "taken" ? "✅" : r.status === "missed" ? "❌" : "💊";

  const takenBtnHTML = r.status === "pending"
    ? `<button class="btn btn-success btn-mark-taken" data-id="${r.id}">✓ Taken</button>`
    : "";

  return `
    <div class="reminder-card ${statusClass}">
      <div class="card-icon">${icon}</div>
      <div class="card-body">
        <div class="card-name">${escapeHTML(r.name)}</div>
        <div class="card-meta">
          <span>💊 ${escapeHTML(r.dosage)}</span>
          <span>📅 ${formatDate(r.date)}</span>
          <span>⏰ ${formatTime(r.time)}</span>
          <span>📧 ${escapeHTML(r.email)}</span>
        </div>
        ${r.notes ? `<div class="card-meta" style="margin-top:4px;"><span>📝 ${escapeHTML(r.notes)}</span></div>` : ""}
        <span class="card-status-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="card-actions">
        ${takenBtnHTML}
        <button class="btn btn-danger btn-delete" data-id="${r.id}">🗑 Delete</button>
      </div>
    </div>`;
}

// ──────────────────────────────────────────
// 📝 ADD FORM PAGE — Handle Submit
// ──────────────────────────────────────────
function initAddForm() {
  const form = document.getElementById("addReminderForm");
  if (!form) return;

  // Set default date to today, default time to now + 5 min
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  document.getElementById("fieldDate").value = now.toISOString().split("T")[0];
  document.getElementById("fieldTime").value = now.toTimeString().slice(0, 5);

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const reminder = {
      id:     crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      name:   document.getElementById("fieldName").value.trim(),
      dosage: document.getElementById("fieldDosage").value.trim(),
      date:   document.getElementById("fieldDate").value,
      time:   document.getElementById("fieldTime").value,
      email:  document.getElementById("fieldEmail").value.trim(),
      notes:  document.getElementById("fieldNotes").value.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    if (!reminder.name || !reminder.dosage || !reminder.date || !reminder.time || !reminder.email) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    addReminder(reminder);
    showToast("Reminder saved! 🎉", "success");
    setTimeout(() => window.location.href = "index.html", 1000);
  });
}

// ──────────────────────────────────────────
// 🔢 Utility helpers
// ──────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(h, m, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ──────────────────────────────────────────
// 🚀 Bootstrap — runs on every page
// ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initEmailJS();
  requestNotificationPermission();
  startClock();

  // Index page
  renderReminders();

  // Add form page
  initAddForm();

  // Check reminders every 30 seconds
  checkReminders();
  setInterval(checkReminders, 30_000);
});