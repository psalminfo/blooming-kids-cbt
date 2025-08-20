import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

export async function loadQuestions(subject, grade, studentCountry) {
    const container = document.getElementById("question-container");
    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    container.innerHTML = `<p class="text-gray-500">Please wait, loading questions...</p>`;

    try {
        let allQuestions = [];
        let firestoreData = [];
        
        // 1. Fetch from the "tests" collection in Firestore
        const testsCollectionRef = collection(db, "tests");
        const searchPrefix = `${grade}-${subject.toLowerCase().slice(0, 3)}`;
        const q = query(
            testsCollectionRef,
            where(documentId(), '>=', searchPrefix),
            where(documentId(), '<', searchPrefix + '\uf8ff')
        );
        const testsSnapshot = await getDocs(q);

        if (!testsSnapshot.empty) {
            allQuestions = testsSnapshot.docs.flatMap(docSnap => docSnap.data().questions || []);
            console.log(`Loaded ${allQuestions.length} questions from Firestore 'tests' collection.`);
        } else {
            // 2. If no test found, try the "admin_questions" and GitHub
            const adminQuestionsSnapshot = await getDocs(collection(db, "admin_questions"));
            const adminQuestionsData = adminQuestionsSnapshot.docs.map(doc => doc.data());
            
            const gitHubRes = await fetch(GITHUB_URL);
            const gitHubData = gitHubRes.ok ? (await gitHubRes.json()).questions : [];
            
            allQuestions = [...(adminQuestionsData || []), ...(gitHubData || [])];
        }

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        let countrySpecificQuestions = allQuestions.filter(q => q.location === studentCountry);
        if (countrySpecificQuestions.length < 30) {
            allQuestions = [...countrySpecificQuestions, ...allQuestions.filter(q => q.location !== studentCountry)];
        } else {
            allQuestions = countrySpecificQuestions;
        }

        let finalQuestions = [];
        const multipleChoice = allQuestions.filter(q => q.type === 'multiple-choice');
        const creativeWriting = allQuestions.filter(q => q.type === 'creative-writing');
        const comprehension = allQuestions.filter(q => q.type === 'comprehension');
        
        if (subject === 'ela') {
            if (creativeWriting.length > 0) {
                finalQuestions.push(creativeWriting[0]);
            }
            if (comprehension.length > 0) {
                finalQuestions.push(...comprehension.slice(0, 2));
            }
            const remainingQuestions = [...multipleChoice].sort(() => 0.5 - Math.random());
            finalQuestions.push(...remainingQuestions.slice(0, 30 - finalQuestions.length));
        } else {
            finalQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 30);
        }

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
    container.innerHTML = (questions || []).map((q, i) => {
        let passageHtml = '';
        if (q.type === 'comprehension' && q.passage) {
            passageHtml = `<div class="p-4 bg-gray-100 rounded-lg mb-4">${q.passage}</div>`;
        }
        
        const imageHtml = q.image_url ? `<img src="${q.image_url}" class="mb-2 w-full rounded" />` : '';
        const position = q.image_position === 'before' ? `${imageHtml}${passageHtml}` : `${passageHtml}${imageHtml}`;

        return `
            <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
                ${position}
                <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question}</p>
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
        `;
    }).join('');
}
