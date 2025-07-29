import { db } from "./firebaseConfig.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { generateReportAndUpload } from "./reportGenerator.js";
import { fetchQuestions } from "./questionBank.js";

const form = document.getElementById("testForm");
const timerDisplay = document.getElementById("timer");
const studentName = localStorage.getItem("bk_studentName");
const subject = localStorage.getItem("bk_subject");
const grade = localStorage.getItem("bk_grade");
const studentData = {
  studentName,
  subject,
  grade,
  parentEmail: localStorage.getItem("bk_parentEmail"),
  tutor: localStorage.getItem("bk_tutor"),
  location: localStorage.getItem("bk_location"),
};

document.getElementById("studentNameDisplay").innerText = studentName;
document.getElementById("subjectLabel").innerText = subject;

let timeLeft = 30 * 60;
let timerInterval;
let questions = [];

function startTimer() {
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitAnswers();
    }
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    timeLeft--;
  }, 1000);
}

async function loadQuestions() {
  try {
    questions = await fetchQuestions(grade, subject);
    form.innerHTML = "";

    questions.slice(0, 30).forEach((q, i) => {
      const block = document.createElement("div");
      block.className = "bg-white p-4 rounded shadow";
      block.innerHTML = `
        <p class="mb-2 font-semibold">${i + 1}. ${q.question}</p>
        ${q.options
          .map(
            (opt, idx) =>
              `<label class="block mb-1">
                <input type="radio" name="q${i}" value="${opt}" required />
                ${opt}
              </label>`
          )
          .join("")}
      `;
      form.appendChild(block);
    });
  } catch (err) {
    alert("Error loading questions.");
    console.error(err);
  }
}

async function submitAnswers() {
  clearInterval(timerInterval);
  const responses = [];
  let correct = 0;

  questions.slice(0, 30).forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const answer = selected ? selected.value : "";
    responses.push({
      question: q.question,
      selected: answer,
      correctAnswer: q.answer,
    });
    if (answer === q.answer) correct++;
  });

  const resultData = {
    ...studentData,
    responses,
    subject,
    grade,
    score: correct,
    total: 30,
    percent: ((correct / 30) * 100).toFixed(2),
    timestamp: Timestamp.now(),
  };

  await addDoc(collection(db, "testResults"), resultData);
  await generateReportAndUpload(resultData);

  localStorage.removeItem("bk_subject");
  alert("Submitted!");
  window.location.href = "subject-select.html";
}

window.logout = function () {
  localStorage.clear();
  window.location.href = "login-student.html";
};

loadQuestions();
startTimer();
