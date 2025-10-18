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
    let allPassages = [];
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
            console.log("Loaded from Firebase:", rawData);
        } else {
            const gitHubRes = await fetch(GITHUB_URL);
            if (!gitHubRes.ok) throw new Error("Test file not found.");
            rawData = await gitHubRes.json();
            console.log("Loaded from GitHub:", rawData);
        }

        let testArray = [];
        if (rawData && rawData.tests) {
            testArray = rawData.tests;
        } else if (rawData && rawData.questions) {
            testArray = [{ questions: rawData.questions }];
        }
        
        // Extract both questions AND passages
        allQuestions = testArray.flatMap(test => test.questions || []);
        allPassages = testArray.flatMap(test => test.passages || []);
        
        // Create a map for easy passage lookup
        const passagesMap = {};
        allPassages.forEach(passage => {
            if (passage.passageId && passage.content) {
                passagesMap[passage.passageId] = passage;
            }
        });

        console.log("Creative Writing State:", state);
        console.log("Subject:", subject);
        console.log("Creative Writing Question:", allQuestions.find(q => q.type === 'creative-writing'));
        console.log("All Questions:", allQuestions);
        console.log("All Passages:", allPassages);

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found.</p>`;
            return;
        }

        // Check if we should show creative writing first
        if (subject.toLowerCase() === 'ela' && state === 'creative-writing') {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing');
            console.log("Found Creative Writing:", creativeWritingQuestion);
            
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p class="text-red-600">❌ Creative writing question not found. Redirecting to multiple choice...</p>`;
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('state', 'mcq');
                    window.location.search = params.toString();
                }, 2000);
                return;
            }
            loadedQuestions = [{ ...creativeWritingQuestion, id: 0 }];
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            // For MCQ mode, group questions by passage
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            const shuffledQuestions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
            loadedQuestions = shuffledQuestions.map((q, index) => ({ ...q, id: index }));
            displayMCQQuestions(loadedQuestions, passagesMap);
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
 * Displays creative writing section
 */
function displayCreativeWriting(question) {
    const container = document.getElementById("question-container");
    const params = new URLSearchParams(window.location.search);
    const studentName = params.get('studentName');
    const parentEmail = params.get('parentEmail');
    const tutorEmail = params.get('tutorEmail');
    const grade = params.get('grade');
    
    container.innerHTML = `
        <div class="bg-white p-6 border rounded-lg shadow-sm question-block">
            <h2 class="font-semibold text-xl mb-4 text-blue-800">Creative Writing</h2>
            <p class="font-semibold mb-4 question-text text-gray-700 text-lg">${question.question || ''}</p>
            
            <textarea id="creative-writing-text-${question.id}" class="w-full h-48 p-4 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Write your essay or creative writing response here..."></textarea>
            
            <div class="mb-4">
                <label class="block mb-2 text-sm font-medium text-gray-700">Or Upload a File (PDF, DOC, DOCX, TXT)</label>
                <input type="file" id="creative-writing-file-${question.id}" accept=".pdf,.doc,.docx,.txt" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
            
            <button onclick="window.continueToMCQ(${question.id}, '${studentName}', '${parentEmail}', '${tutorEmail}', '${grade}')" class="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200 mt-4 w-full">
                Continue to Multiple-Choice Questions
            </button>
        </div>
    `;
}

/**
 * Displays MCQ questions grouped by their passages
 */
