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

  // ⚠️ Remplace si besoin par ton URL exacte
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
// 📤 Envoie état Firebase
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

  try {

    syncing = true;

    video.src = url;

    //
    // attendre chargement
    //
    await new Promise(resolve => {

      video.addEventListener(
        "loadedmetadata",
        resolve,
        { once: true }
      );

    });

    await video.play();

    //
    // envoyer état global
    //
    set(stateRef, {
      url,
      time: 0,
      playing: true,
      lastUpdate: Date.now()
    });

  } catch (e) {

    console.error(e);

  } finally {

    setTimeout(() => {
      syncing = false;
    }, 500);
  }
};

//
// 🔄 BOUTON SYNC
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
// ⏱️ Sync régulière
//
setInterval(() => {

  if (syncing) return;
  if (video.paused) return;
  if (!video.src) return;

  sendState();

}, 2000);

//
// 👥 Réception Firebase
//
onValue(stateRef, async (snap) => {

  const data = snap.val();

  if (!data) return;

  syncing = true;

  try {

    //
    // 🎬 Nouvelle vidéo ?
    //
    const isNewVideo = video.src !== data.url;

    if (isNewVideo) {

      video.src = data.url;

      //
      // attendre chargement complet
      //
      await new Promise(resolve => {

        video.addEventListener(
          "loadedmetadata",
          resolve,
          { once: true }
        );

      });

      //
      // petit délai sécurité
      //
      await new Promise(r => setTimeout(r, 300));
    }

    //
    // ⏱️ Calcul temps cible
    //
    const diff = (Date.now() - data.lastUpdate) / 1000;

    const targetTime = data.time + diff;

    //
    // 🎯 Corriger gros décalage
    //
    if (
      isNaN(video.currentTime) ||
      Math.abs(video.currentTime - targetTime) > 1
    ) {

      try {

        video.currentTime = targetTime;

      } catch (e) {
        console.error(e);
      }
    }

    //
    // ▶️ / ⏸️ Sync lecture
    //
    if (data.playing) {

      if (video.paused) {

        try {
          await video.play();
        } catch (e) {
          console.error(e);
        }
      }

    } else {

      if (!video.paused) {
        video.pause();
      }
    }

  } catch (e) {

    console.error(e);

  } finally {

    //
    // 🔓 débloquer sync
    //
    setTimeout(() => {
      syncing = false;
    }, 500);
  }

});
