import { db } from './firebaseConfig.js';
import { collection, getDocs, getDoc, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let loadedQuestions = [];
let currentSessionId = null;
let saveTimeout = null;
let saveTextTimeout = null;

// ==========================================
// REQUIRED EXPORTS
// ==========================================
export function getLoadedQuestions() { return loadedQuestions; }
export function getAllLoadedQuestions() { return loadedQuestions; }

export function getAnswerData() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
}

export function clearAllTestSessions() {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('test-') || key.startsWith('session-') || key.includes('-answers') || key === 'currentSessionId' || key === 'currentTestSession' || key === 'justCompletedCreativeWriting')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

export function clearTestSession(forceClear = false) {
    if (forceClear || ['completed', 'submitted'].includes(new URLSearchParams(window.location.search).get('state'))) {
        sessionStorage.removeItem(currentSessionId);
        sessionStorage.removeItem(`${currentSessionId}-answers`);
    }
}

// ==========================================
// MATCHING LOGIC
// ==========================================
function getAdminQuestionsSubject(testSubject) {
    const subjectMap = { 'ela': 'English', 'math': 'Mathematics', 'science': 'Science', 'socialstudies': 'Social Studies' };
    return subjectMap[testSubject.toLowerCase()] || testSubject;
}

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

function selectELAQuestions(allQuestions, passagesMap) {
    const questionsWithPassages = [];
    const questionsWithoutPassages = [];
    allQuestions.forEach(question => {
        const qPassageId = question.passageId ? String(question.passageId).trim() : null;
        if (qPassageId && passagesMap[qPassageId]) questionsWithPassages.push(question);
        else questionsWithoutPassages.push(question);
    });
    
    const questionsByPassage = {};
    questionsWithPassages.forEach(question => {
        const qPassageId = String(question.passageId).trim();
        if (!questionsByPassage[qPassageId]) questionsByPassage[qPassageId] = [];
        questionsByPassage[qPassageId].push(question);
    });
    
    const selectedQuestions = [];
    const selectedPassageIds = [];
    const passageIds = Object.keys(questionsByPassage);
    
    if (passageIds.length > 0) {
        const firstPassageId = passageIds[Math.floor(Math.random() * passageIds.length)];
        selectedQuestions.push(...questionsByPassage[firstPassageId]);
        selectedPassageIds.push(firstPassageId);
    }
    
    const questionsNeeded = 15 - selectedQuestions.length;
    const availableNonPassageQuestions = Math.min(questionsWithoutPassages.length, questionsNeeded);
    
    if (availableNonPassageQuestions >= questionsNeeded) {
        const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
        selectedQuestions.push(...shuffledNonPassage.slice(0, questionsNeeded));
    } else if (passageIds.length > 1) {
        const remainingPassageIds = passageIds.filter(id => !selectedPassageIds.includes(id));
        if (remainingPassageIds.length > 0) {
            const secondPassageId = remainingPassageIds[Math.floor(Math.random() * remainingPassageIds.length)];
            selectedQuestions.push(...questionsByPassage[secondPassageId]);
            selectedPassageIds.push(secondPassageId);
            const remainingSlots = 15 - selectedQuestions.length;
            if (remainingSlots > 0 && questionsWithoutPassages.length > 0) {
                const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
                selectedQuestions.push(...shuffledNonPassage.slice(0, remainingSlots));
            }
        }
    } else {
        const shuffledNonPassage = [...questionsWithoutPassages].sort(() => Math.random() - 0.5);
        selectedQuestions.push(...shuffledNonPassage.slice(0, availableNonPassageQuestions));
    }
    return selectedQuestions.slice(0, 15);
}

