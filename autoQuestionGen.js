// autoQuestionGen.js

// GitHub raw path to your /questions/ folder
const GITHUB_BASE = "https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/questions/";

// Firebase fallback (if needed)
import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

async function fetchGitHubQuestions(grade, subject) {
  const url = `${GITHUB_BASE}${grade}-${subject}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("GitHub fetch failed");
    const data = await res.json();
    return data.questions || data;
  } catch (err) {
    console.warn("GitHub fallback failed:", err);
    return [];
  }
}

async function fetchFirebaseQuestions(grade, subject) {
  try {
    const querySnapshot = await getDocs(collection(db, `questions-${grade}-${subject}`));
    const questions = [];
    querySnapshot.forEach(doc => questions.push(doc.data()));
    return questions;
  } catch (err) {
    console.warn("Firebase fetch failed:", err);
    return [];
  }
}

export async function generateQuestions(grade, subject) {
  const github = await fetchGitHubQuestions(grade, subject);
  const firebase = await fetchFirebaseQuestions(grade, subject);
  const combined = [...github, ...firebase];

  if (combined.length === 0) {
    alert("No questions found for this subject.");
    return [];
  }

  // Shuffle and return 30
  const shuffled = combined.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 30);
}
