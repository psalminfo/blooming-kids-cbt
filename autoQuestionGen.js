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
            console.log(`Added second passage ${secondPassageId} with ${questionsByPassage[secondPassageId].length} questions (not enough non-passage questions)`);
            
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
    console.log(`Final ELA selection: ${finalSelection.length} questions (includes ${selectedPassageIds.length} passages)`);
    return finalSelection;
}

/**
 * Fetch from tests collection with proper nested structure handling
 */
async function fetchFromTestsCollection(grade, subject) {
    const subjectPrefix = subject.toLowerCase().slice(0, 3); // "math" → "mat", "ela" → "ela"
    
    // Extract just the grade number (e.g., from "grade3" get "3")
    const gradeNumber = grade.replace('grade', ''); // "3"
    
    // Possible grade formats for document ID prefix - prioritize "3-ela", "3-math"
    const gradeFormats = [
        gradeNumber,                    // "3" (this matches your DB!)
        `${gradeNumber}`,                // "3" (same)
        grade,                           // "grade3" (fallback)
        grade.replace('grade', 'Grade ').trim(), // "Grade 3" (fallback)
    ];
    
    // Try with and without hyphen, and with both subject prefix and full subject
    const idPrefixes = [];
    gradeFormats.forEach(g => {
        idPrefixes.push(`${g}-${subjectPrefix}`);     // "3-mat"
        idPrefixes.push(`${g}${subjectPrefix}`);      // "3mat"
        idPrefixes.push(`${g}-${subject}`);           // "3-math" (this matches your exact format!)
        idPrefixes.push(`${g}${subject}`);            // "3math"
    });
    
    // Remove duplicates
    const uniquePrefixes = [...new Set(idPrefixes)];
    
    console.log("🔍 Searching tests collection with prefixes:", uniquePrefixes);
    
    let allQuestions = [];
    let allPassages = [];
    
    for (const prefix of uniquePrefixes) {
        try {
            console.log(`Trying tests collection query with prefix: ${prefix}`);
            const q = query(
                collection(db, "tests"),
                where(documentId(), '>=', prefix),
                where(documentId(), '<', prefix + '\uf8ff')
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                console.log(`✅ Found ${snapshot.size} documents in tests collection with prefix: ${prefix}`);
                
                // Process ALL matching documents
                for (const docSnap of snapshot.docs) {
                    console.log(`Processing document: ${docSnap.id}`);
                    const rawData = docSnap.data();
                    
                    // The structure: document has a "tests" array containing test objects
                    if (rawData && rawData.tests && Array.isArray(rawData.tests)) {
                        // Iterate through each test in the tests array
                        rawData.tests.forEach((test, index) => {
                            console.log(`Test ${index}:`, {
                                hasQuestions: !!(test.questions && Array.isArray(test.questions)),
                                hasPassages: !!(test.passages && Array.isArray(test.passages)),
                                passageCount: test.passages?.length || 0,
                                questionCount: test.questions?.length || 0
                            });
                            
                            // Extract passages from this test
                            if (test.passages && Array.isArray(test.passages)) {
                                test.passages.forEach(passage => {
                                    // Ensure each passage has a passageId
                                    if (passage && !passage.passageId && passage.id) {
                                        passage.passageId = passage.id;
                                    }
                                    allPassages.push(passage);
                                });
                                console.log(`  - Added ${test.passages.length} passages from test ${index}`);
                            }
                            
                            // Extract questions from this test
                            if (test.questions && Array.isArray(test.questions)) {
                                test.questions.forEach(q => {
                                    // Add the grade and subject to each question for context
                                    q.grade = test.grade || gradeNumber;
                                    q.subject = test.subject || subject;
                                    
                                    // Normalize image field names
                                    if (q.image_url && !q.imageUrl) {
                                        q.imageUrl = q.image_url;
                                    }
                                    if (q.imageUrl && q.image_position === undefined && q.imagePosition) {
                                        q.image_position = q.imagePosition;
                                    }
                                });
                                allQuestions.push(...test.questions);
                                console.log(`  - Added ${test.questions.length} questions from test ${index}`);
                            }
                        });
                    } 
                    // Fallback for older structure where questions/passages are at document root
                    else if (rawData && rawData.questions) {
                        console.log("Found legacy document structure (questions at root)");
                        if (Array.isArray(rawData.questions)) {
                            rawData.questions.forEach(q => {
                                if (q.image_url && !q.imageUrl) {
                                    q.imageUrl = q.image_url;
                                }
                            });
                            allQuestions.push(...rawData.questions);
                        }
                        if (rawData.passages && Array.isArray(rawData.passages)) {
                            allPassages.push(...rawData.passages);
                        }
                    }
                }
                
                console.log(`📊 Current totals after processing: ${allQuestions.length} questions, ${allPassages.length} passages`);
                
                // If we have enough questions, we can stop
                if (allQuestions.length >= 30) break;
            }
        } catch (err) {
            console.warn(`Error querying tests collection with prefix ${prefix}:`, err);
        }
    }
    
    console.log(`📊 FINAL TESTS Collection: ${allQuestions.length} questions, ${allPassages.length} passages`);
    
    // Log sample of first few passages for debugging
    if (allPassages.length > 0) {
        console.log("Sample passages found:", allPassages.slice(0, 2).map(p => ({
            passageId: p.passageId,
            title: p.title,
            hasContent: !!p.content
        })));
    }
    
    return { questions: allQuestions, passages: allPassages };
}

