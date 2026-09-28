// The two live compartments. Both read public data straight from the browser, no server of our own:
// ListenBrainz and decapi.me answer cross-origin requests. Anything that fails leaves the
// compartment as the page first drew it, so a slow or broken service never shows an error.

// Your ListenBrainz user name. Empty: the compartment keeps its static text.
const LISTENBRAINZ_USER = "KiyoshiTheDevil";
const TWITCH_USER = "kiyoshi_the_devil";
// Where Kiyoshi is. The clock and the sky both follow this, not the visitor's own time.
const TIMEZONE = "Europe/Berlin";
const TIMEZONE_LABEL = "my time rn";
const REFRESH_MS = 60_000;

const $ = (id) => document.getElementById(id);

async function getJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return (await r.text()).trim();
}

// ── Now listening ────────────────────────────────────────────────────────────
// Only what is playing right now. When nothing is, the compartment says so, with a kaomoji in
// place of the cover, the same family the Kodama share page uses for its empty links.
const SILENCE = ["(－_－)", "(ᴗ_ᴗ)", "(・_・)", "(￣～￣)", "(ーー;)", "(-_-) zzZ"];

function showSilence() {
  $("lb-state").hidden = true;
  $("lb-track").textContent = "Currently silence";
  $("lb-artist").textContent = "";
  $("lb-cover").style.backgroundImage = "";
  $("lb-cover").classList.add("is-silent");
  $("listening").href = "https://kodama.kiyoshi.dev/";
}

async function updateListening() {
  if (!LISTENBRAINZ_USER) return;
  const base = `https://api.listenbrainz.org/1/user/${encodeURIComponent(LISTENBRAINZ_USER)}`;
  try {
    const listen = (await getJson(`${base}/playing-now`))?.payload?.listens?.[0];
    const meta = listen?.track_metadata;
    if (!meta) { showSilence(); return; }
    $("lb-state").hidden = false;
    $("lb-cover").classList.remove("is-silent");
    $("lb-track").textContent = meta.track_name || "";
    $("lb-artist").textContent = meta.artist_name || "";
    const origin = meta.additional_info?.origin_url;
    if (origin) $("listening").href = origin;
    // Cover art: Kodama submits the YouTube Music link, which carries the video id.
    const vid = origin && (origin.match(/[?&]v=([\w-]{11})/) || [])[1];
    $("lb-cover").style.backgroundImage = vid ? `url("https://i.ytimg.com/vi/${vid}/mqdefault.jpg")` : "";
  } catch { /* keep what is shown */ }
}

// ── Twitch ───────────────────────────────────────────────────────────────────
// decapi answers "<name> is offline" when offline and an uptime otherwise.
async function updateLive() {
  try {
    const uptime = await getText(`https://decapi.me/twitch/uptime/${TWITCH_USER}`);
    const live = !/offline/i.test(uptime) && !/error|not found/i.test(uptime);
    $("live").classList.toggle("is-live", live);
    if (live) {
      const game = await getText(`https://decapi.me/twitch/game/${TWITCH_USER}`).catch(() => "");
      $("live-state").textContent = "Live on Twitch";
      $("live-game").textContent = game || `for ${uptime}`;
    } else {
      $("live-state").textContent = "Offline";
      $("live-game").textContent = "twitch.tv/" + TWITCH_USER;
    }
  } catch { /* keep what is shown */ }
}

// ── Kiyoshi's time ───────────────────────────────────────────────────────────
function localNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find(p => p.type === t)?.value || 0);
  return { h: get("hour") % 24, m: get("minute"), s: get("second") };
}

function updateClock() {
  const { h, m } = localNow();
  $("clock-time").textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  $("clock-zone").textContent = TIMEZONE_LABEL;
  $("clock-h").style.transform = `rotate(${(h % 12) * 30 + m * 0.5}deg)`;
  $("clock-m").style.transform = `rotate(${m * 6}deg)`;
}

// ── The sky ──────────────────────────────────────────────────────────────────
// Key colours through the day at Kiyoshi's place, top and bottom of the window. Kept dark at
// every hour so the compartments stay readable; the time shows in the hue, not the brightness.
const SKY = [
  [0,    "#0c0a16", "#1a1530"],   // night
  [4.5,  "#0f0c1c", "#221a36"],
  [6,    "#2a1834", "#6a3550"],   // dawn
  [7.5,  "#1d2240", "#4a4a6e"],
  [10,   "#16223a", "#2c4566"],   // day
  [16,   "#172238", "#34466a"],
  [18,   "#2a1a32", "#7a4636"],   // dusk
  [19.5, "#211733", "#4b2a45"],
  [21.5, "#120e22", "#241b3a"],   // evening
  [24,   "#0c0a16", "#1a1530"],
];
const hexRgb = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; };

