import { db, storage } from './firebaseConfig.js';
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { collection, getDocs } from "firebase/firestore";

let questionCache = {};

export async function loadQuestions(grade, subject) {
  const key = `${grade}_${subject}`;
  if (questionCache[key]) return questionCache[key];

  const allQuestions = [];

  // 1. From Admin-uploaded JSON
  try {
    const querySnap = await getDocs(collection(db, `questions/${grade}/${subject}`));
    querySnap.forEach(doc => allQuestions.push(...doc.data().questions));
  } catch (e) {}

  // 2. From GitHub curriculum (simulate as fallback)
  try {
    const ghURL = `/curriculum/${grade}/${subject}.json`; // Must be pre-stored locally or via API proxy
    const res = await fetch(ghURL);
    const ghQuestions = await res.json();
    allQuestions.push(...ghQuestions);
  } catch (e) {}

  // 3. From default randomized backup
  if (allQuestions.length < 30) {
    for (let i = allQuestions.length; i < 30; i++) {
      allQuestions.push({
        question: `Auto-generated fallback question ${i + 1} for ${subject}`,
        options: ["A", "B", "C", "D"],
        answer: "A"
      });
    }
  }

  const selected = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
  questionCache[key] = selected;
  return selected;
}
