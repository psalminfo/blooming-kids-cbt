document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const parentPhone = document.getElementById("parentPhone").value;
  const grade = document.getElementById("grade").value;
  const tutorEmail = document.getElementById("tutorEmail").value;
  const country = document.getElementById("country").value;
  const accessCode = document.getElementById("accessCode").value;

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  const studentData = {
    studentName,
    parentEmail,
    parentPhone,
    grade,
    tutorEmail,
    country
  };

  // Save the single studentData object to localStorage
  localStorage.setItem("studentData", JSON.stringify(studentData));

  // Redirect to the subject selection page
  window.location.href = "subject-select.html";
});
