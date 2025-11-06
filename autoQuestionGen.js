import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let loadedQuestions = [];
let currentSessionId = null;
let saveTimeout = null;

/**
 * Convert test subject to admin_questions subject format
 */
function getAdminQuestionsSubject(testSubject) {
    const subjectMap = {
        'ela': 'English',
        'math': 'Mathematics', 
        'science': 'Science',
        'socialstudies': 'Social Studies'
        // Add more subject mappings as needed
    };
    
    return subjectMap[testSubject.toLowerCase()] || testSubject;
}

/**
 * Generate unique session ID scoped to current test AND state
 */
function generateSessionId(grade, subject, state) {
    const params = new URLSearchParams(window.location.search);
    const studentName = params.get('studentName');
    const parentEmail = params.get('parentEmail');
    
    // Create a unique session ID for THIS SPECIFIC TEST AND STATE
    const testSessionKey = `test-${grade}-${subject}-${state}-${studentName}-${parentEmail}`;
    
    // Try to get existing session for THIS TEST AND STATE
    const existingSessionId = sessionStorage.getItem('currentTestSession');
    
    // Only reuse session if it's for the EXACT same test AND state
    if (existingSessionId && existingSessionId === testSessionKey) {
        console.log("Reusing session for current test and state:", testSessionKey);
        return existingSessionId;
    }
    
    // New test session - clear any old sessions for different states
    clearOtherStateSessions(testSessionKey);
    
    // Set new session for current test and state
    sessionStorage.setItem('currentTestSession', testSessionKey);
    console.log("Started new test session for state:", testSessionKey);
    
    return testSessionKey;
}

/**
 * Clear sessions for other states but keep current one
 */
function clearOtherStateSessions(currentSessionKey) {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('test-') || key.startsWith('session-') || key.includes('-answers') || key === 'currentSessionId' || key === 'currentTestSession' || key === 'justCompletedCreativeWriting')) {
            // Only remove if it's NOT the current session
            if (key !== currentSessionKey && key !== `currentTestSession` && !key.includes(`${currentSessionKey}-answers`)) {
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log("Cleared other state session:", key);
    });
}

/**
 * Clear all test sessions (call on logout)
 */
export function clearAllTestSessions() {
    // Clear all session storage related to tests
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('test-') || key.startsWith('session-') || key.includes('-answers') || key === 'currentSessionId' || key === 'currentTestSession' || key === 'justCompletedCreativeWriting')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log("Cleared session:", key);
    });
    
    console.log("All test sessions cleared - ready for new test");
}

// Export function to get answer data for submission
export function getAnswerData() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
}

// Export function to get all loaded questions
export function getAllLoadedQuestions() {
    return loadedQuestions;
}

/**
 * Select ELA questions with priority: 1 passage + non-passage questions to reach 15, OR 2 passages
 */
