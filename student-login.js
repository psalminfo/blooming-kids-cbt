document.getElementById("studentLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const grade = document.getElementById("grade").value;
  const tutor = document.getElementById("tutorName").value.trim();
  const location = document.getElementById("location").value.trim();
  const accessCode = document.getElementById("accessCode").value.trim();

  if (accessCode !== "bkh2025") {
    alert("Invalid access code.");
    return;
  }

  // Save data to localStorage
  localStorage.setItem("studentName", name);
  localStorage.setItem("parentEmail", parentEmail);
  localStorage.setItem("grade", grade);
  localStorage.setItem("tutor", tutor);
  localStorage.setItem("location", location);
  localStorage.setItem("loginTime", new Date().toISOString());

  // Redirect to subject selection
  window.location.href = "subject-select.html";
});
