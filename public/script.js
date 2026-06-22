/* =========================================================
   VideoHub Downloader Premium — Frontend Logic
   NOTE: Auth & VIP state here are simulated with localStorage
   as a frontend-only prototype. Replace with real Supabase
   Auth + Postgres calls when the backend is wired up
   (see /supabase/schema.sql and /lib/supabaseClient.js).
   ========================================================= */

const DB_KEY = "vh_users_db";
const SESSION_KEY = "vh_session_email";
const FREE_DAILY_LIMIT = 20;

/* ---------- tiny localStorage "DB" ---------- */
function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; }
  catch { return {}; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getCurrentUser() {
  const email = localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  const db = loadDB();
  return db[email] || null;
}
function setCurrentUser(user) {
  const db = loadDB();
  db[user.email] = user;
  saveDB(db);
  localStorage.setItem(SESSION_KEY, user.email);
}
function logout() {
  localStorage.removeItem(SESSION_KEY);
  renderAuthState();
  toast("Berhasil keluar", "success");
}

/* ---------- plan helpers ---------- */
function vipIsActive(user) {
  return !!user && user.vip_expired_at && new Date(user.vip_expired_at) > new Date();
}
function currentPlanLabel(user) {
  if (!user) return "Free";
  return vipIsActive(user) ? (user.plan === "trial" ? "VIP Trial" : "VIP") : "Free";
}
function ensureDailyReset(user) {
  if (user.last_download_date !== todayStr()) {
    user.last_download_date = todayStr();
    user.downloads_today = 0;
  }
}
function remainingFreeQuota(user) {
  if (!user) return FREE_DAILY_LIMIT;
  ensureDailyReset(user);
  return Math.max(0, FREE_DAILY_LIMIT - (user.downloads_today || 0));
}

/* ---------- toast ---------- */
function toast(msg, type = "") {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(30px)"; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ===================== AUTH UI ===================== */
const authOverlay   = document.getElementById("auth-overlay");
const upgradeOverlay = document.getElementById("upgrade-overlay");
const dashboardOverlay = document.getElementById("dashboard-overlay");

function openModal(el) { el.classList.add("open"); }
function closeModal(el) { el.classList.remove("open"); }

document.querySelectorAll("#open-login, #open-login-m").forEach(b => b.addEventListener("click", () => { showAuthTab("login"); openModal(authOverlay); }));
document.querySelectorAll("#open-register, #open-register-m").forEach(b => b.addEventListener("click", () => { showAuthTab("register"); openModal(authOverlay); }));
document.getElementById("auth-close").addEventListener("click", () => closeModal(authOverlay));
authOverlay.addEventListener("click", e => { if (e.target === authOverlay) closeModal(authOverlay); });

function showAuthTab(which) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabLogin = document.getElementById("modal-tab-login");
  const tabRegister = document.getElementById("modal-tab-register");
  const isLogin = which === "login";
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
}
document.getElementById("modal-tab-login").addEventListener("click", () => showAuthTab("login"));
document.getElementById("modal-tab-register").addEventListener("click", () => showAuthTab("register"));
document.getElementById("switch-to-register").addEventListener("click", e => { e.preventDefault(); showAuthTab("register"); });
document.getElementById("switch-to-login").addEventListener("click", e => { e.preventDefault(); showAuthTab("login"); });

document.getElementById("register-form").addEventListener("submit", e => {
  e.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const email = document.getElementById("register-email").value.trim().toLowerCase();
  const password = document.getElementById("register-password").value;
  const db = loadDB();
  if (db[email]) { toast("Email sudah terdaftar. Coba masuk.", "error"); return; }

  const isSuperAdmin = email === "muhammadazhar112026@gmail.com";
  const user = {
    username, email, password, // NOTE: prototype only — never store plain passwords in production
    role: isSuperAdmin ? "SUPER_ADMIN" : "user",
    plan: "free",
    vip_expired_at: null,
    trial_used: false,
    downloads_today: 0,
    total_downloads: 0,
    last_download_date: todayStr(),
    history: [],
    created_at: new Date().toISOString(),
  };
  setCurrentUser(user);
  closeModal(authOverlay);
  renderAuthState();
  toast(`Selamat datang, ${username}! 🎉`, "success");
});

document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const db = loadDB();
  const user = db[email];
  if (!user || user.password !== password) { toast("Email atau password salah.", "error"); return; }
  localStorage.setItem(SESSION_KEY, email);
  closeModal(authOverlay);
  renderAuthState();
  toast(`Halo lagi, ${user.username}!`, "success");
});

