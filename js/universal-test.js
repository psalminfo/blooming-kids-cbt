document.addEventListener("DOMContentLoaded", function () {
  const timerDisplay = document.getElementById("timer");
  const submitBtn = document.getElementById("submitBtn");

  if (!timerDisplay || !submitBtn) {
    console.error("Timer or Submit button not found in the DOM.");
    return;
  }

  let timeLeft = 30 * 60; // 30 minutes

  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitTest();
    }
    timeLeft--;
  }

  const timerInterval = setInterval(updateTimer, 1000);
  updateTimer(); // Initialize display

  submitBtn.addEventListener("click", function () {
    clearInterval(timerInterval);
    submitTest();
  });
});

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
  const studentEmail = localStorage.getItem("studentEmail");
  const grade = localStorage.getItem("selectedGrade");
  const subject = document.title.replace("Blooming Kids House: ", "").split(" – ")[1] || "Subject";

  if (!studentName || !studentEmail || !grade) {
    alert("Missing student info. Returning to home page.");
    window.location.href = "index.html";
    return;
  }

  const report = generateTestReport(
    studentName,
    studentEmail,
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
