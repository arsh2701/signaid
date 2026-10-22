/**
 * SignAid AI - MediaPipe Hand Gesture Recognition Engine
 * Powered by @mediapipe/tasks-vision GestureRecognizer (Pinned v0.10.14)
 * Runs real-time in VIDEO mode with GPU acceleration and CPU fallback.
 * Maps basic hand gestures to classroom responses and hand-raising alerts.
 */

const SignVision = {
  recognizer: null,
  videoStream: null,
  isCameraActive: false,
  isModelLoaded: false,
  animId: null,
  lastVideoTime: -1,
  
  // Stability & Cooldown tracking
  currentCandidateGesture: null,
  candidateStartTime: 0,
  stabilityThresholdMs: 700, // must hold for 700ms to accept gesture
  handRaiseHoldThresholdMs: 1000, // hold Pointing_Up or Open_Palm for 1s to raise hand
  lastAcceptedGestureTime: 0,
  gestureCooldownMs: 1600,
  handRaiseTriggeredForCurrentHold: false,

  // Gesture dictionary
  gestureMap: {
    "Open_Palm": "Hello",
    "Thumb_Up": "Yes / Understood",
    "Thumb_Down": "No / Not clear",
    "Closed_Fist": "Stop / Wait",
    "Pointing_Up": "I have a question",
    "Victory": "Okay / Peace",
    "ILoveYou": "Thank you"
  },

  // Hand Landmark Skeletal Connections (21 Mediapipe Points)
  HAND_CONNECTIONS: [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [9, 13], [13, 14], [14, 15], [15, 16],// Ring
    [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [0, 17]                               // Palm base
  ],

  init() {
    this.bindDOM();
  },

  updateStatus(text, type = "normal") {
    const statusText = document.getElementById('signDetectionStatus');
    if (!statusText) return;
    statusText.textContent = text;
    statusText.className = `sign-status-text ${type}`;
  },

  showGestureResult(phrase, gestureKey, confidence = 0) {
    const displayBox = document.getElementById('detectedGestureDisplayBox');
    const labelSpan = document.getElementById('detectedGestureLabel');
    const confSpan = document.getElementById('detectedGestureConfidence');

    if (displayBox && labelSpan) {
      labelSpan.textContent = `"${phrase}"`;
      if (confSpan) confSpan.textContent = confidence > 0 ? `(${Math.round(confidence * 100)}% match)` : '';
      displayBox.classList.add('flash-detect');
      setTimeout(() => displayBox.classList.remove('flash-detect'), 600);
    }
  },

  async loadMediaPipeModel() {
    if (this.isModelLoaded && this.recognizer) return this.recognizer;

    this.updateStatus("Loading MediaPipe Vision model...", "loading");

    if (!navigator.onLine) {
      this.updateStatus("Error: No internet connection. MediaPipe model requires online access on first load.", "error");
      throw new Error("Offline");
    }

    try {
      // Dynamic import of pinned tasks-vision bundle
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        (window.CONFIG && window.CONFIG.MEDIAPIPE_WASM_PATH) || "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      const modelUrl = (window.CONFIG && window.CONFIG.MEDIAPIPE_MODEL_URL) ||
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

      // Attempt with GPU delegate first
      try {
        this.recognizer = await vision.GestureRecognizer.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
      } catch (gpuErr) {
        console.warn("GPU delegate failed for GestureRecognizer, falling back to CPU:", gpuErr);
        this.recognizer = await vision.GestureRecognizer.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
      }

      this.isModelLoaded = true;
      this.updateStatus("Model ready. Launch camera to detect gestures.", "ready");
      return this.recognizer;
    } catch (err) {
      console.error("Failed to load MediaPipe GestureRecognizer:", err);
      this.updateStatus("Failed to load gesture model. Check network or reload.", "error");
      throw err;
    }
  },

  async toggleCamera() {
    if (this.isCameraActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  },

  async startCamera() {
    const video = document.getElementById('signVideoElement');
    const canvas = document.getElementById('signCanvasOverlay');
    const btn = document.getElementById('toggleSignCameraBtn');

    if (!video || !canvas) return;

    try {
      await this.loadMediaPipeModel();
    } catch (e) {
      return; // Error already set in updateStatus
    }

    this.updateStatus("Requesting camera access...", "loading");

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });

      video.srcObject = this.videoStream;

      // Wait for video metadata & playback start
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(resolve);
        };
      });

      // Match canvas dimensions exactly to video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      this.isCameraActive = true;
      if (btn) {
        btn.textContent = "🛑 Stop Gesture Camera";
        btn.classList.add('btn-danger');
      }
      this.updateStatus("Camera ready. Show your hand.", "ready");

      this.runDetectionLoop(video, canvas);
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.updateStatus("Camera permission denied. Allow access in browser settings.", "error");
      } else {
        this.updateStatus("Camera unavailable or blocked: " + err.message, "error");
      }
    }
  },

  stopCamera() {
    this.isCameraActive = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }

    const video = document.getElementById('signVideoElement');
    if (video) video.srcObject = null;

    const canvas = document.getElementById('signCanvasOverlay');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const btn = document.getElementById('toggleSignCameraBtn');
    if (btn) {
      btn.textContent = "📷 Start Gesture Camera";
      btn.classList.remove('btn-danger');
    }

    this.updateStatus("Camera off", "normal");
  },

  runDetectionLoop(video, canvas) {
    const ctx = canvas.getContext('2d');

    const detect = () => {
      if (!this.isCameraActive || !this.recognizer) return;

      if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = video.currentTime;
        
        try {
          // MediaPipe recognizes video frame with timestamp
          const results = this.recognizer.recognizeForVideo(video, Date.now());

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (results && results.landmarks && results.landmarks.length > 0) {
            this.updateStatus("Hand detected", "detected");

            // Draw hand landmarks for each detected hand
            results.landmarks.forEach(landmarks => {
              this.drawHandLandmarks(ctx, landmarks, canvas.width, canvas.height);
            });

            // Process detected gesture categories
            if (results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
              const topGesture = results.gestures[0][0];
              this.processGesture(topGesture.categoryName, topGesture.score);
            } else {
              this.resetCandidate();
            }
          } else {
            this.updateStatus("No hand in frame", "normal");
            this.resetCandidate();
          }
        } catch (e) {
          console.warn("Detection frame exception:", e);
        }
      }

      this.animId = requestAnimationFrame(detect);
    };

    detect();
  },

  drawHandLandmarks(ctx, landmarks, width, height) {
    // Note: Video is mirrored with CSS scaleX(-1).
    // We compute coordinates: X is mirrored so drawn bones match the video hand.
    const pts = landmarks.map(pt => ({
      x: (1 - pt.x) * width,
      y: pt.y * height
    }));

    // Draw Skeletal Bones
    ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    this.HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = pts[startIdx];
      const p2 = pts[endIdx];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // Draw Joint Nodes
    pts.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx % 4 === 0 ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = idx === 0 ? "#f43f5e" : (idx % 4 === 0 ? "#10b981" : "#38bdf8");
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  },

  processGesture(categoryName, score) {
    const now = Date.now();

    // Check if category matches our recognized vocabulary
    if (!this.gestureMap[categoryName] || score < 0.6) {
      this.resetCandidate();
      return;
    }

    if (this.currentCandidateGesture !== categoryName) {
      this.currentCandidateGesture = categoryName;
      this.candidateStartTime = now;
      this.handRaiseTriggeredForCurrentHold = false;
      return;
    }

    const elapsed = now - this.candidateStartTime;

    // Special Feature: 1-second hold of Pointing_Up or Open_Palm raises hand!
    if (
      (categoryName === "Pointing_Up" || categoryName === "Open_Palm") &&
      elapsed >= this.handRaiseHoldThresholdMs &&
      !this.handRaiseTriggeredForCurrentHold
    ) {
      this.handRaiseTriggeredForCurrentHold = true;
      if (window.SyncManager) {
        window.SyncManager.raiseHand();
      }
    }

    // Gesture stability verification (must hold steady for 700ms)
    if (elapsed >= this.stabilityThresholdMs && (now - this.lastAcceptedGestureTime > this.gestureCooldownMs)) {
      this.lastAcceptedGestureTime = now;
      const phrase = this.gestureMap[categoryName];

      // Update UI Display
      this.showGestureResult(phrase, categoryName, score);

      // Append to live captions stream
      if (window.CaptionsEngine) {
        window.CaptionsEngine.handleFinalTranscript(`[Sign] ${phrase}`);
      }
    }
  },

  resetCandidate() {
    this.currentCandidateGesture = null;
    this.candidateStartTime = 0;
    this.handRaiseTriggeredForCurrentHold = false;
  },

  bindDOM() {
    const toggleCamBtn = document.getElementById('toggleSignCameraBtn');
    if (toggleCamBtn) {
      toggleCamBtn.addEventListener('click', () => this.toggleCamera());
    }

    // Quick gesture testing buttons for judge demonstration
    const chips = document.querySelectorAll('.test-gesture-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const gestureKey = chip.getAttribute('data-gesture');
        const phrase = this.gestureMap[gestureKey] || chip.textContent.trim();
        this.showGestureResult(phrase, gestureKey, 0.95);
        if (window.CaptionsEngine) {
          window.CaptionsEngine.handleFinalTranscript(`[Sign] ${phrase}`);
        }
        if (gestureKey === "Pointing_Up" && window.SyncManager) {
          window.SyncManager.raiseHand();
        }
      });
    });
  }
};

window.SignVision = SignVision;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SignVision.init());
} else {
  SignVision.init();
}
