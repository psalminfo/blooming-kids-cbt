document.getElementById('studentLoginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const name = document.getElementById('studentName').value.trim();
  const email = document.getElementById('parentEmail').value.trim();
  const grade = document.getElementById('grade').value;
  const tutor = document.getElementById('tutorName').value.trim();
  const location = document.getElementById('location').value.trim();
  const accessCode = document.getElementById('accessCode').value.trim().toLowerCase();

  if (accessCode !== 'bkh2025') {
    alert('Invalid Access Code.');
    return;
  }

  const studentInfo = { name, email, grade, tutor, location };
  localStorage.setItem('studentInfo', JSON.stringify(studentInfo));

  window.location.href = 'student.html'; // will load test subjects
});
