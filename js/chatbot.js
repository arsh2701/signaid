/**
 * SignAid AI - Aura Classroom Doubts Chatbot
 * Context-aware AI teaching assistant that uses the live lecture transcript
 * as its grounding context to resolve student doubts in real-time.
 */

const Chatbot = {
  isOpen: false,
  messages: [],
  isTyping: false,
  storageKey: "signaid_chat_history_v1",

  init() {
    this.loadMessages();
    this.bindEvents();
    if (this.messages.length === 0) {
      this.addBotMessage(
        "👋 Hi! I'm **Aura**, your SignAid classroom companion. I listen along with your live captions. Ask me any doubt about what the teacher just said, or tap a quick chip below!"
      );
    } else {
      this.renderMessages();
    }
  },

  bindEvents() {
    const trigger = document.getElementById('chatbotFabTrigger');
    if (trigger) {
      trigger.addEventListener('click', () => this.toggleChat());
    }

    const closeBtn = document.getElementById('closeChatbotBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeChat());
    }

    const form = document.getElementById('chatbotForm');
    const input = document.getElementById('chatbotInput');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          input.value = '';
          this.sendUserQuery(text);
        }
      });
    }

    // Quick chips
    const chips = document.querySelectorAll('.chat-quick-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query) {
          this.sendUserQuery(query);
        }
      });
    });

    const clearChatBtn = document.getElementById('clearChatHistoryBtn');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        this.messages = [];
        this.saveMessages();
        this.addBotMessage("Chat history cleared. How can I assist you with today's lecture?");
      });
    }
  },

  toggleChat() {
    if (this.isOpen) this.closeChat();
    else this.openChat();
  },

  openChat() {
    this.isOpen = true;
    const modal = document.getElementById('chatbotWidgetModal');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    const badge = document.getElementById('chatUnreadBadge');
    if (badge) badge.classList.add('hidden');
    
    // Auto focus input
    setTimeout(() => {
      const input = document.getElementById('chatbotInput');
      if (input) input.focus();
    }, 200);

    this.scrollToBottom();
  },

  closeChat() {
    this.isOpen = false;
    const modal = document.getElementById('chatbotWidgetModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  async sendUserQuery(text) {
    if (!text || !text.trim()) return;

    this.addUserMessage(text);
    this.showTypingIndicator();

    const transcript = window.CaptionsEngine ? window.CaptionsEngine.getAllTranscriptText() : "";

    try {
      const response = await this.queryGeminiAI(text, transcript);
      this.hideTypingIndicator();
      this.addBotMessage(response);
    } catch (err) {
      console.warn("Chatbot Gemini API call failed or offline, using rule-based fallback:", err);
      this.hideTypingIndicator();
      const fallbackReply = this.generateFallbackResponse(text, transcript);
      this.addBotMessage(fallbackReply);
    }
  },

  async queryGeminiAI(userQuery, transcript) {
    const apiKey = window.CONFIG ? window.CONFIG.GEMINI_API_KEY : "";
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.trim() === "") {
      return this.generateFallbackResponse(userQuery, transcript);
    }

    const systemPrompt = `You are Aura, an empathetic, highly knowledgeable AI classroom assistant designed for deaf and hard-of-hearing students.
Here is the live transcript of the lecture so far:
"""
${transcript || "No lecture speech recorded yet."}
"""

Guidelines:
1. Provide concise, friendly answers in markdown (use bolding and clean bullet points).
2. Answer the student's question directly based on what the teacher explained in the lecture transcript.
3. If the teacher hasn't covered that topic yet, give a brief, accessible explanation of the concept and gently mention it wasn't heard in the lecture yet.
4. Keep answers readable, encouraging, and easy to skim.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${window.CONFIG.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nStudent Question: ${userQuery}` }] }
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 }
      })
    });

    if (!response.ok) throw new Error(`API HTTP ${response.status}`);
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) return reply;
    throw new Error("No answer generated");
  },

  generateFallbackResponse(query, transcript) {
    const qLower = query.toLowerCase();

    // Site guide
    if (qLower.includes('how to use') || qLower.includes('help') || qLower.includes('features')) {
      return `Here is a quick guide to **SignAid**:
- 🎙️ **Live Captions:** Click **Start Captions** or try **Demo Mode** for an instant realistic lecture.
- ⚡ **"I Missed That":** Tap this whenever the teacher speaks too fast for an instant simple re-explanation.
- 🔍 **Keywords:** Tap on highlighted terms like *Algorithm* or *Recursion* to view instant definitions.
- 🚨 **Sound Alerts:** Web Audio detects loud claps, door slams, or alerts and visually notifies you.
- 👥 **Teacher-Student Sync:** Open two browser tabs and sync live using the classroom room code!
- 📝 **Study Kit:** Scroll to the bottom to view generated flashcards, summary, and a 5-question quiz!`;
    }

    // Summarize
    if (qLower.includes('summarize') || qLower.includes('summary')) {
      if (transcript.toLowerCase().includes('binary search') || transcript.toLowerCase().includes('big-o')) {
        return `**Lecture Summary So Far:**
- The teacher is explaining **computational efficiency** and **Big-O notation**.
- **Binary Search** was compared to **Linear Search**—showing that on 1,000,000 items, binary search takes only ~20 operations versus up to 1,000,000.
- **Recursion** was introduced, noting that a **base condition** is mandatory to prevent a **stack overflow** crash.`;
      }
      return `**Current Session Summary:**
The teacher has been discussing key theoretical concepts. You have recorded **${window.CaptionsEngine?.transcriptHistory.length || 0} captions** so far. You can scroll down to the **Study Kit** section for full flashcards and an AI summary!`;
    }

    // Recursion
    if (qLower.includes('recursion') || qLower.includes('recursive')) {
      return `**What the teacher said about Recursion:**
- The instructor defined recursion as **a function calling itself** to solve smaller pieces of a problem.
- **Crucial point:** It must have a **base condition** (stopping rule), otherwise your computer runs out of call stack memory resulting in a **stack overflow error**!
- Common examples mentioned: Merge sort, quicksort, and graph traversals.`;
    }

    // Binary search / Big O
    if (qLower.includes('binary search') || qLower.includes('linear search') || qLower.includes('big o') || qLower.includes('big-o')) {
      return `**Binary Search vs Linear Search:**
- **Linear Search:** O(n) — checks every single element one by one.
- **Binary Search:** O(log n) — cuts the search space in half at each comparison, requiring pre-sorted items.
- *Fun fact from teacher:* For 1 million sorted items, binary search takes at most **20 comparisons**!`;
    }

    // Explain simply
    if (qLower.includes('explain simply') || qLower.includes('simple')) {
      return `**Simple Breakdown of the Last Point:**
The teacher is explaining why choosing the right algorithm matters. Even if a computer is super fast, inefficient code (like checking 1 million things one-by-one) causes lag, whereas smart algorithms (like binary search) give instant answers in milliseconds!`;
    }

    // Quiz me
    if (qLower.includes('quiz') || qLower.includes('question')) {
      return `**Quick Practice Question:**
*What stops a recursive function from calling itself infinitely?*
A) Time Complexity
B) A Base Condition
C) A Linear Search
*(Hint: Look at the base condition definition in your Study Kit!)*`;
    }

    // Default intelligent conversational response
    return `That's a great question regarding **${query}**!
Based on the live classroom transcript, the instructor is covering foundational concepts. Make sure to star (bookmark) the timestamp in your captions to review during exam prep. Feel free to ask me to summarize or simplify any specific term!`;
  },

  addUserMessage(text) {
    const msg = { sender: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    this.messages.push(msg);
    this.saveMessages();
    this.renderMessages();
  },

  addBotMessage(markdownText) {
    const msg = { sender: 'bot', text: markdownText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    this.messages.push(msg);
    this.saveMessages();
    this.renderMessages();

    // Show unread badge if chat is closed
    if (!this.isOpen) {
      const badge = document.getElementById('chatUnreadBadge');
      if (badge) badge.classList.remove('hidden');
    }
  },

  renderMessages() {
    const container = document.getElementById('chatbotMessagesContainer');
    if (!container) return;

    container.innerHTML = this.messages.map(m => {
      const formatted = this.parseMarkdown(m.text);
      if (m.sender === 'user') {
        return `
          <div class="chat-bubble-row user-row">
            <div class="chat-bubble user-bubble">
              <div class="bubble-content">${formatted}</div>
              <span class="bubble-timestamp">${m.time}</span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="chat-bubble-row bot-row">
            <div class="bot-avatar-tiny">✨</div>
            <div class="chat-bubble bot-bubble">
              <div class="bubble-content">${formatted}</div>
              <span class="bubble-timestamp">${m.time}</span>
            </div>
          </div>
        `;
      }
    }).join('');

    this.scrollToBottom();
  },

  showTypingIndicator() {
    this.isTyping = true;
    const container = document.getElementById('chatbotMessagesContainer');
    if (!container) return;

    let indicator = document.getElementById('chatTypingIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chatTypingIndicator';
      indicator.className = 'chat-bubble-row bot-row typing-row';
      indicator.innerHTML = `
        <div class="bot-avatar-tiny">✨</div>
        <div class="chat-bubble bot-bubble typing-bubble">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      `;
      container.appendChild(indicator);
    }
    this.scrollToBottom();
  },

  hideTypingIndicator() {
    this.isTyping = false;
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();
  },

  scrollToBottom() {
    const container = document.getElementById('chatbotMessagesContainer');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  },

  parseMarkdown(str) {
    if (!str) return '';
    let html = str
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Bullet points
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      // Newlines
      .replace(/\n/g, '<br>');

    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    // Clean redundant <br> inside lists
    html = html.replace(/<\/li><br>/g, '</li>');
    return html;
  },

  saveMessages() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.messages.slice(-25)));
    } catch (e) {
      console.warn("Could not save chat messages:", e);
    }
  },

  loadMessages() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.messages = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not load chat messages:", e);
    }
  }
};

window.Chatbot = Chatbot;
Chatbot.init();
