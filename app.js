// The two live compartments. Both read public data straight from the browser, no server of our own:
// ListenBrainz and decapi.me answer cross-origin requests. Anything that fails leaves the
// compartment as the page first drew it, so a slow or broken service never shows an error.

// Your ListenBrainz user name. Empty: the compartment keeps its static text.
const LISTENBRAINZ_USER = "KiyoshiTheDevil";
const TWITCH_USER = "kiyoshi_the_devil";
// Where Kiyoshi is. The clock and the sky both follow this, not the visitor's own time.
const TIMEZONE = "Europe/Berlin";
const TIMEZONE_LABEL = "my time rn";
// A song lasts a few minutes, so the listening compartment asks often; a stream changes rarely.
const LISTENING_MS = 15_000;
const LIVE_MS = 60_000;

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
// decapi spells the uptime out ("1 hour, 26 minutes, 45 seconds"); the compartment wants "1h 26m".
function shortUptime(text) {
  const part = (unit) => Number((text.match(new RegExp(`(\\d+) ${unit}`)) || [])[1] || 0);
  const d = part("day"), h = part("hour") + d * 24, m = part("minute");
  if (!h && !m) return "a moment";
  return h ? `${h}h ${m}m` : `${m}m`;
}

// decapi answers "<name> is offline" when offline and an uptime otherwise.
async function updateLive() {
  try {
    const uptime = await getText(`https://decapi.me/twitch/uptime/${TWITCH_USER}`);
    const live = !/offline/i.test(uptime) && !/error|not found/i.test(uptime);
    $("live").classList.toggle("is-live", live);
    $("live-watch").hidden = !live;
    if (live) {
      const [game, viewers] = await Promise.all([
        getText(`https://decapi.me/twitch/game/${TWITCH_USER}`).catch(() => ""),
        getText(`https://decapi.me/twitch/viewercount/${TWITCH_USER}`).catch(() => ""),
      ]);
      const count = /^\d+$/.test(viewers) ? Number(viewers) : null;
      $("live-meta").textContent = count === null ? "live" : count.toLocaleString("en-US");
      $("live-word").hidden = count === null;
      $("live-title").textContent = game || "Live on Twitch";
      $("live-sub").textContent = `live for ${shortUptime(uptime)}`;
    } else {
      $("live-meta").textContent = "offline";
      $("live-word").hidden = true;
      $("live-title").textContent = "zzz… (ᴗ_ᴗ)";
      $("live-sub").textContent = "twitch.tv/" + TWITCH_USER;
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

// Gravity for the petals: 1 falls, 0 floats. Zero gravity sets the target; the sky eases toward it,
// so petals slow down and drift off rather than stopping dead.
let gravity = 1, gravityTarget = 1;

function newPetal(anywhere) {
  const drift = Math.random() * Math.PI * 2, float = 0.12 + Math.random() * 0.3;
  return {
    x: Math.random() * W, y: anywhere ? Math.random() * H : -12,
    s: 3.5 + Math.random() * 3.5, r: Math.random() * Math.PI * 2,
    vy: 0.25 + Math.random() * 0.4, vx: 0.15 + Math.random() * 0.3,
    spin: (Math.random() - 0.5) * 0.02, sway: Math.random() * Math.PI * 2,
    a: 0.35 + Math.random() * 0.35,
    // Where this petal drifts once nothing pulls it down: any direction, slowly.
    fx: Math.cos(drift) * float, fy: Math.sin(drift) * float,
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
  makeStars();
}

// ── Stars ────────────────────────────────────────────────────────────────────
// Out at night: fading in from 19:30, all there from 21:30 to 4:30, gone by 6:30. Positions are
// kept as fractions of the window, so a resize keeps the same sky.
let stars = [], starLight = 0;
function makeStars() {
  const n = Math.max(60, Math.min(240, Math.round((W * H) / 7000)));
  stars = Array.from({ length: n }, () => {
    const bright = Math.random() < 0.08;
    return {
      x: Math.random(), y: Math.pow(Math.random(), 1.5),   // more of them high up
      r: bright ? 1.2 + Math.random() * 0.6 : 0.45 + Math.random() * 0.6, bright,
      phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 1.4,
      warm: Math.random() < 0.2,
    };
  });
}

const ease = (x) => x * x * (3 - 2 * x);
function starsAt(hours) {
  if (hours >= 21.5 || hours < 4.5) return 1;
  if (hours >= 19.5) return ease((hours - 19.5) / 2);
  if (hours < 6.5) return ease(1 - (hours - 4.5) / 2);
  return 0;
}

function drawStars(t) {
  if (starLight < 0.01) return;
  for (const s of stars) {
    // Each twinkles on its own beat; lower down, nearer the horizon glow, they are fainter.
    const twinkle = reduceMotion ? 0.85 : 0.6 + 0.4 * Math.sin(t / 1000 * s.speed + s.phase);
    const alpha = starLight * twinkle * (1 - s.y * 0.7);
    const x = s.x * W, y = s.y * H * 0.9;
    ctx.fillStyle = `rgba(${s.warm ? "255, 236, 214" : "236, 240, 255"}, ${alpha.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
    if (s.bright) {
      ctx.fillStyle = `rgba(236, 240, 255, ${(alpha * 0.14).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s.r * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// `?hour=23` shows the sky at another time of day: to look at the night without waiting for it.
const PREVIEW_HOUR = parseFloat(new URLSearchParams(location.search).get("hour"));
function skyHours() {
  if (PREVIEW_HOUR >= 0 && PREVIEW_HOUR < 24) return PREVIEW_HOUR;
  const { h, m } = localNow();
  return h + m / 60;
}

// The gradient is recomputed once a minute; the time of day does not move faster than that.
let skyGradient = null, skyMinute = -1;
function gradientNow() {
  const hours = skyHours();
  const key = Math.floor(hours * 60);
  if (!skyGradient || key !== skyMinute) {
    const [top, bottom] = skyAt(hours);
    starLight = starsAt(hours);
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
  drawStars(t);
  gravity += (gravityTarget - gravity) * 0.015;
  const g = gravity, f = 1 - g;
  for (const p of petals) {
    if (!reduceMotion) {
      p.y += p.vy * g + p.fy * f;
      p.x += (p.vx + Math.sin(t / 1400 + p.sway) * 0.25) * g + p.fx * f;
      // Weightless, they tumble a little more.
      p.r += p.spin * (1 + f * 2);
      if (g > 0.5) {
        if (p.y > H + 12 || p.x > W + 12) Object.assign(p, newPetal(false), { x: Math.random() * W * 1.1 - W * 0.2 });
        else if (p.x < -40 || p.y < -40) Object.assign(p, newPetal(false));
      } else {
        // Floating, a petal that leaves on one side comes back on the other.
        if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
        if (p.y < -12) p.y = H + 12; else if (p.y > H + 12) p.y = -12;
      }
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
      let px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      // Floating, a compartment may be turned: its bounding box is then larger and upright, and
      // the light would land beside the pointer. Turn the pointer back into the compartment's own
      // frame instead. It turns about its centre, which is also the centre of its bounding box.
      const turn = document.documentElement.classList.contains("floating") && parseFloat(el.style.getPropertyValue("--fr"));
      if (turn) {
        const a = -turn * Math.PI / 180, w = el.offsetWidth, h = el.offsetHeight;
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        px = (dx * Math.cos(a) - dy * Math.sin(a) + w / 2) / w;
        py = (dx * Math.sin(a) + dy * Math.cos(a) + h / 2) / h;
      }
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

// ── Zero gravity ─────────────────────────────────────────────────────────────
// A toy: the compartments drift apart and bump into each other and the window edges. They move
// only when grabbed: drag one and let go to throw it. Each compartment is a turning rectangle: collisions test
// its real corners, and a knock off-centre sets it spinning. What is written to the page is only
// the offset from where the grid would put it, so tidying up is the offset springing back to zero.
{
  const btn = $("float-btn"), label = $("float-label"), bento = document.querySelector(".bento");
  const boxes = [...bento.children].filter(el => el.classList.contains("box"));
  const root = document.documentElement;
  const RAD = Math.PI / 180;
  const BOUNCE = .55;      // how much speed survives a knock
  const MAX_SPEED = 16;    // px per frame
  const MAX_SPIN = 3;      // degrees per frame
  const HELD_SPEED = 45;   // px per frame a held compartment can follow the hand
  let bodies = [], on = false, raf = 0, last = 0, settleTimer = 0, grab = null;
  const ptr = { x: 0, y: 0 };

  // Where the grid puts a compartment. offsetLeft/Top ignore transforms, so this holds mid-flight.
  const home = (el) => { const r = bento.getBoundingClientRect(); return { x: r.left + el.offsetLeft, y: r.top + el.offsetTop }; };
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const axes = (b) => { const c = Math.cos(b.a * RAD), s = Math.sin(b.a * RAD); return [[c, s], [-s, c]]; };
  const corners = (b) => {
    const c = Math.cos(b.a * RAD), s = Math.sin(b.a * RAD), hw = b.w / 2, hh = b.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([px, py]) => [b.cx + px * c - py * s, b.cy + px * s + py * c]);
  };
  // Half the width of a turned rectangle, seen along one direction.
  const reach = (b, ux, uy) => { const [[ax, ay], [bx, by]] = axes(b); return b.w / 2 * Math.abs(ax * ux + ay * uy) + b.h / 2 * Math.abs(bx * ux + by * uy); };
  // The speed of one point of a compartment, spin included.
  const pointVel = (b, rx, ry) => { const w = b.va * RAD; return [b.vx - w * ry, b.vy + w * rx]; };
  const push = (b, jx, jy, rx, ry) => { b.vx += jx * b.im; b.vy += jy * b.im; b.va += cross(rx, ry, jx, jy) * b.iI / RAD; };
  // How hard a point is to move along a direction: light, or far from the centre, moves easily.
  const give = (b, rx, ry, nx, ny) => b.im + cross(rx, ry, nx, ny) ** 2 * b.iI;

  function start() {
    clearTimeout(settleTimer);
    root.classList.remove("settling");
    root.classList.add("floating");
    gravityTarget = 0;
    const br = bento.getBoundingClientRect(), mx = br.left + br.width / 2, my = br.top + br.height / 2;
    bodies = boxes.map(el => {
      const h = home(el), w = el.offsetWidth, ht = el.offsetHeight;
      const cx = h.x + w / 2, cy = h.y + ht / 2;
      // Outward from the middle of the box, plus a little chance.
      const dx = cx - mx, dy = cy - my, d = Math.hypot(dx, dy) || 1;
      const sp = .9 + Math.random() * 1.1, m = (w * ht) / 20000;
      return {
        el, w, h: ht, cx, cy, a: 0, m, I: m * (w * w + ht * ht) / 12,
        vx: dx / d * sp + (Math.random() - .5) * .8, vy: dy / d * sp + (Math.random() - .5) * .8,
        va: (Math.random() - .5) * .4,
        // A compartment the window does not show at the start (a long page on a phone) drifts in.
        entering: h.y < 0 || h.x < 0 || h.y + ht > window.innerHeight || h.x + w > window.innerWidth,
      };
    });
    last = performance.now();
    raf = requestAnimationFrame(step);
  }

  function stop() {
    cancelAnimationFrame(raf); raf = 0; grab = null;
    root.classList.add("settling");
    gravityTarget = 1;
    for (const b of bodies) {
      b.el.classList.remove("grabbed");
      b.el.style.setProperty("--fx", "0px");
      b.el.style.setProperty("--fy", "0px");
      b.el.style.setProperty("--fr", "0deg");
    }
    settleTimer = setTimeout(() => {
      root.classList.remove("floating", "settling");
      for (const b of bodies) for (const p of ["--fx", "--fy", "--fr"]) b.el.style.removeProperty(p);
      bodies = [];
    }, 1000);
  }

  function collide(a, c) {
    // Too far apart to touch, whatever their turn.
    if (Math.hypot(c.cx - a.cx, c.cy - a.cy) > (Math.hypot(a.w, a.h) + Math.hypot(c.w, c.h)) / 2) return;
    // Separating axes: two rectangles overlap only if they overlap along all four edge directions.
    // The direction with the least overlap is the way out.
    let depth = Infinity, nx = 0, ny = 0;
    for (const [ux, uy] of [...axes(a), ...axes(c)]) {
      const d = (c.cx - a.cx) * ux + (c.cy - a.cy) * uy;
      const o = reach(a, ux, uy) + reach(c, ux, uy) - Math.abs(d);
      if (o <= 0) return;
      if (o < depth) { depth = o; const s = d < 0 ? -1 : 1; nx = ux * s; ny = uy * s; }
    }
    // Only for the separation: a compartment held against an edge counts as fixed, or the edge would
    // push it straight back into its neighbour and a pile against a wall would never come apart.
    const sa = a.pin && !c.pin ? 0 : a.im, sc = c.pin && !a.pin ? 0 : c.im, total = sa + sc;
    // Where they touch: between the deepest corner of each.
    const dot = ([x, y]) => x * nx + y * ny;
    const pa = corners(a).reduce((p, q) => dot(q) > dot(p) ? q : p);
    const pc = corners(c).reduce((p, q) => dot(q) < dot(p) ? q : p);
    const px = (pa[0] + pc[0]) / 2, py = (pa[1] + pc[1]) / 2;
    a.cx -= nx * depth * sa / total; a.cy -= ny * depth * sa / total;
    c.cx += nx * depth * sc / total; c.cy += ny * depth * sc / total;
    const rax = px - a.cx, ray = py - a.cy, rcx = px - c.cx, rcy = py - c.cy;
    const [vax, vay] = pointVel(a, rax, ray), [vcx, vcy] = pointVel(c, rcx, rcy);
    const vn = (vcx - vax) * nx + (vcy - vay) * ny;
    if (vn >= 0) return;
    const j = -(1 + BOUNCE) * vn / (give(a, rax, ray, nx, ny) + give(c, rcx, rcy, nx, ny));
    push(a, -j * nx, -j * ny, rax, ray);
    push(c, j * nx, j * ny, rcx, rcy);
  }

  // Window edges, tested at the corners: the deepest corner past an edge takes the knock.
  const WALLS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function walls(b, W, H, dt) {
    const M = 8;
    for (const [nx, ny] of WALLS) {
      let deepest = null, pen = 0;
      for (const p of corners(b)) {
        const d = nx === 1 ? M - p[0] : nx === -1 ? p[0] - (W - M) : ny === 1 ? M - p[1] : p[1] - (H - M);
        if (d > pen) { pen = d; deepest = p; }
      }
      if (!deepest) continue;
      const fix = b.entering ? pen * .08 * dt : pen;
      b.cx += nx * fix; b.cy += ny * fix;
      if (!b.entering) b.pin = true;
      const rx = deepest[0] - b.cx, ry = deepest[1] - b.cy;
      const [vx, vy] = pointVel(b, rx, ry);
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        const j = -(1 + BOUNCE) * vn / give(b, rx, ry, nx, ny);
        push(b, j * nx, j * ny, rx, ry);
      }
    }
  }

  // One stretch of time, dt in frames.
  function simulate(dt, W, H) {
    for (const b of bodies) {
      b.im = 1 / b.m; b.iI = 1 / b.I; b.pin = false;
      // A held compartment follows the hand on a stiff spring, but stays a body like the others:
      // pressed against one that is stuck at an edge it stops there instead of passing through.
      if (grab && grab.b === b) {
        b.vx = (ptr.x - grab.ox - b.cx) * .6; b.vy = (ptr.y - grab.oy - b.cy) * .6;
        const s = Math.hypot(b.vx, b.vy);
        if (s > HELD_SPEED) { b.vx *= HELD_SPEED / s; b.vy *= HELD_SPEED / s; }
        b.va *= Math.pow(.85, dt);
        b.cx += b.vx * dt; b.cy += b.vy * dt; b.a += b.va * dt;
        continue;
      }
      // Space has a little air: speed fades slowly, but never to a standstill.
      b.vx *= Math.pow(.993, dt); b.vy *= Math.pow(.993, dt); b.va *= Math.pow(.985, dt);
      const s = Math.hypot(b.vx, b.vy);
      if (s > MAX_SPEED) { b.vx *= MAX_SPEED / s; b.vy *= MAX_SPEED / s; }
      if (s < .12) { b.vx += (Math.random() - .5) * .05 * dt; b.vy += (Math.random() - .5) * .05 * dt; }
      b.va = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, b.va));
      b.cx += b.vx * dt; b.cy += b.vy * dt; b.a += b.va * dt;
    }

    // Several passes: a compartment squeezed between an edge and another needs a few rounds of
    // being pushed back and forth before both sit apart. Edges first, so each pass knows who is held.
    for (let pass = 0; pass < 5; pass++) {
      for (const b of bodies) walls(b, W, H, dt);
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
    }
    for (const b of bodies) {
      walls(b, W, H, dt);
      if (b.entering && corners(b).every(([x, y]) => x >= 0 && y >= 0 && x <= W && y <= H)) b.entering = false;
    }
  }

  function step(now) {
    // A frame's timestamp can lie before the click that started the flight. A negative or zero step
    // would turn the edge springs inside out and fling everything away, so such a frame is skipped.
    const dt = Math.min(3, (now - last) / 16.67);
    if (!(dt > 0)) { raf = requestAnimationFrame(step); return; }
    last = now;
    const W = window.innerWidth, H = window.innerHeight;
    // Three small steps per frame: a fast throw would otherwise sink deep into a neighbour between
    // two frames, deeper than the passes can pull apart.
    for (let i = 0; i < 3; i++) simulate(dt / 3, W, H);

    for (const b of bodies) {
      const h = home(b.el);
      b.el.style.setProperty("--fx", `${(b.cx - b.w / 2 - h.x).toFixed(1)}px`);
      b.el.style.setProperty("--fy", `${(b.cy - b.h / 2 - h.y).toFixed(1)}px`);
      b.el.style.setProperty("--fr", `${b.a.toFixed(2)}deg`);
    }
    raf = requestAnimationFrame(step);
  }

  btn.addEventListener("click", () => {
    on = !on;
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "tidy up" : "zero gravity";
    on ? start() : stop();
  });

  window.addEventListener("pointermove", (e) => {
    if (!grab) return;
    ptr.x = e.clientX; ptr.y = e.clientY;
    if (Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy) > 4) grab.moved = true;
  });

  // Grab and throw. A drag that moved is not a click, so the link underneath does not open.
  bento.addEventListener("pointerdown", (e) => {
    if (!on || e.button !== 0) return;
    const b = bodies.find(b => b.el.contains(e.target));
    if (!b) return;
    ptr.x = e.clientX; ptr.y = e.clientY;
    grab = { b, ox: e.clientX - b.cx, oy: e.clientY - b.cy, sx: e.clientX, sy: e.clientY, moved: false };
    b.el.classList.add("grabbed");
  });
  const release = () => {
    if (!grab) return;
    grab.b.el.classList.remove("grabbed");
    if (grab.moved) window.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
    grab = null;
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  bento.addEventListener("dragstart", (e) => { if (on) e.preventDefault(); });
  document.addEventListener("visibilitychange", () => {
    if (!on) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  });
}

// ── Suggested streamers ──────────────────────────────────────────────────────
// A row of cards that slides out of the Twitch compartment while Kiyoshi is offline. The card
// under the pointer opens into a small profile: banner, live or not, what was streamed, followers.
// Everything comes from decapi, like the rest of the compartment. Pictures and follower counts load
// a moment after the page, so the row is ready before anyone reaches it; live state is asked when
// someone does, at most every two minutes.
const FRIENDS = ["LMary52", "GreekGeekGames", "Warfu_"];
{
  const hand = $("suggest");
  const STEP = 100;    // px from one card to the next
  const GROW = 178;    // px an opened card gains, to its right
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const PEOPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.8 3.5 5.7"/></svg>';

  const cards = FRIENDS.map((name, i) => {
    const a = document.createElement("a");
    a.className = "s-card";
    a.href = `https://twitch.tv/${name.toLowerCase()}`;
    a.target = "_blank"; a.rel = "noopener";
    a.style.setProperty("--i", i);
    a.innerHTML = `<span class="s-face s-closed"><span class="s-av"><span></span></span><span class="s-name"></span></span>
      <span class="s-face s-profile" aria-hidden="true">
        <span class="s-banner"></span>
        <span class="s-body">
          <span class="s-av"><span></span></span>
          <span class="s-head"><span class="s-title"></span><span class="s-pill">offline</span></span>
          <span class="s-game"></span>
          <span class="s-follow"></span>
          <span class="s-btn">Visit channel ↗</span>
        </span>
      </span>`;
    for (const el of a.querySelectorAll(".s-av span")) el.textContent = name[0].toUpperCase();
    a.querySelector(".s-name").textContent = name;
    a.querySelector(".s-title").textContent = name;
    hand.appendChild(a);
    return { name, a, live: false, game: "", uptime: "" };
  });

  // Positions: the opened card keeps its left edge, so it grows away from the pointer instead of
  // sliding out from under it; the cards to its right make room.
  let open = -1;
  const place = () => {
    cards.forEach((c, i) => {
      const x = (i - (cards.length - 1) / 2) * STEP + (open >= 0 && i > open ? GROW : 0);
      c.a.style.setProperty("--x", `${x}px`);
      c.a.classList.toggle("is-open", i === open);
    });
  };
  place();

  const describe = (c) => {
    const q = (s) => c.a.querySelector(s);
    q(".s-pill").textContent = c.live ? `● live${c.uptime ? " · " + shortUptime(c.uptime) : ""}` : "offline";
    const game = q(".s-game");
    game.replaceChildren();
    if (c.game) {
      const b = document.createElement("b");
      b.textContent = c.game;
      game.append(c.live ? "Playing " : "Last streamed ", b);
    }
    c.a.classList.toggle("is-live", c.live);
    c.a.setAttribute("aria-label", `${c.name}, ${c.live ? "live now" : "offline"}${c.game ? ", " + c.game : ""}`);
  };

  setTimeout(() => {
    for (const c of cards) {
      getText(`https://decapi.me/twitch/avatar/${c.name}`).then((url) => {
        if (!/^https:\/\/static-cdn\.jtvnw\.net\//.test(url)) return;
        const img = new Image();
        img.alt = ""; img.decoding = "async"; img.src = url;
        img.onload = () => {
          for (const av of c.a.querySelectorAll(".s-av")) av.replaceChildren(img.cloneNode());
          c.a.querySelector(".s-banner").style.setProperty("--pic", `url("${url}")`);
        };
      }).catch(() => {});
      getText(`https://decapi.me/twitch/followcount/${c.name}`).then((n) => {
        if (!/^\d+$/.test(n)) return;
        c.a.querySelector(".s-follow").innerHTML = PEOPLE;
        c.a.querySelector(".s-follow").append(`${compact.format(Number(n))} followers`);
      }).catch(() => {});
    }
  }, 1200);

  let asked = 0;
  const askLive = () => {
    if (Date.now() - asked < 120_000) return;
    asked = Date.now();
    for (const c of cards) {
      Promise.all([
        getText(`https://decapi.me/twitch/uptime/${c.name}`),
        getText(`https://decapi.me/twitch/game/${c.name}`).catch(() => ""),
      ]).then(([t, game]) => {
        c.live = !/offline/i.test(t) && !/error|not found/i.test(t);
        c.uptime = c.live ? t : "";
        c.game = /error|not found|deprecated/i.test(game) ? "" : game;
        describe(c);
      }).catch(() => {});
    }
  };

  // The Twitch compartment sits at the right edge of the box. In a narrow window the row would
  // reach past the window, so it slides left just far enough to stay whole, opened card included.
  const REACH_RIGHT = (FRIENDS.length - 1) / 2 * STEP + 46 + GROW + 4;
  const fit = () => {
    const r = $("live").getBoundingClientRect(), mid = r.left + r.width / 2;
    const over = mid + REACH_RIGHT - (document.documentElement.clientWidth - 12);
    hand.style.setProperty("--shift", `${Math.round(-Math.max(0, over))}px`);
  };

  cards.forEach((c, i) => {
    c.a.addEventListener("pointerenter", () => { open = i; place(); });
    c.a.addEventListener("focus", () => { open = i; place(); });
  });
  // The opened card stays open while the pointer crosses a gap; it closes with the row.
  const maybeClose = () => setTimeout(() => {
    if (!hand.matches(":hover") && !$("live").matches(":hover") && !hand.matches(":focus-within")) {
      hand.classList.remove("is-out");
      open = -1; place();
    }
  }, 250);
  hand.addEventListener("pointerleave", maybeClose);
  $("live").addEventListener("pointerleave", maybeClose);
  hand.addEventListener("focusout", maybeClose);
  $("live").addEventListener("pointerenter", () => {
    // Only while Kiyoshi is offline. Coming from outside the row starts with every card closed.
    if ($("live").classList.contains("is-live")) return;
    if (!hand.classList.contains("is-out")) { open = -1; place(); }
    fit(); askLive();
    hand.classList.add("is-out");
  });
  hand.addEventListener("focusin", () => { fit(); askLive(); });
}

// A different face each visit, like the share page.
$("lb-kao").textContent = SILENCE[Math.floor(Math.random() * SILENCE.length)];

// Nothing is fetched while the page cannot be seen. Windows also counts a browser window that is
// fully covered by another one as hidden, so coming back to the page (a tab switch, the window in
// front again, a click into it) asks at once instead of waiting for the next round.
function refresh() {
  if (document.hidden) return;
  updateListening();
  updateLive();
}
refresh();
setInterval(() => { if (!document.hidden) updateListening(); }, LISTENING_MS);
setInterval(() => { if (!document.hidden) updateLive(); }, LIVE_MS);
document.addEventListener("visibilitychange", refresh);
window.addEventListener("focus", refresh);
window.addEventListener("pageshow", (e) => { if (e.persisted) refresh(); });
