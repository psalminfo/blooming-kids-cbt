import { auth } from './firebaseConfig.js';
import { getQuestions } from './autoQuestionGen.js';

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');

document.getElementById('logoutBtn').onclick = () => {
  localStorage.removeItem('studentData');
  window.location.href = 'index.html';
};

const questionContainer = document.getElementById('questionContainer');
const timerDisplay = document.getElementById('timer');
const submitBtn = document.getElementById('submitTestBtn');

let timer;
let countdown = 1800; // 30 minutes

function startTimer() {
  timer = setInterval(() => {
    countdown--;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    if (countdown <= 0) {
      clearInterval(timer);
      submitTest();
    }
  }, 1000);
}

function submitTest() {
  clearInterval(timer);
  alert("Test submitted successfully.");
  window.location.href = 'subject-select.html';
}

submitBtn.addEventListener('click', submitTest);

async function renderQuestions() {
  if (!subject || !studentData.grade) {
    alert("Missing subject or student info.");
    return;
  }

  const questions = await getQuestions(subject, studentData.grade);
  if (!questions.length) {
    questionContainer.innerHTML = "<p class='text-red-500'>No questions found.</p>";
    return;
  }

  questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = "mb-4 p-4 border rounded bg-white shadow-sm";
    div.innerHTML = `
      <p class="font-semibold">${i + 1}. ${q.question}</p>
      ${q.options.map((opt, idx) => `
        <label class="block">
          <input type="radio" name="q${i}" value="${opt}" class="mr-2" />
          ${opt}
        </label>
      `).join('')}
    `;
    questionContainer.appendChild(div);
  });

  startTimer();
}

renderQuestions();
