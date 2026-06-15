import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =========================
// CONFIG
// =========================
const API_KEY = "09c2df46123d7a1da00dbb9e60a36a31";
const WORKER_PROXY = "https://watch-party-proxy.dahmani-jibril.workers.dev/?url=";

// Firebase
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

// =========================
// GOOGLE DRIVE SUPPORT
// =========================
function extractGoogleDriveFileId(url) {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?.*id=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function normalizeVideoUrl(url) {
  if (!url) return "";

  const trimmedUrl = url.trim();
  const driveId = extractGoogleDriveFileId(trimmedUrl);

  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }

  return trimmedUrl;
}

// =========================
// FIREBASE TIME SYNC
// =========================
let serverTimeOffset = 0;

const offsetRef = ref(db, ".info/serverTimeOffset");

onValue(offsetRef, (snap) => {
  serverTimeOffset = snap.val() || 0;
});

function getNetworkTime() {
  return Date.now() + serverTimeOffset;
}

// =========================
// VIDEO.JS
// =========================
const player = videojs("video", {
  controls: true,
  preload: "auto",
  playsinline: true,
  fluid: true,
  responsive: true,
  fill: true,

  controlBar: {
    volumePanel: {
      inline: false
    }
  },

  html5: {
    vhs: {
      overrideNative: true
    },

    nativeVideoTracks: false,
    nativeAudioTracks: false,
    nativeTextTracks: false
  }
});

// =========================
// DOM
// =========================
const searchInput = document.getElementById("searchInput");
const resultsDiv = document.getElementById("searchResults");
const seasonSelect = document.getElementById("seasonSelect");
const episodeSelect = document.getElementById("episodeSelect");
const playerSelect = document.getElementById("playerSelect");

const videoUrl = document.getElementById("videoUrl");
const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const syncBtn = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");

// =========================
// STATE
// =========================
let isHost = false;
let syncing = false;
let forceMutedForAutoplay = false;

let selectedShowId = null;
let selectedShowName = "";
let selectedMediaType = "tv";
let selectedMovieData = null;
let selectedSeasons = [];
let searchTimeout;
let availablePlayers = [];
let currentVideoUrl = "";

// =========================
// STATUS
// =========================
function setStatus(text) {
  statusEl.innerText = text;
}

// =========================
// DROPDOWN
// =========================
function setDropdownVisible(visible) {
  resultsDiv.style.display = visible ? "block" : "none";
}

// =========================
// RECHERCHE TMDB
// =========================
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    const query = e.target.value.trim();

    if (query.length < 3) {
      resultsDiv.innerHTML = "";
      setDropdownVisible(false);
      return;
    }

    try {
      const url =
        `https://api.themoviedb.org/3/search/multi` +
        `?api_key=${API_KEY}` +
        `&query=${encodeURIComponent(query)}` +
        `&language=fr-FR`;

      const res = await fetch(url);

      if (!res.ok) throw new Error(res.status);

      const data = await res.json();

      displayResults(data.results || []);
    } catch (err) {
      console.error("Erreur recherche TMDB :", err);

      resultsDiv.innerHTML =
        `<div class="result-item">Erreur de chargement</div>`;

      setDropdownVisible(true);
    }
  }, 300);
});

// =========================
// AFFICHER RESULTATS
// =========================
function displayResults(results) {
  resultsDiv.innerHTML = "";

  const filteredResults = results.filter(item =>
    item.media_type === "tv" || item.media_type === "movie"
  );

  if (!filteredResults.length) {
    resultsDiv.innerHTML =
      `<div class="result-item">Aucun résultat trouvé</div>`;

    setDropdownVisible(true);
    return;
  }

  filteredResults.slice(0, 8).forEach(item => {
    const div = document.createElement("div");
    div.className = "result-item result-with-poster";

    const title =
      item.media_type === "movie"
        ? item.title
        : item.name;

    const date =
      item.media_type === "movie"
        ? item.release_date
        : item.first_air_date;

    const year = date ? date.split("-")[0] : "Date inconnue";

    const typeLabel =
      item.media_type === "movie"
        ? "Film"
        : "Série";

    const posterUrl = item.poster_path
      ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
      : "https://via.placeholder.com/60x90?text=?";

    div.innerHTML = `
      <div>
        <strong>${title}</strong>
        <div style="font-size:12px;opacity:0.6">
          ${typeLabel} • ${year}
        </div>
      </div>

      <img class="result-poster" src="${posterUrl}" alt="${title}">
    `;

    div.addEventListener("click", () => selectMedia(item));

    resultsDiv.appendChild(div);
  });

  setDropdownVisible(true);
}

