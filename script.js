import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {

  // METS ICI TA CONFIG FIREBASE

};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

const stateRef = ref(db, "state");

const fileInput = document.getElementById("fileInput");

const video = document.getElementById("video");

let ignore = false;

fileInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  video.src = url;

  video.play();

});

video.addEventListener("play", () => {

  if (ignore) return;

  set(stateRef, {
    action: "play",
    time: video.currentTime
  });

});

video.addEventListener("pause", () => {

  if (ignore) return;

  set(stateRef, {
    action: "pause",
    time: video.currentTime
  });

});

video.addEventListener("seeked", () => {

  if (ignore) return;

  set(stateRef, {
    action: "seek",
    time: video.currentTime
  });

});

onValue(stateRef, (snapshot) => {

  const data = snapshot.val();

  if (!data) return;

  ignore = true;

  video.currentTime = data.time;

  if (data.action === "play") {

    video.play();

  }

  if (data.action === "pause") {

    video.pause();

  }

  setTimeout(() => {

    ignore = false;

  }, 200);

});
