import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔥 Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",
  authDomain: "watch-party-d3f69.firebaseapp.com",
  databaseURL: "https://watch-party-d3f69-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "watch-party-d3f69",
  storageBucket: "watch-party-d3f69.firebasestorage.app",
  messagingSenderId: "568073707307",
  appId: "1:568073707307:web:b45e8f9e3f4770c09fef6e"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

const roomRef = ref(db, "room");

// 🕒 Horloge réseau Firebase
let serverTimeOffset = 0;

const offsetRef = ref(db, ".info/serverTimeOffset");

onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

function getNetworkTime() {
  return Date.now() + serverTimeOffset;
}

// 🎥 Video.js
const player = videojs("video", {
  controls: true,
  preload: "auto",
  playsinline: true,
  fluid: true,
  responsive: true,
  fill: true,
  liveui: false,

  controlBar: {
    volumePanel: {
      inline: false
    }
  },

  html5: {

    // ✅ Safari/iPhone/iPad utilisent le lecteur natif
    vhs: {
      overrideNative: !videojs.browser.IS_SAFARI
    },

    nativeVideoTracks: videojs.browser.IS_SAFARI,
    nativeAudioTracks: videojs.browser.IS_SAFARI,
    nativeTextTracks: videojs.browser.IS_SAFARI
  }
});

// 🎭 DOM
const videoUrl = document.getElementById("videoUrl");

const hostBtn = document.getElementById("hostBtn");

const joinBtn = document.getElementById("joinBtn");

const syncBtn = document.getElementById("syncBtn");

const statusEl = document.getElementById("status");

// 🎭 State
let isHost = false;

let syncing = false;

let forceMutedForAutoplay = false;

let pushTimeout;

// 📢 Status
function setStatus(text) {
  statusEl.innerText = text;
}

// ⏱️ Wait player ready
function waitPlayerReady() {

  return new Promise((resolve) => {

    if (player.readyState() >= 1) {
      resolve();
      return;
    }

    player.one("loadedmetadata", resolve);

    // sécurité Safari
    setTimeout(resolve, 4000);
  });
}

// ⏱️ Wait seek
function waitSeeked(timeout = 2000) {

  return new Promise((resolve) => {

    let done = false;

    const finish = () => {

      if (done) return;

      done = true;

      resolve();
    };

    player.one("seeked", finish);

    setTimeout(finish, timeout);
  });
}

// 🎥 Détection type vidéo
async function guessType(url) {

  // HLS
  if (
    url.includes(".m3u8") ||
    url.includes("proxy.taekong.space")
  ) {
    return "application/x-mpegURL";
  }

  // DASH
  if (url.includes(".mpd")) {
    return "application/dash+xml";
  }

  // WEBM
  if (url.includes(".webm")) {
    return "video/webm";
  }

  // OGG
  if (url.includes(".ogg")) {
    return "video/ogg";
  }

  // MP4
  if (url.includes(".mp4")) {
    return "video/mp4";
  }

  // fallback
  return "video/mp4";
}

// 📤 Push Firebase
async function pushState() {

  if (
    !isHost ||
    syncing ||
    !player.src()
  ) {
    return;
  }

  try {

    await set(roomRef, {
      url: player.currentSrc(),
      type: player.currentType(),
      time: player.currentTime(),
      paused: player.paused(),
      updatedAt: getNetworkTime()
    });

  } catch (e) {

    console.error("Erreur Firebase :", e);
  }
}

// 🔄 Debounce
function debouncedPush() {

  clearTimeout(pushTimeout);

  pushTimeout = setTimeout(() => {
    pushState();
  }, 200);
}

// ▶️ HOST
hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) {
    alert("Veuillez entrer une URL vidéo.");
    return;
  }

  isHost = true;

  syncing = true;

  setStatus("👑 Hôte synchronisé");

  try {

    const type = await guessType(url);

    console.log("🎥 Type détecté :", type);

    player.src({
      src: url,
      type
    });

    await waitPlayerReady();

    try {

      await player.play();

    } catch (e) {

      console.warn("Lecture bloquée :", e);

      setStatus("📱 Cliquez sur Play");
    }

    await pushState();

  } catch (e) {

    console.error(e);

    setStatus("❌ Erreur de lecture");

  } finally {

    syncing = false;
  }
};

