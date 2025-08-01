document.addEventListener("DOMContentLoaded", () => {
  const parentForm = document.getElementById("parentForm");
  const errorMsg = document.getElementById("errorMsg");

  if (!parentForm) {
    console.error("Form not found in the DOM.");
    return;
  }

  parentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentNameInput = document.getElementById("studentName");
    const studentEmailInput = document.getElementById("studentEmail");

    if (!studentNameInput || !studentEmailInput) {
      console.error("Input fields not found.");
      return;
    }

    const studentName = studentNameInput.value.trim();
    const studentEmail = studentEmailInput.value.trim();

    if (!studentName || !studentEmail) {
      errorMsg.textContent = "Please fill in both fields.";
      errorMsg.classList.remove("hidden");
      return;
    }

    try {
      // Encode the parameters to safely include in URL
      const encodedName = encodeURIComponent(studentName);
      const encodedEmail = encodeURIComponent(studentEmail);

      // Redirect to the report page with parameters
      window.location.href = `report.html?name=${encodedName}&email=${encodedEmail}`;
    } catch (error) {
      console.error("Error while submitting parent form:", error);
      errorMsg.textContent = "An error occurred. Please try again.";
      errorMsg.classList.remove("hidden");
    }
  });
});
