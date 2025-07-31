import { db, collection, addDoc } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get("subject");

  const name = localStorage.getItem("studentName");
  const email = localStorage.getItem("studentEmail");
  const grade = localStorage.getItem("grade");

  if (!name || !email || !grade || !subject) {
    alert("Missing student info. Please log in.");
    window.location.href = "index.html";
    return;
  }

  const file = `${grade}-${subject}.json`;
  let questions = [];

  try {
    const res = await fetch(file);
    const data = await res.json();
    questions = data.questions.sort(() => 0.5 - Math.random()).slice(0, 30);
    renderQuestions(questions);
    startTimer(30);
  } catch (err) {
    console.error("Question fetch error:", err);
    alert("Could not load questions.");
  }

  function renderQuestions(qs) {
    const container = document.getElementById("questionContainer");
    container.innerHTML = qs.map((q, i) => `
      <div class="bg-white p-4 rounded shadow">
        <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
        ${q.options.map(opt => `
          <label class="block">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2" />${opt}
          </label>`).join("")}
      </div>
    `).join("");
  }

  function startTimer(mins) {
    let time = mins * 60;
    const timer = document.getElementById("timer");
    const interval = setInterval(() => {
      const m = String(Math.floor(time / 60)).padStart(2, "0");
      const s = String(time % 60).padStart(2, "0");
      timer.textContent = `Time Left: ${m}:${s}`;
      if (--time < 0) {
        clearInterval(interval);
        alert("Time is up! Submitting...");
        submitTest();
      }
    }, 1000);
  }

  async function submitTest() {
    const answers = questions.map((q, i) => {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      return {
        question: q.question,
        selected: selected ? selected.value : "",
        correct: q.correct_answer
      };
    });

    try {
      await addDoc(collection(db, "student_results"), {
        name,
        email,
        grade,
        subject,
        answers,
        submittedAt: new Date()
      });
      localStorage.removeItem("studentName");
      localStorage.removeItem("studentEmail");
      localStorage.removeItem("grade");
      window.location.href = "subject-select.html";
    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to submit. Try again.");
    }
  }

  document.getElementById("submitBtn").addEventListener("click", submitTest);
});
