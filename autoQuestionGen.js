import { db } from './firebaseConfig.js';
<<<<<<< HEAD
import { collection, getDocs, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
=======
import { collection, getDocs, query, where, documentId, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
>>>>>>> main

let loadedQuestions = [];
let currentSessionId = null;
let saveTimeout = null;
let saveTextTimeout = null;

<<<<<<< HEAD
// ==========================================
// EXPORTS REQUIRED BY submitAnswers.js
// ==========================================
export function getLoadedQuestions() { return loadedQuestions; }
export function getAllLoadedQuestions() { return loadedQuestions; }
export function getAnswerData() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
}
=======
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
 * Check if subject matches (flexible matching)
 */
function isSubjectMatch(docSubject, requestedSubject) {
    if (!docSubject || !requestedSubject) return false;
    const dbSub = String(docSubject).toLowerCase();
    const reqSub = String(requestedSubject).toLowerCase();
    
    // Special handling for ELA/English
    if (reqSub === 'ela') {
        return dbSub.includes('ela') || dbSub.includes('english') || dbSub.includes('reading') || dbSub.includes('writing');
    }
    // Special handling for Math
    if (reqSub === 'math') {
        return dbSub.includes('math') || dbSub.includes('mathematics');
    }
    // General matching
    return dbSub.includes(reqSub) || reqSub.includes(dbSub);
}

/**
 * Check if grade matches (extract numbers and compare)
 */
function isGradeMatch(docGrade, requestedGrade) {
    if (!docGrade || !requestedGrade) return false;
    const dbGradeStr = String(docGrade).toLowerCase().replace(/[^0-9]/g, '');
    const reqGradeStr = String(requestedGrade).toLowerCase().replace(/[^0-9]/g, '');
    return dbGradeStr === reqGradeStr;
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
>>>>>>> main
export function clearAllTestSessions() {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('test-') || key.startsWith('session-') || key.includes('-answers') || key === 'currentSessionId' || key === 'currentTestSession' || key === 'justCompletedCreativeWriting')) {
            keysToRemove.push(key);
        }
    }
<<<<<<< HEAD
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
}
export function clearTestSession(forceClear = false) {
    if (forceClear || ['completed', 'submitted'].includes(new URLSearchParams(window.location.search).get('state'))) {
        sessionStorage.removeItem(currentSessionId);
        sessionStorage.removeItem(`${currentSessionId}-answers`);
    }
}

// ==========================================
// UTILITY & MATCHING FUNCTIONS
// ==========================================
function isSubjectMatch(docSubject, requestedSubject) {
    if (!docSubject || !requestedSubject) return false;
    const dbSub = String(docSubject).toLowerCase();
    const reqSub = String(requestedSubject).toLowerCase();
    if (reqSub === 'ela') return dbSub.includes('ela') || dbSub.includes('english') || dbSub.includes('reading') || dbSub.includes('writing');
    if (reqSub === 'math') return dbSub.includes('math') || dbSub.includes('mathematics');
    return dbSub.includes(reqSub) || reqSub.includes(dbSub);
}

function isGradeMatch(docGrade, requestedGrade) {
    if (!docGrade || !requestedGrade) return false;
    const dbGradeStr = String(docGrade).toLowerCase().replace(/[^0-9]/g, '');
    const reqGradeStr = String(requestedGrade).toLowerCase().replace(/[^0-9]/g, '');
    return dbGradeStr === reqGradeStr;
}

function generateSessionId(grade, subject, state) {
    const params = new URLSearchParams(window.location.search);
    return `test-${grade}-${subject}-${state}-${params.get('studentName')}-${params.get('parentEmail')}`;
}

