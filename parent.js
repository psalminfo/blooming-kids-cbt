/**
 * FINAL VERSION: Now performs a case-insensitive comparison.
 * @returns {Promise<{correct: number, total: number, topics: Array<string>}>}
 */
async function calculateScoreFromGitHub(grade, subject, studentAnswers) {
  const baseURL = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/";
  const gradeNumber = grade.match(/\d+/)?.[0] || '1';
  const subjectLower = subject.toLowerCase();
  
  const subjectNameMap = {
      'chemistry': 'chemistry',
      'biology': 'biology',
      'physics': 'physics',
      'math': 'math',
      'english language arts': 'ela',
      'ela': 'ela'
  };
  const subjectForFile = subjectNameMap[subjectLower] || subjectLower;
  const fileName = `${gradeNumber}-${subjectForFile}.json`;
  const fetchURL = baseURL + fileName;

  try {
    const response = await fetch(fetchURL);
    if (!response.ok) {
      console.error(`Could not find answer file at: ${fetchURL}`);
      return { correct: 0, total: 0, topics: [] };
    }
    const data = await response.json();
    if (!data || !data.questions) {
      console.error(`Error: The file ${fileName} is missing the "questions" key.`);
      return { correct: 0, total: 0, topics: [] };
    }

    const correctAnswers = data.questions.map(q => q.correct_answer);
    const topics = [...new Set(data.questions.map(q => q.topic))];

    let score = 0;
    studentAnswers.forEach((answer, index) => {
      // --- THE FINAL FIX IS HERE ---
      // We convert both the student's answer and the correct answer to lowercase before comparing.
      if (index < correctAnswers.length && String(answer).toLowerCase() === String(correctAnswers[index]).toLowerCase()) {
        score++;
      }
    });

    return { correct: score, total: correctAnswers.length, topics: topics };

  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
    return { correct: 0, total: 0, topics: [] };
  }
}
