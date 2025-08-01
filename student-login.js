document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const grade = document.getElementById("grade").value;
  const tutorName = document.getElementById("tutorName").value;
  const location = document.getElementById("location").value;
  const accessCode = document.getElementById("accessCode").value;

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  window.location.href = `subject-select.html?studentName=${encodeURIComponent(studentName)}&parentEmail=${encodeURIComponent(parentEmail)}&grade=${grade}&tutorName=${encodeURIComponent(tutorName)}&location=${encodeURIComponent(location)}`;
});
