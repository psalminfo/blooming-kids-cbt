import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    // --- THIS IS THE TEST ---
    // If you see this alert on your live site, the correct file is loading.
    // If you DO NOT see this alert, the wrong file is being used.
    alert("This is the NEW, CORRECT autoQuestionGen.js file!");
    // -------------------------

    const container = document.getElementById("question-container");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];

    try {
        let rawData;
        const testsCollectionRef = collection(db, "tests");
        const searchPrefix = `${grade}-${subject.toLowerCase().slice(0, 3)}`;
        const q = query(
            testsCollectionRef,
            where(documentId(), '>=', searchPrefix),
            where(documentId(), '<', searchPrefix + '\uf8ff')
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            rawData = docSnap.data();
            console.log(`Loading curated test from Firestore: ${docSnap.id}`);
        } else {
            console.log(`No test found in Firestore. Trying GitHub.`);
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) throw new Error("Test file not found.");
            rawData = await gitHubRes.json();
            console.log(`Loaded test from GitHub.`);
        }

        let testArray = [];
        if (rawData && rawData.tests) {
            testArray = rawData.tests;
        } else if (rawData && rawData.questions) {
            testArray = [{ questions: rawData.questions }];
        }

        allQuestions = testArray.flatMap(test => test.questions || []);
        
        if (allQuestions.length === 0) {
      .innerHTML = `<p class="text-red-600">❌ No questions found.</p>`;
            return;
        }

        const finalQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 30);
        loadedQuestions = finalQuestions.map((q, index) => ({ ...q, id: index }));
        
        displayQuestions(loadedQuestions);
    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred: ${err.message}</p>`;
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

function displayQuestions(questions) {
    const container = document.getElementById("question-container");
    container.innerHTML = (questions || []).map((q, i) => {
        const showImageBefore = q.imageUrl && q.image_position !== 'after';
        const showImageAfter = q.imageUrl && q.image_position === 'after';

        return `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            ${showImageBefore ? `<img src="${q.imageUrl}" class="mb-2 w-full rounded" alt="Question image"/>` : ''}
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question || q.passage || ''}</p>
            ${showImageAfter ? `<img src="${q.imageUrl}" class="mt-2 w-full rounded" alt="Question image"/>` : ''}
            <div class="mt-2">
                ${(q.options || []).map(opt => `
                    <label class="flex items-center py-2 rounded hover:bg-gray-100 cursor-pointer">
                        <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                    </label>
                `).join('')}
            </div>
        </div>
    `;
    }).join('');
}
