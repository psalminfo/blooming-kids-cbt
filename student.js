// student.js
import { loadQuestions } from './autoQuestionGen.js';
import { db, storage } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateReport } from './generateReport.js'; // make sure this function is imported

const params = new URLSearchParams(window.location.search);
const subject = params.get('subject');
const grade = params.get('grade');

const student = localStorage.getItem('bk_studentName');
const parentEmail = localStorage.getItem('bk_parentEmail');
const tutorName = localStorage.getItem('bk_tutorName');
const location = localStorage.getItem('bk_location');

if (!subject || !grade || !student || !parentEmail) {
  alert("Missing info. Redirecting...");
  window.location.href = "subject-select.html";
}

let currentQuestions = [];

async function renderQuestions() {
  try {
    const questions = await loadQuestions(subject, grade);
    currentQuestions = questions;

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

async function handleSubmit() {
  const answers = [];

  currentQuestions.forEach((q, index) => {
    const name = `q${index}`;
    const input = document.querySelector(`[name="${name}"]:checked`) || document.querySelector(`[name="${name}"]`);
    const userAnswer = input ? input.value.trim() : '';
    const isCorrect = userAnswer.toLowerCase() === q.correct_answer.toLowerCase();

    answers.push({
      question: q.question,
      userAnswer,
      correctAnswer: q.correct_answer,
      isCorrect
    });
  });

  const correctCount = answers.filter(ans => ans.isCorrect).length;
  const score = Math.round((correctCount / currentQuestions.length) * 100);

  try {
    // 1. Store results in Firebase
    const resultDoc = await addDoc(collection(db, 'results'), {
      student,
      parentEmail,
      subject,
      grade,
      score,
      totalQuestions: currentQuestions.length,
      answers,
      timestamp: serverTimestamp()
    });

    // 2. Generate PDF and upload
    const url = await generateReport({
      student,
      parentEmail,
      subject,
      grade,
      score,
      totalQuestions: currentQuestions.length,
      tutorName,
      location
    });

    // 3. Add to 'reports' collection (with the generated URL)
    await addDoc(collection(db, 'reports'), {
      student,
      parentEmail,
      subject,
      grade,
      score,
      url,
      timestamp: serverTimestamp()
    });

    alert("Test submitted successfully.");
    window.location.href = "subject-select.html";
  } catch (err) {
    console.error("Error submitting:", err);
    alert("There was an error submitting your test.");
  }
}

document.getElementById("submit-btn").addEventListener("click", handleSubmit);
renderQuestions();
