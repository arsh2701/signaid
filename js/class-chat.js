/**
 * SignAid AI - Real-Time Class Group Chat
 * Multi-user classroom chat allowing teachers and students to communicate in real time.
 * Distinct from Aura AI Assistant.
 */

const ClassChat = {
  isOpen: false,
  unreadCount: 0,
  messages: [],
  maxChars: 300,

  init() {
    this.bindDOM();
  },

  openChat() {
    this.isOpen = true;
    this.unreadCount = 0;
    this.updateUnreadBadge();

    const panel = document.getElementById('classChatPanel');
    const overlay = document.getElementById('classChatOverlay');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');

    this.scrollToBottom();

    // Auto-focus input
    setTimeout(() => {
      document.getElementById('classChatInput')?.focus();
    }, 150);
  },

  closeChat() {
    this.isOpen = false;
    const panel = document.getElementById('classChatPanel');
    const overlay = document.getElementById('classChatOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  toggleChat() {
    if (this.isOpen) this.closeChat();
    else this.openChat();
  },

  sendMessage(text) {
    const raw = (text || "").trim();
    if (!raw) return;

    if (raw.length > this.maxChars) {
      alert(`Message exceeds max limit of ${this.maxChars} characters.`);
      return;
    }

    const user = (window.AuthManager && window.AuthManager.currentUser) || {
      uid: "usr_guest",
      name: "Guest",
      role: "student",
      roomCode: "CS-101"
    };

    const msgObj = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      uid: user.uid,
      sender: user.name || "Student",
      role: user.role || "student",
      text: raw,
      timestamp: Date.now()
    };

    // Push to Firebase if connected
    if (window.SyncManager && window.SyncManager.isFirebaseActive && window.SyncManager.firebaseDb) {
      try {
        window.SyncManager.firebaseDb.ref(`classes/${user.roomCode}/chat`).push(msgObj);
      } catch (err) {
        console.warn("Firebase chat send error:", err);
      }
    } else if (window.SyncManager) {
      // Local broadcast fallback
      window.SyncManager.sendBroadcast({
        type: 'chat_message',
        data: msgObj
      });
      // Append own message locally
      this.receiveMessage(msgObj);
    }
  },

  receiveMessage(msg) {
    if (!msg || !msg.id) return;
    
    // Prevent duplicate entries
    if (this.messages.some(m => m.id === msg.id)) return;

    this.messages.push(msg);
    this.renderMessage(msg);

    const myUid = window.AuthManager && window.AuthManager.currentUser.uid;
    const isFromMe = msg.uid === myUid;

    if (!isFromMe) {
      if (!this.isOpen) {
        this.unreadCount++;
        this.updateUnreadBadge();
      }
      this.playMessageSound();
    }

    this.scrollToBottom();
  },

  renderMessage(msg) {
    const container = document.getElementById('classChatMessagesContainer');
    if (!container) return;

    const myUid = window.AuthManager && window.AuthManager.currentUser.uid;
    const isFromMe = msg.uid === myUid;
    const safeText = this.escapeHtml(msg.text);
    const timeFormatted = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubbleHtml = `
      <div class="chat-msg-row ${isFromMe ? 'own' : 'other'}" id="${msg.id}">
        <div class="chat-msg-bubble">
          <div class="chat-msg-header">
            <span class="chat-msg-sender">${this.escapeHtml(msg.sender)}</span>
            <span class="chat-msg-role-pill ${msg.role}">${msg.role}</span>
            <span class="chat-msg-time">${timeFormatted}</span>
          </div>
          <div class="chat-msg-body">${safeText}</div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', bubbleHtml);
  },

  updateUnreadBadge() {
    const badge = document.getElementById('classChatUnreadBadge');
    if (!badge) return;
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  scrollToBottom() {
    const container = document.getElementById('classChatMessagesContainer');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  },

  playMessageSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {
      // AudioContext unavailable
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  bindDOM() {
    // Open / Close triggers
    const openBtn = document.getElementById('openClassChatBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.toggleChat());
    }

    const closeBtn = document.getElementById('closeClassChatBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeChat());
    }

    const overlay = document.getElementById('classChatOverlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeChat());
    }

    // Input form
    const form = document.getElementById('classChatForm');
    const input = document.getElementById('classChatInput');
    const charCounter = document.getElementById('classChatCharCounter');

    if (input && charCounter) {
      input.addEventListener('input', () => {
        const remaining = this.maxChars - input.value.length;
        charCounter.textContent = `${input.value.length}/${this.maxChars}`;
        charCounter.style.color = remaining < 20 ? 'var(--accent-rose)' : 'var(--text-muted)';
      });
    }

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          input.value = '';
          if (charCounter) charCounter.textContent = `0/${this.maxChars}`;
          this.sendMessage(text);
        }
      });
    }
  }
};

window.ClassChat = ClassChat;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ClassChat.init());
} else {
  ClassChat.init();
}
