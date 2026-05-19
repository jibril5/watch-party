import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

//
// 🔥 Firebase config
//
const firebaseConfig = {
  apiKey: "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",
  authDomain: "watch-party-d3f69.firebaseapp.com",

  databaseURL: "https://watch-party-d3f69-default-rtdb.europe-west1.firebasedatabase.app",

  projectId: "watch-party-d3f69",
  storageBucket: "watch-party-d3f69.firebasestorage.app",
  messagingSenderId: "568073707307",
  appId: "1:568073707307:web:b45e8f9e3f4770c09fef6e",
  measurementId: "G-Y99MTG84DC"
};

//
// 🚀 Init Firebase
//
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

//
// 🎬 Référence DB
//
const stateRef = ref(db, "movieState");

//
// 🎥 Elements HTML
//
const video = document.getElementById("video");
const urlInput = document.getElementById("videoUrl");
const startBtn = document.getElementById("startBtn");
const syncBtn = document.getElementById("syncBtn");

//
// 🛑 Evite boucle sync
//
let syncing = false;

//
// 📤 Envoie état vers Firebase
//
function sendState(force = false) {

  if (syncing && !force) return;

  set(stateRef, {
    url: video.src,
    time: video.currentTime,
    playing: !video.paused,
    lastUpdate: Date.now()
  });
}

//
// ▶️ Lancer film
//
startBtn.onclick = async () => {

  const url = urlInput.value.trim();

  if (!url) return;

  video.src = url;

  try {

    await video.play();

    set(stateRef, {
      url,
      time: 0,
      playing: true,
      lastUpdate: Date.now()
    });

  } catch (e) {
    console.error(e);
  }
};

//
// 🔄 BOUTON SYNC
// force tous les viewers à revenir EXACTEMENT
// au temps actuel du host
//
syncBtn.onclick = () => {

  sendState(true);

  console.log("SYNC envoyé");
};

//
// 🎮 Events vidéo
//
video.addEventListener("play", () => {
  sendState();
});

video.addEventListener("pause", () => {
  sendState();
});

video.addEventListener("seeked", () => {
  sendState();
});

//
// ⏱️ Sync régulière pendant lecture
//
setInterval(() => {

  if (video.paused) return;
  if (syncing) return;

  sendState();

}, 2000);

//
// 👥 Réception sync Firebase
//
onValue(stateRef, async (snap) => {

  const data = snap.val();

  if (!data) return;

  syncing = true;

  //
  // 🎬 Charger vidéo si différente
  //
  if (video.src !== data.url) {

    video.src = data.url;

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });
  }

  //
  // ⏱️ Calcul temps réel
  //
  const diff = (Date.now() - data.lastUpdate) / 1000;

  const targetTime = data.time + diff;

  //
  // 🎯 Correction seulement si gros décalage
  //
  if (Math.abs(video.currentTime - targetTime) > 1) {
    video.currentTime = targetTime;
  }

  //
  // ▶️ / ⏸️ Sync play pause
  //
  try {

    if (data.playing && video.paused) {
      await video.play();
    }

    if (!data.playing && !video.paused) {
      video.pause();
    }

  } catch (e) {
    console.error(e);
  }

  //
  // 🔓 Fin sync
  //
  setTimeout(() => {
    syncing = false;
  }, 300);

});
