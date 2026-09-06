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

const WORKER_BASE =
  "https://watch-party-proxy.dahmani-jibril.workers.dev";

const WORKER_PROXY =
  WORKER_BASE + "/?url=";


// =========================
// FIREBASE
// =========================

const firebaseConfig = {
  apiKey: "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",
  authDomain: "watch-party-d3f69.firebaseapp.com",
  databaseURL:
    "https://watch-party-d3f69-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "watch-party-d3f69",
  storageBucket:
    "watch-party-d3f69.firebasestorage.app",
  messagingSenderId: "568073707307",
  appId:
    "1:568073707307:web:b45e8f9e3f4770c09fef6e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const roomRef = ref(db, "room");

// =========================
// SYNCHRONISATION HORLOGE
// =========================

let serverTimeOffset = 0;

const offsetRef =
  ref(db, ".info/serverTimeOffset");

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

const searchInput =
  document.getElementById("searchInput");

const resultsDiv =
  document.getElementById("searchResults");

const seasonSelect =
  document.getElementById("seasonSelect");

const episodeSelect =
  document.getElementById("episodeSelect");

const playerSelect =
  document.getElementById("playerSelect");

const videoUrl =
  document.getElementById("videoUrl");

const hostBtn =
  document.getElementById("hostBtn");

const joinBtn =
  document.getElementById("joinBtn");

const syncBtn =
  document.getElementById("syncBtn");

const statusEl =
  document.getElementById("status");


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

let searchTimeout = null;
let sourceAbortController = null;

let availablePlayers = [];
let currentVideoUrl = "";


// =========================
// CACHE SOURCES
// =========================

// Cache très léger en mémoire.
// Évite de refaire l'appel API lorsqu'on
// revient sur le même film / épisode.

const sourceCache = new Map();


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
  resultsDiv.style.display =
    visible ? "block" : "none";
}


// =========================
// RECHERCHE TMDB
// =========================

searchInput.addEventListener("input", (e) => {

  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {

    const query =
      e.target.value.trim();

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
        `&language=fr-FR` +
        `&include_adult=false`;

      const res =
        await fetch(url);

      if (!res.ok) {
        throw new Error(res.status);
      }

      const data =
        await res.json();

      displayResults(
        data.results || []
      );

    } catch (err) {

      console.error(
        "Erreur recherche TMDB :",
        err
      );

      resultsDiv.innerHTML =
        `<div class="result-item">
          Erreur de chargement
        </div>`;

      setDropdownVisible(true);
    }

  }, 300);
});


// =========================
// AFFICHAGE RESULTATS
// =========================

function displayResults(results) {

  resultsDiv.innerHTML = "";

  const filteredResults =
    results.filter(item =>
      item.media_type === "tv" ||
      item.media_type === "movie"
    );

  if (!filteredResults.length) {

    resultsDiv.innerHTML =
      `<div class="result-item">
        Aucun résultat trouvé
      </div>`;

    setDropdownVisible(true);

    return;
  }

  filteredResults
    .slice(0, 8)
    .forEach(item => {

      const div =
        document.createElement("div");

      div.className =
        "result-item result-with-poster";

      const title =
        item.media_type === "movie"
          ? item.title
          : item.name;

      const date =
        item.media_type === "movie"
          ? item.release_date
          : item.first_air_date;

      const year =
        date
          ? date.split("-")[0]
          : "Date inconnue";

      const typeLabel =
        item.media_type === "movie"
          ? "Film"
          : "Série";

      const posterUrl =
        item.poster_path
          ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
          : "https://via.placeholder.com/60x90?text=?";

      div.innerHTML = `
        <div>
          <strong>${escapeHtml(title)}</strong>

          <div style="font-size:12px;opacity:0.6">
            ${typeLabel} • ${year}
          </div>
        </div>

        <img
          class="result-poster"
          src="${posterUrl}"
          alt="${escapeHtml(title)}"
          loading="lazy"
        >
      `;

      div.addEventListener(
        "click",
        () => selectMedia(item)
      );

      resultsDiv.appendChild(div);
    });

  setDropdownVisible(true);
}


