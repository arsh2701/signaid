/**
 * SignAid AI - Live Classroom Video Meeting Room
 * High-performance, WebRTC-enabled accessible classroom video conferencing.
 * Features:
 * - Real-time webcam & microphone streaming
 * - Live Closed Captioning (CC) subtitle overlay directly on video
 * - Screen Sharing (Slides / Code / Whiteboard) with PiP camera
 * - WebRTC P2P cross-tab video streaming between Teacher and Student
 * - Acoustic Sound Alert HUD on video feed
 * - Floating "I Missed That" and Sign Language interpreter PIP
 */

const VideoMeeting = {
  localStream: null,
  screenStream: null,
  peerConnection: null,
  isCameraOn: false,
  isMicOn: false,
  isScreenSharing: false,
  isCaptionsOverlayOn: true,
  isSignPipOn: false,
  isMeetingActive: false,
  meetingTimer: null,
  meetingSeconds: 0,
  signalingChannel: null,
  signalingChannelName: "signaid_video_webrtc_v1",

  participants: [
    { id: "teacher", name: "Prof. Ananya Sharma", role: "Instructor (Host)", isSpeaking: true, camera: true, mic: true },
    { id: "me", name: "You (Hard-of-Hearing Student)", role: "Student", isSpeaking: false, camera: false, mic: false },
    { id: "student2", name: "Rohan Patel", role: "Student", isSpeaking: false, camera: true, mic: false },
    { id: "signaid_bot", name: "SignAid AI Assistant", role: "AI Note Taker", isSpeaking: false, camera: true, mic: false }
  ],

  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  },

  init() {
    this.setupSignaling();
    this.bindEvents();
    this.renderParticipantsList();
    this.hookCaptionStream();
  },

  setupSignaling() {
    if (!('BroadcastChannel' in window)) return;
    try {
      this.signalingChannel = new BroadcastChannel(this.signalingChannelName);
      this.signalingChannel.onmessage = async (event) => {
        const msg = event.data;
        if (!msg || !this.isMeetingActive) return;
        this.handleSignalingMessage(msg);
      };
    } catch (e) {
      console.warn("Signaling channel setup note:", e);
    }
  },

  bindEvents() {
    // Launch Meeting Button
    const launchBtn = document.getElementById('launchVideoMeetingBtn');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => this.startMeeting());
    }

    const leaveBtn = document.getElementById('leaveVideoMeetingBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => this.endMeeting());
    }

    // Toggle Camera
    const camBtn = document.getElementById('meetingToggleCamBtn');
    if (camBtn) {
      camBtn.addEventListener('click', () => this.toggleCamera());
    }

    // Toggle Mic
    const micBtn = document.getElementById('meetingToggleMicBtn');
    if (micBtn) {
      micBtn.addEventListener('click', () => this.toggleMic());
    }

    // Screen Share
    const screenBtn = document.getElementById('meetingScreenShareBtn');
    if (screenBtn) {
      screenBtn.addEventListener('click', () => this.toggleScreenShare());
    }

    // CC Subtitles Toggle
    const ccBtn = document.getElementById('meetingToggleCcBtn');
    if (ccBtn) {
      ccBtn.addEventListener('click', () => this.toggleCaptionsOverlay());
    }

    // Sign Language PIP Toggle
    const signPipBtn = document.getElementById('meetingToggleSignPipBtn');
    if (signPipBtn) {
      signPipBtn.addEventListener('click', () => this.toggleSignPip());
    }

    // In-meeting "I Missed That" button
    const missedBtn = document.getElementById('meetingMissedThatBtn');
    if (missedBtn) {
      missedBtn.addEventListener('click', () => {
        if (window.MissedThat) window.MissedThat.handleMissedThat();
      });
    }

    // Toggle Side Drawer (Participants / Chat)
    const drawerBtn = document.getElementById('meetingToggleDrawerBtn');
    if (drawerBtn) {
      drawerBtn.addEventListener('click', () => this.toggleDrawer());
    }

    // Picture in Picture
    const pipBtn = document.getElementById('meetingPipBtn');
    if (pipBtn) {
      pipBtn.addEventListener('click', () => this.requestPictureInPicture());
    }
  },

  async startMeeting() {
    const user = window.AuthManager && window.AuthManager.currentUser;
    if (user && user.role === 'student' && window.ClassroomManager && !window.ClassroomManager.isCurrentStudentApproved()) {
      alert("🔒 Access Restricted: Please wait for your instructor to approve your classroom join request before entering the video room.");
      if (window.ClassroomManager) window.ClassroomManager.checkCurrentStudentStatus();
      return;
    }

    this.isMeetingActive = true;
    const meetingRoom = document.getElementById('videoMeetingSection');
    const heroBtn = document.getElementById('launchVideoMeetingBtn');

    if (meetingRoom) {
      meetingRoom.classList.remove('hidden');
      meetingRoom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (heroBtn) {
      heroBtn.textContent = "🔴 In Video Call (Scroll to Room)";
      heroBtn.classList.add('in-call');
    }

    // Start local timer
    this.startTimer();

    // Start with Camera & Mic enabled
    await this.startMedia(true, true);

    // If teacher role, announce and prepare WebRTC offer
    if (window.SyncManager && window.SyncManager.role === 'teacher') {
      this.initiatePeerConnection(true);
    } else {
      this.initiatePeerConnection(false);
    }

    // Hook Speech Recognition with video meeting
    if (window.CaptionsEngine && !window.CaptionsEngine.isRecognizing) {
      window.CaptionsEngine.start();
    }

    if (window.CaptionsEngine) {
      window.CaptionsEngine.showNotice("📹 Joined Classroom Video Meeting Room: CS-101", "success");
    }
  },

  endMeeting() {
    this.isMeetingActive = false;
    this.stopMedia();
    this.stopScreenShare();
    this.stopTimer();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    const meetingRoom = document.getElementById('videoMeetingSection');
    const heroBtn = document.getElementById('launchVideoMeetingBtn');

    if (meetingRoom) {
      meetingRoom.classList.add('hidden');
    }

    if (heroBtn) {
      heroBtn.textContent = "📹 Join Live Video Classroom";
      heroBtn.classList.remove('in-call');
    }

    if (window.CaptionsEngine) {
      window.CaptionsEngine.showNotice("Left video meeting room.", "info");
    }
  },

  async startMedia(video = true, audio = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: audio
      });

      this.isCameraOn = video;
      this.isMicOn = audio;

      const mainVideo = document.getElementById('meetingMainVideo');
      const localPipVideo = document.getElementById('meetingLocalPipVideo');

      // Attach stream
      if (mainVideo) {
        mainVideo.srcObject = this.localStream;
        mainVideo.play().catch(e => console.warn("Video play error:", e));
      }
      if (localPipVideo) {
        localPipVideo.srcObject = this.localStream;
      }

      this.updateControlsUI();
    } catch (err) {
      console.warn("Could not access real webcam/microphone, activating simulated camera studio:", err);
      this.startSimulatedCameraStudio();
    }
  },

  stopMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.isCameraOn = false;
    this.isMicOn = false;
    this.updateControlsUI();
  },

  toggleCamera() {
    if (!this.localStream) {
      this.startMedia(true, this.isMicOn);
      return;
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isCameraOn = videoTrack.enabled;
    } else {
      this.startMedia(true, this.isMicOn);
    }
    this.updateControlsUI();

    const avatarPlaceholder = document.getElementById('mainVideoAvatarPlaceholder');
    if (avatarPlaceholder) {
      if (this.isCameraOn) avatarPlaceholder.classList.add('hidden');
      else avatarPlaceholder.classList.remove('hidden');
    }
  },

  toggleMic() {
    if (!this.localStream) {
      this.startMedia(this.isCameraOn, true);
      return;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMicOn = audioTrack.enabled;
    }
    this.updateControlsUI();

    // Link with CaptionsEngine
    if (window.CaptionsEngine) {
      if (this.isMicOn) {
        if (!window.CaptionsEngine.isRecognizing) window.CaptionsEngine.start();
      } else {
        if (window.CaptionsEngine.isRecognizing) window.CaptionsEngine.stop();
      }
    }
  },

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      this.stopScreenShare();
      return;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      this.isScreenSharing = true;
      const mainVideo = document.getElementById('meetingMainVideo');
      if (mainVideo) {
        mainVideo.srcObject = this.screenStream;
      }

      // Show presentation badge
      const screenBadge = document.getElementById('screenShareActiveBadge');
      if (screenBadge) screenBadge.classList.remove('hidden');

      // Listen for when user clicks native "Stop sharing" chrome bar
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      this.updateControlsUI();
      if (window.CaptionsEngine) {
        window.CaptionsEngine.showNotice("🖥️ Screen sharing active. Live captions are overlaying slides!", "success");
      }
    } catch (err) {
      console.warn("Screen share cancelled or failed:", err);
      this.isScreenSharing = false;
      this.updateControlsUI();
    }
  },

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;

    // Restore webcam stream to main stage
    const mainVideo = document.getElementById('meetingMainVideo');
    if (mainVideo && this.localStream) {
      mainVideo.srcObject = this.localStream;
    }

    const screenBadge = document.getElementById('screenShareActiveBadge');
    if (screenBadge) screenBadge.classList.add('hidden');

    this.updateControlsUI();
  },

  toggleCaptionsOverlay() {
    this.isCaptionsOverlayOn = !this.isCaptionsOverlayOn;
    const overlay = document.getElementById('videoCcSubtitleOverlay');
    const ccBtn = document.getElementById('meetingToggleCcBtn');

    if (overlay) {
      if (this.isCaptionsOverlayOn) overlay.classList.remove('hidden');
      else overlay.classList.add('hidden');
    }

    if (ccBtn) {
      ccBtn.classList.toggle('active', this.isCaptionsOverlayOn);
    }
  },

  toggleSignPip() {
    this.isSignPipOn = !this.isSignPipOn;
    const signPipCard = document.getElementById('videoSignLanguagePip');
    const signPipBtn = document.getElementById('meetingToggleSignPipBtn');

    if (signPipCard) {
      if (this.isSignPipOn) {
        signPipCard.classList.remove('hidden');
        if (window.SignVision && !window.SignVision.isCameraActive) {
          window.SignVision.startSyntheticLandmarkRendering(document.getElementById('meetingSignPipCanvas'));
        }
      } else {
        signPipCard.classList.add('hidden');
      }
    }

    if (signPipBtn) {
      signPipBtn.classList.toggle('active', this.isSignPipOn);
    }
  },

  toggleDrawer() {
    const drawer = document.getElementById('meetingSideDrawer');
    if (drawer) {
      drawer.classList.toggle('open');
    }
  },

  async requestPictureInPicture() {
    const video = document.getElementById('meetingMainVideo');
    if (video && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (e) {
        console.warn("PiP error:", e);
      }
    }
  },

  // Real-Time Subtitle hook into Video stage
  hookCaptionStream() {
    // Listen for speech recognized events
    window.addEventListener('signaid:new-caption', (e) => {
      const entry = e.detail;
      this.updateVideoSubtitle(entry.rawText, false);
    });

    // Listen for interim streaming
    const originalRenderInterim = window.CaptionsEngine ? window.CaptionsEngine.renderInterim.bind(window.CaptionsEngine) : null;
    if (window.CaptionsEngine) {
      setInterval(() => {
        if (!this.isMeetingActive || !this.isCaptionsOverlayOn) return;
        const interim = window.CaptionsEngine.interimText;
        if (interim && interim.trim()) {
          this.updateVideoSubtitle(interim, true);
        }
      }, 100);
    }

    // Hook Sound Alerts to show visual HUD alert on video
    if (window.SoundAlerts) {
      const origAlert = window.SoundAlerts.triggerAlert.bind(window.SoundAlerts);
      window.SoundAlerts.triggerAlert = (label, db) => {
        origAlert(label, db);
        this.flashVideoSoundAlert(label, db);
      };
    }
  },

  updateVideoSubtitle(text, isInterim = false) {
    const subtitleBox = document.getElementById('videoCcTextDisplay');
    const speakerLabel = document.getElementById('videoCcSpeakerLabel');
    if (!subtitleBox) return;

    let highlighted = text;
    if (window.CaptionsEngine) {
      highlighted = window.CaptionsEngine.highlightKeywords(text);
    }

    if (isInterim) {
      subtitleBox.innerHTML = `<span class="video-interim">${highlighted} <span class="typing-cursor">|</span></span>`;
    } else {
      subtitleBox.innerHTML = `<span class="video-final">${highlighted}</span>`;
    }

    if (speakerLabel) {
      speakerLabel.textContent = (window.SyncManager && window.SyncManager.role === 'teacher')
        ? "Prof. Sharma [Teacher]"
        : "Live Classroom Speaker";
    }
  },

  flashVideoSoundAlert(label, db) {
    const videoStage = document.getElementById('videoStageFrame');
    const alertHud = document.getElementById('videoMeetingSoundHud');
    const labelSpan = document.getElementById('videoSoundHudLabel');

    if (videoStage) {
      videoStage.classList.add('video-sound-flash');
      setTimeout(() => videoStage.classList.remove('video-sound-flash'), 800);
    }

    if (alertHud && labelSpan) {
      labelSpan.textContent = `🚨 ${label} (~${db} dB)`;
      alertHud.classList.add('show');
      setTimeout(() => alertHud.classList.remove('show'), 3500);
    }
  },

  // WebRTC Peer Connection between Teacher & Student Tabs
  async initiatePeerConnection(isInitiator) {
    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Add local audio/video tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Incoming remote stream from second tab
      this.peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('meetingRemotePeerVideo');
        const remoteTile = document.getElementById('meetingRemoteParticipantTile');
        if (remoteVideo && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
          if (remoteTile) remoteTile.classList.remove('hidden');
        }
      };

      // Handle ICE Candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.signalingChannel) {
          this.signalingChannel.postMessage({
            type: 'ice_candidate',
            candidate: event.candidate
          });
        }
      };

      if (isInitiator) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        if (this.signalingChannel) {
          this.signalingChannel.postMessage({ type: 'rtc_offer', sdp: offer });
        }
      }
    } catch (e) {
      console.warn("P2P WebRTC notice:", e);
    }
  },

  async handleSignalingMessage(msg) {
    if (!this.peerConnection) return;
    try {
      if (msg.type === 'rtc_offer' && this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.signalingChannel.postMessage({ type: 'rtc_answer', sdp: answer });
      } else if (msg.type === 'rtc_answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === 'ice_candidate') {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    } catch (err) {
      console.warn("Signaling dispatch note:", err);
    }
  },

  // Fallback simulated camera stream if webcam is not present or blocked
  startSimulatedCameraStudio() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    let angle = 0;

    const stream = canvas.captureStream(25);
    this.localStream = stream;
    this.isCameraOn = true;
    this.isMicOn = true;

    const mainVideo = document.getElementById('meetingMainVideo');
    if (mainVideo) mainVideo.srcObject = stream;

    const render = () => {
      if (!this.isMeetingActive) return;
      angle += 0.04;

      // Studio background gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Simulated teacher avatar representation
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 50, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();

      // Shoulders
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 2 + 75, 90, 50, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();

      // Speaking wave indicator
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Prof. Ananya Sharma (Live Video Feed)", canvas.width / 2, canvas.height - 30);

      requestAnimationFrame(render);
    };
    render();
    this.updateControlsUI();
  },

  updateControlsUI() {
    const camBtn = document.getElementById('meetingToggleCamBtn');
    const micBtn = document.getElementById('meetingToggleMicBtn');
    const screenBtn = document.getElementById('meetingScreenShareBtn');

    if (camBtn) {
      camBtn.classList.toggle('active', this.isCameraOn);
      camBtn.classList.toggle('btn-danger', !this.isCameraOn);
      camBtn.innerHTML = this.isCameraOn ? '📹 Camera On' : '🚫 Camera Off';
    }

    if (micBtn) {
      micBtn.classList.toggle('active', this.isMicOn);
      micBtn.classList.toggle('btn-danger', !this.isMicOn);
      micBtn.innerHTML = this.isMicOn ? '🎤 Mic On' : '🔇 Muted';
    }

    if (screenBtn) {
      screenBtn.classList.toggle('active', this.isScreenSharing);
      screenBtn.innerHTML = this.isScreenSharing ? '⏹ Stop Share' : '🖥️ Share Screen';
    }
  },

  startTimer() {
    this.meetingSeconds = 0;
    this.meetingTimer = setInterval(() => {
      this.meetingSeconds++;
      const mins = Math.floor(this.meetingSeconds / 60).toString().padStart(2, '0');
      const secs = (this.meetingSeconds % 60).toString().padStart(2, '0');
      const display = document.getElementById('meetingTimerDisplay');
      if (display) display.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  stopTimer() {
    if (this.meetingTimer) {
      clearInterval(this.meetingTimer);
      this.meetingTimer = null;
    }
  },

  renderParticipantsList() {
    const list = document.getElementById('meetingParticipantsList');
    if (!list) return;

    list.innerHTML = this.participants.map(p => `
      <div class="participant-item">
        <div class="participant-avatar">${p.name.charAt(0)}</div>
        <div class="participant-info">
          <div class="participant-name">${p.name} ${p.id === 'me' ? '(You)' : ''}</div>
          <div class="participant-role">${p.role}</div>
        </div>
        <div class="participant-status-icons">
          <span>${p.mic ? '🎤' : '🔇'}</span>
          <span>${p.camera ? '📹' : '🚫'}</span>
        </div>
      </div>
    `).join('');
  }
};

window.VideoMeeting = VideoMeeting;
VideoMeeting.init();
