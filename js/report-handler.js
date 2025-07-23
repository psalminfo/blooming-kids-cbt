document.addEventListener("DOMContentLoaded", function () {
  const submitBtn = document.querySelector("#submitTest"); // Adjust this if your button has a different ID
  if (!submitBtn) return;

  submitBtn.addEventListener("click", function () {
    let totalQuestions = document.querySelectorAll(".question-block").length;
    let correctAnswers = 0;

    document.querySelectorAll(".question-block").forEach(block => {
      const selected = block.querySelector("input[type='radio']:checked");
      const correct = block.dataset.correct; // Must be present in HTML like data-correct="A"

      if (selected && selected.value === correct) {
        correctAnswers++;
      }
    });

    // Get subject name from the file name (e.g., grade3-math.html → Math)
    let path = window.location.pathname;
    let filename = path.substring(path.lastIndexOf('/') + 1);
    let subjectPart = filename.split("-")[1] || "Unknown";
    let subject = subjectPart.split(".")[0];
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);

    // Retrieve student details from session storage
    let studentName = sessionStorage.getItem("studentName") || "Unknown";
    let studentEmail = sessionStorage.getItem("studentEmail") || "Unknown";
    let studentGrade = sessionStorage.getItem("studentGrade") || "Unknown";

    // Build report
    const report = {
      name: studentName,
      email: studentEmail,
      grade: studentGrade,
      subject: subject,
      score: correctAnswers,
      total: totalQuestions,
      date: new Date().toLocaleString()
    };

    // Save report in localStorage
    let reports = JSON.parse(localStorage.getItem("studentReports") || "[]");
    reports.push(report);
    localStorage.setItem("studentReports", JSON.stringify(reports));

    // Redirect to select-subject.html
    window.location.href = "select-subject.html";
  });
});