// ==========================================
// DATA FETCHING
// ==========================================
async function fetchFromTestsCollection(grade, subject) {
    let allQuestions = [];
    let allPassages = [];
    try {
        const gradeNum = grade.replace(/[^0-9]/g, '');
        let subjectKey = (subject.toLowerCase() === 'english' || subject.toLowerCase() === 'reading') ? 'ela' : subject.toLowerCase();
        
        // 1. DIRECT SNIPE: Target exactly the document IDs you mentioned to avoid empty scans
        const targetIds = [`${gradeNum}-${subjectKey}`, `staar_reading_${gradeNum}_2022`, `staar_grade_${gradeNum}_math_2018`];
        
        for (const docId of targetIds) {
            try {
                const docRef = doc(db, "tests", docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    console.log(`🎯 DIRECT SNIPE SUCCESS: Found document '${docId}'`);
                    const rawData = docSnap.data();
                    
                    // Parse Arrays (like 'tests' array)
                    Object.keys(rawData).forEach(key => {
                        if (Array.isArray(rawData[key])) {
                            rawData[key].forEach(item => {
                                if (item.passages) {
                                    item.passages.forEach(p => {
                                        p.passageId = String(p.passageId || p.id).trim();
                                        p.content = p.content || p.text || p.body;
                                        allPassages.push(p);
                                    });
                                }
                                if (item.questions) {
                                    item.questions.forEach(q => {
                                        q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                                        q.passageId = q.passageId ? String(q.passageId).trim() : null;
                                        allQuestions.push(q);
                                    });
                                }
                            });
                        }
                    });

                    // Parse Root Level
                    if (rawData.questions && Array.isArray(rawData.questions)) {
                        rawData.questions.forEach(q => {
                            q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                            q.passageId = q.passageId ? String(q.passageId).trim() : null;
                            allQuestions.push(q);
                        });
                    }
                    if (rawData.passages && Array.isArray(rawData.passages)) {
                        rawData.passages.forEach(p => {
                            p.passageId = String(p.passageId || p.id).trim();
                            p.content = p.content || p.text || p.body;
                            allPassages.push(p);
                        });
                    }

                    if (allQuestions.length > 0) return { questions: allQuestions, passages: allPassages };
                }
            } catch (e) {}
        }

        // 2. FALLBACK DEEP SCAN
        const snapshot = await getDocs(collection(db, "tests"));
        snapshot.forEach(docSnap => {
            const rawData = docSnap.data();
            Object.keys(rawData).forEach(key => {
                if (Array.isArray(rawData[key])) {
                    rawData[key].forEach((item) => {
                        if (item && item.grade && item.subject && isGradeMatch(item.grade, grade) && isSubjectMatch(item.subject, subject)) {
                            if (item.passages && Array.isArray(item.passages)) {
                                item.passages.forEach(p => {
                                    p.passageId = p.passageId || p.id || p.passage_id;
                                    if (p.passageId) p.passageId = String(p.passageId).trim();
                                    p.content = p.content || p.text || p.body;
                                    allPassages.push(p);
                                });
                            }
                            if (item.questions && Array.isArray(item.questions)) {
                                item.questions.forEach(q => {
                                    q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                                    q.passageId = q.passageId || q.passage_id || null;
                                    if (q.passageId) q.passageId = String(q.passageId).trim();
                                    allQuestions.push(q);
                                });
                            }
                        }
                    });
                }
            });
        });
    } catch (err) {}
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
    const targetBranch = (window.location.hostname === 'localhost' || window.location.hostname.includes('staging')) ? 'main' : 'main'; 
    const baseUrl = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/${targetBranch}/`;
    const gradeNumber = grade.replace('grade', '');
    const patterns = [`${gradeNumber}-${subject}.json`, `${gradeNumber}-${subject}`.toLowerCase(), `${grade}-${subject}.json`, `${gradeNumber}${subject}.json`, `Grade ${gradeNumber}-${subject}.json`];
    
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
    throw new Error('No GitHub file found');
}

function optimizeImageUrl(originalUrl) {
    if (!originalUrl) return null;
    const urlString = String(originalUrl);
    if (!urlString.includes('cloudinary.com')) return urlString;
    if (urlString.includes('/upload/') && !urlString.includes('q_auto')) return urlString.replace('/upload/', '/upload/q_auto,f_auto/');
    return urlString;
}

export async function loadQuestions(subject, grade, state) {
    console.log("%c🚀 BKH CBT SCRIPT: FULL PASSAGE RECOVERY ENABLED", "color: #00ffff; font-size: 16px; font-weight: bold; background: #000; padding: 4px;");
    sessionStorage.removeItem('currentTestSession'); 
    
    if (state === 'creative-writing' && !isSubjectMatch('ela', subject)) {
        const url = new URL(window.location.href); url.searchParams.set('state', 'mcq'); window.location.href = url.toString(); return;
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
    if (!container) return;
    container.innerHTML = `<p style="text-align:center; font-family:sans-serif; color:#666;">Please wait, organizing your test...</p>`;
    if (submitBtnContainer) submitBtnContainer.style.display = 'none';

    currentSessionId = generateSessionId(grade, subject, state);
    let allQuestions = [], allPassages = [], creativeWritingQuestion = null;

    try {
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions = testsResult.questions; allPassages = testsResult.passages;

        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) allQuestions = [...allQuestions, ...adminQuestions];

        if (allQuestions.length === 0) {
            try {
                console.log("⚠️ Fallback: Fetching from GitHub...");
                const gitHubData = await fetchFromGitHub(grade, subject);
                allQuestions = gitHubData.questions; allPassages = gitHubData.passages;
            } catch (err) { throw new Error("No questions found."); }
        }

        allQuestions = allQuestions.map((q, idx) => ({
            ...q, id: q.firebaseId || q.id || `question-${idx}`,
            imageUrl: q.image || q.imageUrl || q.image_url || null,
            passageId: q.passageId ? String(q.passageId).trim() : null,
            type: q.type || (q.options && q.options.length > 0 ? "mcq" : "creative-writing")
        }));

        const passagesMap = {};
        allPassages.forEach(p => { if (p.passageId && p.content) passagesMap[p.passageId] = p; });

        if (allQuestions.length === 0) {
            container.innerHTML = `<p style="color:red; text-align:center;">❌ No questions found.</p>`; return;
        }

        if (isSubjectMatch('ela', subject) && state === 'creative-writing') {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing' || q.topic === 'CREATIVE WRITING');
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p style="color:red; text-align:center;">Redirecting to multiple choice...</p>`;
                setTimeout(() => { const u = new URL(window.location.href); u.searchParams.set('state', 'mcq'); window.location.href = u.toString(); }, 1500);
                return;
            }
            loadedQuestions = [{ ...creativeWritingQuestion, id: creativeWritingQuestion.id || 'cw-0' }];
            saveSession(loadedQuestions, passagesMap);
            displayCreativeWriting(creativeWritingQuestion);
        } else {
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing' && q.topic !== 'CREATIVE WRITING');
            if (filteredQuestions.length === 0) { container.innerHTML = `<p style="color:red; text-align:center;">❌ No MCQ found.</p>`; return; }
            loadedQuestions = isSubjectMatch('ela', subject) ? selectELAQuestions(filteredQuestions, passagesMap) : [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, 15);
            saveSession(loadedQuestions, passagesMap);
            displayMCQQuestions(loadedQuestions, passagesMap);
            if (submitBtnContainer) submitBtnContainer.style.display = 'block';
        }
    } catch (err) { container.innerHTML = `<p style="color:red; text-align:center;">❌ Error: ${err.message}</p>`; }
}

