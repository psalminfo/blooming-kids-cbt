let studentInfo = {};
let timerInterval;

document.getElementById('studentLoginForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('accessCode').value.trim();
  if (code !== 'bkh2025') return alert('Invalid Access Code');

  studentInfo = {
    studentName: document.getElementById('studentName').value,
    parentEmail: document.getElementById('parentEmail').value,
    grade: document.getElementById('grade').value,
    tutorName: document.getElementById('tutorName').value,
    location: document.getElementById('location').value
  };
  localStorage.setItem('studentInfo', JSON.stringify(studentInfo));
  window.location.href = 'student.html';
});

if (window.location.pathname.includes('student.html')) {
  const info = JSON.parse(localStorage.getItem('studentInfo'));
  if (!info) window.location.href = 'login-student.html';

  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startTest(btn.dataset.subject);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('studentInfo');
    window.location.href = 'login-student.html';
  });
}

function startTest(subject) {
  document.getElementById('subjectSelection').classList.add('hidden');
  document.getElementById('testArea').classList.remove('hidden');
  document.getElementById('testTitle').textContent = subject + ' Assessment';
  startTimer(30 * 60);
  loadQuestions(subject);
}

function startTimer(seconds) {
  const timerEl = document.getElementById('timer');
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    timerEl.textContent = `${min}:${sec}`;
    if (--seconds < 0) {
      clearInterval(timerInterval);
      submitTest();
    }
  }, 1000);
}

function loadQuestions(subject) {
  const form = document.getElementById('testForm');
  form.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    form.innerHTML += `
      <div class="border p-4 rounded">
        <p class="mb-2 font-medium">${i}. Sample question for ${subject}?</p>
        ${['A', 'B', 'C', 'D'].map(opt => `
          <label class="block">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2"/>
            Option ${opt}
          </label>
        `).join('')}
      </div>
    `;
  }
}

document.getElementById('submitTestBtn')?.addEventListener('click', () => {
  submitTest();
});

function submitTest() {
  alert('Test Submitted!');
  document.getElementById('testArea').classList.add('hidden');
  document.getElementById('subjectSelection').classList.remove('hidden');
  clearInterval(timerInterval);
}
