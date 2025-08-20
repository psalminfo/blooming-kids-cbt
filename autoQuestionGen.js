import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    // --- THIS IS THE FIX: Changed "question-container" to "questionContainer" ---
    const container = document.getElementById("questionContainer");
    if (!container) {
        console.error("Fatal Error: The element with ID 'questionContainer' was not found in the HTML.");
        return;
    }
    // --- END OF FIX ---

    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your personalized test...</p>`;

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];

    try {
        const testsCollectionRef = collection(db, "tests");
        const searchTerm = `${grade}-${subject.toLowerCase()}`;
        const curatedTestQuery = query(testsCollectionRef, where("searchId", "==", searchTerm));
        const curatedTestSnapshot = await getDocs(curatedTestQuery);

        if (!curatedTestSnapshot.empty) {
            const docSnap = curatedTestSnapshot.docs[0];
            const rawData = docSnap.data();
            allQuestions = rawData.questions || [];
            console.log(`Loading curated test from Firestore: ${docSnap.id}`);
        } else {
            const adminQuestionsRef = collection(db, "admin questions");
            const adminQuery = query(
                adminQuestionsRef,
                where("grade", "==", String(grade)),
                where("subject", "==", subject.toLowerCase())
            );
            const adminSnapshot = await getDocs(adminQuery);

            if (!adminSnapshot.empty) {
                adminSnapshot.forEach(doc => allQuestions.push(doc.data()));
                console.log(`Loaded ${allQuestions.length} questions from 'admin questions'.`);
            } else {
                console.log(`No questions found in Firestore. Trying GitHub.`);
                const gitHubRes = await fetch(GITHUB_URL);
                if (!gitHubRes.ok) throw new Error("Test file not found in any source.");
                const rawData = await gitHubRes.json();
                
                if (rawData && rawData.tests) {
                    allQuestions = rawData.tests[0]?.questions || [];
                } else if (rawData && rawData.questions) {
                    allQuestions = rawData.questions;
                }
                console.log(`Loaded test from GitHub: ${fileName}.json`);
            }
        }
        
        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        let finalQuestions = [];
        const multipleChoice = allQuestions.filter(q => q.type === 'multiple-choice' || !q.type);
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
    const container = document.getElementById("questionContainer");
    container.innerHTML = (questions || []).map((q, i) => {
        const showImageBefore = q.imageUrl && q.image_position !== 'after';
        const showImageAfter = q.imageUrl && q.image_position === 'after';

        return `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            
            ${showImageBefore ? `<img src="${q.imageUrl}" class="mb-2 w-full rounded" alt="Question image"/>` : ''}
            
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question || q.passage || ''}</p>

            ${showImageAfter ? `<img src="${q.imageUrl}" class="mt-2 w-full rounded" alt="Question image"/>` : ''}
            
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
    `}).join('');
}
