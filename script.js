const STORAGE_KEY = "agent-prism-mission-state";
const MISSION_ID_KEY = "agent-prism-mission-id";
const API_BASE = window.MISSION_API_BASE || "";
const state = {
  missionId: "",
  missionStartedAt: "",
  missionAccepted: false,
  noTapCount: 0,
  currentScene: "secure-connection",
  unlockedFiles: [],
  completedFiles: [],
  classifiedFileOpened: false,
  finalTransmissionReached: false,
  missionCompleted: false,
  reportGenerated: false,
  reportShared: false,
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
const missionFileIds = [
  "mission-file-01",
  "mission-file-02",
  "mission-file-03",
  "mission-file-04",
  "classified-surprise"
];

let audioContext = null;
let terminalSequenceTimer = null;
let syncTimer = null;

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
  reportSummary: document.getElementById("reportSummary"),
  shareReportButton: document.getElementById("shareReportButton"),
  copyReportButton: document.getElementById("copyReportButton"),
  reportFeedback: document.getElementById("reportFeedback"),
};

async function init() {
  state.missionId = getMissionId();
  state.missionStartedAt = new Date().toISOString();
  bindEvents();
  setSoundToggleLabel();

  const params = new URLSearchParams(window.location.search);
  const shouldReset = params.get("reset") === "true" || params.get("reset") === "1" || window.location.hash === "#reset";

  if (shouldReset) {
    resetState();
    return;
  }

  loadState();
  await syncFromBackend();
  trackEvent("MISSION_STARTED");
  applyYesScale();
  moveNoButton();

  if (state.missionAccepted) {
    const restoredScene = sceneOrder.includes(state.currentScene) ? state.currentScene : "mission-accepted";
    showScene(restoredScene);
    saveState();
    return;
  }

  showScene("secure-connection");
  startSecureConnection();
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
        const currentScene = button.closest(".scene")?.id;
        if (currentScene && currentScene.startsWith("mission-file-")) {
          completeFile(currentScene);
        }
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

  elements.shareReportButton.addEventListener("click", shareMissionReport);
  elements.copyReportButton.addEventListener("click", copyMissionReport);

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
    state.finalTransmissionReached = true;
    state.missionCompleted = true;
    state.reportGenerated = true;
    trackEvent("FINAL_TRANSMISSION_REACHED");
    renderMissionReport();
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
  trackEvent("NO_TAPPED");
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
  trackEvent("MISSION_ACCEPTED");
  saveState();
  document.body.classList.add("mission-active");
  playTone("accept");
  vibrate(50);

  showScene("mission-accepted");
}

function unlockFile(fileId) {
  if (!missionFileIds.includes(fileId)) {
    return;
  }

  if (!state.unlockedFiles.includes(fileId)) {
    state.unlockedFiles.push(fileId);
  }
  if (!state.completedFiles.includes(fileId)) {
    state.completedFiles.push(fileId);
  }
  if (fileId === "classified-surprise") {
    state.classifiedFileOpened = true;
    trackEvent("CLASSIFIED_FILE_OPENED");
  }
  trackEvent("FILE_OPENED");
  saveState();
}

function completeFile(fileId) {
  if (!missionFileIds.includes(fileId)) {
    return;
  }

  if (!state.completedFiles.includes(fileId)) {
    state.completedFiles.push(fileId);
  }
  trackEvent("FILE_COMPLETED");
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

function getMissionId() {
  const existingId = localStorage.getItem(MISSION_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const randomBytes = new Uint8Array(4);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const missionId = `AP-${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  localStorage.setItem(MISSION_ID_KEY, missionId);
  return missionId;
}

function getMissionPayload() {
  return {
    missionId: state.missionId,
    missionStartedAt: state.missionStartedAt,
    missionAccepted: state.missionAccepted,
    noTapCount: state.noTapCount,
    currentScene: state.currentScene,
    filesOpened: state.unlockedFiles.filter((fileId) => missionFileIds.includes(fileId)),
    filesCompleted: state.completedFiles.filter((fileId) => missionFileIds.includes(fileId)),
    classifiedFileOpened: state.classifiedFileOpened,
    finalTransmissionReached: state.finalTransmissionReached,
    completed: state.missionCompleted,
    reportGenerated: state.reportGenerated,
    reportShared: state.reportShared,
    updatedAt: new Date().toISOString(),
  };
}

function syncMissionState(eventType = "STATE_UPDATED") {
  if (!API_BASE || !state.missionId) {
    return;
  }

  const payload = { ...getMissionPayload(), eventType };
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    fetch(`${API_BASE}/api/missions/${encodeURIComponent(state.missionId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Local state remains authoritative until the next background retry.
    });
  }, 120);
}

function trackEvent(eventType) {
  saveState();
  syncMissionState(eventType);
}

