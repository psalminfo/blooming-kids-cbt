// autoQuestionGen.js

const GITHUB_REPO = "psalminfo/blooming-kids-cbt";
const QUESTIONS_FOLDER = "questions"; // main folder in the GitHub repo

// Fetch questions from GitHub
async function fetchFromGitHub(subject, grade) {
  const fileName = `${grade}-${subject}.json`;
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${QUESTIONS_FOLDER}/${fileName}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("GitHub fetch failed");
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn("GitHub fetch failed:", err);
    return [];
  }
}

// Fetch from Firebase (admin uploads)
async function fetchFromFirebase(subject, grade) {
  try {
    const snapshot = await getDocs(collection(db, "questions"));
    const questions = [];
    snapshot.forEach(doc => {
      const q = doc.data();
      if (q.subject === subject && q.grade === grade) {
        questions.push(...q.questions);
      }
    });
    return questions;
  } catch (err) {
    console.warn("Firebase fetch failed:", err);
    return [];
  }
}

// Combined fetch
export async function loadQuestions(subject, grade) {
  if (!subject || !grade) throw new Error("Missing subject or grade");

  const fromGitHub = await fetchFromGitHub(subject, grade);
  const fromFirebase = await fetchFromFirebase(subject, grade);

  const combined = [...fromGitHub, ...fromFirebase];
  if (combined.length === 0) throw new Error("No questions available");

  // Shuffle and pick 30
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.slice(0, 30);
}
