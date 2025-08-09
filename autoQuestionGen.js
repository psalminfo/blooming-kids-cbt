import { db } from './firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade, studentCountry) {
    const container = document.getElementById("question-container");
    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    container.innerHTML = `<p class="text-gray-500">Please wait, loading questions...</p>`;

    try {
        const gitHubRes = await fetch(GITHUB_URL);
        const gitHubData = gitHubRes.ok ? (await gitHubRes.json()).questions : [];

        const firestoreSnapshot = await getDocs(collection(db, "admin_questions"));
        const firestoreData = firestoreSnapshot.docs.map(doc => doc.data());

        let combinedQuestions = [...(gitHubData || []), ...(firestoreData || [])];

        if (combinedQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        let countrySpecificQuestions = combinedQuestions.filter(q => q.location === studentCountry);

        if (countrySpecificQuestions.length < 30) {
            combinedQuestions = [...countrySpecificQuestions, ...combinedQuestions.filter(q => q.location !== studentCountry)];
        } else {
            combinedQuestions = countrySpecificQuestions;
        }

        const creativeWriting = combinedQuestions.filter(q => q.type === 'creative-writing');
        const comprehension = combinedQuestions.filter(q => q.type === 'comprehension');
        const multipleChoice = combinedQuestions.filter(q => q.type === 'multiple-choice');

        let finalQuestions = [];
        if (creativeWriting.length > 0) {
            finalQuestions.push(creativeWriting[0]);
        }
        if (comprehension.length > 0) {
            finalQuestions.push(...comprehension.slice(0, 2));
        }

        const remainingQuestions = [...multipleChoice].sort(() => 0.5 - Math.random());
        finalQuestions.push(...remainingQuestions.slice(0, 30 - finalQuestions.length));

        loadedQuestions = finalQuestions.map((q, index) => ({ ...q, id: index }));
        
        displayQuestions(loadedQuestions);
    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred while loading questions.</p>`;
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

function displayQuestions(questions) {
    const container = document.getElementById("question-container");
    container.innerHTML = (questions || []).map((q, i) => `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            ${(q.image_url && q.image_position === 'before') ? `<img src="${q.image_url}" class="mb-2 w-full rounded" />` : ''}
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question}</p>
            ${(q.image_url && q.image_position === 'after') ? `<img src="${q.image_url}" class="mt-2 w-full rounded" />` : ''}
            ${q.type === 'creative-writing' ? `
                <textarea id="creativeWriting" class="w-full mt-4 p-2 border rounded" rows="10" placeholder="Write your response here..."></textarea>
                <div class="mt-2">
                    <label class="block text-sm text-gray-600">Or upload a file:</label>
                    <input type="file" id="creativeWritingFile" class="w-full mt-1">
                </div>
            ` : `
                ${(q.options || []).map(opt => `
                    <label class="block ml-4">
                        <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                    </label>
                `).join('')}
            `}
        </div>
    `).join('');
}
