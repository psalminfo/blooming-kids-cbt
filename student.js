import { db, auth } from './firebaseConfig.js';

let studentInfo = {};
let selectedSubject = sessionStorage.getItem("selectedSubject") || "Math";
let questions = [];
let answers = {};
let timerInterval;

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("subjectTitle").textContent = selectedSubject;

  // Auth Check
  auth.onAuthStateChanged(async (user) => {
    if (!user) return window.location.href = "login-student.html";
    const uid = user.uid;

    // Fetch student info from Firestore
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return alert("Student profile not found.");

    studentInfo = doc.data();
    loadQuestions(studentInfo.grade, selectedSubject);
    startTimer(30 * 60); // 30 minutes
  });
});

function loadQuestions(grade, subject) {
  const sourceOrder = ["manual", "github", "auto"]; // priority order

  (async function trySources() {
    for (let source of sourceOrder) {
      let fetched = await fetchFromSource(source, grade, subject);
      if (fetched.length >= 30) {
        questions = shuffleArray(fetched).slice(0, 30);
        renderQuestions();
        return;
      }
    }
    alert("No questions available for this subject.");
  })();
}

async function fetchFromSource(source, grade, subject) {
  try {
    if (source === "manual") {
      const snap = await db.collection("manualQuestions")
        .where("grade", "==", grade)
        .where("subject", "==", subject)
        .get();
      return snap.docs.map(doc => doc.data());
    }

    if (source === "github") {
      const url = `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/${grade}/${subject}.json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    }

    if (source === "auto") {
      const snap = await db.collection("autoQuestions")
        .where("grade", "==", grade)
        .where("subject", "==", subject)
        .get();
      return snap.docs.map(doc => doc.data());
    }
  } catch (e) {
    console.warn(`Error from ${source}:`, e);
    return [];
  }
}

function renderQuestions() {
  const container = document.getElementById("questionContainer");
  container.innerHTML = "";

  questions.forEach((q, i) => {
    const block = document.createElement("div");
    block.className = "bg-white p-4 shadow rounded";

    block.innerHTML = `
      <p class="font-semibold text-green-700 mb-2">Q${i + 1}. ${q.question}</p>
      ${q.options.map((opt, idx) => `
        <label class="block">
          <input type="radio" name="q${i}" value="${opt}" required />
          ${opt}
        </label>
      `).join("")}
    `;
    container.appendChild(block);
  });
}

function submitTest() {
  clearInterval(timerInterval);

  const total = questions.length;
  let correct = 0;

  questions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const answer = selected ? selected.value : null;
    answers[`q${i + 1}`] = answer;
    if (answer === q.answer) correct++;
  });

  const score = correct;
  const percent = ((score / total) * 100).toFixed(2);
  const resultData = {
    ...studentInfo,
    subject: selectedSubject,
    score,
    total,
    percent,
    answers,
    timestamp: new Date().toISOString()
  };

  db.collection("testResults").add(resultData).then(() => {
    // Trigger PDF Report generation
    fetch("reportGenerator.js").then(() => {
      console.log("Report generation logic called");
    });

    alert("Test submitted!");
    window.location.href = "subject-select.html";
  }).catch(err => {
    console.error("Submission failed:", err);
    alert("Failed to submit test.");
  });
}

function startTimer(seconds) {
  const timer = document.getElementById("timer");
  timerInterval = setInterval(() => {
    let min = Math.floor(seconds / 60);
    let sec = seconds % 60;
    timer.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
    if (seconds-- <= 0) {
      submitTest();
    }
  }, 1000);
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = "login-student.html";
  });
}

function shuffleArray(arr) {
  return arr.map(a => [Math.random(), a])
            .sort((a, b) => a[0] - b[0])
            .map(a => a[1]);
}
