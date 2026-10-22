# ⚡ SignAid AI - Inclusive Classroom Real-Time Captioning Assistant

> **Hackathon Challenge:** *"Build an accessibility assistant that provides real-time captions for hearing-impaired students in classrooms."*  
> **Tech Stack:** Pure HTML5, CSS3, Vanilla JavaScript (ES6+ Modules/Architecture). Zero frameworks. Zero build steps. High performance.

---

## 🌟 Overview & Mission

Deaf and hard-of-hearing students face immense cognitive strain in lecture halls: lip-reading captures under 35% of spoken dialogue, rapid technical explanations leave them behind, and sudden classroom events (bells, door slams, teacher applause) pass unnoticed.

**SignAid AI** transforms the classroom into an inclusive, intelligent environment with:
1. **Live Classroom Video Meeting Room (Google Meet Style):** Real-time webcam feeds, Screen Sharing (`getDisplayMedia` for slides/code), WebRTC P2P multi-tab video, and live **Closed Captions (CC) subtitle overlay** directly on top of the video feed.
2. **Continuous Real-Time Speech-to-Text** with interim grey streaming, solid final text, and automatic silence re-engagement.
3. **"I Missed That!" One-Tap Simplifier:** Captures the last 45 seconds of lecture speech and re-explains it in ultra-simple terms with an everyday analogy.
4. **Acoustic Sound Intelligence:** Web Audio API detects sudden classroom noises (claps, bell rings, door slams, raised voices) with visual screen-pulse flashes and ARIA assertive live region announcements.
5. **Smart Keyword Definitions:** Detects technical STEM terms and provides instant simple popover explanations on hover or tap.
6. **Teacher-Student Real-Time Sync:** Web BroadcastChannel API allows the teacher to speak into one tab while students in separate tabs receive synchronized captions and alerts.
7. **Class Pulse Dashboard:** Live Words-Per-Minute (WPM) gauge with fast-pace teacher warnings, talk timer, and concept cloud.
8. **Post-Class AI Study Kit:** Synthesizes the lecture transcript into an executive summary, 3D flip flashcards, and a 5-question comprehension quiz.
9. **Context-Aware AI Chatbot ("Aura"):** Answers student doubts grounded directly in the live lecture transcript.
10. **Hinglish Transliteration:** Automatically converts Devanagari Hindi captions into readable Roman phonetics for students.
11. **Sign Language Beta Preview:** Interactive hand-landmark tracking and synthetic skeleton visualizer demonstrating the upcoming MediaPipe sign-to-text pipeline.
12. **Exemplary Accessibility:** Font scaling, line spacing, high contrast (WCAG AAA), Dyslexia-friendly font (Lexend), color-blind palettes, and reduced motion.

---

## 🚀 Quick Start / How to Run

SignAid is built with 100% native web standards and runs locally in **Google Chrome**.

### Method 1: VS Code Live Server (Recommended)
1. Open this project directory (`signaid hackerwrath`) in **VS Code**.
2. Install the **Live Server** extension if not already installed (`ext install ritwickdey.LiveServer`).
3. Right-click on `index.html` and select **"Open with Live Server"**.
4. The site will open at `http://127.0.0.1:5500/index.html`.

### Method 2: Python Local Server
If you don't use VS Code, open a terminal in this folder and run:
```bash
python -m http.server 5500
```
Then open Chrome and navigate to:
```
http://localhost:5500
```

> **Note on Browser:** Google Chrome is strongly recommended as it provides the most robust native implementation of the Web Speech API (`webkitSpeechRecognition`).

---

## 🔑 Google Gemini API Configuration

SignAid supports **Google Gemini AI** for dynamic live explanations, contextual chatbot inquiries, and custom Study Kit generation.

