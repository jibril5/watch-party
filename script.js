import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

let serverTimeOffset = 0;

const offsetRef = ref(db, ".info/serverTimeOffset");

onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

function getNetworkTime() {
  return Date.now() + serverTimeOffset;
}

// 🎥 Video.js
// Détection des appareils Apple (iPhone, iPad, ou Safari sur Mac)
const isApple = videojs.browser.IS_IOS || videojs.browser.IS_SAFARI;

const player = videojs("video", {
  controls: true,
  preload: "auto",
  playsinline: true, // Crucial pour que l'iPhone ne force pas le plein écran direct
  fluid: true,
  responsive: true,
  fill: true,
  controlBar: {
    volumePanel: {
      inline: false
    }
  },
  // 🛠️ FIX IPHONE / IPAD : On laisse Apple utiliser son propre lecteur natif
  html5: {
    vhs: {
      overrideNative: !isApple
    },
    nativeVideoTracks: false,
    nativeAudioTracks: false,
    nativeTextTracks: false
  }
});

const videoUrl = document.getElementById("videoUrl");

const hostBtn = document.getElementById("hostBtn");

const joinBtn = document.getElementById("joinBtn");

const syncBtn = document.getElementById("syncBtn");

const statusEl = document.getElementById("status");

let isHost = false;

let syncing = false;

function setStatus(text) {
  statusEl.innerText = text;
}

function waitPlayerReady() {

  return new Promise((resolve) => {

    if (player.readyState() >= 1) {
      resolve();
      return;
    }

    player.one("loadedmetadata", resolve);
  });
}

function guessType(url) {

  if (url.includes(".m3u8")) {
    return "application/x-mpegURL";
  }

  if (url.includes(".mpd")) {
    return "application/dash+xml";
  }

  if (url.includes(".webm")) {
    return "video/webm";
  }

  return "video/mp4";
}

async function pushState() {

  if (!isHost || syncing || !player.src()) {
    return;
  }

  await set(roomRef, {
    url: player.currentSrc(),
    time: player.currentTime(),
    paused: player.paused(),
    updatedAt: getNetworkTime()
  });
}

hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) {
    alert("Veuillez entrer une URL.");
    return;
  }

  isHost = true;

  syncing = true;

  setStatus("👑 Hôte synchronisé");

  try {

    const type = guessType(url);

    player.src({
      src: url,
      type
    });

    await waitPlayerReady();

    await player.play();

    await pushState();

  } catch (e) {

    console.error(e);

    setStatus("❌ Impossible de lire la vidéo");

  } finally {

    syncing = false;
  }
};

joinBtn.onclick = async () => {

  isHost = false;

  setStatus("👥 Spectateur synchronisé");

  try {

    player.muted(true);

    await player.play();

    player.pause();

  } catch (e) {}

  await forceSync();
};

syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus("👑 Sync envoyée");

  } else {

    await forceSync();

    setStatus("👥 Resynchronisé");
  }
};

// 🎯 Application de la synchro (Spectateur)
async function applySync(data) {
  syncing = true;

  try {
    // 🛠️ FIX CHARGEMENT : Le spectateur utilise le data.type de l'hôte au lieu de faire un fetch
    if (player.src() !== data.url) {
      player.src({
        src: data.url,
        type: data.type || "video/mp4" // Fallback sécurisé
      });
      await waitPlayerReady();
    }

    const latency = (getNetworkTime() - data.updatedAt) / 1000;
    const target = data.paused ? data.time : data.time + latency;
    const drift = Math.abs(player.currentTime() - target);

    // 1. Gérer Play/Pause instantanément (Indépendant du drift)
    if (data.paused !== player.paused()) {
      if (data.paused) {
        player.pause();
      } else {
        try {
          await player.play();
          if (forceMutedForAutoplay) {
            setStatus("🔇 Vidéo lancée en sourdine (cliquez sur le volume)");
            forceMutedForAutoplay = false;
          }
        } catch (e) {
          setStatus("📱 Autoplay bloqué. Cliquez sur Play.");
        }
      }
    }

    // 2. 🛠️ FIX SACCADES : Gérer le saut dans le temps seulement si le décalage est gros (> 2.5s)
    if (drift > 2.5 && !data.paused) {
      player.currentTime(target);
    } else if (drift > 0.5 && data.paused) {
      // Si en pause, on veut être précis
      player.currentTime(target);
    }

  } catch (e) {
    console.error("Erreur de synchronisation :", e);
  } finally {
    setTimeout(() => { syncing = false; }, 300);
  }
}

onValue(roomRef, async (snap) => {

  const data = snap.val();

  if (!data || isHost || syncing) {
    return;
  }

  await applySync(data);
});

async function forceSync() {

  const snap = await get(roomRef);

  const data = snap.val();

  if (data) {
    await applySync(data);
  }
}

player.on("play", pushState);

player.on("pause", pushState);

player.on("seeked", pushState);

player.on("seeking", pushState);

player.on("waiting", () => {

  setStatus("⏳ Buffering...");
});

player.on("playing", () => {

  setStatus(
    isHost
      ? "👑 Hôte synchronisé"
      : "👥 Spectateur synchronisé"
  );
});

setInterval(() => {

  if (isHost && !player.paused()) {

    pushState();
  }

}, 5000);