function optimizeImageUrl(originalUrl) {
    if (!originalUrl) return null;
    const urlString = String(originalUrl);
    if (!urlString.includes('cloudinary.com')) return urlString;
    if (urlString.includes('/upload/') && !urlString.includes('q_auto')) return urlString.replace('/upload/', '/upload/q_auto,f_auto/');
    return urlString;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getQuestionOptions(question) {
    if (!question || !question.options) return [];
    if (Array.isArray(question.options)) return question.options;
    if (typeof question.options === 'string') {
        try { return JSON.parse(question.options); } catch (e) { return question.options.split(',').map(o => o.trim()); }
    }
    return typeof question.options === 'object' ? Object.values(question.options) : [];
}

// ==========================================
// DATA FETCHING FROM ALL 3 SOURCES
// ==========================================
async function fetchFromTestsCollection(grade, subject) {
    let allQuestions = [];
    let allPassages = [];
    try {
        const gradeNum = grade.replace(/[^0-9]/g, '');
        let subjectKey = (subject.toLowerCase() === 'english' || subject.toLowerCase() === 'reading') ? 'ela' : subject.toLowerCase();
        
        // 1. Direct Snipe (Checks specific documents fast)
        const targetIds = [`${gradeNum}-${subjectKey}`, `staar_reading_${gradeNum}_2022`, `staar_grade_${gradeNum}_math_2018`];
        for (const docId of targetIds) {
            try {
                const docSnap = await getDoc(doc(db, "tests", docId));
                if (docSnap.exists()) {
                    const rawData = docSnap.data();
                    if (rawData.tests && Array.isArray(rawData.tests)) {
                        rawData.tests.forEach(test => {
                            if (test.passages) test.passages.forEach(p => {
                                p.passageId = String(p.passageId || p.id).trim();
                                p.content = p.content || p.text || p.body;
                                allPassages.push(p);
                            });
                            if (test.questions) test.questions.forEach(q => {
                                q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                                q.passageId = q.passageId || q.passage_id ? String(q.passageId || q.passage_id).trim() : null;
                                allQuestions.push(q);
                            });
                        });
                    }
                    return { questions: allQuestions, passages: allPassages }; 
                }
            } catch (e) {}
        }
        
        // 2. Deep Scan Fallback (Scans whole collection)
        const snapshot = await getDocs(collection(db, "tests"));
        snapshot.forEach(docSnap => {
            const rawData = docSnap.data();
            Object.keys(rawData).forEach(key => {
                if (Array.isArray(rawData[key])) {
                    rawData[key].forEach((item) => {
                        if (item && item.grade && item.subject && isGradeMatch(item.grade, grade) && isSubjectMatch(item.subject, subject)) {
                            if (item.passages) item.passages.forEach(p => {
                                p.passageId = String(p.passageId || p.id).trim();
                                p.content = p.content || p.text || p.body;
                                allPassages.push(p);
                            });
                            if (item.questions) item.questions.forEach(q => {
                                q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                                q.passageId = q.passageId || q.passage_id ? String(q.passageId || q.passage_id).trim() : null;
                                allQuestions.push(q);
                            });
                        }
                    });
                }
            });
        });
    } catch (err) { console.error("Firebase fetch error:", err); }
    return { questions: allQuestions, passages: allPassages };
}

async function fetchFromAdminQuestions(grade, subject) {
    let allQuestions = [];
    try {
        const snapshot = await getDocs(collection(db, "admin_questions"));
        snapshot.forEach(docSnap => {
            const qData = docSnap.data();
            if (qData && isGradeMatch(qData.grade, grade) && isSubjectMatch(qData.subject, subject)) {
                const normalizedQuestion = {
                    ...qData, firebaseId: docSnap.id, id: docSnap.id || `admin-${Date.now()}`,
                    imageUrl: qData.imageUrl || qData.image_url || qData.image || null,
                    passageId: qData.passageId || qData.passage_id || null,
                    type: qData.type || (qData.topic === 'CREATIVE WRITING' ? 'creative-writing' : 'mcq'),
                    image_position: qData.image_position || qData.imagePosition || 'before'
                };
                if (normalizedQuestion.passageId) normalizedQuestion.passageId = String(normalizedQuestion.passageId).trim();
                try {
                    normalizedQuestion.options = Array.isArray(qData.options) ? qData.options : (typeof qData.options === 'string' ? JSON.parse(qData.options) : []);
                } catch (e) { normalizedQuestion.options = [qData.options]; }
                allQuestions.push(normalizedQuestion);
            }
        });
    } catch (err) {}
    return allQuestions;
}

async function fetchFromGitHub(grade, subject) {
    const targetBranch = 'main'; 
    const baseUrl = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/${targetBranch}/`;
    const gradeNumber = grade.replace(/[^0-9]/g, '');
    const patterns = [`${gradeNumber}-${subject}.json`, `${gradeNumber}-${subject}`.toLowerCase(), `Grade ${gradeNumber}-${subject}.json`, `${gradeNumber}-ela.json`, `${gradeNumber}-math.json`];
    
    for (const pattern of [...new Set(patterns)]) {
        try {
            const response = await fetch(baseUrl + pattern, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                let questions = [], passages = [];
                
                if (Array.isArray(data)) questions = data;
                else if (data && data.tests && Array.isArray(data.tests)) {
                    data.tests.forEach(test => { if (test.questions) questions.push(...test.questions); if (test.passages) passages.push(...test.passages); });
                } else if (data && data.questions) {
                    questions = Array.isArray(data.questions) ? data.questions : [data.questions];
                    if (data.passages) passages = Array.isArray(data.passages) ? data.passages : [data.passages];
                }

                questions = questions.map((q, idx) => ({
                    ...q, id: q.id || `gh-q-${idx}`,
                    imageUrl: q.image || q.image_url || q.imageUrl || null,
                    passageId: (q.passage_id || q.passageId) ? String(q.passage_id || q.passageId).trim() : null,
                    type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                }));

                passages = passages.map((p, idx) => ({
                    ...p, passageId: (p.id || p.passageId || p.passage_id || `gh-p-${idx}`).toString().trim(),
                    content: p.content || p.text || p.body
                }));
                return { questions, passages };
            }
        } catch (e) { }
    }
    return { questions: [], passages: [] };
}

// ==========================================
// CORE LOADING LOGIC
// ==========================================
export async function loadQuestions(subject, grade, state) {
    console.log("%c🚀 BKH CBT SCRIPT: VERSION 10 (FINAL INTEGRATION)", "color: #00ffaa; font-size: 16px; font-weight: bold; background: #000; padding: 6px;");
    
    if (state === 'creative-writing' && !isSubjectMatch('ela', subject)) {
        const url = new URL(window.location.href); url.searchParams.set('state', 'mcq'); window.location.href = url.toString(); return;
=======
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
 * Attempt to fetch from GitHub with multiple filename variations
 */
async function fetchFromGitHub(grade, subject) {
    const baseUrl = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/';
    
    // Extract just the number from grade (e.g., "grade4" → "4")
    const gradeNumber = grade.replace('grade', '');
    
    // Define possible filename patterns
    const patterns = [
        `${grade}-${subject}.json`,           // grade4-ela.json
        `${grade}${subject}.json`,             // grade4ela.json
        `${gradeNumber}-${subject}.json`,      // 4-ela.json
        `${gradeNumber}${subject}.json`,       // 4ela.json
        `${grade}-${subject}`.toLowerCase(),   // already lowercase
        `${grade}${subject}`.toLowerCase(),
        `${gradeNumber}-${subject}`.toLowerCase(),
        `${gradeNumber}${subject}`.toLowerCase(),
        `Grade ${gradeNumber}-${subject}.json`, // Grade 4-ela.json
        `${gradeNumber}-ela.json`,              // 4-ela.json (explicit)
        `${gradeNumber}-math.json`,              // 4-math.json (explicit)
        // Some possible capitalizations
        `${grade.charAt(0).toUpperCase() + grade.slice(1)}-${subject.charAt(0).toUpperCase() + subject.slice(1)}.json`, // Grade4-Ela.json
        `${grade.charAt(0).toUpperCase() + grade.slice(1)}${subject.charAt(0).toUpperCase() + subject.slice(1)}.json`  // Grade4Ela.json
    ];
    
    // Remove duplicates
    const uniquePatterns = [...new Set(patterns)];
    
    for (const pattern of uniquePatterns) {
        const url = baseUrl + pattern;
        try {
            console.log(`Trying GitHub URL: ${url}`);
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Successfully fetched from GitHub using pattern: ${pattern}`);
                
                // Process the data to extract questions and passages
                let questions = [];
                let passages = [];
                
                if (Array.isArray(data)) {
                    questions = data;
                } else if (data && data.tests && Array.isArray(data.tests)) {
                    data.tests.forEach(test => {
                        if (test.questions) questions.push(...test.questions);
                        if (test.passages) passages.push(...test.passages);
                    });
                } else if (data && data.questions) {
                    questions = Array.isArray(data.questions) ? data.questions : [data.questions];
                    if (data.passages) passages = Array.isArray(data.passages) ? data.passages : [data.passages];
                }
                
                // Normalize questions
                questions = questions.map((q, idx) => ({
                    ...q,
                    id: q.id || q.questionId || `gh-q-${idx}`,
                    imageUrl: q.image || q.image_url || q.imageUrl || null,
                    passageId: (q.passage_id || q.passageId) ? String(q.passage_id || q.passageId).trim() : null,
                    type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                }));
                
                // Normalize passages
                passages = passages.map((p, idx) => ({
                    ...p,
                    passageId: (p.id || p.passageId || p.passage_id || `gh-p-${idx}`).toString().trim(),
                    content: p.content || p.text || p.body
                }));
                
                return { questions, passages };
            }
        } catch (e) {
            // Ignore individual fetch errors
        }
    }
    return { questions: [], passages: [] };
}

