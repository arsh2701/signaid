/**
 * SignAid AI - Core Live Captions Engine
 * Web Speech API with continuous streaming, interim grey text, solid final text,
 * keyword definitions, Hindi-to-Hinglish transliteration, and bookmarking.
 */

const CaptionsEngine = {
  recognition: null,
  isRecognizing: false,
  shouldRestart: false,
  selectedLang: "en-IN",
  transcriptHistory: [], // Array of { id, text, rawText, timestamp, isFinal, starred, type: 'speech' | 'sound' }
  interimText: "",
  startTime: null,
  totalWordCount: 0,
  recentWordsHistory: [], // [{ time, count }] for rolling WPM
  wpm: 0,
  wpmTimer: null,
  storageKey: "signaid_live_transcript_v1",

  init() {
    this.selectedLang = (window.CONFIG && window.CONFIG.DEFAULT_LANG) || "en-IN";
    this.setupSpeechRecognition();
    this.loadSavedTranscript();
    this.bindDOM();
    this.startWpmMonitor();

    // Listen for sound alerts from Web Audio API
    if (window.SoundAlerts) {
      window.SoundAlerts.onSoundAlert = (label, db) => {
        this.addSoundEventCaption(label, db);
      };
    }

    // Listen for hinglish toggle
    window.addEventListener('signaid:hinglish-toggled', () => {
      this.renderTranscript();
    });
  },

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      const errorNotice = document.getElementById('speechApiUnsupportedNotice');
      if (errorNotice) errorNotice.classList.remove('hidden');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.selectedLang;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isRecognizing = true;
      if (!this.startTime) this.startTime = Date.now();
      this.updateStatusUI(true);
      if (window.SoundAlerts) window.SoundAlerts.startListening();
    };

    this.recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.handleFinalTranscript(transcriptPiece);
        } else {
          interim += transcriptPiece;
        }
      }
      this.interimText = interim;
      this.renderInterim();
    };

    this.recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        this.shouldRestart = false;
        this.showNotice("Microphone permission was denied. Please allow microphone access in Chrome settings.", "error");
        this.updateStatusUI(false);
      } else if (event.error === 'network') {
        this.showNotice("Network connection issue with speech service. Check connection or try Demo Mode.", "warning");
      }
    };

    this.recognition.onend = () => {
      this.isRecognizing = false;
      this.interimText = "";
      this.renderInterim();

      // Auto-restart if user has not explicitly stopped
      if (this.shouldRestart) {
        setTimeout(() => {
          if (this.shouldRestart && !this.isRecognizing) {
            try {
              this.recognition.start();
            } catch (err) {
              console.warn("Auto-restart error:", err);
            }
          }
        }, 300);
      } else {
        this.updateStatusUI(false);
      }
    };
  },

  start() {
    if (!this.recognition) {
      this.setupSpeechRecognition();
      if (!this.recognition) {
        this.showNotice("Speech recognition is not available in your browser. Please use Google Chrome or activate Demo Mode.", "error");
        return;
      }
    }
    
    // Stop demo mode if running
    if (window.DemoMode && window.DemoMode.isPlaying) {
      window.DemoMode.stop();
    }

    try {
      this.shouldRestart = true;
      this.recognition.lang = this.selectedLang;
      this.recognition.start();
    } catch (e) {
      console.warn("Recognition start call note:", e.message);
    }
  },

  stop() {
    this.shouldRestart = false;
    if (this.recognition && this.isRecognizing) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn("Recognition stop error:", e);
      }
    }
    this.isRecognizing = false;
    this.updateStatusUI(false);
    if (window.SoundAlerts) {
      window.SoundAlerts.stopListening();
    }
  },

  setLanguage(langCode) {
    this.selectedLang = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
      if (this.isRecognizing) {
        // Restart recognition with new language
        this.stop();
        setTimeout(() => this.start(), 350);
      }
    }
  },

  handleFinalTranscript(rawText) {
    const text = rawText.trim();
    if (!text) return;

    const entry = {
      id: "cap_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      rawText: text,
      text: text,
      lang: this.selectedLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      epoch: Date.now(),
      starred: false,
      type: 'speech'
    };

    this.transcriptHistory.push(entry);
    this.saveTranscript();

    // Track word count for WPM
    const words = text.split(/\s+/).filter(Boolean);
    this.totalWordCount += words.length;
    this.recentWordsHistory.push({ time: Date.now(), count: words.length });

    this.renderTranscript();
    this.updatePulseMetrics();

    // Cross-tab synchronization broadcast if Teacher Mode
    if (window.SyncManager) {
      window.SyncManager.broadcastCaption(entry);
    }

    // Notify other modules
    window.dispatchEvent(new CustomEvent('signaid:new-caption', { detail: entry }));
  },

  addSoundEventCaption(label, db) {
    const entry = {
      id: "snd_" + Date.now(),
      rawText: `[🚨 Sound Event: ${label} (~${db} dB)]`,
      text: `[🚨 Sound Event: ${label} (~${db} dB)]`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      epoch: Date.now(),
      starred: false,
      type: 'sound',
      db: db
    };

    this.transcriptHistory.push(entry);
    this.saveTranscript();
    this.renderTranscript();

    if (window.SyncManager) {
      window.SyncManager.broadcastCaption(entry);
    }
  },

  renderTranscript() {
    const container = document.getElementById('captionStreamContainer');
    if (!container) return;

    const isHinglish = window.SettingsManager ? window.SettingsManager.state.hinglishMode : false;
    const filterStarred = document.getElementById('filterBookmarksToggle')?.checked || false;

    const filtered = filterStarred 
      ? this.transcriptHistory.filter(item => item.starred)
      : this.transcriptHistory;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-caption-state" id="emptyCaptionState">
          <div class="empty-icon">🎙️</div>
          <h3>Captions will appear here in real-time</h3>
          <p>Press <strong>Start Captions</strong>, choose your language, or click <strong>Demo Mode</strong> to test instantly.</p>
        </div>
      `;
      this.renderInterim();
      return;
    }

    let html = '';
    filtered.forEach((item, index) => {
      let displayText = item.rawText;
      
      // If Hindi and Hinglish mode enabled
      if (isHinglish && window.HinglishTransliterator && (item.lang === 'hi-IN' || /[\u0900-\u097F]/.test(displayText))) {
        displayText = window.HinglishTransliterator.toHinglish(displayText);
      }

      // Keyword highlighting
      const highlightedText = this.highlightKeywords(displayText);

      if (item.type === 'sound') {
        html += `
          <div class="caption-line sound-event-line" id="${item.id}" data-id="${item.id}">
            <span class="caption-timestamp">${item.timestamp}</span>
            <span class="sound-tag">${highlightedText}</span>
          </div>
        `;
      } else {
        const starClass = item.starred ? 'starred active' : 'star-btn';
        html += `
          <div class="caption-line speech-line ${item.starred ? 'is-starred' : ''}" id="${item.id}" data-id="${item.id}">
            <div class="caption-meta">
              <span class="caption-timestamp" title="Click to view timeline">${item.timestamp}</span>
              <button class="bookmark-btn ${starClass}" data-action="toggle-star" data-id="${item.id}" title="${item.starred ? 'Bookmarked' : 'Bookmark this point'}" aria-label="Bookmark">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="${item.starred ? '#f59e0b' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
            </div>
            <div class="caption-text-content">${highlightedText}</div>
          </div>
        `;
      }
    });

    // Append interim container placeholder
    html += `<div id="captionInterimSlot" class="caption-interim-slot"></div>`;

    container.innerHTML = html;
    this.renderInterim();
    this.bindKeywordTooltips();
    this.bindStarButtons();

    // Auto-scroll to bottom if enabled
    if (window.SettingsManager && window.SettingsManager.state.autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  },

  renderInterim() {
    const slot = document.getElementById('captionInterimSlot');
    if (!slot) return;

    if (this.interimText && this.interimText.trim()) {
      let displayInterim = this.interimText.trim();
      const isHinglish = window.SettingsManager ? window.SettingsManager.state.hinglishMode : false;
      if (isHinglish && window.HinglishTransliterator && (this.selectedLang === 'hi-IN' || /[\u0900-\u097F]/.test(displayInterim))) {
        displayInterim = window.HinglishTransliterator.toHinglish(displayInterim);
      }
      
      slot.innerHTML = `
        <div class="caption-line interim-line">
          <span class="caption-timestamp">Live</span>
          <span class="interim-text">${this.escapeHtml(displayInterim)} <span class="typing-cursor">|</span></span>
        </div>
      `;
      const container = document.getElementById('captionStreamContainer');
      if (container && window.SettingsManager && window.SettingsManager.state.autoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      slot.innerHTML = "";
    }
  },

  highlightKeywords(text) {
    if (!text || typeof text !== 'string') return '';
    const glossary = window.TECHNICAL_GLOSSARY || {};
    let safeText = this.escapeHtml(text);

    // Scan glossary terms sorted by longest term first so multi-word terms match before subwords
    const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);

    terms.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      safeText = safeText.replace(regex, (match) => {
        const key = term.toLowerCase();
        return `<mark class="smart-keyword" data-term="${key}" tabindex="0" role="button" aria-haspopup="dialog">${match}</mark>`;
      });
    });

    return safeText;
  },

  bindKeywordTooltips() {
    const keywordMarks = document.querySelectorAll('.smart-keyword');
    keywordMarks.forEach(mark => {
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        const termKey = mark.getAttribute('data-term');
        this.showKeywordModal(termKey);
      });
      mark.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const termKey = mark.getAttribute('data-term');
          this.showKeywordModal(termKey);
        }
      });
    });
  },

  showKeywordModal(termKey) {
    const glossary = window.TECHNICAL_GLOSSARY || {};
    const info = glossary[termKey] || {
      term: termKey.toUpperCase(),
      category: "Concept",
      simple: "A key subject term referenced in this classroom session.",
      example: "Ask the SignAid chatbot for in-depth examples!"
    };

    const modal = document.getElementById('keywordDefinitionModal');
    const title = document.getElementById('keywordModalTitle');
    const category = document.getElementById('keywordModalCategory');
    const def = document.getElementById('keywordModalDef');
    const eg = document.getElementById('keywordModalExample');
    const askAiBtn = document.getElementById('keywordAskAiBtn');

    if (title) title.textContent = info.term;
    if (category) category.textContent = info.category || "Classroom Concept";
    if (def) def.textContent = info.simple;
    if (eg) eg.textContent = info.example || "No example available.";

    if (askAiBtn) {
      askAiBtn.onclick = () => {
        this.closeKeywordModal();
        if (window.Chatbot) {
          window.Chatbot.openChat();
          window.Chatbot.sendUserQuery(`Please explain the term "${info.term}" in simple classroom terms with a fun analogy.`);
        }
      };
    }

    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  closeKeywordModal() {
    const modal = document.getElementById('keywordDefinitionModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  bindStarButtons() {
    const starBtns = document.querySelectorAll('[data-action="toggle-star"]');
    starBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.toggleStar(id);
      });
    });
  },

  toggleStar(id) {
    const entry = this.transcriptHistory.find(item => item.id === id);
    if (entry) {
      entry.starred = !entry.starred;
      this.saveTranscript();
      this.renderTranscript();
      this.updatePulseMetrics();
    }
  },

  clearTranscript() {
    if (confirm("Are you sure you want to clear the current transcript?")) {
      this.transcriptHistory = [];
      this.totalWordCount = 0;
      this.recentWordsHistory = [];
      this.wpm = 0;
      this.interimText = "";
      this.saveTranscript();
      this.renderTranscript();
      this.updatePulseMetrics();
      this.showNotice("Transcript cleared.", "info");
    }
  },

  downloadTranscript() {
    if (this.transcriptHistory.length === 0) {
      alert("Transcript is empty. Start recording or run Demo Mode first!");
      return;
    }

    let fileContent = `========================================\n`;
    fileContent += `SignAid AI - Classroom Lecture Transcript\n`;
    fileContent += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n`;
    fileContent += `Language: ${this.selectedLang} | Total Captions: ${this.transcriptHistory.length}\n`;
    fileContent += `========================================\n\n`;

    this.transcriptHistory.forEach(item => {
      const starTag = item.starred ? " [★ BOOKMARKED]" : "";
      fileContent += `[${item.timestamp}]${starTag} ${item.rawText}\n`;
    });

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SignAid-Transcript-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Rolling words per minute calculator
  startWpmMonitor() {
    this.wpmTimer = setInterval(() => {
      const now = Date.now();
      // Keep words from last 60 seconds
      this.recentWordsHistory = this.recentWordsHistory.filter(w => now - w.time < 60000);
      const wordsInLastMin = this.recentWordsHistory.reduce((sum, item) => sum + item.count, 0);
      this.wpm = wordsInLastMin;
      this.updatePulseMetrics();
    }, 1500);
  },

  updatePulseMetrics() {
    // Update WPM in UI
    const wpmVal = document.getElementById('pulseWpmValue');
    const wpmBadge = document.getElementById('pulseWpmWarningBadge');
    if (wpmVal) wpmVal.textContent = this.wpm;

    if (wpmBadge) {
      const fastThresh = (window.CONFIG && window.CONFIG.WPM_FAST_THRESHOLD) || 160;
      if (this.wpm > fastThresh) {
        wpmBadge.textContent = "⚡ Fast Paced (Teacher speaking quickly)";
        wpmBadge.className = "pulse-badge warning";
      } else if (this.wpm > 60) {
        wpmBadge.textContent = "✓ Optimal Pace for Comprehension";
        wpmBadge.className = "pulse-badge normal";
      } else {
        wpmBadge.textContent = "• Gentle / Discussion Pace";
        wpmBadge.className = "pulse-badge calm";
      }
    }

    // Bookmarked count
    const starCount = this.transcriptHistory.filter(i => i.starred).length;
    const starElem = document.getElementById('pulseBookmarksCount');
    if (starElem) starElem.textContent = starCount;

    // Talk time
    if (this.startTime && this.isRecognizing) {
      const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const timeElem = document.getElementById('pulseTalkTime');
      if (timeElem) timeElem.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Update keyword tags cloud
    this.updateKeywordCloud();
  },

  updateKeywordCloud() {
    const cloud = document.getElementById('pulseKeywordsCloud');
    if (!cloud) return;

    const fullText = this.transcriptHistory.map(i => i.rawText).join(' ').toLowerCase();
    const glossary = window.TECHNICAL_GLOSSARY || {};
    const foundTerms = [];

    Object.keys(glossary).forEach(term => {
      const count = (fullText.match(new RegExp(`\\b${term}\\b`, 'gi')) || []).length;
      if (count > 0) {
        foundTerms.push({ term: glossary[term].term, count, key: term });
      }
    });

    if (foundTerms.length === 0) {
      cloud.innerHTML = `<span class="tag-empty">Key concepts detected will populate here...</span>`;
      return;
    }

    foundTerms.sort((a, b) => b.count - a.count);
    cloud.innerHTML = foundTerms.map(t => `
      <button class="keyword-tag" onclick="SignAid.CaptionsEngine.showKeywordModal('${t.key}')" title="Click to view definition">
        ${t.term} <span class="tag-count">×${t.count}</span>
      </button>
    `).join('');
  },

  // Get transcript of the last N seconds (for "I Missed That")
  getLastSecondsTranscript(seconds = 45) {
    const now = Date.now();
    const thresholdEpoch = now - (seconds * 1000);
    const speechEntries = this.transcriptHistory.filter(i => i.type === 'speech');
    
    // If we have entries within threshold
    let recent = speechEntries.filter(i => i.epoch >= thresholdEpoch);
    // If too few or time lapsed, grab last 5 items
    if (recent.length < 2) {
      recent = speechEntries.slice(-5);
    }
    return recent.map(i => i.rawText).join(' ');
  },

  getAllTranscriptText() {
    return this.transcriptHistory
      .filter(i => i.type === 'speech')
      .map(i => i.rawText)
      .join('\n');
  },

  loadSavedTranscript() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.transcriptHistory = JSON.parse(saved);
        this.renderTranscript();
        this.updatePulseMetrics();
      }
    } catch (e) {
      console.warn("Could not load saved transcript:", e);
    }
  },

  saveTranscript() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.transcriptHistory));
    } catch (e) {
      console.warn("Could not save transcript to localStorage:", e);
    }
  },

  updateStatusUI(isActive) {
    const startBtn = document.getElementById('startCaptionsBtn');
    const stopBtn = document.getElementById('stopCaptionsBtn');
    const statusPill = document.getElementById('liveStatusIndicator');
    const waveElem = document.getElementById('audioWaveform');

    if (startBtn) startBtn.disabled = isActive;
    if (stopBtn) stopBtn.disabled = !isActive;
    
    if (statusPill) {
      if (isActive) {
        statusPill.innerHTML = `<span class="pulse-dot active"></span> LIVE CAPTIONING`;
        statusPill.className = "status-pill active";
      } else {
        statusPill.innerHTML = `<span class="pulse-dot idle"></span> STANDBY`;
        statusPill.className = "status-pill idle";
      }
    }

    if (waveElem) {
      if (isActive) waveElem.classList.add('active');
      else waveElem.classList.remove('active');
    }
  },

  showNotice(msg, type = "info") {
    const toast = document.getElementById('systemNotificationToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast-notice ${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  bindDOM() {
    // Start / Stop
    const startBtn = document.getElementById('startCaptionsBtn');
    if (startBtn) startBtn.addEventListener('click', () => this.start());

    const stopBtn = document.getElementById('stopCaptionsBtn');
    if (stopBtn) stopBtn.addEventListener('click', () => this.stop());

    const clearBtn = document.getElementById('clearCaptionsBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearTranscript());

    const downloadBtn = document.getElementById('downloadCaptionsBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadTranscript());

    // Language selector
    const langSelect = document.getElementById('captionLanguageSelect');
    if (langSelect) {
      langSelect.value = this.selectedLang;
      langSelect.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }

    // Filter bookmarks checkbox
    const filterBookmarks = document.getElementById('filterBookmarksToggle');
    if (filterBookmarks) {
      filterBookmarks.addEventListener('change', () => this.renderTranscript());
    }

    // Close definition modal
    const closeDefBtn = document.getElementById('closeDefModalBtn');
    if (closeDefBtn) {
      closeDefBtn.addEventListener('click', () => this.closeKeywordModal());
    }
  }
};

window.CaptionsEngine = CaptionsEngine;
