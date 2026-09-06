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

// Worker
const WORKER_BASE =
  "https://watch-party-proxy.dahmani-jibril.workers.dev";

// =========================
// X-NABI-PROOF
// =========================
//
// Tu peux mettre le proof directement dans l'URL.
//
// Exemple :
// https://jibril5.github.io/watch-party/
// ?tmdbId=1386315
// &title=The+Runner
// &year=2026
// &proof=TON_PROOF
//
// Le script le récupère automatiquement.
//

const pageParams = new URLSearchParams(
  window.location.search
);

let NABI_PROOF =
  pageParams.get("proof") || "";

// =========================
// FIREBASE
// =========================

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
        `&language=fr-FR`;

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
// AFFICHER RESULTATS
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
          <strong>${title}</strong>

          <div style="font-size:12px;opacity:0.6">
            ${typeLabel} • ${year}
          </div>
        </div>

        <img
          class="result-poster"
          src="${posterUrl}"
          alt="${title}"
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
    '<option value="">Choisir une saison</option>';

  episodeSelect.innerHTML =
    '<option value="">Choisir un épisode</option>';

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

  seasonSelect.removeEventListener(
    "change",
    loadEpisodes
  );

  seasonSelect.addEventListener(
    "change",
    loadEpisodes
  );

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

  if (!selectedShowId) {
    return;
  }

  const seasonNumber =
    seasonSelect.value;

  resetPlayers();

  if (!seasonNumber) {
    return;
  }

  try {

    const url =
      `https://api.themoviedb.org/3/tv/${selectedShowId}/season/${seasonNumber}` +
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
// RESET LECTEURS
// =========================

function resetPlayers() {

  availablePlayers = [];

  currentVideoUrl = "";

  playerSelect.innerHTML =
    `<option value="">
      Choisir un lecteur
    </option>`;
}

// =========================
// EXTRACTION DES SOURCES
// =========================

function decodeBase64(value) {

  try {

    const binary =
      atob(value);

    const bytes =
      new Uint8Array(
        binary.length
      );

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    return new TextDecoder(
      "utf-8"
    ).decode(bytes);

  } catch (error) {

    console.warn(
      "Base64 invalide :",
      error
    );

    return null;
  }
}

// =========================
// PARSER SOURCES
// =========================

function extractPlayers(text) {

  const players = [];

  if (!text) {
    return players;
  }

  /*
   * Première tentative :
   * réponse NDJSON classique.
   */
  const lines =
    text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

  for (const line of lines) {

    let decoded =
      line;

    /*
     * Si ce n'est pas du JSON,
     * tentative Base64.
     */
    if (
      !decoded.startsWith("{") &&
      !decoded.startsWith("[")
    ) {

      const base64Decoded =
        decodeBase64(decoded);

      if (base64Decoded) {
        decoded =
          base64Decoded;
      }
    }

    /*
     * Une ligne Base64 peut elle-même
     * contenir plusieurs JSON.
     */
    const decodedLines =
      decoded
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

    for (
      const jsonLine
      of decodedLines
    ) {

      try {

        const providerData =
          JSON.parse(jsonLine);

        /*
         * Cas :
         * {
         *   id,
         *   provider,
         *   items: [...]
         * }
         */
        if (
          providerData &&
          Array.isArray(
            providerData.items
          )
        ) {

          providerData.items
            .forEach(item => {

              if (!item.url) {
                return;
              }

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

                subtitles:
                  Array.isArray(
                    item.subtitles
                  )
                    ? item.subtitles
                    : [],

                url:
                  item.url
              });
            });

          continue;
        }

        /*
         * Cas éventuel où le JSON est
         * directement un tableau.
         */
        if (
          Array.isArray(
            providerData
          )
        ) {

          providerData.forEach(item => {

            if (!item?.url) {
              return;
            }

            players.push({

              id: "",

              provider:
                item.provider ||
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

              subtitles:
                Array.isArray(
                  item.subtitles
                )
                  ? item.subtitles
                  : [],

              url:
                item.url
            });
          });
        }

      } catch (error) {

        /*
         * Certaines lignes peuvent
         * simplement ne pas être du JSON.
         */
        console.warn(
          "JSON ignoré :",
          jsonLine.substring(0, 100)
        );
      }
    }
  }

  return players;
}

