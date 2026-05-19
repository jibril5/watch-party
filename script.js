import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue
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
// ▶️ HOST start
//
hostBtn.onclick = async () => {

  const url = videoUrl.value.trim();

  if (!url) return;

  isHost = true;

  setStatus("🎬 HOST");

  video.src = url;

  await waitVideoReady();

  try {

    await video.play();

  } catch (e) {

    console.error(e);
  }

  pushState();
};

//
// 👥 JOIN
//
joinBtn.onclick = async () => {

  setStatus("👥 VIEWER");

  try {

    //
    // IMPORTANT iPhone
    // interaction utilisateur
    //
    await video.play();

    video.pause();

  } catch (e) {}

  //
  // sync forcée
  //
  forceSync();
};

//
// 🔄 RESYNC
//
syncBtn.onclick = () => {

  if (isHost) {

    pushState();

    setStatus("🔄 Sync envoyée");

  } else {

    forceSync();

    setStatus("🔄 Resync");
  }
};

//
// ⏱️ Wait video ready
//
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

//
// 👂 Viewer écoute Firebase
//
onValue(roomRef, async snap => {

  const data = snap.val();

  if (!data) return;

  //
  // host ignore
  //
  if (isHost) return;

  syncing = true;

  try {

    //
    // nouvelle vidéo
    //
    if (video.src !== data.url) {

      video.src = data.url;

      await waitVideoReady();
    }

    //
    // calcul temps exact
    //
    const latency =
      (Date.now() - data.updatedAt) / 1000;

    const target =
      data.time + latency;

    //
    // corriger si décalage
    //
    const drift =
      Math.abs(video.currentTime - target);

    if (drift > 0.5) {

      video.currentTime = target;
    }

    //
    // lecture sync
    //
    if (!data.paused) {

      try {

        await video.play();

      } catch (e) {

        //
        // iPhone autoplay block
        //
        setStatus(
          "📱 Clique sur Rejoindre"
        );
      }

    } else {

      video.pause();
    }

  } catch (e) {

    console.error(e);

  } finally {

    setTimeout(() => {

      syncing = false;

    }, 300);
  }
});

//
// 🔄 Force sync viewer
//
async function forceSync() {

  const snap = await new Promise(resolve => {

    onValue(
      roomRef,
      resolve,
      { onlyOnce: true }
    );
  });

  const data = snap.val();

  if (!data) return;

  if (video.src !== data.url) {

    video.src = data.url;

    await waitVideoReady();
  }

  const latency =
    (Date.now() - data.updatedAt) / 1000;

  video.currentTime =
    data.time + latency;

  if (!data.paused) {

    try {

      await video.play();

    } catch (e) {

      setStatus(
        "📱 Clique sur Rejoindre"
      );
    }
  }
}

//
// 🎮 HOST controls
//
video.addEventListener("play", () => {

  if (isHost && !syncing) {

    pushState();
  }
});

video.addEventListener("pause", () => {

  if (isHost && !syncing) {

    pushState();
  }
});

video.addEventListener("seeked", () => {

  if (isHost && !syncing) {

    pushState();
  }
});

//
// ⏱️ Sync permanente host
//
setInterval(() => {

  if (!isHost) return;

  if (video.paused) return;

  pushState();

}, 1000);
