import { auth, db } from './firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Subject mapping by grade
const subjectsByGrade = (grade) => {
  const baseSubjects = ['Math', 'ELA'];
  const scienceSubjects = ['Biology', 'Chemistry', 'Physics'];
  return grade >= 7 ? [...baseSubjects, ...scienceSubjects] : baseSubjects;
};

// Extract query from localStorage or fallback
let studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
let studentGrade = parseInt(studentData.grade);

// DOM refs
const subjectTabs = document.getElementById('subjectTabs');
const logoutBtn = document.getElementById('logoutBtn');

// Render subject buttons
function renderSubjects(subjects) {
  subjectTabs.innerHTML = '';
  subjects.forEach(subject => {
    const btn = document.createElement('button');
    btn.className = 'bg-green-100 border border-green-600 text-green-800 font-semibold py-3 px-4 rounded shadow hover:bg-green-200 transition';
    btn.textContent = subject;
    btn.onclick = () => {
      window.location.href = `student.html?grade=${studentGrade}&subject=${subject}`;
    };
    subjectTabs.appendChild(btn);
  });
}

// Firebase auth check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login-student.html';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      studentGrade = parseInt(data.grade);
      localStorage.setItem('studentData', JSON.stringify(data));
      renderSubjects(subjectsByGrade(studentGrade));
    } else {
      alert('User data not found.');
      window.location.href = 'login-student.html';
    }
  } catch (err) {
    console.error('Error fetching user grade:', err);
    window.location.href = 'login-student.html';
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login-student.html';
});
