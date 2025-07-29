// student-login.js
document.getElementById('studentLoginForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const grade = document.getElementById('grade').value;
  const tutor = document.getElementById('tutorName').value.trim();
  const location = document.getElementById('location').value.trim();
  const accessCode = document.getElementById('accessCode').value.trim();

  if (accessCode !== 'bkh2025') {
    alert('Invalid access code. Please enter the correct code.');
    return;
  }

  // Save session details
  sessionStorage.setItem('studentName', name);
  sessionStorage.setItem('parentEmail', parentEmail);
  sessionStorage.setItem('grade', grade);
  sessionStorage.setItem('tutorName', tutor);
  sessionStorage.setItem('location', location);

  // Redirect to subject-select
  window.location.href = 'subject-select.html';
});
