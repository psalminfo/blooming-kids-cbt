// student.js
import { db, collection, addDoc } from './firebaseConfig.js';

const form = document.getElementById('testForm');
const questionsContainer = document.getElementById('questionsContainer');
const timerEl = document.getElementById('timer');

let allQuestions = [];
let selectedSubject = 'Math';
let remainingTime = 30 * 60; // 30 minutes in seconds

function startTimer() {
  const interval = setInterval(() => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    remainingTime--;
    if (remainingTime < 0) {
      clearInterval(interval);
      submitTest();
    }
  }, 1000);
}

async function fetchQuestions(subject) {
  try {
    const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/3-${subject.toLowerCase()}.json`;
    const response = await fetch(url);
    const data = await response.json();
    allQuestions = data.questions.sort(() => 0.5 - Math.random()).slice(0, 30);
    renderQuestions();
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
}

function renderQuestions() {
  questionsContainer.innerHTML = '';
  allQuestions.forEach((q, index) => {
    const questionEl = document.createElement('div');
    questionEl.classList.add('border', 'p-4', 'rounded', 'shadow-sm');

    const optionsHTML = q.options.map(option => `
      <label class="block">
        <input type="radio" name="q${index}" value="${option}" class="mr-2">
        ${option}
      </label>
    `).join('');

    questionEl.innerHTML = `
      <p class="font-medium mb-2">${index + 1}. ${q.question}</p>
      ${optionsHTML}
    `;

    questionsContainer.appendChild(questionEl);
  });
}

async function submitTest() {
  const answers = {};
  allQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name=q${i}]:checked`);
    answers[`q${i + 1}`] = selected ? selected.value : "";
  });

  try {
    await addDoc(collection(db, "student-submissions"), {
      subject: selectedSubject,
      timestamp: new Date(),
      answers,
    });
    window.location.href = 'subject-select.html';
  } catch (e) {
    console.error("Error submitting test:", e);
    alert("Submission failed. Please try again.");
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  submitTest();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-green-600', 'text-white'));
    btn.classList.add('bg-green-600', 'text-white');
    selectedSubject = btn.dataset.subject;
    fetchQuestions(selectedSubject);
  });
});

// Initial load
fetchQuestions(selectedSubject);
startTimer();