/**
 * Fetch from tests collection with comprehensive scanning
 */
async function fetchFromTestsCollection(grade, subject) {
    let allQuestions = [];
    let allPassages = [];
    
    try {
        const gradeNum = grade.replace(/[^0-9]/g, '');
        let subjectKey = subject.toLowerCase();
        if (subjectKey === 'english' || subjectKey === 'reading') {
            subjectKey = 'ela';
        }
        
        console.log(`🔍 Fetching from tests collection for grade ${gradeNum}, subject ${subjectKey}`);
        
        // 1. Try direct document IDs first (fastest)
        const targetIds = [
            `${gradeNum}-${subjectKey}`,
            `staar_reading_${gradeNum}_2022`,
            `staar_grade_${gradeNum}_math_2018`,
            `${grade}-${subjectKey}`,
            `${grade}${subjectKey}`
        ];
        
        for (const docId of targetIds) {
            try {
                const docRef = doc(db, "tests", docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    console.log(`✅ Found document with ID: ${docId}`);
                    const rawData = docSnap.data();
                    
                    // Process tests array if it exists
                    if (rawData.tests && Array.isArray(rawData.tests)) {
                        rawData.tests.forEach(test => {
                            // Process passages
                            if (test.passages && Array.isArray(test.passages)) {
                                test.passages.forEach(p => {
                                    const normalizedPassage = {
                                        ...p,
                                        passageId: String(p.passageId || p.id || '').trim(),
                                        content: p.content || p.text || p.body || ''
                                    };
                                    if (normalizedPassage.passageId && normalizedPassage.content) {
                                        allPassages.push(normalizedPassage);
                                    }
                                });
                            }
                            
                            // Process questions
                            if (test.questions && Array.isArray(test.questions)) {
                                test.questions.forEach(q => {
                                    const normalizedQuestion = {
                                        ...q,
                                        id: q.id || q.questionId || `test-q-${Date.now()}`,
                                        imageUrl: q.imageUrl || q.image_url || q.image || null,
                                        passageId: (q.passageId || q.passage_id) ? String(q.passageId || q.passage_id).trim() : null,
                                        type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                                    };
                                    allQuestions.push(normalizedQuestion);
                                });
                            }
                        });
                    }
                    
                    // If we found questions, return them
                    if (allQuestions.length > 0) {
                        return { questions: allQuestions, passages: allPassages };
                    }
                }
            } catch (e) {
                // Ignore individual document fetch errors
            }
        }
        
        // 2. If direct IDs didn't work, do a deep scan of the collection
        console.log("🔍 Direct IDs not found, scanning entire tests collection...");
        const snapshot = await getDocs(collection(db, "tests"));
        
        snapshot.forEach(docSnap => {
            const rawData = docSnap.data();
            
            // Check various possible structures
            const possibleArrays = ['tests', 'questions', 'items', 'data'];
            
            possibleArrays.forEach(arrayKey => {
                if (rawData[arrayKey] && Array.isArray(rawData[arrayKey])) {
                    rawData[arrayKey].forEach((item) => {
                        // Check if this item matches our grade and subject
                        if (item && (item.grade || item.gradeLevel) && (item.subject || item.subjectArea)) {
                            const itemGrade = item.grade || item.gradeLevel || '';
                            const itemSubject = item.subject || item.subjectArea || '';
                            
                            if (isGradeMatch(itemGrade, grade) && isSubjectMatch(itemSubject, subject)) {
                                // Extract passages
                                if (item.passages && Array.isArray(item.passages)) {
                                    item.passages.forEach(p => {
                                        const normalizedPassage = {
                                            ...p,
                                            passageId: String(p.passageId || p.id || '').trim(),
                                            content: p.content || p.text || p.body || ''
                                        };
                                        if (normalizedPassage.passageId && normalizedPassage.content) {
                                            allPassages.push(normalizedPassage);
                                        }
                                    });
                                }
                                
                                // Extract questions
                                if (item.questions && Array.isArray(item.questions)) {
                                    item.questions.forEach(q => {
                                        const normalizedQuestion = {
                                            ...q,
                                            id: q.id || q.questionId || `scan-q-${Date.now()}-${Math.random()}`,
                                            imageUrl: q.imageUrl || q.image_url || q.image || null,
                                            passageId: (q.passageId || q.passage_id) ? String(q.passageId || q.passage_id).trim() : null,
                                            type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                                        };
                                        allQuestions.push(normalizedQuestion);
                                    });
                                }
                            }
                        }
                    });
                }
            });
            
            // Also check if the document itself has questions/passages at root level
            if (rawData.questions && Array.isArray(rawData.questions) && rawData.grade && rawData.subject) {
                if (isGradeMatch(rawData.grade, grade) && isSubjectMatch(rawData.subject, subject)) {
                    rawData.questions.forEach(q => {
                        const normalizedQuestion = {
                            ...q,
                            id: q.id || q.questionId || `root-q-${Date.now()}`,
                            imageUrl: q.imageUrl || q.image_url || q.image || null,
                            passageId: (q.passageId || q.passage_id) ? String(q.passageId || q.passage_id).trim() : null,
                            type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                        };
                        allQuestions.push(normalizedQuestion);
                    });
                }
            }
            
            if (rawData.passages && Array.isArray(rawData.passages) && rawData.grade && rawData.subject) {
                if (isGradeMatch(rawData.grade, grade) && isSubjectMatch(rawData.subject, subject)) {
                    rawData.passages.forEach(p => {
                        const normalizedPassage = {
                            ...p,
                            passageId: String(p.passageId || p.id || '').trim(),
                            content: p.content || p.text || p.body || ''
                        };
                        if (normalizedPassage.passageId && normalizedPassage.content) {
                            allPassages.push(normalizedPassage);
                        }
                    });
                }
            }
        });
        
        console.log(`📊 Tests collection scan complete: ${allQuestions.length} questions, ${allPassages.length} passages`);
        
    } catch (err) {
        console.error("Error fetching from tests collection:", err);
    }
    
    return { questions: allQuestions, passages: allPassages };
}

