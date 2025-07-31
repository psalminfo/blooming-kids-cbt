import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ✅ Global variables
let student = "";
let parentEmail = "";
let grade = "";
let subject = "";
let currentQuestions = [];

// ✅ Load user info from localStorage
window.addEventListener("DOMContentLoaded", async () => {
  student = localStorage.getItem("studentName") || "";
  parentEmail = localStorage.getItem("parentEmail") || "";
  grade = localStorage.getItem("grade") || "";
  subject = localStorage.getItem("subject") || "";

  if (!student || !parentEmail || !grade || !subject) {
    alert("Missing student or subject info. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("studentName").textContent = student;
  document.getElementById("subjectName").textContent = subject.toUpperCase();

  await loadQuestions();
});

// ✅ Load questions from GitHub
async function loadQuestions() {
  const fileName = `${grade}-${subject.toLowerCase()}.json`;
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error("Invalid question format.");
    }

    currentQuestions = shuffleArray(data.questions).slice(0, 30);
    renderQuestions();
  } catch (err) {
    console.error("Failed to load questions:", err);
    alert("Could not load questions. Please contact support.");
  }
}

// ✅ Shuffle function
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ✅ Render questions to the DOM
function renderQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";

  currentQuestions.forEach((q, index) => {
    const questionBlock = document.createElement("div");
    questionBlock.className = "mb-6 p-4 bg-white shadow rounded";

    const questionText = document.createElement("p");
    questionText.className = "mb-2 font-semibold";
    questionText.textContent = `${index + 1}. ${q.question}`;
    questionBlock.appendChild(questionText);

    if (q.type === "multiple-choice") {
      q.options.forEach((option, i) => {
        const optionId = `q${index}_opt${i}`;
        const optionLabel = document.createElement("label");
        optionLabel.className = "block mb-1";

        const optionInput = document.createElement("input");
        optionInput.type = "radio";
        optionInput.name = `q${index}`;
        optionInput.value = option;
        optionInput.className = "mr-2";

        optionLabel.appendChild(optionInput);
        optionLabel.appendChild(document.createTextNode(option));
        questionBlock.appendChild(optionLabel);
      });
    } else if (q.type === "short-answer") {
      const input = document.createElement("input");
      input.type = "text";
      input.name = `q${index}`;
      input.className = "w-full mt-2 p-2 border rounded";
      questionBlock.appendChild(input);
    }

    container.appendChild(questionBlock);
  });
}

// ✅ Handle test submission
document.getElementById("submitBtn").addEventListener("click", async () => {
  const answers = [];

  currentQuestions.forEach((q, index) => {
    const input = document.querySelector(`[name="q${index}"]:checked`) || document.querySelector(`[name="q${index}"]`);
    const userAnswer = input ? input.value.trim() : '';
    const isCorrect = userAnswer.toLowerCase() === q.correct_answer.toLowerCase();

    answers.push({
      question: q.question,
      userAnswer,
      correctAnswer: q.correct_answer,
      isCorrect
    });
  });

  const correctCount = answers.filter(ans => ans.isCorrect).length;
  const score = Math.round((correctCount / currentQuestions.length) * 100);

  try {
    await addDoc(collection(db, 'results'), {
      student,
      parentEmail,
      subject,
      grade,
      score,
      totalQuestions: currentQuestions.length,
      answers,
      timestamp: serverTimestamp()
    });

    alert("Test submitted successfully.");
    window.location.href = "subject-select.html";
  } catch (err) {
    console.error("Error submitting:", err);
    alert("There was an error submitting your test.");
  }
});

// ✅ Handle logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    localStorage.clear();
    window.location.href = "index.html";
  });
});
