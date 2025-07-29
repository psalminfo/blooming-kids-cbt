import { auth } from './firebaseConfig.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const queryParams = new URLSearchParams(window.location.search);
  const grade = queryParams.get('grade');
  const subject = queryParams.get('subject');

  if (!grade || !subject) {
    window.location.href = 'subject-select.html';
    return;
  }

  // Display subject + grade info
  const subjectHeader = document.getElementById('subjectHeader');
  subjectHeader.textContent = `Grade ${grade} - ${subject} Test`;

  // Handle logout
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'login-student.html';
    });
  });

  // Load and render 30 questions
  loadQuestions(subject, grade);

  // Submit button logic
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.addEventListener('click', () => {
    handleSubmitAnswers();
  });

  // Auth check
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login-student.html';
    }
  });
});

function loadQuestions(subject, grade) {
  const container = document.getElementById('questionContainer');
  for (let i = 1; i <= 30; i++) {
    const box = document.createElement('div');
    box.className = 'bg-white border rounded-xl p-4 mb-4 shadow-md';
    box.innerHTML = `
      <p class="font-medium">Q${i}. [Sample question for ${subject}, Grade ${grade}]</p>
      <div class="grid gap-2 mt-2">
        <label><input type="radio" name="q${i}" value="A"> A. Option A</label>
        <label><input type="radio" name="q${i}" value="B"> B. Option B</label>
        <label><input type="radio" name="q${i}" value="C"> C. Option C</label>
        <label><input type="radio" name="q${i}" value="D"> D. Option D</label>
      </div>
    `;
    container.appendChild(box);
  }
}

function handleSubmitAnswers() {
  // You may add logic to save answers here
  alert('Test submitted successfully.');
  window.location.href = 'subject-select.html';
}
