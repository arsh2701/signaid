/**
 * SignAid AI - Core Application Orchestrator
 * Connects all modules (Captions, Chatbot, MissedThat, SoundAlerts, Sync, StudyKit, Settings)
 * into a seamless, award-worthy accessible classroom experience.
 */

window.SignAid = {
  version: "2.5.0-award-edition",
  
  // Module references
  get CaptionsEngine() { return window.CaptionsEngine; },
  get Chatbot() { return window.Chatbot; },
  get MissedThat() { return window.MissedThat; },
  get SoundAlerts() { return window.SoundAlerts; },
  get SyncManager() { return window.SyncManager; },
  get StudyKit() { return window.StudyKit; },
  get SettingsManager() { return window.SettingsManager; },
  get DemoMode() { return window.DemoMode; },
  get SignVision() { return window.SignVision; },
  get VideoMeeting() { return window.VideoMeeting; },
  get AuthManager() { return window.AuthManager; },
  get ClassroomManager() { return window.ClassroomManager; },
  get ClassChat() { return window.ClassChat; },
  
  init() {
    console.log(`%c🚀 SignAid AI initialized (v${this.version})`, 'color: #38bdf8; font-weight: bold; font-size: 14px;');
    this.bindNavigation();
    this.bindKeyboardShortcuts();
    this.bindTimelineRewind();
    this.checkBrowserCapabilities();
  },

  bindNavigation() {
    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Mobile nav toggle if present
    const mobileMenuBtn = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinksContainer');
    if (mobileMenuBtn && navLinks) {
      mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('nav-open');
      });
    }
  },

  bindKeyboardShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    const openBtn = document.getElementById('openShortcutsBtn');
    const closeBtn = document.getElementById('closeShortcutsModalBtn');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        modal.classList.add('open');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    // Global Key Listener
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in text inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      switch (e.key) {
        case '?':
          if (modal) modal.classList.toggle('open');
          break;
        case 'Escape':
          if (modal) modal.classList.remove('open');
          if (window.MissedThat) window.MissedThat.closePanel();
          if (window.Chatbot) window.Chatbot.closeChat();
          if (window.CaptionsEngine) window.CaptionsEngine.closeKeywordModal();
          this.closeTimelineModal();
          break;
        case ' ': // Space: toggle live captions
          e.preventDefault();
          if (window.CaptionsEngine) {
            if (window.CaptionsEngine.isRecognizing) window.CaptionsEngine.stop();
            else window.CaptionsEngine.start();
          }
          break;
        case 'c':
        case 'C':
          if (window.Chatbot) window.Chatbot.toggleChat();
          break;
        case 't':
        case 'T':
          this.openTimelineModal();
          break;
      }
    });
  },

  // Rewind & Replay Timeline Modal
  bindTimelineRewind() {
    const openTimelineBtn = document.getElementById('openTimelineBtn');
    const closeTimelineBtn = document.getElementById('closeTimelineModalBtn');

    if (openTimelineBtn) {
      openTimelineBtn.addEventListener('click', () => this.openTimelineModal());
    }
    if (closeTimelineBtn) {
      closeTimelineBtn.addEventListener('click', () => this.closeTimelineModal());
    }
  },

  openTimelineModal() {
    const modal = document.getElementById('timelineModal');
    const container = document.getElementById('timelineEventsContainer');
    if (!modal || !container) return;

    modal.classList.add('open');

    const history = (window.CaptionsEngine && window.CaptionsEngine.transcriptHistory) || [];
    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-timeline-state">
          <p>No classroom moments recorded yet.</p>
          <p class="subtext">Start speaking or run Demo Mode to build a navigable lecture timeline.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map((item, idx) => {
      const isStarred = item.starred;
      const isSound = item.type === 'sound';
      return `
        <div class="timeline-item ${isStarred ? 'is-starred' : ''} ${isSound ? 'is-sound' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="timeline-header">
              <span class="timeline-time">${item.timestamp}</span>
              <button class="timeline-star-btn ${isStarred ? 'active' : ''}" onclick="SignAid.toggleTimelineStar('${item.id}', this)" title="Star moment">
                ${isStarred ? '★ Bookmarked' : '☆ Bookmark'}
              </button>
            </div>
            <p class="timeline-text">${item.rawText}</p>
            <button class="timeline-jump-btn" onclick="SignAid.jumpToCaption('${item.id}')">
              Jump to line in captions ↗
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  closeTimelineModal() {
    const modal = document.getElementById('timelineModal');
    if (modal) modal.classList.remove('open');
  },

  toggleTimelineStar(id, btnElem) {
    if (window.CaptionsEngine) {
      window.CaptionsEngine.toggleStar(id);
      const isNowStarred = window.CaptionsEngine.transcriptHistory.find(i => i.id === id)?.starred;
      if (btnElem) {
        btnElem.innerHTML = isNowStarred ? '★ Bookmarked' : '☆ Bookmark';
        btnElem.classList.toggle('active', isNowStarred);
      }
    }
  },

  jumpToCaption(id) {
    this.closeTimelineModal();
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elem.classList.add('highlight-pulse');
      setTimeout(() => elem.classList.remove('highlight-pulse'), 2500);
    }
  },

  checkBrowserCapabilities() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if (!isChrome) {
      console.warn("SignAid: Browser detected is not Google Chrome. Live Web Speech Recognition performs best on Chrome.");
      const notice = document.getElementById('browserCompatibilityNotice');
      if (notice) notice.classList.remove('hidden');
    }

    // Check if running on file:// protocol
    if (window.location.protocol === 'file:') {
      const fileBanner = document.getElementById('fileProtocolNotice');
      if (fileBanner) fileBanner.classList.remove('hidden');
    }
  }
};

// Auto initialize once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.SignAid.init());
} else {
  window.SignAid.init();
}
