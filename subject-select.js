<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Select Subject - Blooming Kids House</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />
    <link rel="stylesheet" href="style.css" />
    <link rel="icon" href="favicon.ico" />
  </head>
  <body class="bg-yellow-50 min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-xl shadow-xl w-full max-w-xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-green-800">Select Subject</h2>
        <button onclick="logout()" class="text-sm text-red-600 hover:underline">Logout</button>
      </div>
      <div id="subjectList" class="space-y-3"></div>
      <p class="text-xs text-center mt-6 text-gray-600">POWERED BY <span style="color:#FFEB3B">POG</span></p>
    </div>

    <script type="module">
      import { auth } from './firebaseConfig.js';
      import { onAuthStateChanged, signOut } from './firebase/auth.js';

      onAuthStateChanged(auth, (user) => {
        if (!user) {
          window.location.href = 'login-student.html';
        } else {
          renderSubjects();
        }
      });

      function renderSubjects() {
        const grade = sessionStorage.getItem('grade');
        const subjects = ['Math', 'ELA'];

        if (+grade >= 7) {
          subjects.push('Biology', 'Chemistry', 'Physics');
        }

        const subjectList = document.getElementById('subjectList');
        subjectList.innerHTML = subjects.map(subj => `
          <button onclick="window.location.href='student.html?subject=${subj}'" class="block w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">${subj}</button>
        `).join('');
      }

      window.logout = function () {
        signOut(auth).then(() => {
          window.location.href = 'login-student.html';
        });
      }
    </script>
  </body>
</html>
