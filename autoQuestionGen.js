import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let loadedQuestions = [];
let currentSessionId = null;
let saveTimeout = null;
let saveTextTimeout = null;

/**
 * Convert test subject to admin_questions subject format
 */
function getAdminQuestionsSubject(testSubject) {
    const subjectMap = {
        'ela': 'English',
        'math': 'Mathematics', 
        'science': 'Science',
        'socialstudies': 'Social Studies'
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
    
    const testSessionKey = `test-${grade}-${subject}-${state}-${studentName}-${parentEmail}`;
    const existingSessionId = sessionStorage.getItem('currentTestSession');
    
    if (existingSessionId && existingSessionId === testSessionKey) {
        console.log("Reusing session for current test and state:", testSessionKey);
        return testSessionKey;
    }
    
    clearOtherStateSessions(testSessionKey);
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

export function getAnswerData() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
}

export function getAllLoadedQuestions() {
    return loadedQuestions;
}

/**
 * Select ELA questions with priority: 1 passage + non-passage questions to reach 15, OR 2 passages
 */
function selectELAQuestions(allQuestions, passagesMap) {
    const questionsWithPassages = [];
    const questionsWithoutPassages = [];
    
    allQuestions.forEach(question => {
        if (question.passageId && passagesMap[question.passageId]) {
            questionsWithPassages.push(question);
        } else {
            questionsWithoutPassages.push(question);
        }
    });
    
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
    
    if (passageIds.length > 0) {
        const firstPassageId = passageIds[Math.floor(Math.random() * passageIds.length)];
        selectedQuestions.push(...questionsByPassage[firstPassageId]);
        selectedPassageIds.push(firstPassageId);
        console.log(`Selected first passage ${firstPassageId} with ${questionsByPassage[firstPassageId].length} questions`);
    }
    
    const questionsNeeded = 15 - selectedQuestions.length;
    const availableNonPassageQuestions = Math.min(questionsWithoutPassages.length, questionsNeeded);
    
    if (availableNonPassageQuestions >= questionsNeeded) {
        const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
        const additionalQuestions = shuffledNonPassage.slice(0, questionsNeeded);
        selectedQuestions.push(...additionalQuestions);
        console.log(`Added ${additionalQuestions.length} non-passage questions to reach 15 total`);
    } else if (passageIds.length > 1) {
        const remainingPassageIds = passageIds.filter(id => !selectedPassageIds.includes(id));
        if (remainingPassageIds.length > 0) {
            const secondPassageId = remainingPassageIds[Math.floor(Math.random() * remainingPassageIds.length)];
            selectedQuestions.push(...questionsByPassage[secondPassageId]);
            selectedPassageIds.push(secondPassageId);
            console.log(`Added second passage ${secondPassageId} with ${questionsByPassage[secondPassageId].length} questions`);
            
            const remainingSlots = 15 - selectedQuestions.length;
            if (remainingSlots > 0 && questionsWithoutPassages.length > 0) {
                const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
                const finalQuestions = shuffledNonPassage.slice(0, remainingSlots);
                selectedQuestions.push(...finalQuestions);
                console.log(`Added ${finalQuestions.length} non-passage questions after second passage`);
            }
        }
    } else {
        const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
        const additionalQuestions = shuffledNonPassage.slice(0, availableNonPassageQuestions);
        selectedQuestions.push(...additionalQuestions);
        console.log(`Added ${additionalQuestions.length} non-passage questions (only one passage available)`);
    }
    
    const finalSelection = selectedQuestions.slice(0, 15);
    console.log(`Final ELA selection: ${finalSelection.length} questions`);
    return finalSelection;
}

/**
 * Fetch from tests collection with proper nested structure handling
 */
async function fetchFromTestsCollection(grade, subject) {
    const subjectPrefix = subject.toLowerCase().slice(0, 3);
    const gradeNumber = grade.replace('grade', '');
    
    const gradeFormats = [
        gradeNumber,
        `${gradeNumber}`,
        grade,
        grade.replace('grade', 'Grade ').trim(),
    ];
    
    const idPrefixes = [];
    gradeFormats.forEach(g => {
        idPrefixes.push(`${g}-${subjectPrefix}`);
        idPrefixes.push(`${g}${subjectPrefix}`);
        idPrefixes.push(`${g}-${subject}`);
        idPrefixes.push(`${g}${subject}`);
    });
    
    const uniquePrefixes = [...new Set(idPrefixes)];
    console.log("🔍 Searching tests collection with prefixes:", uniquePrefixes);
    
    let allQuestions = [];
    let allPassages = [];
    
    for (const prefix of uniquePrefixes) {
        try {
            const q = query(
                collection(db, "tests"),
                where(documentId(), '>=', prefix),
                where(documentId(), '<', prefix + '\uf8ff')
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                for (const docSnap of snapshot.docs) {
                    const rawData = docSnap.data();
                    
                    if (rawData && rawData.tests && Array.isArray(rawData.tests)) {
                        rawData.tests.forEach((test) => {
                            if (test.passages && Array.isArray(test.passages)) {
                                test.passages.forEach(passage => {
                                    if (passage && !passage.passageId && passage.id) passage.passageId = passage.id;
                                    allPassages.push(passage);
                                });
                            }
                            if (test.questions && Array.isArray(test.questions)) {
                                test.questions.forEach(q => {
                                    q.grade = test.grade || gradeNumber;
                                    q.subject = test.subject || subject;
                                    q.imageUrl = q.image || q.image_url || q.imageUrl || null;
                                    q.passageId = q.passage_id || q.passageId || null;
                                });
                                allQuestions.push(...test.questions);
                            }
                        });
                    } else if (rawData && rawData.questions) {
                        if (Array.isArray(rawData.questions)) {
                            rawData.questions.forEach(q => {
                                q.imageUrl = q.image || q.image_url || q.imageUrl || null;
                                q.passageId = q.passage_id || q.passageId || null;
                            });
                            allQuestions.push(...rawData.questions);
                        }
                        if (rawData.passages && Array.isArray(rawData.passages)) {
                            allPassages.push(...rawData.passages);
                        }
                    }
                }
                if (allQuestions.length >= 30) break;
            }
        } catch (err) {
            console.warn(`Error querying tests collection with prefix ${prefix}:`, err);
        }
    }
    return { questions: allQuestions, passages: allPassages };
}

/**
 * Fetch from admin_questions collection with proper field handling
 */
async function fetchFromAdminQuestions(grade, subject) {
    const gradeNumber = grade.replace('grade', '');
    const adminSubject = getAdminQuestionsSubject(subject);
    
    const gradeFormats = [
        gradeNumber,
        parseInt(gradeNumber, 10),
        `grade${gradeNumber}`,
        `Grade ${gradeNumber}`,
        grade,
    ];
    
    let allQuestions = [];
    
    for (const g of gradeFormats) {
        try {
            const q = query(
                collection(db, "admin_questions"),
                where("grade", "==", g),
                where("subject", "==", adminSubject)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    try {
                        const questionData = doc.data();
                        if (!questionData || (!questionData.question && !questionData.type)) return;
                        
                        const normalizedQuestion = {
                            ...questionData,
                            firebaseId: doc.id,
                            id: doc.id || `admin-${Date.now()}`,
                            subject: subject.toLowerCase(),
                            grade: questionData.grade?.startsWith('grade') ? questionData.grade : `grade${questionData.grade}`,
                            imageUrl: questionData.image || questionData.image_url || questionData.imageUrl || null,
                            passageId: questionData.passage_id || questionData.passageId || null,
                            image_position: questionData.image_position || questionData.imagePosition || 'before'
                        };
                        
                        if (questionData.options) {
                            if (Array.isArray(questionData.options)) {
                                normalizedQuestion.options = questionData.options;
                            } else if (typeof questionData.options === 'string') {
                                try {
                                    const parsed = JSON.parse(questionData.options);
                                    normalizedQuestion.options = Array.isArray(parsed) ? parsed : [questionData.options];
                                } catch (e) {
                                    normalizedQuestion.options = [questionData.options];
                                }
                            } else {
                                normalizedQuestion.options = [];
                            }
                        } else {
                            normalizedQuestion.options = [];
                        }
                        
                        allQuestions.push(normalizedQuestion);
                    } catch (err) {
                        console.error('Error processing admin question:', doc.id, err);
                    }
                });
                break;
            }
        } catch (err) {
            console.warn(`Error querying admin_questions with grade ${g}:`, err);
        }
    }
    return allQuestions;
}

