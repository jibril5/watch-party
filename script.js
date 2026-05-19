import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

//
// 🔥 Firebase
//
const firebaseConfig = {

  apiKey: "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",

  authDomain: "watch-party-d3f69.firebaseapp.com",

  databaseURL:
    "https://watch-party-d3f69-default-rtdb.europe-west1.firebasedatabase.app",

  projectId: "watch-party-d3f69",

  storageBucket: "watch-party-d3f69.firebasestorage.app",

  messagingSenderId: "568073707307",

  appId:
    "1:568073707307:web:b45e8f9e3f4770c09fef6e"
};

//
// 🚀 Init
//
const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

const roomRef = ref(db, "room");

//
// 🎥 HTML
//
const video = document.getElementById("video");

const videoUrl = document.getElementById("videoUrl");

const hostBtn = document.getElementById("hostBtn");

const joinBtn = document.getElementById("joinBtn");

const syncBtn = document.getElementById("syncBtn");

const statusEl = document.getElementById("status");

//
// 🎭 State
//
let isHost = false;

let syncing = false;

//
// 📢 Status
//
function setStatus(text) {

  statusEl.innerText = text;
}

//
// ⏱️ Wait helpers
//
function wait(ms) {

  return new Promise(r => setTimeout(r, ms));
}

function waitVideoReady() {

  return new Promise(resolve => {

    if (video.readyState >= 2) {

      resolve();

      return;
    }

    video.addEventListener(
      "loadeddata",
      resolve,
      { once: true }
    );
  });
}

function waitSeeked() {

  return new Promise(resolve => {

    video.addEventListener(
      "seeked",
      resolve,
      { once: true }
    );
  });
}

//
// 📤 HOST -> Firebase
//
async function pushState() {

  if (!isHost) return;

  if (!video.src) return;

  await set(roomRef, {

    url: video.src,

    time: video.currentTime,

    paused: video.paused,

    updatedAt: Date.now()
  });
}

//
// ▶️ HOST START
//
hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) return;

  isHost = true;

  setStatus("🎬 HOST");

  syncing = true;

  try {

    video.src = url;

    await waitVideoReady();

    await video.play();

    await pushState();

  } catch (e) {

    console.error(e);

  } finally {

    syncing = false;
  }
};

//
// 👥 JOIN
//
joinBtn.onclick = async () => {

  isHost = false;

  setStatus("👥 VIEWER");

  //
  // IMPORTANT iPhone :
  // débloque autoplay
  //
  try {

    await video.play();

    video.pause();

  } catch (e) {}

  //
  // sync immédiate
  //
  await forceSync();
};

//
// 🔄 RESYNC
//
syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus("🔄 Sync envoyée");

  } else {

    await forceSync();

    setStatus("🔄 Resync");
  }
};

//
// 🎯 VRAIE sync iPhone-safe
//
async function applySync(data) {

  syncing = true;

  try {

    //
    // 📺 Nouvelle vidéo
    //
    if (video.src !== data.url) {

      video.src = data.url;

      await waitVideoReady();
    }

    //
    // ⏱️ Temps cible
    //
    const latency =
      (Date.now() - data.updatedAt) / 1000;

    const target =
      data.time + latency;

    //
    // 🛑 pause avant seek
    //
    video.pause();

    //
    // 🎯 FORCE SEEK
    //
    video.currentTime = target;

    //
    // attendre vrai seek Safari
    //
    await waitSeeked();

    //
    // 🔥 double correction iPhone
    //
    if (
      Math.abs(video.currentTime - target) > 0.3
    ) {

      video.currentTime = target;

      await waitSeeked();
    }

    //
    // mini délai safari
    //
    await wait(100);

    //
    // ▶️ lecture
    //
    if (!data.paused) {

      try {

        await video.play();

      } catch (e) {

        setStatus(
          "📱 Clique sur Rejoindre"
        );
      }
    }

  } catch (e) {

    console.error(e);

  } finally {

    setTimeout(() => {

      syncing = false;

    }, 300);
  }
}

//
// 👂 Firebase listener
//
onValue(roomRef, async snap => {

  const data = snap.val();

  if (!data) return;

  //
  // host ignore
  //
  if (isHost) return;

  //
  // éviter spam sync
  //
  if (syncing) return;

  //
  // drift check
  //
  const latency =
    (Date.now() - data.updatedAt) / 1000;

  const target =
    data.time + latency;

  const drift =
    Math.abs(video.currentTime - target);

  //
  // sync seulement si vrai écart
  //
  if (
    video.src !== data.url ||
    drift > 1.2
  ) {

    await applySync(data);
  }
});

//
// 🔄 Force sync
//
async function forceSync() {

  const snap = await get(roomRef);

  const data = snap.val();

  if (!data) return;

  await applySync(data);
}

//
// 🎮 HOST controls
//
video.addEventListener("play", () => {

  if (!isHost) return;

  if (syncing) return;

  pushState();
});

video.addEventListener("pause", () => {

  if (!isHost) return;

  if (syncing) return;

  pushState();
});

video.addEventListener("seeked", () => {

  if (!isHost) return;

  if (syncing) return;

  pushState();
});

//
// ⏱️ Sync permanente HOST
//
setInterval(() => {

  if (!isHost) return;

  if (video.paused) return;

  pushState();

}, 1500);