function selectELAQuestions(allQuestions, passagesMap) {
    const questionsWithPassages = [];
    const questionsWithoutPassages = [];
    
    // Separate questions with and without passages
    allQuestions.forEach(question => {
        if (question.passageId && passagesMap[question.passageId]) {
            questionsWithPassages.push(question);
        } else {
            questionsWithoutPassages.push(question);
        }
    });
    
    // Group questions by passage
    const questionsByPassage = {};
    questionsWithPassages.forEach(question => {
        if (!questionsByPassage[question.passageId]) {
            questionsByPassage[question.passageId] = [];
        }
        questionsByPassage[question.passageId].push(question);
    });
    
    const selectedQuestions = [];
    const selectedPassageIds = [];
    
    const passageIds = Object.keys(questionsByPassage);
    
    // Step 1: Select first random passage with all its questions
    if (passageIds.length > 0) {
        const firstPassageId = passageIds[Math.floor(Math.random() * passageIds.length)];
        selectedQuestions.push(...questionsByPassage[firstPassageId]);
        selectedPassageIds.push(firstPassageId);
        console.log(`Selected first passage ${firstPassageId} with ${questionsByPassage[firstPassageId].length} questions`);
    }
    
    // Step 2: Check if we can reach 15 with non-passage questions
    const questionsNeeded = 15 - selectedQuestions.length;
    const availableNonPassageQuestions = Math.min(questionsWithoutPassages.length, questionsNeeded);
    
    if (availableNonPassageQuestions >= questionsNeeded) {
        // We have enough non-passage questions to reach 15 - use them
        const shuffledNonPassage = questionsWithoutPassages.sort(() => 0.5 - Math.random());
        const additionalQuestions = shuffledNonPassage.slice(0, questionsNeeded);
        selectedQuestions.push(...additionalQuestions);
        console.log(`Added ${additionalQuestions.length} non-passage questions to reach 15 total`);
    } else if (passageIds.length > 1) {
        // Not enough non-passage questions - add a second passage instead
        const remainingPassageIds = passageIds.filter(id => !selectedPassageIds.includes(id));
        if (remainingPassageIds.length > 0) {
            const secondPassageId = remainingPassageIds[Math.floor(Math.random() * remainingPassageIds.length)];
            selectedQuestions.push(...questionsByPassage[secondPassageId]);
            selectedPassageIds.push(secondPassageId);
            console.log(`Added second passage ${secondPassageId} with ${questionsByPassage[secondPassageId].length} questions (not enough non-passage questions)`);
            
            // If we still have room after second passage, add available non-passage questions
            const remainingSlots = 15 - selectedQuestions.length;
            if (remainingSlots > 0 && questionsWithoutPassages.length > 0) {
                const shuffledNonPassage = questionsWithoutPassages.sort(() => 0.5 - Math.random());
                const finalQuestions = shuffledNonPassage.slice(0, remainingSlots);
                selectedQuestions.push(...finalQuestions);
                console.log(`Added ${finalQuestions.length} non-passage questions after second passage`);
            }
        }
    } else {
        // Only one passage available - add whatever non-passage questions we have
        const shuffledNonPassage = questionsWithoutPassages.sort(() => 0.5 - Math.random());
        const additionalQuestions = shuffledNonPassage.slice(0, availableNonPassageQuestions);
        selectedQuestions.push(...additionalQuestions);
        console.log(`Added ${additionalQuestions.length} non-passage questions (only one passage available)`);
    }
    
    // Final selection - take only 15 questions max
    const finalSelection = selectedQuestions.slice(0, 15);
    console.log(`Final ELA selection: ${finalSelection.length} questions (includes ${selectedPassageIds.length} passages)`);
    
    return finalSelection;
}

/**
 * The entry point to load and display questions for a test.
 * @param {string} subject The subject of the test (e.g., 'ela').
 * @param {string} grade The grade level of the test (e.g., 'grade4').
 * @param {string} state The current state of the test ('creative-writing' or 'mcq').
 */