// =========================
// SELECTION FILM / SERIE
// =========================

async function selectMedia(item) {

  selectedShowId = item.id;

  selectedMediaType =
    item.media_type;

  selectedMovieData = null;

  selectedShowName =
    item.media_type === "movie"
      ? item.title
      : item.name;

  searchInput.value =
    selectedShowName;

  resultsDiv.innerHTML = "";

  setDropdownVisible(false);

  resetPlayers();

  // =====================
  // FILM
  // =====================

  if (selectedMediaType === "movie") {

    seasonSelect.style.display =
      "none";

    episodeSelect.style.display =
      "none";

    setStatus(
      `Chargement du film ${selectedShowName}...`
    );

    try {

      const url =
        `https://api.themoviedb.org/3/movie/${item.id}` +
        `?api_key=${API_KEY}` +
        `&language=fr-FR`;

      const res =
        await fetch(url);

      if (!res.ok) {
        throw new Error(res.status);
      }

      selectedMovieData =
        await res.json();

      setStatus(
        `Film sélectionné : ${selectedShowName}`
      );

      // 🔥 Prépare immédiatement les sources
      // sans attendre le bouton Hôte.
      await fetchPlayersFromSelectedMedia();

    } catch (err) {

      console.error(
        "Erreur chargement film :",
        err
      );

      setStatus(
        "Erreur chargement film."
      );
    }

    return;
  }


  // =====================
  // SERIE
  // =====================

  seasonSelect.style.display =
    "block";

  episodeSelect.style.display =
    "block";

  setStatus(
    `Chargement de ${selectedShowName}...`
  );

  try {

    const url =
      `https://api.themoviedb.org/3/tv/${item.id}` +
      `?api_key=${API_KEY}` +
      `&language=fr-FR`;

    const res =
      await fetch(url);

    if (!res.ok) {
      throw new Error(res.status);
    }

    const data =
      await res.json();

    selectedSeasons =
      (data.seasons || [])
        .filter(
          s => s.season_number > 0
        );

    populateSeasons(
      selectedSeasons
    );

    setStatus(
      `Série sélectionnée : ${selectedShowName}`
    );

  } catch (err) {

    console.error(
      "Erreur chargement série :",
      err
    );

    setStatus(
      "Erreur chargement série."
    );
  }
}


// =========================
// SAISONS
// =========================

function populateSeasons(seasons) {

  seasonSelect.innerHTML =
    `<option value="">
      Choisir une saison
    </option>`;

  episodeSelect.innerHTML =
    `<option value="">
      Choisir un épisode
    </option>`;

  resetPlayers();

  seasons.forEach(season => {

    const option =
      document.createElement("option");

    option.value =
      season.season_number;

    option.textContent =
      season.name;

    seasonSelect.appendChild(
      option
    );
  });

  seasonSelect.onchange =
    loadEpisodes;

  if (seasons.length > 0) {

    seasonSelect.value =
      seasons[0].season_number;

    loadEpisodes();
  }
}


// =========================
// EPISODES
// =========================

async function loadEpisodes() {

  if (!selectedShowId)
    return;

  const seasonNumber =
    seasonSelect.value;

  resetPlayers();

  if (!seasonNumber)
    return;

  setStatus(
    "Chargement des épisodes..."
  );

  try {

    const url =
      `https://api.themoviedb.org/3/tv/${selectedShowId}` +
      `/season/${seasonNumber}` +
      `?api_key=${API_KEY}` +
      `&language=fr-FR`;

    const res =
      await fetch(url);

    if (!res.ok) {
      throw new Error(res.status);
    }

    const data =
      await res.json();

    episodeSelect.innerHTML = "";

    if (
      !data.episodes ||
      !data.episodes.length
    ) {

      episodeSelect.innerHTML =
        `<option value="">
          Aucun épisode trouvé
        </option>`;

      return;
    }

    data.episodes.forEach(ep => {

      const option =
        document.createElement("option");

      option.value =
        ep.episode_number;

      option.textContent =
        `Épisode ${ep.episode_number} - ${ep.name}`;

      episodeSelect.appendChild(
        option
      );
    });

    // 🔥 Charge automatiquement le premier épisode
    episodeSelect.value =
      data.episodes[0].episode_number;

    await loadEpisodeSources();

  } catch (err) {

    console.error(
      "Erreur chargement épisodes :",
      err
    );

    episodeSelect.innerHTML =
      `<option value="">
        Erreur chargement
      </option>`;
  }
}