/**
 * STRATEGIC FIX: Attempt to fetch from GitHub with Adaptive Parsing
 */
async function fetchFromGitHub(grade, subject) {
    const baseUrl = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/';
    const gradeNumber = grade.replace('grade', '');
    
    const patterns = [
        `${gradeNumber}-${subject}.json`,
        `${gradeNumber}-${subject}`.toLowerCase(),
        `${grade}-${subject}.json`,
        `${gradeNumber}${subject}.json`,
        `${grade}${subject}.json`,
        `${gradeNumber}-${subject.charAt(0).toUpperCase() + subject.slice(1)}.json`,
        `Grade ${gradeNumber}-${subject}.json`,
    ];
    
    const uniquePatterns = [...new Set(patterns)];
    console.log("🔍 Trying GitHub patterns:", uniquePatterns);
    
    for (const pattern of uniquePatterns) {
        const url = baseUrl + pattern;
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Successfully fetched from GitHub using pattern: ${pattern}`);
                
                let questions = [];
                let passages = [];
                
                // Adaptive Array vs Object Handling
                if (Array.isArray(data)) {
                    questions = data;
                } else if (data && data.tests && Array.isArray(data.tests)) {
                    data.tests.forEach(test => {
                        if (test.questions) questions.push(...test.questions);
                        if (test.passages) passages.push(...test.passages);
                    });
                } else if (data && data.questions) {
                    questions = Array.isArray(data.questions) ? data.questions : [data.questions];
                    if (data.passages) {
                        passages = Array.isArray(data.passages) ? data.passages : [data.passages];
                    }
                }

                // Global Key Normalizer (Fixes 'image' and 'passageId' gaps)
                questions = questions.map((q, idx) => ({
                    ...q,
                    id: q.id || `gh-q-${idx}`,
                    imageUrl: q.image || q.image_url || q.imageUrl || null,
                    passageId: q.passage_id || q.passageId || null,
                    type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                }));

                passages = passages.map((p, idx) => ({
                    ...p,
                    passageId: p.id || p.passageId || `gh-p-${idx}`
                }));
                
                return { questions, passages };
            }
        } catch (e) {
            // Ignore fetch errors, move to next pattern
        }
    }
    throw new Error('No GitHub file found with any pattern');
}

/**
 * Optimizes Cloudinary image URLs with automatic transformations
 */
function optimizeImageUrl(originalUrl) {
    if (!originalUrl) return null;
    const urlString = String(originalUrl);
    if (!urlString.includes('cloudinary.com')) return urlString;
    
    if (urlString.includes('/upload/')) {
        if (!urlString.includes('q_auto') && !urlString.includes('f_auto')) {
            return urlString.replace('/upload/', '/upload/q_auto,f_auto/');
        }
    }
    return urlString;
}

/**
 * The entry point to load and display questions for a test.
 */
export async function loadQuestions(subject, grade, state) {
    if (state === 'creative-writing') {
        if (subject.toLowerCase() !== 'ela') {
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
        if (!isGrade3Plus(grade)) {
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
    
    if (!container) return;
    
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;
    if (submitBtnContainer) submitBtnContainer.style.display = 'none';

    currentSessionId = generateSessionId(grade, subject, state);

    const savedSession = getSavedSession();
    if (savedSession && savedSession.questions && savedSession.questions.length > 0) {
        loadedQuestions = savedSession.questions;
        displayQuestionsBasedOnState(loadedQuestions, state);
        restoreSavedAnswers();
        if (submitBtnContainer && state === 'mcq') submitBtnContainer.style.display = 'block';
        return;
    }

    let allQuestions = [];
    let allPassages = [];
    let creativeWritingQuestion = null;

    try {
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions = testsResult.questions;
        allPassages = testsResult.passages;

        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) {
            allQuestions = [...allQuestions, ...adminQuestions];
        }

        if (allQuestions.length === 0) {
            try {
                const gitHubData = await fetchFromGitHub(grade, subject);
                allQuestions = gitHubData.questions || [];
                allPassages = gitHubData.passages || [];
            } catch (gitHubError) {
                throw new Error("No questions found in any source.");
            }
        }

        if (subject.toLowerCase() !== 'ela') {
            allQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
        }

        const passagesMap = {};
        allPassages.forEach(passage => {
            if (passage.passageId && passage.content) {
                passagesMap[passage.passageId] = passage;
            }
        });

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No ${subject} questions found in any source.</p>`;
            return;
        }

        // Final Normalization Pass
        allQuestions = allQuestions.map(q => ({
            ...q,
            imageUrl: q.image || q.imageUrl || q.image_url || null,
            passageId: q.passageId || q.passage_id || null
        }));

        if (subject.toLowerCase() === 'ela' && state === 'creative-writing' && isGrade3Plus(grade)) {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing');
            
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p class="text-red-600">❌ Creative writing question not found. Redirecting to multiple choice...</p>`;
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('state', 'mcq');
                    window.location.search = params.toString();
                }, 2000);
                return;
            }
            loadedQuestions = [{ ...creativeWritingQuestion, id: creativeWritingQuestion.id || 'creative-writing-0' }];
            saveSession(loadedQuestions, passagesMap);
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            if (filteredQuestions.length === 0) {
                container.innerHTML = `<p class="text-red-600">❌ No ${subject} multiple-choice questions found.</p>`;
                return;
            }
            
            let selectedQuestions = [];
            if (subject.toLowerCase() === 'ela') {
                selectedQuestions = selectELAQuestions(filteredQuestions, passagesMap);
            } else {
                selectedQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, 15);
            }
            
            loadedQuestions = selectedQuestions.map((q, index) => ({ 
                ...q, 
                id: q.firebaseId || q.id || `question-${index}`
            }));
            
            saveSession(loadedQuestions, passagesMap);
            displayMCQQuestions(loadedQuestions, passagesMap);
            if (submitBtnContainer) submitBtnContainer.style.display = 'block';
        }
    } catch (err) {
        console.error("❌ Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred: ${err.message}</p>`;
    }
}