/**
 * Fetch from admin_questions collection
 */
async function fetchFromAdminQuestions(grade, subject) {
    let allQuestions = [];
    
    try {
        console.log(`🔍 Fetching from admin_questions for grade ${grade}, subject ${subject}`);
        
        const gradeNum = grade.replace(/[^0-9]/g, '');
        const adminSubject = getAdminQuestionsSubject(subject);
        
        // Query by grade and subject
        const q = query(
            collection(db, "admin_questions"),
            where("grade", "==", gradeNum),
            where("subject", "==", adminSubject)
        );
        
        const snapshot = await getDocs(q);
        
        snapshot.forEach(docSnap => {
            const qData = docSnap.data();
            
            // Double-check subject match (case insensitive)
            if (isSubjectMatch(qData.subject, subject)) {
                const normalizedQuestion = {
                    ...qData,
                    firebaseId: docSnap.id,
                    id: docSnap.id || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    imageUrl: qData.imageUrl || qData.image_url || qData.image || null,
                    passageId: qData.passageId || qData.passage_id || null,
                    type: qData.type || (qData.topic === 'CREATIVE WRITING' ? 'creative-writing' : 'mcq'),
                    image_position: qData.image_position || qData.imagePosition || 'before',
                    subject: subject.toLowerCase(),
                    grade: grade
                };
                
                // Parse options if needed
                if (qData.options) {
                    try {
                        normalizedQuestion.options = Array.isArray(qData.options) 
                            ? qData.options 
                            : (typeof qData.options === 'string' 
                                ? JSON.parse(qData.options) 
                                : [qData.options]);
                    } catch (e) {
                        normalizedQuestion.options = [qData.options];
                    }
                }
                
                if (normalizedQuestion.passageId) {
                    normalizedQuestion.passageId = String(normalizedQuestion.passageId).trim();
                }
                
                allQuestions.push(normalizedQuestion);
            }
        });
        
        console.log(`✅ Loaded ${allQuestions.length} valid ${subject} questions from ADMIN_QUESTIONS`);
        
    } catch (err) {
        console.error("Error fetching from admin_questions:", err);
    }
    
    return allQuestions;
}

