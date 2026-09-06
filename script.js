import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// CONFIG
// ============================================================

const WORKER_BASE =
  "https://watch-party-proxy.dahmani-jibril.workers.dev";

const TMDB_API_KEY =
  "09c2df46123d7a1da00dbb9e60a36a31";

const TMDB_BASE =
  "https://api.themoviedb.org/3";


// ============================================================
// FIREBASE
// ============================================================

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

const firebaseApp =
  initializeApp(firebaseConfig);

const db =
  getDatabase(firebaseApp);


// ============================================================
// DOM
// ============================================================

const searchInput =
  document.getElementById("searchInput");

const searchResults =
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

const status =
  document.getElementById("status");


// ============================================================
// VIDEO.JS
// ============================================================

const player =
  videojs("video", {
    controls: true,
    preload: "auto",
    responsive: true,
    fluid: true
  });


// ============================================================
// STATE
// ============================================================

let selectedMedia = null;
let selectedSeason = null;
let selectedEpisode = null;

let currentSources = [];
let currentSource = null;

let sourceAbortController = null;
let searchAbortController = null;

let searchTimer = null;

let roomId = null;
let isHost = false;

const sourceCache = new Map();


// ============================================================
// HELPERS
// ============================================================

function setStatus(text) {
  status.innerHTML =
    `<span class="pulse"></span>${text}`;
}

function debounce(fn, delay = 300) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(
      () => fn(...args),
      delay
    );
  };
}

function workerUrl(url) {
  return `${WORKER_BASE}/?url=${encodeURIComponent(url)}`;
}

function cacheKey(media, season, episode) {
  return [
    media?.media_type || "",
    media?.id || "",
    season || "",
    episode || ""
  ].join(":");
}


// ============================================================
// TMDB SEARCH
// ============================================================

const searchTMDB =
  debounce(async () => {

    const query =
      searchInput.value.trim();

    if (query.length < 2) {
      searchResults.innerHTML = "";
      return;
    }

    if (searchAbortController) {
      searchAbortController.abort();
    }

    searchAbortController =
      new AbortController();

    try {

      const url =
        `${TMDB_BASE}/search/multi` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=fr-FR` +
        `&query=${encodeURIComponent(query)}` +
        `&include_adult=false`;

      const response =
        await fetch(url, {
          signal:
            searchAbortController.signal
        });

      const data =
        await response.json();

      const results =
        (data.results || [])
          .filter(item =>
            item.media_type === "movie" ||
            item.media_type === "tv"
          )
          .slice(0, 8);

      renderSearchResults(results);

    } catch (error) {

      if (
        error.name !== "AbortError"
      ) {
        console.error(error);
      }

    }

  }, 250);


searchInput.addEventListener(
  "input",
  searchTMDB
);


// ============================================================
// SEARCH UI
// ============================================================

function renderSearchResults(results) {

  if (!results.length) {
    searchResults.innerHTML =
      `<div class="result-item">
        Aucun résultat
      </div>`;

    return;
  }

  searchResults.innerHTML =
    results.map(item => {

      const title =
        item.title ||
        item.name ||
        "Sans titre";

      const year =
        (
          item.release_date ||
          item.first_air_date ||
          ""
        ).slice(0, 4);

      const poster =
        item.poster_path
          ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
          : "";

      return `
        <div
          class="result-item"
          data-id="${item.id}"
          data-type="${item.media_type}"
        >
          ${
            poster
              ? `<img
                   src="${poster}"
                   loading="lazy"
                   width="46"
                   height="69"
                 >`
              : ""
          }

          <div>
            <strong>${escapeHtml(title)}</strong>
            <small>
              ${item.media_type === "tv"
                ? "Série"
                : "Film"}
              ${year ? ` • ${year}` : ""}
            </small>
          </div>
        </div>
      `;

    }).join("");
}


searchResults.addEventListener(
  "click",
  async event => {

    const item =
      event.target.closest(
        ".result-item"
      );

    if (!item) return;

    const id =
      Number(item.dataset.id);

    const type =
      item.dataset.type;

    await selectMedia(id, type);

    searchResults.innerHTML = "";
  }
);


// ============================================================
// SELECT MEDIA
// ============================================================

async function selectMedia(id, type) {

  setStatus("Chargement…");

  try {

    const response =
      await fetch(
        `${TMDB_BASE}/${type}/${id}` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=fr-FR`
      );

    selectedMedia =
      await response.json();

    selectedMedia.media_type =
      type;

    seasonSelect.innerHTML =
      `<option value="">
        Choisir une saison
      </option>`;

    episodeSelect.innerHTML =
      `<option value="">
        Choisir un épisode
      </option>`;

    playerSelect.innerHTML =
      `<option value="">
        Chargement des lecteurs…
      </option>`;

    currentSources = [];

    if (type === "tv") {

      for (
        const season
        of selectedMedia.seasons || []
      ) {

        if (season.season_number === 0)
          continue;

        const option =
          document.createElement("option");

        option.value =
          season.season_number;

        option.textContent =
          `Saison ${season.season_number}`;

        seasonSelect.appendChild(
          option
        );
      }

      setStatus(
        "Choisis une saison."
      );

      return;
    }

    // Film :
    await loadSources();

  } catch (error) {

    console.error(error);

    setStatus(
      "Erreur de chargement."
    );
  }
}


