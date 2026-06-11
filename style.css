* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  font-family: "Inter", sans-serif;
  color: white;
  overflow-x: hidden;
  background:
    linear-gradient(rgba(10, 10, 20, 0.38), rgba(10, 10, 20, 0.32)),
    url("background.jpg");
  background-size: cover;
  background-position: center 20%;
  background-attachment: scroll;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
}

.container {
  width: 100%;
  max-width: 1000px;
  background: rgba(15, 23, 42, 0.02);
  border-radius: 15px;
  padding: 24px;
}

h1 {
  text-align: center;
  font-size: 3rem;
  margin-bottom: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  background: linear-gradient(90deg, #ffffff, #d8b4fe, #4db4e7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.82);
  text-shadow: 0 3px 8px rgba(168, 85, 247, 0.2);
}

.symbol {
  font-size: 0.65em;
  opacity: 0.7;
  position: relative;
  top: -4px;
}

.controls-card {
  position: relative;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 24px;
  box-shadow:
    0 10px 40px rgba(0,0,0,0.5),
    0 0 60px rgba(99,102,241,0.15);
  margin-bottom: 24px;
}

.search-card {
  position: relative;
  z-index: 1001;
}

.input-wrapper {
  position: relative;
  width: 100%;
  margin-bottom: 18px;
}

.input-wrapper i {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 16px;
  pointer-events: none;
}

input {
  width: 100%;
  padding: 18px 20px 18px 50px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(2, 6, 23, 0.9);
  color: white;
  font-size: 16px;
  transition: 0.25s ease;
}

input::placeholder {
  color: #94a3b8;
}

input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow:
    0 0 0 4px rgba(139,92,246,0.15),
    0 0 25px rgba(139,92,246,0.3);
}

.dropdown {
  display: none;
  position: absolute;
  top: calc(100% - 12px);
  left: 0;
  width: 100%;
  background: rgba(15, 23, 42, 0.98);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 14px;
  max-height: 320px;
  overflow-y: auto;
  z-index: 99999;
  box-shadow: 0 12px 35px rgba(0,0,0,0.7);
}

.result-item {
  padding: 12px 20px !important;
  color: #e2e8f0;
  transition: background 0.2s ease, padding-left 0.2s ease;
  cursor: pointer;
}

.result-item:hover {
  background: rgba(139, 92, 246, 0.25);
  padding-left: 25px !important;
}

.result-item strong {
  display: block;
  font-size: 15px;
  color: #ffffff;
  margin-bottom: 2px;
}

.result-with-poster {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.result-poster {
  width: 44px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
}

.dropdown::-webkit-scrollbar {
  width: 8px;
}

.dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 999px;
}

.selectors {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}

.selectors select {
  flex: 1;
  padding: 16px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.9);
  border: 1px solid rgba(255,255,255,0.08);
  color: white;
  font-size: 15px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.25s;
  min-width: 0;
}

.selectors select:focus {
  border-color: #8b5cf6;
}

.buttons {
  display: flex;
  gap: 14px;
}

button {
  flex: 1;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

button::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
  transition: 0.5s;
}

button:hover::before {
  transform: translateX(100%);
}

.btn-primary {
  background: linear-gradient(135deg, #ff4d6d, #ff006e);
  color: white;
  box-shadow: 0 10px 25px rgba(255,0,110,0.1);
}

.btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 14px 35px rgba(255,0,110,0.25);
}

.btn-secondary {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: white;
  box-shadow: 0 10px 25px rgba(99,102,241,0.18);
}

.btn-secondary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 14px 35px rgba(99,102,241,0.25);
}

.btn-outline {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e2e8f0;
}

.btn-outline:hover {
  background: rgba(255,255,255,0.08);
  transform: translateY(-3px);
}

