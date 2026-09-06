import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* =========================================================
   CONFIG
========================================================= */

const API_KEY =
  "09c2df46123d7a1da00dbb9e60a36a31";

const WORKER_BASE =
  "https://watch-party-proxy.dahmani-jibril.workers.dev";

/*
 * Aucun NABI_PROOF ici.
 *
 * Le x-nabi-proof est uniquement
 * dans le Cloudflare Worker.
 */

/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey:
    "AIzaSyB381f6lObetJhgiO-egZdrG3rVbQK8T3M",

  authDomain:
    "watch-party-d3f69.firebaseapp.com",

  databaseURL:
    "https://watch-party-d3f69-default-rtdb.europe-west1.firebasedatabase.app",

  projectId:
    "watch-party-d3f69",

  storageBucket:
    "watch-party-d3f69.firebasestorage.app",

  messagingSenderId:
    "568073707307",

  appId:
    "1:568073707307:web:b45e8f9e3f4770c09fef6e"
};

const app =
  initializeApp(
    firebaseConfig
  );

const db =
  getDatabase(app);

const roomRef =
  ref(db, "room");

/* =========================================================
   FIREBASE TIME
========================================================= */

let serverTimeOffset = 0;

const offsetRef =
  ref(
    db,
    ".info/serverTimeOffset"
  );

onValue(
  offsetRef,
  (snap) => {
    serverTimeOffset =
      snap.val() || 0;
  }
);

function getNetworkTime() {
  return (
    Date.now() +
    serverTimeOffset
  );
}

/* =========================================================
   VIDEO.JS
========================================================= */

const player =
  videojs(
    "video",
    {
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

        nativeVideoTracks:
          false,

        nativeAudioTracks:
          false,

        nativeTextTracks:
          false
      }
    }
  );

/* =========================================================
   DOM
========================================================= */

const searchInput =
  document.getElementById(
    "searchInput"
  );

const resultsDiv =
  document.getElementById(
    "searchResults"
  );

const seasonSelect =
  document.getElementById(
    "seasonSelect"
  );

const episodeSelect =
  document.getElementById(
    "episodeSelect"
  );

const playerSelect =
  document.getElementById(
    "playerSelect"
  );

const videoUrl =
  document.getElementById(
    "videoUrl"
  );

const hostBtn =
  document.getElementById(
    "hostBtn"
  );

const joinBtn =
  document.getElementById(
    "joinBtn"
  );

const syncBtn =
  document.getElementById(
    "syncBtn"
  );

const statusEl =
  document.getElementById(
    "status"
  );

/* =========================================================
   STATE
========================================================= */

let isHost = false;

let syncing = false;

let forceMutedForAutoplay =
  false;

let selectedShowId = null;

let selectedShowName = "";

let selectedMediaType =
  "tv";

let selectedMovieData =
  null;

let selectedSeasons = [];

let searchTimeout = null;

let availablePlayers = [];

let currentVideoUrl = "";

/* =========================================================
   STATUS
========================================================= */

function setStatus(text) {
  statusEl.innerText =
    text;
}

/* =========================================================
   DROPDOWN
========================================================= */

function setDropdownVisible(
  visible
) {
  resultsDiv.style.display =
    visible
      ? "block"
      : "none";
}

/* =========================================================
   RECHERCHE TMDB
========================================================= */