async function syncFromBackend() {
  if (!API_BASE || !state.missionId) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/missions/${encodeURIComponent(state.missionId)}`);
    if (!response.ok) {
      return;
    }

    const remoteState = await response.json();
    state.missionStartedAt = remoteState.missionStartedAt || state.missionStartedAt;
    state.missionAccepted = Boolean(remoteState.missionAccepted || state.missionAccepted);
    state.noTapCount = Math.max(Number(remoteState.noTapCount || 0), state.noTapCount);
    state.unlockedFiles = uniqueValues([...(remoteState.filesOpened || []), ...state.unlockedFiles])
      .filter((fileId) => missionFileIds.includes(fileId));
    state.completedFiles = uniqueValues([...(remoteState.filesCompleted || []), ...state.completedFiles])
      .filter((fileId) => missionFileIds.includes(fileId));
    state.classifiedFileOpened = Boolean(remoteState.classifiedFileOpened || state.classifiedFileOpened);
    state.finalTransmissionReached = Boolean(remoteState.finalTransmissionReached || state.finalTransmissionReached);
    state.missionCompleted = Boolean(remoteState.completed || state.missionCompleted);
    state.reportGenerated = Boolean(remoteState.reportGenerated || state.reportGenerated);
    state.reportShared = Boolean(remoteState.reportShared || state.reportShared);
    if (remoteState.currentScene && sceneOrder.includes(remoteState.currentScene)) {
      state.currentScene = remoteState.currentScene;
    }
    saveState();
    applyYesScale();
    moveNoButton();
    if (state.reportGenerated) {
      renderMissionReport();
    }
  } catch (error) {
    // The mission continues offline and will sync on the next event.
  }
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function buildMissionReport() {
  const filesOpened = state.unlockedFiles.filter((fileId) => missionFileIds.includes(fileId)).length;
  return [
    "🔒 CLASSIFIED MISSION REPORT",
    "",
    "AGENT: PRISM",
    `MISSION ID: ${state.missionId}`,
    "",
    `STATUS: ${state.missionAccepted ? "MISSION ACCEPTED" : "PENDING ACCEPTANCE"}`,
    "",
    `DECLINE ATTEMPTS: ${state.noTapCount}`,
    "",
    `FILES UNLOCKED: ${filesOpened}/5`,
    "",
    `CLASSIFIED FILE: ${state.classifiedFileOpened ? "ACCESSED ✓" : "NOT ACCESSED"}`,
    "",
    `FINAL TRANSMISSION: ${state.finalTransmissionReached ? "REACHED ✓" : "NOT REACHED"}`,
    "",
    `MISSION STATUS: ${state.missionCompleted ? "ACTIVE ❤️" : "IN PROGRESS"}`,
    "",
    "— Agent Prism",
  ].join("\n");
}

function renderMissionReport() {
  if (!elements.reportSummary) {
    return;
  }

  elements.reportSummary.innerHTML = `
    <div><span>MISSION ID</span><strong>${escapeHtml(state.missionId)}</strong></div>
    <div><span>STATUS</span><strong>${state.missionAccepted ? "MISSION ACCEPTED ✓" : "PENDING"}</strong></div>
    <div><span>DECLINE ATTEMPTS</span><strong>${state.noTapCount}</strong></div>
    <div><span>FILES UNLOCKED</span><strong>${state.unlockedFiles.filter((fileId) => missionFileIds.includes(fileId)).length} / 5</strong></div>
    <div><span>CLASSIFIED FILE</span><strong>${state.classifiedFileOpened ? "ACCESSED ✓" : "LOCKED"}</strong></div>
    <div><span>FINAL TRANSMISSION</span><strong>${state.finalTransmissionReached ? "REACHED ✓" : "PENDING"}</strong></div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

async function shareMissionReport() {
  const reportText = buildMissionReport();
  state.reportGenerated = true;
  saveState();

  if (!navigator.share) {
    await copyMissionReport();
    return;
  }

  try {
    await navigator.share({
      title: "Agent Prism - Mission Report",
      text: reportText,
    });
    state.reportShared = true;
    saveState();
    trackEvent("REPORT_SHARED");
    showReportFeedback("REPORT TRANSMITTED ✓");
  } catch (error) {
    if (error.name !== "AbortError") {
      showReportFeedback("TRANSMISSION READY");
    }
  }
}

async function copyMissionReport() {
  const reportText = buildMissionReport();
  state.reportGenerated = true;

  try {
    await navigator.clipboard.writeText(reportText);
  } catch (error) {
    const textArea = document.createElement("textarea");
    textArea.value = reportText;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }

  saveState();
  trackEvent("REPORT_GENERATED");
  showReportFeedback("MISSION REPORT COPIED");
}

function showReportFeedback(message) {
  if (elements.reportFeedback) {
    elements.reportFeedback.textContent = message;
  }
}

function saveState() {
  const payload = {
    missionId: state.missionId,
    missionStartedAt: state.missionStartedAt,
    missionAccepted: state.missionAccepted,
    noTapCount: state.noTapCount,
    currentScene: state.currentScene,
    unlockedFiles: state.unlockedFiles,
    completedFiles: state.completedFiles,
    classifiedFileOpened: state.classifiedFileOpened,
    finalTransmissionReached: state.finalTransmissionReached,
    missionCompleted: state.missionCompleted,
    reportGenerated: state.reportGenerated,
    reportShared: state.reportShared,
    soundEnabled: state.soundEnabled,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  syncMissionState();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    state.missionId = saved.missionId || state.missionId;
    state.missionStartedAt = saved.missionStartedAt || state.missionStartedAt;
    state.missionAccepted = Boolean(saved.missionAccepted);
    state.noTapCount = Number(saved.noTapCount || 0);
    state.currentScene = saved.currentScene || state.currentScene;
    state.unlockedFiles = Array.isArray(saved.unlockedFiles) ? saved.unlockedFiles : [];
    state.completedFiles = Array.isArray(saved.completedFiles) ? saved.completedFiles : [];
    state.classifiedFileOpened = Boolean(saved.classifiedFileOpened);
    state.finalTransmissionReached = Boolean(saved.finalTransmissionReached);
    state.missionCompleted = Boolean(saved.missionCompleted);
    state.reportGenerated = Boolean(saved.reportGenerated);
    state.reportShared = Boolean(saved.reportShared);
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
  state.completedFiles = [];
  state.classifiedFileOpened = false;
  state.finalTransmissionReached = false;
  state.missionCompleted = false;
  state.reportGenerated = false;
  state.reportShared = false;
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
  state.currentScene = "secure-connection";
  showScene("secure-connection");
  startSecureConnection();
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