// =========================
// SCORE SOURCE
// =========================

function sourceScore(source) {

  let score = 0;

  /*
   * VIDZY prioritaire.
   */
  if (
    source.service
      ?.toLowerCase() === "vidzy"
  ) {
    score += 10000;
  }

  /*
   * HLS.
   */
  if (
    source.type
      ?.toLowerCase() === "hls"
  ) {
    score += 3000;
  }

  /*
   * HD.
   */
  if (
    source.quality
      ?.toLowerCase() === "hd"
  ) {
    score += 1000;
  }

  /*
   * VOSTFR.
   */
  if (
    source.language
      ?.toLowerCase() === "vostfr"
  ) {
    score += 500;
  }

  /*
   * VF.
   */
  if (
    source.language
      ?.toLowerCase() === "vf"
  ) {
    score += 400;
  }

  /*
   * Vfq.
   */
  if (
    source.language
      ?.toLowerCase() === "vfq"
  ) {
    score += 300;
  }

  /*
   * Proxy déjà fourni.
   */
  if (
    source.proxied === true
  ) {
    score += 100;
  }

  return score;
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
        document.createElement(
          "option"
        );

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

  /*
   * La liste est déjà triée.
   * On prend donc le premier.
   */
  playerSelect.value = "0";
}

// =========================
// URL SOURCE SELECTIONNEE
// =========================

async function getSelectedPlayerUrl() {

  const index =
    Number(playerSelect.value);

  if (
    Number.isNaN(index) ||
    !availablePlayers[index]
  ) {
    return null;
  }

  const selectedPlayer =
    availablePlayers[index];

  console.log(
    "LECTEUR CHOISI :",
    selectedPlayer
  );

  console.log(
    "URL LECTEUR CHOISI :",
    selectedPlayer.url
  );

  currentVideoUrl =
    selectedPlayer.url;

  videoUrl.value =
    selectedPlayer.url;

  return selectedPlayer.url;
}

// =========================
// CHANGEMENT LECTEUR
// =========================

playerSelect.addEventListener(
  "change",
  async () => {

    const url =
      await getSelectedPlayerUrl();

    if (!url) {
      return;
    }

    const selected =
      availablePlayers[
        Number(playerSelect.value)
      ];

    setStatus(
      `Lecteur sélectionné : ${selected.provider}`
    );

    if (
      isHost &&
      player.src()
    ) {

      await startHostPlayback(
        url
      );
    }
  }
);

// =========================
// CONSTRUCTION REQUETE
// =========================

function buildSourceRequest() {

  if (!NABI_PROOF) {

    throw new Error(
      "x-nabi-proof manquant. " +
      "Ajoute &proof=TON_PROOF dans l'URL."
    );
  }

  /*
   * FILM
   */
  if (
    selectedMediaType === "movie"
  ) {

    if (!selectedMovieData) {

      throw new Error(
        "Les informations du film ne sont pas encore chargées."
      );
    }

    const releaseYear =
      selectedMovieData.release_date
        ? selectedMovieData.release_date
            .split("-")[0]
        : "";

    return {

      tmdbId:
        selectedShowId,

      type:
        "movie",

      title:
        selectedMovieData.title ||
        selectedShowName,

      releaseYear,

      imdbId:
        selectedMovieData.imdb_id ||
        "",

      originalTitle:
        selectedMovieData.original_title ||
        selectedShowName
    };
  }

  /*
   * SERIE
   */
  const season =
    seasonSelect.value;

  const episode =
    episodeSelect.value;

  if (!season || !episode) {

    throw new Error(
      "Choisis une saison et un épisode."
    );
  }

  return {

    tmdbId:
      selectedShowId,

    type:
      "tv",

    title:
      selectedShowName,

    season,

    episode
  };
}

