import { saveTestReport, generateTestReport } from "./report-handler.js";

document.addEventListener("DOMContentLoaded", () => {
  const timerDisplay = document.getElementById("timer");
  const submitBtn = document.getElementById("submitBtn");

  if (!timerDisplay || !submitBtn) {
    console.error("Timer or Submit button not found.");
    return;
  }

  let timeLeft = 30 * 60; // 30 minutes in seconds

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
  updateTimer();

  submitBtn.addEventListener("click", () => {
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
  const parentEmail = localStorage.getItem("parentEmail");
  const grade = localStorage.getItem("studentGrade");

  // Infer subject from title
  const rawTitle = document.title || "Test";
  const subjectMatch = rawTitle.split(" – ");
  const subject = subjectMatch.length > 1 ? subjectMatch[1].trim() : "Subject";

  if (!studentName || !parentEmail || !grade) {
    alert("Missing student info. Returning to home page.");
    window.location.href = "index.html";
    return;
  }

  const report = generateTestReport(
    studentName,
    parentEmail,
    subject,
    grade,
    score,
    totalQuestions
  );

  saveTestReport(report)
    .then(() => {
      alert("Test submitted successfully!");
      window.location.href = "select-subject.html";
    })
    .catch((err) => {
      console.error("Error saving report:", err);
      alert("There was an error submitting the test.");
    });
}
