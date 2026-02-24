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
    <div id="subjectButtons" class="space-y-4">
      <!-- The goToSubject function is now defined in the script below -->
      <button onclick="goToSubject('math')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">Math</button>
      <button onclick="goToSubject('ela')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">English Language Arts</button>
      <button onclick="goToSubject('science')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">Science</button>
    </div>
    <p class="text-xs text-center mt-6 text-gray-600">POWERED BY <span style="color:#FFEB3B">POG</span></p>
  </div>

  <script>
    // --- THIS IS THE CORRECTED SCRIPT ---
    // It now reads the student's information from localStorage instead of the URL.

    // No need for 'type="module"' as we are not importing anything
    const studentName = localStorage.getItem('studentName');
    const parentEmail = localStorage.getItem('studentEmail');
    const grade = localStorage.getItem('grade');

    // We only need to check for the essential info here.
    if (!studentName || !parentEmail || !grade) {
      alert("Missing student info. Please log in again.");
      window.location.href = "index.html";
    }

    function goToSubject(subject) {
      // The student.js file will get the student's info from localStorage,
      // so we only need to pass the selected subject in the URL.
      window.location.href = `student.html?subject=${subject}`;
    }
  </script>

</body>
</html>