/**
 * The entry point to load and display questions for a test.
 * @param {string} subject The subject of the test (e.g., 'math').
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
>>>>>>> main
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
<<<<<<< HEAD
    if (!container) return;
    container.innerHTML = `<p style="text-align:center; font-family:sans-serif; color:#666;">Deploying test data from secure servers...</p>`;
    if (submitBtnContainer) submitBtnContainer.style.display = 'none';

    currentSessionId = generateSessionId(grade, subject, state);
    let allQuestions = [], allPassages = [];
=======
    
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
>>>>>>> main

    try {
        // 1. FETCH FROM FIREBASE TESTS
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions.push(...testsResult.questions);
        allPassages.push(...testsResult.passages);

<<<<<<< HEAD
        // 2. FETCH FROM FIREBASE ADMIN_QUESTIONS
        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) allQuestions.push(...adminQuestions);

        // 3. FETCH FROM GITHUB (Fallback if Firebase is empty)
        if (allQuestions.length === 0) {
            console.log("⚠️ Firebase empty. Pulling from GitHub.");
            const gitHubData = await fetchFromGitHub(grade, subject);
            allQuestions.push(...gitHubData.questions);
            allPassages.push(...gitHubData.passages);
=======
        // 1. FETCH FROM TESTS COLLECTION (with comprehensive scanning)
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions.push(...testsResult.questions);
        allPassages.push(...testsResult.passages);
        console.log(`📊 TESTS Collection: Found ${testsResult.questions.length} questions and ${testsResult.passages.length} passages`);

        // 2. FETCH FROM ADMIN_QUESTIONS COLLECTION
        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) {
            allQuestions.push(...adminQuestions);
            console.log(`📊 ADMIN_QUESTIONS Collection: Added ${adminQuestions.length} questions`);
        }

        // 3. FETCH FROM GITHUB (Fallback if no questions found)
        if (allQuestions.length === 0) {
            console.log(`📦 No ${subject} questions found in Firebase, trying GitHub...`);
            try {
                const gitHubData = await fetchFromGitHub(grade, subject);
                allQuestions.push(...gitHubData.questions);
                allPassages.push(...gitHubData.passages);
                console.log(`✅ Loaded ${gitHubData.questions.length} questions from GitHub for ${subject}`);
            } catch (gitHubError) {
                console.error("❌ GitHub fallback also failed:", gitHubError);
            }
>>>>>>> main
        }

        // DEEP MAPPING
        allQuestions = allQuestions.map((q, idx) => ({
            ...q, id: q.firebaseId || q.questionId || q.id || `question-${idx}`,
            imageUrl: q.image || q.imageUrl || q.image_url || null,
            passageId: q.passageId ? String(q.passageId).trim() : null,
            type: q.type || (q.options && q.options.length > 0 ? "mcq" : "creative-writing")
        }));

        const passagesMap = {};
        allPassages.forEach(p => { if (p.passageId && p.content) passagesMap[p.passageId] = p; });

        if (allQuestions.length === 0) {
            container.innerHTML = `<p style="color:red; text-align:center; font-weight:bold;">❌ No questions found for Grade ${grade} ${subject}. Check your Database connection.</p>`; return;
        }

        if (isSubjectMatch('ela', subject) && state === 'creative-writing') {
            const creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing' || q.topic === 'CREATIVE WRITING');
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p style="color:red; text-align:center;">Redirecting to multiple choice...</p>`;
                setTimeout(() => { const u = new URL(window.location.href); u.searchParams.set('state', 'mcq'); window.location.href = u.toString(); }, 1500);
                return;
            }
            loadedQuestions = [{ ...creativeWritingQuestion, id: creativeWritingQuestion.id || 'cw-0' }];
            displayCreativeWriting(loadedQuestions[0]);
        } else {
<<<<<<< HEAD
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing' && q.topic !== 'CREATIVE WRITING');
            if (filteredQuestions.length === 0) { container.innerHTML = `<p style="color:red; text-align:center;">❌ No MCQ found.</p>`; return; }
            
            if (isSubjectMatch('ela', subject)) {
                const qByPassage = {};
                const qNoPassage = [];
                filteredQuestions.forEach(q => {
                    const pid = q.passageId ? String(q.passageId).trim() : null;
                    if (pid && passagesMap[pid]) {
                        if (!qByPassage[pid]) qByPassage[pid] = [];
                        qByPassage[pid].push(q);
                    } else { qNoPassage.push(q); }
                });
                
                const pIds = Object.keys(qByPassage);
                let finalQ = [];
                if (pIds.length > 0) {
                    const firstP = pIds[Math.floor(Math.random() * pIds.length)];
                    finalQ.push(...qByPassage[firstP]);
                }
                const needed = 15 - finalQ.length;
                if (qNoPassage.length >= needed) {
                    finalQ.push(...[...qNoPassage].sort(()=>Math.random()-0.5).slice(0, needed));
                } else if (pIds.length > 1) {
                    const secondP = pIds.find(id => id !== finalQ[0].passageId);
                    if(secondP) finalQ.push(...qByPassage[secondP]);
                    const remaining = 15 - finalQ.length;
                    if(remaining > 0) finalQ.push(...[...qNoPassage].sort(()=>Math.random()-0.5).slice(0, remaining));
                } else {
                    finalQ.push(...qNoPassage);
                }
                loadedQuestions = finalQ.slice(0, 15);
            } else {
                loadedQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, 15);
=======
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
>>>>>>> main
            }
            
            displayMCQQuestions(loadedQuestions, passagesMap);
            if (submitBtnContainer) submitBtnContainer.style.display = 'block';
        }
    } catch (err) { container.innerHTML = `<p style="color:red; text-align:center;">❌ Error: ${err.message}</p>`; }
}

<<<<<<< HEAD
// ==========================================
// UI RENDERERS & EVENT LISTENERS
// ==========================================
=======
/**
 * Check if grade is 3 or higher for creative writing (grade is normalized, e.g., "grade4")
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
>>>>>>> main
function saveAnswer(questionId, answer) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const answers = JSON.parse(sessionStorage.getItem(`${currentSessionId}-answers`) || '{}');
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {}
    }, 300);
}

function saveTextAnswer(questionId, answer) {
    clearTimeout(saveTextTimeout);
    saveTextTimeout = setTimeout(() => {
        try {
            const answers = JSON.parse(sessionStorage.getItem(`${currentSessionId}-answers`) || '{}');
            answers[questionId] = answer;
            sessionStorage.setItem(`${currentSessionId}-answers`, JSON.stringify(answers));
        } catch (err) {}
    }, 500);
}

<<<<<<< HEAD
=======
/**
 * Display questions based on current state
 */