// ============================================================
// SEASON
// ============================================================

seasonSelect.addEventListener(
  "change",
  async () => {

    const season =
      Number(seasonSelect.value);

    if (!season || !selectedMedia)
      return;

    selectedSeason = season;

    episodeSelect.innerHTML =
      `<option value="">
        Chargement des épisodes…
      </option>`;

    try {

      const response =
        await fetch(
          `${TMDB_BASE}/tv/${selectedMedia.id}` +
          `/season/${season}` +
          `?api_key=${TMDB_API_KEY}` +
          `&language=fr-FR`
        );

      const data =
        await response.json();

      episodeSelect.innerHTML =
        `<option value="">
          Choisir un épisode
        </option>`;

      for (
        const episode
        of data.episodes || []
      ) {

        const option =
          document.createElement("option");

        option.value =
          episode.episode_number;

        option.textContent =
          `Épisode ${episode.episode_number}` +
          ` — ${episode.name || ""}`;

        episodeSelect.appendChild(
          option
        );
      }

      setStatus(
        "Choisis un épisode."
      );

    } catch (error) {

      console.error(error);

      setStatus(
        "Impossible de charger les épisodes."
      );
    }
  }
);


// ============================================================
// EPISODE
// ============================================================

episodeSelect.addEventListener(
  "change",
  async () => {

    const episode =
      Number(episodeSelect.value);

    if (!episode || !selectedMedia)
      return;

    selectedEpisode = episode;

    await loadSources();
  }
);


// ============================================================
// SOURCES
// ============================================================

