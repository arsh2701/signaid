with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

required_ids = [
    'loginLandingModal',
    'loginTabTeacherBtn',
    'loginTabStudentBtn',
    'loginTeacherForm',
    'loginStudentForm',
    'teacherNameInput',
    'studentNameInput',
    'studentCodeInput',
    'classCreatedModal',
    'createdClassCodeDisplay',
    'navbarUserBadgeContainer',
    'navbarUserBadgeText',
    'navbarUserRolePill',
    'navbarLogoutBtn',
    'firebaseFallbackBanner',
    'classEndedAlertBanner',
    'pinnedAnnouncementBanner',
    'pinnedAnnouncementText',
    'teacherPinMessageForm',
    'teacherPinInput',
    'teacherUnpinBtn',
    'teacherSlowDownAlert',
    'teacherSlowDownCount',
    'studentRaiseHandBtn',
    'studentSlowDownBtn',
    'teacherLaunchQuickPollBtn',
    'teacherEndClassBtn',
    'raisedHandsContainer',
    'handRaiseNotificationBadge',
    'onlineStudentCountDisplay',
    'onlineStudentsListContainer',
    'classChatPanel',
    'classChatOverlay',
    'openClassChatBtn',
    'closeClassChatBtn',
    'classChatMessagesContainer',
    'classChatForm',
    'classChatInput',
    'classChatCharCounter',
    'classChatUnreadBadge',
    'livePollModal',
    'livePollQuestion',
    'livePollOptions',
    'livePollResultsChart',
    'toggleSignCameraBtn',
    'signVideoElement',
    'signCanvasOverlay',
    'signDetectionStatus',
    'detectedGestureDisplayBox',
    'detectedGestureLabel'
]

missing = []
for rid in required_ids:
    if f'id="{rid}"' not in html and f"id='{rid}'" not in html:
        missing.append(rid)

if missing:
    print("MISSING:", missing)
    exit(1)
else:
    print(f"All {len(required_ids)} required DOM element IDs verified in index.html!")
