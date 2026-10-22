/**
 * SignAid AI - Multi-Device Classroom Sync Engine
 * Real-time synchronization via Firebase Realtime Database with zero-friction
 * automatic fallback to Web BroadcastChannel API.
 * Synchronizes:
 * - Live Captions & Sound Alerts
 * - Presence & Online Student List (onDisconnect)
 * - Raised Hand Alerts
 * - Class Group Chat
 * - Live Understanding Polls
 * - Pinned Teacher Announcements
 * - Anonymous "Slow Down" Classroom Signals
 * - Class End Study Kit Trigger
 */

const SyncManager = {
  isFirebaseActive: false,
  firebaseDb: null,
  classRef: null,
  broadcastChannel: null,
  
  role: 'student', // 'teacher' | 'student'
  roomCode: 'CS-101',
  userName: 'Guest',
  userId: null,
  
  // Local state caches
  onlineStudents: new Map(),
  activeHandRaises: new Map(),
  slowDownCount: 0,
  slowDownVoted: false,
  currentPinnedMessage: null,
  currentPoll: null,

  init() {
    this.userId = (window.AuthManager && window.AuthManager.currentUser.uid) || "usr_" + Math.random().toString(36).substring(2, 9);
    this.role = (window.AuthManager && window.AuthManager.currentUser.role) || "student";
    this.userName = (window.AuthManager && window.AuthManager.currentUser.name) || "Guest";
    this.roomCode = (window.AuthManager && window.AuthManager.currentUser.roomCode) || "CS-101";

    this.setupBroadcastChannel();
    this.initFirebase();
    this.bindDOM();
  },

  onUserJoined(user) {
    this.userId = user.uid;
    this.role = user.role;
    this.userName = user.name;
    this.roomCode = user.roomCode;
    
    this.updateRoleUI();

    if (this.isFirebaseActive) {
      this.attachFirebaseListeners();
    } else {
      this.broadcastLocalPresence('join');
    }
  },

  // =========================================================================
  // Firebase Realtime Database Initialization & Handlers
  // =========================================================================
  initFirebase() {
    const cfg = window.CONFIG && window.CONFIG.FIREBASE_CONFIG;
    const isPlaceholder = !cfg || !cfg.apiKey || cfg.apiKey === "YOUR_FIREBASE_API_KEY" || cfg.apiKey.trim() === "";

    if (isPlaceholder) {
      console.info("Firebase config is using placeholders. SignAid is running in Local Fallback Mode (BroadcastChannel).");
      this.activateLocalFallback("⚠️ Running in Local Fallback Mode (BroadcastChannel). Multi-device sync across different phones/laptops requires Firebase credentials in config.js.");
      return;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.warn("Firebase SDK script not loaded yet. Waiting...");
        setTimeout(() => this.initFirebase(), 800);
        return;
      }

      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(cfg);
      }
      this.firebaseDb = firebase.database();
      this.isFirebaseActive = true;
      this.hideFallbackBanner();
      this.updateConnectionBadge(true);

      if (this.roomCode) {
        this.attachFirebaseListeners();
      }
    } catch (err) {
      console.warn("Firebase initialization error, switching to BroadcastChannel:", err);
      this.activateLocalFallback("⚠️ Firebase connection failed. Reverted to Local Fallback Mode (BroadcastChannel).");
    }
  },

  attachFirebaseListeners() {
    if (!this.isFirebaseActive || !this.firebaseDb || !this.roomCode) return;

    const classPath = `classes/${this.roomCode}`;
    this.classRef = this.firebaseDb.ref(classPath);

    // 1. Presence (Students & Teacher)
    const connectedRef = this.firebaseDb.ref(".info/connected");
    const myPresenceRef = this.firebaseDb.ref(`${classPath}/students/${this.userId}`);

    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        myPresenceRef.onDisconnect().remove();
        myPresenceRef.set({
          uid: this.userId,
          name: this.userName,
          role: this.role,
          joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
        this.updateConnectionBadge(true);
      } else {
        this.updateConnectionBadge(false);
      }
    });

    // Listen to online student list
    this.firebaseDb.ref(`${classPath}/students`).on("value", (snap) => {
      const data = snap.val() || {};
      this.onlineStudents.clear();
      Object.keys(data).forEach(k => {
        this.onlineStudents.set(k, data[k]);
      });
      this.renderOnlineStudents();
    });

    // 2. Captions stream
    this.firebaseDb.ref(`${classPath}/captions`).limitToLast(40).on("child_added", (snap) => {
      const entry = snap.val();
      if (!entry) return;
      if (this.role === 'student') {
        if (window.ClassroomManager && !window.ClassroomManager.isCurrentStudentApproved()) {
          return; // Gated: Live captions only accessible to approved students
        }
        const exists = window.CaptionsEngine && window.CaptionsEngine.transcriptHistory.some(i => i.id === entry.id);
        if (!exists && window.CaptionsEngine) {
          window.CaptionsEngine.transcriptHistory.push(entry);
          window.CaptionsEngine.renderTranscript();
          window.CaptionsEngine.updatePulseMetrics();
        }
      }
    });

    // 3. Hand raises
    this.firebaseDb.ref(`${classPath}/handRaises`).on("value", (snap) => {
      const data = snap.val() || {};
      this.activeHandRaises.clear();
      Object.keys(data).forEach(k => {
        this.activeHandRaises.set(k, data[k]);
      });
      this.renderHandRaises();
    });

    // 4. Group Chat
    this.firebaseDb.ref(`${classPath}/chat`).limitToLast(50).on("child_added", (snap) => {
      const msg = snap.val();
      if (msg && window.ClassChat) {
        window.ClassChat.receiveMessage(msg);
      }
    });

    // 5. Live Poll
    this.firebaseDb.ref(`${classPath}/poll`).on("value", (snap) => {
      const pollData = snap.val();
      this.currentPoll = pollData;
      this.handlePollUpdate(pollData);
    });

    // 6. Pinned Announcement
    this.firebaseDb.ref(`${classPath}/pinned`).on("value", (snap) => {
      const pinned = snap.val();
      this.currentPinnedMessage = pinned;
      this.renderPinnedAnnouncement(pinned);
    });

    // 7. Slow Down Signals
    this.firebaseDb.ref(`${classPath}/signals/slowDown`).on("value", (snap) => {
      const data = snap.val() || {};
      this.slowDownCount = Object.keys(data).length;
      this.renderSlowDownCount();
    });

    // 8. Class Status (End Class event)
    this.firebaseDb.ref(`${classPath}/status`).on("value", (snap) => {
      const status = snap.val();
      if (status === 'ended' && this.role === 'student') {
        this.handleClassEndedEvent();
      }
    });

    // 9. Classroom Join Requests (Real-Time Firebase)
    this.firebaseDb.ref(`${classPath}/requests`).on("value", (snap) => {
      const data = snap.val() || {};
      if (window.ClassroomManager) {
        Object.values(data).forEach(req => window.ClassroomManager.joinRequests.set(req.id, req));
        window.ClassroomManager.saveToStorage();
        window.ClassroomManager.updateTeacherUI();
        window.ClassroomManager.checkCurrentStudentStatus();
      }
    });

    // 10. Approved Students Roster (Real-Time Firebase)
    this.firebaseDb.ref(`${classPath}/approvedStudents`).on("value", (snap) => {
      const data = snap.val() || {};
      if (window.ClassroomManager) {
        const cls = window.ClassroomManager.getClassroomByCode(this.roomCode);
        if (cls) {
          let studentMap = window.ClassroomManager.approvedStudents.get(cls.id);
          if (!studentMap) {
            studentMap = new Map();
            window.ClassroomManager.approvedStudents.set(cls.id, studentMap);
          }
          studentMap.clear();
          Object.values(data).forEach(st => studentMap.set(st.student_id, st));
          window.ClassroomManager.saveToStorage();
          window.ClassroomManager.updateTeacherUI();
          window.ClassroomManager.checkCurrentStudentStatus();
        }
      }
    });
  },

  // =========================================================================
  // BroadcastChannel Local Cross-Tab Fallback
  // =========================================================================
  setupBroadcastChannel() {
    if (!('BroadcastChannel' in window)) return;
    try {
      const chName = (window.CONFIG && window.CONFIG.BROADCAST_CHANNEL_NAME) || "signaid_classroom_sync_v2";
      this.broadcastChannel = new BroadcastChannel(chName);
      this.broadcastChannel.onmessage = (event) => this.handleBroadcastMessage(event.data);
    } catch (e) {
      console.warn("BroadcastChannel initialization warning:", e);
    }
  },

  broadcastLocalPresence(action = 'join') {
    this.sendBroadcast({
      type: 'presence_local',
      action: action,
      user: {
        uid: this.userId,
        name: this.userName,
        role: this.role
      }
    });
  },

  handleBroadcastMessage(msg) {
    if (!msg) return;

    // Handle Classroom Manager real-time join requests & updates
    if (['join_request_created', 'join_request_action', 'classroom_updated', 'student_removed_from_class'].includes(msg.type)) {
      if (window.ClassroomManager) {
        window.ClassroomManager.handleIncomingSyncMessage(msg);
      }
      return;
    }

    if (msg.roomCode !== this.roomCode) return;

    switch (msg.type) {
      case 'caption':
        if (this.role === 'student') {
          if (window.ClassroomManager && !window.ClassroomManager.isCurrentStudentApproved()) {
            return; // Gated: Live captions only accessible to approved students
          }
          const entry = msg.data;
          const exists = window.CaptionsEngine && window.CaptionsEngine.transcriptHistory.some(i => i.id === entry.id);
          if (!exists && window.CaptionsEngine) {
            window.CaptionsEngine.transcriptHistory.push(entry);
            window.CaptionsEngine.renderTranscript();
            window.CaptionsEngine.updatePulseMetrics();
          }
        }
        break;

      case 'presence_local':
        if (msg.action === 'join') {
          this.onlineStudents.set(msg.user.uid, msg.user);
          this.showToast(`👋 ${msg.user.name} joined the class`, "info");
        } else if (msg.action === 'leave') {
          this.onlineStudents.delete(msg.user.uid);
        }
        this.renderOnlineStudents();
        break;

      case 'hand_raise':
        this.activeHandRaises.set(msg.data.id, msg.data);
        this.renderHandRaises();
        if (this.role === 'teacher') {
          this.showToast(`✋ ${msg.data.studentName} raised their hand!`, "warning");
          this.playAlertSound();
        }
        break;

      case 'dismiss_hand':
        this.activeHandRaises.delete(msg.id);
        this.renderHandRaises();
        break;

      case 'chat_message':
        if (window.ClassChat) {
          window.ClassChat.receiveMessage(msg.data);
        }
        break;

      case 'poll_update':
        this.currentPoll = msg.data;
        this.handlePollUpdate(msg.data);
        break;

      case 'pin_message':
        this.currentPinnedMessage = msg.data;
        this.renderPinnedAnnouncement(msg.data);
        break;

      case 'slow_down_signal':
        this.slowDownCount = msg.count;
        this.renderSlowDownCount();
        break;

      case 'class_ended':
        if (this.role === 'student') {
          this.handleClassEndedEvent();
        }
        break;
    }
  },

  sendBroadcast(payload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          ...payload,
          roomCode: this.roomCode,
          senderTime: Date.now()
        });
      } catch (err) {
        console.warn("BroadcastChannel error:", err);
      }
    }
  },

  // =========================================================================
  // Dispatchers (Handles both Firebase & BroadcastChannel)
  // =========================================================================
  broadcastCaption(entry) {
    if (this.role !== 'teacher') return;

    if (this.isFirebaseActive && this.firebaseDb) {
      try {
        this.firebaseDb.ref(`classes/${this.roomCode}/captions`).push(entry);
      } catch (e) {
        console.warn("Firebase caption push error:", e);
      }
    }
    // Always dispatch locally too for seamless dual-operation
    this.sendBroadcast({ type: 'caption', data: entry });
  },

  raiseHand() {
    const handId = "hand_" + this.userId;
    const handData = {
      id: handId,
      uid: this.userId,
      studentName: this.userName,
      timestamp: Date.now()
    };

    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/handRaises/${handId}`).set(handData);
    }
    this.sendBroadcast({ type: 'hand_raise', data: handData });
    this.showToast("✋ Hand raised! The instructor has been notified.", "success");

    // Temporarily disable button to avoid spam
    const handBtn = document.getElementById('studentRaiseHandBtn');
    if (handBtn) {
      handBtn.classList.add('active');
      handBtn.textContent = "✋ Hand Raised!";
      setTimeout(() => {
        handBtn.classList.remove('active');
        handBtn.textContent = "✋ Raise Hand";
      }, 4000);
    }
  },

  dismissHandRaise(id) {
    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/handRaises/${id}`).remove();
    }
    this.activeHandRaises.delete(id);
    this.renderHandRaises();
    this.sendBroadcast({ type: 'dismiss_hand', id: id });
  },

  sendSlowDownSignal() {
    if (this.slowDownVoted) {
      this.showToast("You already requested to slow down.", "info");
      return;
    }
    this.slowDownVoted = true;

    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/signals/slowDown/${this.userId}`).set(Date.now());
    } else {
      this.slowDownCount++;
      this.sendBroadcast({ type: 'slow_down_signal', count: this.slowDownCount });
    }

    const btn = document.getElementById('studentSlowDownBtn');
    if (btn) {
      btn.classList.add('active');
      btn.textContent = "🐢 Signal Sent!";
    }
    this.showToast("Anonymous slow-down signal sent to teacher.", "info");
  },

  pinMessage(text) {
    const payload = {
      text: text.trim(),
      author: this.userName,
      timestamp: Date.now()
    };

    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/pinned`).set(payload);
    }
    this.currentPinnedMessage = payload;
    this.renderPinnedAnnouncement(payload);
    this.sendBroadcast({ type: 'pin_message', data: payload });
    this.showToast("Announcement pinned on students' screens.", "success");
  },

  unpinMessage() {
    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/pinned`).remove();
    }
    this.currentPinnedMessage = null;
    this.renderPinnedAnnouncement(null);
    this.sendBroadcast({ type: 'pin_message', data: null });
  },

  createPoll(question, options = ["Yes, fully understood", "No, please explain"]) {
    const pollData = {
      id: "poll_" + Date.now(),
      question,
      options,
      votes: {},
      active: true,
      createdAt: Date.now()
    };

    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/poll`).set(pollData);
    }
    this.currentPoll = pollData;
    this.handlePollUpdate(pollData);
    this.sendBroadcast({ type: 'poll_update', data: pollData });
    this.showToast("Live understanding poll launched!", "success");
  },

  submitVote(optionIndex) {
    if (!this.currentPoll || !this.currentPoll.active) return;
    
    if (this.isFirebaseActive && this.firebaseDb) {
      this.firebaseDb.ref(`classes/${this.roomCode}/poll/votes/${this.userId}`).set(optionIndex);
    } else {
      if (!this.currentPoll.votes) this.currentPoll.votes = {};
      this.currentPoll.votes[this.userId] = optionIndex;
      this.sendBroadcast({ type: 'poll_update', data: this.currentPoll });
      this.handlePollUpdate(this.currentPoll);
    }
    this.showToast("Vote recorded! Thank you for the feedback.", "success");
  },

  endClass() {
    if (confirm("Are you sure you want to end this class? All students will receive their post-class Study Kit.")) {
      if (this.isFirebaseActive && this.firebaseDb) {
        this.firebaseDb.ref(`classes/${this.roomCode}/status`).set('ended');
      }
      this.sendBroadcast({ type: 'class_ended' });
      this.showToast("Class ended. Generating post-class learning materials...", "info");

      // Teacher also views study kit
      setTimeout(() => {
        if (window.StudyKit) {
          window.StudyKit.generateKit();
          const target = document.getElementById('studykit');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  },

  handleClassEndedEvent() {
    this.showToast("🎓 Class has ended! Your AI Study Kit has been generated.", "success");
    const banner = document.getElementById('classEndedAlertBanner');
    if (banner) banner.classList.remove('hidden');

    setTimeout(() => {
      if (window.StudyKit) {
        window.StudyKit.generateKit();
        const target = document.getElementById('studykit');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 1200);
  },

  // =========================================================================
  // UI Rendering Helpers
  // =========================================================================
  renderOnlineStudents() {
    const countElem = document.getElementById('onlineStudentCountDisplay');
    const listElem = document.getElementById('onlineStudentsListContainer');
    const meetingCount = document.getElementById('meetingParticipantsCountBadge');

    const total = this.onlineStudents.size;
    if (countElem) countElem.textContent = `${total} Online`;
    if (meetingCount) meetingCount.textContent = `${total} in room`;

    if (listElem) {
      if (total === 0) {
        listElem.innerHTML = `<span class="empty-list-notice">No other students connected yet.</span>`;
        return;
      }

      listElem.innerHTML = Array.from(this.onlineStudents.values()).map(stu => `
        <div class="online-student-pill">
          <span class="status-indicator online"></span>
          <span class="student-name">${this.escapeHtml(stu.name)}</span>
          <span class="role-subscript">${stu.role}</span>
        </div>
      `).join('');
    }
  },

  renderHandRaises() {
    const container = document.getElementById('raisedHandsContainer');
    const badge = document.getElementById('handRaiseNotificationBadge');
    const total = this.activeHandRaises.size;

    if (badge) {
      if (total > 0) {
        badge.textContent = `${total} ✋`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (container) {
      if (total === 0) {
        container.innerHTML = `<div class="empty-hands-msg">No active hand raises.</div>`;
        return;
      }

      container.innerHTML = Array.from(this.activeHandRaises.values()).map(h => `
        <div class="hand-raise-alert-card">
          <div class="hand-info">
            <span class="hand-icon">✋</span>
            <strong>${this.escapeHtml(h.studentName)}</strong> wants to ask a question!
          </div>
          ${this.role === 'teacher' ? `
            <button class="btn btn-sm btn-secondary" onclick="SyncManager.dismissHandRaise('${h.id}')">
              Acknowledge ✓
            </button>
          ` : ''}
        </div>
      `).join('');
    }
  },

  renderSlowDownCount() {
    const counterDisplay = document.getElementById('teacherSlowDownCount');
    const alertBanner = document.getElementById('teacherSlowDownAlert');

    if (counterDisplay) {
      counterDisplay.textContent = this.slowDownCount;
    }

    if (alertBanner && this.role === 'teacher') {
      if (this.slowDownCount >= 3) {
        alertBanner.classList.remove('hidden');
        this.playAlertSound();
      } else {
        alertBanner.classList.add('hidden');
      }
    }
  },

  renderPinnedAnnouncement(pinned) {
    const banner = document.getElementById('pinnedAnnouncementBanner');
    const textSpan = document.getElementById('pinnedAnnouncementText');

    if (!banner || !textSpan) return;

    if (pinned && pinned.text) {
      textSpan.textContent = `📌 [Pinned by ${pinned.author}]: "${pinned.text}"`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  },

  handlePollUpdate(poll) {
    const pollModal = document.getElementById('livePollModal');
    const pollQuestion = document.getElementById('livePollQuestion');
    const pollOptionsBox = document.getElementById('livePollOptions');
    const pollChart = document.getElementById('livePollResultsChart');

    if (!poll || !poll.active) {
      if (pollModal) pollModal.classList.remove('open');
      return;
    }

    if (pollQuestion) pollQuestion.textContent = poll.question;

    // Calculate votes
    const votes = poll.votes || {};
    const totalVotes = Object.keys(votes).length;
    const voteCounts = (poll.options || []).map((_, idx) => {
      return Object.values(votes).filter(v => v === idx).length;
    });

    const hasVoted = votes[this.userId] !== undefined;

    if (this.role === 'teacher' || hasVoted) {
      // Show results bar chart
      if (pollOptionsBox) pollOptionsBox.classList.add('hidden');
      if (pollChart) {
        pollChart.classList.remove('hidden');
        pollChart.innerHTML = (poll.options || []).map((opt, idx) => {
          const count = voteCounts[idx] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return `
            <div class="poll-bar-row">
              <div class="poll-bar-label">
                <span>${opt}</span>
                <strong>${count} (${pct}%)</strong>
              </div>
              <div class="poll-progress-track">
                <div class="poll-progress-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('') + `<div class="poll-total-votes">Total responses: ${totalVotes}</div>`;
      }
    } else {
      // Student vote buttons
      if (pollChart) pollChart.classList.add('hidden');
      if (pollOptionsBox) {
        pollOptionsBox.classList.remove('hidden');
        pollOptionsBox.innerHTML = (poll.options || []).map((opt, idx) => `
          <button class="poll-vote-btn" onclick="SyncManager.submitVote(${idx})">
            ${opt}
          </button>
        `).join('');
      }
    }

    if (pollModal) pollModal.classList.add('open');
  },

  updateRoleUI() {
    const roleBadge = document.getElementById('syncRoleBadge');
    const roomCodeDisplay = document.getElementById('currentRoomCodeDisplay');
    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode;
    if (roleBadge) {
      roleBadge.textContent = this.role === 'teacher' ? 'Teacher Mode' : 'Student Mode';
      roleBadge.className = `sync-role-badge ${this.role}`;
    }
  },

  activateLocalFallback(msg) {
    this.isFirebaseActive = false;
    const banner = document.getElementById('firebaseFallbackBanner');
    const textSpan = document.getElementById('firebaseFallbackText');
    if (banner && textSpan) {
      textSpan.textContent = msg;
      banner.classList.remove('hidden');
    }
    this.updateConnectionBadge(true); // connected to local fallback
  },

  hideFallbackBanner() {
    const banner = document.getElementById('firebaseFallbackBanner');
    if (banner) banner.classList.add('hidden');
  },

  updateConnectionBadge(isConnected) {
    const badge = document.getElementById('networkConnectionBadge');
    if (!badge) return;
    if (isConnected) {
      badge.innerHTML = `<span class="dot connected"></span> Connected`;
      badge.className = "connection-badge online";
    } else {
      badge.innerHTML = `<span class="dot reconnecting"></span> Reconnecting...`;
      badge.className = "connection-badge reconnecting";
    }
  },

  playAlertSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch (e) {
      // AudioContext muted/unsupported
    }
  },

  showToast(msg, type = "info") {
    if (window.CaptionsEngine) {
      window.CaptionsEngine.showNotice(msg, type);
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
    // Student Raise Hand Button
    const raiseHandBtn = document.getElementById('studentRaiseHandBtn');
    if (raiseHandBtn) {
      raiseHandBtn.addEventListener('click', () => this.raiseHand());
    }

    // Student Slow Down Button
    const slowDownBtn = document.getElementById('studentSlowDownBtn');
    if (slowDownBtn) {
      slowDownBtn.addEventListener('click', () => this.sendSlowDownSignal());
    }

    // Teacher Pin Message Form
    const pinForm = document.getElementById('teacherPinMessageForm');
    const pinInput = document.getElementById('teacherPinInput');
    if (pinForm && pinInput) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (pinInput.value.trim()) {
          this.pinMessage(pinInput.value);
          pinInput.value = '';
        }
      });
    }

    const unpinBtn = document.getElementById('teacherUnpinBtn');
    if (unpinBtn) {
      unpinBtn.addEventListener('click', () => this.unpinMessage());
    }

    // Teacher Launch Quick Poll Buttons
    const launchQuickPollBtn = document.getElementById('teacherLaunchQuickPollBtn');
    if (launchQuickPollBtn) {
      launchQuickPollBtn.addEventListener('click', () => {
        this.createPoll("Do you understand the concept just covered?", ["Yes, fully understood 👍", "Need another example 🤔", "Completely lost ❌"]);
      });
    }

    const closePollModalBtn = document.getElementById('closePollModalBtn');
    if (closePollModalBtn) {
      closePollModalBtn.addEventListener('click', () => {
        document.getElementById('livePollModal')?.classList.remove('open');
      });
    }

    // Teacher End Class Button
    const endClassBtn = document.getElementById('teacherEndClassBtn');
    if (endClassBtn) {
      endClassBtn.addEventListener('click', () => this.endClass());
    }
  }
};

window.SyncManager = SyncManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SyncManager.init());
} else {
  SyncManager.init();
}