// =========================
// CHANGEMENT EPISODE
// =========================

episodeSelect.addEventListener(
  "change",
  loadEpisodeSources
);


async function loadEpisodeSources() {

  if (
    selectedMediaType !== "tv"
  ) {
    return;
  }

  if (
    !seasonSelect.value ||
    !episodeSelect.value
  ) {
    return;
  }

  await fetchPlayersFromSelectedMedia();
}


// =========================
// RESET LECTEURS
// =========================

function resetPlayers() {

  availablePlayers = [];
  currentVideoUrl = "";

  if (playerSelect) {

    playerSelect.innerHTML =
      `<option value="">
        Choisir un lecteur
      </option>`;
  }
}


// =========================
// EXTRACTION DES LECTEURS
// =========================

function extractPlayers(text) {

  const players = [];

  const blocks =
    text
      .split("\n")
      .map(line => line.trim())
      .filter(
        line =>
          line.startsWith("{") &&
          line.endsWith("}")
      );

  for (const block of blocks) {

    try {

      const providerData =
        JSON.parse(block);

      if (
        !Array.isArray(
          providerData.items
        )
      ) {
        continue;
      }

      providerData.items.forEach(item => {

        if (!item.url)
          return;

        players.push({

          id:
            providerData.id || "",

          provider:
            item.provider ||
            providerData.provider ||
            providerData.id ||
            "Inconnu",

          service:
            item.service ||
            "inconnu",

          quality:
            item.quality ||
            "unknown",

          language:
            item.language ||
            "unknown",

          type:
            item.type ||
            "unknown",

          proxied:
            item.proxied === true,

          url:
            item.url
        });
      });

    } catch (err) {

      console.warn(
        "JSON ignoré :",
        err
      );
    }
  }

  return players;
}


// =========================
// TRI DES LECTEURS
// =========================

function sortPlayers(players) {

  return players
    .map((p, index) => {

      let score = 0;

      const provider =
        `${p.provider} ${p.service}`
          .toLowerCase();

      const quality =
        String(p.quality)
          .toLowerCase();

      const language =
        String(p.language)
          .toLowerCase();

      const type =
        String(p.type)
          .toLowerCase();

      // ⭐ Vidzy en priorité
      if (
        provider.includes("vidzy")
      ) {
        score += 10000;
      }

      // HLS
      if (
        type === "hls" ||
        p.url.includes(".m3u8") ||
        p.url.includes("/e?")
      ) {
        score += 3000;
      }

      // HD
      if (
        quality.includes("1080")
      ) {
        score += 1500;
      } else if (
        quality.includes("hd")
      ) {
        score += 1000;
      }

      // VOSTFR
      if (
        language.includes("vostfr")
      ) {
        score += 500;
      }

      // VF
      if (
        language === "vf"
      ) {
        score += 400;
      }

      // Déjà proxifié
      if (p.proxied) {
        score += 100;
      }

      return {
        ...p,
        _score: score,
        _originalIndex: index
      };

    })
    .sort(
      (a, b) =>
        b._score - a._score
    );
}


// =========================
// AFFICHER LECTEURS
// =========================

