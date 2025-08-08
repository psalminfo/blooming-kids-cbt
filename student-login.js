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

  const params = new URLSearchParams();
  params.append('studentName', studentName);
  params.append('parentEmail', parentEmail);
  params.append('grade', grade);
  params.append('tutorEmail', tutorEmail);
  params.append('country', studentCountry);

  window.location.href = `subject-select.html?${params.toString()}`;
});