.status-badge {
  width: fit-content;
  margin: 0 auto 24px auto;
  padding: 12px 22px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  font-size: 14px;
  font-weight: 600;
  color: #cbd5e1;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}

.video-section,
.video-wrapper {
  position: relative;
  z-index: 1;
}

.video-wrapper {
  border-radius: 28px;
  overflow: hidden;
  background: #000;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 20px 50px rgba(0,0,0,0.6),
    0 0 80px rgba(99,102,241,0.15);
  animation: fadeIn 0.8s ease;
  aspect-ratio: 16 / 9;
}

.video-js {
  width: 100% !important;
  height: 100% !important;
  border-radius: 28px;
  overflow: hidden;
  font-family: "Inter", sans-serif;
  background-color: #000;
}

.video-js .vjs-tech {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}

.video-js .vjs-control-bar {
  background: linear-gradient(to top, rgba(5, 5, 20, 0.92), transparent);
  border-radius: 0 0 28px 28px;
  padding: 0 8px 6px;
  height: 44px;
  font-size: 13px;
}

.video-js .vjs-button > .vjs-icon-placeholder::before,
.video-js .vjs-time-control {
  color: #e2e8f0;
}

.video-js .vjs-progress-holder {
  background: rgba(255,255,255,0.15);
  border-radius: 999px;
}

.video-js .vjs-play-progress {
  background: linear-gradient(90deg, #ff4d6d, #8b5cf6);
  border-radius: 999px;
}

.video-js .vjs-load-progress {
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
}

.video-js .vjs-play-progress::before {
  color: #ff4d6d;
  font-size: 14px;
  top: -4px;
}

.video-js .vjs-volume-level {
  background: linear-gradient(90deg, #8b5cf6, #2563eb);
  border-radius: 999px;
}

.video-js .vjs-volume-bar.vjs-slider-horizontal {
  background: rgba(255,255,255,0.15);
  border-radius: 999px;
}

.video-js .vjs-big-play-button {
  background: rgba(139, 92, 246, 0.55);
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  width: 72px;
  height: 72px;
  line-height: 72px;
  font-size: 28px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  backdrop-filter: blur(6px);
  transition: background 0.2s ease, transform 0.2s ease;
}

.video-js:hover .vjs-big-play-button,
.video-js .vjs-big-play-button:focus {
  background: rgba(139, 92, 246, 0.8);
  transform: translate(-50%, -50%) scale(1.08);
}

.video-js .vjs-current-time,
.video-js .vjs-time-divider,
.video-js .vjs-duration {
  display: block !important;
  color: #cbd5e1;
  font-size: 12px;
  padding: 0 4px;
}

.video-js .vjs-fullscreen-control .vjs-icon-placeholder::before,
.video-js .vjs-mute-control .vjs-icon-placeholder::before,
.video-js .vjs-play-control .vjs-icon-placeholder::before {
  color: #e2e8f0;
}

.video-js .vjs-control:hover .vjs-icon-placeholder::before {
  color: #ffffff;
  text-shadow: 0 0 8px rgba(139,92,246,0.7);
}

.video-js .vjs-no-flex .vjs-tech {
  border-radius: 28px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }

  .buttons,
  .selectors {
    flex-direction: column;
  }

  button {
    width: 100%;
  }

  .controls-card {
    padding: 18px;
  }

  .video-js .vjs-big-play-button {
    width: 56px;
    height: 56px;
    line-height: 56px;
    font-size: 22px;
  }

  .video-js .vjs-control-bar {
    height: 36px;
    padding: 0 2px 2px;
    font-size: 11px;
  }

  .video-js .vjs-control {
    width: 2.8em;
  }

  .video-js .vjs-remaining-time {
    display: none !important;
  }

  .video-js .vjs-current-time,
  .video-js .vjs-duration,
  .video-js .vjs-time-divider {
    padding: 0 2px;
    font-size: 10px;
  }

  .video-js .vjs-volume-panel {
    display: none !important;
  }

  .video-js .vjs-fullscreen-control {
    display: flex !important;
    align-items: center;
    justify-content: center;
  }

  .video-js .vjs-control-bar > * {
    flex-shrink: 1;
  }

  .video-js .vjs-progress-control {
    flex: 1;
    min-width: 30px;
  }
  .video-js.vjs-fullscreen,
  .video-js.vjs-fullscreen .vjs-tech,
  .video-js.vjs-fullscreen video,
  .video-js.vjs-fullscreen .vjs-control-bar {
    border-radius: 0 !important;
  }
  
  .video-js.vjs-fullscreen {
    width: 100vw !important;
    height: 100vh !important;
  }
  .video-wrapper:has(.video-js.vjs-fullscreen) {
  border-radius: 0 !important;
}
}
/* =====================================
   FULLSCREEN FIX VIDEO.JS
===================================== */

body.vjs-full-window,
html.vjs-full-window {
  margin: 0 !important;
  padding: 0 !important;
  background: #000 !important;
}

body.vjs-full-window .container,
body.vjs-full-window .video-wrapper,
body.vjs-full-window .video-js,
body.vjs-full-window .vjs-tech,
body.vjs-full-window video {
  border-radius: 0 !important;
}

.video-js.vjs-fullscreen,
.video-js.vjs-fullscreen .vjs-tech,
.video-js.vjs-fullscreen video,
.video-js.vjs-fullscreen .vjs-control-bar {
  border-radius: 0 !important;
}

.video-wrapper:fullscreen,
.video-wrapper:-webkit-full-screen {
  border-radius: 0 !important;
}

.video-wrapper:fullscreen .video-js,
.video-wrapper:fullscreen .vjs-tech,
.video-wrapper:fullscreen video,
.video-wrapper:-webkit-full-screen .video-js,
.video-wrapper:-webkit-full-screen .vjs-tech,
.video-wrapper:-webkit-full-screen video {
  border-radius: 0 !important;
}

.video-js.vjs-fullscreen,
body.vjs-full-window .video-js {
  width: 100vw !important;
  height: 100vh !important;
}

.video-js.vjs-fullscreen .vjs-tech,
body.vjs-full-window .video-js .vjs-tech {
  width: 100vw !important;
  height: 100vh !important;
}

body.vjs-full-window .video-wrapper {
  border: none !important;
  box-shadow: none !important;
}
