document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('studentLoginForm');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const studentName = document.getElementById('studentName').value.trim();
    const parentEmail = document.getElementById('parentEmail').value.trim();
    const grade = document.getElementById('grade').value;
    const tutorName = document.getElementById('tutorName').value.trim();
    const location = document.getElementById('location').value.trim();
    const accessCode = document.getElementById('accessCode').value.trim();

    if (accessCode !== 'bkh2025') {
      alert('Invalid access code. Please contact your tutor.');
      return;
    }

    const studentId = `${studentName}-${Date.now()}`;
    const student = {
      id: studentId,
      name: studentName,
      email: parentEmail,
      grade: grade,
      tutor: tutorName,
      location: location
    };

    localStorage.setItem('student', JSON.stringify(student));
    window.location.href = 'subject-select.html';
  });
});
