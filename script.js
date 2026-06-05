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

// 🕒 Synchronisation horloge Firebase
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

  controlBar: {
    volumePanel: {
      inline: false
    }
  },

  html5: {
    vhs: {
      overrideNative: true
    },

    nativeVideoTracks: false,
    nativeAudioTracks: false,
    nativeTextTracks: false
  }
});

// 🎭 DOM
const videoUrl = document.getElementById("videoUrl");
const hostBtn  = document.getElementById("hostBtn");
const joinBtn  = document.getElementById("joinBtn");
const syncBtn  = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");

// 🎭 State
let isHost = false;
let syncing = false;
let forceMutedForAutoplay = false;

// 📢 Status
function setStatus(text) {
  statusEl.innerText = text;
}

// ⏱️ Helpers
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function waitPlayerReady() {
  return new Promise(resolve => {
    if (player.readyState() >= 2) {
      return resolve();
    }

    player.one("loadeddata", resolve);
  });
}

function waitSeeked() {
  return new Promise(resolve => {
    player.one("seeked", resolve);
  });
}

// 🧠 Détection intelligente du type vidéo
async function guessType(url) {

  // Extensions classiques
  if (url.includes(".m3u8")) {
    return "application/x-mpegURL";
  }

  if (url.includes(".mpd")) {
    return "application/dash+xml";
  }

  if (url.includes(".mp4")) {
    return "video/mp4";
  }

  if (url.includes(".webm")) {
    return "video/webm";
  }

  if (url.includes(".ogg")) {
    return "video/ogg";
  }

  // 🔍 Détection via contenu
  try {

    const res = await fetch(url);

    const text = await res.text();

    if (text.includes("#EXTM3U")) {
      return "application/x-mpegURL";
    }

    if (text.includes("<MPD")) {
      return "application/dash+xml";
    }

  } catch (e) {
    console.warn("Détection MIME impossible :", e);
  }

  // Fallback
  return "video/mp4";
}

// 📤 HOST -> Firebase
async function pushState() {

  if (!isHost || !player.src() || syncing) {
    return;
  }

  await set(roomRef, {
    url: player.src(),
    time: player.currentTime(),
    paused: player.paused(),
    updatedAt: getNetworkTime()
  });
}

// ▶️ HOST START
hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) {
    return alert("Veuillez entrer une URL vidéo.");
  }

  isHost = true;

  setStatus("👑 Hôte (Envoi de la synchro)");

  syncing = true;

  try {

    const type = await guessType(url);

    console.log("🎥 Type détecté :", type);

    player.src({
      src: url,
      type
    });

    await waitPlayerReady();

    await player.play();

    await pushState();

  } catch (e) {

    console.error("Erreur de lecture :", e);

    setStatus("❌ Erreur de lecture");

  } finally {

    syncing = false;
  }
};

// 👥 JOIN
joinBtn.onclick = async () => {

  isHost = false;

  setStatus("👥 Spectateur (Synchronisé)");

  // Débloque autoplay iOS
  try {

    player.muted(true);

    forceMutedForAutoplay = true;

    await player.play();

    player.pause();

  } catch (e) {

    console.warn("Autoplay initial bloqué", e);
  }

  await forceSync();
};

// 🔄 RESYNC
syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus("👑 Hôte (Sync forcée envoyée)");

  } else {

    await forceSync();

    setStatus("👥 Spectateur (Resync manuelle)");
  }
};

// 🎯 Application de la synchro
async function applySync(data) {

  syncing = true;

  try {

    // Nouvelle source ?
    if (player.src() !== data.url) {

      const type = await guessType(data.url);

      console.log("🎥 Type détecté :", type);

      player.src({
        src: data.url,
        type
      });

      await waitPlayerReady();
    }

    // Temps cible
    const latency = (getNetworkTime() - data.updatedAt) / 1000;

    const target = data.paused
      ? data.time
      : data.time + latency;

    const drift = Math.abs(player.currentTime() - target);

    // Correction si nécessaire
    if (
      drift > 0.5 ||
      player.paused() !== data.paused
    ) {

      player.pause();

      player.currentTime(target);

      await waitSeeked();

      // Double correction Safari
      if (Math.abs(player.currentTime() - target) > 0.3) {

        player.currentTime(target);

        await waitSeeked();
      }

      // Play / Pause
      if (!data.paused) {

        try {

          await player.play();

          if (forceMutedForAutoplay) {

            setStatus("🔇 Vidéo lancée en sourdine (cliquez sur le volume)");

            forceMutedForAutoplay = false;
          }

        } catch (e) {

          console.warn("Autoplay bloqué :", e);

          setStatus("📱 Autoplay bloqué. Cliquez sur Play.");
        }

      } else {

        player.pause();
      }
    }

  } catch (e) {

    console.error("Erreur de synchronisation :", e);

  } finally {

    setTimeout(() => {

      syncing = false;

    }, 300);
  }
}

// 👂 Firebase listener
onValue(roomRef, async (snap) => {

  const data = snap.val();

  if (!data || isHost || syncing) {
    return;
  }

  const latency =
    (getNetworkTime() - data.updatedAt) / 1000;

  const target = data.paused
    ? data.time
    : data.time + latency;

  const drift =
    Math.abs(player.currentTime() - target);

  if (
    player.src() !== data.url ||
    drift > 0.8 ||
    player.paused() !== data.paused
  ) {

    await applySync(data);
  }
});

// 🔄 Force sync
async function forceSync() {

  const snap = await get(roomRef);

  const data = snap.val();

  if (data) {
    await applySync(data);
  }
}

// 🎮 Events HOST
player.on("play", pushState);
player.on("pause", pushState);
player.on("seeked", pushState);

// ⏱️ Heartbeat HOST
setInterval(() => {

  if (isHost && !player.paused()) {

    pushState();
  }

}, 2000);
