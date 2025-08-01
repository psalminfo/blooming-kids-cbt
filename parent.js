document.getElementById("parentLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (studentName && parentEmail) {
    const query = new URLSearchParams({
      student: studentName,
      parent: parentEmail
    }).toString();
    window.location.href = `report.html?${query}`;
  }
});
