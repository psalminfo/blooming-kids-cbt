// File: js/universal-test.js

// === TIMER SETUP ===
let timeLeft = 30 * 60; // 30 minutes in seconds
const timerDisplay = document.getElementById("timer");
let timerInterval;

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  if (timeLeft > 0) {
    timeLeft--;
  } else {
    clearInterval(timerInterval);
    timerDisplay.textContent = "Time is up!";
    submitTest();
  }
}

if (timerDisplay) {
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

// === TEST SUBMISSION ===
function submitTest() {
  clearInterval(timerInterval);

  const questions = document.querySelectorAll(".question");
  let score = 0;

  questions.forEach((q, index) => {
    const selected = q.querySelector("input[type='radio']:checked");
    const correct = q.querySelector("input[data-correct='true']");
    if (selected && correct && selected.value === correct.value) {
      score++;
    }
  });

  const studentName = localStorage.getItem("studentName") || "Unknown";
  const studentEmail = localStorage.getItem("studentEmail") || "unknown@email.com";
  const grade = localStorage.getItem("selectedGrade") || "Grade Unknown";
  const subject = document.title.split("–")[1]?.trim() || "Subject Unknown";

  if (typeof generateTestReport !== "function") {
    alert("generateTestReport is missing. Check report-handler.js");
    return;
  }
  if (typeof saveTestReport !== "function") {
    alert("saveTestReport is missing. Check report-handler.js");
    return;
  }

  const report = generateTestReport(
    studentName,
    studentEmail,
    subject,
    grade,
    score,
    questions.length
  );
  saveTestReport(report);
  alert("Test submitted successfully.");
  window.location.href = "select-subject.html";
}
