import { db } from './firebaseConfig.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    const container = document.getElementById("question-container");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;

    const fileName = `${grade}-${subject}`.toLowerCase();
    const docId = fileName;
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];

    try {
        const testDocRef = doc(db, "tests", docId);
        const docSnap = await getDoc(testDocRef);

        let rawData;
        let dataSource;

        if (docSnap.exists()) {
            rawData = docSnap.data();
            dataSource = "Firestore";
            console.log(`Loading curated test from Firestore: ${docId}`);
        } else {
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) throw new Error("Test file not found in Firestore or on GitHub.");
            rawData = await gitHubRes.json();
            dataSource = "GitHub";
            console.log(`Test not found in Firestore. Loading from GitHub: ${fileName}.json`);
        }
        
        console.log("1. Raw data loaded from:", dataSource, rawData);

        // --- Logic to handle both JSON formats ---
        let testArray = [];
        if (rawData && rawData.tests) {
            console.log("2. Detected 'tests' array format.");
            testArray = rawData.tests;
        } else if (rawData && rawData.questions) {
            console.log("2. Detected 'questions' only format.");
            testArray = [{ subject, grade, questions: rawData.questions }];
        }

        console.log("3. Extracted test array:", testArray);

        allQuestions = testArray.flatMap(test => {
            const defaultType = test.defaultQuestionType;
            if (!test.questions) return [];
            return test.questions.map(q => ({ ...q, type: q.type || defaultType }));
        });
        
        console.log(`4. Total questions processed: ${allQuestions.length}`);

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        // --- Test-building logic ---
        let finalQuestions = [];
        const multipleChoice = allQuestions.filter(q => q.type === 'multiple-choice');
        const creativeWriting = allQuestions.filter(q => q.type === 'creative-writing');
        const comprehension = allQuestions.filter(q => q.type === 'comprehension');
        
        console.log(`5. Filtered questions by type: MC=${multipleChoice.length}, CW=${creativeWriting.length}, Comp=${comprehension.length}`);

        if (subject.toLowerCase() === 'ela' || subject.toLowerCase() === 'english') {
            if (creativeWriting.length > 0) finalQuestions.push(creativeWriting[0]);
            if (comprehension.length > 0) finalQuestions.push(...comprehension.slice(0, 2));
            
            const remainingNeeded = 30 - finalQuestions.length;
            const remainingQuestions = [...multipleChoice].sort(() => 0.5 - Math.random());
            finalQuestions.push(...remainingQuestions.slice(0, remainingNeeded));
        } else {
            finalQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 30);
        }

        console.log(`6. Final test contains ${finalQuestions.length} questions.`);
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
    container.innerHTML = (questions || []).map((q, i) => {
        // ### START: THIS IS THE FIX ###
        // This logic now correctly displays images based on the image_url.
        // It defaults to showing the image 'before' if the position isn't specified.
        const showImageBefore = q.image_url && q.image_position !== 'after';
        const showImageAfter = q.image_url && q.image_position === 'after';
        // ### END: THIS IS THE FIX ###

        return `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            
            ${showImageBefore ? `<img src="${q.image_url}" class="mb-2 w-full rounded" alt="Question image"/>` : ''}
            
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question || q.passage || ''}</p>

            ${showImageAfter ? `<img src="${q.image_url}" class="mt-2 w-full rounded" alt="Question image"/>` : ''}
            
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
