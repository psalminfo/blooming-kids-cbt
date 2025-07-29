// student.js
import { auth, db } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { fetchQuestions } from './autoQuestionGen.js';

const params = new URLSearchParams(window.location.search);
const subject = params.get('subject');
const studentInfo = JSON.parse(localStorage.getItem('studentInfo'));
const grade = studentInfo?.grade;

document.getElementById('subjectTitle').textContent = `${subject.toUpperCase()} - Grade ${grade}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

let questions = [];
let selectedAnswers = {};
let timer;

loadQuestions();

async function loadQuestions() {
  questions = await fetchQuestions(grade, subject);
  const container = document.getElementById('questionContainer');
  container.innerHTML = '';

  questions.forEach((q, i) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'mb-4';
    qDiv.innerHTML = `
      <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
      ${q.options.map(opt => `
        <label class="block mb-1">
          <input type="radio" name="q${i}" value="${opt}" class="mr-2"/>
          ${opt}
        </label>
      `).join('')}
    `;
    container.appendChild(qDiv);
  });

  startTimer();
}

function startTimer() {
  let time = 30 * 60;
  const display = document.getElementById('timerDisplay');
  timer = setInterval(() => {
    const min = String(Math.floor(time / 60)).padStart(2, '0');
    const sec = String(time % 60).padStart(2, '0');
    display.textContent = `Time: ${min}:${sec}`;
    time--;
    if (time < 0) {
      clearInterval(timer);
      submitTest();
    }
  }, 1000);
}

document.getElementById('submitTestBtn').addEventListener('click', () => {
  clearInterval(timer);
  submitTest();
});

async function submitTest() {
  questions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    selectedAnswers[i] = selected ? selected.value : '';
  });

  let score = 0;
  const skills = {};

  questions.forEach((q, i) => {
    const correct = q.answer.trim().toLowerCase();
    const given = (selectedAnswers[i] || '').trim().toLowerCase();
    if (correct === given) score++;

    const category = q.category || 'General';
    if (!skills[category]) skills[category] = { correct: 0, total: 0 };
    if (correct === given) skills[category].correct++;
    skills[category].total++;
  });

  await addDoc(collection(db, 'results'), {
    student: studentInfo.name,
    parent: studentInfo.parentEmail,
    tutor: studentInfo.tutorName,
    location: studentInfo.location,
    grade,
    subject,
    score,
    outOf: questions.length,
    percentage: ((score / questions.length) * 100).toFixed(2),
    letterGrade: getGrade(score / questions.length),
    skills,
    timestamp: serverTimestamp()
  });

  alert('Test submitted successfully!');
  window.location.href = 'subject-select.html';
}

function getGrade(ratio) {
  if (ratio >= 0.9) return 'A';
  if (ratio >= 0.8) return 'B';
  if (ratio >= 0.7) return 'C';
  if (ratio >= 0.6) return 'D';
  return 'F';
}