function isGrade3Plus(grade) {
    try {
        const gradeNumber = parseInt(grade.replace('grade', ''));
        return !isNaN(gradeNumber) && gradeNumber >= 3 && gradeNumber <= 12;
    } catch (err) {
        return false;
    }
}

function saveSession(questions, passages) {
    try {
        const sessionData = { questions, passages, timestamp: Date.now(), sessionId: currentSessionId };
        sessionStorage.setItem(currentSessionId, JSON.stringify(sessionData));
    } catch (err) {
        console.error('Error saving session:', err);
    }
}

function getSavedSession() {
    if (!currentSessionId) return null;
    try {
        const saved = sessionStorage.getItem(currentSessionId);
        return saved ? JSON.parse(saved) : null;
    } catch (err) {
        return null;
    }
}

function restoreSavedAnswers() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    if (!savedAnswers) return;
    try {
        const answers = JSON.parse(savedAnswers);
        Object.keys(answers).forEach(questionId => {
            const radio = document.querySelector(`input[name="q${questionId}"][value="${answers[questionId]}"]`);
            if (radio) radio.checked = true;
            const textInput = document.querySelector(`#text-answer-${questionId}`);
            if (textInput && answers[questionId]) textInput.value = answers[questionId];
        });
    } catch (err) {}
}

