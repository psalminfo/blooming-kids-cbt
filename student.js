// student.js
import { auth, db } from './firebaseConfig.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  setDoc,
  collection,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { logout } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('submitBtn').addEventListener('click', submitAnswers);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadQuestions(user);
    } else {
      window.location.href = 'login-student.html';
    }
  });
});

function loadQuestions(user) {
  const subject = new URLSearchParams(window.location.search).get('subject') || 'Math';
  document.getElementById('subjectTitle').textContent = subject;

  const form = document.getElementById('testForm');
  for (let i = 1; i <= 30; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-white p-4 rounded shadow';
    wrapper.innerHTML = `
      <label class="block font-semibold mb-2">Q${i}. What is ${i}+${i}?</label>
      <input type="text" name="q${i}" class="w-full p-2 border border-gray-300 rounded" />
    `;
    form.appendChild(wrapper);
  }
}

function submitAnswers() {
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(document.getElementById('testForm'));
  const answers = {};
  formData.forEach((value, key) => {
    answers[key] = value;
  });

  const subject = new URLSearchParams(window.location.search).get('subject') || 'Math';

  const resultRef = doc(collection(db, 'testResults'));
  setDoc(resultRef, {
    student: user.email,
    subject,
    answers,
    score: 0,
    submittedAt: serverTimestamp()
  }).then(() => {
    alert('Submitted!');
    window.location.href = 'subject-select.html';
  });
}
