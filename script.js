const STORAGE_KEY = "agent-prism-mission-state";
const state = {
  missionAccepted: false,
  noTapCount: 0,
  currentScene: "secure-connection",
  unlockedFiles: [],
  soundEnabled: true,
};

const noMessages = [
  "TARGET LOST",
  "DECLINE BUTTON HAS EVADED CAPTURE",
  "Agent Prism, you're making this unnecessarily difficult.",
  "Agent Lama is disappointed. 😔",
  "Are you sure about that? 👀"
];

const noScaleMap = [1, 1.12, 1.25, 1.4, 1.6, 1.85];
const sceneOrder = [
  "secure-connection",
  "briefing",
  "mission-accepted",
  "mission-file-01",
  "mission-file-02",
  "mission-file-03",
  "mission-file-04",
  "classified-surprise",
  "mission-timeline",
  "final-transmission"
];

let audioContext = null;
let terminalSequenceTimer = null;

const elements = {
  body: document.body,
  terminalStatus: document.getElementById("terminalStatus"),
  terminalMeta: document.getElementById("terminalMeta"),
  progressBar: document.getElementById("progressBar"),
  secureMessage: document.getElementById("secureMessage"),
  enterButton: document.getElementById("enterButton"),
  decisionPanel: document.getElementById("decisionPanel"),
  decisionMessage: document.getElementById("decisionMessage"),
  yesButton: document.getElementById("yesButton"),
  noButton: document.getElementById("noButton"),
  soundToggle: document.getElementById("soundToggle"),
  resetButton: document.getElementById("resetButton"),
  countdown: document.querySelector(".countdown"),
  errorText: document.querySelector(".error-text"),
  selfDestructMessage: document.getElementById("selfDestructMessage"),
};

function init() {
  bindEvents();
  setSoundToggleLabel();

  const params = new URLSearchParams(window.location.search);
  const shouldReset = params.get("reset") === "true" || params.get("reset") === "1" || window.location.hash === "#reset";

  if (shouldReset) {
    resetState();
    return;
  }

  loadState();
  applyYesScale();
  moveNoButton();

  if (state.missionAccepted) {
    showScene("mission-accepted");
    state.unlockedFiles = ["mission-file-01", "mission-file-02", "mission-file-03", "mission-file-04", "classified-surprise"];
    saveState();
  } else {
    showScene("briefing");
  }
}

function bindEvents() {
  elements.enterButton.addEventListener("click", () => {
    elements.enterButton.classList.add("hidden");
    showScene("briefing");
    playTone("boot");
    saveState();
  });

  elements.yesButton.addEventListener("click", acceptMission);
  elements.noButton.addEventListener("pointerdown", handleNoButton);
  elements.noButton.addEventListener("touchstart", (event) => {
    event.preventDefault();
    handleNoButton(event);
  }, { passive: false });

  document.querySelectorAll(".next-scene").forEach((button) => {
    button.addEventListener("click", () => {
      const nextScene = button.dataset.next;
      if (nextScene) {
        showScene(nextScene);
        unlockFile(nextScene);
        playTone("transition");
      }
    });
  });

  document.querySelectorAll(".timeline-item").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      if (target) {
        showScene(target);
        unlockFile(target);
        playTone("transition");
      }
    });
  });

  elements.soundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    setSoundToggleLabel();
    saveState();
    if (state.soundEnabled) {
      playTone("transition");
    }
  });

  elements.resetButton.addEventListener("click", resetState);

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      resetState();
    }

    if (event.key === "Enter" && elements.enterButton && !elements.enterButton.classList.contains("hidden")) {
      elements.enterButton.click();
    }
  });
}

function startSecureConnection() {
  const steps = [
    { text: "INITIALISING SECURE CONNECTION...", progress: 47, meta: "ESTABLISHING ENCRYPTED CHANNEL..." },
    { text: "ESTABLISHING ENCRYPTED CHANNEL...", progress: 61, meta: "VERIFYING HANDLER IDENTITY..." },
    { text: "VERIFYING HANDLER IDENTITY...", progress: 82, meta: "CONNECTION SECURED" },
    { text: "CONNECTION SECURED", progress: 100, meta: "TOP SECRET" }
  ];

  let index = 0;

  clearInterval(terminalSequenceTimer);
  terminalSequenceTimer = setInterval(() => {
    const step = steps[index];
    if (!step) {
      clearInterval(terminalSequenceTimer);
      showSecureMessage();
      return;
    }

    elements.terminalStatus.textContent = step.text;
    elements.terminalMeta.textContent = step.meta;
    elements.progressBar.style.width = `${step.progress}%`;
    playTone("boot");
    index += 1;
  }, 750);
}

