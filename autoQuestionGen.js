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
        // =================================================================
        // ### START: UPGRADED OVERRIDE LOGIC ###
        // =================================================================

        // 1. First, check Firestore for a complete, curated test document.
        const testDocRef = doc(db, "tests", docId);
        const docSnap = await getDoc(testDocRef);

        if (docSnap.exists()) {
            // If the curated test exists, use its questions and we're done fetching.
            console.log(`Loading curated test from Firestore: ${docId}`);
            const testData = docSnap.data().tests || [];
            allQuestions = testData.flatMap(t => t.questions || []);
        } else {
            // 2. If no curated test exists, combine GitHub and admin_questions.
            console.log(`No curated test found. Combining sources for ${docId}`);
            
            // Fetch from GitHub (this is our base)
            let githubQuestions = [];
            try {
                const gitHubRes = await fetch(GITHUB_URL);
                if (gitHubRes.ok) {
                    const gitHubJson = await gitHubRes.json();
                    githubQuestions = gitHubJson.tests.flatMap(t => t.questions || []);
                    console.log(`Found ${githubQuestions.length} questions on GitHub.`);
                }
            } catch (e) {
                console.warn("Could not fetch or parse GitHub file. It may not exist.");
            }

            // Fetch from Firestore admin_questions collection
            const q = query(collection(db, "admin_questions"), where("subject", "==", subject), where("grade", "==", grade));
            const firestoreSnapshot = await getDocs(q);
            const firestoreQuestions = firestoreSnapshot.docs.map(doc => doc.data());
            console.log(`Found ${firestoreQuestions.length} questions in Firestore 'admin_questions'.`);

            // Combine the two sources
            allQuestions = [...githubQuestions, ...firestoreQuestions];
        }

        // =================================================================
        // ### END: UPGRADED OVERRIDE LOGIC ###
        // =================================================================

        if (!allQuestions || allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        // --- The rest of your test-building logic remains unchanged ---
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
