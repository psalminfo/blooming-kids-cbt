function calculatePercentage(score, total) {
  return total === 0 ? 0 : (score / total) * 100;
}

function getLetterGrade(percentage) {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

function formatTimestamp() {
  return new Date().toISOString();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function limitQuestions(questions, count = 30) {
  return shuffleArray(questions).slice(0, count);
}
