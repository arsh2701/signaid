/**
 * SignAid AI - Sound Alerts & Web Audio Decibel Meter
 * Analyzes classroom acoustics in real time to detect sudden loud sounds
 * (door slams, claps, school bells, alarms, raised voices) and provides
 * visual flashes + live volume feedback for hearing-impaired students.
 */

const SoundAlerts = {
  audioCtx: null,
  analyser: null,
  microphone: null,
  stream: null,
  isListening: false,
  animationId: null,
  lastAlertTime: 0,
  alertCooldown: 2500, // ms between alerts to prevent spam
  baselineVolume: 25,
  simulatedInterval: null,
  
  // Callbacks
  onSoundAlert: null,

  init(stream = null) {
    if (stream) {
      this.stream = stream;
    }
  },

  async startListening(mediaStream = null) {
    if (this.isListening) return;
    
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn("Web Audio API not supported in this browser.");
        return;
      }

      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      let streamToUse = mediaStream || this.stream;
      if (!streamToUse) {
        try {
          streamToUse = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.stream = streamToUse;
        } catch (err) {
          console.warn("Microphone access for audio analyzer denied or unavailable:", err);
          this.startSimulatedMeter();
          return;
        }
      }

      this.microphone = this.audioCtx.createMediaStreamSource(streamToUse);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
      this.microphone.connect(this.analyser);

      this.isListening = true;
      this.stopSimulatedMeter();
      this.processAudio();
    } catch (e) {
      console.error("Error starting sound alerts:", e);
      this.startSimulatedMeter();
    }
  },

  stopListening() {
    this.isListening = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.stopSimulatedMeter();
    this.updateMeterUI(0, false);
  },

  processAudio() {
    if (!this.isListening || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate Root Mean Square (RMS) volume level
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    // Scale 0-255 to roughly 0-100 decibel approximation
    const decibels = Math.min(100, Math.round((rms / 128) * 100));

    // Analyze high vs low frequency distribution
    let lowSum = 0;
    let highSum = 0;
    const midPoint = Math.floor(dataArray.length / 3);
    for (let i = 0; i < midPoint; i++) lowSum += dataArray[i];
    for (let i = midPoint; i < dataArray.length; i++) highSum += dataArray[i];

    this.updateMeterUI(decibels, decibels > 35);

    // Sudden loud sound detection
    const threshold = (window.SettingsManager && window.SettingsManager.state.soundSensitivity) || 78;
    const now = Date.now();

    if (decibels >= threshold && (now - this.lastAlertTime > this.alertCooldown)) {
      this.lastAlertTime = now;
      let soundType = "Loud Sound";
      if (highSum > lowSum * 1.5) {
        soundType = "Clap / Bell / Sharp Noise";
      } else if (lowSum > highSum * 2) {
        soundType = "Door Slam / Heavy Impact";
      } else {
        soundType = "Raised Voice / Sudden Noise";
      }
      this.triggerAlert(soundType, decibels);
    }

    this.animationId = requestAnimationFrame(() => this.processAudio());
  },

  updateMeterUI(volume, isSpeaking) {
    const meterBar = document.getElementById('volumeMeterBar');
    const meterVal = document.getElementById('volumeMeterValue');
    const speakerStatus = document.getElementById('teacherSpeakingStatus');
    const waveformIndicator = document.getElementById('audioWaveform');

    if (meterBar) {
      meterBar.style.width = `${Math.min(100, volume)}%`;
      if (volume > 80) {
        meterBar.className = 'meter-fill danger';
      } else if (volume > 45) {
        meterBar.className = 'meter-fill active';
      } else {
        meterBar.className = 'meter-fill idle';
      }
    }

    if (meterVal) {
      meterVal.textContent = `${volume} dB`;
    }

    if (speakerStatus) {
      if (volume > 38) {
        speakerStatus.textContent = "Teacher Speaking";
        speakerStatus.className = "status-badge speaking";
      } else if (this.isListening) {
        speakerStatus.textContent = "Listening (Silence)";
        speakerStatus.className = "status-badge silent";
      } else {
        speakerStatus.textContent = "Microphone Off";
        speakerStatus.className = "status-badge off";
      }
    }

    if (waveformIndicator) {
      if (volume > 30) {
        waveformIndicator.classList.add('active');
      } else {
        waveformIndicator.classList.remove('active');
      }
    }
  },

  triggerAlert(soundLabel, db = 85) {
    // Visual flash across the viewport
    document.body.classList.add('sound-alert-flash');
    setTimeout(() => {
      document.body.classList.remove('sound-alert-flash');
    }, 600);

    // Banner notification
    const banner = document.getElementById('soundAlertBanner');
    const labelSpan = document.getElementById('soundAlertLabel');
    if (banner && labelSpan) {
      labelSpan.textContent = `🚨 ${soundLabel} detected (~${db} dB)`;
      banner.classList.add('show');
      
      // Screen reader assertive announcement
      const srLive = document.getElementById('accessibilityAlertsRegion');
      if (srLive) {
        srLive.textContent = `Alert: ${soundLabel} detected at ${db} decibels`;
      }

      clearTimeout(this._bannerTimeout);
      this._bannerTimeout = setTimeout(() => {
        banner.classList.remove('show');
      }, 3500);
    }

    // Insert sound event badge directly into live caption stream if callback exists
    if (typeof this.onSoundAlert === 'function') {
      this.onSoundAlert(soundLabel, db);
    }
  },

  // Fallback simulated volume meter for Demo Mode or environments without mic
  startSimulatedMeter() {
    this.stopSimulatedMeter();
    this.isListening = true;
    this.simulatedInterval = setInterval(() => {
      if (!this.isListening) return;
      // Generate realistic natural speech fluctuation
      const base = 42 + Math.floor(Math.random() * 26);
      this.updateMeterUI(base, true);
    }, 180);
  },

  stopSimulatedMeter() {
    if (this.simulatedInterval) {
      clearInterval(this.simulatedInterval);
      this.simulatedInterval = null;
    }
  }
};

window.SoundAlerts = SoundAlerts;
