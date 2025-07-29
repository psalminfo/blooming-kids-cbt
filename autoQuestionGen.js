export async function getQuestions(subject, grade) {
  const githubUrl = `https://raw.githubusercontent.com/psalminfo/bkh-curriculum/main/curriculum/curriculum/${grade}-${subject.toLowerCase()}.json`;

  try {
    const response = await fetch(githubUrl);
    if (!response.ok) throw new Error("GitHub fallback failed");
    const data = await response.json();
    return shuffleArray(data).slice(0, 30);
  } catch (e) {
    console.warn("GitHub fetch failed, using local fallback.");
    return [];
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
