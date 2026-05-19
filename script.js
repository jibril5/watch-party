import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔴 METS TA CONFIG FIREBASE ICI
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

const roomIdInput = document.getElementById("roomId");
const joinBtn = document.getElementById("joinBtn");
const hostBtn = document.getElementById("hostBtn");
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");

let pc;
let isHost = false;
let localStream;

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function getRoomRef(roomId) {
  return ref(db, "rooms/" + roomId);
}

// ----------------------
// 🟢 HOST
// ----------------------
hostBtn.onclick = async () => {
  const roomId = roomIdInput.value;
  if (!roomId) return alert("Room ID requis");

  isHost = true;

  const file = fileInput.files[0];
  if (!file) return alert("Choisis un film");

  const url = URL.createObjectURL(file);
  video.src = url;
  await video.play();

  localStream = video.captureStream();

  pc = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      push(getRoomRef(roomId + "/candidates"), event.candidate.toJSON());
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await set(getRoomRef(roomId + "/offer"), offer);

  onValue(getRoomRef(roomId + "/answer"), async (snap) => {
    const answer = snap.val();
    if (!answer) return;

    await pc.setRemoteDescription(answer);
  });

  onValue(getRoomRef(roomId + "/candidates"), (snap) => {
    const data = snap.val();
    if (!data) return;

    Object.values(data).forEach(async (c) => {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {}
    });
  });
};

// ----------------------
// 🔵 VIEWER
// ----------------------
joinBtn.onclick = async () => {
  const roomId = roomIdInput.value;
  if (!roomId) return alert("Room ID requis");

  pc = new RTCPeerConnection(configuration);

  pc.ontrack = (event) => {
    video.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      push(getRoomRef(roomId + "/candidates"), event.candidate.toJSON());
    }
  };

  const offerSnap = await onValue(getRoomRef(roomId + "/offer"), async (snap) => {
    const offer = snap.val();
    if (!offer) return;

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await set(getRoomRef(roomId + "/answer"), answer);
  });

  onValue(getRoomRef(roomId + "/candidates"), (snap) => {
    const data = snap.val();
    if (!data) return;

    Object.values(data).forEach(async (c) => {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {}
    });
  });
};
