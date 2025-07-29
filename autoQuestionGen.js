// autoQuestionGen.js
import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

export async function fetchQuestions(grade, subject) {
  try {
    const githubUrl = `https://raw.githubusercontent.com/yourgithubusername/curriculum/main/${grade}-${subject}.json`;
    const res = await fetch(githubUrl);
    if (res.ok) {
      const data = await res.json();
      return shuffleArray(data).slice(0, 30);
    }
  } catch (e) {
    console.warn('GitHub fallback triggered');
  }

  try {
    const localRes = await fetch(`questions/${grade}-${subject}.json`);
    if (localRes.ok) {
      const data = await localRes.json();
      return shuffleArray(data).slice(0, 30);
    }
  } catch (e) {
    console.warn('Local fallback failed');
  }

  const fallbackCol = collection(db, 'questions');
  const snapshot = await getDocs(fallbackCol);
  const fallbackQuestions = [];
  snapshot.forEach(doc => {
    const q = doc.data();
    if (q.grade === grade && q.subject === subject) fallbackQuestions.push(q);
  });

  return shuffleArray(fallbackQuestions).slice(0, 30);
}

function shuffleArray(arr) {
  return arr.sort(() => 0.5 - Math.random());
}