function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    container.innerHTML = '';
    
    // Group questions by passage
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach((question, index) => {
        if (question.passageId && passagesMap[question.passageId]) {
            if (!questionsByPassage[question.passageId]) {
                questionsByPassage[question.passageId] = [];
            }
            questionsByPassage[question.passageId].push({ ...question, displayIndex: index + 1 });
        } else {
            questionsWithoutPassage.push({ ...question, displayIndex: index + 1 });
        }
    });
    
    // Display passages with their corresponding questions
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];
        
        // Display the passage
        const passageElement = document.createElement('div');
        passageElement.className = 'passage-container bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500';
        passageElement.innerHTML = `
            <h3 class="text-lg font-bold text-green-800 mb-2">${passage.title || 'Reading Passage'}</h3>
            ${passage.subtitle ? `<h4 class="text-md text-gray-600 mb-3">${passage.subtitle}</h4>` : ''}
            ${passage.author ? `<p class="text-sm text-gray-500 mb-4">${passage.author}</p>` : ''}
            <div class="passage-content text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded border">${passage.content}</div>
        `;
        container.appendChild(passageElement);
        
        // Display questions for this passage
        passageQuestions.forEach(q => {
            const questionElement = createQuestionElement(q, q.displayIndex);
            container.appendChild(questionElement);
        });
    });
    
    // Display questions without passages
    questionsWithoutPassage.forEach(q => {
        const questionElement = createQuestionElement(q, q.displayIndex);
        container.appendChild(questionElement);
    });
}

/**
 * Creates a question element
 */
function createQuestionElement(q, displayIndex) {
    const questionElement = document.createElement('div');
    questionElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    questionElement.setAttribute('data-question-id', q.id);
    
    const showImageBefore = q.imageUrl && q.image_position !== 'after';
    const showImageAfter = q.imageUrl && q.image_position === 'after';
    
    questionElement.innerHTML = `
        ${showImageBefore ? `<img src="${q.imageUrl}" class="mb-3 w-full rounded-lg border" alt="Question image"/>` : ''}
        <p class="font-semibold mb-3 question-text text-gray-800">${displayIndex}. ${q.question || ''}</p>
        ${showImageAfter ? `<img src="${q.imageUrl}" class="mt-3 w-full rounded-lg border" alt="Question image"/>` : ''}
        <div class="mt-3 space-y-2">
            ${(q.options || []).map(opt => `
                <label class="flex items-center py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                    <input type="radio" name="q${q.id}" value="${opt}" class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"> 
                    <span class="text-gray-700">${opt}</span>
                </label>
            `).join('')}
        </div>
    `;
    
    return questionElement;
}

// Continue to MCQ handler for creative writing submissions
window.continueToMCQ = async (questionId, studentName, parentEmail, tutorEmail, grade) => {
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    
    const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
    const fileInput = document.getElementById(`creative-writing-file-${questionId}`);
    
    const textAnswer = questionTextarea.value.trim();
    const file = fileInput.files[0];

    const continueBtn = document.querySelector('button[onclick*="continueToMCQ"]');
    if (continueBtn) {
        continueBtn.textContent = "Submitting Creative Writing...";
        continueBtn.disabled = true;
    }
    
    // Validate that at least one method is used
    if (!textAnswer && !file) {
        alert("Please either write your response in the text area or upload a file before continuing.");
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
        return;
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
                throw new Error("File upload failed. Please try again.");
            }
        }
        
        // Save creative writing submission to Firebase
        const submittedData = {
            questionId: questionId,
            textAnswer: textAnswer,
            fileUrl: fileUrl,
            submittedAt: new Date(),
            studentName: studentName,
            parentEmail: parentEmail,
            tutorEmail: tutorEmail,
            grade: grade,
            subject: 'ela',
            status: "pending_review",
            type: "creative_writing"
        };
        
        const docRef = doc(db, "tutor_submissions", `${parentEmail}-${questionId}-${Date.now()}`);
        await setDoc(docRef, submittedData);
        
        alert("Creative writing submitted successfully! Moving to multiple-choice questions.");
        
        // Redirect to MCQ section
        const params = new URLSearchParams(window.location.search);
        params.set('state', 'mcq');
        window.location.search = params.toString();

    } catch (error) {
        console.error("Error submitting creative writing:", error);
        alert(`Submission error: ${error.message}. Please try again.`);
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
    }
};