searchInput.addEventListener(
  "input",
  (e) => {
    clearTimeout(
      searchTimeout
    );

    searchTimeout =
      setTimeout(
        async () => {
          const query =
            e.target.value.trim();

          if (
            query.length < 3
          ) {
            resultsDiv.innerHTML =
              "";

            setDropdownVisible(
              false
            );

            return;
          }

          try {
            const url =
              `https://api.themoviedb.org/3/search/multi` +
              `?api_key=${API_KEY}` +
              `&query=${encodeURIComponent(
                query
              )}` +
              `&language=fr-FR`;

            const res =
              await fetch(url);

            if (!res.ok) {
              throw new Error(
                res.status
              );
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

            setDropdownVisible(
              true
            );
          }
        },
        300
      );
  }
);

/* =========================================================
   RESULTATS
========================================================= */

function displayResults(
  results
) {
  resultsDiv.innerHTML =
    "";

  const filteredResults =
    results.filter(
      (item) =>
        item.media_type ===
          "tv" ||
        item.media_type ===
          "movie"
    );

  if (
    !filteredResults.length
  ) {
    resultsDiv.innerHTML =
      `<div class="result-item">
        Aucun résultat trouvé
      </div>`;

    setDropdownVisible(
      true
    );

    return;
  }

  filteredResults
    .slice(0, 8)
    .forEach((item) => {
      const div =
        document.createElement(
          "div"
        );

      div.className =
        "result-item result-with-poster";

      const title =
        item.media_type ===
        "movie"
          ? item.title
          : item.name;

      const date =
        item.media_type ===
        "movie"
          ? item.release_date
          : item.first_air_date;

      const year =
        date
          ? date.split("-")[0]
          : "Date inconnue";

      const typeLabel =
        item.media_type ===
        "movie"
          ? "Film"
          : "Série";

      const posterUrl =
        item.poster_path
          ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
          : "https://via.placeholder.com/60x90?text=?";

      div.innerHTML = `
        <div>
          <strong>${escapeHtml(
            title
          )}</strong>

          <div style="font-size:12px;opacity:0.6">
            ${typeLabel} • ${year}
          </div>
        </div>

        <img
          class="result-poster"
          src="${posterUrl}"
          alt="${escapeHtml(
            title
          )}"
        >
      `;

      div.addEventListener(
        "click",
        () =>
          selectMedia(item)
      );

      resultsDiv.appendChild(
        div
      );
    });

  setDropdownVisible(
    true
  );
}

/* =========================================================
   SELECTION FILM / SERIE
========================================================= */

async function selectMedia(
  item
) {
  selectedShowId =
    item.id;

  selectedMediaType =
    item.media_type;

  selectedMovieData =
    null;

  selectedShowName =
    item.media_type ===
    "movie"
      ? item.title
      : item.name;

  searchInput.value =
    selectedShowName;

  resultsDiv.innerHTML =
    "";

  setDropdownVisible(
    false
  );

  resetPlayers();

  /*
   * FILM
   */
  if (
    selectedMediaType ===
    "movie"
  ) {
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
        throw new Error(
          res.status
        );
      }

      selectedMovieData =
        await res.json();

      setStatus(
        `Film sélectionné : ${selectedShowName}`
      );

      /*
       * On récupère directement
       * les sources du film.
       */
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

  /*
   * SERIE
   */
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
      throw new Error(
        res.status
      );
    }

    const data =
      await res.json();

    selectedSeasons =
      (data.seasons || [])
        .filter(
          (s) =>
            s.season_number >
            0
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

/* =========================================================
   SAISONS
========================================================= */

function populateSeasons(
  seasons
) {
  seasonSelect.innerHTML =
    `<option value="">
      Choisir une saison
    </option>`;

  episodeSelect.innerHTML =
    `<option value="">
      Choisir un épisode
    </option>`;

  resetPlayers();

  seasons.forEach(
    (season) => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        season.season_number;

      option.textContent =
        season.name;

      seasonSelect.appendChild(
        option
      );
    }
  );

  seasonSelect.onchange =
    loadEpisodes;

  /*
   * Première saison
   */
  if (seasons.length) {
    seasonSelect.value =
      seasons[0].season_number;

    loadEpisodes();
  }
}

/* =========================================================
   EPISODES
========================================================= */

async function loadEpisodes() {
  if (
    !selectedShowId
  ) {
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
      throw new Error(
        res.status
      );
    }

    const data =
      await res.json();

    episodeSelect.innerHTML =
      "";

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

    data.episodes.forEach(
      (ep) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          ep.episode_number;

        option.textContent =
          `Épisode ${ep.episode_number} - ${ep.name}`;

        episodeSelect.appendChild(
          option
        );
      }
    );

    /*
     * IMPORTANT :
     * on ne lance la source qu'après
     * avoir choisi l'épisode.
     */
    episodeSelect.onchange =
      fetchPlayersFromSelectedMedia;
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

/* =========================================================
   RESET PLAYERS
========================================================= */

function resetPlayers() {
  availablePlayers =
    [];

  currentVideoUrl =
    "";

  playerSelect.innerHTML =
    `<option value="">
      Choisir un lecteur
    </option>`;

  videoUrl.value =
    "";
}

/* =========================================================
   BASE64
========================================================= */

function decodeBase64(
  value
) {
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
  } catch {
    return null;
  }
}

/* =========================================================
   EXTRACTION SOURCES
========================================================= */