function populatePlayers(players) {

  playerSelect.innerHTML =
    `<option value="">
      Choisir un lecteur
    </option>`;

  if (!players.length) {

    playerSelect.innerHTML =
      `<option value="">
        Aucun lecteur trouvé
      </option>`;

    return;
  }

  players.forEach(
    (p, index) => {

      const option =
        document.createElement("option");

      option.value =
        String(index);

      option.textContent =
        `${p.provider} - ` +
        `${p.service} - ` +
        `${p.quality} - ` +
        `${p.language} - ` +
        `${p.type}`;

      playerSelect.appendChild(
        option
      );
    }
  );

  // ⭐ Premier = meilleur score
  playerSelect.value = "0";

  const best =
    players[0];

  currentVideoUrl =
    best.url;

  videoUrl.value =
    best.url;

  setStatus(
    `Lecteur prêt : ${best.provider}`
  );
}


// =========================
// RECUPERATION SOURCES
// =========================

async function fetchPlayersFromSelectedMedia() {

  const apiUrl =
    buildSourceApiUrl();

  if (!apiUrl)
    return null;


  // =====================
  // CACHE
  // =====================

  const cacheKey =
    apiUrl;

  if (
    sourceCache.has(cacheKey)
  ) {

    console.log(
      "⚡ Sources depuis le cache"
    );

    availablePlayers =
      sourceCache.get(cacheKey);

    populatePlayers(
      availablePlayers
    );

    return currentVideoUrl;
  }


  // =====================
  // ANNULATION REQUETE
  // =====================

  if (sourceAbortController) {
    sourceAbortController.abort();
  }

  sourceAbortController =
    new AbortController();


  setStatus(
    "Recherche des lecteurs..."
  );


  try {

    console.log(
      "API SOURCE :",
      apiUrl
    );

    const proxyUrl =
      WORKER_PROXY +
      encodeURIComponent(apiUrl);

    console.log(
      "WORKER :",
      proxyUrl
    );


    const res =
      await fetch(proxyUrl, {
        signal:
          sourceAbortController.signal
      });

    if (!res.ok) {

      throw new Error(
        `Erreur proxy HTTP ${res.status}`
      );
    }


    const text =
      await res.text();

    console.log(
      "SOURCE RESPONSE :",
      text
    );


    availablePlayers =
      extractPlayers(text);


    if (!availablePlayers.length) {

      setStatus(
        "Aucun lecteur trouvé."
      );

      return null;
    }


    // ⭐ TRI
    availablePlayers =
      sortPlayers(
        availablePlayers
      );


    // CACHE
    sourceCache.set(
      cacheKey,
      availablePlayers
    );


    populatePlayers(
      availablePlayers
    );


    return currentVideoUrl;

  } catch (err) {

    if (
      err.name === "AbortError"
    ) {
      console.log(
        "Ancienne requête annulée."
      );

      return null;
    }

    console.error(
      "Erreur récupération lecteurs :",
      err
    );

    setStatus(
      "Erreur récupération lecteurs."
    );

    return null;
  }
}


// =========================
// URL API SOURCES
// =========================

function buildSourceApiUrl() {

  /*
   * IMPORTANT :
   * On conserve ton endpoint qui fonctionnait.
   *
   * Le Worker s'occupe maintenant du
   * x-nabi-proof.
   */

  if (
    selectedMediaType === "movie"
  ) {

    if (!selectedMovieData) {

      alert(
        "Les infos du film ne sont pas encore chargées."
      );

      return null;
    }

    const releaseYear =
      selectedMovieData.release_date
        ? selectedMovieData
            .release_date
            .split("-")[0]
        : "";

    return (
      `https://afterdark06.mom/api/staging-20260420-yuna-hipaa-86nnorn0/sources` +

      `?tmdbId=${selectedShowId}` +

      `&type=movie` +

      `&imdbId=${
        encodeURIComponent(
          selectedMovieData.imdb_id || ""
        )
      }` +

      `&title=${
        encodeURIComponent(
          selectedMovieData.title ||
          selectedShowName
        )
      }` +

      `&releaseYear=${
        encodeURIComponent(
          releaseYear
        )
      }` +

      `&originalTitle=${
        encodeURIComponent(
          selectedMovieData.original_title ||
          selectedShowName
        )
      }`
    );
  }


  // =====================
  // SERIE
  // =====================

  const season =
    seasonSelect.value;

  const episode =
    episodeSelect.value;

  if (!season || !episode) {

    alert(
      "Choisis saison + épisode !"
    );

    return null;
  }

  return (
    `https://afterdark06.mom/api/staging-20260420-yuna-hipaa-86nnorn0/sources` +

    `?tmdbId=${selectedShowId}` +

    `&type=tv` +

    `&title=${
      encodeURIComponent(
        selectedShowName
      )
    }` +

    `&season=${
      encodeURIComponent(season)
    }` +

    `&episode=${
      encodeURIComponent(episode)
    }`
  );
}


