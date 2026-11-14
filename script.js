// Saved Settings
let sensitivity = parseFloat(localStorage.getItem("sensitivity")) || 1.5;
let talkThreshold = parseInt(localStorage.getItem("talkThreshold"), 10) || 15;
let loudThreshold = parseInt(localStorage.getItem("loudThreshold"), 10) || 50;
let sleepDelaySec = parseInt(localStorage.getItem("sleepDelaySec"), 10) || 15;
let selectedDeviceId = localStorage.getItem("selectedDeviceId") || "";

const STATES = ["idle", "blink", "sleep", "talk", "loud"];
const customImages = {};
STATES.forEach((s) => {
  customImages[s] = localStorage.getItem(`sprite_${s}`) || null;
});

// Audio & Animation State
let audioCtx = null;
let currentStream = null;
let animationFrameId = null;

let isBlinking = false;
let lastSpokeTime = Date.now();
let currentVisualState = "idle";

// DOM Elements
const volumeBar = document.getElementById("volume-level");
const spriteStage = document.getElementById("sprite-stage");
const sleepZzz = document.getElementById("sleep-zzz");
const settingsPanel = document.getElementById("settings-panel");
const micSelect = document.getElementById("mic-select");
const pupilsGroup = document.querySelector("#sprite-idle .pupils");

// UI Panel Toggles
document.getElementById("toggle-settings").addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

document.getElementById("close-app").addEventListener("click", () => {
  window.close();
});

// Initialize Sliders & Labels
const sensitivityInput = document.getElementById("sensitivity");
const talkThreshInput = document.getElementById("talk-thresh");
const loudThreshInput = document.getElementById("loud-thresh");
const sleepDelayInput = document.getElementById("sleep-delay");

sensitivityInput.value = sensitivity;
talkThreshInput.value = talkThreshold;
loudThreshInput.value = loudThreshold;
sleepDelayInput.value = sleepDelaySec;

document.getElementById("val-sensitivity").textContent = sensitivity;
document.getElementById("val-talk").textContent = talkThreshold;
document.getElementById("val-loud").textContent = loudThreshold;
document.getElementById("val-sleep").textContent = sleepDelaySec;

// Restore Custom Images
STATES.forEach((state) => {
  if (customImages[state]) {
    document.getElementById(`img-${state}`).src = customImages[state];
  }
});

// Slider Event Listeners
sensitivityInput.addEventListener("input", (e) => {
  sensitivity = parseFloat(e.target.value);
  document.getElementById("val-sensitivity").textContent = sensitivity;
  localStorage.setItem("sensitivity", sensitivity);
});

talkThreshInput.addEventListener("input", (e) => {
  talkThreshold = parseInt(e.target.value, 10);
  document.getElementById("val-talk").textContent = talkThreshold;
  localStorage.setItem("talkThreshold", talkThreshold);
});

loudThreshInput.addEventListener("input", (e) => {
  loudThreshold = parseInt(e.target.value, 10);
  document.getElementById("val-loud").textContent = loudThreshold;
  localStorage.setItem("loudThreshold", loudThreshold);
});

sleepDelayInput.addEventListener("input", (e) => {
  sleepDelaySec = parseInt(e.target.value, 10);
  document.getElementById("val-sleep").textContent = sleepDelaySec;
  localStorage.setItem("sleepDelaySec", sleepDelaySec);
});

// Custom Image Uploads
STATES.forEach((state) => {
  const input = document.getElementById(`upload-${state}`);
  if (!input) return;
  input.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      customImages[state] = reader.result;
      document.getElementById(`img-${state}`).src = reader.result;
      localStorage.setItem(`sprite_${state}`, reader.result);
      setActiveSprite(currentVisualState);
    };
    reader.readAsDataURL(file);
  });
});

// Reset Custom Sprites
document.getElementById("reset-sprites").addEventListener("click", () => {
  STATES.forEach((s) => {
    customImages[s] = null;
    localStorage.removeItem(`sprite_${s}`);
    document.getElementById(`img-${s}`).removeAttribute("src");
  });
  setActiveSprite(currentVisualState);
});

