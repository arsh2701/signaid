/**
 * SignAid AI - "I Missed That" Quick Explainer
 * When a deaf or hard-of-hearing student misses a rapid point made by the instructor,
 * tapping this button isolates the last 30-60 seconds of lecture speech and
 * provides an instant, easy-to-digest explanation with a real-world example.
 */

const MissedThat = {
  isOpen: false,
  isProcessing: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btn = document.getElementById('missedThatBtn');
    if (btn) {
      btn.addEventListener('click', () => this.handleMissedThat());
    }

    const closeBtn = document.getElementById('closeMissedPanelBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    // Keyboard shortcut 'M' to trigger
    window.addEventListener('keydown', (e) => {
      // Avoid triggering when typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'm' || e.key === 'M') {
        this.handleMissedThat();
      }
    });
  },

  async handleMissedThat() {
    const rawSnippet = window.CaptionsEngine ? window.CaptionsEngine.getLastSecondsTranscript(50) : "";
    
    this.openPanel();
    const resultBox = document.getElementById('missedThatContent');
    const snippetPreview = document.getElementById('missedSnippetPreview');

    if (!rawSnippet || rawSnippet.trim().length < 5) {
      if (snippetPreview) snippetPreview.textContent = "No recent speech captured in the last 60 seconds.";
      if (resultBox) {
        resultBox.innerHTML = `
          <div class="empty-missed-state">
            <p>No recent lecture speech detected yet.</p>
            <p class="subtext">Start speaking, record captions, or launch <strong>Demo Mode</strong> to test this feature!</p>
          </div>
        `;
      }
      return;
    }

    if (snippetPreview) {
      snippetPreview.textContent = `"${rawSnippet}"`;
    }

    if (resultBox) {
      resultBox.innerHTML = `
        <div class="missed-loading">
          <div class="ai-sparkle-spinner"></div>
          <p>SignAid AI is simplifying the teacher's last thoughts...</p>
        </div>
      `;
    }

    this.isProcessing = true;

    try {
      const explanation = await this.generateSimpleExplanation(rawSnippet);
      this.renderExplanation(explanation);
    } catch (err) {
      console.warn("Error getting AI explanation:", err);
      const fallback = this.generateOfflineFallback(rawSnippet);
      this.renderExplanation(fallback);
    } finally {
      this.isProcessing = false;
    }
  },

  async generateSimpleExplanation(transcript) {
    const apiKey = window.CONFIG ? window.CONFIG.GEMINI_API_KEY : "";

    // Check if valid key exists
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.trim() === "") {
      return this.generateOfflineFallback(transcript);
    }

    const prompt = `You are SignAid, an accessibility assistant for hearing-impaired students in classrooms.
The student clicked the 'I Missed That' button because the teacher spoke too quickly or unclearly.
Here is what the teacher said in the last 45 seconds:
"${transcript}"

Provide an ultra-clear, simple explanation following this exact HTML structure (do not wrap in markdown quotes):
<div class="missed-card">
  <div class="missed-section">
    <h4>📌 The Core Point</h4>
    <p>[1 clear, direct sentence explaining the main idea]</p>
  </div>
  <div class="missed-section">
    <h4>💡 What You Need To Know</h4>
    <ul>
      <li>[Bullet point 1 in simple plain English]</li>
      <li>[Bullet point 2 in simple plain English]</li>
    </ul>
  </div>
  <div class="missed-section highlight-example">
    <h4>🌟 Real-World Example</h4>
    <p>[1 friendly, intuitive real-world analogy or everyday example]</p>
  </div>
</div>`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${window.CONFIG.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
      })
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidate) {
      // Strip markdown code fences if present
      return candidate.replace(/```html/g, '').replace(/```/g, '').trim();
    }
    throw new Error("No output text received");
  },

  // Intelligent offline fallback based on transcript keywords
  generateOfflineFallback(transcript) {
    const textLower = transcript.toLowerCase();
    
    if (textLower.includes('binary search') || textLower.includes('linear search') || textLower.includes('log')) {
      return `
        <div class="missed-card">
          <div class="missed-section">
            <h4>📌 The Core Point</h4>
            <p>Searching sorted data using Binary Search is astronomically faster than checking items one by one.</p>
          </div>
          <div class="missed-section">
            <h4>💡 What You Need To Know</h4>
            <ul>
              <li><strong>Linear search O(n):</strong> Checks every item from beginning to end (up to 1,000,000 steps).</li>
              <li><strong>Binary search O(log n):</strong> Cuts the list in half each time (only ~20 steps for 1 million items).</li>
              <li><strong>Crucial requirement:</strong> The list must be pre-sorted.</li>
            </ul>
          </div>
          <div class="missed-section highlight-example">
            <h4>🌟 Real-World Example</h4>
            <p>Imagine guessing a number between 1 and 100. If someone says "higher" or "lower", starting at 50 cuts your work in half immediately, rather than guessing 1, 2, 3, 4...</p>
          </div>
        </div>
      `;
    }

    if (textLower.includes('recursion') || textLower.includes('stack')) {
      return `
        <div class="missed-card">
          <div class="missed-section">
            <h4>📌 The Core Point</h4>
            <p>Recursion is a programming technique where a function solves a problem by calling itself on smaller inputs.</p>
          </div>
          <div class="missed-section">
            <h4>💡 What You Need To Know</h4>
            <ul>
              <li>Always need a <strong>Base Condition</strong>: the stopping rule that ends the chain.</li>
              <li>Without a base condition, the program loops indefinitely, causing a <strong>Stack Overflow</strong> crash.</li>
            </ul>
          </div>
          <div class="missed-section highlight-example">
            <h4>🌟 Real-World Example</h4>
            <p>Like Russian Matryoshka nesting dolls: you open a doll to find a smaller one, repeating until you reach the smallest solid doll that cannot be opened.</p>
          </div>
        </div>
      `;
    }

    if (textLower.includes('force') || textLower.includes('newton') || textLower.includes('kinetic')) {
      return `
        <div class="missed-card">
          <div class="missed-section">
            <h4>📌 The Core Point</h4>
            <p>Forces cause objects to accelerate, transferring energy into motion (kinetic energy).</p>
          </div>
          <div class="missed-section">
            <h4>💡 What You Need To Know</h4>
            <ul>
              <li><strong>F = m × a:</strong> Greater mass or acceleration requires greater net force.</li>
              <li><strong>Inertia:</strong> An object keeps doing what it was doing unless pushed or pulled.</li>
            </ul>
          </div>
          <div class="missed-section highlight-example">
            <h4>🌟 Real-World Example</h4>
            <p>When you slam the brakes in a moving car, your body continues flying forward because of inertia until the seatbelt holds you.</p>
          </div>
        </div>
      `;
    }

    // Dynamic extraction fallback for arbitrary lectures
    const words = transcript.split(/\s+/).slice(0, 25).join(' ');
    return `
      <div class="missed-card">
        <div class="missed-section">
          <h4>📌 The Core Point</h4>
          <p>The instructor just discussed: "<em>${words}...</em>"</p>
        </div>
        <div class="missed-section">
          <h4>💡 What You Need To Know</h4>
          <ul>
            <li>Pay special attention to the key definitions introduced in this segment.</li>
            <li>Bookmark this timestamp in your transcript so you can review it before exams!</li>
          </ul>
        </div>
        <div class="missed-section highlight-example">
          <h4>🌟 Quick Action</h4>
          <p>You can ask the <strong>SignAid AI Chatbot</strong> below for a step-by-step breakdown of this specific phrase!</p>
        </div>
      </div>
    `;
  },

  renderExplanation(html) {
    const resultBox = document.getElementById('missedThatContent');
    if (resultBox) {
      resultBox.innerHTML = html;
    }
  },

  openPanel() {
    this.isOpen = true;
    const panel = document.getElementById('missedThatPanel');
    const overlay = document.getElementById('missedThatOverlay');
    if (panel) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
    }
    if (overlay) {
      overlay.classList.add('open');
    }
  },

  closePanel() {
    this.isOpen = false;
    const panel = document.getElementById('missedThatPanel');
    const overlay = document.getElementById('missedThatOverlay');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
    if (overlay) {
      overlay.classList.remove('open');
    }
  }
};

window.MissedThat = MissedThat;
MissedThat.init();