function displayQuestionsBasedOnState(questions, state) {
    const passagesMap = getSavedSession()?.passages || {};
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
            console.log("Options was a string, attempting to split by commas:", question.options);
            return question.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        }
    }
    if (typeof question.options === 'object' && question.options !== null && !Array.isArray(question.options)) {
        return Object.values(question.options).filter(opt => opt !== null && opt !== undefined);
    }
    return [];
}

/**
 * Displays creative writing section
 */
>>>>>>> main
function displayCreativeWriting(question) {
    const container = document.getElementById("question-container");
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
<<<<<<< HEAD
    const safeQuestionId = String(question.id).replace(/[^a-zA-Z0-9]/g, '_');
=======
    const studentName = escapeHtml(params.get('studentName') || '');
    const parentEmail = escapeHtml(params.get('parentEmail') || '');
    const tutorEmail = escapeHtml(params.get('tutorEmail') || '');
    const grade = escapeHtml(params.get('grade') || '');
    
    const safeQuestionId = question.id ? question.id.replace(/[^a-zA-Z0-9]/g, '_') : 'creative_writing_0';
    const safeQuestionText = escapeHtml(question.question || '');
>>>>>>> main
    
    container.innerHTML = `
        <div style="background:#fff; padding:24px; border:1px solid #e5e7eb; border-radius:8px; max-width:800px; margin:0 auto; font-family:sans-serif;">
            <h2 style="font-weight:bold; font-size:20px; margin-bottom:16px; color:#1e40af;">Creative Writing</h2>
            <p style="font-weight:600; margin-bottom:16px; color:#374151; font-size:18px;">${escapeHtml(question.question)}</p>
            <textarea id="creative-writing-text-${safeQuestionId}" style="width:100%; height:200px; padding:16px; border:1px solid #d1d5db; border-radius:8px; margin-bottom:16px; font-size:16px;" placeholder="Write your essay here..."></textarea>
            <div style="margin-bottom:16px;">
                <label style="display:block; margin-bottom:8px; font-size:14px; font-weight:500;">Or Upload an Image (Max 5MB)</label>
                <input type="file" id="creative-writing-file-${safeQuestionId}" accept=".jpg,.jpeg,.png,.gif,.webp" style="display:block; width:100%;"/>
            </div>
            <button onclick="window.continueToMCQ('${safeQuestionId}', '${escapeHtml(params.get('studentName'))}', '${escapeHtml(params.get('parentEmail'))}', '${escapeHtml(params.get('tutorEmail'))}', '${escapeHtml(params.get('grade'))}')" style="background:#2563eb; color:#fff; font-weight:bold; padding:12px 24px; border-radius:8px; border:none; cursor:pointer; width:100%; font-size:16px;">Continue</button>
        </div>
    `;
}

