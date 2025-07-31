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
    const file = `${grade}-${subject}.json`;
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error("File not found");
      const data = await response.json();
      const shuffled = data.questions.sort(() => 0.5 - Math.random());
      allQuestions[subject] = shuffled.slice(0, 30);
      renderQuestions(subject);
    } catch (error) {
      console.error("Failed to load questions:", error);
      alert(`Could not load ${subject} questions.`);
    }
  }

  function renderQuestions(subject) {
    const container = document.getElementById(`${subject}Container`);
    if (!container) return;
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
      const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
      const seconds = String(remaining % 60).padStart(2, "0");
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
        grade,
        submittedAt: new Date(),
        answers
      });
      localStorage.removeItem("studentName");
      localStorage.removeItem("studentEmail");
      localStorage.removeItem("grade");
      window.location.href = "subject-select.html";
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to submit. Try again.");
    }
  }

  document.getElementById("submitBtn").addEventListener("click", handleSubmit);

  // Load questions
  subjects.forEach(fetchQuestions);
  startTimer(30);

  // Tab functionality
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.subject;
      document.querySelectorAll(".subjectTab").forEach(el => el.classList.add("hidden"));
      document.getElementById(`${target}Container`).classList.remove("hidden");
    });
  });
});
