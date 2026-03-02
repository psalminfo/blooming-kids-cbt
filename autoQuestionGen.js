import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let loadedQuestions = [];
let currentSessionId = null;
let saveTimeout = null;
let saveTextTimeout = null;

function getAdminQuestionsSubject(testSubject) {
    const subjectMap = {
        'ela': 'English',
        'math': 'Mathematics', 
        'science': 'Science',
        'socialstudies': 'Social Studies'
    };
    return subjectMap[testSubject.toLowerCase()] || testSubject;
}

function isSubjectMatch(docSubject, requestedSubject) {
    if (!docSubject || !requestedSubject) return false;
    const dbSub = String(docSubject).toLowerCase();
    const reqSub = String(requestedSubject).toLowerCase();

    if (reqSub === 'ela') {
        return dbSub.includes('ela') || dbSub.includes('english') || dbSub.includes('reading') || dbSub.includes('writing');
    }
    if (reqSub === 'math') {
        return dbSub.includes('math') || dbSub.includes('mathematics');
    }
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
    const studentName = params.get('studentName');
    const parentEmail = params.get('parentEmail');
    return `test-${grade}-${subject}-${state}-${studentName}-${parentEmail}`;
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

export function getAnswerData() {
    const savedAnswers = sessionStorage.getItem(`${currentSessionId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
}

export function getAllLoadedQuestions() {
    return loadedQuestions;
}

function selectELAQuestions(allQuestions, passagesMap) {
    const questionsWithPassages = [];
    const questionsWithoutPassages = [];
    
    allQuestions.forEach(question => {
        const qPassageId = question.passageId ? String(question.passageId).trim() : null;
        if (qPassageId && passagesMap[qPassageId]) {
            questionsWithPassages.push(question);
        } else {
            questionsWithoutPassages.push(question);
        }
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

async function fetchFromTestsCollection(grade, subject) {
    let allQuestions = [];
    let allPassages = [];
    try {
        console.log(`🔍 DEEP SCAN: 'tests' collection for Grade: ${grade}, Subject: ${subject}`);
        const snapshot = await getDocs(collection(db, "tests"));
        if (snapshot.empty) return { questions: [], passages: [] };

        snapshot.forEach(docSnap => {
            const rawData = docSnap.data();
            Object.keys(rawData).forEach(key => {
                if (Array.isArray(rawData[key])) {
                    rawData[key].forEach((item) => {
                        if (item && item.grade && item.subject) {
                            if (isGradeMatch(item.grade, grade) && isSubjectMatch(item.subject, subject)) {
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
                                        q.grade = item.grade;
                                        q.subject = item.subject;
                                        q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                                        q.passageId = q.passageId || q.passage_id || null;
                                        if (q.passageId) q.passageId = String(q.passageId).trim();
                                        allQuestions.push(q);
                                    });
                                }
                            }
                        }
                    });
                }
            });
            
            if (rawData && rawData.grade && rawData.subject) {
                if (isGradeMatch(rawData.grade, grade) && isSubjectMatch(rawData.subject, subject)) {
                    if (rawData.questions && Array.isArray(rawData.questions)) {
                        rawData.questions.forEach(q => {
                            q.imageUrl = q.imageUrl || q.image_url || q.image || null;
                            q.passageId = q.passageId || q.passage_id || null;
                            if (q.passageId) q.passageId = String(q.passageId).trim();
                            allQuestions.push(q);
                        });
                    }
                    if (rawData.passages && Array.isArray(rawData.passages)) {
                        rawData.passages.forEach(p => {
                            p.passageId = p.passageId || p.id || p.passage_id;
                            if (p.passageId) p.passageId = String(p.passageId).trim();
                            p.content = p.content || p.text || p.body;
                            allPassages.push(p);
                        });
                    }
                }
            }
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
                    ...qData,
                    firebaseId: docSnap.id,
                    id: docSnap.id || `admin-${Date.now()}`,
                    imageUrl: qData.imageUrl || qData.image_url || qData.image || null,
                    passageId: qData.passageId || qData.passage_id || null,
                    type: qData.type || (qData.topic === 'CREATIVE WRITING' ? 'creative-writing' : 'mcq'),
                    image_position: qData.image_position || qData.imagePosition || 'before'
                };
                if (normalizedQuestion.passageId) normalizedQuestion.passageId = String(normalizedQuestion.passageId).trim();
                
                if (qData.options) {
                    if (Array.isArray(qData.options)) {
                        normalizedQuestion.options = qData.options;
                    } else if (typeof qData.options === 'string') {
                        try {
                            const parsed = JSON.parse(qData.options);
                            normalizedQuestion.options = Array.isArray(parsed) ? parsed : [qData.options];
                        } catch (e) {
                            normalizedQuestion.options = [qData.options];
                        }
                    } else {
                        normalizedQuestion.options = [];
                    }
                } else {
                    normalizedQuestion.options = [];
                }
                allQuestions.push(normalizedQuestion);
            }
        });
    } catch (err) { }
    return allQuestions;
}

async function fetchFromGitHub(grade, subject) {
    const hostname = window.location.hostname;
    let targetBranch = 'main'; 

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('staging')) {
        targetBranch = 'main'; 
    }

    const baseUrl = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/${targetBranch}/`;
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
    
    for (const pattern of uniquePatterns) {
        const url = baseUrl + pattern;
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
                const data = await response.json();
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

                questions = questions.map((q, idx) => {
                    let pid = q.passage_id || q.passageId || null;
                    if (pid) pid = String(pid).trim();
                    return {
                        ...q,
                        id: q.id || `gh-q-${idx}`,
                        imageUrl: q.image || q.image_url || q.imageUrl || null,
                        passageId: pid,
                        type: q.type || (q.options && q.options.length > 0 ? 'mcq' : 'creative-writing')
                    };
                });

                passages = passages.map((p, idx) => {
                    let pid = p.id || p.passageId || p.passage_id || `gh-p-${idx}`;
                    if (pid) pid = String(pid).trim();
                    return {
                        ...p,
                        passageId: pid,
                        content: p.content || p.text || p.body
                    };
                });
                
                return { questions, passages };
            }
        } catch (e) { }
    }
    throw new Error('No GitHub file found with any pattern');
}

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

