document
  .getElementById("parent-login-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const studentName = document.getElementById("studentName").value.trim();
    const parentPhone = document.getElementById("parentPhone").value.trim();

    if (!studentName || !parentPhone) {
      alert("Please fill in both fields.");
      return;
    }

    const params = new URLSearchParams({
      student: studentName,
      phone: parentPhone,
    });

    window.location.href = `parent.html?${params.toString()}`;
  });
