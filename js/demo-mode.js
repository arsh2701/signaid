/**
 * SignAid AI - Realistic Classroom Demo Mode
 * Simulates real-time classroom speech streaming word-by-word with interim typing,
 * keyword activations, sound spikes, and WPM meter updates.
 * Guarantees a flawless hackathon demo even without a microphone or internet!
 */

const DemoMode = {
  isPlaying: false,
  currentIndex: 0,
  currentLectureId: 'cs',
  timeoutId: null,
  interimTimer: null,
  speedMultiplier: 1.0,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const demoBtn = document.getElementById('toggleDemoModeBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => this.toggleDemo());
    }

    const lectureSelect = document.getElementById('demoLectureSelect');
    if (lectureSelect) {
      lectureSelect.addEventListener('change', (e) => {
        this.currentLectureId = e.target.value;
        if (this.isPlaying) {
          this.stop();
          this.start();
        }
      });
    }

    const stopBtn = document.getElementById('stopDemoBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stop());
    }
  },

  toggleDemo() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  },

  start() {
    if (window.CaptionsEngine && window.CaptionsEngine.isRecognizing) {
      window.CaptionsEngine.stop();
    }

    const lectures = window.DEMO_LECTURES || {};
    const lecture = lectures[this.currentLectureId] || lectures.cs;
    if (!lecture || !lecture.chunks) return;

    this.isPlaying = true;
    this.currentIndex = 0;
    this.updateUI(true);

    if (window.SoundAlerts) {
      window.SoundAlerts.startSimulatedMeter();
    }

    if (window.CaptionsEngine) {
      window.CaptionsEngine.startTime = Date.now();
      window.CaptionsEngine.showNotice(`🎬 Playing Demo Lecture: "${lecture.title}"`, "info");
      // If Hindi lecture, set language
      if (this.currentLectureId === 'hindi_demo') {
        window.CaptionsEngine.setLanguage('hi-IN');
      } else {
        window.CaptionsEngine.setLanguage('en-IN');
      }
    }

    this.playNextChunk();
  },

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timeoutId);
    clearInterval(this.interimTimer);
    this.timeoutId = null;
    this.interimTimer = null;

    if (window.CaptionsEngine) {
      window.CaptionsEngine.interimText = "";
      window.CaptionsEngine.renderInterim();
    }

    if (window.SoundAlerts) {
      window.SoundAlerts.stopSimulatedMeter();
    }

    this.updateUI(false);
  },

  playNextChunk() {
    if (!this.isPlaying) return;

    const lectures = window.DEMO_LECTURES || {};
    const lecture = lectures[this.currentLectureId] || lectures.cs;
    const chunks = lecture.chunks;

    if (this.currentIndex >= chunks.length) {
      // Loop or finish
      this.stop();
      if (window.CaptionsEngine) {
        window.CaptionsEngine.showNotice("Demo lecture complete! Try asking Aura in the Chatbot or generating the Study Kit.", "success");
      }
      return;
    }

    const chunk = chunks[this.currentIndex];
    const fullText = chunk.text;
    const words = fullText.split(' ');
    let wordIndex = 0;

    // Simulate realistic speaking with interim words appearing one by one
    clearInterval(this.interimTimer);
    const wordInterval = Math.max(90, Math.floor(180 / this.speedMultiplier));

    this.interimTimer = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.interimTimer);
        return;
      }

      wordIndex++;
      if (wordIndex <= words.length) {
        const interimSnippet = words.slice(0, wordIndex).join(' ');
        if (window.CaptionsEngine) {
          window.CaptionsEngine.interimText = interimSnippet;
          window.CaptionsEngine.renderInterim();
        }
      } else {
        clearInterval(this.interimTimer);
        // Finalize chunk
        if (window.CaptionsEngine) {
          window.CaptionsEngine.interimText = "";
          window.CaptionsEngine.handleFinalTranscript(fullText);
        }

        // Trigger sound alert if annotated on this chunk
        if (chunk.triggerSound && window.SoundAlerts) {
          setTimeout(() => {
            if (this.isPlaying) {
              window.SoundAlerts.triggerAlert(chunk.triggerSound, 88);
            }
          }, 600);
        }

        this.currentIndex++;
        const nextDelay = (chunk.delay || 3000) / this.speedMultiplier;
        this.timeoutId = setTimeout(() => this.playNextChunk(), nextDelay);
      }
    }, wordInterval);
  },

  updateUI(active) {
    const toggleBtn = document.getElementById('toggleDemoModeBtn');
    const badge = document.getElementById('demoModeActiveBadge');
    const statusPill = document.getElementById('liveStatusIndicator');

    if (toggleBtn) {
      if (active) {
        toggleBtn.innerHTML = `<span>⏹ Stop Demo Mode</span>`;
        toggleBtn.className = "btn btn-danger";
      } else {
        toggleBtn.innerHTML = `<span>🎬 Play Demo Mode</span>`;
        toggleBtn.className = "btn btn-demo";
      }
    }

    if (badge) {
      if (active) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    if (statusPill && active) {
      statusPill.innerHTML = `<span class="pulse-dot demo"></span> DEMO LECTURE RUNNING`;
      statusPill.className = "status-pill active-demo";
    }
  }
};

window.DemoMode = DemoMode;
DemoMode.init();