function showSecureMessage() {
  elements.secureMessage.classList.add("active");
  elements.terminalStatus.textContent = "CONNECTION SECURED";
  elements.terminalMeta.textContent = "TOP SECRET";
  elements.progressBar.style.width = "100%";

  setTimeout(() => {
    elements.secureMessage.innerHTML = `
      <div class="message-top">IDENTIFICATION SUCCESSFUL</div>
      <div class="message-sub">WELCOME, AGENT PRISM.</div>
      <div class="message-heading">MISSION BRIEFING</div>
    `;
    elements.enterButton.classList.remove("hidden");
  }, 420);
}

function showScene(sceneName) {
  const scenes = document.querySelectorAll(".scene");
  scenes.forEach((scene) => {
    const isActive = scene.id === sceneName;
    scene.classList.toggle("active", isActive);
  });

  if (sceneName === "final-transmission") {
    startSelfDestructCountdown();
  } else {
    stopSelfDestructCountdown();
  }

  state.currentScene = sceneName;
  saveState();
}

function handleNoButton(event) {
  if (state.noTapCount >= 5) {
    return;
  }

  event.preventDefault();
  state.noTapCount += 1;
  updateDecisionMessage();
  growYesButton();
  moveNoButton();
  playTone("alert");
  vibrate(18);

  if (state.noTapCount === 5) {
    triggerNoCapture();
  }
}

function updateDecisionMessage() {
  const messageElement = elements.decisionMessage;
  messageElement.textContent = noMessages[state.noTapCount - 1] || "Are you sure about that? 👀";
  messageElement.classList.add("visible");
}

function moveNoButton() {
  const panel = elements.decisionPanel;
  const noButton = elements.noButton;

  if (state.noTapCount === 0) {
    noButton.style.left = "50%";
    noButton.style.top = "68%";
    noButton.style.transform = "translateX(-50%)";
    noButton.classList.remove("behind");
    noButton.style.opacity = "1";
    noButton.style.zIndex = "4";
    return;
  }

  if (state.noTapCount >= 5) {
    const yesRect = elements.yesButton.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const x = yesRect.left - panelRect.left + 18;
    const y = yesRect.top - panelRect.top + 12;

    noButton.style.left = `${x}px`;
    noButton.style.top = `${y}px`;
    noButton.classList.add("behind");
    noButton.style.transform = "translate(0, 0) scale(0.78)";
    noButton.style.opacity = "0.18";
    return;
  }

  const maxX = Math.max(24, panel.clientWidth - noButton.offsetWidth - 18);
  const minX = 10;
  const minY = 60;
  const maxY = Math.max(115, panel.clientHeight - noButton.offsetHeight - 14);

  const randomX = Math.random() * (maxX - minX) + minX;
  const randomY = Math.random() * (maxY - minY) + minY;

  noButton.style.left = `${randomX}px`;
  noButton.style.top = `${randomY}px`;
  noButton.style.transform = "translate(0, 0)";
  noButton.classList.remove("behind");
  noButton.style.opacity = "1";
  noButton.style.zIndex = "4";
}

function growYesButton() {
  const selectedScale = noScaleMap[Math.min(state.noTapCount, noScaleMap.length - 1)];
  elements.yesButton.style.setProperty("--yes-scale", selectedScale.toFixed(2));
  elements.yesButton.style.transform = `translate(-50%, -50%) scale(${selectedScale})`;
}

function triggerNoCapture() {
  elements.decisionMessage.textContent = "DECLINE BUTTON: COMPROMISED";
  elements.decisionMessage.classList.add("visible");
  elements.noButton.classList.add("behind");
  elements.noButton.style.zIndex = "1";
  elements.noButton.setAttribute("aria-hidden", "true");
  elements.yesButton.setAttribute("aria-pressed", "true");
  elements.decisionPanel.classList.add("no-trapped");
  saveState();
}

