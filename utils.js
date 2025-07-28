export function gradePercentage(score, total) {
  const percent = Math.round((score / total) * 100);
  let letter = 'F';
  if (percent >= 90) letter = 'A';
  else if (percent >= 80) letter = 'B';
  else if (percent >= 70) letter = 'C';
  else if (percent >= 60) letter = 'D';
  return { percent, letter };
}

export function shuffleArray(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

export function extractBreakdown(questions, answers) {
  const map = {};
  questions.forEach((q, i) => {
    const cat = q.category || 'Other';
    map[cat] = map[cat] || { correct: 0, total: 0 };
    map[cat].total += 1;
    if (q.correct === answers[i]) map[cat].correct += 1;
  });

  return Object.entries(map).map(([category, { correct, total }]) => {
    const percent = Math.round((correct / total) * 100);
    return { category, correct, total, percent: `${percent}%` };
  });
}
