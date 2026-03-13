<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Select Subject - Blooming Kids House</title>
  <link rel="icon" href="favicon.ico" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body class="bg-green-50 min-h-screen flex items-center justify-center">

  <div class="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
    <h2 class="text-2xl font-bold text-green-800 mb-4">Select a Subject</h2>

    <!--
      Tutor-launch info banner.
      Hidden by default. Shown automatically when a tutor opens this page
      via the "🎯 Placement Test" button on the dashboard.
    -->
    <div id="tutor-launch-banner"
         class="hidden mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-800 text-left">
      📋 Launched by tutor for
      <strong id="banner-student-name"></strong>
      &nbsp;·&nbsp;
      <span id="banner-grade"></span>
    </div>

    <div id="subjectButtons" class="space-y-4">
      <!--
        goToSubject() is defined in the script below.
        student.html will read all student context from localStorage,
        so we only need to pass the chosen subject in the URL.
      -->
      <button onclick="goToSubject('math')"
              class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">
        Math
      </button>
      <button onclick="goToSubject('ela')"
              class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">
        English Language Arts
      </button>
      <button onclick="goToSubject('science')"
              class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">
        Science
      </button>
    </div>

    <p class="text-xs text-center mt-6 text-gray-600">
      POWERED BY <span style="color:#FFEB3B">POG</span>
    </p>
  </div>

  <script>
    // ─────────────────────────────────────────────────────────────────────────────
    //  INITIALISATION  —  Managed Tutor Hand-off  vs.  Student Self-Login
    //
    //  Priority order:
    //    PATH 1 → If localStorage has a valid 'studentData' object written by the
    //             tutor dashboard, use it directly and bypass the login gate.
    //    PATH 2 → Otherwise fall back to the original individual-key check
    //             (studentName / studentEmail / grade) set by index.html.
    //
    //  Data contract for PATH 1 ('studentData' object):
    //    {
    //      studentUid   : string   — Firestore doc ID (prevents duplicate records)
    //      studentName  : string
    //      grade        : string
    //      studentEmail : string   — parent email (may be empty string)
    //      parentName   : string
    //      parentPhone  : string
    //      tutorEmail   : string
    //      tutorName    : string
    //      launchedBy   : 'tutor'  — sentinel that identifies this path
    //      launchedAt   : number   — Date.now() timestamp for the stale guard
    //    }
    // ─────────────────────────────────────────────────────────────────────────────

    (function init() {

      // ── PATH 1: Tutor-managed hand-off ──────────────────────────────────────────
      var raw = localStorage.getItem('studentData');
      if (raw) {
        var studentData = null;
        try { studentData = JSON.parse(raw); } catch (e) { studentData = null; }

        // Validate all essential fields before trusting the payload
        var valid =
          studentData !== null &&
          typeof studentData.studentUid  === 'string' && studentData.studentUid.trim()  !== '' &&
          typeof studentData.studentName === 'string' && studentData.studentName.trim() !== '' &&
          typeof studentData.grade       === 'string' && studentData.grade.trim()       !== '' &&
          studentData.launchedBy === 'tutor';

        if (valid) {

          // ── Stale-entry guard: reject payloads older than 2 hours ───────────────
          // This prevents a previous session's payload from silently pre-filling
          // a new test session if the tab was left open.
          var TWO_HOURS_MS = 2 * 60 * 60 * 1000;
          if (studentData.launchedAt && (Date.now() - studentData.launchedAt) > TWO_HOURS_MS) {
            localStorage.removeItem('studentData');
            alert('⚠️ This placement test session has expired (older than 2 hours). Please ask your tutor to re-launch it from the dashboard.');
            window.location.href = 'index.html';
            return;
          }

          // ── Mirror individual localStorage keys so that student.html and any
          //    other CBT pages that still read them individually continue to work.
          localStorage.setItem('studentName',  studentData.studentName);
          localStorage.setItem('studentEmail', studentData.studentEmail  || '');
          localStorage.setItem('grade',        studentData.grade);
          // studentUid is essential: student.html must use it when saving results
          // to Firestore so that test data is appended to the EXISTING student
          // document, not a freshly created one (prevents duplicate students).
          localStorage.setItem('studentUid',   studentData.studentUid);

          // ── Show the tutor-launch info banner ──────────────────────────────────
          var banner = document.getElementById('tutor-launch-banner');
          if (banner) {
            document.getElementById('banner-student-name').textContent = studentData.studentName;
            document.getElementById('banner-grade').textContent        = studentData.grade;
            banner.classList.remove('hidden');
          }

          // All good — subject buttons are already rendered. Do nothing more.
          return;
        }

        // ── Invalid / tampered / incomplete payload → clear it and fall through ──
        localStorage.removeItem('studentData');
      }

      // ── PATH 2: Student self-login (original behaviour, completely unchanged) ──
      var studentName  = localStorage.getItem('studentName');
      var parentEmail  = localStorage.getItem('studentEmail');
      var grade        = localStorage.getItem('grade');

      if (!studentName || !parentEmail || !grade) {
        alert('Missing student info. Please log in again.');
        window.location.href = 'index.html';
      }

    })(); // end init IIFE


    // ─────────────────────────────────────────────────────────────────────────────
    //  NAVIGATION
    //  Passes only the selected subject in the URL.
    //  student.html reconstructs the full student context from localStorage.
    // ─────────────────────────────────────────────────────────────────────────────
    function goToSubject(subject) {
      window.location.href = 'student.html?subject=' + subject;
    }
  </script>

</body>
</html>