export async function loadQuestions(subject, grade, state) {
    // STRONG VALIDATION: CREATIVE WRITING ONLY FOR ELA, GRADES 3-12
    if (state === 'creative-writing') {
        if (subject.toLowerCase() !== 'ela') {
            console.error("Security violation: Creative writing attempted for non-ELA subject:", subject);
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
        
        if (!isGrade3Plus(grade)) {
            console.error("Security violation: Creative writing attempted for invalid grade:", grade);
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
    
    // Validate required DOM elements exist
    if (!container) {
        console.error("CRITICAL: question-container element not found in DOM");
        return;
    }
    
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;
    if (submitBtnContainer) {
        submitBtnContainer.style.display = 'none';
    }

    // Generate session ID for current test AND STATE
    currentSessionId = generateSessionId(grade, subject, state);

    // Check if we have saved questions for THIS SPECIFIC TEST AND STATE
    const savedSession = getSavedSession();
    if (savedSession && savedSession.questions && savedSession.questions.length > 0) {
        console.log("Loading questions from saved session for current test and state");
        loadedQuestions = savedSession.questions;
        displayQuestionsBasedOnState(loadedQuestions, state);
        restoreSavedAnswers();
        if (submitBtnContainer && state === 'mcq') {
            submitBtnContainer.style.display = 'block';
        }
        return;
    }

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];
    let allPassages = [];
    let creativeWritingQuestion = null;

    try {
        console.log(`🔄 FETCHING QUESTIONS FOR: ${grade} ${subject.toUpperCase()} - STATE: ${state}`);

        // 1. FETCH FROM BOTH FIREBASE COLLECTIONS SIMULTANEOUSLY
        const [testsSnapshot, adminSnapshot] = await Promise.all([
            // Fetch from tests collection - BY DOCUMENT ID PATTERN
            getDocs(query(
                collection(db, "tests"),
                where(documentId(), '>=', `${grade}-${subject.toLowerCase().slice(0, 3)}`),
                where(documentId(), '<', `${grade}-${subject.toLowerCase().slice(0, 3)}` + '\uf8ff')
            )),
            
            // Fetch from admin_questions collection - BY SUBJECT AND GRADE
            getDocs(query(
                collection(db, "admin_questions"),
                where("grade", "==", grade.replace('grade', '')),
                where("subject", "==", getAdminQuestionsSubject(subject))
            ))
        ]);

        console.log(`📊 TESTS Collection: Found ${testsSnapshot.size} documents for ${grade}-${subject}`);
        console.log(`📊 ADMIN_QUESTIONS Collection: Found ${adminSnapshot.size} documents for ${grade} ${getAdminQuestionsSubject(subject)}`);

        // 2. PROCESS TESTS COLLECTION
        if (!testsSnapshot.empty) {
            const docSnap = testsSnapshot.docs[0];
            const rawData = docSnap.data();
            let testArray = [];
            if (rawData && rawData.tests) {
                testArray = rawData.tests;
            } else if (rawData && rawData.questions) {
                testArray = [{ questions: rawData.questions }];
            }
            
            allQuestions = testArray.flatMap(test => test.questions || []);
            allPassages = testArray.flatMap(test => test.passages || []);
            console.log(`✅ Loaded ${allQuestions.length} questions from TESTS collection for ${subject}`);
        } else {
            console.log(`❌ No documents found in TESTS collection for ${grade}-${subject}`);
        }

        // 3. PROCESS ADMIN_QUESTIONS COLLECTION (ONLY FOR CURRENT SUBJECT)
        if (!adminSnapshot.empty) {
            const adminQuestions = [];
            adminSnapshot.forEach(doc => {
                try {
                    const questionData = doc.data();
                    
                    // Validate required question structure AND SUBJECT MATCH
                    if (!questionData || (!questionData.question && !questionData.type)) {
                        console.warn('Skipping invalid admin question (missing fields):', doc.id);
                        return;
                    }
                    
                    // DOUBLE CHECK: Ensure the question is for the correct subject
                    const questionSubject = questionData.subject?.toLowerCase();
                    const expectedSubject = getAdminQuestionsSubject(subject).toLowerCase();
                    
                    if (questionSubject !== expectedSubject) {
                        console.warn(`Skipping admin question - subject mismatch. Expected: ${expectedSubject}, Got: ${questionSubject}`, doc.id);
                        return;
                    }
                    
                    // Normalize the data to match your system
                    const normalizedQuestion = {
                        ...questionData,
                        firebaseId: doc.id,
                        id: doc.id || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        subject: subject.toLowerCase(), // Use the test subject, not the stored one
                        grade: questionData.grade?.startsWith('grade') ? questionData.grade : `grade${questionData.grade}`
                    };
                    
                    adminQuestions.push(normalizedQuestion);
                    
                } catch (err) {
                    console.error('Error processing admin question:', doc.id, err);
                }
            });
            console.log(`✅ Loaded ${adminQuestions.length} valid ${subject} questions from ADMIN_QUESTIONS`);
            
            // Merge admin questions with existing questions
            allQuestions = [...allQuestions, ...adminQuestions];
        } else {
            console.log(`❌ No documents found in ADMIN_QUESTIONS for ${grade} ${getAdminQuestionsSubject(subject)}`);
        }

        // 4. FALLBACK TO GITHUB IF BOTH COLLECTIONS EMPTY
        if (allQuestions.length === 0) {
            console.log(`📦 No ${subject} questions found in Firebase, trying GitHub...`);
            try {
                const gitHubRes = await fetch(GITHUB_URL);
                if (!gitHubRes.ok) throw new Error("GitHub file not found.");
                const rawData = await gitHubRes.json();

                let testArray = [];
                if (rawData && rawData.tests) {
                    testArray = rawData.tests;
                } else if (rawData && rawData.questions) {
                    testArray = [{ questions: rawData.questions }];
                }
                
                allQuestions = testArray.flatMap(test => test.questions || []);
                allPassages = testArray.flatMap(test => test.passages || []);
                console.log(`✅ Loaded ${allQuestions.length} questions from GitHub for ${subject}`);
            } catch (gitHubError) {
                console.error("❌ GitHub fallback also failed:", gitHubError);
                throw new Error("No questions found in any source.");
            }
        }

        // SECURITY: Remove creative writing questions for non-ELA subjects
        if (subject.toLowerCase() !== 'ela') {
            const beforeFilter = allQuestions.length;
            allQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            const afterFilter = allQuestions.length;
            if (beforeFilter !== afterFilter) {
                console.log(`🚫 Removed ${beforeFilter - afterFilter} creative writing questions for ${subject}`);
            }
        }

        // Create passages map for easy lookup
        const passagesMap = {};
        allPassages.forEach(passage => {
            if (passage.passageId && passage.content) {
                passagesMap[passage.passageId] = passage;
            }
        });

        console.log(`🎯 FINAL: ${allQuestions.length} ${subject.toUpperCase()} questions ready for ${grade} - STATE: ${state}`);
        console.log("📚 Passages count:", allPassages.length);

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No ${subject} questions found in any source.</p>`;
            return;
        }

        // Process and store questions for session persistence
        if (subject.toLowerCase() === 'ela' && state === 'creative-writing' && isGrade3Plus(grade)) {
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
            loadedQuestions = [{ ...creativeWritingQuestion, id: 'creative-writing-0' }];
            saveSession(loadedQuestions, passagesMap);
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            // FOR ALL SUBJECTS: Filter out creative writing questions from MCQ display
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            if (filteredQuestions.length === 0) {
                container.innerHTML = `<p class="text-red-600">❌ No ${subject} multiple-choice questions found.</p>`;
                return;
            }
            
            // NEW LOGIC: Different handling for ELA vs other subjects
            let selectedQuestions = [];
            
            if (subject.toLowerCase() === 'ela') {
                // For ELA: Prioritize one passage + non-passage questions to reach 15, OR 2 passages
                selectedQuestions = selectELAQuestions(filteredQuestions, passagesMap);
            } else {
                // For other subjects: Just take 15 random questions
                selectedQuestions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 15);
            }
            
            loadedQuestions = selectedQuestions.map((q, index) => ({ 
                ...q, 
                id: q.firebaseId || q.id || `question-${index}`
            }));
            saveSession(loadedQuestions, passagesMap);
            displayMCQQuestions(loadedQuestions, passagesMap);
            if (submitBtnContainer) {
                submitBtnContainer.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("❌ Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred: ${err.message}</p>`;
    }
}

/**
 * Check if grade is 3 or higher for creative writing
 */
function isGrade3Plus(grade) {
    try {
        const gradeNumber = parseInt(grade.replace('grade', ''));
        return !isNaN(gradeNumber) && gradeNumber >= 3 && gradeNumber <= 12;
    } catch (err) {
        console.error('Error checking grade:', err);
        return false;
    }
}

/**
 * Optimizes Cloudinary image URLs with automatic transformations
 */
function optimizeImageUrl(originalUrl) {
    if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
        return originalUrl;
    }
    
    // Check if URL already has transformations
    if (originalUrl.includes('/upload/') && !originalUrl.includes('/upload/q_')) {
        return originalUrl.replace('/upload/', '/upload/q_auto,f_auto,w_600,c_limit/');
    }
    
    return originalUrl;
}

/**
 * Save session to storage
 */
function saveSession(questions, passages) {
    try {
        const sessionData = {
            questions: questions,
            passages: passages,
            timestamp: Date.now(),
            sessionId: currentSessionId
        };
        sessionStorage.setItem(currentSessionId, JSON.stringify(sessionData));
    } catch (err) {
        console.error('Error saving session:', err);
    }
}

/**
 * Get saved session from storage
 */
function getSavedSession() {
    if (!currentSessionId) return null;
    try {
        const saved = sessionStorage.getItem(currentSessionId);
        return saved ? JSON.parse(saved) : null;
    } catch (err) {
        console.error('Error reading saved session:', err);
        return null;
    }
}

/**
 * Restore saved answers from storage
 */
function restoreSavedAnswers() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    if (!savedAnswers) return;
    
    try {
        const answers = JSON.parse(savedAnswers);
        Object.keys(answers).forEach(questionId => {
            // Handle radio buttons (multiple choice)
            const radio = document.querySelector(`input[name="q${questionId}"][value="${answers[questionId]}"]`);
            if (radio) {
                radio.checked = true;
            }
            
            // Handle text inputs (open-ended questions)
            const textInput = document.querySelector(`#text-answer-${questionId}`);
            if (textInput && answers[questionId]) {
                textInput.value = answers[questionId];
            }
        });
    } catch (err) {
        console.error('Error restoring saved answers:', err);
    }
}

