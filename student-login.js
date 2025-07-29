document.getElementById("studentLoginForm").addEventListener("submit", function (e) {
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

  localStorage.setItem("bk_studentName", name);
  localStorage.setItem("bk_parentEmail", parentEmail);
  localStorage.setItem("bk_grade", grade);
  localStorage.setItem("bk_tutor", tutor);
  localStorage.setItem("bk_location", location);

  window.location.href = "subject-select.html";
});
