import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const stateRef = ref(db, "movieState");

const video = document.getElementById("video");
const urlInput = document.getElementById("videoUrl");
const startBtn = document.getElementById("startBtn");

let syncing = false;

//
// 🟢 HOST : lance le film
//
startBtn.onclick = () => {
  const url = urlInput.value;
  if (!url) return;

  video.src = url;
  video.play();

  set(stateRef, {
    url,
    time: 0,
    playing: true,
    lastUpdate: Date.now()
  });
};

//
// 🎥 sync local → Firebase
//
video.addEventListener("play", () => {
  if (syncing) return;

  set(stateRef, {
    url: video.src,
    time: video.currentTime,
    playing: true,
    lastUpdate: Date.now()
  });
});

video.addEventListener("pause", () => {
  if (syncing) return;

  set(stateRef, {
    url: video.src,
    time: video.currentTime,
    playing: false,
    lastUpdate: Date.now()
  });
});

video.addEventListener("seeked", () => {
  if (syncing) return;

  set(stateRef, {
    url: video.src,
    time: video.currentTime,
    playing: !video.paused,
    lastUpdate: Date.now()
  });
});

//
// 👥 sync global (nouveaux arrivants inclus)
//
onValue(stateRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  syncing = true;

  // charger vidéo si différente
  if (video.src !== data.url) {
    video.src = data.url;
  }

  // correction du temps (important pour join tardif)
  const diff = (Date.now() - data.lastUpdate) / 1000;

  video.currentTime = data.time + diff;

  if (data.playing) {
    video.play();
  } else {
    video.pause();
  }

  setTimeout(() => {
    syncing = false;
  }, 200);
});
