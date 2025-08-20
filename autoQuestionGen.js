import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade) {
    const container = document.getElementById("question-container");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];

    try {
        let rawData;
        let docFoundInFirestore = false;

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
            docFoundInFirestore = true;
            console.log(`Loading curated test from Firestore with a fuzzy match: ${docSnap.id}`);
        } else {
            console.log(`No test found in Firestore with prefix '${searchPrefix}'. Trying GitHub.`);
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) throw new Error("Test file not found in Firestore or on GitHub.");
            rawData = await gitHubRes.json();
            console.log(`Loaded test from GitHub: ${fileName}.json`);
        }

        let testArray = [];
        if (rawData && rawData.tests) {
            testArray = rawData.tests;
        } else if (rawData && rawData.questions) {
            testArray = [{ subject, grade, questions: rawData.questions }];
        }

        allQuestions = testArray.flatMap(test => {
            const defaultType = test.defaultQuestionType;
            if (!test.questions) return [];
            return test.questions.map(q => ({ ...q, type: q.type || defaultType }));
        });
        
        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

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
              <div class="mt-2">
                    ${(q.options || []).map((opt, index) => `
                        {/* CHANGE 1: Removed the alphabetical label */}
                        {/* CHANGE 2: Removed horizontal padding (p-2 -> py-2) to fix left alignment */}
                        <label class="flex items-center py-2 rounded hover:bg-gray-100 cursor-pointer">
                            <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                        </label>
                    `).join('')}
              </div>
            `}
        </div>
    `}).join('');
}