/**
 * Fetch from admin_questions collection with proper field handling
 */
async function fetchFromAdminQuestions(grade, subject) {
    const gradeNumber = grade.replace('grade', ''); // "3"
    const adminSubject = getAdminQuestionsSubject(subject); // "Mathematics" or "English"
    
    // Possible grade formats in admin_questions
    const gradeFormats = [
        gradeNumber,                    // "3" (string)
        parseInt(gradeNumber, 10),      // 3 (number)
        `grade${gradeNumber}`,           // "grade3"
        `Grade ${gradeNumber}`,          // "Grade 3"
        grade,                           // "grade3"
    ];
    
    let allQuestions = [];
    
    for (const g of gradeFormats) {
        try {
            console.log(`Trying admin_questions query with grade:`, g, `subject:`, adminSubject);
            const q = query(
                collection(db, "admin_questions"),
                where("grade", "==", g),
                where("subject", "==", adminSubject)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                console.log(`✅ Found ${snapshot.size} documents in admin_questions with grade:`, g);
                snapshot.forEach(doc => {
                    try {
                        const questionData = doc.data();
                        if (!questionData || (!questionData.question && !questionData.type)) {
                            console.warn('Skipping invalid admin question (missing fields):', doc.id);
                            return;
                        }
                        
                        // Normalize the question data
                        const normalizedQuestion = {
                            ...questionData,
                            firebaseId: doc.id,
                            id: doc.id || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            subject: subject.toLowerCase(),
                            grade: questionData.grade?.startsWith('grade') ? questionData.grade : `grade${questionData.grade}`,
                            // Handle image_url field (with underscore)
                            imageUrl: questionData.image_url || questionData.imageUrl || null,
                            image_position: questionData.image_position || questionData.imagePosition || 'before'
                        };
                        
                        // Handle options - could be array or string
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
                break; // Stop after first successful format
            }
        } catch (err) {
            console.warn(`Error querying admin_questions with grade ${g}:`, err);
        }
    }
    
    return allQuestions;
}

/**
 * Attempt to fetch from GitHub with multiple filename variations
 */
async function fetchFromGitHub(grade, subject) {
    const baseUrl = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/';
    
    // Extract just the number from grade (e.g., "grade3" → "3")
    const gradeNumber = grade.replace('grade', '');
    
    // Define possible filename patterns
    const patterns = [
        // Most likely patterns first
        `${gradeNumber}-${subject}.json`,           // 3-math.json
        `${gradeNumber}-${subject}`.toLowerCase(),  // 3-math.json (lowercase)
        `${grade}-${subject}.json`,                  // grade3-math.json
        `${gradeNumber}${subject}.json`,             // 3math.json
        `${grade}${subject}.json`,                    // grade3math.json
        
        // With different capitalizations
        `${gradeNumber}-${subject.charAt(0).toUpperCase() + subject.slice(1)}.json`, // 3-Math.json
        `${grade.charAt(0).toUpperCase() + grade.slice(1)}-${subject.charAt(0).toUpperCase() + subject.slice(1)}.json`, // Grade3-Math.json
        
        // With spaces
        `Grade ${gradeNumber}-${subject}.json`,      // Grade 3-math.json
        `Grade ${gradeNumber} ${subject}.json`,      // Grade 3 math.json
    ];
    
    // Remove duplicates
    const uniquePatterns = [...new Set(patterns)];
    
    console.log("🔍 Trying GitHub patterns:", uniquePatterns);
    
    for (const pattern of uniquePatterns) {
        const url = baseUrl + pattern;
        try {
            console.log(`Trying GitHub URL: ${url}`);
            const response = await fetch(url, { 
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Successfully fetched from GitHub using pattern: ${pattern}`);
                
                // Extract questions and passages from GitHub data
                let questions = [];
                let passages = [];
                
                if (data && data.tests && Array.isArray(data.tests)) {
                    data.tests.forEach(test => {
                        if (test.questions) questions.push(...test.questions);
                        if (test.passages) passages.push(...test.passages);
                    });
                } else if (data && data.questions) {
                    questions = Array.isArray(data.questions) ? data.questions : [data.questions];
                }
                
                return { questions, passages };
            }
        } catch (e) {
            // Ignore individual fetch errors
        }
    }
    throw new Error('No GitHub file found with any pattern');
}

/**
 * Optimizes Cloudinary image URLs with automatic transformations
 */
function optimizeImageUrl(originalUrl) {
    if (!originalUrl) return null;
    
    // Handle both string URLs and ensure it's a Cloudinary URL
    const urlString = String(originalUrl);
    if (!urlString.includes('cloudinary.com')) {
        return urlString;
    }
    
    // Check if URL already has transformations
    if (urlString.includes('/upload/')) {
        // Add quality and format optimization if not present
        if (!urlString.includes('q_auto') && !urlString.includes('f_auto')) {
            return urlString.replace('/upload/', '/upload/q_auto,f_auto/');
        }
    }
    
    return urlString;
}

/**
 * The entry point to load and display questions for a test.
 * @param {string} subject The subject of the test (e.g., 'math').
 * @param {string} grade The grade level of the test (e.g., 'grade3').
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
    
    if (!container) {
        console.error("CRITICAL: question-container element not found in DOM");
        return;
    }
    
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;
    if (submitBtnContainer) {
        submitBtnContainer.style.display = 'none';
    }

    // Generate session ID
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

    let allQuestions = [];
    let allPassages = [];
    let creativeWritingQuestion = null;

    try {
        console.log(`🔄 FETCHING QUESTIONS FOR: ${grade} ${subject.toUpperCase()} - STATE: ${state}`);

        // 1. FETCH FROM TESTS COLLECTION with proper nested structure handling
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions = testsResult.questions;
        allPassages = testsResult.passages;
        console.log(`📊 TESTS Collection: Loaded ${allQuestions.length} questions, ${allPassages.length} passages`);

        // 2. FETCH FROM ADMIN_QUESTIONS COLLECTION with proper field handling
        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) {
            console.log(`✅ Loaded ${adminQuestions.length} valid ${subject} questions from ADMIN_QUESTIONS`);
            allQuestions = [...allQuestions, ...adminQuestions];
        } else {
            console.log(`❌ No documents found in ADMIN_QUESTIONS for ${subject} after trying multiple grade formats`);
        }

        // 3. FALLBACK TO GITHUB IF BOTH COLLECTIONS EMPTY
        if (allQuestions.length === 0) {
            console.log(`📦 No ${subject} questions found in Firebase, trying GitHub...`);
            try {
                const gitHubData = await fetchFromGitHub(grade, subject);
                allQuestions = gitHubData.questions || [];
                allPassages = gitHubData.passages || [];
                console.log(`✅ Loaded ${allQuestions.length} questions from GitHub for ${subject}`);
                console.log(`✅ Loaded ${allPassages.length} passages from GitHub for ${subject}`);
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
        console.log("📚 Passages map keys:", Object.keys(passagesMap));

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
                id: q.firebaseId || q.id || `question-${index}`,
                // Ensure imageUrl is properly set
                imageUrl: q.imageUrl || q.image_url || null
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
 * Check if grade is 3 or higher for creative writing (grade is normalized, e.g., "grade3")
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
            const radio = document.querySelector(`input[name="q${questionId}"][value="${answers[questionId]}"]`);
            if (radio) {
                radio.checked = true;
            }
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
    clearTimeout(saveTextTimeout);
    saveTextTimeout = setTimeout(() => {
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
    const savedSession = getSavedSession();
    const passagesMap = savedSession?.passages ? 
        Object.fromEntries(savedSession.passages.map(p => [p.passageId, p])) : {};
    
    if (state === 'creative-writing') {
        const creativeWritingQuestion = questions.find(q => q.type === 'creative-writing');
        if (creativeWritingQuestion) {
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            console.warn('No creative writing question found in session; cannot restore state.');
            const container = document.getElementById('question-container');
            if (container) container.innerHTML = '<p class="text-red-600">Could not restore creative writing question. Please refresh the page.</p>';
        }
    } else {
        displayMCQQuestions(questions, passagesMap);
    }
}

export { getAllLoadedQuestions as getLoadedQuestions };

/**
 * Escape HTML to prevent XSS
 */
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

/**
 * Safely get options array from question object
 */
function getQuestionOptions(question) {
    if (!question || !question.options) {
        return [];
    }
    
    if (Array.isArray(question.options)) {
        return question.options;
    }
    
    if (typeof question.options === 'string') {
        try {
            const parsed = JSON.parse(question.options);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            // If JSON parsing fails, try splitting by commas
            return question.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        }
    }
    
    if (typeof question.options === 'object' && question.options !== null) {
        return Object.values(question.options).filter(opt => opt !== null && opt !== undefined);
    }
    
    return [];
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
        .image-container img { max-width: 100%; max-height: 400px; width: auto; height: auto; object-fit: contain; border-radius: 8px; }
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
        .passage-content {
            white-space: pre-wrap;
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
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
            <div class="passage-content text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border">${escapeHtml(passage.content)}</div>
        `;
        container.appendChild(passageElement);
        
        // Display questions for this passage with continuous numbering
        passageQuestions.forEach(q => {
            const questionElement = createQuestionElement(q, globalQuestionIndex);
            if (questionElement) {
                container.appendChild(questionElement);
                globalQuestionIndex++;
            }
        });
    });
    
    // Display questions without passages AFTER passage questions
    questionsWithoutPassage.forEach(q => {
        const questionElement = createQuestionElement(q, globalQuestionIndex);
        if (questionElement) {
            container.appendChild(questionElement);
            globalQuestionIndex++;
        }
    });
}

/**
 * Creates a question element with optimized images and answer tracking
 */
function createQuestionElement(q, displayIndex) {
    // Validate the question object
    if (!q || typeof q !== 'object') {
        console.error('Invalid question object:', q);
        return null;
    }
    
    const questionElement = document.createElement('div');
    questionElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    questionElement.setAttribute('data-question-id', q.id || `question-${displayIndex}`);
    
    // Handle image URL - could be in various fields
    const imageUrl = q.imageUrl || q.image_url || null;
    
    // Optimize the image URL
    const optimizedImageUrl = imageUrl ? optimizeImageUrl(imageUrl) : null;
    const showImageBefore = optimizedImageUrl && q.image_position !== 'after';
    const showImageAfter = optimizedImageUrl && q.image_position === 'after';
    
    const safeQuestionText = escapeHtml(q.question || '');
    
    // Safely get options
    const questionOptions = getQuestionOptions(q);
    const hasOptions = questionOptions && questionOptions.length > 0;
    
    // Escape options for display
    const safeOptions = questionOptions.map(opt => escapeHtml(opt));
    
    try {
        // Store imageUrl as data attribute to avoid XSS in onclick
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
        
        // Add event listeners based on question type
        if (hasOptions) {
            const radioInputs = questionElement.querySelectorAll(`input[name="q${q.id || displayIndex}"]`);
            radioInputs.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    saveAnswer(q.id || displayIndex, e.target.value);
                });
            });
        } else {
            const textInput = questionElement.querySelector(`#text-answer-${q.id || displayIndex}`);
            if (textInput) {
                textInput.addEventListener('input', (e) => {
                    saveTextAnswer(q.id || displayIndex, e.target.value);
                });
            }
        }

        // Safe image open
        questionElement.querySelectorAll('.js-open-image').forEach(img => {
            img.addEventListener('click', () => {
                const url = img.getAttribute('data-full-url');
                if (url) window.open(url, '_blank');
            });
        });
        
        return questionElement;
    } catch (error) {
        console.error('Error creating question element:', error, q);
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

// Continue to MCQ handler for creative writing submissions
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
        
        // Clear creative writing session before redirecting to MCQ
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
            console.log("Cleared creative writing session before MCQ load");
        }
        
        // Redirect to MCQ
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
            
            console.log("Redirecting from creative writing to MCQ:", newUrl);
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
    window.location.href = '/login.html';
};
