// student.js

import { db, collection, addDoc } from './firebaseConfig.js';

const urlParams = new URLSearchParams(window.location.search);
const grade = urlParams.get('grade');
const subject = urlParams.get('subject');
const studentName = localStorage.getItem('studentName');
const parentEmail = localStorage.getItem('parentEmail');

// GitHub raw file path, questions are named like "3-math.json"
const jsonURL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject}.json`;

const questionsContainer = document.getElementById('questions');
const submitBtn = document.getElementById('submitTest');

let selectedQuestions = [];

fetch(jsonURL)
  .then(res => res.json())
  .then(data => {
    selectedQuestions = shuffleArray(data.questions).slice(0, 30);
    displayQuestions(selectedQuestions);
  })
  .catch(err => {
    console.error('Failed to load questions:', err);
    questionsContainer.innerHTML = '<p class="text-red-500">Error loading questions.</p>';
  });

function displayQuestions(questions) {
  questionsContainer.innerHTML = '';
  questions.forEach((q, index) => {
    const optionsHTML = q.options.map((opt, i) => `
      <label class="block">
        <input type="radio" name="q${index}" value="${opt}" class="mr-2">
        ${opt}
      </label>
    `).join('');

    questionsContainer.innerHTML += `
      <div class="mb-6 p-4 border rounded">
        <p class="font-semibold mb-2">${index + 1}. ${q.question}</p>
        ${optionsHTML}
      </div>
    `;
  });
}

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

submitBtn.addEventListener('click', async () => {
  const responses = selectedQuestions.map((q, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    return {
      question: q.question,
      selectedAnswer: selected ? selected.value : 'No Answer',
      correctAnswer: q.correct_answer
    };
  });

  try {
    await addDoc(collection(db, 'testResults'), {
      studentName,
      parentEmail,
      grade,
      subject,
      responses,
      submittedAt: new Date().toISOString()
    });

    alert('Test submitted successfully.');
    window.location.href = 'subject-select.html';
  } catch (err) {
    console.error('Submission error:', err);
    alert('Failed to submit test.');
  }
});