export async function loadQuestions(subject, grade, state) {
    console.log("%c🚀 BKH CBT SCRIPT: VERSION 6.0 (UNBLOCKABLE RENDER)", "color: #ff00ff; font-size: 16px; font-weight: bold; background: #000; padding: 4px;");
    
    sessionStorage.removeItem('currentTestSession');
    
    if (state === 'creative-writing') {
        if (subject.toLowerCase() !== 'ela' && subject.toLowerCase() !== 'english' && subject.toLowerCase() !== 'reading') {
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");
    if (!container) return;
    
    container.innerHTML = `<p style="text-align:center; font-family:sans-serif; color:#666;">Please wait, organizing your test...</p>`;
    if (submitBtnContainer) submitBtnContainer.style.display = 'none';

    currentSessionId = generateSessionId(grade, subject, state);

    let allQuestions = [];
    let allPassages = [];
    let creativeWritingQuestion = null;

    try {
        const testsResult = await fetchFromTestsCollection(grade, subject);
        allQuestions = testsResult.questions;
        allPassages = testsResult.passages;

        const adminQuestions = await fetchFromAdminQuestions(grade, subject);
        if (adminQuestions.length > 0) allQuestions = [...allQuestions, ...adminQuestions];

        if (allQuestions.length === 0) {
            try {
                const gitHubData = await fetchFromGitHub(grade, subject);
                allQuestions = gitHubData.questions || [];
                allPassages = gitHubData.passages || [];
            } catch (gitHubError) {
                throw new Error("No questions found in any source.");
            }
        }

        allQuestions = allQuestions.map((q, index) => {
            let pid = q.passageId || q.passage_id || null;
            if (pid) pid = String(pid).trim();
            return {
                ...q,
                id: q.firebaseId || q.id || `question-${index}`,
                imageUrl: q.image || q.imageUrl || q.image_url || null,
                passageId: pid,
                type: q.type || (q.options && q.options.length > 0 ? "mcq" : "creative-writing")
            }
        });

        const passagesMap = {};
        allPassages.forEach(passage => {
            if (passage.passageId && passage.content) passagesMap[passage.passageId] = passage;
        });

        if (allQuestions.length === 0) {
            container.innerHTML = `<p style="color:red; text-align:center;">❌ No ${subject} questions found.</p>`;
            return;
        }

        const isELASubject = isSubjectMatch('ela', subject);

        if (isELASubject && state === 'creative-writing') {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing' || q.topic === 'CREATIVE WRITING');
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p style="color:red; text-align:center;">Redirecting to multiple choice...</p>`;
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
            const filteredQuestions = allQuestions.filter(q => q.type !== 'creative-writing' && q.topic !== 'CREATIVE WRITING');
            if (filteredQuestions.length === 0) {
                container.innerHTML = `<p style="color:red; text-align:center;">❌ No multiple-choice questions found.</p>`;
                return;
            }
            
            let selectedQuestions = [];
            if (isELASubject) {
                selectedQuestions = selectELAQuestions(filteredQuestions, passagesMap);
            } else {
                selectedQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5).slice(0, 15);
            }
            
            loadedQuestions = selectedQuestions;
            saveSession(loadedQuestions, passagesMap);
            displayMCQQuestions(loadedQuestions, passagesMap);
            if (submitBtnContainer) submitBtnContainer.style.display = 'block';
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red; text-align:center;">❌ Error: ${err.message}</p>`;
    }
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
    const safeQuestionId = question.id ? String(question.id).replace(/[^a-zA-Z0-9]/g, '_') : 'cw_0';
    const safeQuestionText = escapeHtml(question.question || '');
    
    container.innerHTML = `
        <div style="background:#fff; padding:24px; border:1px solid #e5e7eb; border-radius:8px; max-width:800px; margin:0 auto; font-family:sans-serif;">
            <h2 style="font-weight:bold; font-size:20px; margin-bottom:16px; color:#1e40af;">Creative Writing</h2>
            <p style="font-weight:600; margin-bottom:16px; color:#374151; font-size:18px;">${safeQuestionText}</p>
            <textarea id="creative-writing-text-${safeQuestionId}" style="width:100%; height:200px; padding:16px; border:1px solid #d1d5db; border-radius:8px; margin-bottom:16px; font-size:16px;" placeholder="Write your essay here..."></textarea>
            <div style="margin-bottom:16px;">
                <label style="display:block; margin-bottom:8px; font-size:14px; font-weight:500; color:#374151;">Or Upload an Image (Max 5MB)</label>
                <input type="file" id="creative-writing-file-${safeQuestionId}" accept=".jpg,.jpeg,.png,.gif,.webp" style="display:block; width:100%; font-size:14px;"/>
            </div>
            <button onclick="window.continueToMCQ('${safeQuestionId}', '${escapeHtml(params.get('studentName'))}', '${escapeHtml(params.get('parentEmail'))}', '${escapeHtml(params.get('tutorEmail'))}', '${escapeHtml(params.get('grade'))}')" style="background:#2563eb; color:#fff; font-weight:bold; padding:12px 24px; border-radius:8px; border:none; cursor:pointer; width:100%; font-size:16px;">Continue to Multiple-Choice</button>
        </div>
    `;
}

function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    if (!container) return;
    container.innerHTML = '';
    
    const questionsByPassage = {};
    const questionsWithoutPassage = [];
    
    questions.forEach((question) => {
        const qPassageId = question.passageId ? String(question.passageId).trim() : null;
        if (qPassageId && passagesMap[qPassageId]) {
            if (!questionsByPassage[qPassageId]) questionsByPassage[qPassageId] = [];
            questionsByPassage[qPassageId].push(question);
        } else {
            questionsWithoutPassage.push(question);
        }
    });
    
    // 🔥 GOD MODE HUD 🔥
    const hud = document.createElement('div');
    hud.style.cssText = "background: #1e293b; color: #10b981; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; margin-bottom: 20px; border: 1px solid #334155; max-width: 800px; margin: 0 auto 20px auto;";
    hud.innerHTML = `<strong>GOD MODE HUD:</strong><br/>Questions Processed: ${questions.length}<br/>Passages Displayed: ${Object.keys(questionsByPassage).length}<br/>Standalone Questions: ${questionsWithoutPassage.length}`;
    container.appendChild(hud);
    
    let globalQuestionIndex = 1; 
    
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];
        
        // UNBLOCKABLE INLINE CSS PASSAGE RENDER
        const passageElement = document.createElement('div');
        passageElement.style.cssText = "background-color: #f0f9ff; padding: 24px; border-radius: 8px; border-left: 6px solid #0ea5e9; margin-bottom: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 800px; margin-left: auto; margin-right: auto;";
        passageElement.innerHTML = `
            <span style="background-color: #0ea5e9; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; display: inline-block;">Reading Passage</span>
            <h3 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px; font-family: sans-serif;">${escapeHtml(passage.title || 'Reading Text')}</h3>
            ${passage.subtitle ? `<h4 style="font-size: 18px; color: #475569; margin-top: 0; margin-bottom: 12px; font-style: italic; font-family: sans-serif;">${escapeHtml(passage.subtitle)}</h4>` : ''}
            ${passage.author ? `<p style="font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 20px; font-weight: 600; font-family: sans-serif;">${escapeHtml(passage.author)}</p>` : ''}
            <div style="background-color: white; padding: 20px; border: 1px solid #bae6fd; border-radius: 6px; color: #334155; line-height: 1.8; font-size: 16px; white-space: pre-wrap; font-family: Georgia, serif;">${escapeHtml(passage.content)}</div>
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
    questionElement.style.cssText = "background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 800px; margin-left: auto; margin-right: auto; font-family: sans-serif;";
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
                <div style="margin-bottom: 12px; text-align: center;">
                    <img src="${safeOptimizedUrl}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;" alt="Question image" data-full-url="${safeImageUrl}" class="js-open-image" loading="lazy"/>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Click image to view full size</p>
                </div>
            ` : ''}
            
            <p style="font-weight: 600; margin-bottom: 16px; color: #1f2937; font-size: 18px;">
                ${displayIndex}. ${safeQuestionText}
                <span style="display: inline-block; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px; color: #6b7280; margin-left: 8px; font-weight: normal;">${hasOptions ? 'Multiple Choice' : 'Text Answer'}</span>
            </p>
            
            ${showImageAfter && safeOptimizedUrl ? `
                <div style="margin-top: 12px; text-align: center;">
                    <img src="${safeOptimizedUrl}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;" alt="Question image" data-full-url="${safeImageUrl}" class="js-open-image" loading="lazy"/>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Click image to view full size</p>
                </div>
            ` : ''}
            
            <div style="margin-top: 12px;">
                ${hasOptions ? 
                    safeOptions.map(opt => `
                        <label style="display: flex; align-items: center; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 8px; cursor: pointer; transition: background 0.2s;">
                            <input type="radio" name="q${q.id || displayIndex}" value="${opt}" style="margin-right: 12px; width: 18px; height: 18px;"> 
                            <span style="color: #374151; font-size: 16px;">${opt}</span>
                        </label>
                    `).join('') 
                    : 
                    `
                    <div>
                        <textarea id="text-answer-${q.id || displayIndex}" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px;" placeholder="Type your answer here..." rows="3"></textarea>
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
            if (textInput) textInput.addEventListener('input', (e) => saveTextAnswer(q.id || displayIndex, e.target.value));
        }

        questionElement.querySelectorAll('.js-open-image').forEach(img => {
            img.addEventListener('click', () => {
                const url = img.getAttribute('data-full-url');
                if (url) window.open(url, '_blank');
            });
        });
        
        return questionElement;
    } catch (error) { return null; }
}

window.continueToMCQ = async (questionId, studentName, parentEmail, tutorEmail, grade) => {
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    
    const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
    const fileInput = document.getElementById(`creative-writing-file-${questionId}`);
    if (!questionTextarea) return alert("Error: Could not find text area.");

    const textAnswer = questionTextarea.value.trim();
    const file = fileInput?.files[0];
    const continueBtn = document.querySelector('button[onclick*="continueToMCQ"]');
    
    if (continueBtn) { continueBtn.textContent = "Submitting..."; continueBtn.disabled = true; }
    if (!textAnswer && !file) {
        alert("Please write a response or upload an image.");
        if (continueBtn) { continueBtn.textContent = "Continue"; continueBtn.disabled = false; }
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
            if (result.secure_url) fileUrl = result.secure_url;
        }
        
        const submittedData = {
            questionId, textAnswer, fileUrl, submittedAt: new Date(),
            studentName, parentEmail, tutorEmail, grade, subject: 'ela', status: "pending_review", type: "creative_writing"
        };
        await setDoc(doc(db, "tutor_submissions", `${parentEmail}-${questionId}-${Date.now()}`), submittedData);
        sessionStorage.removeItem(currentSessionId);
        sessionStorage.removeItem(`${currentSessionId}-answers`);
        
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('state', 'mcq');
            window.location.href = url.toString();
        }, 500);
    } catch (error) {
        alert(`Error: ${error.message}`);
        if (continueBtn) { continueBtn.textContent = "Continue"; continueBtn.disabled = false; }
    }
};

window.addEventListener('beforeunload', function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('state') === 'completed' || params.get('state') === 'submitted') clearTestSession(true);
});

window.handleLogout = function() {
    clearAllTestSessions();
    window.location.href = '/login.html';
};