// 👥 JOIN
joinBtn.onclick = async () => {

  isHost = false;

  setStatus("👥 Spectateur synchronisé");

  try {

    // 🔇 Débloque autoplay iOS
    player.muted(true);

    forceMutedForAutoplay = true;

    await player.play();

    player.pause();

  } catch (e) {

    console.warn("Autoplay init bloqué :", e);
  }

  await forceSync();
};

// 🔄 RESYNC
syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus("👑 Sync envoyée");

  } else {

    await forceSync();

    setStatus("👥 Resynchronisé");
  }
};

// 🎯 APPLY SYNC
async function applySync(data) {

  syncing = true;

  try {

    // 🎥 Nouvelle vidéo
    if (player.currentSrc() !== data.url) {

      player.src({
        src: data.url,
        type: data.type || "video/mp4"
      });

      await waitPlayerReady();
    }

    // 🎯 Temps cible
    const latency =
      (getNetworkTime() - data.updatedAt) / 1000;

    const target =
      data.paused
        ? data.time
        : data.time + latency;

    const current = player.currentTime();

    const drift = target - current;

    // ▶️ PLAY / PAUSE
    if (data.paused !== player.paused()) {

      if (data.paused) {

        player.pause();

      } else {

        try {

          await player.play();

          // 🔊 Réactive le son après autoplay iOS
          if (forceMutedForAutoplay) {

            setStatus("🔇 Cliquez sur le volume");

            forceMutedForAutoplay = false;
          }

        } catch (e) {

          console.warn("Autoplay bloqué :", e);

          setStatus("📱 Cliquez sur Play");
        }
      }
    }

    // 🧠 GROS DESYNC
    if (Math.abs(drift) > 2.5) {

      player.currentTime(target);

      await waitSeeked();
    }

    // 🧠 PETIT DESYNC
    else if (
      Math.abs(drift) > 0.4 &&
      !data.paused
    ) {

      // en retard
      if (drift > 0) {

        player.playbackRate(1.03);

      }

      // en avance
      else {

        player.playbackRate(0.97);
      }

      // retour vitesse normale
      setTimeout(() => {

        player.playbackRate(1);

      }, 1500);
    }

  } catch (e) {

    console.error("Erreur sync :", e);

  } finally {

    setTimeout(() => {

      syncing = false;

    }, 300);
  }
}

// 👂 Firebase listener
onValue(roomRef, async (snap) => {

  const data = snap.val();

  if (
    !data ||
    isHost ||
    syncing
  ) {
    return;
  }

  const latency =
    (getNetworkTime() - data.updatedAt) / 1000;

  const target =
    data.paused
      ? data.time
      : data.time + latency;

  const drift =
    Math.abs(player.currentTime() - target);

  // 🧠 Sync intelligente
  if (

    player.currentSrc() !== data.url ||

    drift > 2.5 ||

    player.paused() !== data.paused
  ) {

    await applySync(data);
  }
});

// 🔄 Force sync
async function forceSync() {

  try {

    const snap = await get(roomRef);

    const data = snap.val();

    if (data) {

      await applySync(data);
    }

  } catch (e) {

    console.error("Erreur forceSync :", e);
  }
}

// 🎮 Events host
player.on("play", pushState);

player.on("pause", pushState);

player.on("seeking", debouncedPush);

player.on("seeked", debouncedPush);

// ⏳ Buffering
player.on("waiting", () => {

  setStatus("⏳ Buffering...");
});

// ▶️ Playing
player.on("playing", () => {

  setStatus(
    isHost
      ? "👑 Hôte synchronisé"
      : "👥 Spectateur synchronisé"
  );
});

// ❤️ Heartbeat
setInterval(() => {

  if (
    isHost &&
    !player.paused()
  ) {

    pushState();
  }

}, 3000);
