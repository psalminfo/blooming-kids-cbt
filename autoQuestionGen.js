export async function loadQuestions(subject, grade) {
  const container = document.getElementById("question-container");
  container.innerHTML = `<p class="text-gray-500">Loading questions from GitHub...</p>`;

  const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject}.json`;

  try {
    const res = await fetch(GITHUB_URL);
    if (!res.ok) throw new Error("Question file not found");
    const data = await res.json();
    displayQuestions(data.questions);
  } catch (err) {
    console.error("GitHub load failed:", err);
    container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.<br>Please contact your tutor.</p>`;
  }
}

function displayQuestions(questions) {
  const container = document.getElementById("question-container");

  if (!questions || questions.length === 0) {
    container.innerHTML = `<p class="text-red-600">❌ This subject has no questions yet.</p>`;
    return;
  }

  container.innerHTML = questions.map((q, i) => `
    <div class="bg-white p-4 border rounded-lg shadow-sm">
      <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
      ${q.options.map((opt, j) => `
        <label class="block ml-4">
          <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
        </label>
      `).join('')}
    </div>
  `).join('');
}