// =========================
// FETCH SOURCES
// =========================

async function fetchPlayersFromSelectedMedia() {

  let requestData;

  try {

    requestData =
      buildSourceRequest();

  } catch (error) {

    setStatus(
      "❌ " + error.message
    );

    throw error;
  }

  /*
   * URL de notre Worker.
   *
   * Le proof reste côté URL de notre site
   * puis est transmis au Worker.
   */
  const params =
    new URLSearchParams();

  params.set(
    "tmdbId",
    requestData.tmdbId
  );

  params.set(
    "type",
    requestData.type
  );

  params.set(
    "title",
    requestData.title
  );

  if (requestData.releaseYear) {

    params.set(
      "releaseYear",
      requestData.releaseYear
    );
  }

  if (requestData.season) {

    params.set(
      "season",
      requestData.season
    );
  }

  if (requestData.episode) {

    params.set(
      "episode",
      requestData.episode
    );
  }

  if (requestData.imdbId) {

    params.set(
      "imdbId",
      requestData.imdbId
    );
  }

  if (requestData.originalTitle) {

    params.set(
      "originalTitle",
      requestData.originalTitle
    );
  }

  /*
   * Le proof.
   */
  params.set(
    "proof",
    NABI_PROOF
  );

  const proxyUrl =
    `${WORKER_BASE}/sources?${params.toString()}`;

  console.log(
    "SOURCE WORKER URL :",
    proxyUrl
  );

  setStatus(
    "🔎 Recherche des lecteurs..."
  );

  const res =
    await fetch(
      proxyUrl,
      {
        method: "GET",

        headers: {
          "Accept":
            "application/x-ndjson"
        }
      }
    );

  const text =
    await res.text();

  console.log(
    "SOURCE API HTTP :",
    res.status
  );

  console.log(
    "RAW SOURCE RESPONSE :",
    text
  );

  if (!res.ok) {

    throw new Error(
      `Erreur API source HTTP ${res.status}`
    );
  }

  availablePlayers =
    extractPlayers(text);

  console.log(
    "TOUS LES LECTEURS :",
    availablePlayers
  );

  if (!availablePlayers.length) {

    setStatus(
      "❌ Aucun lecteur trouvé."
    );

    return null;
  }

  /*
   * IMPORTANT :
   * Vidzy HLS HD VOSTFR sera devant.
   */
  availablePlayers.sort(
    (a, b) =>
      sourceScore(b) -
      sourceScore(a)
  );

  console.log(
    "LECTEURS TRIES :",
    availablePlayers
  );

  populatePlayers(
    availablePlayers
  );

  const best =
    availablePlayers[0];

  console.log(
    "MEILLEURE SOURCE :",
    best
  );

  currentVideoUrl =
    best.url;

  videoUrl.value =
    best.url;

  setStatus(
    `✅ ${best.service} • ` +
    `${best.quality} • ` +
    `${best.language}`
  );

  return best.url;
}

// =========================
// TYPE VIDEO
// =========================

