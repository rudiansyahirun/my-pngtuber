let sensitivity = parseFloat(localStorage.getItem("sensitivity")) || 1.5;
let talkThreshold = parseInt(localStorage.getItem("talkThreshold"), 10) || 15;
let loudThreshold = parseInt(localStorage.getItem("loudThreshold"), 10) || 50;

const customImages = {
  idle: localStorage.getItem("sprite_idle") || null,
  talk: localStorage.getItem("sprite_talk") || null,
  loud: localStorage.getItem("sprite_loud") || null
};

const volumeBar = document.getElementById("volume-level");
const spriteStage = document.getElementById("sprite-stage");
const settingsPanel = document.getElementById("settings-panel");

// UI Toggles
document.getElementById("toggle-settings").addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

document.getElementById("close-app").addEventListener("click", () => {
  window.close();
});

// Initialize Saved Settings
const sensitivityInput = document.getElementById("sensitivity");
const talkThreshInput = document.getElementById("talk-thresh");
const loudThreshInput = document.getElementById("loud-thresh");

sensitivityInput.value = sensitivity;
talkThreshInput.value = talkThreshold;
loudThreshInput.value = loudThreshold;
document.getElementById("val-sensitivity").textContent = sensitivity;
document.getElementById("val-talk").textContent = talkThreshold;
document.getElementById("val-loud").textContent = loudThreshold;

// Restore Saved Custom Sprites
["idle", "talk", "loud"].forEach((state) => {
  if (customImages[state]) {
    document.getElementById(`img-${state}`).src = customImages[state];
  }
});
setActiveSprite("idle");

// Slider Listeners with Persistence
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

// Convert uploaded images to Base64 so they persist across restarts
function setupImageUpload(inputId, stateKey) {
  document.getElementById(inputId).addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      customImages[stateKey] = base64Data;
      document.getElementById(`img-${stateKey}`).src = base64Data;
      localStorage.setItem(`sprite_${stateKey}`, base64Data);
      setActiveSprite("idle");
    };
    reader.readAsDataURL(file);
  });
}

setupImageUpload("upload-idle", "idle");
setupImageUpload("upload-talk", "talk");
setupImageUpload("upload-loud", "loud");

// Auto-start Microphone on App Launch
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;

    const microphone = audioCtx.createMediaStreamSource(stream);
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
      spriteStage.style.transform = `scale(${1 + volumePercent / 400})`;

      if (volumePercent >= loudThreshold) {
        setActiveSprite("loud");
      } else if (volumePercent >= talkThreshold) {
        setActiveSprite("talk");
      } else {
        setActiveSprite("idle");
      }

      requestAnimationFrame(processAudio);
    }

    processAudio();
  } catch (err) {
    console.error("Mic initialization failed:", err);
  }
}

function setActiveSprite(state) {
  ["idle", "talk", "loud"].forEach((s) => {
    const svgEl = document.getElementById(`sprite-${s}`);
    const imgEl = document.getElementById(`img-${s}`);

    if (s === state) {
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

window.addEventListener("DOMContentLoaded", initAudio);