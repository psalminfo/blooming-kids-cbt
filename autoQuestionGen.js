import { db } from './firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    const container = document.getElementById("question-container");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;

    // Use the subject and grade to create the unique ID for both Firestore and GitHub
    const fileName = `${grade}-${subject}`.toLowerCase();
    const docId = fileName; // e.g., "10-ela"
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let testData = [];

    try {
        // =================================================================
        // ### START: NEW OVERRIDE LOGIC ###
        // =================================================================

        // 1. First, check Firestore for a completed test document.
        const testDocRef = doc(db, "tests", docId);
        const docSnap = await getDoc(testDocRef);

        if (docSnap.exists()) {
            // If the document exists, use the data from Firestore.
            console.log(`Loading test from Firestore: ${docId}`);
            testData = docSnap.data().tests; // Use the 'tests' array from the Firestore doc
        } else {
            // 2. If not in Firestore, fall back to the original GitHub template.
            console.log(`Test not found in Firestore. Loading from GitHub: ${fileName}.json`);
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) {
                throw new Error("Test file not found in Firestore or on GitHub.");
            }
            const gitHubJson = await gitHubRes.json();
            testData = gitHubJson.tests; // Use the 'tests' array from the GitHub file
        }

        // =================================================================
        // ### END: NEW OVERRIDE LOGIC ###
        // =================================================================

        if (!testData || testData.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        // Your original logic for building the test remains unchanged.
        // It now works on the correctly sourced data (either from Firestore or GitHub).
        let allQuestions = testData.flatMap(t => t.questions || []);

        let finalQuestions = [];
        const multipleChoice = allQuestions.filter(q => q.type === 'multiple-choice');
        const creativeWriting = allQuestions.filter(q => q.type === 'creative-writing');
        const comprehension = allQuestions.filter(q => q.type === 'comprehension');
        
        if (subject.toLowerCase() === 'ela' || subject.toLowerCase() === 'english') {
            if (creativeWriting.length > 0) finalQuestions.push(creativeWriting[0]);
            if (comprehension.length > 0) finalQuestions.push(...comprehension.slice(0, 2));
            
            const remainingNeeded = 30 - finalQuestions.length;
            const remainingQuestions = [...multipleChoice].sort(() => 0.5 - Math.random());
            finalQuestions.push(...remainingQuestions.slice(0, remainingNeeded));
        } else {
            finalQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 30);
        }

        loadedQuestions = finalQuestions.map((q, index) => ({ ...q, id: index }));
        
        displayQuestions(loadedQuestions);
    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred while loading the test. ${err.message}</p>`;
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

function displayQuestions(questions) {
    const container = document.getElementById("question-container");
    // Your displayQuestions function remains the same.
    container.innerHTML = (questions || []).map((q, i) => `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            ${(q.image_url && q.image_position === 'before') ? `<img src="${q.image_url}" class="mb-2 w-full rounded" />` : ''}
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question || q.passage || ''}</p>
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