function acceptMission() {
  state.missionAccepted = true;
  state.unlockedFiles = ["mission-file-01", "mission-file-02", "mission-file-03", "mission-file-04", "classified-surprise"];
  saveState();
  document.body.classList.add("mission-active");
  playTone("accept");
  vibrate(50);

  showScene("mission-accepted");
}

function unlockFile(fileId) {
  if (!state.unlockedFiles.includes(fileId)) {
    state.unlockedFiles.push(fileId);
  }
  saveState();
}

function playTone(type) {
  if (!state.soundEnabled) {
    return;
  }

  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return;
    }
    audioContext = new AudioCtor();
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  if (type === "boot") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(260, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  } else if (type === "alert") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else if (type === "accept") {
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(380, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  } else {
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  }

  oscillator.start(now);
  oscillator.stop(now + 0.45);
}

function vibrate(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function setSoundToggleLabel() {
  elements.soundToggle.textContent = state.soundEnabled ? "🔊 SOUND: ON" : "🔇 SOUND: OFF";
}

function saveState() {
  const payload = {
    missionAccepted: state.missionAccepted,
    noTapCount: state.noTapCount,
    currentScene: state.currentScene,
    unlockedFiles: state.unlockedFiles,
    soundEnabled: state.soundEnabled,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    state.missionAccepted = Boolean(saved.missionAccepted);
    state.noTapCount = Number(saved.noTapCount || 0);
    state.currentScene = saved.currentScene || state.currentScene;
    state.unlockedFiles = Array.isArray(saved.unlockedFiles) ? saved.unlockedFiles : [];
    state.soundEnabled = saved.soundEnabled !== false;
  } catch (error) {
    console.warn("Mission state could not be restored.", error);
  }
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state.missionAccepted = false;
  state.noTapCount = 0;
  state.currentScene = "secure-connection";
  state.unlockedFiles = [];
  state.soundEnabled = true;
  setSoundToggleLabel();
  elements.enterButton.classList.add("hidden");
  elements.decisionMessage.classList.remove("visible");
  elements.noButton.classList.remove("behind");
  elements.noButton.style.opacity = "1";
  elements.noButton.style.zIndex = "4";
  elements.noButton.style.left = "50%";
  elements.noButton.style.top = "68%";
  elements.yesButton.style.left = "50%";
  elements.yesButton.style.transform = "translateX(-50%) scale(1)";
  elements.yesButton.style.setProperty("--yes-scale", "1");
  elements.decisionPanel.classList.remove("no-trapped");
  state.currentScene = "briefing";
  showScene("briefing");
  saveState();
}

function applyYesScale() {
  const scale = noScaleMap[Math.min(state.noTapCount, noScaleMap.length - 1)] || 1;
  elements.yesButton.style.setProperty("--yes-scale", scale.toFixed(2));
  elements.yesButton.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function startSelfDestructCountdown() {
  const countdownEl = elements.countdown;
  const errorTextEl = elements.errorText;
  const selfDestructMessageEl = elements.selfDestructMessage;

  if (!countdownEl || !errorTextEl || !selfDestructMessageEl) return;

  stopSelfDestructCountdown();
  selfDestructMessageEl.classList.add("hidden");

  const values = [3, 2, 1];
  let index = 0;

  const updateCountdown = () => {
    if (index < values.length) {
      countdownEl.innerHTML = `<span>${values[index]}</span>`;
      errorTextEl.classList.add("hidden");
      selfDestructMessageEl.classList.add("hidden");
      playTone("alert");
      vibrate(25);
      index += 1;
      window.selfDestructTimer = window.setTimeout(updateCountdown, 700);
      return;
    }

    countdownEl.innerHTML = "";
    errorTextEl.textContent = "ERROR";
    errorTextEl.classList.remove("hidden");
    selfDestructMessageEl.classList.remove("hidden");
    selfDestructMessageEl.style.opacity = "1";
    selfDestructMessageEl.style.visibility = "visible";
  };

  updateCountdown();
}

function stopSelfDestructCountdown() {
  if (window.selfDestructTimer) {
    window.clearTimeout(window.selfDestructTimer);
    window.selfDestructTimer = null;
  }
}

document.addEventListener("DOMContentLoaded", init);
