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
// 🛠️ FIX IPAD : Suppression du bloc "html5: { vhs... }" qui cassait la lecture native sur iOS/iPadOS
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
function waitPlayerReady() {
  return new Promise(resolve => {
    if (player.readyState() >= 2) return resolve();
    player.one("loadeddata", resolve);
  });
}

function waitSeeked() {
  return new Promise(resolve => {
    player.one("seeked", resolve);
  });
}

// 🧠 Détection intelligente du type vidéo (Uniquement pour l'hôte maintenant)
async function guessType(url) {
  if (url.includes("proxy.taekong.space") || url.includes(".m3u8")) return "application/x-mpegURL";
  if (url.includes(".mpd")) return "application/dash+xml";
  if (url.includes(".mp4")) return "video/mp4";
  if (url.includes(".webm")) return "video/webm";
  if (url.includes(".ogg")) return "video/ogg";

  try {
    const res = await fetch(url);
    const text = await res.text();
    if (text.includes("#EXTM3U")) return "application/x-mpegURL";
    if (text.includes("<MPD")) return "application/dash+xml";
  } catch (e) {
    console.warn("Détection MIME via fetch impossible (CORS probable) :", e);
  }
  return "video/mp4";
}

// 📤 HOST -> Firebase
async function pushState() {
  if (!isHost || !player.src() || syncing) return;

  await set(roomRef, {
    url: player.src(),
    type: player.currentType(), // 🛠️ FIX CHARGEMENT : On sauvegarde le type détecté par l'hôte pour éviter au spectateur de le chercher
    time: player.currentTime(),
    paused: player.paused(),
    updatedAt: getNetworkTime()
  });
}

// ▶️ HOST START
hostBtn.onclick = async () => {
  const url = videoUrl.value.trim();
  if (!url) return alert("Veuillez entrer une URL vidéo.");

  isHost = true;
  setStatus("👑 Hôte (Envoi de la synchro)");
  syncing = true;

  try {
    const type = await guessType(url);
    console.log("🎥 Type détecté :", type);
    
    player.src({ src: url, type });
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

// 🎯 Application de la synchro (Spectateur)
async function applySync(data) {
  syncing = true;

  try {
    // 🛠️ FIX CHARGEMENT : Le spectateur utilise le data.type de l'hôte au lieu de faire une requête fetch
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

    // 1. 🛠️ FIX DÉSYNCHRO PAUSE : Gérer Play/Pause indépendamment du décalage de temps
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

    // 2. 🛠️ FIX SACCADES : Gérer le saut dans le temps seulement si le décalage est supérieur à 2.5s
    if (drift > 2.5 && !data.paused) {
      player.currentTime(target);
      await waitSeeked();
    } else if (drift > 0.5 && data.paused) {
      // Si on est en pause, on veut être précis sur l'image affichée
      player.currentTime(target);
      await waitSeeked();
    }

  } catch (e) {
    console.error("Erreur de synchronisation :", e);
  } finally {
    setTimeout(() => { syncing = false; }, 300);
  }
}

// 👂 Firebase listener
onValue(roomRef, async (snap) => {
  const data = snap.val();
  if (!data || isHost || syncing) return;

  const latency = (getNetworkTime() - data.updatedAt) / 1000;
  const target = data.paused ? data.time : data.time + latency;
  const drift = Math.abs(player.currentTime() - target);

  // Déclencher une synchro si : nouvelle url, décalage énorme, ou changement de statut play/pause
  if (
    player.src() !== data.url ||
    drift > 2.5 || // 🛠️ FIX SACCADES : Tolérance augmentée
    player.paused() !== data.paused
  ) {
    await applySync(data);
  }
});

// 🔄 Force sync
async function forceSync() {
  const snap = await get(roomRef);
  const data = snap.val();
  if (data) await applySync(data);
}

// 🎮 Events HOST
player.on("play", pushState);
player.on("pause", pushState);
player.on("seeked", pushState);

// ⏱️ Heartbeat HOST (Envoie la position régulièrement)
setInterval(() => {
  if (isHost && !player.paused()) {
    pushState();
  }
}, 3000); // 🛠️ OPTIMISATION : Passé de 2000 à 3000ms pour alléger les requêtes réseau
