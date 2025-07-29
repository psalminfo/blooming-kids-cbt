document.getElementById('parentLoginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const student = document.getElementById('studentName').value.trim();
  const email = document.getElementById('parentEmail').value.trim();

  localStorage.setItem('bk_studentName', student);
  localStorage.setItem('bk_parentEmail', email);

  window.location.href = 'parent.html';
});
