import { auth, db } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generatePDFReport } from './reportGenerator.js';

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const grade = urlParams.get('grade');
const studentName = sessionStorage.getItem('studentName');
const parentEmail = sessionStorage.getItem('parentEmail');
const tutor = sessionStorage.getItem('tutor');
const location = sessionStorage.getItem('location');

document.getElementById('subjectTitle').textContent = subject;

// Timer logic (30 minutes)
let secondsRemaining = 1800;
const timerElement = document.getElementById('timer');
const timerInterval = setInterval(() => {
  const mins = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
  const secs = (secondsRemaining % 60).toString().padStart(2, '0');
  timerElement.textContent = `${mins}:${secs}`;
  if (secondsRemaining <= 0) {
    clearInterval(timerInterval);
    submitTest();
  }
  secondsRemaining--;
}, 1000);

// Load questions (from manual, GitHub, or auto)
async function loadQuestions() {
  const container = document.getElementById('questionContainer');
  const questions = await fetchQuestions(grade, subject);
  questions.forEach((q, index) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'bg-white shadow p-4 rounded-md';
    qDiv.innerHTML = `
      <p class="font-medium mb-2">Q${index + 1}: ${q.question}</p>
      ${q.options.map((opt, i) => `
        <label class="block">
          <input type="radio" name="q${index}" value="${opt}" required class="mr-2" />
          ${opt}
        </label>
      `).join('')}
    `;
    container.appendChild(qDiv);
  });
  sessionStorage.setItem('totalQuestions', questions.length);
  sessionStorage.setItem('questionSet', JSON.stringify(questions));
}
loadQuestions();

window.submitTest = async function () {
  const form = document.getElementById('testForm');
  const formData = new FormData(form);
  const answers = {};
  const total = parseInt(sessionStorage.getItem('totalQuestions'));
  const questionSet = JSON.parse(sessionStorage.getItem('questionSet'));
  let correct = 0;

  questionSet.forEach((q, index) => {
    const answer = formData.get(`q${index}`);
    answers[`q${index + 1}`] = answer || '';
    if (answer && answer === q.answer) correct++;
  });

  const percentage = ((correct / total) * 100).toFixed(2);
  const result = {
    studentName,
    parentEmail,
    tutor,
    location,
    grade,
    subject,
    answers,
    score: `${correct}/${total}`,
    percentage,
    timestamp: new Date().toLocaleString()
  };

  // Save to Firestore
  await addDoc(collection(db, 'results'), {
    ...result,
    createdAt: serverTimestamp()
  });

  // Generate report and upload
  await generatePDFReport(result);

  // Clear session
  sessionStorage.removeItem('questionSet');
  sessionStorage.removeItem('totalQuestions');

  // Redirect
  window.location.href = 'subject-select.html';
};

window.logout = function () {
  sessionStorage.clear();
  auth.signOut().then(() => window.location.href = 'login-student.html');
};

// Fetch fallback
async function fetchQuestions(grade, subject) {
  try {
    const res = await fetch(`./assets/data/curriculum_questions/${grade}_${subject}.json`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Could not fetch from curriculum fallback:', e);
  }
  // fallback random
  return Array.from({ length: 30 }, (_, i) => ({
    question: `Sample question ${i + 1} for ${subject}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: 'Option A'
  }));
}
