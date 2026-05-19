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
// ⏱️ Helpers
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
// 👥 JOIN VIEWER
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
// 🎯 APPLY SYNC
//
async function applySync(data, force = false) {

  try {

    //
    // 📺 Nouvelle vidéo
    //
    if (video.src !== data.url) {

      syncing = true;

      video.src = data.url;

      await waitVideoReady();

      syncing = false;
    }

    //
    // ⏱️ Temps cible
    //
    const latency =
      (Date.now() - data.updatedAt) / 1000;

    const target =
      data.time + latency;

    const drift =
      target - video.currentTime;

    //
    // ⏸️ PAUSE PRIORITAIRE
    //
    if (data.paused) {

      if (!video.paused) {

        video.pause();
      }

      //
      // force position exacte pause
      //
      if (
        Math.abs(drift) > 0.2 ||
        force
      ) {

        video.currentTime = target;
      }

      return;
    }

    //
    // ▶️ PLAY PRIORITAIRE
    //
    if (video.paused) {

      try {

        await video.play();

      } catch (e) {

        setStatus(
          "📱 Clique sur Rejoindre"
        );

        return;
      }
    }

    //
    // 🔥 GROS DÉCALAGE
    //
    if (
      Math.abs(drift) > 1.2 ||
      force
    ) {

      syncing = true;

      //
      // safari iphone fix
      //
      video.pause();

      await wait(50);

      video.currentTime = target;

      await waitSeeked();

      //
      // double seek iphone
      //
      if (
        Math.abs(video.currentTime - target) > 0.3
      ) {

        video.currentTime = target;

        await waitSeeked();
      }

      await wait(120);

      try {

        await video.play();

      } catch (e) {}

      syncing = false;

      return;
    }

    //
    // ⚡ Petit décalage :
    // correction douce
    //
    if (Math.abs(drift) > 0.35) {

      //
      // retard
      //
      if (drift > 0) {

        video.playbackRate = 1.10;

      } else {

        //
        // avance
        //
        video.playbackRate = 0.90;
      }

    } else {

      //
      // sync parfaite
      //
      video.playbackRate = 1;
    }

  } catch (e) {

    console.error(e);
  }
}

//
// 👂 FIREBASE LISTENER
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

  await applySync(data);
});

//
// 🔄 FORCE RESYNC
//
async function forceSync() {

  const snap = await get(roomRef);

  const data = snap.val();

  if (!data) return;

  await applySync(data, true);
}

//
// 🎮 HOST CONTROLS
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

  if (!video.src) return;

  pushState();

}, 800);
