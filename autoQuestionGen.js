// ======================= autoQuestionGen.js =======================

export async function fetchQuestions(grade, subject) {
  const githubURL = `https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/questions/${grade}-${subject.toLowerCase()}.json`;

  try {
    const response = await fetch(githubURL);
    if (!response.ok) throw new Error('GitHub fetch failed');
    const questions = await response.json();
    return questions;
  } catch (error) {
    console.warn('Falling back to Firebase due to:', error.message);
    return fetchFromFirebase(grade, subject);
  }
}

async function fetchFromFirebase(grade, subject) {
  try {
    const res = await fetch(`/questions/${grade}-${subject.toLowerCase()}.json`);
    if (!res.ok) throw new Error('Firebase local fallback failed');
    const questions = await res.json();
    return questions;
  } catch (error) {
    console.error('No questions available:', error.message);
    return [];
  }
}
