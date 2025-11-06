document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value;
  const parentName = document.getElementById("parentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const parentPhone = document.getElementById("parentPhone").value;
  const grade = document.getElementById("grade").value;
  const tutorEmail = document.getElementById("tutorEmail").value;
  const country = document.getElementById("country").value;
  const accessCode = document.getElementById("accessCode").value;
  
  // [SURGICAL ADDITION 1]: Safely retrieve and clean the new Referral Code input value.
  const referralCode = document.getElementById("referralCode")?.value.trim() || ''; 

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  const studentData = {
    studentName,
    parentName,
    parentEmail,
    parentPhone,
    grade,
    tutorEmail,
    country,
    // [SURGICAL ADDITION 2]: Add the referral code to the student data object for tracking.
    referralCode 
  };

  // Save the single studentData object to localStorage
  localStorage.setItem("studentData", JSON.stringify(studentData));

  // Redirect to the subject selection page
  window.location.href = "subject-select.html";
});