function extractPlayers(
  text
) {
  const players =
    [];

  if (!text) {
    return players;
  }

  const lines =
    text
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  for (
    const line of lines
  ) {
    let decoded =
      line;

    /*
     * JSON direct.
     */
    if (
      !decoded.startsWith(
        "{"
      ) &&
      !decoded.startsWith(
        "["
      )
    ) {
      const base64Decoded =
        decodeBase64(
          decoded
        );

      if (base64Decoded) {
        decoded =
          base64Decoded;
      }
    }

    /*
     * Une ligne peut contenir
     * plusieurs JSON après décodage.
     */
    const jsonLines =
      decoded
        .split(/\r?\n/)
        .map(
          (x) => x.trim()
        )
        .filter(Boolean);

    for (
      const jsonLine of jsonLines
    ) {
      try {
        const data =
          JSON.parse(
            jsonLine
          );

        /*
         * Format :
         *
         * {
         *   id,
         *   provider,
         *   items: [...]
         * }
         */
        if (
          data &&
          Array.isArray(
            data.items
          )
        ) {
          data.items.forEach(
            (item) => {
              if (
                !item?.url
              ) {
                return;
              }

              players.push({
                id:
                  data.id ||
                  "",

                provider:
                  item.provider ||
                  data.provider ||
                  data.id ||
                  "Inconnu",

                service:
                  item.service ||
                  "unknown",

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
                  item.proxied ===
                  true,

                subtitles:
                  Array.isArray(
                    item.subtitles
                  )
                    ? item.subtitles
                    : [],

                url:
                  item.url
              });
            }
          );

          continue;
        }

        /*
         * Tableau direct.
         */
        if (
          Array.isArray(data)
        ) {
          data.forEach(
            (item) => {
              if (
                !item?.url
              ) {
                return;
              }

              players.push({
                id: "",

                provider:
                  item.provider ||
                  "Inconnu",

                service:
                  item.service ||
                  "unknown",

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
                  item.proxied ===
                  true,

                subtitles:
                  Array.isArray(
                    item.subtitles
                  )
                    ? item.subtitles
                    : [],

                url:
                  item.url
              });
            }
          );
        }
      } catch {
        /*
         * Ligne ignorée.
         */
      }
    }
  }

  /*
   * Suppression doublons.
   */
  const seen =
    new Set();

  return players.filter(
    (player) => {
      const key =
        [
          player.service,
          player.url,
          player.language,
          player.quality
        ].join("|");

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

/* =========================================================
   SCORE SOURCES
========================================================= */

function sourceScore(
  source
) {
  let score = 0;

  /*
   * Vidzy prioritaire.
   */
  if (
    source.service
      ?.toLowerCase() ===
    "vidzy"
  ) {
    score += 10000;
  }

  /*
   * HLS.
   */
  if (
    source.type
      ?.toLowerCase() ===
    "hls"
  ) {
    score += 3000;
  }

  /*
   * HD.
   */
  if (
    source.quality
      ?.toLowerCase() ===
    "hd"
  ) {
    score += 1000;
  }

  /*
   * VOSTFR.
   */
  if (
    source.language
      ?.toLowerCase() ===
    "vostfr"
  ) {
    score += 500;
  }

  /*
   * VF.
   */
  if (
    source.language
      ?.toLowerCase() ===
    "vf"
  ) {
    score += 400;
  }

  /*
   * Source déjà proxifiée.
   */
  if (
    source.proxied === true
  ) {
    score += 100;
  }

  return score;
}

/* =========================================================
   AFFICHAGE PLAYERS
========================================================= */

function populatePlayers(
  players
) {
  playerSelect.innerHTML =
    `<option value="">
      Choisir un lecteur
    </option>`;

  if (
    !players.length
  ) {
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
   * Meilleure source automatiquement.
   */
  playerSelect.value =
    "0";
}

/* =========================================================
   BUILD SOURCE API
========================================================= */

function buildSourceApiUrl() {
  if (
    !selectedShowId
  ) {
    throw new Error(
      "Aucun film ou série sélectionné."
    );
  }

  const params =
    new URLSearchParams();

  params.set(
    "tmdbId",
    selectedShowId
  );

  /*
   * FILM
   */
  if (
    selectedMediaType ===
    "movie"
  ) {
    const releaseYear =
      selectedMovieData
        ?.release_date
        ? selectedMovieData.release_date
            .split("-")[0]
        : "";

    params.set(
      "type",
      "movie"
    );

    params.set(
      "title",
      selectedMovieData?.title ||
        selectedShowName
    );

    if (releaseYear) {
      params.set(
        "releaseYear",
        releaseYear
      );
    }
  }

  /*
   * SERIE
   */
  else {
    const season =
      seasonSelect.value;

    const episode =
      episodeSelect.value;

    if (
      !season ||
      !episode
    ) {
      throw new Error(
        "Choisis une saison et un épisode."
      );
    }

    params.set(
      "type",
      "tv"
    );

    params.set(
      "title",
      selectedShowName
    );

    params.set(
      "season",
      season
    );

    params.set(
      "episode",
      episode
    );
  }

  return (
    "https://afd926.mom/api/sources?" +
    params.toString()
  );
}

/* =========================================================
   FETCH SOURCES VIA WORKER
========================================================= */

async function fetchPlayersFromSelectedMedia() {
  try {
    const apiUrl =
      buildSourceApiUrl();

    setStatus(
      "🔎 Recherche des lecteurs..."
    );

    /*
     * IMPORTANT :
     *
     * Pas de proof ici.
     *
     * Le Worker ajoute x-nabi-proof
     * lui-même.
     */
    const workerUrl =
      `${WORKER_BASE}/?url=` +
      encodeURIComponent(
        apiUrl
      );

    console.log(
      "SOURCE API :",
      apiUrl
    );

    const res =
      await fetch(
        workerUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/x-ndjson"
          },

          cache:
            "no-store"
        }
      );

    const text =
      await res.text();

    console.log(
      "SOURCE API HTTP :",
      res.status
    );

    if (!res.ok) {
      console.error(
        "SOURCE API ERROR :",
        text
      );

      throw new Error(
        `Erreur API source HTTP ${res.status}`
      );
    }

    availablePlayers =
      extractPlayers(
        text
      );

    console.log(
      "LECTEURS TROUVÉS :",
      availablePlayers
    );

    if (
      !availablePlayers.length
    ) {
      setStatus(
        "❌ Aucun lecteur trouvé."
      );

      return null;
    }

    /*
     * Meilleur lecteur en premier.
     */
    availablePlayers.sort(
      (a, b) =>
        sourceScore(b) -
        sourceScore(a)
    );

    populatePlayers(
      availablePlayers
    );

    const best =
      availablePlayers[0];

    currentVideoUrl =
      best.url;

    /*
     * On affiche l'URL originale
     * dans le champ, pas le Worker.
     */
    videoUrl.value =
      best.url;

    setStatus(
      `✅ ${best.service} • ` +
      `${best.quality} • ` +
      `${best.language}`
    );

    /*
     * Pour le bouton Hôte.
     */
    return best.url;
  } catch (error) {
    console.error(
      "Erreur récupération sources :",
      error
    );

    setStatus(
      "❌ " +
      error.message
    );

    return null;
  }
}

/* =========================================================
   URL PLAYABLE
========================================================= */

function makePlayableUrl(
  url
) {
  if (!url) {
    return null;
  }

  try {
    const parsed =
      new URL(url);

    /*
     * Les sources proxifiées HLS
     * passent par notre Worker.
     */
    if (
      parsed.hostname ===
        "proxy.taekong.space" ||
      parsed.hostname ===
        "v6.vidzy.cc"
    ) {
      return (
        `${WORKER_BASE}/?url=` +
        encodeURIComponent(
          url
        )
      );
    }

    return url;
  } catch {
    return url;
  }
}

/* =========================================================
   TYPE VIDEO
========================================================= */

async function guessType(
  url
) {
  const lower =
    url.toLowerCase();

  if (
    lower.includes(
      ".m3u8"
    )
  ) {
    return "application/x-mpegURL";
  }

  if (
    lower.includes(
      ".mpd"
    )
  ) {
    return "application/dash+xml";
  }

  if (
    lower.includes(
      ".mp4"
    )
  ) {
    return "video/mp4";
  }

  if (
    lower.includes(
      ".webm"
    )
  ) {
    return "video/webm";
  }

  return "application/x-mpegURL";
}

/* =========================================================
   LECTEUR SELECTIONNE
========================================================= */

async function getSelectedPlayerUrl() {
  const index =
    Number(
      playerSelect.value
    );

  if (
    Number.isNaN(index) ||
    !availablePlayers[index]
  ) {
    return null;
  }

  const selected =
    availablePlayers[index];

  console.log(
    "LECTEUR CHOISI :",
    selected
  );

  currentVideoUrl =
    selected.url;

  videoUrl.value =
    selected.url;

  return selected.url;
}

/* =========================================================
   CHANGEMENT LECTEUR
========================================================= */

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
        Number(
          playerSelect.value
        )
      ];

    setStatus(
      `Lecteur sélectionné : ${selected.provider}`
    );

    /*
     * Si l'utilisateur est déjà hôte,
     * on lance immédiatement.
     */
    if (isHost) {
      await startHostPlayback(
        url
      );
    }
  }
);

