import { db, collection, addDoc, serverTimestamp } from "./firebaseConfig.js"; // Added serverTimestamp for consistency

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get("subject")?.toLowerCase(); // Standardize to lowercase

  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("studentEmail");
  const grade = localStorage.getItem("grade");

  if (!studentName || !parentEmail || !grade || !subject) {
    alert("Missing student info. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  // --- BUG FIX #1: Correctly format the filename ---
  const gradeNumber = grade.match(/\d+/)[0]; // Extracts "3" from "Grade 3"
  const file = `${gradeNumber}-${subject}.json`;
  
  let questions = []; // This will hold the questions for the current test

  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`File not found: ${file}`);
    const data = await res.json();
    // Randomize and take up to 30 questions
    questions = data.questions.sort(() => 0.5 - Math.random()).slice(0, 30);
    renderQuestions(questions);
    startTimer(30); // 30-minute timer
  } catch (err) {
    console.error("Question fetch error:", err);
    alert(`Could not load questions for ${subject}. Please check the subject name and file.`);
  }

  function renderQuestions(qs) {
    const container = document.getElementById("questionContainer");
    if (!container) return;
    // This part is correct, it sets the radio button value to the full text of the option
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
    // --- BUG FIX #2: Create a simple array of the selected answer strings ---
    const answers = questions.map((q, i) => {
      const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
      // Return the value of the selected input, or "No answer" if none was selected
      return selectedInput ? selectedInput.value : "No answer";
    });

    try {
      // Save the simple, correct data format to Firestore
      await addDoc(collection(db, "student_results"), {
        studentName, // Ensure field names match parent portal expectations
        parentEmail,
        grade,
        subject,
        answers, // This is now the simple array of strings
        submittedAt: serverTimestamp()
      });

      // Clear local storage for the next student
      localStorage.removeItem("studentName");
      localStorage.removeItem("studentEmail");
      localStorage.removeItem("grade");
      
      alert("Test submitted successfully!");
      window.location.href = "subject-select.html"; // Redirect after submission

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
