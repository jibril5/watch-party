import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔴 TA CONFIG FIREBASE ICI
  const firebaseConfig = {
    apiKey: "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",
    authDomain: "watch-party-d3f69.firebaseapp.com",
    projectId: "watch-party-d3f69",
    storageBucket: "watch-party-d3f69.firebasestorage.app",
    messagingSenderId: "568073707307",
    appId: "1:568073707307:web:b45e8f9e3f4770c09fef6e",
    measurementId: "G-Y99MTG84DC"
  };

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔗 CANAL UNIQUE (2 personnes)
const offerRef = ref(db, "call/offer");
const answerRef = ref(db, "call/answer");
const candidatesRef = ref(db, "call/candidates");

const fileInput = document.getElementById("fileInput");
const hostBtn = document.getElementById("hostBtn");
const video = document.getElementById("video");

let pc;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

//
// 🟢 HOST (toi)
//
hostBtn.onclick = async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Choisis un film");

  const url = URL.createObjectURL(file);
  video.src = url;
  await video.play();

  const stream = video.captureStream();

  pc = new RTCPeerConnection(config);

  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      set(candidatesRef, e.candidate.toJSON());
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  set(offerRef, offer);

  onValue(answerRef, async (snap) => {
    const answer = snap.val();
    if (answer) {
      await pc.setRemoteDescription(answer);
    }
  });
};

//
// 🔵 VIEWER (ton ami)
//
pc = new RTCPeerConnection(config);

pc.ontrack = (e) => {
  video.srcObject = e.streams[0];
};

pc.onicecandidate = (e) => {
  if (e.candidate) {
    set(candidatesRef, e.candidate.toJSON());
  }
};

onValue(offerRef, async (snap) => {
  const offer = snap.val();
  if (!offer) return;

  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  set(answerRef, answer);
});

onValue(candidatesRef, async (snap) => {
  const c = snap.val();
  if (!c) return;

  try {
    await pc.addIceCandidate(c);
  } catch (e) {}
});