### Where to add your key:
1. Open [`config.js`](file:///config.js).
2. Locate line 15:
   ```javascript
   GEMINI_API_KEY: "YOUR_API_KEY_HERE",
   ```
3. Replace `"YOUR_API_KEY_HERE"` with your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Save the file.

> **🛡️ Offline & Network Resilience:** If no API key is provided, or if your internet connection drops during the hackathon demo, **SignAid automatically switches to its built-in rule-based intelligence engine**. The chatbot, "I Missed That", and Study Kit will continue working seamlessly!

---

## 🎭 3-Minute Hackathon Demo Script (Judges Pitch)

Follow this sequence to deliver an unforgettable, award-worthy presentation:

### Step 1: The Live Video Meeting & Captions (0:00 - 0:45)
1. Open `http://localhost:5500` in Google Chrome.
2. Click **"📹 Join Live Video Classroom"** (or click **"Live Video 📹"** in the top navigation).
3. The **Live Video Meeting Room (Google Meet style)** opens immediately:
   - Real-time webcam stream on the main stage.
   - Picture-in-Picture student tiles and Sign Language PIP interpreter in the corner.
   - **Live Closed Caption (CC) Subtitles Bar** overlaid right on the video with interim text and keyword highlighting.
   - Try clicking **"🖥️ Share Screen"** to demonstrate slides presentation while captions overlay in real time!
   - Try clicking **"💬 Subtitles (CC)"** to toggle the video subtitle overlay.
4. *(Optional if mic is unavailable):* Click **"🎬 Play Demo Mode"** to stream realistic lecture chunks directly onto the video call screen!

### Step 2: "I Missed That" & Smart Keyword Definitions (0:45 - 1:30)
1. Hit the big amber button: **⚡ "I Missed That!" (or press 'M' on your keyboard)**.
2. The slide-over panel will open, displaying the exact snippet spoken in the last 45 seconds and providing:
   - 📌 **The Core Point**
   - 💡 **Simple Bullet Points**
   - 🌟 **A Relatable Real-World Analogy**
3. Close the drawer and point to the live transcript where terms like **Algorithm**, **Binary Search**, or **Recursion** are highlighted in cyan.
4. Click or hover on **"Binary Search"** to show the instant definition popover modal, complete with real-world examples.

### Step 3: Acoustic Sound Intelligence & Class Pulse (1:30 - 2:00)
1. Clap your hands loudly or tap your desk firmly near your laptop microphone.
2. Point out the **visual screen-edge flash**, the red banner (`🚨 Clap / Sharp Noise detected (~88 dB)`), and the sound tag injected into the caption log.
3. Scroll to the **Class Pulse Dashboard** on the right:
   - Show the **Teacher Speed WPM meter** (with warning badge if speech exceeds 160 WPM).
   - Show the **Talk Time counter** and the **Detected Key Concepts tag cloud**.

### Step 4: Class Code Join with Teacher Approval & Multi-Tab Sync (2:00 - 2:30)
1. **Teacher Tab:** Open `http://localhost:5500` and select **"Continue as Teacher"** (e.g. Prof. Ananya Sharma).
   - An auto-generated unique 6-character code (e.g. `A7K29X`) appears on the dashboard.
   - Click **"📋 Copy Code"**. You can also test **"🔄 Regenerate"** or **"🔒 Disable Code"**.
2. **Student Tab:** Open an incognito window or second browser tab to `http://localhost:5500`.
   - Select **"Continue as Student"** (e.g. Rahul Verma, `rahul@student.edu`).
   - Paste the 6-character code and click **"🚀 Join Class"**.
   - Student's screen immediately shows **"⏳ Status: Pending Teacher Approval"** with classroom details. Captions are locked to prevent unauthorized viewing.
3. **Teacher Real-Time Approval:**
   - In the Teacher Tab, an audio chime plays and the **"📥 Requests"** badge pulses with count `1`.
   - Click **"📥 Requests"** to view Rahul's name, email, and requested timestamp.
   - Click **"✓ Accept"**.
4. **Live Unlock:**
   - In the Student Tab, the screen instantly unlocks with a toast notification: *"Welcome to Prof. Ananya Sharma's Classroom! Live captions unlocked."*
   - Start speaking or click **"Demo Mode"** in the Teacher Tab &rarr; captions stream synchronously to the approved student in Tab 2!
   - Teacher can open **"👥 Students"** to view enrolled students or remove a student if needed.

### Step 5: Post-Class Study Kit & Chatbot Aura (2:30 - 3:00)
1. Scroll down to the **Post-Class AI Study Kit** section and click **"✨ Generate Study Kit"**.
2. Demonstrate:
   - The **Executive Summary & Key Takeaways**.
   - The **Interactive 3D Flip Flashcards** (click to flip from question to answer).
   - The **5-Question Interactive Quiz** (click an answer to show instant green/red feedback, explanations, and final score tally).
3. Click the floating **✨ Aura Chatbot** in the bottom-right corner.
   - Tap the quick chip: **"What did teacher say about recursion?"**
   - Show how Aura answers using the live transcript context!
4. *(Bonus)* Click **"🤟 Launch Camera & Vision Preview"** in the Sign Language section to show the real-time hand-skeleton computer vision tracking demo!

---

## ♿ Accessibility Compliance Checklist (WCAG 2.1 AA/AAA)

SignAid was built from the ground up prioritizing assistive technology:
- **ARIA Live Regions:** `aria-live="polite"` for transcript flow and `aria-live="assertive"` for acoustic sound alerts.
- **Dynamic Font Scaling:** Slider controls font sizes from 14px to 32px (`--caption-font-size`).
- **Adjustable Line Spacing:** Slider controls line heights from 1.2x to 2.4x (`--caption-line-height`).
- **High-Contrast Mode:** WCAG AAA certified pure black `#000000` with vivid yellow `#FFFF00` and cyan `#00FFFF`.
- **Dyslexia-Friendly Typography:** Lexend font family integration for reduced visual crowding.
- **Color-Blind Safe Palettes:** Specialized high-contrast modes for Protanopia and Deuteranopia.
- **Reduced Motion:** Fully honors `prefers-reduced-motion` and includes an explicit toggle to disable all waveforms and flips.
- **Visible Keyboard Focus:** 3px offset high-visibility focus rings and complete keyboard navigability (`Space`, `M`, `C`, `T`, `?`, `Esc`).

---

## 📁 Project Architecture & File Structure

```
signaid-hackerwrath/
├── index.html            # Semantic HTML5 application structure & accessible dialogs
├── style.css             # Glassmorphic cyber-neumorphic design system & WCAG themes
├── config.js             # Configuration file & Gemini API key placeholder
├── script.js             # Master orchestrator, keyboard shortcuts & timeline navigation
├── README.md             # Documentation, run guide & hackathon demo script
└── js/
    ├── auth.js           # Tab-isolated session authentication & role manager
    ├── classroom-manager.js # Class code generation, teacher approval & student access gate
    ├── captions.js       # Web Speech API engine, continuous auto-restart & bookmarks
    ├── sound-alerts.js   # Web Audio API decibel gauge & sudden acoustic spike detector
    ├── chatbot.js        # Aura AI classroom assistant with transcript context injection
    ├── missed-that.js    # 45-second speech isolator & simplification generator
    ├── sync.js           # BroadcastChannel cross-tab Teacher & Student synchronizer
    ├── study-kit.js      # Executive summary, 3D flip flashcards & 5-question quiz
    ├── transliterate.js  # Devanagari Hindi to phonetic Roman script (Hinglish)
    ├── settings.js       # Accessibility state manager, sliders, and localStorage sync
    ├── demo-mode.js      # Word-by-word simulated lecture streamer for offline demo
    ├── demo-data.js      # Realistic STEM lectures, fallback datasets & technical glossary
    └── sign-vision.js    # Beta Sign-to-Text camera preview & hand landmark HUD
```

---

## 👥 Credits

Crafted with dedication by **[Team HackerWrath]** for the Accessibility Hackathon.  
*Empowering Deaf & Hard-of-Hearing Students with Real-Time Captions, Sound Intelligence, and AI Simplification.*
