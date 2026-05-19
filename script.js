import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔥 Firebase Config
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

// 🕒 Temps Serveur
let serverTimeOffset = 0;
const offsetRef = ref(db, ".info/serverTimeOffset");
onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

function getNetworkTime() {
  return Date.now() + serverTimeOffset;
}

// 🎥 Éléments HTML
const video = document.getElementById("video");
const videoUrl = document.getElementById("videoUrl");
const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const syncBtn = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");
const videoOverlay = document.getElementById("videoOverlay");

// 🎭 État Global de l'application
let isHost = false;
let syncing = false; // Devient true quand une opération de synchronisation automatique est en cours
let lastServerState = null; // Stocke le dernier état valide dicté par l'hôte

function setStatus(text) {
  statusEl.innerText = text;
}

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

// 📤 Émission de l'état (RÉSERVÉ À L'HÔTE)
async function pushState() {
  if (!isHost || !video.src || syncing) return;

  await set(roomRef, {
    url: video.src,
    time: video.currentTime,
    paused: video.paused,
    updatedAt: getNetworkTime()
  });
}

// 👑 Action : Devenir Hôte
hostBtn.onclick = async () => {
  const url = videoUrl.value.trim();
  if (!url) return alert("Veuillez entrer une URL vidéo.");

  isHost = true;
  videoOverlay.classList.add("hidden"); // L'hôte n'a pas de restriction de clic
  setStatus("👑 Mode : Hôte");
  syncing = true;

  try {
    video.src = url;
    await waitVideoReady();
    await video.play();
    await pushState();
  } catch (e) {
    console.error(e);
    setStatus("❌ Erreur de lecture vidéo");
  } finally {
    syncing = false;
  }
};

// 👥 Action : Rejoindre en tant que Spectateur
joinBtn.onclick = async () => {
  isHost = false;
  videoOverlay.classList.remove("hidden"); // On active la barrière anti-clic pour le viewer
  setStatus("👥 Mode : Spectateur (Synchronisé)");

  // Déblocage obligatoire du moteur audio/vidéo d'iOS Safari par interaction utilisateur
  try {
    video.muted = true; 
    await video.play();
    video.pause();
    setStatus("👥 Spectateur (Audio coupé pour Autoplay, réactivez le son si besoin)");
  } catch (e) {
    console.warn("Autoplay restreint détecté", e);
  }

  await forceSync();
};

// 🔄 Bouton de resynchronisation manuelle
syncBtn.onclick = async () => {
  if (isHost) {
    await pushState();
    setStatus("👑 Sync hôte rafraîchie");
  } else {
    await forceSync();
    setStatus("👥 Resync spectateur effectuée");
  }
};

// 🎯 Application de l'état reçu depuis Firebase (Pour les Viewers)
async function applySync(data) {
  syncing = true; // On verrouille l'écouteur d'événements locaux pour éviter les boucles infinies

  try {
    if (video.src !== data.url) {
      video.src = data.url;
      await waitVideoReady();
    }

    const latency = (getNetworkTime() - data.updatedAt) / 1000;
    const target = data.paused ? data.time : data.time + latency;
    const drift = Math.abs(video.currentTime - target);

    // Si l'écart de temps ou d'état de lecture est trop grand, on réajuste
    if (drift > 0.6 || video.paused !== data.paused) {
      
      if (video.paused !== data.paused) {
        data.paused ? video.pause() : tryPlay();
      }

      video.currentTime = target;
      await waitSeeked();

      // Double vérification spécifique aux lenteurs de Safari iOS
      if (Math.abs(video.currentTime - target) > 0.3) {
        video.currentTime = target;
        await waitSeeked();
      }

      if (!data.paused) {
        await tryPlay();
      } else {
        video.pause();
      }
    }
  } catch (e) {
    console.error("Erreur d'application de synchro", e);
  } finally {
    // Petit délai de sécurité avant de déverrouiller
    setTimeout(() => { syncing = false; }, 250);
  }
}

async function tryPlay() {
  try {
    await video.play();
  } catch (e) {
    setStatus("📱 Lecture bloquée par le système. Appuyez sur Resync.");
  }
}

// 👂 Écouteur Firebase en temps réel
onValue(roomRef, async (snap) => {
  const data = snap.val();
  if (!data) return;
  
  lastServerState = data; // On garde en mémoire l'état officiel de l'hôte

  if (isHost || syncing) return;

  const latency = (getNetworkTime() - data.updatedAt) / 1000;
  const target = data.paused ? data.time : data.time + latency;
  const drift = Math.abs(video.currentTime - target);

  if (video.src !== data.url || drift > 0.8 || video.paused !== data.paused) {
    await applySync(data);
  }
});

async function forceSync() {
  const snap = await get(roomRef);
  const data = snap.val();
  if (data) {
    lastServerState = data;
    await applySync(data);
  }
}

// ========================================================
// 🛡️ SÉCURISATION ET GESTION DES ÉVÉNEMENTS VIDÉO
// ========================================================

function handleViewerTampering(eventName) {
  // Si le viewer essaie de modifier l'état (play, pause, seek), on le remet à l'ordre immédiatement
  if (!isHost && !syncing && lastServerState) {
    console.warn(`[Protection] Action '${eventName}' bloquée sur le spectateur. Alignement sur l'hôte.`);
    applySync(lastServerState);
  }
}

// Événements déclenchés par l'Hôte -> On pousse sur Firebase
// Événements déclenchés par le Viewer -> On bloque et on réaligne
video.addEventListener("play", () => {
  if (isHost) pushState();
  else handleViewerTampering("play");
});

video.addEventListener("pause", () => {
  if (isHost) pushState();
  else handleViewerTampering("pause");
});

video.addEventListener("seeking", () => {
  if (!isHost) handleViewerTampering("seeking");
});

video.addEventListener("seeked", () => {
  if (isHost) pushState();
  else handleViewerTampering("seeked");
});

// ⏱️ Heartbeat permanent de l'hôte (toutes les 2 secondes)
setInterval(() => {
  if (isHost && !video.paused && !syncing) {
    pushState();
  }
}, 2000);
