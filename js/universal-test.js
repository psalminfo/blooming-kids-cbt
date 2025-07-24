// universal-test.js

// Wait for the DOM to load
document.addEventListener("DOMContentLoaded", function () {
  // === COUNTDOWN TIMER ===
  let timeLeft = 30 * 60; // 30 minutes
  const timerDisplay = document.getElementById("timer");

  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    if (timeLeft > 0) {
      timeLeft--;
    } else {
      clearInterval(timerInterval);
      timerDisplay.textContent = "Time is up!";
      submitTest(); // Auto-submit
    }
  }

  const timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  // === ATTACH SUBMIT BUTTON LISTENER ===
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitTest);
  }

  // === MAIN SUBMIT FUNCTION ===
  function submitTest() {
    clearInterval(timerInterval);

    let score = 0;
    const questions = document.querySelectorAll(".question");
    const totalQuestions = questions.length;

    for (let i = 1; i <= totalQuestions; i++) {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      const correct = document.querySelector(`input[name="q${i}"][data-correct="true"]`);
      if (selected && correct && selected.value === correct.value) {
        score++;
      }
    }

    const studentName = localStorage.getItem("studentName") || "Unknown";
    const studentEmail = localStorage.getItem("studentEmail") || "unknown@email.com";
    const subject = document.title.includes("Math") ? "Mathematics" : "English Language Arts";
    const grade = localStorage.getItem("selectedGrade") || "Grade 3";

    // Make sure report functions are loaded
    if (typeof generateTestReport !== "function" || typeof saveTestReport !== "function") {
      alert("Report handler functions missing. Please check js/report-handler.js is included.");
      return;
    }

    const report = generateTestReport(studentName, studentEmail, subject, grade, score, totalQuestions);
    saveTestReport(report);

    alert("Test submitted successfully.");
    window.location.href = "select-subject.html";
  }
});