/**
 * Save answer to storage (debounced)
 */
function saveAnswer(questionId, answer) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`) || '{}';
            const answers = JSON.parse(savedAnswers);
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {
            console.error('Error saving answer:', err);
        }
    }, 300);
}

/**
 * Save text answer to storage (debounced)
 */
function saveTextAnswer(questionId, answer) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`) || '{}';
            const answers = JSON.parse(savedAnswers);
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {
            console.error('Error saving text answer:', err);
        }
    }, 500);
}

/**
 * Display questions based on current state
 */
function displayQuestionsBasedOnState(questions, state) {
    const passagesMap = getSavedSession()?.passages || {};
    
    if (state === 'creative-writing') {
        const creativeWritingQuestion = questions.find(q => q.type === 'creative-writing');
        if (creativeWritingQuestion) {
            displayCreativeWriting(creativeWritingQuestion);
        }
    } else {
        displayMCQQuestions(questions, passagesMap);
    }
}

export function getLoadedQuestions() {
    return loadedQuestions;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Displays creative writing section
 */
function displayCreativeWriting(question) {
    const container = document.getElementById("question-container");
    if (!container) {
        console.error('question-container not found');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const studentName = escapeHtml(params.get('studentName') || '');
    const parentEmail = escapeHtml(params.get('parentEmail') || '');
    const tutorEmail = escapeHtml(params.get('tutorEmail') || '');
    const grade = escapeHtml(params.get('grade') || '');
    
    // SAFE QUESTION ID - ensure it's a valid JavaScript variable name
    const safeQuestionId = question.id ? question.id.replace(/[^a-zA-Z0-9]/g, '_') : 'creative_writing_0';
    const safeQuestionText = escapeHtml(question.question || '');
    
    container.innerHTML = `
        <div class="bg-white p-6 border rounded-lg shadow-sm question-block mx-auto max-w-4xl">
            <h2 class="font-semibold text-xl mb-4 text-blue-800">Creative Writing</h2>
            <p class="font-semibold mb-4 question-text text-gray-700 text-lg">${safeQuestionText}</p>
            
            <textarea id="creative-writing-text-${safeQuestionId}" class="w-full h-48 p-4 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Write your essay or creative writing response here..."></textarea>
            
            <div class="mb-4">
                <label class="block mb-2 text-sm font-medium text-gray-700">Or Upload an Image (JPG, PNG, GIF, WebP - Max 5MB)</label>
                <input type="file" id="creative-writing-file-${safeQuestionId}" accept=".jpg,.jpeg,.png,.gif,.webp" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                <p class="text-xs text-gray-500 mt-1">Maximum file size: 5MB. Supported formats: JPG, PNG, GIF, WebP</p>
            </div>
            
            <button onclick="window.continueToMCQ('${safeQuestionId}', '${studentName}', '${parentEmail}', '${tutorEmail}', '${grade}')" class="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200 mt-4 w-full">
                Continue to Multiple-Choice Questions
            </button>
        </div>
    `;
}

/**
 * Displays MCQ questions grouped by their passages WITH PROPER NUMBERING AND GROUPING
 */
function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    if (!container) {
        console.error('question-container not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Add CSS for optimal layout
    const style = document.createElement('style');
    style.textContent = `
        .question-container { max-width: 800px; margin: 0 auto; padding: 0 20px; }
        .question-block { max-width: 100%; }
        .image-container img { max-width: 600px; max-height: 400px; width: auto; height: auto; }
        .text-answer-input { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #e5e7eb; 
            border-radius: 8px; 
            font-size: 16px;
            transition: border-color 0.2s;
        }
        .text-answer-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .answer-type-label {
            display: inline-block;
            padding: 4px 8px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 12px;
            color: #6b7280;
            margin-left: 8px;
        }
        @media (max-width: 768px) {
            .question-container { padding: 0 16px; }
            .image-container img { max-width: 100%; }
        }
    `;
    document.head.appendChild(style);
    
    container.className = 'question-container';
    
    // Group questions by passage
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    // First pass: group all questions by their passageId
    questions.forEach((question) => {
        if (question.passageId && passagesMap[question.passageId]) {
            if (!questionsByPassage[question.passageId]) {
                questionsByPassage[question.passageId] = [];
            }
            questionsByPassage[question.passageId].push(question);
        } else {
            questionsWithoutPassage.push(question);
        }
    });
    
    let globalQuestionIndex = 1; // Continuous numbering across ALL questions
    
    // Display passages with their corresponding questions FIRST
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];
        
        // Display the passage
        const passageElement = document.createElement('div');
        passageElement.className = 'passage-container bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500';
        passageElement.innerHTML = `
            <h3 class="text-lg font-bold text-green-800 mb-2">${escapeHtml(passage.title || 'Reading Passage')}</h3>
            ${passage.subtitle ? `<h4 class="text-md text-gray-600 mb-3">${escapeHtml(passage.subtitle)}</h4>` : ''}
            ${passage.author ? `<p class="text-sm text-gray-500 mb-4">${escapeHtml(passage.author)}</p>` : ''}
            <div class="passage-content text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded border">${escapeHtml(passage.content)}</div>
        `;
        container.appendChild(passageElement);
        
        // Display questions for this passage with continuous numbering
        passageQuestions.forEach(q => {
            const questionElement = createQuestionElement(q, globalQuestionIndex);
            container.appendChild(questionElement);
            globalQuestionIndex++; // Increment for next question
        });
    });
    
    // Display questions without passages AFTER passage questions
    questionsWithoutPassage.forEach(q => {
        const questionElement = createQuestionElement(q, globalQuestionIndex);
        container.appendChild(questionElement);
        globalQuestionIndex++; // Increment for next question
    });
}

