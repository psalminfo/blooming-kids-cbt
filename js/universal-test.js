// js/universal-test.js
import { generateTestReport, saveTestReport } from './report-handler.js';

let timeLeft = 30 * 60;
const timerDisplay = document.getElementById("timer");
const submitBtn = document.getElementById("submitBtn");

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

const timerInterval = setInterval(updateTimer, 1000);

// ✅ Submission logic
async function submitTest() {
  clearInterval(timerInterval);

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
  const subject = document.title.split(" – ")[1] || "Subject";

  if (!studentName || !studentEmail || !grade) {
    alert("Missing student info. Returning to home page.");
    window.location.href = "index.html";
    return;
  }

  const report = generateTestReport(studentName, studentEmail, subject, grade, score, totalQuestions);
  await saveTestReport(report);
  alert("Test submitted successfully.");
  window.location.href = "select-subject.html";
}

submitBtn.addEventListener("click", submitTest);