async function loadSources() {

  if (!selectedMedia)
    return;

  const type =
    selectedMedia.media_type === "tv"
      ? "tv"
      : "movie";

  const season =
    type === "tv"
      ? selectedSeason
      : null;

  const episode =
    type === "tv"
      ? selectedEpisode
      : null;

  if (
    type === "tv" &&
    (!season || !episode)
  ) {
    return;
  }

  const key =
    cacheKey(
      selectedMedia,
      season,
      episode
    );

  // ------------------------------------------
  // CACHE NAVIGATEUR
  // ------------------------------------------

  const cached =
    sourceCache.get(key);

  if (cached) {

    currentSources =
      cached;

    populatePlayers(
      currentSources
    );

    setStatus(
      `${currentSources.length} lecteur(s) disponible(s).`
    );

    return;
  }

  // Annule la précédente requête
  if (sourceAbortController) {
    sourceAbortController.abort();
  }

  sourceAbortController =
    new AbortController();

  setStatus(
    "Recherche des meilleurs lecteurs…"
  );

  const title =
    selectedMedia.title ||
    selectedMedia.name ||
    "";

  const year =
    (
      selectedMedia.release_date ||
      selectedMedia.first_air_date ||
      ""
    ).slice(0, 4);

  const params =
    new URLSearchParams({
      tmdbId:
        String(selectedMedia.id),

      type,

      title,

      releaseYear: year
    });

  if (type === "tv") {

    params.set(
      "season",
      String(season)
    );

    params.set(
      "episode",
      String(episode)
    );
  }

  try {

    const response =
      await fetch(
        `${WORKER_BASE}/?url=` +
        encodeURIComponent(
          `https://afd926.mom/api/sources?${params}`
        ),
        {
          signal:
            sourceAbortController.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    const sources =
      parseSources(text);

    const optimized =
      optimizeSources(sources);

    if (!optimized.length) {
      throw new Error(
        "Aucune source HLS disponible."
      );
    }

    sourceCache.set(
      key,
      optimized
    );

    // Petit nettoyage du cache
    if (sourceCache.size > 20) {
      const firstKey =
        sourceCache.keys().next().value;

      sourceCache.delete(firstKey);
    }

    currentSources =
      optimized;

    populatePlayers(
      optimized
    );

    setStatus(
      `${optimized.length} lecteur(s) trouvé(s).`
    );

  } catch (error) {

    if (
      error.name === "AbortError"
    ) {
      return;
    }

    console.error(error);

    setStatus(
      "Impossible de récupérer les lecteurs."
    );
  }
}


// ============================================================
// PARSE SOURCES
// ============================================================

function parseSources(text) {

  const output = [];

  const lines =
    text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

  for (const line of lines) {

    let parsed = null;

    // JSON direct
    try {
      parsed = JSON.parse(line);
    } catch {}

    // Base64
    if (!parsed) {

      try {

        const decoded =
          atob(line);

        parsed =
          JSON.parse(decoded);

      } catch {}
    }

    if (!parsed)
      continue;

    const groups =
      Array.isArray(parsed)
        ? parsed
        : parsed.items
          ? [parsed]
          : [];

    for (const group of groups) {

      const items =
        Array.isArray(group.items)
          ? group.items
          : [];

      for (const item of items) {

        if (!item.url)
          continue;

        const type =
          String(
            item.type || ""
          ).toLowerCase();

        const url =
          String(item.url);

        if (
          type !== "hls" &&
          !url.includes(".m3u8") &&
          !url.includes("/e?")
        ) {
          continue;
        }

        output.push({
          ...item,
          provider:
            item.provider ||
            group.provider ||
            "",
          url
        });
      }
    }
  }

  return output;
}


// ============================================================
// SOURCE OPTIMIZATION
// ============================================================

function optimizeSources(sources) {

  const scored =
    sources
      .map(source => {

        const url =
          String(source.url || "");

        const service =
          String(
            source.service || ""
          ).toLowerCase();

        const language =
          String(
            source.language || ""
          ).toLowerCase();

        const quality =
          String(
            source.quality || ""
          ).toLowerCase();

        let score = 0;

        // Vidzy prioritaire
        if (
          service.includes("vidzy")
        ) {
          score += 10000;
        }

        // HLS
        if (
          source.type === "hls" ||
          url.includes(".m3u8") ||
          url.includes("/e?")
        ) {
          score += 3000;
        }

        // Qualité
        if (
          quality.includes("1080")
        ) {
          score += 1500;
        } else if (
          quality.includes("hd")
        ) {
          score += 1000;
        }

        // Langue
        if (
          language.includes("vostfr")
        ) {
          score += 500;
        }

        if (
          language === "vf"
        ) {
          score += 400;
        }

        // Proxy déjà prévu
        if (
          source.proxied
        ) {
          score += 100;
        }

        return {
          ...source,
          score
        };

      })
      .sort(
        (a, b) =>
          b.score - a.score
      );

  // Évite les doublons
  const seen =
    new Set();

  return scored.filter(
    source => {

      const key =
        source.url;

      if (seen.has(key))
        return false;

      seen.add(key);

      return true;
    }
  );
}


// ============================================================
// PLAYER SELECT
// ============================================================

function populatePlayers(
  sources
) {

  playerSelect.innerHTML =
    `<option value="">
      Choisir un lecteur
    </option>`;

  sources.forEach(
    (source, index) => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        index;

      const provider =
        source.provider ||
        source.service ||
        "Lecteur";

      const quality =
        source.quality
          ? ` • ${source.quality}`
          : "";

      const language =
        source.language
          ? ` • ${source.language.toUpperCase()}`
          : "";

      option.textContent =
        `${provider}${quality}${language}`;

      playerSelect.appendChild(
        option
      );
    }
  );

  // Sélectionne automatiquement
  // le meilleur lecteur
  if (sources.length) {

    playerSelect.value = "0";

    prepareSource(
      sources[0]
    );
  }
}


// ============================================================
// PLAYER CHANGE
// ============================================================

playerSelect.addEventListener(
  "change",
  () => {

    const index =
      Number(
        playerSelect.value
      );

    if (
      !Number.isInteger(index) ||
      !currentSources[index]
    ) {
      return;
    }

    prepareSource(
      currentSources[index]
    );
  }
);


// ============================================================
// PREPARE SOURCE
// ============================================================

function prepareSource(
  source
) {

  if (!source?.url)
    return;

  currentSource =
    source;

  const finalUrl =
    makePlaybackUrl(
      source.url
    );

  videoUrl.value =
    finalUrl;

  setStatus(
    `Lecteur prêt : ${
      source.provider ||
      source.service ||
      "HLS"
    }`
  );
}


// ============================================================
// PLAYBACK URL
// ============================================================

function makePlaybackUrl(
  url
) {

  if (
    url.startsWith(WORKER_BASE)
  ) {
    return url;
  }

  return workerUrl(url);
}


// ============================================================
// HOST
// ============================================================

hostBtn.addEventListener(
  "click",
  async () => {

    if (!selectedMedia) {
      setStatus(
        "Sélectionne d'abord un film ou une série."
      );

      return;
    }

    if (!currentSource) {

      if (!currentSources.length) {
        await loadSources();
      }

      currentSource =
        currentSources[0];
    }

    if (!currentSource?.url) {
      setStatus(
        "Aucun lecteur disponible."
      );

      return;
    }

    const url =
      makePlaybackUrl(
        currentSource.url
      );

    videoUrl.value = url;

    startPlayback(url);

    roomId =
      roomId ||
      generateRoomId();

    isHost = true;

    await set(
      ref(db, `rooms/${roomId}`),
      {
        url,
        currentTime: 0,
        paused: false,
        updatedAt:
          Date.now()
      }
    );

    setStatus(
      `Hôte actif • Room ${roomId}`
    );
  }
);


// ============================================================
// START PLAYBACK
// ============================================================

function startPlayback(url) {

  if (!url)
    return;

  player.src({
    src: url,
    type: "application/x-mpegURL"
  });

  player.ready(() => {

    player.play().catch(() => {
      // Le navigateur peut bloquer
      // l'autoplay jusqu'au clic utilisateur.
    });

  });
}


// ============================================================
// JOIN
// ============================================================

joinBtn.addEventListener(
  "click",
  async () => {

    const url =
      videoUrl.value.trim();

    if (!url) {

      setStatus(
        "Aucune URL à rejoindre."
      );

      return;
    }

    startPlayback(url);

    setStatus(
      "Lecture démarrée."
    );
  }
);


// ============================================================
// RESYNC
// ============================================================

syncBtn.addEventListener(
  "click",
  () => {

    if (!roomId)
      return;

    setStatus(
      "Synchronisation…"
    );
  }
);


// ============================================================
// FIREBASE SYNC
// ============================================================

function watchRoom(id) {

  onValue(
    ref(db, `rooms/${id}`),
    snapshot => {

      const data =
        snapshot.val();

      if (!data || isHost)
        return;

      if (
        data.url &&
        player.src() !== data.url
      ) {
        startPlayback(
          data.url
        );
      }

      if (
        typeof data.currentTime ===
        "number"
      ) {

        const difference =
          Math.abs(
            player.currentTime() -
            data.currentTime
          );

        if (difference > 1.5) {

          player.currentTime(
            data.currentTime
          );
        }
      }

      if (
        data.paused === false &&
        player.paused()
      ) {
        player.play().catch(() => {});
      }

      if (
        data.paused === true &&
        !player.paused()
      ) {
        player.pause();
      }
    }
  );
}


// ============================================================
// HOST SYNC
// ============================================================

let syncThrottle = 0;

player.on(
  "timeupdate",
  () => {

    if (!isHost || !roomId)
      return;

    const now =
      Date.now();

    // maximum 1 update / seconde
    if (
      now - syncThrottle < 1000
    ) {
      return;
    }

    syncThrottle = now;

    set(
      ref(db, `rooms/${roomId}`),
      {
        url:
          player.src(),

        currentTime:
          player.currentTime(),

        paused:
          player.paused(),

        updatedAt:
          now
      }
    );
  }
);


// ============================================================
// ROOM
// ============================================================

function generateRoomId() {

  return Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