// Populate Microphone Dropdown
async function loadMicrophones() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((d) => d.kind === "audioinput");

  micSelect.innerHTML = "";
  audioInputs.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Microphone ${index + 1}`;
    if (device.deviceId === selectedDeviceId) {
      option.selected = true;
    }
    micSelect.appendChild(option);
  });
}

micSelect.addEventListener("change", (e) => {
  selectedDeviceId = e.target.value;
  localStorage.setItem("selectedDeviceId", selectedDeviceId);
  startAudio(selectedDeviceId);
});

// Start / Switch Microphone Stream
async function startAudio(deviceId = "") {
  try {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }
    if (audioCtx) {
      await audioCtx.close();
    }

    const constraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    await loadMicrophones();

    audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;

    const microphone = audioCtx.createMediaStreamSource(currentStream);
    microphone.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function processAudio() {
      analyser.getByteTimeDomainData(dataArray);

      let sumSquare = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquare += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquare / bufferLength);
      const volumePercent = Math.min(100, Math.round(rms * 100 * sensitivity));

      volumeBar.style.width = `${volumePercent}%`;

      const now = Date.now();

      if (volumePercent >= loudThreshold) {
        lastSpokeTime = now;
        exitSleepMode();
        spriteStage.style.transform = `scale(${1 + volumePercent / 350})`;
        setActiveSprite("loud");
      } else if (volumePercent >= talkThreshold) {
        lastSpokeTime = now;
        exitSleepMode();
        spriteStage.style.transform = `scale(${1 + volumePercent / 400})`;
        setActiveSprite("talk");
      } else {
        // Check if idle long enough to fall asleep
        const idleSeconds = (now - lastSpokeTime) / 1000;
        if (idleSeconds >= sleepDelaySec) {
          enterSleepMode();
          setActiveSprite("sleep");
        } else {
          exitSleepMode();
          spriteStage.style.transform = "scale(1)";
          setActiveSprite(isBlinking ? "blink" : "idle");
        }
      }

      animationFrameId = requestAnimationFrame(processAudio);
    }

    processAudio();
  } catch (err) {
    console.error("Audio error:", err);
  }
}

function enterSleepMode() {
  spriteStage.style.transform = ""; // Let CSS breathing animation take over
  spriteStage.classList.add("sleeping");
  sleepZzz.classList.remove("hidden");
}

function exitSleepMode() {
  spriteStage.classList.remove("sleeping");
  sleepZzz.classList.add("hidden");
}

// Periodic Blink Timer (every 2.5 to 5.5 seconds while awake & idle)
function scheduleBlink() {
  const nextBlinkMs = 2500 + Math.random() * 3000;
  setTimeout(() => {
    if (currentVisualState === "idle") {
      isBlinking = true;
      setActiveSprite("blink");
      setTimeout(() => {
        isBlinking = false;
        if (currentVisualState === "blink") {
          setActiveSprite("idle");
        }
      }, 140);
    }
    scheduleBlink();
  }, nextBlinkMs);
}

// Periodic Eye-Roll / Glance Timer (for default SVG idle pupils)
function scheduleEyeMovement() {
  const nextMoveMs = 2000 + Math.random() * 3500;
  setTimeout(() => {
    if (pupilsGroup && currentVisualState === "idle") {
      // Pick a random direction: left, right, up-roll, or back to center
      const movements = [
        "translate(0px, 0px)",
        "translate(-4px, -1px)",
        "translate(4px, -1px)",
        "translate(0px, -4px)", // Eye roll up
        "translate(-3px, -3px)",
        "translate(3px, -3px)"
      ];
      const randomMove = movements[Math.floor(Math.random() * movements.length)];
      pupilsGroup.style.transform = randomMove;

      // Return pupils to center after a moment
      setTimeout(() => {
        if (pupilsGroup) pupilsGroup.style.transform = "translate(0px, 0px)";
      }, 900);
    }
    scheduleEyeMovement();
  }, nextMoveMs);
}

// Render Active Sprite (Custom PNGs override default SVGs)
function setActiveSprite(state) {
  currentVisualState = state;

  // Fallback to idle if blinking without a custom blink image while using a custom idle image
  let effectiveState = state;
  if (state === "blink" && customImages.idle && !customImages.blink) {
    effectiveState = "idle";
  }

  STATES.forEach((s) => {
    const svgEl = document.getElementById(`sprite-${s}`);
    const imgEl = document.getElementById(`img-${s}`);

    if (s === effectiveState) {
      if (customImages[s]) {
        imgEl.classList.add("active");
        svgEl.classList.remove("active");
      } else {
        svgEl.classList.add("active");
        imgEl.classList.remove("active");
      }
    } else {
      svgEl.classList.remove("active");
      imgEl.classList.remove("active");
    }
  });
}

// Boot Up
window.addEventListener("DOMContentLoaded", () => {
  startAudio(selectedDeviceId);
  scheduleBlink();
  scheduleEyeMovement();
});