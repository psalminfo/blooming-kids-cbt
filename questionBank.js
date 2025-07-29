import { db } from "./firebaseConfig.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// GitHub Fallback URL (optional curriculum data from GitHub)
const curriculumSources = {
  uk: "https://raw.githubusercontent.com/your-org/bkh-curriculum/main/uk.json",
  texas: "https://raw.githubusercontent.com/your-org/bkh-curriculum/main/texas.json",
  canada: "https://raw.githubusercontent.com/your-org/bkh-curriculum/main/canada.json"
};

export async function fetchQuestions(grade, subject) {
  let results = [];

  // 1. Manual questions from Firestore
  try {
    const qRef = collection(db, "manualQuestions");
    const qQuery = query(qRef, where("grade", "==", grade), where("subject", "==", subject));
    const qSnap = await getDocs(qQuery);
    qSnap.forEach(doc => results.push(doc.data()));
  } catch (e) {
    console.warn("Error loading manual questions:", e.message);
  }

  // 2. Auto-generated questions from Firestore
  try {
    const aRef = collection(db, "autoQuestions");
    const aQuery = query(aRef, where("grade", "==", grade), where("subject", "==", subject));
    const aSnap = await getDocs(aQuery);
    aSnap.forEach(doc => results.push(doc.data()));
  } catch (e) {
    console.warn("Error loading auto questions:", e.message);
  }

  // 3. GitHub fallback (if needed)
  try {
    const curriculumKeys = ["uk", "texas", "canada"];
    for (const key of curriculumKeys) {
      const res = await fetch(curriculumSources[key]);
      if (res.ok) {
        const json = await res.json();
        const match = json.filter(q => q.grade === grade && q.subject === subject);
        results.push(...match);
      }
    }
  } catch (e) {
    console.warn("Error loading from GitHub:", e.message);
  }

  if (results.length === 0) {
    throw new Error("No questions found for this subject and grade.");
  }

  // Shuffle and return 30
  return results.sort(() => 0.5 - Math.random()).slice(0, 30);
}
