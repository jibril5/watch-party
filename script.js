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

// 🕒 Synchronisation de l'horloge avec le serveur Firebase (CRUCIAL)
let serverTimeOffset = 0;
const offsetRef = ref(db, ".info/serverTimeOffset");
onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

// Retourne l'heure exacte et synchronisée pour tous les utilisateurs
function getNetworkTime() {
  return Date.now() + serverTimeOffset;
}

// 🎥 HTML
const video = document.getElementById("video");
const videoUrl = document.getElementById("videoUrl");
const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const syncBtn = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");

// 🎭 State
let isHost = false;
let syncing = false;
let forceMutedForAutoplay = false; // Nécessaire pour iOS

// 📢 Status
function setStatus(text) {
  statusEl.innerText = text;
}

// ⏱️ Wait helpers
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function waitVideoReady() {
  return new Promise(resolve => {
    if (video.readyState >= 2) return resolve();
    video.addEventListener("loadeddata", resolve, { once: true });
  });
}

function waitSeeked() {
  return new Promise(resolve => {
    video.addEventListener("seeked", resolve, { once: true });
  });
}

// 📤 HOST -> Firebase
async function pushState() {
  if (!isHost || !video.src || syncing) return;

  await set(roomRef, {
    url: video.src,
    time: video.currentTime,
    paused: video.paused,
    updatedAt: getNetworkTime() // On utilise l'heure réseau !
  });
}

// ▶️ HOST START
hostBtn.onclick = async () => {
  const url = videoUrl.value.trim();
  if (!url) return alert("Veuillez entrer une URL vidéo.");

  isHost = true;
  setStatus("👑 Hôte (Envoi de la synchro)");
  syncing = true; // Empêche les boucles d'événements pendant l'init

  try {
    video.src = url;
    await waitVideoReady();
    await video.play();
    await pushState();
  } catch (e) {
    console.error("Erreur de lancement :", e);
    setStatus("❌ Erreur de lecture");
  } finally {
    syncing = false;
  }
};

// 👥 JOIN
joinBtn.onclick = async () => {
  isHost = false;
  setStatus("👥 Spectateur (Synchronisé)");

  // IMPORTANT iOS : Débloque la vidéo avec une interaction utilisateur
  try {
    video.muted = true; // Mute garantit l'autorisation de lecture sur iOS
    forceMutedForAutoplay = true;
    await video.play();
    video.pause();
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

// 🎯 VRAIE sync robuste
async function applySync(data) {
  syncing = true; // Verrouille les événements locaux

  try {
    // 1. Nouvelle vidéo ?
    if (video.src !== data.url) {
      video.src = data.url;
      await waitVideoReady();
    }

    // 2. Calcul du temps cible
    const latency = (getNetworkTime() - data.updatedAt) / 1000;
    
    // CORRECTION BUG MAJEUR : on n'ajoute la latence QUE si la vidéo est en cours de lecture
    const target = data.paused ? data.time : data.time + latency;

    // 3. Application du temps si l'écart est significatif (> 0.5s)
    const drift = Math.abs(video.currentTime - target);
    
    if (drift > 0.5 || video.paused !== data.paused) {
      video.pause();
      video.currentTime = target;
      await waitSeeked();
      
      // Double correction pour les navigateurs capricieux (Safari)
      if (Math.abs(video.currentTime - target) > 0.3) {
        video.currentTime = target;
        await waitSeeked();
      }

      // 4. Gestion Play/Pause
      if (!data.paused) {
        try {
          await video.play();
          if (forceMutedForAutoplay) {
             setStatus("🔇 Vidéo lancée en sourdine (Cliquez sur le volume)");
             forceMutedForAutoplay = false; // Affiche le message une seule fois
          }
        } catch (e) {
          setStatus("📱 Autoplay bloqué. Cliquez sur Play.");
        }
      } else {
        video.pause();
      }
    }
  } catch (e) {
    console.error("Erreur de synchronisation:", e);
  } finally {
    // On libère le verrou avec un léger délai pour ignorer les événements résiduels
    setTimeout(() => { syncing = false; }, 300);
  }
}

// 👂 Firebase listener (Spectateurs uniquement)
onValue(roomRef, async snap => {
  const data = snap.val();
  if (!data || isHost || syncing) return;

  const latency = (getNetworkTime() - data.updatedAt) / 1000;
  const target = data.paused ? data.time : data.time + latency;
  const drift = Math.abs(video.currentTime - target);

  // Tolérance plus stricte (0.8s) pour une synchro "Pro"
  if (video.src !== data.url || drift > 0.8 || video.paused !== data.paused) {
    await applySync(data);
  }
});

// 🔄 Force sync
async function forceSync() {
  const snap = await get(roomRef);
  const data = snap.val();
  if (data) await applySync(data);
}

// 🎮 HOST controls
video.addEventListener("play", pushState);
video.addEventListener("pause", pushState);
video.addEventListener("seeked", pushState);

// ⏱️ Sync permanente HOST (Heartbeat)
setInterval(() => {
  if (isHost && !video.paused) {
    pushState();
  }
}, 2000);