/* =========================================================
   SYNC FIREBASE
========================================================= */

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

/* =========================================================
   LECTURE HOST
========================================================= */

async function startHostPlayback(
  url
) {
  isHost = true;

  setStatus(
    "👑 Hôte (Envoi de la synchro)"
  );

  syncing = true;

  try {
    const selected =
      availablePlayers.find(
        (p) =>
          p.url === url
      );

    /*
     * URL originale -> URL Worker.
     */
    const playableUrl =
      makePlayableUrl(
        url
      );

    let type =
      "application/x-mpegURL";

    /*
     * L'API nous dit directement
     * si c'est du HLS.
     */
    if (
      selected &&
      selected.type
        ?.toLowerCase() ===
        "hls"
    ) {
      type =
        "application/x-mpegURL";
    } else {
      type =
        await guessType(
          playableUrl
        );
    }

    console.log(
      "SOURCE ORIGINALE :",
      url
    );

    console.log(
      "SOURCE WORKER :",
      playableUrl
    );

    console.log(
      "TYPE :",
      type
    );

    player.src({
      src:
        playableUrl,

      type
    });

    currentVideoUrl =
      playableUrl;

    await waitPlayerReady();

    try {
      await player.play();
    } catch {
      /*
       * Autoplay éventuellement bloqué.
       */
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

/* =========================================================
   HOST
========================================================= */

hostBtn.onclick =
  async () => {
    let url =
      null;

    try {
      /*
       * Film/série sélectionné :
       * on récupère automatiquement
       * les sources.
       */
      if (
        selectedShowId
      ) {
        url =
          await fetchPlayersFromSelectedMedia();
      }

      /*
       * URL manuelle sinon.
       */
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

      await startHostPlayback(
        url
      );
    } catch (e) {
      console.error(
        "Erreur chargement vidéo :",
        e
      );

      setStatus(
        "❌ " +
        e.message
      );
    }
  };

/* =========================================================
   JOIN
========================================================= */

joinBtn.onclick =
  async () => {
    isHost = false;

    setStatus(
      "👥 Spectateur (Synchronisé)"
    );

    try {
      player.muted(
        true
      );

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

/* =========================================================
   RESYNC
========================================================= */

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

/* =========================================================
   WAIT PLAYER
========================================================= */

function waitPlayerReady() {
  return new Promise(
    (resolve) => {
      if (
        player.readyState() >=
        2
      ) {
        return resolve();
      }

      player.one(
        "loadeddata",
        resolve
      );
    }
  );
}

/* =========================================================
   WAIT SEEK
========================================================= */

function waitSeeked() {
  return new Promise(
    (resolve) => {
      player.one(
        "seeked",
        resolve
      );
    }
  );
}

/* =========================================================
   APPLY SYNC
========================================================= */

async function applySync(
  data
) {
  syncing = true;

  try {
    if (
      player.src() !==
      data.url
    ) {
      let type =
        "application/x-mpegURL";

      if (
        data.url
          ?.toLowerCase()
          .includes(
            ".mp4"
          )
      ) {
        type =
          "video/mp4";
      }

      if (
        data.url
          ?.toLowerCase()
          .includes(
            ".webm"
          )
      ) {
        type =
          "video/webm";
      }

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
        : data.time +
          latency;

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
        Math.max(
          0,
          target
        )
      );

      try {
        await waitSeeked();
      } catch {}

      if (
        !data.paused
      ) {
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
        } catch {
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

/* =========================================================
   FIREBASE LISTENER
========================================================= */

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
        : data.time +
          latency;

    const drift =
      Math.abs(
        player.currentTime() -
        target
      );

    if (
      player.src() !==
        data.url ||
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

/* =========================================================
   FORCE SYNC
========================================================= */

async function forceSync() {
  const snap =
    await get(
      roomRef
    );

  const data =
    snap.val();

  if (data) {
    await applySync(
      data
    );
  }
}

/* =========================================================
   PLAYER EVENTS
========================================================= */

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

/* =========================================================
   HEARTBEAT
========================================================= */

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

/* =========================================================
   CLOSE DROPDOWN
========================================================= */

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

/* =========================================================
   REOPEN DROPDOWN
========================================================= */

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

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

/* =========================================================
   READY
========================================================= */

setStatus(
  "En attente d'une action..."
);
