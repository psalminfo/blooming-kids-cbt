document.getElementById("parentLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please fill in all fields.");
    return;
  }

  // Save to session storage and proceed
  sessionStorage.setItem("bkh_studentName", studentName);
  sessionStorage.setItem("bkh_parentEmail", parentEmail);

  window.location.href = "parent.html";
});
