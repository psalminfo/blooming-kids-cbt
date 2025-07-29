<!-- ✅ FILE: student-login.js -->
document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const grade = document.getElementById("grade").value;
  const tutorName = document.getElementById("tutorName").value.trim();
  const location = document.getElementById("location").value.trim();
  const accessCode = document.getElementById("accessCode").value.trim();

  if (accessCode !== "bkh2025") {
    alert("Invalid Access Code");
    return;
  }

  // Save student info to sessionStorage
  sessionStorage.setItem("studentInfo", JSON.stringify({
    studentName,
    parentEmail,
    grade,
    tutorName,
    location
  }));

  // Redirect to subject-select page
  window.location.href = "subject-select.html";
});