/* ---------- render auth-dependent UI ---------- */
function renderAuthState() {
  const user = getCurrentUser();
  document.querySelectorAll("[data-auth-out]").forEach(el => el.hidden = !!user);
  document.querySelectorAll("[data-auth-in]").forEach(el => el.hidden = !user);

  if (user) {
    const planLabel = currentPlanLabel(user);
    const isVip = planLabel !== "Free";
    document.getElementById("user-avatar").textContent = user.username[0].toUpperCase();
    document.getElementById("user-name-pill").textContent = user.username;
    const planPill = document.getElementById("user-plan-pill");
    planPill.textContent = planLabel;
    planPill.classList.toggle("vip", isVip);

    document.getElementById("dash-avatar").textContent = user.username[0].toUpperCase();
    document.getElementById("dash-name").textContent = user.username;
    const dashPlan = document.getElementById("dash-plan");
    dashPlan.textContent = planLabel;
    dashPlan.classList.toggle("vip", isVip);
  }

  renderPlanIndicator();
  renderVipCard();
}

/* ===================== TRIAL / VIP ===================== */
function activateTrial() {
  const user = getCurrentUser();
  if (!user) { toast("Daftar atau masuk dulu untuk mencoba VIP gratis.", "error"); showAuthTab("register"); openModal(authOverlay); return; }
  if (user.trial_used) { toast("Trial VIP sudah pernah digunakan di akun ini.", "error"); return; }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 3);
  user.plan = "trial";
  user.vip_expired_at = expiry.toISOString();
  user.trial_used = true;
  setCurrentUser(user);
  renderAuthState();
  toast("🎉 Trial VIP 3 hari aktif! Nikmati 2K/4K & unlimited download.", "success");
}
document.getElementById("trial-cta").addEventListener("click", activateTrial);
document.getElementById("vip-cta").addEventListener("click", activateTrial);

document.querySelectorAll(".price-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const plan = btn.dataset.plan;
    if (plan === "trial") { activateTrial(); return; }
    toast("Pembayaran belum aktif di demo ini — hubungkan payment gateway untuk paket berbayar.", "");
  });
});

function renderPlanIndicator() {
  const user = getCurrentUser();
  const wrap = document.getElementById("plan-indicator");
  const text = document.getElementById("plan-indicator-text");
  const isVip = user && vipIsActive(user);
  wrap.classList.toggle("vip", !!isVip);
  if (!user) {
    text.textContent = `Free Plan · ${FREE_DAILY_LIMIT} download/hari`;
  } else if (isVip) {
    const days = Math.max(0, Math.ceil((new Date(user.vip_expired_at) - new Date()) / 86400000));
    text.textContent = `${currentPlanLabel(user)} · aktif ${days} hari lagi · Unlimited`;
  } else {
    const left = remainingFreeQuota(user);
    text.textContent = `Free Plan · ${left}/${FREE_DAILY_LIMIT} download tersisa hari ini`;
  }
}

