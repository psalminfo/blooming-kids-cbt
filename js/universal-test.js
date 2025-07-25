// js/universal-test.js
import { saveTestReport, generateTestReport } from "./report-handler.js";

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
  updateTimer(); // initialize immediately

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
  const parentEmail = localStorage.getItem("parentEmail");
  const grade = localStorage.getItem("studentGrade");

  const title = document.title; // example: "Blooming Kids House: Grade 3 – Mathematics Test"
  const subjectMatch = title.match(/–\s(.*?)\sTest/i);
  const subject = subjectMatch ? subjectMatch[1] : "Subject";

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
      alert("Test submitted successfully.");
      window.location.href = "select-subject.html";
    })
    .catch((err) => {
      console.error("Error saving report:", err);
      alert("An error occurred while saving your test. Please try again.");
    });
}
