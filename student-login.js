document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const grade = document.getElementById("grade").value;
  const tutorEmail = document.getElementById("tutorEmail").value;
  const studentCountry = document.getElementById("country").value;
  const accessCode = document.getElementById("accessCode").value;

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  // Save all details to the browser's local storage
  localStorage.setItem("studentName", studentName);
  localStorage.setItem("studentEmail", parentEmail);
  localStorage.setItem("grade", grade);
  localStorage.setItem("tutorEmail", tutorEmail);
  localStorage.setItem("studentCountry", studentCountry);

  // Redirect to the subject selection page
  window.location.href = `subject-select.html`;
});
