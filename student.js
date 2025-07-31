// student.js
import { loadQuestions } from './autoQuestionGen.js';

const params = new URLSearchParams(window.location.search);
const subject = params.get('subject');
const grade = params.get('grade');

if (!subject || !grade) {
  alert("Missing subject or grade. Redirecting...");
  window.location.href = "subject-select.html";
}

async function renderQuestions() {
  try {
    const questions = await loadQuestions(subject, grade);
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'mb-4 p-4 border rounded';
      qDiv.innerHTML = `<p class="font-bold">${index + 1}. ${q.question}</p>`;

      if (q.type === 'multiple-choice') {
        q.options.forEach(opt => {
          const id = `q${index}-${opt}`;
          qDiv.innerHTML += `
            <label for="${id}" class="block">
              <input type="radio" id="${id}" name="q${index}" value="${opt}" class="mr-2">${opt}
            </label>
          `;
        });
      } else {
        qDiv.innerHTML += `
          <textarea name="q${index}" class="w-full border rounded p-2 mt-2" placeholder="Type your answer here..."></textarea>
        `;
      }

      container.appendChild(qDiv);
    });
  } catch (err) {
    document.getElementById('questions-container').innerHTML = `<p class="text-red-500">Failed to load questions: ${err.message}</p>`;
  }
}

document.getElementById("submit-btn").addEventListener("click", () => {
  alert("Test submitted!");
  window.location.href = "subject-select.html";
});

renderQuestions();
