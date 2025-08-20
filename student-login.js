document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const grade = document.getElementById("grade").value;
  
  // --- CHANGE 1: Use the correct ID "tutorEmail" ---
  const tutorEmail = document.getElementById("tutorEmail").value;
  
  // --- CHANGE 2: Use the correct ID "country" ---
  const country = document.getElementById("country").value;
  
  const accessCode = document.getElementById("accessCode").value;

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  // --- CHANGE 3: Save the correct variables ---
  const studentData = {
    studentName,
    parentEmail,
    grade,
    tutorEmail,
    country
  };

  // Save the single studentData object to localStorage
  localStorage.setItem("studentData", JSON.stringify(studentData));

  // Redirect to the subject selection page
  window.location.href = "subject-select.html";
});