function saveSession(questions, passagesMap) {
    try {
        const sessionData = { questions, passages: passagesMap, timestamp: Date.now(), sessionId: currentSessionId };
        sessionStorage.setItem(currentSessionId, JSON.stringify(sessionData));
    } catch (err) {}
}

function getSavedSession() {
    if (!currentSessionId) return null;
    try {
        const saved = sessionStorage.getItem(currentSessionId);
        return saved ? JSON.parse(saved) : null;
    } catch (err) { return null; }
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

function displayQuestionsBasedOnState(questions, state) {
    const savedSession = getSavedSession();
    let passagesMap = {};
    if (savedSession && savedSession.passages) {
        if (Array.isArray(savedSession.passages)) {
            passagesMap = Object.fromEntries(savedSession.passages.map(p => [p.passageId, p]));
        } else {
            passagesMap = savedSession.passages; 
        }
    }
    if (state === 'creative-writing') {
        const creativeWritingQuestion = questions.find(q => q.type === 'creative-writing' || q.topic === 'CREATIVE WRITING');
        if (creativeWritingQuestion) displayCreativeWriting(creativeWritingQuestion);
    } else {
        displayMCQQuestions(questions, passagesMap);
    }
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

function displayCreativeWriting(question) {
    const container = document.getElementById("question-container");
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const safeQuestionId = String(question.id).replace(/[^a-zA-Z0-9]/g, '_');
    
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
    
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach(q => {
        const pid = q.passageId ? String(q.passageId).trim() : null;
        if (pid && passagesMap[pid]) {
            if (!questionsByPassage[pid]) questionsByPassage[pid] = [];
            questionsByPassage[pid].push(q);
        } else {
            questionsWithoutPassage.push(q);
        }
    });
    
    const hud = document.createElement('div');
    hud.style.cssText = "background: #1e293b; color: #10b981; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; margin-bottom: 20px; border: 1px solid #334155; max-width: 800px; margin: 0 auto 20px auto;";
    hud.innerHTML = `<strong>GOD MODE HUD:</strong><br/>Questions Rendered: ${questions.length}<br/>Passages Loaded: ${Object.keys(questionsByPassage).length}`;
    container.appendChild(hud);

    let globalIndex = 1; 
    
    Object.keys(questionsByPassage).forEach(pid => {
        const passage = passagesMap[pid];
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
        
        questionsByPassage[pid].forEach(q => {
            const el = createQuestionElement(q, globalIndex++);
            if (el) container.appendChild(el);
        });
    });
    
    questionsWithoutPassage.forEach(q => {
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
    
    try {
        let fileUrl = null;
        if (file) {
            const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', 'bkh_assessments');
            const res = await fetch('https://api.cloudinary.com/v1_1/dy2hxcyaf/upload', { method: 'POST', body: fd });
            fileUrl = (await res.json()).secure_url;
        }
        await setDoc(doc(db, "tutor_submissions", `${pEmail}-${qId}-${Date.now()}`), {
            questionId: qId, textAnswer: txt, fileUrl, submittedAt: new Date(), studentName: sName, parentEmail: pEmail, tutorEmail: tEmail, grade, subject: 'ela', status: "pending_review", type: "creative_writing"
        });
        sessionStorage.removeItem(currentSessionId);
        setTimeout(() => { const u = new URL(window.location.href); u.searchParams.set('state', 'mcq'); window.location.href = u.toString(); }, 500);
    } catch (e) { alert(`Error: ${e.message}`); if (btn) { btn.textContent = "Continue"; btn.disabled = false; } }
};

window.addEventListener('beforeunload', () => clearTestSession(true));
window.handleLogout = () => { clearAllTestSessions(); window.location.href = '/login.html'; };
