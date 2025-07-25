function submitTest() {
  const questions = document.querySelectorAll(".question");
  const totalQuestions = questions.length;
  let score = 0;

  for (let i = 1; i <= totalQuestions; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const correct = document.querySelector(`input[name="q${i}"][data-correct="true"]`);
    if (selected && correct && selected.value === correct.value) {
      score++;
    }
  }

  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("studentEmail"); // this is correct — from the index page
  const grade = localStorage.getItem("studentGrade");
  const subject = document.title.replace("Blooming Kids House: ", "").split(" – ")[1] || "Subject";

  // ✅ Fix: Validate the correct keys that were stored in localStorage
  if (!studentName || !parentEmail || !grade) {
    alert("Missing student info. Returning to home page.");
    window.location.href = "index.html";
    return;
  }

  // ✅ Fix: pass correct arguments using the names above
  const report = generateTestReport(
    studentName,
    parentEmail,
    subject,
    grade,
    score,
    totalQuestions
  );

  try {
    saveTestReport(report)
      .then(() => {
        alert("Test submitted successfully.");
        window.location.href = "select-subject.html";
      })
      .catch((err) => {
        console.error("Error saving report:", err);
        alert("An error occurred while saving the report.");
      });
  } catch (err) {
    console.error("Report handler functions missing:", err);
    alert("Report handler functions missing. Please check js/report-handler.js is included.");
  }
}
