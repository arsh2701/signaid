/**
 * SignAid AI - Accessibility & UI Settings Module
 * Manages font-size, line-spacing, high-contrast, dyslexia-friendly fonts,
 * color-blind palettes, reduced motion, and light/dark theme persistence.
 */

const SettingsManager = {
  storageKey: "signaid_settings_v1",
  
  defaultSettings: {
    theme: "dark",               // 'dark' | 'light' | 'high-contrast'
    fontSize: 20,                // 14px to 32px
    lineHeight: 1.6,             // 1.2 to 2.4
    dyslexicFont: false,         // boolean
    colorBlindMode: "none",      // 'none' | 'protanopia' | 'deuteranopia' | 'high-distinction'
    reducedMotion: false,        // boolean
    hinglishMode: false,         // boolean
    soundAlertsEnabled: true,    // boolean
    soundSensitivity: 80,        // 50 to 95
    autoScroll: true,            // boolean
    wpmAlerts: true              // boolean
  },

  state: {},

  init() {
    this.loadSettings();
    this.applyAllSettings();
    this.bindEvents();
  },

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.state = { ...this.defaultSettings, ...JSON.parse(saved) };
      } else {
        this.state = { ...this.defaultSettings };
        // Detect OS preference for dark mode or reduced motion
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          this.state.theme = 'light';
        }
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.state.reducedMotion = true;
        }
      }
    } catch (e) {
      console.warn("Could not load settings from localStorage:", e);
      this.state = { ...this.defaultSettings };
    }
  },

  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Could not save settings to localStorage:", e);
    }
  },

  update(key, value) {
    this.state[key] = value;
    this.saveSettings();
    this.applySetting(key, value);
    window.dispatchEvent(new CustomEvent('signaid:setting-changed', { detail: { key, value } }));
  },

  applyAllSettings() {
    Object.keys(this.state).forEach(key => {
      this.applySetting(key, this.state[key]);
    });
  },

  applySetting(key, value) {
    const root = document.documentElement;
    
    switch (key) {
      case 'theme':
        root.setAttribute('data-theme', value);
        if (value === 'high-contrast') {
          root.classList.add('high-contrast-mode');
        } else {
          root.classList.remove('high-contrast-mode');
        }
        break;
        
      case 'fontSize':
        root.style.setProperty('--caption-font-size', `${value}px`);
        const fsDisplay = document.getElementById('fontSizeVal');
        if (fsDisplay) fsDisplay.textContent = `${value}px`;
        break;
        
      case 'lineHeight':
        root.style.setProperty('--caption-line-height', `${value}`);
        const lhDisplay = document.getElementById('lineHeightVal');
        if (lhDisplay) lhDisplay.textContent = `${value}x`;
        break;
        
      case 'dyslexicFont':
        if (value) {
          root.classList.add('dyslexia-font');
        } else {
          root.classList.remove('dyslexia-font');
        }
        break;
        
      case 'colorBlindMode':
        root.setAttribute('data-colorblind', value);
        break;
        
      case 'reducedMotion':
        if (value) {
          root.classList.add('reduced-motion');
        } else {
          root.classList.remove('reduced-motion');
        }
        break;

      case 'hinglishMode':
        window.dispatchEvent(new CustomEvent('signaid:hinglish-toggled', { detail: { enabled: value } }));
        break;
    }
    
    this.syncUIInputs();
  },

  syncUIInputs() {
    // Sync slider and checkbox elements if present in DOM
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect && themeSelect.value !== this.state.theme) {
      themeSelect.value = this.state.theme;
    }

    const fsSlider = document.getElementById('fontSizeSlider');
    if (fsSlider && Number(fsSlider.value) !== Number(this.state.fontSize)) {
      fsSlider.value = this.state.fontSize;
    }

    const lhSlider = document.getElementById('lineHeightSlider');
    if (lhSlider && Number(lhSlider.value) !== Number(this.state.lineHeight)) {
      lhSlider.value = this.state.lineHeight;
    }

    const dyslexicCheck = document.getElementById('dyslexicToggle');
    if (dyslexicCheck) dyslexicCheck.checked = Boolean(this.state.dyslexicFont);

    const cbSelect = document.getElementById('colorBlindSelect');
    if (cbSelect && cbSelect.value !== this.state.colorBlindMode) {
      cbSelect.value = this.state.colorBlindMode;
    }

    const motionCheck = document.getElementById('reducedMotionToggle');
    if (motionCheck) motionCheck.checked = Boolean(this.state.reducedMotion);

    const hinglishCheck = document.getElementById('hinglishToggle');
    if (hinglishCheck) hinglishCheck.checked = Boolean(this.state.hinglishMode);

    const autoScrollCheck = document.getElementById('autoScrollToggle');
    if (autoScrollCheck) autoScrollCheck.checked = Boolean(this.state.autoScroll);
  },

  bindEvents() {
    document.addEventListener('DOMContentLoaded', () => {
      this.syncUIInputs();

      // Theme
      const themeSelect = document.getElementById('themeSelect');
      if (themeSelect) {
        themeSelect.addEventListener('change', (e) => this.update('theme', e.target.value));
      }

      // Quick Theme Toggle Button in Header
      const quickThemeBtn = document.getElementById('quickThemeToggle');
      if (quickThemeBtn) {
        quickThemeBtn.addEventListener('click', () => {
          const next = this.state.theme === 'dark' ? 'light' : (this.state.theme === 'light' ? 'high-contrast' : 'dark');
          this.update('theme', next);
        });
      }

      // Font Size
      const fsSlider = document.getElementById('fontSizeSlider');
      if (fsSlider) {
        fsSlider.addEventListener('input', (e) => this.update('fontSize', Number(e.target.value)));
      }

      // Line Height
      const lhSlider = document.getElementById('lineHeightSlider');
      if (lhSlider) {
        lhSlider.addEventListener('input', (e) => this.update('lineHeight', Number(e.target.value)));
      }

      // Dyslexic
      const dyslexicCheck = document.getElementById('dyslexicToggle');
      if (dyslexicCheck) {
        dyslexicCheck.addEventListener('change', (e) => this.update('dyslexicFont', e.target.checked));
      }

      // Colorblind
      const cbSelect = document.getElementById('colorBlindSelect');
      if (cbSelect) {
        cbSelect.addEventListener('change', (e) => this.update('colorBlindMode', e.target.value));
      }

      // Reduced Motion
      const motionCheck = document.getElementById('reducedMotionToggle');
      if (motionCheck) {
        motionCheck.addEventListener('change', (e) => this.update('reducedMotion', e.target.checked));
      }

      // Hinglish Toggle
      const hinglishCheck = document.getElementById('hinglishToggle');
      if (hinglishCheck) {
        hinglishCheck.addEventListener('change', (e) => this.update('hinglishMode', e.target.checked));
      }

      // Auto scroll
      const autoScrollCheck = document.getElementById('autoScrollToggle');
      if (autoScrollCheck) {
        autoScrollCheck.addEventListener('change', (e) => this.update('autoScroll', e.target.checked));
      }
      
      // Reset settings button
      const resetBtn = document.getElementById('resetSettingsBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.state = { ...this.defaultSettings };
          this.saveSettings();
          this.applyAllSettings();
        });
      }
    });
  }
};

window.SettingsManager = SettingsManager;
SettingsManager.init();
