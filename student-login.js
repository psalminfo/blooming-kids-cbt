import { saveStudentData } from './utils.js';

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

  // ✅ Save full student info
  saveStudentData({
    studentName,
    parentEmail,
    grade,
    tutorName,
    location
  });

  // ✅ Redirect to subject selection
  window.location.href = "subject-select.html";
});
