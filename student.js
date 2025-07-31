// student.js
import { db, collection, addDoc } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");
  const studentEmail = localStorage.getItem("studentEmail");
  const grade = localStorage.getItem("grade");

  if (!studentName || !studentEmail || !grade) {
    alert("Missing student information. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  const subjects = ["math", "ela"];
  const allQuestions = {};
  let timerInterval;

  async function fetchQuestions(subject) {
    const file = `${grade}-${subject}.json`; // Same folder
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error("Network error");
      const data = await response.json();
      const shuffled = data.questions.sort(() => 0.5 - Math.random());
      allQuestions[subject] = shuffled.slice(0, 30);
      renderQuestions(subject);
    } catch (error) {
      console.error("Failed to load questions:", error);
      alert("Error loading questions for " + subject);
    }
  }

  function renderQuestions(subject) {
    const container = document.getElementById(`${subject}Container`);
    if (!container) {
      console.error(`Missing container for subject: ${subject}`);
      return;
    }

    const questions = allQuestions[subject];
    container.innerHTML = questions.map((q, i) => `
      <div class="mb-4 p-4 bg-white rounded shadow">
        <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
        ${q.options.map(opt => `
          <label class="block">
            <input type="radio" name="${subject}-q${i}" value="${opt}" class="mr-2" />
            ${opt}
          </label>
        `).join("")}
      </div>
    `).join("");
  }

  function startTimer(durationMinutes) {
    let remaining = durationMinutes * 60;
    const display = document.getElementById("timer");
    timerInterval = setInterval(() => {
      const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
      const seconds = (remaining % 60).toString().padStart(2, "0");
      display.textContent = `Time Left: ${minutes}:${seconds}`;
      if (--remaining < 0) {
        clearInterval(timerInterval);
        alert("Time's up! Submitting test.");
        handleSubmit();
      }
    }, 1000);
  }

  async function handleSubmit() {
    clearInterval(timerInterval);

    const answers = {};
    subjects.forEach(subject => {
      answers[subject] = allQuestions[subject].map((q, i) => {
        const selected = document.querySelector(`input[name="${subject}-q${i}"]:checked`);
        return {
          question: q.question,
          selected: selected ? selected.value : "",
          correct: q.correct_answer
        };
      });
    });

    try {
      await addDoc(collection(db, "student_results"), {
        name: studentName,
        email: studentEmail,
        grade: grade,
        submittedAt: new Date(),
        answers: answers
      });
      localStorage.removeItem("studentName");
      localStorage.removeItem("studentEmail");
      localStorage.removeItem("grade");
      window.location.href = "subject-select.html";
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit test. Please try again.");
    }
  }

  // Attach to button
  document.getElementById("submitBtn").addEventListener("click", handleSubmit);

  // Load all subjects
  subjects.forEach(fetchQuestions);

  // Start 30-minute timer
  startTimer(30);
});
