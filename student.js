import { fetchQuestions } from './autoQuestionGen.js';

let studentData = {};

window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  studentData = {
    name: params.get('name'),
    parentEmail: params.get('parentEmail'),
    tutor: params.get('tutor'),
    location: params.get('location'),
    grade: params.get('grade'),
    subject: params.get('subject')
  };

  if (!studentData.grade || !studentData.subject) {
    alert("Missing subject or grade");
    return;
  }

  try {
    const questions = await fetchQuestions(studentData.grade, studentData.subject);
    displayQuestions(questions);
  } catch (error) {
    document.getElementById("question-area").innerHTML = `<p class="text-red-600">${error.message}</p>`;
  }
};

function displayQuestions(questions) {
  const area = document.getElementById("question-area");
  area.innerHTML = '';
  questions.forEach((q, i) => {
    const block = document.createElement("div");
    block.className = "mb-6 p-4 bg-white rounded shadow";

    const questionText = document.createElement("p");
    questionText.innerHTML = `<strong>Q${i + 1}:</strong> ${q.question}`;
    block.appendChild(questionText);

    q.options.forEach((opt, j) => {
      const label = document.createElement("label");
      label.className = "block ml-4";
      label.innerHTML = `<input type="radio" name="q${i}" value="${opt}"> ${opt}`;
      block.appendChild(label);
    });

    area.appendChild(block);
  });
}