// =========================
// SELECTION FILM OU SERIE
// =========================
async function selectMedia(item) {
  selectedShowId = item.id;
  selectedMediaType = item.media_type;
  selectedMovieData = null;

  selectedShowName =
    item.media_type === "movie"
      ? item.title
      : item.name;

  searchInput.value = selectedShowName;

  resultsDiv.innerHTML = "";
  setDropdownVisible(false);

  resetPlayers();

  if (selectedMediaType === "movie") {
    seasonSelect.style.display = "none";
    episodeSelect.style.display = "none";

    setStatus(`Chargement du film ${selectedShowName}...`);

    try {
      const url =
        `https://api.themoviedb.org/3/movie/${item.id}` +
        `?api_key=${API_KEY}` +
        `&language=fr-FR`;

      const res = await fetch(url);

      if (!res.ok) throw new Error(res.status);

      selectedMovieData = await res.json();

      setStatus(`Film sélectionné : ${selectedShowName}`);
    } catch (err) {
      console.error("Erreur chargement film :", err);
      setStatus("Erreur chargement film.");
    }

    return;
  }

  seasonSelect.style.display = "block";
  episodeSelect.style.display = "block";

  setStatus(`Chargement de ${selectedShowName}...`);

  try {
    const url =
      `https://api.themoviedb.org/3/tv/${item.id}` +
      `?api_key=${API_KEY}` +
      `&language=fr-FR`;

    const res = await fetch(url);

    if (!res.ok) throw new Error(res.status);

    const data = await res.json();

    selectedSeasons = (data.seasons || []).filter(
      s => s.season_number > 0
    );

    populateSeasons(selectedSeasons);

    setStatus(`Série sélectionnée : ${selectedShowName}`);
  } catch (err) {
    console.error("Erreur chargement série :", err);
    setStatus("Erreur chargement série.");
  }
}

// =========================
// SAISONS
// =========================
function populateSeasons(seasons) {
  seasonSelect.innerHTML =
    '<option value="">Choisir une saison</option>';

  episodeSelect.innerHTML =
    '<option value="">Choisir un épisode</option>';

  resetPlayers();

  seasons.forEach(season => {
    const option = document.createElement("option");

    option.value = season.season_number;
    option.textContent = season.name;

    seasonSelect.appendChild(option);
  });

  seasonSelect.removeEventListener("change", loadEpisodes);
  seasonSelect.addEventListener("change", loadEpisodes);

  if (seasons.length > 0) {
    seasonSelect.value = seasons[0].season_number;
    loadEpisodes();
  }
}

