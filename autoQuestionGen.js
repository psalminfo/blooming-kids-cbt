import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

/**
 * The entry point to load and display questions for a test.
 * It now handles a special "creative-writing" question type, ensuring it is always the first question.
 * @param {string} subject The subject of the test (e.g., 'ela').
 * @param {string} grade The grade level of the test (e.g., 'grade4').
 */
export async function loadQuestions(subject, grade) {
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
            container.innerHTML = `<p class="text-red-600">❌ No questions found.</p>`;
            return;
        }

        // Find the creative writing question and remove it from the main array
        let creativeWritingQuestion = null;
        const filteredQuestions = allQuestions.filter(q => {
            if (q.type === 'creative-writing' && creativeWritingQuestion === null) {
                creativeWritingQuestion = q;
                return false; // Don't include it in the filtered list
            }
            return true;
        });

        // Shuffle the remaining questions
        const shuffledQuestions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
        
        // Add the creative writing question to the beginning if it was found
        const finalQuestions = creativeWritingQuestion ? [creativeWritingQuestion, ...shuffledQuestions] : shuffledQuestions;
        
        loadedQuestions = finalQuestions.map((q, index) => ({ ...q, id: index }));
        
        displayQuestions(loadedQuestions);
    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred: ${err.message}</p>`;
    }
}

/**
 * Handles the submission of the creative writing question using Cloudinary.
 * NOTE: This function is no longer called by a dedicated button.
 * It remains here as an example of what was moved to submitTestToFirebase.js
 */
window.submitCreativeWriting = async function(questionId) {
    console.warn("This function is now deprecated and should not be used. The logic has been moved to submitTestToFirebase.");
}


export function getLoadedQuestions() {
    return loadedQuestions;
}

/**
 * Renders the questions to the DOM.
 * This function now contains a conditional block to handle different question types.
 * @param {Array} questions The array of questions to display.
 */
function displayQuestions(questions) {
    const container = document.getElementById("question-container");
    let mcqIndex = 0; // Initialize a separate counter for multiple-choice questions
    container.innerHTML = (questions || []).map((q, i) => {
        const showImageBefore = q.imageUrl && q.image_position !== 'after';
        const showImageAfter = q.imageUrl && q.image_position === 'after';

        // Check if it's the creative writing question
        if (q.type === 'creative-writing') {
            return `
                <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}" data-is-creative-writing="true">
                    <h2 class="font-semibold text-lg mb-2">Creative Writing</h2>
                    <p class="font-semibold mb-2 question-text">${q.question || ''}</p>
                    
                    <textarea id="creative-writing-text-${q.id}" class="w-full h-40 p-2 border rounded-lg mb-2" placeholder="Write your answer here..."></textarea>
                    
                    <div class="mb-2">
                        <label class="block mb-1 text-sm font-medium text-gray-700">Or Upload a File (e.g., photo of your writing)</label>
                        <input type="file" id="creative-writing-file-${q.id}" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                    </div>
                </div>
            `;
        }
        
        // This is the original logic for multiple-choice questions
        mcqIndex++; // Increment the counter only for multiple-choice questions
        return `
            <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
                ${showImageBefore ? `<img src="${q.imageUrl}" class="mb-2 w-full rounded" alt="Question image"/>` : ''}
                <p class="font-semibold mb-2 question-text">${mcqIndex}. ${q.question || q.passage || ''}</p>
                ${showImageAfter ? `<img src="${q.imageUrl}" class="mt-2 w-full rounded" alt="Question image"/>` : ''}
                <div class="mt-1">
                    ${(q.options || []).map(opt => `
                        <label class="block py-1 rounded hover:bg-gray-100 cursor-pointer">
                            <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}
