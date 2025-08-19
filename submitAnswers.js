let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    const container = document.getElementById("question-container");
    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    container.innerHTML = `<p class="text-gray-500">Please wait, loading questions...</p>`;

    try {
        const res = await fetch(GITHUB_URL);
        if (!res.ok) throw new Error("Question file not found");
        const data = await res.json();
        
        // Add a unique ID to each question
        const questionsWithIds = data.questions.map((q, index) => ({ ...q, id: index }));
        
        loadedQuestions = questionsWithIds.sort(() => 0.5 - Math.random()).slice(0, 30);
        
        displayQuestions(loadedQuestions);
    } catch (err) {
        console.error("GitHub load failed:", err);
        container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

function displayQuestions(questions) {
    const container = document.getElementById("question-container");

    if (!questions || questions.length === 0) {
        container.innerHTML = `<p class="text-red-600">❌ This subject has no questions yet.</p>`;
        return;
    }

    container.innerHTML = questions.map((q, i) => `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question}</p>
            ${q.options.map(opt => `
                <label class="block ml-4">
                    <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                </label>
            `).join('')}
        </div>
    `).join('');
}


submitanswer js
