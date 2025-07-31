// autoQuestionGen.js
import { db, collection, getDocs } from "./firebaseConfig.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/questions";

export async function loadQuestions(subject, grade) {
  const questionContainer = document.getElementById("question-container");
  questionContainer.innerHTML = `<p class="text-gray-600">Loading questions...</p>`;

  const filename = `${grade}-${subject}`.toLowerCase();
  const githubURL = `${GITHUB_BASE}/${filename}.json`;

  try {
    const res = await fetch(githubURL);
    if (!res.ok) throw new Error("GitHub fetch failed");
    const data = await res.json();
    displayQuestions(data.questions);
  } catch (err) {
    console.warn("GitHub failed, trying Firebase...", err);
    try {
      const snapshot = await getDocs(collection(db, "questions"));
      const questions = [];
      snapshot.forEach(doc => {
        const q = doc.data();
        if (q.subject === subject && q.grade == grade) {
          questions.push(q);
        }
      });
      displayQuestions(questions);
    } catch (fbErr) {
      questionContainer.innerHTML = `<p class="text-red-600">❌ Could not load questions.</p>`;
      console.error("Firebase error:", fbErr);
    }
  }
}

function displayQuestions(questions) {
  const container = document.getElementById("question-container");
  if (!questions || questions.length === 0) {
    container.innerHTML = `<p class="text-red-600">❌ No questions available.</p>`;
    return;
  }

  container.innerHTML = questions.map((q, i) => `
    <div class="bg-white border border-gray-200 p-4 rounded shadow">
      <p class="font-medium mb-2">${i + 1}. ${q.question}</p>
      ${q.options.map((opt, j) => `
        <label class="block ml-4 mb-1">
          <input type="radio" name="q${i}" value="${opt}" class="mr-2">
          ${opt}
        </label>
      `).join("")}
    </div>
  `).join("");
}
