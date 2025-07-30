// student.js

import { loadQuestions } from './autoQuestionGen.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get('subject');
  const studentName = urlParams.get('student');
  const grade = urlParams.get('grade');
  const parentEmail = urlParams.get('parent');

  if (!subject || !grade || !studentName || !parentEmail) {
    alert("Missing subject or grade. Redirecting...");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "index.html";
  });

  document.getElementById("submitBtn").addEventListener("click", () => {
    alert("Test submitted!");
    window.location.href = `subject-select.html?student=${encodeURIComponent(studentName)}&grade=${grade}&parent=${encodeURIComponent(parentEmail)}`;
  });

  const questionContainer = document.getElementById("questionContainer");
  questionContainer.innerHTML = `<p class="text-center text-gray-600">Loading questions...</p>`;

  try {
    const questions = await loadQuestions(subject, grade);
    renderQuestions(questions);
  } catch (error) {
    questionContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load questions: ${error.message}</p>`;
  }

  function renderQuestions(questions) {
    const html = questions.map((q, index) => `
      <div class="mb-6">
        <p class="font-semibold">${index + 1}. ${q.question}</p>
        ${q.options.map((opt, i) => `
          <label class="block ml-4">
            <input type="radio" name="q${index}" value="${opt}" class="mr-2" />
            ${opt}
          </label>
        `).join('')}
      </div>
    `).join('');

    questionContainer.innerHTML = `
      <form id="testForm" class="space-y-4 overflow-y-auto max-h-[70vh] px-4">
        ${html}
      </form>
    `;
  }
});