function saveAnswer(questionId, answer) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`) || '{}';
            const answers = JSON.parse(savedAnswers);
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {}
    }, 300);
}

function saveTextAnswer(questionId, answer) {
    clearTimeout(saveTextTimeout);
    saveTextTimeout = setTimeout(() => {
        try {
            const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`) || '{}';
            const answers = JSON.parse(savedAnswers);
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {}
    }, 500);
}

function displayQuestionsBasedOnState(questions, state) {
    const savedSession = getSavedSession();
    const passagesMap = savedSession?.passages ? 
        Object.fromEntries(savedSession.passages.map(p => [p.passageId, p])) : {};
    
    if (state === 'creative-writing') {
        const creativeWritingQuestion = questions.find(q => q.type === 'creative-writing');
        if (creativeWritingQuestion) {
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            const container = document.getElementById('question-container');
            if (container) container.innerHTML = '<p class="text-red-600">Could not restore creative writing question. Please refresh the page.</p>';
        }
    } else {
        displayMCQQuestions(questions, passagesMap);
    }
}

export { getAllLoadedQuestions as getLoadedQuestions };

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    if (typeof unsafe !== 'string') return String(unsafe);
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getQuestionOptions(question) {
    if (!question || !question.options) return [];
    if (Array.isArray(question.options)) return question.options;
    if (typeof question.options === 'string') {
        try {
            const parsed = JSON.parse(question.options);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            return question.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        }
    }
    if (typeof question.options === 'object' && question.options !== null) {
        return Object.values(question.options).filter(opt => opt !== null && opt !== undefined);
    }
    return [];
}

