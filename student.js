import { auth, db } from './firebaseConfig.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { autoGenerateQuestions } from './autoQuestionGen.js';

const tabsContainer = document.getElementById('tabsContainer');
const questionForm = document.getElementById('questionForm');
const submitBtn = document.getElementById('submitBtn');
const logoutBtn = document.getElementById('logoutBtn');

const gradeSubjects = {
  3: ['Math', 'ELA'],
  4: ['Math', 'ELA'],
  5: ['Math', 'ELA'],
  6: ['Math', 'ELA'],
  7: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  8: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  9: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  10: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  11: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics'],
  12: ['Math', 'ELA', 'Biology', 'Chemistry', 'Physics']
};

let currentStudent = {};
let selectedSubject = null;
let loadedQuestions = [];

onAuthStateChanged(auth, async user => {
  if (!user) location.href = 'login.html';

  const studentDoc = await getDoc(doc(db, "students", user.uid));
  currentStudent = studentDoc.data();
  document.getElementById('studentName').textContent = currentStudent.name;
  loadSubjectTabs();
});

logoutBtn.onclick = () => {
  signOut(auth).then(() => location.href = "login.html");
};

function loadSubjectTabs() {
  const subjects = gradeSubjects[currentStudent.grade];
  tabsContainer.innerHTML = subjects.map(subj =>
    `<button class="tab-btn" onclick="selectSubject('${subj}')">${subj}</button>`
  ).join('');
}

window.selectSubject = async (subject) => {
  selectedSubject = subject;
  loadedQuestions = await autoGenerateQuestions(currentStudent.grade, subject);
  renderQuestions();
};

function renderQuestions() {
  questionForm.innerHTML = loadedQuestions.map((q, i) =>
    `<div class="question-block">
      <p><strong>${i + 1}. ${q.question}</strong></p>
      ${q.options.map((opt, j) => `
        <label>
          <input type="radio" name="q${i}" value="${opt}">
          ${opt}
        </label>
      `).join('')}
    </div>`
  ).join('');
}

submitBtn.onclick = (e) => {
  e.preventDefault();
  // Optionally: store answers or trigger backend logic here
  alert("Test submitted!");
  location.href = "subject-select.html";
};