// =========================
// LECTEUR
// =========================

playerSelect.addEventListener(
  "change",
  async () => {

    const index =
      Number(
        playerSelect.value
      );

    if (
      Number.isNaN(index) ||
      !availablePlayers[index]
    ) {
      return;
    }

    const selected =
      availablePlayers[index];

    currentVideoUrl =
      selected.url;

    videoUrl.value =
      selected.url;

    setStatus(
      `Lecteur sélectionné : ${selected.provider}`
    );

    // Si on est déjà hôte,
    // changement immédiat de source.
    if (isHost) {

      await startHostPlayback(
        selected.url
      );
    }
  }
);


// =========================
// TYPE VIDEO
// =========================

async function guessType(url) {

  const lower =
    url.toLowerCase();

  if (
    lower.includes(".m3u8") ||
    lower.includes("/e?")
  ) {
    return "application/x-mpegURL";
  }

  if (
    lower.includes(".mpd")
  ) {
    return "application/dash+xml";
  }

  if (
    lower.includes(".mp4")
  ) {
    return "video/mp4";
  }

  if (
    lower.includes(".webm")
  ) {
    return "video/webm";
  }

  return "application/x-mpegURL";
}


// =========================
// ATTENTE VIDEO
// =========================

function waitPlayerReady() {

  return new Promise(resolve => {

    if (
      player.readyState() >= 2
    ) {
      resolve();
      return;
    }

    player.one(
      "loadeddata",
      resolve
    );
  });
}


// =========================
// PUSH FIREBASE
// =========================

async function pushState() {

  if (
    !isHost ||
    !player.src() ||
    syncing
  ) {
    return;
  }

  await set(
    roomRef,
    {
      url:
        player.src(),

      time:
        player.currentTime(),

      paused:
        player.paused(),

      updatedAt:
        getNetworkTime()
    }
  );
}


// =========================
// LECTURE HOST
// =========================

async function startHostPlayback(url) {

  isHost = true;

  syncing = true;

  setStatus(
    "👑 Hôte (Envoi de la synchro)"
  );

  try {

    const type =
      await guessType(url);

    player.src({
      src: url,
      type
    });

    await waitPlayerReady();

    try {
      await player.play();
    } catch (e) {
      console.warn(
        "Autoplay bloqué :",
        e
      );
    }

    await pushState();

  } catch (e) {

    console.error(
      "Erreur lecture :",
      e
    );

    setStatus(
      "❌ Erreur de lecture"
    );

  } finally {

    syncing = false;
  }
}


// =========================
// HOST
// =========================

hostBtn.onclick = async () => {

  try {

    let url =
      currentVideoUrl;

    // Normalement déjà chargé grâce
    // au préchargement.
    if (!url) {

      url =
        await fetchPlayersFromSelectedMedia();
    }

    if (!url) {

      url =
        videoUrl.value.trim();
    }

    if (!url) {

      alert(
        "Sélectionne un film/série ou entre une URL vidéo."
      );

      return;
    }

    await startHostPlayback(url);

  } catch (e) {

    console.error(
      "Erreur chargement vidéo :",
      e
    );

    setStatus(
      "Erreur chargement vidéo."
    );
  }
};


