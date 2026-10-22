/**
 * SignAid AI - Configuration File
 * 
 * Instructions:
 * 1. Google Gemini AI (Optional):
 *    Get a free Gemini API key from https://aistudio.google.com/app/apikey
 *    Replace "YOUR_API_KEY_HERE" below. If empty or network fails, built-in offline
 *    intelligence automatically answers doubts and generates study kits.
 * 
 * 2. Firebase Realtime Database (Multi-Device Sync):
 *    For real-time sync across different laptops, tablets, and phones on any Wi-Fi:
 *    a. Go to https://console.firebase.google.com and create a free project.
 *    b. Add a Web App and copy the config object below.
 *    c. Create a "Realtime Database" in test mode (read/write: true).
 *    d. Replace the placeholders in FIREBASE_CONFIG below.
 *    NOTE: If FIREBASE_CONFIG is left as default placeholders or fails, SignAid
 *    AUTOMATICALLY falls back to BroadcastChannel for cross-tab multi-user testing
 *    with zero setup required!
 */

const CONFIG = {
  // Google Gemini API Key
  GEMINI_API_KEY: "YOUR_API_KEY_HERE",
  GEMINI_MODEL: "gemini-1.5-flash",
  
  // Firebase Realtime Database Configuration (Multi-Device Sync)
  FIREBASE_CONFIG: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // MediaPipe Gesture Recognition Assets (Pinned Versions)
  MEDIAPIPE_VISION_CDN: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14",
  MEDIAPIPE_MODEL_URL: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
  MEDIAPIPE_WASM_PATH: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",

  // App Defaults
  DEFAULT_LANG: "en-IN", // English (India), 'hi-IN' for Hindi, 'pa-IN' for Punjabi
  SOUND_ALERT_THRESHOLD: 82, // Decibel sensitivity (0-100)
  WPM_FAST_THRESHOLD: 160,
  WPM_SLOW_THRESHOLD: 80,
  
  // Local Fallback Broadcast Channel
  BROADCAST_CHANNEL_NAME: "signaid_classroom_sync_v2"
};

// Make available globally and for modules
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