function skyAt(hours) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, t0, b0] = SKY[i], [h1, t1, b1] = SKY[i + 1];
    if (hours >= h0 && hours <= h1) {
      const t = (hours - h0) / (h1 - h0);
      return [mix(t0, t1, t), mix(b0, b1, t)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sky = $("sky");
const ctx = sky.getContext("2d");
let W = 0, H = 0, petals = [];

function newPetal(anywhere) {
  return {
    x: Math.random() * W, y: anywhere ? Math.random() * H : -12,
    s: 3.5 + Math.random() * 3.5, r: Math.random() * Math.PI * 2,
    vy: 0.25 + Math.random() * 0.4, vx: 0.15 + Math.random() * 0.3,
    spin: (Math.random() - 0.5) * 0.02, sway: Math.random() * Math.PI * 2,
    a: 0.35 + Math.random() * 0.35,
  };
}

function resizeSky() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  sky.width = W * d; sky.height = H * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  // A handful, not a storm: roughly one petal per 60 000 square pixels of window.
  const want = Math.max(8, Math.min(26, Math.round((W * H) / 60000)));
  petals = Array.from({ length: want }, () => newPetal(true));
}

// The gradient is recomputed once a minute; the time of day does not move faster than that.
let skyGradient = null, skyMinute = -1;
function gradientNow() {
  const { h, m } = localNow();
  const key = h * 60 + m;
  if (!skyGradient || key !== skyMinute) {
    const [top, bottom] = skyAt(h + m / 60);
    skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    skyGradient.addColorStop(0, top);
    skyGradient.addColorStop(1, bottom);
    skyMinute = key;
  }
  return skyGradient;
}

function drawSky(t) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradientNow();
  ctx.fillRect(0, 0, W, H);
  for (const p of petals) {
    if (!reduceMotion) {
      p.y += p.vy;
      p.x += p.vx + Math.sin(t / 1400 + p.sway) * 0.25;
      p.r += p.spin;
      if (p.y > H + 12 || p.x > W + 12) Object.assign(p, newPetal(false), { x: Math.random() * W * 1.1 - W * 0.2 });
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.fillStyle = `rgba(240, 160, 184, ${p.a})`;
    // A sakura petal as one path: round at the base, two lobes and a small notch at the tip.
    // Drawn, not cut out: cutting would punch a hole through the sky on the same canvas.
    const s = p.s;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.bezierCurveTo(-s, -s * 0.75, s * 0.55, -s * 0.8, s, -s * 0.28);
    ctx.lineTo(s * 0.72, 0);
    ctx.lineTo(s, s * 0.28);
    ctx.bezierCurveTo(s * 0.55, s * 0.8, -s, s * 0.75, -s, 0);
    ctx.fill();
    ctx.restore();
  }
}

let raf = 0;
function loop(t) {
  drawSky(t);
  raf = reduceMotion ? 0 : requestAnimationFrame(loop);
}
resizeSky();
window.addEventListener("resize", () => { resizeSky(); skyGradient = null; if (reduceMotion) drawSky(0); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
  else if (!raf && !reduceMotion) raf = requestAnimationFrame(loop);
});
raf = requestAnimationFrame(loop);
// With reduced motion the sky still follows the hour, just without falling petals.
if (reduceMotion) setInterval(() => drawSky(0), 60_000);

updateClock();
setInterval(updateClock, 15_000);

// ── Hover tilt ───────────────────────────────────────────────────────────────
// Each link compartment leans a little toward the pointer, and the light follows it. Only for a
// real pointer: on touch there is no hover, and a tilt stuck from the last tap looks broken.
// The lean is smaller on wide compartments, where the same angle moves the far edge much more.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
  for (const el of document.querySelectorAll("a.box")) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const max = Math.max(6, Math.min(14, 4200 / r.width));
      el.style.setProperty("--rx", `${((0.5 - py) * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    });
  }
}

// ── Playful links ────────────────────────────────────────────────────────────
// Each letter in its own span so they can hop one after the other. The link keeps its name for
// screen readers through aria-label, since a word read out letter by letter is no name at all.
for (const a of document.querySelectorAll("a.fun")) {
  const text = a.textContent;
  a.setAttribute("aria-label", text);
  a.textContent = "";
  [...text].forEach((c, i) => {
    const span = document.createElement("span");
    span.className = "ch";
    span.style.setProperty("--i", i);
    span.setAttribute("aria-hidden", "true");
    span.textContent = c === " " ? "\u00a0" : c;
    a.appendChild(span);
  });
}

// A different face each visit, like the share page.
$("lb-kao").textContent = SILENCE[Math.floor(Math.random() * SILENCE.length)];

function refresh() {
  if (document.hidden) return;
  updateListening();
  updateLive();
}
refresh();
setInterval(refresh, REFRESH_MS);
document.addEventListener("visibilitychange", refresh);