/**
 * Creates a question element with optimized images and answer tracking
 */
function createQuestionElement(q, displayIndex) {
    const questionElement = document.createElement('div');
    questionElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    questionElement.setAttribute('data-question-id', q.id);
    
    // Optimize the image URL
    const optimizedImageUrl = q.imageUrl ? optimizeImageUrl(q.imageUrl) : null;
    const showImageBefore = optimizedImageUrl && q.image_position !== 'after';
    const showImageAfter = optimizedImageUrl && q.image_position === 'after';
    
    const safeQuestionText = escapeHtml(q.question || '');
    const safeOptions = (q.options || []).map(opt => escapeHtml(opt));
    
    // Determine if this is a multiple choice or text input question
    const hasOptions = safeOptions && safeOptions.length > 0;
    const answerType = hasOptions ? 'multiple-choice' : 'text-answer';
    
    questionElement.innerHTML = `
        ${showImageBefore ? `
            <div class="image-container mb-3">
                <img src="${optimizedImageUrl}" 
                     class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                     alt="Question image"
                     onclick="window.open('${q.imageUrl}', '_blank')"/>
                <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
            </div>
        ` : ''}
        
        <p class="font-semibold mb-3 question-text text-gray-800">
            ${displayIndex}. ${safeQuestionText}
            <span class="answer-type-label">${hasOptions ? 'Multiple Choice' : 'Text Answer'}</span>
        </p>
        
        ${showImageAfter ? `
            <div class="image-container mt-3">
                <img src="${optimizedImageUrl}" 
                     class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                     alt="Question image"
                     onclick="window.open('${q.imageUrl}', '_blank')"/>
                <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
            </div>
        ` : ''}
        
        <div class="mt-3 space-y-2">
            ${hasOptions ? 
                safeOptions.map(opt => `
                    <label class="flex items-center py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                        <input type="radio" name="q${q.id}" value="${opt}" class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"> 
                        <span class="text-gray-700">${opt}</span>
                    </label>
                `).join('') 
                : 
                `
                <div class="text-answer-container">
                    <textarea 
                        id="text-answer-${q.id}" 
                        class="text-answer-input" 
                        placeholder="Type your answer here..."
                        rows="3"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">Type your answer in the box above</p>
                </div>
                `
            }
        </div>
    `;
    
    // Add event listeners based on question type
    if (hasOptions) {
        // Multiple choice: radio button event listeners
        const radioInputs = questionElement.querySelectorAll(`input[name="q${q.id}"]`);
        radioInputs.forEach(radio => {
            radio.addEventListener('change', (e) => {
                saveAnswer(q.id, e.target.value);
            });
        });
    } else {
        // Text answer: input event listener with debouncing
        const textInput = questionElement.querySelector(`#text-answer-${q.id}`);
        if (textInput) {
            textInput.addEventListener('input', (e) => {
                saveTextAnswer(q.id, e.target.value);
            });
        }
    }
    
    return questionElement;
}

