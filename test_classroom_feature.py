"""
SignAid AI - Classroom Join Request Feature Automated Test Suite
"""
import os
import re

base_dir = r"C:\Users\Seerat\Downloads\OneDrive_2026-10-22\signaid hackerwrath"

print("--- 1. Testing index.html IDs ---")
with open(os.path.join(base_dir, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

required_ids = [
    # Original required IDs (ensure 100% backward compatibility)
    'loginLandingModal', 'loginTabTeacherBtn', 'loginTabStudentBtn',
    'loginTeacherForm', 'loginStudentForm', 'teacherNameInput',
    'studentNameInput', 'studentCodeInput', 'classCreatedModal',
    'createdClassCodeDisplay', 'navbarUserBadgeContainer',
    'navbarUserBadgeText', 'navbarUserRolePill', 'navbarLogoutBtn',
    'firebaseFallbackBanner', 'classEndedAlertBanner',
    'pinnedAnnouncementBanner', 'pinnedAnnouncementText',
    'teacherPinMessageForm', 'teacherPinInput', 'teacherUnpinBtn',
    'teacherSlowDownAlert', 'teacherSlowDownCount', 'studentRaiseHandBtn',
    'studentSlowDownBtn', 'teacherLaunchQuickPollBtn', 'teacherEndClassBtn',
    'raisedHandsContainer', 'handRaiseNotificationBadge',
    'onlineStudentCountDisplay', 'onlineStudentsListContainer',
    'classChatPanel', 'classChatOverlay', 'openClassChatBtn',
    'closeClassChatBtn', 'classChatMessagesContainer', 'classChatForm',
    'classChatInput', 'classChatCharCounter', 'classChatUnreadBadge',
    'livePollModal', 'livePollQuestion', 'livePollOptions',
    'livePollResultsChart', 'toggleSignCameraBtn', 'signVideoElement',
    'signCanvasOverlay', 'signDetectionStatus', 'detectedGestureDisplayBox',
    'detectedGestureLabel',
    # New Classroom Join Request Feature IDs
    'openJoinRequestsBtn', 'joinRequestsBadge', 'openApprovedStudentsBtn',
    'approvedStudentsCountDisplay', 'studentApprovalStatusPill',
    'teacherDashboardCodeDisplay', 'teacherCodeStatusPill',
    'teacherDashboardCopyCodeBtn', 'teacherRegenerateCodeBtn',
    'teacherToggleCodeActiveBtn', 'studentEmailInput', 'studentEnterCodeModal',
    'enterCodeTitle', 'studentEnterCodeErrorBox', 'studentEnterCodeForm',
    'studentStandaloneCodeInput', 'studentWaitingApprovalModal',
    'studentWaitingActiveContent', 'waitingApprovalTitle',
    'waitingClassCodeDisplay', 'waitingStudentInfoDisplay',
    'studentCancelWaitBtn', 'studentRejectionNoticeContainer',
    'studentRejectionNoticeText', 'studentTryAnotherCodeBtn',
    'joinRequestsModal', 'joinRequestsTitle', 'joinRequestsModalSubtitle',
    'closeJoinRequestsModalBtn', 'joinRequestsListContainer',
    'approvedStudentsModal', 'approvedStudentsTitle',
    'approvedStudentsModalSubtitle', 'closeApprovedStudentsModalBtn',
    'approvedStudentsListContainer'
]

missing = [i for i in required_ids if f'id="{i}"' not in html and f"id='{i}'" not in html]
assert not missing, f"Missing IDs: {missing}"
print(f"PASS: All {len(required_ids)} required and new DOM IDs exist in index.html!")

print("\n--- 2. Checking Script Tags Order in index.html ---")
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
assert "config.js" in scripts, "config.js missing"
assert "js/auth.js" in scripts, "js/auth.js missing"
assert "js/classroom-manager.js" in scripts, "js/classroom-manager.js missing"
assert "js/sync.js" in scripts, "js/sync.js missing"

auth_idx = scripts.index("js/auth.js")
cm_idx = scripts.index("js/classroom-manager.js")
sync_idx = scripts.index("js/sync.js")
assert cm_idx > auth_idx, "classroom-manager.js should load after auth.js"
assert sync_idx > cm_idx, "sync.js should load after classroom-manager.js"
print(f"PASS: Script load order verified: auth.js -> classroom-manager.js -> sync.js")

print("\n--- 3. Verifying JavaScript files exist and contain core methods ---")
with open(os.path.join(base_dir, "js", "classroom-manager.js"), "r", encoding="utf-8") as f:
    cm_content = f.read()

required_cm_methods = [
    "createOrGetClassroom", "generateUniqueCode", "validateCodeFormat",
    "regenerateCode", "toggleCodeActive", "getPendingRequests",
    "getApprovedStudents", "acceptJoinRequest", "rejectJoinRequest",
    "removeApprovedStudent", "requestToJoinClassroom", "grantStudentAccess",
    "cancelStudentRequest", "isCurrentStudentApproved", "checkCurrentStudentStatus",
    "broadcastNewJoinRequest", "broadcastRequestAction", "broadcastClassroomUpdate",
    "broadcastStudentRemoved", "handleIncomingSyncMessage"
]
for m in required_cm_methods:
    assert m in cm_content, f"Missing method {m} in classroom-manager.js"
print(f"PASS: All {len(required_cm_methods)} ClassroomManager methods verified!")

with open(os.path.join(base_dir, "js", "auth.js"), "r", encoding="utf-8") as f:
    auth_content = f.read()

assert "sessionKeyEmail" in auth_content
assert "sessionKeyApproved" in auth_content
assert "studentApprovalStatusPill" in auth_content
assert "ClassroomManager" in auth_content
print("PASS: auth.js integration verified!")

with open(os.path.join(base_dir, "js", "sync.js"), "r", encoding="utf-8") as f:
    sync_content = f.read()

assert "join_request_created" in sync_content
assert "join_request_action" in sync_content
assert "student_removed_from_class" in sync_content
assert "isCurrentStudentApproved" in sync_content
print("PASS: sync.js real-time event forwarding and caption gating verified!")

with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

assert ".status-badge" in css_content
assert ".status-badge.active" in css_content
assert ".status-badge.disabled" in css_content
assert ".status-badge.pending" in css_content
assert ".pending-badge" in css_content
assert ".teacher-class-control-card" in css_content
print("PASS: style.css classes verified!")

print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
