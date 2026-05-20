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


// 🕒 Synchronisation temps Firebase

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


// 🎬 Plyr

const player = new Plyr(video, {

  controls: [
    'play-large',
    'play',
    'progress',
    'current-time',
    'mute',
    'volume',
    'settings',
    'pip',
    'airplay',
    'fullscreen'
  ],

  settings: [
    'speed'
  ],

  speed: {
    selected: 1,
    options: [0.5, 0.75, 1, 1.25, 1.5, 2]
  },

  keyboard: {
    focused: true,
    global: true
  },

  fullscreen: {
    enabled: true,
    iosNative: true
  },

  clickToPlay: true,

  hideControls: false

});

const videoUrl = document.getElementById("videoUrl");

const hostBtn = document.getElementById("hostBtn");

const joinBtn = document.getElementById("joinBtn");

const syncBtn = document.getElementById("syncBtn");

const statusEl = document.getElementById("status");


// 🎭 State

let isHost = false;

let syncing = false;

let forceMutedForAutoplay = false;


// 📱 iOS detection

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);


// 📢 Status

function setStatus(text) {
  statusEl.innerText = text;
}


// ⏱️ Helpers

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeUrl(url) {

  try {
    return decodeURIComponent(url || "");
  } catch {
    return url || "";
  }

}


// 🎥 Wait video ready

function waitVideoReady() {

  return new Promise(resolve => {

    if (video.readyState >= 2) {
      return resolve();
    }

    video.addEventListener("loadeddata", resolve, { once: true });

  });

}


// 🔍 Safe seek

async function safeSeek(time) {

  return new Promise(async (resolve) => {

    let finished = false;

    const finish = async () => {

      if (finished) return;

      finished = true;

      if (isIOS) {
        await wait(120);
      }

      resolve();
    };

    const onSeeked = () => {
      finish();
    };

    video.addEventListener("seeked", onSeeked, { once: true });

    try {

      if (typeof video.fastSeek === "function") {
        video.fastSeek(time);
      } else {
        video.currentTime = time;
      }

    } catch {

      video.currentTime = time;
    }

    setTimeout(
      finish,
      isIOS ? 700 : 300
    );

  });

}


// 📤 HOST -> Firebase

async function pushState() {

  if (!isHost || !video.src || syncing) return;

  try {

    await set(roomRef, {
      url: video.src,
      time: video.currentTime,
      paused: video.paused,
      updatedAt: getNetworkTime()
    });

  } catch (e) {

    console.error("Erreur pushState:", e);
  }

}


// ▶️ HOST START

hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) {
    return alert("Veuillez entrer une URL vidéo.");
  }

  isHost = true;

  syncing = true;

  setStatus("👑 Hôte (Envoi de la synchro)");

  try {

    video.src = url;

    await waitVideoReady();

    if (isIOS) {
      await wait(250);
    }

    await video.play();

    await pushState();

  } catch (e) {

    console.error("Erreur lancement:", e);

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

    console.warn("Autoplay bloqué:", e);
  }

  await forceSync();

};


// 🔄 RESYNC

syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus("👑 Hôte (Sync envoyée)");

  } else {

    await forceSync();

    setStatus("👥 Spectateur (Resynchronisé)");
  }

};


// 🎯 Synchronisation

async function applySync(data) {

  syncing = true;

  try {

    if (
      normalizeUrl(video.src) !== normalizeUrl(data.url)
    ) {

      video.src = data.url;

      await waitVideoReady();

      if (isIOS) {
        await wait(250);
      }
    }

    const latency =
      (getNetworkTime() - data.updatedAt) / 1000;

    const target =
      data.paused
        ? data.time
        : data.time + latency;

    let drift =
      Math.abs(video.currentTime - target);

    const syncThreshold =
      isIOS ? 0.25 : 0.5;

    if (drift > syncThreshold) {

      video.pause();

      await safeSeek(target);

      drift =
        Math.abs(video.currentTime - target);

      if (drift > 0.15) {

        await wait(80);

        await safeSeek(target);
      }

      drift =
        Math.abs(video.currentTime - target);

      if (isIOS && drift > 0.1) {

        await wait(120);

        video.currentTime = target;

        await wait(120);
      }
    }

    if (!data.paused) {

      try {

        await video.play();

        if (isIOS) {

          await wait(200);

          const finalDrift =
            Math.abs(video.currentTime - target);

          if (finalDrift > 0.3) {

            video.currentTime = target;
          }
        }

        if (forceMutedForAutoplay) {

          setStatus("🔇 Vidéo lancée en sourdine (Cliquez sur le volume)");

          forceMutedForAutoplay = false;
        }

      } catch (e) {

        console.error("Erreur autoplay:", e);

        setStatus("📱 Autoplay bloqué. Cliquez sur Play.");
      }

    } else {

      video.pause();
    }

  } catch (e) {

    console.error("Erreur sync:", e);

  } finally {

    setTimeout(() => {

      syncing = false;

    }, isIOS ? 500 : 250);
  }

}


// 👂 Firebase listener

onValue(roomRef, async (snap) => {

  const data = snap.val();

  if (!data || isHost || syncing) return;

  const latency =
    (getNetworkTime() - data.updatedAt) / 1000;

  const target =
    data.paused
      ? data.time
      : data.time + latency;

  const drift =
    Math.abs(video.currentTime - target);

  const needSync =
    normalizeUrl(video.src) !== normalizeUrl(data.url) ||
    drift > 0.8 ||
    video.paused !== data.paused;

  if (needSync) {

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

    console.error("Erreur forceSync:", e);
  }

}


// 🎮 Controls

video.addEventListener("play", () => {

  if (!syncing) {
    pushState();
  }

});

video.addEventListener("pause", () => {

  if (!syncing) {
    pushState();
  }

});

video.addEventListener("seeked", async () => {

  if (syncing) return;

  if (isIOS) {
    await wait(150);
  }

  pushState();

});


// ⏱️ Host heartbeat

setInterval(() => {

  if (isHost && !video.paused && !syncing) {

    pushState();
  }

}, 2000);


// 🔧 Micro correction

setInterval(async () => {

  if (isHost || syncing) return;

  try {

    const snap = await get(roomRef);

    const data = snap.val();

    if (!data || data.paused) return;

    const latency =
      (getNetworkTime() - data.updatedAt) / 1000;

    const target =
      data.time + latency;

    const drift =
      video.currentTime - target;

    if (
      Math.abs(drift) > 0.4 &&
      Math.abs(drift) < 3
    ) {

      video.playbackRate =
        drift > 0
          ? 0.96
          : 1.04;

      setTimeout(() => {

        video.playbackRate = 1;

      }, 1500);
    }

    else if (Math.abs(drift) >= 3) {

      await applySync(data);
    }

  } catch (e) {

    console.error("Erreur micro-sync:", e);
  }

}, 3000);