function renderVipCard() {
  const user = getCurrentUser();
  const nameEl = document.getElementById("vip-plan-name");
  const detailEl = document.getElementById("vip-plan-detail");
  const noteEl = document.getElementById("vip-plan-note");
  const fill = document.getElementById("vip-progress");

  if (!user) {
    nameEl.textContent = "Free"; detailEl.textContent = "Masuk untuk mengaktifkan trial VIP.";
    fill.style.width = "0%"; noteEl.textContent = "Aktifkan trial 3 hari untuk membuka semua fitur premium.";
    return;
  }
  if (vipIsActive(user)) {
    const totalMs = 3 * 86400000;
    const remainMs = Math.max(0, new Date(user.vip_expired_at) - new Date());
    const pct = user.plan === "trial" ? Math.min(100, ((totalMs - remainMs) / totalMs) * 100) : 100;
    nameEl.textContent = currentPlanLabel(user);
    const days = Math.max(0, Math.ceil(remainMs / 86400000));
    detailEl.textContent = `Aktif hingga ${new Date(user.vip_expired_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} (${days} hari lagi)`;
    fill.style.width = `${pct}%`;
    noteEl.textContent = user.plan === "trial" ? "Trial sedang berjalan — upgrade kapan saja untuk lanjut tanpa batas." : "Semua fitur premium aktif. Terima kasih sudah menjadi VIP!";
  } else {
    nameEl.textContent = "Free";
    detailEl.textContent = user.trial_used ? "Trial sudah berakhir." : "Belum pernah mencoba VIP.";
    fill.style.width = "0%";
    noteEl.textContent = user.trial_used ? "Upgrade ke paket VIP untuk membuka kembali fitur premium." : "Aktifkan trial 3 hari untuk membuka semua fitur premium.";
  }
}

/* ===================== UPGRADE MODAL ===================== */
function showUpgradeModal() { openModal(upgradeOverlay); }
document.getElementById("upgrade-close").addEventListener("click", () => closeModal(upgradeOverlay));
document.getElementById("upgrade-later").addEventListener("click", () => closeModal(upgradeOverlay));
document.getElementById("upgrade-now").addEventListener("click", () => {
  closeModal(upgradeOverlay);
  document.getElementById("pricing").scrollIntoView({ behavior: "smooth" });
});
upgradeOverlay.addEventListener("click", e => { if (e.target === upgradeOverlay) closeModal(upgradeOverlay); });

/* ===================== DASHBOARD ===================== */
function openDashboard() {
  const user = getCurrentUser();
  if (!user) { showAuthTab("login"); openModal(authOverlay); return; }
  ensureDailyReset(user); setCurrentUser(user);

  document.getElementById("dash-today").textContent = vipIsActive(user) ? "Unlimited" : `${user.downloads_today || 0} / ${FREE_DAILY_LIMIT}`;
  document.getElementById("dash-total").textContent = user.total_downloads || 0;
  document.getElementById("dash-vip-expiry").textContent = vipIsActive(user)
    ? new Date(user.vip_expired_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const histWrap = document.getElementById("dash-history");
  const hist = user.history || [];
  histWrap.innerHTML = hist.length
    ? hist.slice(0, 12).map(h => `
        <div class="dash-history-item">
          <span>${escapeHtml(h.title)} · ${h.quality}</span>
          <span>${new Date(h.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
        </div>`).join("")
    : `<p class="dash-empty">Belum ada riwayat download.</p>`;

  openModal(dashboardOverlay);
}
document.getElementById("open-dashboard").addEventListener("click", openDashboard);
document.getElementById("open-dashboard-m").addEventListener("click", openDashboard);
document.getElementById("dashboard-close").addEventListener("click", () => closeModal(dashboardOverlay));
dashboardOverlay.addEventListener("click", e => { if (e.target === dashboardOverlay) closeModal(dashboardOverlay); });
document.getElementById("logout-btn").addEventListener("click", () => { closeModal(dashboardOverlay); logout(); });

function escapeHtml(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ===================== MOBILE MENU ===================== */
const burger = document.getElementById("burger");
const mobileMenu = document.getElementById("mobile-menu");
burger.addEventListener("click", () => mobileMenu.classList.toggle("open"));
mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.remove("open")));

