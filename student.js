import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';

const subjectsByGrade = {
  3: ['Math', 'ELA'],
  4: ['Math', 'ELA'],
  5: ['Math', 'ELA'],
  6: ['Math', 'ELA'],
  7: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  8: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  9: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  10: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  11: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  12: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics']
};

const studentInfo = JSON.parse(localStorage.getItem('studentInfo')) || {};
const grade = studentInfo.grade;
const subjectButtonsContainer = document.getElementById('subjectButtonsContainer');
const questionPanel = document.getElementById('questionPanel');
const questionList = document.getElementById('questionList');
const subjectTitle = document.getElementById('subjectTitle');
const timerDisplay = document.getElementById('timer');
const logoutBtn = document.getElementById('logoutBtn');

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('studentInfo');
  window.location.href = 'index.html';
});

if (!grade || !subjectsByGrade[grade]) {
  alert('Invalid grade. Please log in again.');
  window.location.href = 'index.html';
}

subjectsByGrade[grade].forEach(subject => {
  const btn = document.createElement('button');
  btn.textContent = subject;
  btn.className = 'bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700';
  btn.addEventListener('click', () => loadSubject(subject));
  subjectButtonsContainer.appendChild(btn);
});

let currentSubject = '';
let answers = {};
let timer = null;
let remainingTime = 1800;

function loadSubject(subject) {
  currentSubject = subject;
  subjectTitle.textContent = `${subject} (Grade ${grade})`;
  subjectButtonsContainer.classList.add('hidden');
  questionPanel.classList.remove('hidden');
  questionList.innerHTML = '';
  answers = {};
  remainingTime = 1800;
  updateTimer();

  getQuestionSet(subject).then(questions => {
    questions.slice(0, 30).forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'p-4 border rounded bg-white';
      div.innerHTML = `
        <p class="font-medium">${i + 1}. ${q.question}</p>
        ${q.options.map((opt, idx) =>
          `<label class="block mt-1">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2" />
            ${opt}
          </label>`).join('')}
      `;
      questionList.appendChild(div);
    });
  });

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    remainingTime--;
    updateTimer();
    if (remainingTime <= 0) handleSubmit();
  }, 1000);
}

function updateTimer() {
  const mins = Math.floor(remainingTime / 60);
  const secs = remainingTime % 60;
  timerDisplay.textContent = `Time Left: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

document.getElementById('submitBtn').addEventListener('click', handleSubmit);

function handleSubmit() {
  const radioButtons = document.querySelectorAll('input[type="radio"]:checked');
  radioButtons.forEach(rb => {
    const qIndex = rb.name.replace('q', '');
    answers[qIndex] = rb.value;
  });

  saveResult(currentSubject, answers);
  alert('Test submitted!');
  questionPanel.classList.add('hidden');
  subjectButtonsContainer.classList.remove('hidden');
  clearInterval(timer);
}

function saveResult(subject, answers) {
  const resultData = {
    student: studentInfo.name,
    parent: studentInfo.email,
    tutor: studentInfo.tutor,
    location: studentInfo.location,
    grade: grade,
    subject,
    answers,
    timestamp: new Date().toISOString()
  };
  console.log('Saving result...', resultData);
  // You’ll replace this with real Firestore write + report generation
}

async function getQuestionSet(subject) {
  // Simulated fallback (replace with real GitHub / Firestore fetch)
  const fallback = [
    { question: `Sample ${subject} question 1`, options: ['A', 'B', 'C', 'D'] },
    { question: `Sample ${subject} question 2`, options: ['A', 'B', 'C', 'D'] },
    // ...
  ];
  return [...Array(30)].map((_, i) => ({
    question: `Sample ${subject} question ${i + 1}`,
    options: ['A', 'B', 'C', 'D']
  }));
}
