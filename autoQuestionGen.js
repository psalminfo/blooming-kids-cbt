// autoQuestionGen.js
import { getDocs, collection } from './firebaseConfig.js';

export async function loadQuestions(subject, grade) {
  const questionFileName = `${grade}-${subject}.json`;
  const githubUrl = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/questions/${questionFileName}`;

  let githubQuestions = [];
  let firebaseQuestions = [];

  // Load from GitHub
  try {
    const res = await fetch(githubUrl);
    if (!res.ok) throw new Error("GitHub fetch failed");
    const data = await res.json();
    if (data.questions && Array.isArray(data.questions)) {
      githubQuestions = data.questions;
    }
  } catch (err) {
    console.error("GitHub fetch failed:", err);
  }

  // Load from Firebase
  try {
    const snapshot = await getDocs(collection(window.db, 'questions'));
    snapshot.forEach(doc => {
      const q = doc.data();
      if (q.grade === grade && q.subject === subject) {
        githubQuestions.push(q); // Append admin questions too
      }
    });
  } catch (err) {
    console.error("Firebase fetch failed:", err);
  }

  // Filter valid questions only
  const valid = githubQuestions.filter(q =>
    q.question && q.type && q.correct_answer && (q.type === 'open-ended' || (Array.isArray(q.options) && q.options.length))
  );

  if (valid.length === 0) throw new Error("No valid questions found");

  // Randomly select 30
  const selected = valid.sort(() => 0.5 - Math.random()).slice(0, 30);
  return selected;
}
