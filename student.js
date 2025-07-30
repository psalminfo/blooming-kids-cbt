// ======================= student.js =======================

import { fetchQuestions } from './autoQuestionGen.js';

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const grade = urlParams.get('grade');

const questionContainer = document.getElementById('questionContainer');
const submitBtn = document.getElementById('submitBtn');

if (!subject || !grade) {
  alert('Missing subject or grade. Redirecting...');
  window.location.href = 'index.html';
}

fetchQuestions(grade, subject).then(renderQuestions);

function renderQuestions(questions) {
  if (!questions.length) {
    questionContainer.innerHTML = '<p class="text-red-600">No questions available for this subject and grade.</p>';
    return;
  }

  const html = questions.map((q, i) => `
    <div class="mb-4">
      <p class="font-semibold">${i + 1}. ${q.question}</p>
      ${q.options.map((opt, j) => `
        <label class="block">
          <input type="radio" name="q${i}" value="${opt}" class="mr-2" />${opt}
        </label>`).join('')}
    </div>
  `).join('');

  questionContainer.innerHTML = html;
}

submitBtn.addEventListener('click', () => {
  // Handle answer collection and submission logic here
  alert('Test submitted successfully!');
  window.location.href = 'subject-select.html';
});
