# Blooming Kids House — Management Portal

## Structure
```
management.html          entry point
management-auth.html     login / signup page
main.js                  boots the app (stays tiny — never grows)

core/
  firebase.js            all Firebase SDK imports (change version here only)
  utils.js               all pure helpers — escapeHtml, formatNaira, etc.
  cache.js               sessionCache, tab DOM cache
  auth.js                onAuthStateChanged, sidebar nav, permissions

notifications/
  bell.js                notification bell + real-time badge
  activityLog.js         activity log modal

panels/                  one file per sidebar panel
  dashboard.js
  tutorDirectory.js
  inactiveTutors.js
  studentManagement.js
  payAdvice.js
  tenureBonus.js
  referrals.js
  tutorReports.js
  enrollments.js
  pendingApprovals.js
  summerBreak.js
  parentFeedback.js
  actionHandlers.js
  tutorHistory.js
  masterPortal.js
  academicFollowUp.js
  userDirectory.js
  messaging.js

modals/
  assignStudent.js
  quickActions.js
  transitions.js
  groupClass.js
  reassign.js
```

## Rules
- Never import from the Firebase CDN directly. Always use ../core/firebase.js
- Never add business logic to main.js
- All user strings go through escapeHtml() before innerHTML
- After any Firestore write call invalidateCache('collectionName')