function displayCreativeWriting(question) {
    const container = document.getElementById("question-container");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const studentName = escapeHtml(params.get('studentName') || '');
    const parentEmail = escapeHtml(params.get('parentEmail') || '');
    const tutorEmail = escapeHtml(params.get('tutorEmail') || '');
    const grade = escapeHtml(params.get('grade') || '');
    
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

function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!document.getElementById('question-styles')) {
        const style = document.createElement('style');
        style.id = 'question-styles';
        style.textContent = `
            .question-container { max-width: 800px; margin: 0 auto; padding: 0 20px; }
            .question-block { max-width: 100%; }
            .image-container img { max-width: 100%; max-height: 400px; width: auto; height: auto; object-fit: contain; border-radius: 8px; }
            .text-answer-input { 
                width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; transition: border-color 0.2s;
            }
            .text-answer-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
            .answer-type-label { display: inline-block; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px; color: #6b7280; margin-left: 8px; }
            .passage-content { white-space: pre-wrap; font-family: 'Inter', sans-serif; line-height: 1.6; }
        `;
        document.head.appendChild(style);
    }
    
    container.className = 'question-container';
    
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach((question) => {
        if (question.passageId && passagesMap[question.passageId]) {
            if (!questionsByPassage[question.passageId]) questionsByPassage[question.passageId] = [];
            questionsByPassage[question.passageId].push(question);
        } else {
            questionsWithoutPassage.push(question);
        }
    });
    
    let globalQuestionIndex = 1; 
    
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];
        
        const passageElement = document.createElement('div');
        passageElement.className = 'passage-container bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500';
        passageElement.innerHTML = `
            <h3 class="text-lg font-bold text-green-800 mb-2">${escapeHtml(passage.title || 'Reading Passage')}</h3>
            ${passage.subtitle ? `<h4 class="text-md text-gray-600 mb-3">${escapeHtml(passage.subtitle)}</h4>` : ''}
            ${passage.author ? `<p class="text-sm text-gray-500 mb-4">${escapeHtml(passage.author)}</p>` : ''}
            <div class="passage-content text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border">${escapeHtml(passage.content)}</div>
        `;
        container.appendChild(passageElement);
        
        passageQuestions.forEach(q => {
            const questionElement = createQuestionElement(q, globalQuestionIndex);
            if (questionElement) {
                container.appendChild(questionElement);
                globalQuestionIndex++;
            }
        });
    });
    
    questionsWithoutPassage.forEach(q => {
        const questionElement = createQuestionElement(q, globalQuestionIndex);
        if (questionElement) {
            container.appendChild(questionElement);
            globalQuestionIndex++;
        }
    });
}