// =========================
// JOIN
// =========================

joinBtn.onclick = async () => {

  isHost = false;

  setStatus(
    "👥 Spectateur (Synchronisé)"
  );

  try {

    player.muted(true);

    forceMutedForAutoplay = true;

    await player.play();

    player.pause();

  } catch (e) {

    console.warn(
      "Autoplay initial bloqué",
      e
    );
  }

  await forceSync();
};


// =========================
// RESYNC
// =========================

syncBtn.onclick = async () => {

  if (isHost) {

    await pushState();

    setStatus(
      "👑 Hôte (Sync forcée envoyée)"
    );

  } else {

    await forceSync();

    setStatus(
      "👥 Spectateur (Resync manuelle)"
    );
  }
};


// =========================
// APPLICATION SYNCHRO
// =========================

async function applySync(data) {

  syncing = true;

  try {

    if (
      player.src() !== data.url
    ) {

      const type =
        await guessType(data.url);

      player.src({
        src: data.url,
        type
      });

      await waitPlayerReady();
    }


    const latency =
      (
        getNetworkTime() -
        data.updatedAt
      ) / 1000;


    const target =
      data.paused
        ? data.time
        : data.time + latency;


    const drift =
      Math.abs(
        player.currentTime() -
        target
      );


    if (
      drift > 2 ||
      player.paused() !== data.paused
    ) {

      player.pause();

      player.currentTime(
        target
      );


      if (!data.paused) {

        try {

          await player.play();

          if (
            forceMutedForAutoplay
          ) {

            setStatus(
              "🔇 Vidéo lancée en sourdine"
            );

            forceMutedForAutoplay =
              false;
          }

        } catch (e) {

          console.warn(
            "Autoplay bloqué :",
            e
          );

          setStatus(
            "📱 Cliquez sur Play."
          );
        }

      } else {

        player.pause();
      }
    }

  } catch (e) {

    console.error(
      "Erreur synchronisation :",
      e
    );

  } finally {

    setTimeout(() => {
      syncing = false;
    }, 300);
  }
}


// =========================
// FIREBASE LISTENER
// =========================

onValue(
  roomRef,
  async (snap) => {

    const data =
      snap.val();

    if (
      !data ||
      isHost ||
      syncing
    ) {
      return;
    }

    const latency =
      (
        getNetworkTime() -
        data.updatedAt
      ) / 1000;

    const target =
      data.paused
        ? data.time
        : data.time + latency;

    const drift =
      Math.abs(
        player.currentTime() -
        target
      );

    if (
      player.src() !== data.url ||
      drift > 2 ||
      player.paused() !== data.paused
    ) {

      await applySync(data);
    }
  }
);


// =========================
// FORCE SYNC
// =========================

async function forceSync() {

  const snap =
    await get(roomRef);

  const data =
    snap.val();

  if (data) {
    await applySync(data);
  }
}


// =========================
// EVENTS VIDEO
// =========================

player.on(
  "play",
  pushState
);

player.on(
  "pause",
  pushState
);

player.on(
  "seeked",
  pushState
);


// =========================
// HEARTBEAT
// =========================

setInterval(() => {

  if (
    isHost &&
    !player.paused()
  ) {
    pushState();
  }

}, 4000);


// =========================
// FERMETURE DROPDOWN
// =========================

document.addEventListener(
  "click",
  (e) => {

    const inside =
      searchInput.contains(e.target) ||
      resultsDiv.contains(e.target);

    if (!inside) {
      setDropdownVisible(false);
    }
  }
);


// =========================
// REOUVERTURE
// =========================

searchInput.addEventListener(
  "focus",
  () => {

    if (
      resultsDiv.innerHTML.trim() !== ""
    ) {
      setDropdownVisible(true);
    }
  }
);


// =========================
// SECURITE HTML
// =========================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
