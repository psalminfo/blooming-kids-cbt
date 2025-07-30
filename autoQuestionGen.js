export async function loadQuestions(subject, grade) {
  let questions = [];

  const githubUrl = `https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/questions/${grade}-${subject}.json`;

  try {
    const response = await fetch(githubUrl);
    if (response.ok) {
      const data = await response.json();
      questions = questions.concat(data);
    }
  } catch (err) {
    console.warn("GitHub fetch failed:", err.message);
  }

  // Fallback to Firebase if GitHub fails or returns nothing
  try {
    const snapshot = await firebase.firestore().collection('questions')
      .where('grade', '==', grade)
      .where('subject', '==', subject)
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data && Array.isArray(data.questions)) {
        questions = questions.concat(data.questions);
      }
    });
  } catch (e) {
    console.warn("Firebase fetch failed:", e.message);
  }

  if (questions.length === 0) {
    throw new Error("No questions available");
  }

  // Shuffle and select 30
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions.slice(0, 30);
}
