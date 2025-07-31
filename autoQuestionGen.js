export async function loadQuestions(subject, grade) {
  const baseUrl = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main';
  const fileName = `${grade}-${subject}.json`; // e.g., 3-Math.json
  const url = `${baseUrl}/${fileName}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("GitHub fetch failed");

    const questions = await response.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No valid questions found");
    }

    // Shuffle and return 30 questions max
    return questions.sort(() => Math.random() - 0.5).slice(0, 30);
  } catch (err) {
    console.error("Error loading questions:", err);
    throw new Error("No questions available");
  }
}
