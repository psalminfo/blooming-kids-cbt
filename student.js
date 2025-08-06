import { db, collection, addDoc, serverTimestamp } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get("subject")?.toLowerCase();

  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("studentEmail");
  const grade = localStorage.getItem("grade");

  if (!studentName || !parentEmail || !grade || !subject) {
    alert("Missing student info. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  const gradeNumber = grade.match(/\d+/)[0];
  const file = `${gradeNumber}-${subject}.json`;
  
  let questions = [];

  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`File not found: ${file}`);
    const data = await res.json();
    
    // Randomize the questions and take the first 30
    questions = data.questions.sort(() => 0.5 - Math.random()).slice(0, 30);
    
    renderQuestions(questions);
    startTimer(30);
  } catch (err) {
    console.error("Question fetch error:", err);
    alert(`Could not load questions for ${subject}.`);
  }

  function renderQuestions(qs) {
    const container = document.getElementById("questionContainer");
    if (!container) return;
    container.innerHTML = qs.map((q, i) => `
      <div class="bg-white p-4 rounded shadow mb-4">
        <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
        <div class="options-container">
        ${q.options.map(opt => `
          <label class="block cursor-pointer p-2 rounded hover:bg-gray-100">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2" />${opt}
          </label>`).join("")}
        </div>
      </div>
    `).join("");
  }

  function startTimer(mins) {
    let time = mins * 60;
    const timerEl = document.getElementById("timer");
    if (!timerEl) return;
    const interval = setInterval(() => {
      const m = String(Math.floor(time / 60)).padStart(2, "0");
      const s = String(time % 60).padStart(2, "0");
      timerEl.textContent = `Time Left: ${m}:${s}`;
      if (--time < 0) {
        clearInterval(interval);
        alert("Time is up! Submitting your answers.");
        submitTest();
      }
    }, 1000);
  }

  async function submitTest() {
    // Create a rich array of result objects
    const resultsPayload = questions.map((q, i) => {
      const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
      return {
        questionText: q.question,
        topic: q.topic,
        studentAnswer: selectedInput ? selectedInput.value : "No answer",
        correctAnswer: q.correct_answer
      };
    });

    try {
      // Save the new, self-contained payload to Firebase
      await addDoc(collection(db, "student_results"), {
        studentName,
        parentEmail,
        grade,
        subject,
        answers: resultsPayload, // This now contains everything needed for grading
        submittedAt: serverTimestamp()
      });
      
      alert("Test submitted successfully!");
      window.location.href = "subject-select.html";

    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to submit your test. Please try again.");
    }
  }

  const submitButton = document.getElementById("submitBtn");
  if (submitButton) {
    submitButton.addEventListener("click", submitTest);
  }
});