function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    if (!container) return;
    container.innerHTML = '';
    
<<<<<<< HEAD
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach(q => {
        const pid = q.passageId ? String(q.passageId).trim() : null;
        if (pid && passagesMap[pid]) {
            if (!questionsByPassage[pid]) questionsByPassage[pid] = [];
            questionsByPassage[pid].push(q);
=======
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
    
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach((question) => {
        if (question.passageId && passagesMap[question.passageId]) {
            if (!questionsByPassage[question.passageId]) {
                questionsByPassage[question.passageId] = [];
            }
            questionsByPassage[question.passageId].push(question);
>>>>>>> main
        } else {
            questionsWithoutPassage.push(q);
        }
    });
    
<<<<<<< HEAD
    let globalIndex = 1; 
    
    Object.keys(questionsByPassage).forEach(pid => {
        const passage = passagesMap[pid];
=======
    let globalQuestionIndex = 1;
    
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];
        
>>>>>>> main
        const passageElement = document.createElement('div');
        passageElement.style.cssText = "background-color: #f0f9ff; padding: 24px; border-radius: 8px; border-left: 6px solid #0ea5e9; margin-bottom: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 800px; margin-left: auto; margin-right: auto;";
        passageElement.innerHTML = `
            <span style="background-color: #0ea5e9; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; display: inline-block;">Reading Passage</span>
            <h3 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px; font-family: sans-serif;">${escapeHtml(passage.title || 'Reading Text')}</h3>
            ${passage.subtitle ? `<h4 style="font-size: 18px; color: #475569; margin-top: 0; margin-bottom: 12px; font-style: italic;">${escapeHtml(passage.subtitle)}</h4>` : ''}
            ${passage.author ? `<p style="font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 20px; font-weight: 600;">${escapeHtml(passage.author)}</p>` : ''}
            <div style="background-color: white; padding: 20px; border: 1px solid #bae6fd; border-radius: 6px; color: #334155; line-height: 1.8; font-size: 16px; white-space: pre-wrap; font-family: Georgia, serif;">${escapeHtml(passage.content)}</div>
        `;
        container.appendChild(passageElement);
        
<<<<<<< HEAD
        questionsByPassage[pid].forEach(q => {
            const el = createQuestionElement(q, globalIndex++);
            if (el) container.appendChild(el);
=======
        passageQuestions.forEach(q => {
            const questionElement = createQuestionElement(q, globalQuestionIndex);
            if (questionElement) {
                container.appendChild(questionElement);
                globalQuestionIndex++;
            }
>>>>>>> main
        });
    });
    
    questionsWithoutPassage.forEach(q => {
<<<<<<< HEAD
        const el = createQuestionElement(q, globalIndex++);
        if (el) container.appendChild(el);
    });
}

function createQuestionElement(q, index) {
    const el = document.createElement('div');
    el.style.cssText = "background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 800px; margin-left: auto; margin-right: auto; font-family: sans-serif;";
    
    const imgUrl = q.imageUrl || q.image_url || q.image || null;
    const optImg = imgUrl ? optimizeImageUrl(imgUrl) : null;
    const showBefore = optImg && q.image_position !== 'after';
    const showAfter = optImg && q.image_position === 'after';
    const opts = getQuestionOptions(q);
    const hasOpts = opts.length > 0;
    
    el.innerHTML = `
        ${showBefore ? `<div style="text-align: center; margin-bottom: 16px;"><img src="${escapeHtml(optImg)}" style="max-width: 100%; border-radius: 8px; border: 1px solid #ddd;" /></div>` : ''}
        <p style="font-weight: 600; margin-bottom: 16px; font-size: 18px; color: #1f2937;">${index}. ${escapeHtml(q.question)}</p>
        ${showAfter ? `<div style="text-align: center; margin-top: 16px;"><img src="${escapeHtml(optImg)}" style="max-width: 100%; border-radius: 8px; border: 1px solid #ddd;" /></div>` : ''}
        <div style="margin-top: 12px;">
            ${hasOpts ? opts.map(o => `
                <label style="display: flex; align-items: center; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 8px; cursor: pointer;">
                    <input type="radio" name="q${q.id}" value="${escapeHtml(o)}" style="margin-right: 12px; width: 18px; height: 18px;"> 
                    <span style="font-size: 16px; color: #374151;">${escapeHtml(o)}</span>
                </label>`).join('') : 
                `<textarea id="text-answer-${q.id}" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px;" rows="3" placeholder="Type answer..."></textarea>`
            }
        </div>
    `;
    
    if (hasOpts) {
        el.querySelectorAll('input').forEach(r => r.addEventListener('change', e => saveAnswer(q.id, e.target.value)));
    } else {
        const txt = el.querySelector('textarea');
        if (txt) txt.addEventListener('input', e => saveTextAnswer(q.id, e.target.value));
    }
    return el;
}

window.continueToMCQ = async (qId, sName, pEmail, tEmail, grade) => {
    const txt = document.getElementById(`creative-writing-text-${qId}`)?.value.trim();
    const file = document.getElementById(`creative-writing-file-${qId}`)?.files[0];
    const btn = document.querySelector('button[onclick*="continueToMCQ"]');
    
    if (!txt && !file) return alert("Please write a response or upload an image.");
    if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }
=======
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
    if (!q || typeof q !== 'object') {
        console.error('Invalid question object:', q);
        return null;
    }
    
    const questionElement = document.createElement('div');
    questionElement.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    questionElement.setAttribute('data-question-id', q.id || `question-${displayIndex}`);
    
    const optimizedImageUrl = q.imageUrl ? optimizeImageUrl(q.imageUrl) : null;
    const showImageBefore = optimizedImageUrl && q.image_position !== 'after';
    const showImageAfter = optimizedImageUrl && q.image_position === 'after';
    
    const safeQuestionText = escapeHtml(q.question || '');
    
    const questionOptions = getQuestionOptions(q);
    const hasOptions = questionOptions && questionOptions.length > 0;
    
    const safeOptions = questionOptions.map(opt => escapeHtml(opt));
    
    try {
        const safeImageUrl = escapeHtml(q.imageUrl || '');
        const safeOptimizedUrl = escapeHtml(optimizedImageUrl || '');

        questionElement.innerHTML = `
            ${showImageBefore ? `
                <div class="image-container mb-3">
                    <img src="${safeOptimizedUrl}" 
                         class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity js-open-image"
                         alt="Question image"
                         data-full-url="${safeImageUrl}"/>
                    <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
                </div>
            ` : ''}
            
            <p class="font-semibold mb-3 question-text text-gray-800">
                ${displayIndex}. ${safeQuestionText}
                <span class="answer-type-label">${hasOptions ? 'Multiple Choice' : 'Text Answer'}</span>
            </p>
            
            ${showImageAfter ? `
                <div class="image-container mt-3">
                    <img src="${safeOptimizedUrl}" 
                         class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity js-open-image"
                         alt="Question image"
                         data-full-url="${safeImageUrl}"/>
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
>>>>>>> main
    
    try {
        let fileUrl = null;
        if (file) {
            const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', 'bkh_assessments');
            const res = await fetch('https://api.cloudinary.com/v1_1/dy2hxcyaf/upload', { method: 'POST', body: fd });
            fileUrl = (await res.json()).secure_url;
        }
<<<<<<< HEAD
        await setDoc(doc(db, "tutor_submissions", `${pEmail}-${qId}-${Date.now()}`), {
            questionId: qId, textAnswer: txt, fileUrl, submittedAt: new Date(), studentName: sName, parentEmail: pEmail, tutorEmail: tEmail, grade, subject: 'ela', status: "pending_review", type: "creative_writing"
        });
        sessionStorage.removeItem(currentSessionId);
        setTimeout(() => { const u = new URL(window.location.href); u.searchParams.set('state', 'mcq'); window.location.href = u.toString(); }, 500);
    } catch (e) { alert(`Error: ${e.message}`); if (btn) { btn.textContent = "Continue"; btn.disabled = false; } }
};

window.addEventListener('beforeunload', () => clearTestSession(true));
window.handleLogout = () => { clearAllTestSessions(); window.location.href = '/login.html'; };
=======
        
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
        
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
            console.log("Cleared creative writing session before MCQ load");
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

window.addEventListener('beforeunload', function() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state === 'completed' || state === 'submitted') {
        clearTestSession(true);
    }
});

window.handleLogout = function() {
    console.log("Logging out - clearing all test sessions");
    clearAllTestSessions();
    window.location.href = '/login.html';
};
>>>>>>> main
