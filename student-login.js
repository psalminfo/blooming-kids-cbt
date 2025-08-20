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

  const studentData = {
    studentName,
    parentEmail,
    grade,
    tutorName,
    location
  };

  localStorage.setItem("studentData", JSON.stringify(studentData));

  window.location.href = "subject-select.html";
});
