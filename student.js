import { db } from './firebaseConfig.js';
import {
  doc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { fetchQuestions } from './autoQuestionGen.js';

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const grade = localStorage.getItem('grade');
const studentId = localStorage.getItem('studentId');
const studentName = localStorage.getItem('studentName');

if (!subject || !grade || !studentId) {
  alert('Missing subject or grade. Redirecting...');
  window.location.href = 'subject-select.html';
}

document.getElementById('subjectTitle').textContent = `Subject: ${subject}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

const testForm = document.getElementById('testForm');

// Load and display questions
fetchQuestions(grade, subject).then(questions => {
  if (!questions || questions.length === 0) {
    testForm.innerHTML = '<p class="text-red-600">No questions found for this subject.</p>';
    return;
  }

  questions.forEach((q, index) => {
    const qBlock = document.createElement('div');
    qBlock.className = 'border p-4 rounded bg-gray-50';
    qBlock.innerHTML = `
      <p class="font-semibold mb-2">${index + 1}. ${q.question}</p>
      ${q.options.map((opt, i) => `
        <label class="block">
          <input type="radio" name="q${index}" value="${opt}" class="mr-2" required>
          ${opt}
        </label>
      `).join('')}
    `;
    testForm.appendChild(qBlock);
  });
});

// Submit test
document.getElementById('submitBtn').addEventListener('click', async () => {
  const formData = new FormData(testForm);
  const answers = [];

  for (let i = 0; i < 30; i++) {
    const ans = formData.get(`q${i}`);
    answers.push(ans || '');
  }

  try {
    await updateDoc(doc(db, 'students', studentId), {
      [subject]: {
        answers,
        submittedAt: serverTimestamp()
      }
    });

    alert('Test submitted successfully!');
    window.location.href = 'subject-select.html';
  } catch (err) {
    console.error('Submit error:', err);
    alert('Failed to submit test. Try again.');
  }
});
