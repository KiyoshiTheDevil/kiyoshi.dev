// The two live compartments. Both read public data straight from the browser, no server of our own:
// ListenBrainz and decapi.me answer cross-origin requests. Anything that fails leaves the
// compartment as the page first drew it, so a slow or broken service never shows an error.

// Your ListenBrainz user name. Empty: the compartment keeps its static text.
const LISTENBRAINZ_USER = "";
const TWITCH_USER = "kiyoshi_the_devil";
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
// playing-now first; when nothing is playing, the last listen, labelled as such.
async function updateListening() {
  if (!LISTENBRAINZ_USER) return;
  const base = `https://api.listenbrainz.org/1/user/${encodeURIComponent(LISTENBRAINZ_USER)}`;
  try {
    let label = "Now listening";
    let listen = (await getJson(`${base}/playing-now`))?.payload?.listens?.[0];
    if (!listen) {
      label = "Last listened";
      listen = (await getJson(`${base}/listens?count=1`))?.payload?.listens?.[0];
    }
    const meta = listen?.track_metadata;
    if (!meta) return;
    $("lb-state").textContent = label;
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

function refresh() {
  if (document.hidden) return;
  updateListening();
  updateLive();
}
refresh();
setInterval(refresh, REFRESH_MS);
document.addEventListener("visibilitychange", refresh);