/* ===================== FAQ ===================== */
document.querySelectorAll(".faq-item").forEach(item => {
  item.querySelector(".faq-q").addEventListener("click", () => {
    const wasOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("open"));
    if (!wasOpen) item.classList.add("open");
  });
});

/* =========================================================
   DOWNLOADER LOGIC (TikTok / YouTube)
   ========================================================= */
let currentPlatform = "tiktok";

const tabTiktok   = document.getElementById("tab-tiktok");
const tabYoutube  = document.getElementById("tab-youtube");
const urlInput    = document.getElementById("url-input");
const grabBtn     = document.getElementById("grab-btn");
const clearBtn    = document.getElementById("clear-btn");
const inputHint   = document.getElementById("input-hint");
const loadingEl   = document.getElementById("loading");
const errorBox    = document.getElementById("error-box");
const errorMsgEl  = document.getElementById("error-msg");
const errorDismiss= document.getElementById("error-dismiss");
const resultCard  = document.getElementById("result-card");

function setPlatform(platform) {
  currentPlatform = platform;
  tabTiktok.classList.toggle("active", platform === "tiktok");
  tabTiktok.setAttribute("aria-selected", platform === "tiktok");
  tabYoutube.classList.toggle("active", platform === "youtube");
  tabYoutube.setAttribute("aria-selected", platform === "youtube");

  if (platform === "tiktok") {
    urlInput.placeholder = "Tempel link TikTok di sini...";
    inputHint.textContent = "Mendukung TikTok & TikTok Lite · Tempel URL lalu tekan Download";
  } else {
    urlInput.placeholder = "Tempel link YouTube di sini...";
    inputHint.textContent = "Mendukung YouTube & YouTube Shorts · Tempel URL lalu tekan Download";
  }
  hideAll();
  urlInput.value = "";
  updateClearBtn();
}
tabTiktok.addEventListener("click", () => setPlatform("tiktok"));
tabYoutube.addEventListener("click", () => setPlatform("youtube"));

function updateClearBtn() { clearBtn.classList.toggle("visible", urlInput.value.length > 0); }
urlInput.addEventListener("input", updateClearBtn);
clearBtn.addEventListener("click", () => { urlInput.value = ""; updateClearBtn(); hideAll(); urlInput.focus(); });
errorDismiss.addEventListener("click", () => errorBox.classList.remove("visible"));

urlInput.addEventListener("paste", () => {
  setTimeout(() => {
    const v = urlInput.value.trim();
    if (/tiktok\.com|vm\.tiktok/i.test(v) && currentPlatform !== "tiktok") setPlatform("tiktok");
    else if (/youtube\.com|youtu\.be/i.test(v) && currentPlatform !== "youtube") setPlatform("youtube");
    updateClearBtn();
  }, 60);
});

function hideAll() {
  loadingEl.classList.remove("visible");
  errorBox.classList.remove("visible");
  resultCard.classList.remove("visible");
}
function showLoading() { hideAll(); loadingEl.classList.add("visible"); }
function showError(msg) { hideAll(); errorMsgEl.textContent = msg; errorBox.classList.add("visible"); }

function fmtCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* HD/locked qualities require VIP */
const LOCKED_QUALITIES = ["1440", "2160"];

function makeDlBtn({ label, sublabel, url, badge, extraClass, locked, quality, title }) {
  const el = document.createElement(locked ? "button" : "a");
  el.className = `dl-btn ${extraClass || ""} ${locked ? "locked" : ""}`.trim();
  if (!locked) { el.href = url; el.target = "_blank"; el.rel = "noopener noreferrer"; }
  el.innerHTML = `
    <div class="dl-btn-info">
      <span class="dl-btn-label">${label}</span>
      ${sublabel ? `<span class="dl-btn-sub">${sublabel}</span>` : ""}
    </div>
    ${badge ? `<span class="dl-badge">${locked ? "🔒 VIP" : badge}</span>` : ""}
    <svg class="dl-btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
  `;
  el.addEventListener("click", (e) => {
    if (locked) { e.preventDefault(); showUpgradeModal(); return; }
    handleSuccessfulDownload(title || label, quality || badge || "");
  });
  return el;
}

