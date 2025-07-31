document.getElementById("parentLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (studentName && parentEmail) {
    const encodedName = encodeURIComponent(studentName);
    const encodedEmail = encodeURIComponent(parentEmail);
    window.location.href = `report.html?name=${encodedName}&email=${encodedEmail}`;
  } else {
    alert("Please fill in both fields.");
  }
});
