// autoQuestionGen.js

import { collection, getDocs } from "./firebaseConfig.js";

const fetchFromGitHub = async (grade, subject) => {
  const fileName = `${grade}-${subject}.json`;
  const githubUrl = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/questions/${fileName}`;

  try {
    const response = await fetch(githubUrl);
    if (!response.ok) throw new Error("GitHub fetch failed");
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("GitHub fetch failed:", err);
    throw err;
  }
};

const fetchFromFirebase = async (grade, subject) => {
  try {
    const colRef = collection(firebase.firestore(), `questions/${grade}/${subject}`);
    const snapshot = await getDocs(colRef);
    const data = snapshot.docs.map((doc) => doc.data());
    return data;
  } catch (err) {
    console.error("Firebase fetch failed:", err);
    return [];
  }
};

export const loadQuestions = async (grade, subject) => {
  let allQuestions = [];

  try {
    allQuestions = await fetchFromGitHub(grade, subject);
  } catch (err) {
    allQuestions = await fetchFromFirebase(grade, subject);
  }

  if (!allQuestions || allQuestions.length === 0) {
    throw new Error("No questions available");
  }

  const selected = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
  return selected;
};