// Clear session storage when test is fully completed
export function clearTestSession(forceClear = false) {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    
    // Only clear if we're actually finished or forced
    if (forceClear || state === 'completed' || state === 'submitted') {
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
            sessionStorage.removeItem('currentSessionId');
        }
    }
}

// Continue to MCQ handler for creative writing submissions - UPDATED WITH SEPARATE SESSIONS
window.continueToMCQ = async (questionId, studentName, parentEmail, tutorEmail, grade) => {
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    
    const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
    const fileInput = document.getElementById(`creative-writing-file-${questionId}`);
    
    if (!questionTextarea) {
        alert("Error: Could not find text area. Please refresh the page and try again.");
        return;
    }

    const textAnswer = questionTextarea.value.trim();
    const file = fileInput?.files[0];

    const continueBtn = document.querySelector('button[onclick*="continueToMCQ"]');
    if (continueBtn) {
        continueBtn.textContent = "Submitting Creative Writing...";
        continueBtn.disabled = true;
    }
    
    // Validate that at least one method is used
    if (!textAnswer && !file) {
        alert("Please either write your response in the text area or upload an image before continuing.");
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
        return;
    }
    
    // Validate file size and type
    if (file) {
        if (file.size > MAX_FILE_SIZE) {
            alert("File is too large. Please select an image smaller than 5MB.");
            if (continueBtn) {
                continueBtn.textContent = "Continue to Multiple-Choice Questions";
                continueBtn.disabled = false;
            }
            return;
        }
        
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert("Invalid file type. Please upload JPG, PNG, GIF, or WebP images only.");
            if (continueBtn) {
                continueBtn.textContent = "Continue to Multiple-Choice Questions";
                continueBtn.disabled = false;
            }
            return;
        }
    }
    
    try {
        let fileUrl = null;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            
            const response = await fetch(CLOUDINARY_URL, { 
                method: 'POST', 
                body: formData 
            });
            
            if (!response.ok) throw new Error("File upload failed. Please try again.");
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
        
        console.log("Creative writing submitted successfully, now redirecting to MCQ...");
        
        // CRITICAL FIX: Clear creative writing session before redirecting to MCQ
        // This ensures MCQ loads fresh questions instead of reusing creative writing session
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
            console.log("Cleared creative writing session before MCQ load");
        }
        
        // FIXED REDIRECT LOGIC
        setTimeout(() => {
            const currentUrl = window.location.href;
            
            // Handle both encoded and unencoded parameters
            let newUrl;
            if (currentUrl.includes('state=creative-writing')) {
                newUrl = currentUrl.replace('state=creative-writing', 'state=mcq');
            } else if (currentUrl.includes('state=creative%2Dwriting')) {
                newUrl = currentUrl.replace('state=creative%2Dwriting', 'state=mcq');
            } else {
                // Fallback: Use URLSearchParams
                const url = new URL(currentUrl);
                url.searchParams.set('state', 'mcq');
                newUrl = url.toString();
            }
            
            console.log("Redirecting from creative writing to MCQ:", newUrl);
            
            // Force redirect
            window.location.href = newUrl;
        }, 500);
        
    } catch (error) {
        console.error("Error submitting creative writing:", error);
        alert(`Submission error: ${error.message}. Please try again.`);
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
    }
};

// Clear session when page is unloaded (test completed)
window.addEventListener('beforeunload', function() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state === 'completed' || state === 'submitted') {
        clearTestSession(true);
    }
});

// Logout handler
window.handleLogout = function() {
    console.log("Logging out - clearing all test sessions");
    clearAllTestSessions();
    // Then redirect to login page or wherever
    window.location.href = '/login.html';
};