function handleSuccessfulDownload(title, quality) {
  const user = getCurrentUser();
  if (!user) return; // anonymous downloads aren't tracked/limited in this prototype
  ensureDailyReset(user);
  user.downloads_today = (user.downloads_today || 0) + 1;
  user.total_downloads = (user.total_downloads || 0) + 1;
  user.history = user.history || [];
  user.history.unshift({ title, quality, at: new Date().toISOString() });
  user.history = user.history.slice(0, 50);
  setCurrentUser(user);
  renderPlanIndicator();
}

/* check quota before allowing a fetch */
function canDownloadMore() {
  const user = getCurrentUser();
  if (!user) return true; // allow guest browsing of results in this demo
  if (vipIsActive(user)) return true;
  return remainingFreeQuota(user) > 0;
}

function renderTikTok(data) {
  document.getElementById("result-badge").textContent = "TikTok";
  document.getElementById("result-badge").classList.remove("yt");

  const thumb = document.getElementById("result-thumbnail");
  const frame = document.getElementById("thumb-frame");
  thumb.src = data.cover || "";
  frame.classList.remove("landscape");

  const dur = fmtDuration(data.duration);
  document.getElementById("result-duration").textContent = dur || "";
  document.getElementById("result-duration").style.display = dur ? "" : "none";

  document.getElementById("result-author").textContent = data.author?.username ? `@${data.author.username}` : (data.author?.name || "");
  document.getElementById("result-title").textContent = data.title || "TikTok Video";

  const statsRow = document.getElementById("result-stats");
  const chips = [
    { icon: "▶", v: data.stats?.plays, l: "plays" },
    { icon: "♥", v: data.stats?.likes, l: "likes" },
    { icon: "💬", v: data.stats?.comments, l: "comments" },
  ].filter(c => c.v);
  statsRow.innerHTML = chips.map(c => `<span class="stat-chip">${c.icon} ${fmtCount(c.v)} ${c.l}</span>`).join("");

  const dlGrid = document.getElementById("dl-buttons");
  dlGrid.innerHTML = "";
  const title = data.title || "TikTok Video";

  if (data.downloads?.no_watermark_hd) dlGrid.appendChild(makeDlBtn({ label: "Video HD", sublabel: "Tanpa watermark · kualitas tinggi", url: data.downloads.no_watermark_hd, badge: "HD", extraClass: "primary", title }));
  if (data.downloads?.no_watermark) dlGrid.appendChild(makeDlBtn({ label: "Video SD", sublabel: "Tanpa watermark · ukuran kecil", url: data.downloads.no_watermark, badge: "SD", title }));
  if (data.downloads?.watermark) dlGrid.appendChild(makeDlBtn({ label: "Video", sublabel: "Dengan watermark TikTok", url: data.downloads.watermark, badge: "WM", title }));
  if (data.downloads?.audio) dlGrid.appendChild(makeDlBtn({ label: "Audio / Musik", sublabel: "Ekstrak audio saja", url: data.downloads.audio, badge: "MP3", extraClass: "audio", title }));

  resultCard.classList.add("visible");
}

