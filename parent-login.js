document
  .getElementById("parent-login-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const studentName = document.getElementById("studentName").value.trim();
    const parentEmail = document.getElementById("parentEmail").value.trim();

    if (!studentName || !parentEmail) {
      alert("Please fill in both fields.");
      return;
    }

    const params = new URLSearchParams({
      student: studentName,
      email: parentEmail,
    });

    window.location.href = `parent.html?${params.toString()}`;
  });
