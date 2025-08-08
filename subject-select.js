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
      <button onclick="goToSubject('math')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">Math</button>
      <button onclick="goToSubject('ela')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">English Language Arts</button>
      <button onclick="goToSubject('science')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">Science</button>
    </div>
    <p class="text-xs text-center mt-6 text-gray-600">POWERED BY <span style="color:#FFEB3B">POG</span></p>
  </div>

  <script type="module">
    const urlParams = new URLSearchParams(window.location.search);
    const studentName = urlParams.get('studentName');
    const parentEmail = urlParams.get('parentEmail');
    const grade = urlParams.get('grade');
    const tutorEmail = urlParams.get('tutorEmail');
    const studentCountry = urlParams.get('country');
    const subject = urlParams.get('subject');

    if (!studentName || !parentEmail || !grade || !tutorEmail || !studentCountry) {
      alert("Missing student info. Redirecting...");
      window.location.href = "index.html";
    }

    window.goToSubject = function(subject) {
      const params = new URLSearchParams();
      params.append('studentName', studentName);
      params.append('parentEmail', parentEmail);
      params.append('grade', grade);
      params.append('tutorEmail', tutorEmail);
      params.append('country', studentCountry);
      params.append('subject', subject);
      window.location.href = `student.html?${params.toString()}`;
    }
  </script>

</body>
</html>