function renderYouTube(data) {
  const badge = document.getElementById("result-badge");
  badge.textContent = "YouTube";
  badge.classList.add("yt");

  const thumb = document.getElementById("result-thumbnail");
  const frame = document.getElementById("thumb-frame");
  thumb.src = data.thumbnail || `https://img.youtube.com/vi/${data.id}/maxresdefault.jpg`;
  frame.classList.add("landscape");

  const dur = fmtDuration(data.duration);
  document.getElementById("result-duration").textContent = dur || "";
  document.getElementById("result-duration").style.display = dur ? "" : "none";

  document.getElementById("result-author").textContent = data.channel ? `📺 ${data.channel}` : "";
  document.getElementById("result-title").textContent = data.title || "YouTube Video";
  document.getElementById("result-stats").innerHTML = "";

  const dlGrid = document.getElementById("dl-buttons");
  dlGrid.innerHTML = "";
  const downloads = data.downloads || {};
  const title = data.title || "YouTube Video";
  const user = getCurrentUser();
  const isVip = vipIsActive(user);

  const qualities = [
    { key: "2160", label: "Video 4K", sub: "2160p · MP4", badge: "2160p", lockedAlways: true },
    { key: "1440", label: "Video 2K", sub: "1440p · MP4", badge: "1440p", lockedAlways: true },
    { key: "1080", label: "Video Full HD", sub: "1080p · MP4", badge: "1080p", cls: "primary" },
    { key: "720", label: "Video HD", sub: "720p · MP4", badge: "720p" },
    { key: "480", label: "Video SD", sub: "480p · MP4", badge: "480p" },
    { key: "360", label: "Video Low", sub: "360p · MP4", badge: "360p" },
  ];

  let added = false;
  for (const q of qualities) {
    const isLockedQuality = LOCKED_QUALITIES.includes(q.key) && !isVip;
    // 2160/1440 aren't provided by the current API, so VIP users see them as "coming soon" via the same slot but locked for free users
    const url = downloads[q.key];
    if (url || q.lockedAlways) {
      dlGrid.appendChild(makeDlBtn({
        label: q.label, sublabel: q.sub, url: url || "#", badge: q.badge,
        extraClass: q.cls, locked: isLockedQuality || (!url && q.lockedAlways), quality: q.badge, title,
      }));
      added = added || !!url;
    }
  }
  if (downloads["mp3"]) { dlGrid.appendChild(makeDlBtn({ label: "Audio MP3", sublabel: "Hanya audio · kualitas tinggi", url: downloads["mp3"], badge: "MP3", extraClass: "audio", title })); added = true; }

  if (!added) dlGrid.innerHTML = `<p style="font-size:13px;color:var(--text-2);padding:8px 0">Format tidak tersedia. Coba lagi.</p>`;

  resultCard.classList.add("visible");
}

async function fetchVideo() {
  const url = urlInput.value.trim();
  if (!url) { showError("URL tidak boleh kosong. Tempel link video dulu!"); return; }
  if (!url.startsWith("http")) { showError("URL tidak valid. Pastikan dimulai dengan https://"); return; }

  if (!canDownloadMore()) {
    showError(`Batas ${FREE_DAILY_LIMIT} download harian Free Plan tercapai. Upgrade ke VIP untuk unlimited download.`);
    showUpgradeModal();
    return;
  }

  showLoading();
  grabBtn.disabled = true;

  try {
    const endpoint = currentPlatform === "tiktok"
      ? `/api/tiktok?url=${encodeURIComponent(url)}`
      : `/api/youtube?url=${encodeURIComponent(url)}`;

    const res = await fetch(endpoint);
    const json = await res.json();

    if (!json.success) { showError(json.error || "Gagal memproses video. Coba lagi."); return; }

    hideAll();
    if (currentPlatform === "tiktok") renderTikTok(json.data);
    else renderYouTube(json.data);

    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.error(err);
    showError("Gagal terhubung ke server. Pastikan server berjalan.");
  } finally {
    grabBtn.disabled = false;
  }
}
grabBtn.addEventListener("click", fetchVideo);
urlInput.addEventListener("keydown", e => { if (e.key === "Enter") fetchVideo(); });

/* ===================== INIT ===================== */
renderAuthState();
