/**
 * SignAid AI - Authentication & Role Manager
 * Handles tab-isolated session authentication using sessionStorage.
 * Allows multiple users (Teacher vs Students) in separate browser tabs or devices.
 * Integrates with ClassroomManager for role-based classroom join approval.
 */

const AuthManager = {
  sessionKeyRole: "signaid_session_role",
  sessionKeyName: "signaid_session_name",
  sessionKeyEmail: "signaid_session_email",
  sessionKeyRoom: "signaid_session_room",
  sessionKeyUserId: "signaid_session_uid",
  sessionKeyApproved: "signaid_session_approved",

  currentUser: {
    uid: null,
    name: "",
    email: "",
    role: null, // 'teacher' | 'student'
    roomCode: "",
    isApproved: false
  },

  init() {
    this.loadSession();
    this.bindEvents();
    this.applyUserState();
  },

  loadSession() {
    try {
      const role = sessionStorage.getItem(this.sessionKeyRole);
      const name = sessionStorage.getItem(this.sessionKeyName);
      const email = sessionStorage.getItem(this.sessionKeyEmail);
      const room = sessionStorage.getItem(this.sessionKeyRoom);
      const approved = sessionStorage.getItem(this.sessionKeyApproved);
      let uid = sessionStorage.getItem(this.sessionKeyUserId);

      if (!uid) {
        uid = "usr_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        sessionStorage.setItem(this.sessionKeyUserId, uid);
      }

      if (role && name) {
        const isApprovedBool = role === 'teacher' ? true : (approved === 'true');
        this.currentUser = {
          uid,
          name: name.trim(),
          email: email ? email.trim() : "",
          role: role.trim(),
          roomCode: room ? room.trim().toUpperCase() : "",
          isApproved: isApprovedBool
        };
      } else {
        this.currentUser = {
          uid,
          name: "",
          email: "",
          role: null,
          roomCode: "",
          isApproved: false
        };
      }
    } catch (e) {
      console.warn("SessionStorage access error:", e);
    }
  },

  saveSession(role, name, roomCode = "", email = "", isApproved = false) {
    try {
      sessionStorage.setItem(this.sessionKeyRole, role);
      sessionStorage.setItem(this.sessionKeyName, name);
      sessionStorage.setItem(this.sessionKeyEmail, email || "");
      sessionStorage.setItem(this.sessionKeyRoom, (roomCode || "").toUpperCase());
      sessionStorage.setItem(this.sessionKeyApproved, isApproved ? 'true' : 'false');

      this.currentUser.role = role;
      this.currentUser.name = name;
      this.currentUser.email = email || "";
      this.currentUser.roomCode = (roomCode || "").toUpperCase();
      this.currentUser.isApproved = isApproved;
    } catch (e) {
      console.warn("Error saving session:", e);
    }
  },

  clearSession() {
    try {
      sessionStorage.removeItem(this.sessionKeyRole);
      sessionStorage.removeItem(this.sessionKeyName);
      sessionStorage.removeItem(this.sessionKeyEmail);
      sessionStorage.removeItem(this.sessionKeyRoom);
      sessionStorage.removeItem(this.sessionKeyApproved);
      this.currentUser.role = null;
      this.currentUser.name = "";
      this.currentUser.email = "";
      this.currentUser.roomCode = "";
      this.currentUser.isApproved = false;
    } catch (e) {
      console.warn("Error clearing session:", e);
    }
    this.applyUserState();
    window.location.reload();
  },

  generateClassCode() {
    // Generate clean 6-character alphanumeric code like A7K29X (excluding ambiguous chars 0, O, 1, I)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  validateClassCode(code) {
    if (!code || typeof code !== 'string') return false;
    const cleaned = code.trim().toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(cleaned);
  },

  createClassAsTeacher(teacherName) {
    const name = teacherName.trim();
    if (!name || name.length < 2) {
      this.showLoginError("Please enter your name (at least 2 characters).");
      return null;
    }

    let code = this.generateClassCode();
    if (window.ClassroomManager) {
      const cls = window.ClassroomManager.createOrGetClassroom(this.currentUser.uid, name, code);
      if (cls) code = cls.class_code;
    }

    this.saveSession("teacher", name, code, "", true);
    this.applyUserState();

    if (window.SyncManager) {
      window.SyncManager.onUserJoined(this.currentUser);
    }

    this.showClassCodeModal(code);
    return code;
  },

  joinClassAsStudent(studentName, studentCode, studentEmail = "") {
    const name = studentName.trim();
    const code = (studentCode || "").trim().toUpperCase();
    const email = (studentEmail || "").trim();

    if (!name || name.length < 2) {
      this.showLoginError("Please enter your full name (at least 2 characters).");
      return false;
    }

    // If email is provided, validate; if not, generate fallback or require
    let userEmail = email;
    if (!userEmail) {
      userEmail = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.signaid.edu`;
    }

    // Case 1: Student did not provide a class code yet
    if (!code) {
      // Save student identity without room code
      this.saveSession("student", name, "", userEmail, false);
      this.applyUserState();
      if (window.ClassroomManager) {
        window.ClassroomManager.showEnterCodeScreen();
      }
      return true;
    }

    // Case 2: Student provided a class code
    if (!this.validateClassCode(code)) {
      this.showLoginError("Invalid class code format! Must be 6 alphanumeric characters (e.g. A7K29X).");
      return false;
    }

    // Submit join request via ClassroomManager
    if (window.ClassroomManager) {
      const result = window.ClassroomManager.requestToJoinClassroom(name, userEmail, code);
      if (!result.success) {
        this.showLoginError(result.error);
        return false;
      }

      if (result.alreadyMember) {
        // Direct access granted
        this.saveSession("student", name, code, userEmail, true);
        this.applyUserState();
        if (window.SyncManager) {
          window.SyncManager.onUserJoined(this.currentUser);
        }
        return true;
      }

      // Pending teacher approval
      this.saveSession("student", name, code, userEmail, false);
      this.applyUserState();
      return true;
    }

    // Fallback if ClassroomManager is not yet loaded
    this.saveSession("student", name, code, userEmail, false);
    this.applyUserState();
    return true;
  },

  applyUserState() {
    const landingOverlay = document.getElementById('loginLandingModal');
    const userBadgeContainer = document.getElementById('navbarUserBadgeContainer');
    const userBadgeText = document.getElementById('navbarUserBadgeText');
    const userRolePill = document.getElementById('navbarUserRolePill');
    const roomCodeDisplay = document.getElementById('currentRoomCodeDisplay');
    const classroomSection = document.getElementById('classroom');
    const studentStatusBadge = document.getElementById('studentApprovalStatusPill');

    // Role-dependent UI controls
    const teacherOnlyElements = document.querySelectorAll('.teacher-only');
    const studentOnlyElements = document.querySelectorAll('.student-only');

    if (this.currentUser.role && this.currentUser.name) {
      // User has logged in
      if (landingOverlay) landingOverlay.classList.remove('open');

      if (userBadgeContainer) userBadgeContainer.classList.remove('hidden');
      if (userBadgeText) userBadgeText.textContent = `${this.currentUser.name}`;
      if (userRolePill) {
        userRolePill.textContent = this.currentUser.role === 'teacher' ? 'Teacher' : 'Student';
        userRolePill.className = `role-badge ${this.currentUser.role}`;
      }
      if (roomCodeDisplay) {
        roomCodeDisplay.textContent = this.currentUser.roomCode || "None";
      }

      // Update body attribute for CSS scoping
      document.body.setAttribute('data-user-role', this.currentUser.role);

      // Show/Hide role specific DOM controls
      if (this.currentUser.role === 'teacher') {
        teacherOnlyElements.forEach(el => el.classList.remove('hidden'));
        studentOnlyElements.forEach(el => el.classList.add('hidden'));
        if (classroomSection) classroomSection.classList.remove('blurred-content');
        if (studentStatusBadge) studentStatusBadge.classList.add('hidden');
      } else {
        teacherOnlyElements.forEach(el => el.classList.add('hidden'));
        studentOnlyElements.forEach(el => el.classList.remove('hidden'));

        // Student approval check:
        // Live captions & meeting are only unlocked if student is approved!
        const isApproved = this.currentUser.isApproved === true || 
          (window.ClassroomManager && window.ClassroomManager.isCurrentStudentApproved());

        if (isApproved) {
          if (classroomSection) classroomSection.classList.remove('blurred-content');
          if (studentStatusBadge) {
            studentStatusBadge.classList.remove('hidden');
            studentStatusBadge.textContent = "🟢 Enrolled";
            studentStatusBadge.className = "status-badge active";
          }
        } else {
          // Lock classroom until approved
          if (classroomSection) classroomSection.classList.add('blurred-content');
          if (studentStatusBadge) {
            studentStatusBadge.classList.remove('hidden');
            studentStatusBadge.textContent = "⏳ Pending Approval";
            studentStatusBadge.className = "status-badge pending";
          }
        }
      }

      // Propagate to SyncManager
      if (window.SyncManager) {
        window.SyncManager.role = this.currentUser.role;
        window.SyncManager.roomCode = this.currentUser.roomCode;
        window.SyncManager.userName = this.currentUser.name;
        window.SyncManager.updateRoleUI();
      }

      // Sync teacher UI in ClassroomManager
      if (window.ClassroomManager) {
        window.ClassroomManager.updateTeacherUI();
        window.ClassroomManager.checkCurrentStudentStatus();
      }
    } else {
      // Not logged in: Show landing screen
      if (landingOverlay) landingOverlay.classList.add('open');
      if (classroomSection) classroomSection.classList.add('blurred-content');
      if (userBadgeContainer) userBadgeContainer.classList.add('hidden');
      document.body.removeAttribute('data-user-role');
    }
  },

  showLoginError(message) {
    const errorElem = document.getElementById('loginErrorMessage');
    if (errorElem) {
      errorElem.textContent = message;
      errorElem.classList.remove('hidden');
      setTimeout(() => errorElem.classList.add('hidden'), 5000);
    } else {
      alert(message);
    }
  },

  showClassCodeModal(code) {
    const modal = document.getElementById('classCreatedModal');
    const codeDisplay = document.getElementById('createdClassCodeDisplay');
    if (modal && codeDisplay) {
      codeDisplay.textContent = code;
      modal.classList.add('open');
    }
  },

  bindEvents() {
    // Logout button
    const logoutBtn = document.getElementById('navbarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to exit this class session?")) {
          this.clearSession();
        }
      });
    }

    // Role switcher tab buttons on login modal
    const teacherTabBtn = document.getElementById('loginTabTeacherBtn');
    const studentTabBtn = document.getElementById('loginTabStudentBtn');
    const teacherForm = document.getElementById('loginTeacherForm');
    const studentForm = document.getElementById('loginStudentForm');

    if (teacherTabBtn && studentTabBtn && teacherForm && studentForm) {
      teacherTabBtn.addEventListener('click', () => {
        teacherTabBtn.classList.add('active');
        studentTabBtn.classList.remove('active');
        teacherForm.classList.remove('hidden');
        studentForm.classList.add('hidden');
      });

      studentTabBtn.addEventListener('click', () => {
        studentTabBtn.classList.add('active');
        teacherTabBtn.classList.remove('active');
        studentForm.classList.remove('hidden');
        teacherForm.classList.add('hidden');
      });
    }

    // Teacher submit form
    if (teacherForm) {
      teacherForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('teacherNameInput');
        if (nameInput) {
          this.createClassAsTeacher(nameInput.value);
        }
      });
    }

    // Student submit form
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('studentNameInput');
        const emailInput = document.getElementById('studentEmailInput');
        const codeInput = document.getElementById('studentCodeInput');
        if (nameInput) {
          const emailVal = emailInput ? emailInput.value : "";
          const codeVal = codeInput ? codeInput.value : "";
          this.joinClassAsStudent(nameInput.value, codeVal, emailVal);
        }
      });
    }

    // Copy Class Code Button in Created Modal
    const copyCreatedCodeBtn = document.getElementById('copyCreatedCodeBtn');
    if (copyCreatedCodeBtn) {
      copyCreatedCodeBtn.addEventListener('click', () => {
        const code = this.currentUser.roomCode;
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            copyCreatedCodeBtn.textContent = "Copied! ✓";
            setTimeout(() => { copyCreatedCodeBtn.textContent = "Copy Code"; }, 2000);
          }).catch(() => {
            prompt("Copy this class code:", code);
          });
        }
      });
    }

    const closeCreatedModalBtn = document.getElementById('closeCreatedClassModalBtn');
    if (closeCreatedModalBtn) {
      closeCreatedModalBtn.addEventListener('click', () => {
        document.getElementById('classCreatedModal')?.classList.remove('open');
      });
    }
  }
};

window.AuthManager = AuthManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthManager.init());
} else {
  AuthManager.init();
}
