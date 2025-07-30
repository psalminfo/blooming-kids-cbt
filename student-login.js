document.getElementById('studentLoginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const accessCode = document.getElementById('accessCode').value.trim();
  if (accessCode !== 'bkh2025') {
    alert("Invalid access code");
    return;
  }

  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const grade = document.getElementById('grade').value;
  const tutorName = document.getElementById('tutorName').value.trim();
  const location = document.getElementById('location').value.trim();

  const studentId = `${studentName}-${Date.now()}`;

  localStorage.setItem('studentId', studentId);
  localStorage.setItem('studentName', studentName);
  localStorage.setItem('parentEmail', parentEmail);
  localStorage.setItem('grade', grade);
  localStorage.setItem('tutorName', tutorName);
  localStorage.setItem('location', location);

  window.location.href = 'subject-select.html';
});