// =========================
// EPISODES
// =========================
async function loadEpisodes() {
  if (!selectedShowId) return;

  const seasonNumber = seasonSelect.value;

  resetPlayers();

  if (!seasonNumber) return;

  try {
    const url =
      `https://api.themoviedb.org/3/tv/${selectedShowId}/season/${seasonNumber}` +
      `?api_key=${API_KEY}` +
      `&language=fr-FR`;

    const res = await fetch(url);

    if (!res.ok) throw new Error(res.status);

    const data = await res.json();

    episodeSelect.innerHTML = "";

    if (!data.episodes || !data.episodes.length) {
      episodeSelect.innerHTML =
        `<option value="">Aucun épisode trouvé</option>`;
      return;
    }

    data.episodes.forEach(ep => {
      const option = document.createElement("option");

      option.value = ep.episode_number;
      option.textContent = `Épisode ${ep.episode_number} - ${ep.name}`;

      episodeSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Erreur chargement épisodes :", err);

    episodeSelect.innerHTML =
      `<option value="">Erreur chargement</option>`;
  }
}

// =========================
// LECTEURS
// =========================
function resetPlayers() {
  availablePlayers = [];
  currentVideoUrl = "";

  if (playerSelect) {
    playerSelect.innerHTML =
      `<option value="">Choisir un lecteur</option>`;
  }
}

function extractPlayers(text) {
  const players = [];

  const blocks = text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("{") && line.endsWith("}"));

  for (const block of blocks) {
    try {
      const providerData = JSON.parse(block);

      if (!Array.isArray(providerData.items)) continue;

      providerData.items.forEach(item => {
        if (!item.url) return;

        players.push({
          id: providerData.id || "",
          provider: item.provider || providerData.id || "Inconnu",
          service: item.service || "inconnu",
          quality: item.quality || "unknown",
          language: item.language || "unknown",
          type: item.type || "unknown",
          proxied: item.proxied === true,
          url: item.url
        });
      });
    } catch (err) {
      console.warn("JSON ignoré :", block);
    }
  }

  return players;
}

function populatePlayers(players) {
  playerSelect.innerHTML =
    `<option value="">Choisir un lecteur</option>`;

  if (!players.length) {
    playerSelect.innerHTML =
      `<option value="">Aucun lecteur trouvé</option>`;
    return;
  }

  players.forEach((p, index) => {
    const option = document.createElement("option");

    option.value = String(index);
    option.textContent =
      `${p.provider} - ${p.service} - ${p.quality} - ${p.language} - ${p.type}`;

    playerSelect.appendChild(option);
  });

  const afroditiIndex = players.findIndex(p =>
    p.provider.toLowerCase() === "afroditi" ||
    p.id.toLowerCase() === "afroditi"
  );

  playerSelect.value = afroditiIndex >= 0 ? String(afroditiIndex) : "0";
}

async function getSelectedPlayerUrl() {
  const index = Number(playerSelect.value);

  if (Number.isNaN(index) || !availablePlayers[index]) {
    return null;
  }

  const selectedPlayer = availablePlayers[index];

  console.log("LECTEUR CHOISI :", selectedPlayer);
  console.log("URL LECTEUR CHOISI :", selectedPlayer.url);

  currentVideoUrl = normalizeVideoUrl(selectedPlayer.url);
  videoUrl.value = selectedPlayer.url;

  return currentVideoUrl;
}

if (playerSelect) {
  playerSelect.addEventListener("change", async () => {
    const url = await getSelectedPlayerUrl();

    if (!url) return;

    setStatus(`Lecteur sélectionné : ${availablePlayers[Number(playerSelect.value)].provider}`);

    if (isHost && player.src()) {
      await startHostPlayback(url);
    }
  });
}

// =========================
// CREATION URL API SOURCE
// =========================
function buildSourceApiUrl() {
  if (selectedMediaType === "movie") {
    if (!selectedMovieData) {
      alert("Les infos du film ne sont pas encore chargées.");
      return null;
    }

    const releaseYear = selectedMovieData.release_date
      ? selectedMovieData.release_date.split("-")[0]
      : "";

    return (
      `https://3afterdark.mom/api/staging-20260420-yuna-hipaa-86nnorn0/sources` +
      `?tmdbId=${selectedShowId}` +
      `&type=movie` +
      `&imdbId=${encodeURIComponent(selectedMovieData.imdb_id || "")}` +
      `&title=${encodeURIComponent(selectedMovieData.title || selectedShowName)}` +
      `&releaseYear=${encodeURIComponent(releaseYear)}` +
      `&originalTitle=${encodeURIComponent(selectedMovieData.original_title || selectedShowName)}`
    );
  }

  const season = seasonSelect.value;
  const episode = episodeSelect.value;

  if (!season || !episode) {
    alert("Choisis saison + épisode !");
    return null;
  }

  return (
    `https://3afterdark.mom/api/staging-20260420-yuna-hipaa-86nnorn0/sources` +
    `?tmdbId=${selectedShowId}` +
    `&type=tv` +
    `&title=${encodeURIComponent(selectedShowName)}` +
    `&season=${encodeURIComponent(season)}` +
    `&episode=${encodeURIComponent(episode)}`
  );
}

async function fetchPlayersFromSelectedMedia() {
  const apiUrl = buildSourceApiUrl();

  if (!apiUrl) return null;

  console.log("API URL:", apiUrl);

  setStatus("Recherche des lecteurs...");

  const proxy = WORKER_PROXY + encodeURIComponent(apiUrl);

  console.log("PROXY URL:", proxy);

  const res = await fetch(proxy);

  if (!res.ok) {
    throw new Error(`Erreur proxy HTTP ${res.status}`);
  }

  const text = await res.text();

  console.log("RAW RESPONSE:", text);

  availablePlayers = extractPlayers(text);

  console.log("LECTEURS DISPONIBLES :", availablePlayers);

  if (!availablePlayers.length) {
    setStatus("Aucun lecteur trouvé.");
    return null;
  }

  populatePlayers(availablePlayers);

  return await getSelectedPlayerUrl();
}

// =========================
// HELPERS VIDEO
// =========================
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function waitPlayerReady() {
  return new Promise(resolve => {
    if (player.readyState() >= 2) {
      return resolve();
    }

    player.one("loadeddata", resolve);
  });
}

function waitSeeked() {
  return new Promise(resolve => {
    player.one("seeked", resolve);
  });
}

// =========================
// DETECTION TYPE VIDEO
// =========================
async function guessType(url) {
  url = normalizeVideoUrl(url);

  if (url.includes("drive.google.com")) {
    return "video/mp4";
  }

  if (url.includes(".m3u8")) {
    return "application/x-mpegURL";
  }

  if (url.includes(".mpd")) {
    return "application/dash+xml";
  }

  if (url.includes(".mp4")) {
    return "video/mp4";
  }

  if (url.includes(".webm")) {
    return "video/webm";
  }

  if (url.includes(".ogg")) {
    return "video/ogg";
  }

  try {
    const res = await fetch(url, {
      method: "GET"
    });

    const contentType = res.headers.get("content-type");

    console.log("Content-Type détecté :", contentType);

    if (contentType?.includes("application/vnd.apple.mpegurl")) {
      return "application/x-mpegURL";
    }

    if (contentType?.includes("application/x-mpegURL")) {
      return "application/x-mpegURL";
    }

    if (contentType?.includes("video/mp4")) {
      return "video/mp4";
    }

    if (contentType?.includes("video/webm")) {
      return "video/webm";
    }

    const text = await res.text();

    if (text.includes("#EXTM3U")) {
      return "application/x-mpegURL";
    }

    if (text.includes("<MPD")) {
      return "application/dash+xml";
    }
  } catch (e) {
    console.warn("Détection MIME impossible :", e);
  }

  return "video/mp4";
}

// =========================
// HOST -> FIREBASE
// =========================
async function pushState() {
  if (!isHost || !player.src() || syncing) {
    return;
  }

  await set(roomRef, {
    url: normalizeVideoUrl(player.src()),
    time: player.currentTime(),
    paused: player.paused(),
    updatedAt: getNetworkTime()
  });
}

async function startHostPlayback(url) {
  isHost = true;
  syncing = true;

  const finalUrl = normalizeVideoUrl(url);

  if (!finalUrl) {
    syncing = false;
    return alert("URL vidéo invalide.");
  }

  setStatus("👑 Hôte (Envoi de la synchro)");

  try {
    const type = await guessType(finalUrl);

    console.log("🎥 URL finale :", finalUrl);
    console.log("🎥 Type détecté :", type);

    player.src({
      src: finalUrl,
      type
    });

    await waitPlayerReady();
    await player.play();
    await pushState();
  } catch (e) {
    console.error("Erreur de lecture :", e);
    setStatus("❌ Erreur de lecture");
  } finally {
    syncing = false;
  }
}

// =========================
// HOST START
// =========================
hostBtn.onclick = async () => {
  let url = null;

  try {
    if (selectedShowId) {
      url = await fetchPlayersFromSelectedMedia();
    }

    if (!url) {
      url = normalizeVideoUrl(videoUrl.value);
    }

    if (!url) {
      return alert("Sélectionne une série/un film ou entre une URL vidéo.");
    }

    await startHostPlayback(url);
  } catch (e) {
    console.error("Erreur chargement vidéo :", e);
    setStatus("Erreur chargement vidéo.");
  }
};

// =========================
// JOIN
// =========================
joinBtn.onclick = async () => {
  isHost = false;

  setStatus("👥 Spectateur (Synchronisé)");

  try {
    player.muted(true);
    forceMutedForAutoplay = true;
    await player.play();
    player.pause();
  } catch (e) {
    console.warn("Autoplay initial bloqué", e);
  }

  await forceSync();
};

// =========================
// RESYNC
// =========================
syncBtn.onclick = async () => {
  if (isHost) {
    await pushState();
    setStatus("👑 Hôte (Sync forcée envoyée)");
  } else {
    await forceSync();
    setStatus("👥 Spectateur (Resync manuelle)");
  }
};

// =========================
// APPLICATION SYNC
// =========================
async function applySync(data) {
  syncing = true;

  const syncedUrl = normalizeVideoUrl(data.url);

  try {
    if (player.src() !== syncedUrl) {
      const type = await guessType(syncedUrl);

      console.log("🎥 URL synchronisée :", syncedUrl);
      console.log("🎥 Type détecté :", type);

      player.src({
        src: syncedUrl,
        type
      });

      await waitPlayerReady();
    }

    const latency = (getNetworkTime() - data.updatedAt) / 1000;

    const target = data.paused
      ? data.time
      : data.time + latency;

    const drift = Math.abs(player.currentTime() - target);

    if (
      drift > 2 ||
      player.paused() !== data.paused
    ) {
      player.pause();
      player.currentTime(target);

      await waitSeeked();

      if (Math.abs(player.currentTime() - target) > 0.3) {
        player.currentTime(target);
        await waitSeeked();
      }

      if (!data.paused) {
        try {
          await player.play();

          if (forceMutedForAutoplay) {
            setStatus("🔇 Vidéo lancée en sourdine (cliquez sur le volume)");
            forceMutedForAutoplay = false;
          }
        } catch (e) {
          console.warn("Autoplay bloqué :", e);
          setStatus("📱 Autoplay bloqué. Cliquez sur Play.");
        }
      } else {
        player.pause();
      }
    }
  } catch (e) {
    console.error("Erreur de synchronisation :", e);
  } finally {
    setTimeout(() => {
      syncing = false;
    }, 300);
  }
}

// =========================
// FIREBASE LISTENER
// =========================
onValue(roomRef, async (snap) => {
  const data = snap.val();

  if (!data || isHost || syncing) {
    return;
  }

  const syncedUrl = normalizeVideoUrl(data.url);

  const latency =
    (getNetworkTime() - data.updatedAt) / 1000;

  const target = data.paused
    ? data.time
    : data.time + latency;

  const drift =
    Math.abs(player.currentTime() - target);

  if (
    player.src() !== syncedUrl ||
    drift > 2 ||
    player.paused() !== data.paused
  ) {
    await applySync({
      ...data,
      url: syncedUrl
    });
  }
});

// =========================
// FORCE SYNC
// =========================
async function forceSync() {
  const snap = await get(roomRef);
  const data = snap.val();

  if (data) {
    await applySync(data);
  }
}

// =========================
// EVENTS HOST
// =========================
player.on("play", pushState);
player.on("pause", pushState);
player.on("seeked", pushState);

// =========================
// HEARTBEAT HOST
// =========================
setInterval(() => {
  if (isHost && !player.paused()) {
    pushState();
  }
}, 4000);

// =========================
// CLOSE DROPDOWN
// =========================
document.addEventListener("click", (e) => {
  const inside =
    searchInput.contains(e.target) ||
    resultsDiv.contains(e.target);

  if (!inside) {
    setDropdownVisible(false);
  }
});

// =========================
// REOPEN DROPDOWN
// =========================
searchInput.addEventListener("focus", () => {
  if (resultsDiv.innerHTML.trim() !== "") {
    setDropdownVisible(true);
  }
});
