import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];

/**
 * The entry point to load and display questions for a test.
 * @param {string} subject The subject of the test (e.g., 'ela').
 * @param {string} grade The grade level of the test (e.g., 'grade4').
 * @param {string} state The current state of the test ('creative-writing' or 'mcq').
 */
export async function loadQuestions(subject, grade, state) {
    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;
    if (submitBtnContainer) {
        submitBtnContainer.style.display = 'none';
    }

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];
    let creativeWritingQuestion = null;

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
        } else {
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) throw new Error("Test file not found.");
            rawData = await gitHubRes.json();
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

        if (subject.toLowerCase() === 'ela' && state === 'creative-writing') {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing');
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p class="text-red-600">❌ Creative writing question not found. Redirecting...</p>`;
                window.location.href = window.location.href.split('&state=')[0] + '&state=mcq';
                return;
            }
            loadedQuestions = [{ ...creativeWritingQuestion, id: 0 }];
            displayQuestions(loadedQuestions, true);
        } else {
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            const shuffledQuestions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
            loadedQuestions = shuffledQuestions.map((q, index) => ({ ...q, id: index }));
            displayQuestions(loadedQuestions, false);
            if (submitBtnContainer) {
                submitBtnContainer.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred: ${err.message}</p>`;
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

/**
 * Renders the questions to the DOM.
 * @param {Array} questions The array of questions to display.
 * @param {boolean} isCreativeWritingOnly A flag to render only the CW question with a special button.
 */
function displayQuestions(questions, isCreativeWritingOnly) {
    const container = document.getElementById("question-container");
    container.innerHTML = (questions || []).map((q, i) => {
        const showImageBefore = q.imageUrl && q.image_position !== 'after';
        const showImageAfter = q.imageUrl && q.image_position === 'after';

        if (isCreativeWritingOnly) {
            const params = new URLSearchParams(window.location.search);
            const studentName = params.get('studentName');
            const parentEmail = params.get('parentEmail');
            const tutorEmail = params.get('tutorEmail');
            const grade = params.get('grade');
            
            return `
                <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
                    <h2 class="font-semibold text-lg mb-2">Creative Writing</h2>
                    <p class="font-semibold mb-2 question-text">${q.question || ''}</p>
                    
                    <textarea id="creative-writing-text-${q.id}" class="w-full h-40 p-2 border rounded-lg mb-2" placeholder="Write your answer here..."></textarea>
                    
                    <div class="mb-2">
                        <label class="block mb-1 text-sm font-medium text-gray-700">Or Upload a File</label>
                        <input type="file" id="creative-writing-file-${q.id}" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                    </div>
                    
                    <button onclick="window.continueToMCQ(${q.id}, '${studentName}', '${parentEmail}', '${tutorEmail}', '${grade}')" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 mt-4">
                        Continue to Multiple-Choice
                    </button>
                </div>
            `;
        }
        
        let mcqIndex = i + 1;
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

// NEW: Continue to MCQ handler
window.continueToMCQ = async (questionId, studentName, parentEmail, tutorEmail, grade) => {
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    
    const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
    const fileInput = document.getElementById(`creative-writing-file-${questionId}`);
    
    const textAnswer = questionTextarea.value.trim();
    const file = fileInput.files[0];

    const continueBtn = document.querySelector('button[onclick*="continueToMCQ"]');
    if (continueBtn) {
        continueBtn.textContent = "Submitting...";
        continueBtn.disabled = true;
    }
    
    try {
        let fileUrl = null;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.secure_url) {
                fileUrl = result.secure_url;
            } else {
                throw new Error("Cloudinary upload failed.");
            }
        }
        
        if (textAnswer || file) {
            const submittedData = {
                questionId: questionId,
                textAnswer: textAnswer,
                fileUrl: fileUrl,
                submittedAt: new Date(),
                studentName: studentName,
                parentEmail: parentEmail,
                tutorEmail: tutorEmail,
                grade: grade,
                status: "pending_review"
            };
            const docRef = doc(db, "tutor_submissions", `${parentEmail}-${questionId}`);
            await setDoc(docRef, submittedData);
        }
        
        alert("Creative writing submitted successfully! Moving to multiple-choice questions.");
        
        const params = new URLSearchParams(window.location.search);
        params.set('state', 'mcq');
        window.location.search = params.toString();

    } catch (error) {
        console.error("Error submitting creative writing:", error);
        alert("An error occurred. Please try again.");
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice";
            continueBtn.disabled = false;
        }
    }
};