function createQuestionElement(q, displayIndex) {
    if (!q || typeof q !== 'object') return null;
    
    const questionElement = document.createElement('div');
    questionElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    questionElement.setAttribute('data-question-id', q.id || `question-${displayIndex}`);
    
    const imageUrl = q.imageUrl || q.image_url || null;
    const optimizedImageUrl = imageUrl ? optimizeImageUrl(imageUrl) : null;
    const showImageBefore = optimizedImageUrl && q.image_position !== 'after';
    const showImageAfter = optimizedImageUrl && q.image_position === 'after';
    
    const safeQuestionText = escapeHtml(q.question || '');
    const questionOptions = getQuestionOptions(q);
    const hasOptions = questionOptions && questionOptions.length > 0;
    const safeOptions = questionOptions.map(opt => escapeHtml(opt));
    
    try {
        const safeImageUrl = escapeHtml(imageUrl || '');
        const safeOptimizedUrl = escapeHtml(optimizedImageUrl || '');

        questionElement.innerHTML = `
            ${showImageBefore && safeOptimizedUrl ? `
                <div class="image-container mb-3">
                    <img src="${safeOptimizedUrl}" 
                         class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity js-open-image"
                         alt="Question image"
                         data-full-url="${safeImageUrl}"
                         loading="lazy"/>
                    <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
                </div>
            ` : ''}
            
            <p class="font-semibold mb-3 question-text text-gray-800">
                ${displayIndex}. ${safeQuestionText}
                <span class="answer-type-label">${hasOptions ? 'Multiple Choice' : 'Text Answer'}</span>
            </p>
            
            ${showImageAfter && safeOptimizedUrl ? `
                <div class="image-container mt-3">
                    <img src="${safeOptimizedUrl}" 
                         class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity js-open-image"
                         alt="Question image"
                         data-full-url="${safeImageUrl}"
                         loading="lazy"/>
                    <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
                </div>
            ` : ''}
            
            <div class="mt-3 space-y-2">
                ${hasOptions ? 
                    safeOptions.map(opt => `
                        <label class="flex items-center py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                            <input type="radio" name="q${q.id || displayIndex}" value="${opt}" class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"> 
                            <span class="text-gray-700">${opt}</span>
                        </label>
                    `).join('') 
                    : 
                    `
                    <div class="text-answer-container">
                        <textarea 
                            id="text-answer-${q.id || displayIndex}" 
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
        
        if (hasOptions) {
            const radioInputs = questionElement.querySelectorAll(`input[name="q${q.id || displayIndex}"]`);
            radioInputs.forEach(radio => {
                radio.addEventListener('change', (e) => saveAnswer(q.id || displayIndex, e.target.value));
            });
        } else {
            const textInput = questionElement.querySelector(`#text-answer-${q.id || displayIndex}`);
            if (textInput) {
                textInput.addEventListener('input', (e) => saveTextAnswer(q.id || displayIndex, e.target.value));
            }
        }

        questionElement.querySelectorAll('.js-open-image').forEach(img => {
            img.addEventListener('click', () => {
                const url = img.getAttribute('data-full-url');
                if (url) window.open(url, '_blank');
            });
        });
        
        return questionElement;
    } catch (error) {
        const fallbackElement = document.createElement('div');
        fallbackElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4 border-red-300';
        fallbackElement.innerHTML = `
            <p class="font-semibold mb-3 text-gray-800">
                ${displayIndex}. ${safeQuestionText}
                <span class="answer-type-label">Error loading question</span>
            </p>
            <p class="text-red-500 text-sm">There was an error displaying this question. Please try refreshing the page.</p>
        `;
        return fallbackElement;
    }
}

export function clearTestSession(forceClear = false) {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    
    if (forceClear || state === 'completed' || state === 'submitted') {
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
            sessionStorage.removeItem('currentSessionId');
        }
    }
}

window.continueToMCQ = async (questionId, studentName, parentEmail, tutorEmail, grade) => {
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    
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
    
    if (!textAnswer && !file) {
        alert("Please either write your response in the text area or upload an image before continuing.");
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
        return;
    }
    
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
            
            const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
            
            if (!response.ok) throw new Error("File upload failed. Please try again.");
            const result = await response.json();
            
            if (result.secure_url) {
                fileUrl = result.secure_url;
            } else {
                throw new Error("File upload failed. Please try again.");
            }
        }
        
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
        
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
        }
        
        setTimeout(() => {
            const currentUrl = window.location.href;
            let newUrl;
            if (currentUrl.includes('state=creative-writing')) {
                newUrl = currentUrl.replace('state=creative-writing', 'state=mcq');
            } else if (currentUrl.includes('state=creative%2Dwriting')) {
                newUrl = currentUrl.replace('state=creative%2Dwriting', 'state=mcq');
            } else {
                const url = new URL(currentUrl);
                url.searchParams.set('state', 'mcq');
                newUrl = url.toString();
            }
            window.location.href = newUrl;
        }, 500);
        
    } catch (error) {
        alert(`Submission error: ${error.message}. Please try again.`);
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
    }
};

window.addEventListener('beforeunload', function() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state === 'completed' || state === 'submitted') {
        clearTestSession(true);
    }
});

window.handleLogout = function() {
    clearAllTestSessions();
    window.location.href = '/login.html';
};
