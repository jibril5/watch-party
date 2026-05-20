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

// 🕒 Synchronisation de l'horloge avec le serveur Firebase
let serverTimeOffset = 0;
const offsetRef = ref(db, ".info/serverTimeOffset");
onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

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
let pendingData = null; // 💡 Stocke la dernière mise à jour reçue pendant qu'un chargement est en cours

// 📢 Status
function setStatus(text) {
  statusEl.innerText = text;
}

// ⏱️ Wait helpers avec Timeouts de sécurité (Évite que Safari ne bloque indéfiniment)
function waitVideoReady() {
  return new Promise(resolve => {
    if (video.readyState >= 2) return resolve();
    const onReady = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(() => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    }, 5000);
    video.addEventListener("loadeddata", onReady, { once: true });
  });
}

function waitSeeked() {
  return new Promise(resolve => {
    const onSeeked = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }, 3000);
    video.addEventListener("seeked", onSeeked, { once: true });
  });
}

// 📤 HOST -> Firebase
async function pushState() {
  if (!isHost || !video.src || syncing) return;

  await set(roomRef, {
    url: video.src,
    time: video.currentTime,
    paused: video.paused,
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

  try {
    video.muted = true;
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

// 🎯 Application de la synchronisation (Optimisée iOS)
async function applySync(data) {
  syncing = true;
  pendingData = null; // On nettoie la mémoire tampon au début du traitement

  try {
    // 1. Changement de vidéo
    if (video.src !== data.url) {
      video.src = data.url;
      await waitVideoReady();
    }

    // 2. Calcul du temps cible initial
    let latency = (getNetworkTime() - data.updatedAt) / 1000;
    let target = data.paused ? data.time : data.time + latency;
    let drift = Math.abs(video.currentTime - target);

    // 3. Si l'écart est notable (> 1 seconde) ou changement d'état (Play/Pause)
    if (drift > 1.0 || video.paused !== data.paused) {
      
      // Si c'est un grand saut (ex: 10 min), on force la pause le temps du saut pour aider iOS
      if (drift > 5) video.pause();

      const seekStart = getNetworkTime();
      video.currentTime = target;
      await waitSeeked();

      // CORRECTION IPHONE : Compensation du temps passé à charger le réseau pendant le seek !
      if (!data.paused) {
        const timeSpentSeeking = (getNetworkTime() - seekStart) / 1000;
        if (timeSpentSeeking > 0.3) {
          // Micro-ajustement pour rattraper les secondes perdues pendant le chargement
          video.currentTime = target + timeSpentSeeking;
          await waitSeeked();
        }
      }

      // 4. Gestion finale de la lecture
      if (!data.paused) {
        try {
          await video.play();
          if (forceMutedForAutoplay) {
            setStatus("🔇 Vidéo lancée en sourdine (Cliquez sur le volume)");
            forceMutedForAutoplay = false;
          }
        } catch (e) {
          console.warn("Autoplay bloqué au changement d'état :", e);
          setStatus("📱 Autoplay bloqué. Touchez l'écran pour synchroniser.");
        }
      } else {
        video.pause();
      }
    }
  } catch (e) {
    console.error("Erreur de synchronisation:", e);
  } {
    // Débloque le verrou après un mini délai de stabilisation
    setTimeout(async () => {
      syncing = false;
      
      // Si l'hôte a rechangé d'état (ex: a fait Play) pendant que l'iPhone chargeait le Seek,
      // on traite immédiatement la dernière action en attente !
      if (pendingData) {
        const nextData = pendingData;
        pendingData = null;
        await checkAndApplySync(nextData);
      }
    }, 300);
  }
}

// Vérification de la dérive (Drift)
async function checkAndApplySync(data) {
  if (isHost) return;

  const latency = (getNetworkTime() - data.updatedAt) / 1000;
  const target = data.paused ? data.time : data.time + latency;
  const drift = Math.abs(video.currentTime - target);

  // Seuil de tolérance fixé à 1.0s pour s'adapter proprement au réseau mobile de l'iPhone
  if (video.src !== data.url || drift > 1.0 || video.paused !== data.paused) {
    await applySync(data);
  }
}

// 👂 Firebase listener (Spectateurs uniquement)
onValue(roomRef, async snap => {
  const data = snap.val();
  if (!data || isHost) return;

  // Si l'iPhone est déjà en cours de seek/calcul, on met la mise à jour en attente
  if (syncing) {
    pendingData = data;
    return;
  }

  await checkAndApplySync(data);
});

// 🔄 Force sync
async function forceSync() {
  const snap = await get(roomRef);
  const data = snap.val();
  if (data) await checkAndApplySync(data);
}

// 🎮 HOST controls
video.addEventListener("play", pushState);
video.addEventListener("pause", pushState);
video.addEventListener("seeked", pushState);

// ⏱️ Sync permanente HOST (Heartbeat toutes les 3s pour ne pas surcharger les mobiles)
setInterval(() => {
  if (isHost && !video.paused) {
    pushState();
  }
}, 3000);
