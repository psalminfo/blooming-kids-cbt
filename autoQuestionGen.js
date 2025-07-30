// autoQuestionGen.js

export async function loadQuestions(subject, grade) {
  const githubURL = `https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/questions/${grade}-${subject}.json`;

  let questions = [];

  // Try GitHub first
  try {
    const res = await fetch(githubURL);
    if (res.ok) {
      const data = await res.json();
      questions = questions.concat(data);
    }
  } catch (err) {
    console.warn("GitHub load failed:", err);
  }

  // Then try Firebase
  try {
    const firebaseQuestions = await loadFromFirebase(subject, grade);
    questions = questions.concat(firebaseQuestions);
  } catch (err) {
    console.warn("Firebase load failed:", err);
  }

  // Shuffle and return 30
  if (questions.length === 0) {
    throw new Error("No questions available from any source.");
  }

  return shuffleArray(questions).slice(0, 30);
}

// Utility: Shuffle array
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Load from Firebase Firestore
async function loadFromFirebase(subject, grade) {
  const { db } = await import('./firebaseConfig.js');
  const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js');

  const q = query(
    collection(db, "questions"),
    where("subject", "==", subject),
    where("grade", "==", parseInt(grade))
  );

  const snapshot = await getDocs(q);
  const result = [];
  snapshot.forEach(doc => result.push(...doc.data().questions));
  return result;
}
