// Tries local questions first, then GitHub, then Firebase
export async function fetchQuestions(grade, subject) {
  const fileName = `${grade}-${subject.toLowerCase()}.json`;

  // 1. Try local /questions/ folder
  try {
    const local = await fetch(`./questions/${fileName}`);
    if (local.ok) return await local.json();
  } catch (err) {
    console.warn("Local questions not found.", err);
  }

  // 2. Try GitHub
  try {
    const githubURL = `https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/curriculum/curriculum/${fileName}`;
    const github = await fetch(githubURL);
    if (github.ok) return await github.json();
  } catch (err) {
    console.warn("GitHub fallback failed.", err);
  }

  // 3. Try Firebase fallback
  try {
    const res = await fetch(`https://bloomingkidsassessment.web.app/fallback/${fileName}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Firebase fallback failed.", err);
  }

  // All attempts failed
  throw new Error("No questions found for selected grade and subject.");
}
