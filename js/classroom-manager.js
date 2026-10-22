/**
 * SignAid AI - Classroom & Join Request Manager
 * Implements Teacher-Approved Classroom Access System.
 * 
 * Features:
 * 1. Auto-generate 6-character unique class code for teacher.
 * 2. Regenerate and disable/enable class code with instant broadcast.
 * 3. Join Request workflow with real-time pending badge and notifications.
 * 4. Teacher Accept / Reject controls and Approved Student roster management (with Remove option).
 * 5. Student Waiting Screen with real-time status updates and duplicate request prevention.
 * 6. Role-based security: Live captions and video stream access gated to approved students only.
 * 7. Supports Firebase Realtime Database with automatic BroadcastChannel & localStorage fallback.
 */

const ClassroomManager = {
  // Storage keys
  storageKeyClassrooms: 'signaid_classrooms_v2',
  storageKeyRequests: 'signaid_join_requests_v2',
  storageKeyStudents: 'signaid_classroom_students_v2',
  storageKeyStudentActiveRequest: 'signaid_student_active_request_v2',

  // State in memory
  classrooms: new Map(),        // class_code -> classroom object
  joinRequests: new Map(),      // request_id -> request object
  approvedStudents: new Map(),  // classroom_id -> Map(student_id -> studentRecord)
  activeStudentRequest: null,   // Current student's active request

  init() {
    this.loadFromStorage();
    this.bindDOM();
    this.checkCurrentStudentStatus();
    this.updateTeacherUI();
  },

  // =========================================================================
  // Persistence (localStorage)
  // =========================================================================
  loadFromStorage() {
    try {
      const rawClassrooms = localStorage.getItem(this.storageKeyClassrooms);
      if (rawClassrooms) {
        const parsed = JSON.parse(rawClassrooms);
        Object.entries(parsed).forEach(([code, data]) => this.classrooms.set(code.toUpperCase(), data));
      }

      const rawRequests = localStorage.getItem(this.storageKeyRequests);
      if (rawRequests) {
        const parsed = JSON.parse(rawRequests);
        Object.entries(parsed).forEach(([id, data]) => this.joinRequests.set(id, data));
      }

      const rawStudents = localStorage.getItem(this.storageKeyStudents);
      if (rawStudents) {
        const parsed = JSON.parse(rawStudents);
        Object.entries(parsed).forEach(([classId, studentsArr]) => {
          const studentMap = new Map();
          if (Array.isArray(studentsArr)) {
            studentsArr.forEach(st => studentMap.set(st.student_id, st));
          }
          this.approvedStudents.set(classId, studentMap);
        });
      }

      const rawActiveReq = localStorage.getItem(this.storageKeyStudentActiveRequest);
      if (rawActiveReq) {
        this.activeStudentRequest = JSON.parse(rawActiveReq);
      }
    } catch (err) {
      console.warn("ClassroomManager storage load error:", err);
    }
  },

  saveToStorage() {
    try {
      const classObj = {};
      this.classrooms.forEach((v, k) => { classObj[k] = v; });
      localStorage.setItem(this.storageKeyClassrooms, JSON.stringify(classObj));

      const reqObj = {};
      this.joinRequests.forEach((v, k) => { reqObj[k] = v; });
      localStorage.setItem(this.storageKeyRequests, JSON.stringify(reqObj));

      const stObj = {};
      this.approvedStudents.forEach((studentMap, classId) => {
        stObj[classId] = Array.from(studentMap.values());
      });
      localStorage.setItem(this.storageKeyStudents, JSON.stringify(stObj));

      if (this.activeStudentRequest) {
        localStorage.setItem(this.storageKeyStudentActiveRequest, JSON.stringify(this.activeStudentRequest));
      } else {
        localStorage.removeItem(this.storageKeyStudentActiveRequest);
      }
    } catch (err) {
      console.warn("ClassroomManager storage save error:", err);
    }
  },

  // =========================================================================
  // Code Generation & Helpers
  // =========================================================================
  generateUniqueCode() {
    // 6-character alphanumeric without ambiguous letters (0, O, 1, I)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  validateCodeFormat(code) {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(clean);
  },

  // =========================================================================
  // Teacher Actions
  // =========================================================================
  createOrGetClassroom(teacherId, teacherName, forcedCode = null) {
    let code = (forcedCode || "").trim().toUpperCase();
    if (!code || !this.validateCodeFormat(code)) {
      code = this.generateUniqueCode();
    }

    const classroomId = "cls_" + code.toLowerCase() + "_" + Date.now().toString(36);
    const classroom = {
      id: classroomId,
      teacher_id: teacherId,
      name: `${teacherName}'s Classroom`,
      class_code: code,
      is_active: true,
      created_at: Date.now()
    };

    this.classrooms.set(code, classroom);
    if (!this.approvedStudents.has(classroomId)) {
      this.approvedStudents.set(classroomId, new Map());
    }

    this.saveToStorage();
    this.broadcastClassroomUpdate(classroom);
    this.updateTeacherUI();
    return classroom;
  },

  getClassroomByCode(code) {
    if (!code) return null;
    return this.classrooms.get(code.trim().toUpperCase()) || null;
  },

  getClassroomById(classroomId) {
    for (const [code, cls] of this.classrooms.entries()) {
      if (cls.id === classroomId) return cls;
    }
    return null;
  },

  getCurrentClassroom() {
    const user = window.AuthManager && window.AuthManager.currentUser;
    if (!user || !user.roomCode) return null;
    return this.getClassroomByCode(user.roomCode);
  },

  regenerateCode(classroomId) {
    const cls = this.getClassroomById(classroomId);
    if (!cls) return null;

    const oldCode = cls.class_code;
    const newCode = this.generateUniqueCode();
    
    // Remove old code mapping
    this.classrooms.delete(oldCode);
    cls.class_code = newCode;
    this.classrooms.set(newCode, cls);

    // Update session room code if teacher
    if (window.AuthManager && window.AuthManager.currentUser.role === 'teacher') {
      window.AuthManager.currentUser.roomCode = newCode;
      sessionStorage.setItem(window.AuthManager.sessionKeyRoom, newCode);
      if (window.SyncManager) {
        window.SyncManager.roomCode = newCode;
      }
    }

    this.saveToStorage();
    this.broadcastClassroomUpdate(cls, 'regenerated', oldCode);
    this.updateTeacherUI();

    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`🔄 Class code regenerated: ${newCode}`, "success");
    }

    return newCode;
  },

  toggleCodeActive(classroomId) {
    const cls = this.getClassroomById(classroomId);
    if (!cls) return false;

    cls.is_active = !cls.is_active;
    this.saveToStorage();
    this.broadcastClassroomUpdate(cls, cls.is_active ? 'enabled' : 'disabled');
    this.updateTeacherUI();

    const statusText = cls.is_active ? "Enabled (Students can join)" : "Disabled (No new join requests)";
    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`Class code is now ${statusText}`, cls.is_active ? "info" : "warning");
    }

    return cls.is_active;
  },

  getPendingRequests(classroomId) {
    const list = [];
    this.joinRequests.forEach(req => {
      if (req.classroom_id === classroomId && req.status === 'pending') {
        list.push(req);
      }
    });
    // Sort newest first
    return list.sort((a, b) => b.created_at - a.created_at);
  },

  getApprovedStudents(classroomId) {
    const map = this.approvedStudents.get(classroomId);
    if (!map) return [];
    return Array.from(map.values()).sort((a, b) => b.joined_at - a.joined_at);
  },

  acceptJoinRequest(requestId) {
    const req = this.joinRequests.get(requestId);
    if (!req) return false;

    req.status = 'accepted';
    req.reviewed_at = Date.now();

    // Add student to classroom_students
    let studentMap = this.approvedStudents.get(req.classroom_id);
    if (!studentMap) {
      studentMap = new Map();
      this.approvedStudents.set(req.classroom_id, studentMap);
    }

    const studentRecord = {
      classroom_id: req.classroom_id,
      student_id: req.student_id,
      student_name: req.student_name,
      student_email: req.student_email,
      joined_at: Date.now()
    };
    studentMap.set(req.student_id, studentRecord);

    this.saveToStorage();
    this.broadcastRequestAction(req, 'accept');
    this.updateTeacherUI();

    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`✅ Approved ${req.student_name} to join class!`, "success");
    }

    return true;
  },

  rejectJoinRequest(requestId) {
    const req = this.joinRequests.get(requestId);
    if (!req) return false;

    req.status = 'rejected';
    req.reviewed_at = Date.now();

    this.saveToStorage();
    this.broadcastRequestAction(req, 'reject');
    this.updateTeacherUI();

    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`❌ Rejected join request for ${req.student_name}.`, "warning");
    }

    return true;
  },

  removeApprovedStudent(classroomId, studentId) {
    const studentMap = this.approvedStudents.get(classroomId);
    if (!studentMap || !studentMap.has(studentId)) return false;

    const student = studentMap.get(studentId);
    studentMap.delete(studentId);

    // Also update any previous join requests
    this.joinRequests.forEach(r => {
      if (r.classroom_id === classroomId && r.student_id === studentId) {
        r.status = 'rejected';
      }
    });

    this.saveToStorage();
    this.broadcastStudentRemoved(classroomId, studentId, student?.student_name);
    this.updateTeacherUI();

    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`Removed student ${student?.student_name || studentId} from class.`, "info");
    }

    return true;
  },

  // =========================================================================
  // Student Actions
  // =========================================================================
  requestToJoinClassroom(studentName, studentEmail, classCode) {
    const name = (studentName || "").trim();
    const email = (studentEmail || "").trim();
    const code = (classCode || "").trim().toUpperCase();

    if (!name || name.length < 2) {
      return { success: false, error: "Please enter your full name." };
    }

    if (!email || !email.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }

    if (!this.validateCodeFormat(code)) {
      return { success: false, error: "Invalid class code format! Must be 6 letters or numbers (e.g. A7K29X)." };
    }

    const cls = this.getClassroomByCode(code);
    if (!cls) {
      return { success: false, error: `Classroom with code "${code}" not found. Please verify the code with your instructor.` };
    }

    if (!cls.is_active) {
      return { success: false, error: `Class code "${code}" is currently disabled by the instructor. New joins are not permitted.` };
    }

    const studentId = (window.AuthManager && window.AuthManager.currentUser.uid) || 
                      "std_" + Math.random().toString(36).substring(2, 9);

    // 1. Check if already approved member
    const studentMap = this.approvedStudents.get(cls.id);
    if (studentMap && studentMap.has(studentId)) {
      // Already a member! Directly approve
      this.grantStudentAccess(cls, name, email, studentId);
      return { success: true, alreadyMember: true, classroom: cls };
    }

    // 2. Check if request already pending
    let existingPending = null;
    this.joinRequests.forEach(req => {
      if (req.classroom_id === cls.id && req.student_id === studentId && req.status === 'pending') {
        existingPending = req;
      }
    });

    if (existingPending) {
      this.activeStudentRequest = existingPending;
      this.saveToStorage();
      this.showWaitingModal(cls, existingPending);
      return { success: true, pending: true, message: "Request already pending. Waiting for teacher approval." };
    }

    // 3. Create new join request
    const requestId = "req_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const newRequest = {
      id: requestId,
      classroom_id: cls.id,
      classroom_code: cls.class_code,
      student_id: studentId,
      student_name: name,
      student_email: email,
      status: 'pending',
      created_at: Date.now()
    };

    this.joinRequests.set(requestId, newRequest);
    this.activeStudentRequest = newRequest;
    this.saveToStorage();

    // Broadcast real-time request to teacher
    this.broadcastNewJoinRequest(newRequest);

    // Render waiting screen
    this.showWaitingModal(cls, newRequest);

    return { success: true, pending: true, request: newRequest };
  },

  grantStudentAccess(classroom, studentName, studentEmail, studentId) {
    if (window.AuthManager) {
      window.AuthManager.saveSession("student", studentName, classroom.class_code, studentEmail, true);
      window.AuthManager.applyUserState();
    }

    this.activeStudentRequest = null;
    this.saveToStorage();
    this.hideWaitingModal();

    if (window.SyncManager && window.SyncManager.showToast) {
      window.SyncManager.showToast(`🎉 Welcome to ${classroom.name}! Live captions unlocked.`, "success");
    }
  },

  cancelStudentRequest() {
    if (this.activeStudentRequest) {
      const req = this.joinRequests.get(this.activeStudentRequest.id);
      if (req && req.status === 'pending') {
        this.joinRequests.delete(this.activeStudentRequest.id);
      }
      this.activeStudentRequest = null;
      this.saveToStorage();
    }
    this.hideWaitingModal();
    this.showEnterCodeScreen();
  },

  isCurrentStudentApproved() {
    const user = window.AuthManager && window.AuthManager.currentUser;
    if (!user || !user.role) return false;
    if (user.role === 'teacher') return true;

    if (!user.roomCode) return false;
    const cls = this.getClassroomByCode(user.roomCode);
    if (!cls) return false;

    const studentMap = this.approvedStudents.get(cls.id);
    return !!(studentMap && studentMap.has(user.uid));
  },

  checkCurrentStudentStatus() {
    const user = window.AuthManager && window.AuthManager.currentUser;
    if (!user || user.role !== 'student') return;

    if (!user.roomCode) {
      this.showEnterCodeScreen();
      return;
    }

    const cls = this.getClassroomByCode(user.roomCode);
    if (!cls) {
      this.showEnterCodeScreen("The previous classroom session is no longer active. Please enter a valid class code.");
      return;
    }

    const studentMap = this.approvedStudents.get(cls.id);
    const isApproved = studentMap && studentMap.has(user.uid);

    if (isApproved) {
      this.hideWaitingModal();
      this.hideEnterCodeScreen();
    } else if (this.activeStudentRequest && this.activeStudentRequest.status === 'pending') {
      this.showWaitingModal(cls, this.activeStudentRequest);
    } else {
      this.showEnterCodeScreen();
    }
  },

  // =========================================================================
  // Real-Time Dispatchers & Receivers (BroadcastChannel + Firebase)
  // =========================================================================
  broadcastNewJoinRequest(req) {
    const payload = {
      type: 'join_request_created',
      request: req,
      timestamp: Date.now()
    };

    // BroadcastChannel local dispatch
    if (window.SyncManager && window.SyncManager.sendBroadcast) {
      window.SyncManager.sendBroadcast(payload);
    }

    // Firebase dispatch if active
    if (window.SyncManager && window.SyncManager.isFirebaseActive && window.SyncManager.firebaseDb) {
      try {
        window.SyncManager.firebaseDb
          .ref(`classes/${req.classroom_code}/requests/${req.id}`)
          .set(req);
      } catch (e) {
        console.warn("Firebase joinRequest push error:", e);
      }
    }
  },

  broadcastRequestAction(req, action) {
    const payload = {
      type: 'join_request_action',
      action: action, // 'accept' | 'reject'
      requestId: req.id,
      classroomId: req.classroom_id,
      classroomCode: req.classroom_code,
      studentId: req.student_id,
      studentName: req.student_name,
      studentEmail: req.student_email,
      timestamp: Date.now()
    };

    if (window.SyncManager && window.SyncManager.sendBroadcast) {
      window.SyncManager.sendBroadcast(payload);
    }

    if (window.SyncManager && window.SyncManager.isFirebaseActive && window.SyncManager.firebaseDb) {
      try {
        const ref = window.SyncManager.firebaseDb.ref(`classes/${req.classroom_code}`);
        ref.child(`requests/${req.id}/status`).set(action === 'accept' ? 'accepted' : 'rejected');
        if (action === 'accept') {
          ref.child(`approvedStudents/${req.student_id}`).set({
            classroom_id: req.classroom_id,
            student_id: req.student_id,
            student_name: req.student_name,
            student_email: req.student_email,
            joined_at: Date.now()
          });
        }
      } catch (e) {
        console.warn("Firebase action push error:", e);
      }
    }
  },

  broadcastClassroomUpdate(classroom, updateType = 'updated', oldCode = null) {
    const payload = {
      type: 'classroom_updated',
      classroom: classroom,
      updateType: updateType,
      oldCode: oldCode,
      timestamp: Date.now()
    };

    if (window.SyncManager && window.SyncManager.sendBroadcast) {
      window.SyncManager.sendBroadcast(payload);
    }

    if (window.SyncManager && window.SyncManager.isFirebaseActive && window.SyncManager.firebaseDb) {
      try {
        window.SyncManager.firebaseDb.ref(`classes/${classroom.class_code}/meta`).set(classroom);
      } catch (e) {
        console.warn("Firebase classroom update push error:", e);
      }
    }
  },

  broadcastStudentRemoved(classroomId, studentId, studentName) {
    const cls = this.getClassroomById(classroomId);
    const code = cls ? cls.class_code : "";

    const payload = {
      type: 'student_removed_from_class',
      classroomId: classroomId,
      studentId: studentId,
      studentName: studentName,
      classroomCode: code,
      timestamp: Date.now()
    };

    if (window.SyncManager && window.SyncManager.sendBroadcast) {
      window.SyncManager.sendBroadcast(payload);
    }

    if (window.SyncManager && window.SyncManager.isFirebaseActive && window.SyncManager.firebaseDb && code) {
      try {
        window.SyncManager.firebaseDb.ref(`classes/${code}/approvedStudents/${studentId}`).remove();
      } catch (e) {
        console.warn("Firebase remove student error:", e);
      }
    }
  },

  // Handle incoming real-time messages from SyncManager
  handleIncomingSyncMessage(msg) {
    if (!msg) return;

    switch (msg.type) {
      case 'join_request_created': {
        const req = msg.request;
        if (!req) return;
        this.joinRequests.set(req.id, req);
        this.saveToStorage();

        const user = window.AuthManager && window.AuthManager.currentUser;
        if (user && user.role === 'teacher') {
          const currentCls = this.getCurrentClassroom();
          if (currentCls && currentCls.id === req.classroom_id) {
            this.updateTeacherUI();
            this.playNotificationChime();
            if (window.SyncManager && window.SyncManager.showToast) {
              window.SyncManager.showToast(`🔔 New join request from ${req.student_name} (${req.student_email})`, "info");
            }
          }
        }
        break;
      }

      case 'join_request_action': {
        const { action, requestId, classroomId, studentId, classroomCode, studentName, studentEmail } = msg;
        const req = this.joinRequests.get(requestId);
        if (req) {
          req.status = action === 'accept' ? 'accepted' : 'rejected';
        }

        if (action === 'accept') {
          let studentMap = this.approvedStudents.get(classroomId);
          if (!studentMap) {
            studentMap = new Map();
            this.approvedStudents.set(classroomId, studentMap);
          }
          studentMap.set(studentId, {
            classroom_id: classroomId,
            student_id: studentId,
            student_name: studentName,
            student_email: studentEmail,
            joined_at: Date.now()
          });
        }
        this.saveToStorage();

        // Check if current user is this student
        const user = window.AuthManager && window.AuthManager.currentUser;
        if (user && user.role === 'student' && user.uid === studentId) {
          const cls = this.getClassroomById(classroomId) || this.getClassroomByCode(classroomCode);
          if (action === 'accept' && cls) {
            this.grantStudentAccess(cls, user.name, user.email || studentEmail, studentId);
          } else if (action === 'reject') {
            this.activeStudentRequest = null;
            this.saveToStorage();
            this.showStudentRejectionNotice(classroomCode || "the class");
          }
        }

        this.updateTeacherUI();
        break;
      }

      case 'classroom_updated': {
        const cls = msg.classroom;
        if (!cls) return;
        if (msg.oldCode) {
          this.classrooms.delete(msg.oldCode);
        }
        this.classrooms.set(cls.class_code, cls);
        this.saveToStorage();

        const user = window.AuthManager && window.AuthManager.currentUser;
        if (user && user.role === 'student') {
          if (msg.oldCode && user.roomCode === msg.oldCode) {
            user.roomCode = cls.class_code;
            sessionStorage.setItem(window.AuthManager.sessionKeyRoom, cls.class_code);
            if (window.SyncManager && window.SyncManager.showToast) {
              window.SyncManager.showToast(`ℹ️ Instructor updated the class code to ${cls.class_code}`, "info");
            }
          }
        }
        this.updateTeacherUI();
        break;
      }

      case 'student_removed_from_class': {
        const { classroomId, studentId } = msg;
        const studentMap = this.approvedStudents.get(classroomId);
        if (studentMap) {
          studentMap.delete(studentId);
        }
        this.saveToStorage();

        const user = window.AuthManager && window.AuthManager.currentUser;
        if (user && user.role === 'student' && user.uid === studentId) {
          // Revert student to code entry screen
          if (window.AuthManager) {
            window.AuthManager.clearSession();
          }
          this.showEnterCodeScreen("You have been removed from this classroom session by the instructor.");
        }
        this.updateTeacherUI();
        break;
      }
    }
  },

  // =========================================================================
  // UI Rendering & Event Bindings
  // =========================================================================
  bindDOM() {
    // Teacher: Class code copy button
    const copyCodeBtn = document.getElementById('teacherDashboardCopyCodeBtn');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        const cls = this.getCurrentClassroom();
        if (cls && cls.class_code) {
          navigator.clipboard.writeText(cls.class_code).then(() => {
            copyCodeBtn.textContent = "Copied! ✓";
            setTimeout(() => { copyCodeBtn.textContent = "📋 Copy Code"; }, 2000);
          }).catch(() => {
            prompt("Class Code:", cls.class_code);
          });
        }
      });
    }

    // Teacher: Regenerate class code button
    const regenBtn = document.getElementById('teacherRegenerateCodeBtn');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        const cls = this.getCurrentClassroom();
        if (!cls) return;
        if (confirm("Regenerate class code? The old code will expire, and students will need the new 6-character code to join.")) {
          this.regenerateCode(cls.id);
        }
      });
    }

    // Teacher: Toggle Disable/Enable code button
    const toggleCodeBtn = document.getElementById('teacherToggleCodeActiveBtn');
    if (toggleCodeBtn) {
      toggleCodeBtn.addEventListener('click', () => {
        const cls = this.getCurrentClassroom();
        if (!cls) return;
        this.toggleCodeActive(cls.id);
      });
    }

    // Teacher: Open Join Requests Panel
    const openRequestsBtn = document.getElementById('openJoinRequestsBtn');
    const requestsModal = document.getElementById('joinRequestsModal');
    const closeRequestsBtn = document.getElementById('closeJoinRequestsModalBtn');

    if (openRequestsBtn && requestsModal) {
      openRequestsBtn.addEventListener('click', () => {
        this.renderPendingRequestsModal();
        requestsModal.classList.add('open');
      });
    }

    if (closeRequestsBtn && requestsModal) {
      closeRequestsBtn.addEventListener('click', () => {
        requestsModal.classList.remove('open');
      });
    }

    // Teacher: Open Approved Students Panel
    const openApprovedBtn = document.getElementById('openApprovedStudentsBtn');
    const approvedModal = document.getElementById('approvedStudentsModal');
    const closeApprovedBtn = document.getElementById('closeApprovedStudentsModalBtn');

    if (openApprovedBtn && approvedModal) {
      openApprovedBtn.addEventListener('click', () => {
        this.renderApprovedStudentsModal();
        approvedModal.classList.add('open');
      });
    }

    if (closeApprovedBtn && approvedModal) {
      closeApprovedBtn.addEventListener('click', () => {
        approvedModal.classList.remove('open');
      });
    }

    // Student: Enter Class Code Form
    const studentEnterCodeForm = document.getElementById('studentEnterCodeForm');
    if (studentEnterCodeForm) {
      studentEnterCodeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('studentStandaloneCodeInput');
        const user = window.AuthManager && window.AuthManager.currentUser;
        if (codeInput && user) {
          const res = this.requestToJoinClassroom(user.name, user.email, codeInput.value);
          if (!res.success) {
            this.showEnterCodeError(res.error);
          }
        }
      });
    }

    // Student: Cancel Waiting Request button
    const cancelWaitBtn = document.getElementById('studentCancelWaitBtn');
    if (cancelWaitBtn) {
      cancelWaitBtn.addEventListener('click', () => {
        this.cancelStudentRequest();
      });
    }

    // Student: Try Another Code from rejection notice
    const tryAnotherCodeBtn = document.getElementById('studentTryAnotherCodeBtn');
    if (tryAnotherCodeBtn) {
      tryAnotherCodeBtn.addEventListener('click', () => {
        const rejectionAlert = document.getElementById('studentRejectionNoticeContainer');
        if (rejectionAlert) rejectionAlert.classList.add('hidden');
        this.showEnterCodeScreen();
      });
    }
  },

  updateTeacherUI() {
    const user = window.AuthManager && window.AuthManager.currentUser;
    if (!user || user.role !== 'teacher') return;

    let cls = this.getCurrentClassroom();
    if (!cls && user.roomCode) {
      cls = this.createOrGetClassroom(user.uid, user.name, user.roomCode);
    }
    if (!cls) return;

    // Update Code Display
    const codeDisplay = document.getElementById('teacherDashboardCodeDisplay');
    if (codeDisplay) codeDisplay.textContent = cls.class_code;

    // Update Status Pill
    const statusPill = document.getElementById('teacherCodeStatusPill');
    const toggleBtn = document.getElementById('teacherToggleCodeActiveBtn');
    if (statusPill) {
      if (cls.is_active) {
        statusPill.textContent = "🟢 Active";
        statusPill.className = "status-badge active";
        if (toggleBtn) toggleBtn.textContent = "🔒 Disable Code";
      } else {
        statusPill.textContent = "🔴 Disabled";
        statusPill.className = "status-badge disabled";
        if (toggleBtn) toggleBtn.textContent = "🔓 Enable Code";
      }
    }

    // Update Pending Requests Badge
    const pendingList = this.getPendingRequests(cls.id);
    const badge = document.getElementById('joinRequestsBadge');
    if (badge) {
      badge.textContent = pendingList.length;
      if (pendingList.length > 0) {
        badge.classList.remove('hidden');
        badge.classList.add('pulse');
      } else {
        badge.classList.add('hidden');
        badge.classList.remove('pulse');
      }
    }

    // Update Approved Students Count
    const approvedList = this.getApprovedStudents(cls.id);
    const countDisplay = document.getElementById('approvedStudentsCountDisplay');
    if (countDisplay) {
      countDisplay.textContent = approvedList.length;
    }

    // Re-render open modals if active
    const requestsModal = document.getElementById('joinRequestsModal');
    if (requestsModal && requestsModal.classList.contains('open')) {
      this.renderPendingRequestsModal();
    }

    const approvedModal = document.getElementById('approvedStudentsModal');
    if (approvedModal && approvedModal.classList.contains('open')) {
      this.renderApprovedStudentsModal();
    }
  },

  renderPendingRequestsModal() {
    const cls = this.getCurrentClassroom();
    const container = document.getElementById('joinRequestsListContainer');
    const modalSubtitle = document.getElementById('joinRequestsModalSubtitle');
    if (!container || !cls) return;

    const pending = this.getPendingRequests(cls.id);
    if (modalSubtitle) {
      modalSubtitle.textContent = `Pending requests for room ${cls.class_code} (${pending.length} waiting)`;
    }

    if (pending.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="padding: 2.5rem 1rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color: #fff;">No Pending Join Requests</h4>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 4px;">
            Share class code <strong style="color: var(--accent-cyan); letter-spacing: 0.08em;">${cls.class_code}</strong> with students to have them join!
          </p>
        </div>
      `;
      return;
    }

    let html = `<div class="requests-grid" style="display: flex; flex-direction: column; gap: 0.75rem;">`;
    pending.forEach(req => {
      const timeStr = new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `
        <div class="join-request-card" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; color: #fff;">
              ${(req.student_name || "S").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: #fff;">${this.escapeHtml(req.student_name)}</div>
              <div style="font-size: 0.82rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
                ✉️ ${this.escapeHtml(req.student_email)} &bull; <span style="color: var(--text-secondary);">Requested at ${timeStr}</span>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-primary btn-sm" style="background: #10b981; border-color: #059669; font-weight: 700; padding: 0.5rem 1rem;" onclick="ClassroomManager.acceptJoinRequest('${req.id}')" aria-label="Accept ${this.escapeHtml(req.student_name)}">
              ✓ Accept
            </button>
            <button class="btn btn-danger btn-sm" style="background: #ef4444; border-color: #dc2626; font-weight: 700; padding: 0.5rem 1rem;" onclick="ClassroomManager.rejectJoinRequest('${req.id}')" aria-label="Reject ${this.escapeHtml(req.student_name)}">
              ✕ Reject
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  },

  renderApprovedStudentsModal() {
    const cls = this.getCurrentClassroom();
    const container = document.getElementById('approvedStudentsListContainer');
    const modalSubtitle = document.getElementById('approvedStudentsModalSubtitle');
    if (!container || !cls) return;

    const approved = this.getApprovedStudents(cls.id);
    if (modalSubtitle) {
      modalSubtitle.textContent = `Enrolled students in room ${cls.class_code} (${approved.length} active)`;
    }

    if (approved.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="padding: 2.5rem 1rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👥</div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color: #fff;">No Approved Students Yet</h4>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 4px;">
            When you accept student requests, they will appear in this roster with full access to live captions.
          </p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em;">
              <th style="padding: 0.65rem 0.75rem;">Student Name</th>
              <th style="padding: 0.65rem 0.75rem;">Email Address</th>
              <th style="padding: 0.65rem 0.75rem;">Joined Time</th>
              <th style="padding: 0.65rem 0.75rem; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    approved.forEach(st => {
      const dateStr = new Date(st.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff;">
            👤 ${this.escapeHtml(st.student_name)}
          </td>
          <td style="padding: 0.85rem 0.75rem; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.82rem;">
            ${this.escapeHtml(st.student_email)}
          </td>
          <td style="padding: 0.85rem 0.75rem; color: var(--text-muted); font-size: 0.82rem;">
            ${dateStr}
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: right;">
            <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose); border-color: rgba(244,63,94,0.3); font-size: 0.78rem; padding: 4px 10px;" onclick="if(confirm('Remove ${this.escapeHtml(st.student_name)} from class?')) ClassroomManager.removeApprovedStudent('${cls.id}', '${st.student_id}')">
              Remove
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  },

  // =========================================================================
  // Student Modals & Overlays
  // =========================================================================
  showEnterCodeScreen(errorMessage = null) {
    const modal = document.getElementById('studentEnterCodeModal');
    const errorBox = document.getElementById('studentEnterCodeErrorBox');
    if (modal) {
      if (errorMessage && errorBox) {
        errorBox.textContent = errorMessage;
        errorBox.classList.remove('hidden');
      } else if (errorBox) {
        errorBox.classList.add('hidden');
      }
      modal.classList.add('open');
    }
  },

  hideEnterCodeScreen() {
    const modal = document.getElementById('studentEnterCodeModal');
    if (modal) modal.classList.remove('open');
  },

  showEnterCodeError(msg) {
    const errorBox = document.getElementById('studentEnterCodeErrorBox');
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
      setTimeout(() => errorBox.classList.add('hidden'), 6000);
    } else {
      alert(msg);
    }
  },

  showWaitingModal(classroom, request) {
    this.hideEnterCodeScreen();
    const modal = document.getElementById('studentWaitingApprovalModal');
    const codeDisplay = document.getElementById('waitingClassCodeDisplay');
    const studentInfo = document.getElementById('waitingStudentInfoDisplay');
    const rejectionNotice = document.getElementById('studentRejectionNoticeContainer');

    if (modal) {
      if (rejectionNotice) rejectionNotice.classList.add('hidden');
      if (codeDisplay) codeDisplay.textContent = classroom.class_code;
      if (studentInfo) studentInfo.textContent = `${request.student_name} (${request.student_email})`;
      modal.classList.add('open');
    }
  },

  hideWaitingModal() {
    const modal = document.getElementById('studentWaitingApprovalModal');
    if (modal) modal.classList.remove('open');
  },

  showStudentRejectionNotice(classCode) {
    const modal = document.getElementById('studentWaitingApprovalModal');
    const rejectionNotice = document.getElementById('studentRejectionNoticeContainer');
    const rejectionText = document.getElementById('studentRejectionNoticeText');
    const waitingContent = document.getElementById('studentWaitingActiveContent');

    if (modal) {
      if (waitingContent) waitingContent.classList.add('hidden');
      if (rejectionNotice) rejectionNotice.classList.remove('hidden');
      if (rejectionText) {
        rejectionText.textContent = `The instructor did not approve your request to join classroom "${classCode}". Please check with your teacher or enter a different class code.`;
      }
      modal.classList.add('open');
    }
  },

  playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // AudioContext might require user gesture
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};

window.ClassroomManager = ClassroomManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ClassroomManager.init());
} else {
  ClassroomManager.init();
}