async function guessType(url) {

  const lower =
    url.toLowerCase();

  if (
    lower.includes(".m3u8")
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

  if (
    lower.includes(".ogg")
  ) {
    return "video/ogg";
  }

  /*
   * Les URLs proxy.taekong.space/e?d=...
   * n'indiquent pas forcément le MIME.
   *
   * On utilise d'abord le type annoncé
   * par la source dans startHostPlayback().
   */
  return "application/x-mpegURL";
}

// =========================
// SYNC FIREBASE
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

  setStatus(
    "👑 Hôte (Envoi de la synchro)"
  );

  syncing = true;

  try {

    /*
     * Les sources Vidzy HLS du JSON
     * peuvent être des URLs proxy.taekong.space
     * qui ne finissent pas par .m3u8.
     *
     * Elles sont néanmoins HLS.
     */
    const selected =
      availablePlayers.find(
        p => p.url === url
      );

    let type;

    if (
      selected &&
      selected.type
        ?.toLowerCase() === "hls"
    ) {

      type =
        "application/x-mpegURL";

    } else {

      type =
        await guessType(url);
    }

    console.log(
      "🎥 TYPE VIDEO :",
      type
    );

    player.src({
      src: url,
      type
    });

    await waitPlayerReady();

    await player.play();

    await pushState();

  } catch (e) {

    console.error(
      "Erreur de lecture :",
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

hostBtn.onclick =
  async () => {

    let url = null;

    try {

      if (selectedShowId) {

        url =
          await fetchPlayersFromSelectedMedia();
      }

      if (!url) {

        url =
          videoUrl.value.trim();
      }

      if (!url) {

        alert(
          "Sélectionne un film/série " +
          "ou entre une URL vidéo."
        );

        return;
      }

      await startHostPlayback(
        url
      );

    } catch (e) {

      console.error(
        "Erreur chargement vidéo :",
        e
      );

      setStatus(
        "❌ " + e.message
      );
    }
  };

// =========================
// JOIN
// =========================

joinBtn.onclick =
  async () => {

    isHost = false;

    setStatus(
      "👥 Spectateur (Synchronisé)"
    );

    try {

      player.muted(true);

      forceMutedForAutoplay =
        true;

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

syncBtn.onclick =
  async () => {

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
// WAIT PLAYER
// =========================

function waitPlayerReady() {

  return new Promise(resolve => {

    if (
      player.readyState() >= 2
    ) {

      return resolve();
    }

    player.one(
      "loadeddata",
      resolve
    );
  });
}

// =========================
// WAIT SEEK
// =========================

function waitSeeked() {

  return new Promise(resolve => {

    player.one(
      "seeked",
      resolve
    );
  });
}

// =========================
// APPLICATION SYNC
// =========================

async function applySync(data) {

  syncing = true;

  try {

    if (
      player.src() !== data.url
    ) {

      /*
       * Firebase stocke déjà l'URL
       * proxy/vidzy sélectionnée.
       */
      let type =
        "application/x-mpegURL";

      if (
        data.url
          .toLowerCase()
          .includes(".mp4")
      ) {
        type = "video/mp4";
      }

      if (
        data.url
          .toLowerCase()
          .includes(".webm")
      ) {
        type = "video/webm";
      }

      console.log(
        "SYNC TYPE :",
        type
      );

      player.src({
        src:
          data.url,
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
      player.paused() !==
        data.paused
    ) {

      player.pause();

      player.currentTime(
        target
      );

      await waitSeeked();

      if (
        Math.abs(
          player.currentTime() -
          target
        ) > 0.3
      ) {

        player.currentTime(
          target
        );

        await waitSeeked();
      }

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
            "📱 Autoplay bloqué. Cliquez sur Play."
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

    setTimeout(
      () => {
        syncing = false;
      },
      300
    );
  }
}

// =========================
// FIREBASE LISTENER
// =========================

onValue(
  roomRef,
  async snap => {

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
      player.paused() !==
        data.paused
    ) {

      await applySync(
        data
      );
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

    await applySync(
      data
    );
  }
}

// =========================
// PLAYER EVENTS
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

setInterval(
  () => {

    if (
      isHost &&
      !player.paused()
    ) {

      pushState();
    }

  },
  4000
);

// =========================
// CLOSE DROPDOWN
// =========================

document.addEventListener(
  "click",
  (e) => {

    const inside =
      searchInput.contains(
        e.target
      ) ||
      resultsDiv.contains(
        e.target
      );

    if (!inside) {

      setDropdownVisible(
        false
      );
    }
  }
);

// =========================
// REOPEN DROPDOWN
// =========================

searchInput.addEventListener(
  "focus",
  () => {

    if (
      resultsDiv.innerHTML.trim() !==
      ""
    ) {

      setDropdownVisible(
        true
      );
    }
  }
);

// =========================
// PROOF INFO
// =========================

if (!NABI_PROOF) {

  console.warn(
    "⚠️ Aucun proof dans l'URL."
  );

} else {

  console.log(
    "✅ x-nabi-proof présent."
  );
}
