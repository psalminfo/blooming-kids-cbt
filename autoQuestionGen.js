import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, documentId, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ==================== CONSTANTS ====================
const TEST_QUESTION_COUNT = 15;
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ==================== MODULE STATE ====================
let loadedQuestions = [];
let currentSessionId = null;
let saveTimeoutMcq = null;      // separate timeouts for MCQ and text answers
let saveTimeoutText = null;
let styleInjected = false;       // flag to avoid duplicate style tags

// ==================== HELPER FUNCTIONS ====================

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

    // Only reuse session if it's for the EXACT same test AND state
    if (existingSessionId && existingSessionId === testSessionKey) {
        console.log("Reusing session for current test and state:", testSessionKey);
        return existingSessionId;
    }

    // New test session - clear old sessions for different states
    clearOtherStateSessions(testSessionKey);

    // Set new session for current test and state
    sessionStorage.setItem('currentTestSession', testSessionKey);
    console.log("Started new test session for state:", testSessionKey);

    return testSessionKey;
}

/**
 * Clear sessions for other states but keep current one and pointer key.
 * FIX: Preserve the 'currentTestSession' key itself.
 */
function clearOtherStateSessions(currentSessionKey) {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        // Identify test-related keys
        if (key && (key.startsWith('test-') || key.startsWith('session-') || key.includes('-answers') || key === 'currentSessionId' || key === 'currentTestSession' || key === 'justCompletedCreativeWriting')) {
            // Keep the current session data and the pointer key itself
            if (key !== currentSessionKey && key !== 'currentTestSession' && key !== `${currentSessionKey}-answers`) {
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

    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log("All test sessions cleared");
}

/**
 * Save session to storage
 */
function saveSession(questions, passages) {
    try {
        const sessionData = {
            questions,
            passages,
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
            if (radio) radio.checked = true;

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
 * Save answer to storage (debounced) – MCQ version
 */
function saveAnswer(questionId, answer) {
    clearTimeout(saveTimeoutMcq);
    saveTimeoutMcq = setTimeout(() => {
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
 * Save text answer to storage (debounced) – Text version
 */
function saveTextAnswer(questionId, answer) {
    clearTimeout(saveTimeoutText);
    saveTimeoutText = setTimeout(() => {
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
    if (!originalUrl || !originalUrl.includes('cloudinary.com')) return originalUrl;
    if (originalUrl.includes('/upload/') && !originalUrl.includes('/upload/q_')) {
        return originalUrl.replace('/upload/', '/upload/q_auto,f_auto,w_600,c_limit/');
    }
    return originalUrl;
}

/**
 * Safely get options array from question object
 */
function getQuestionOptions(question) {
    if (!question || !question.options) return [];

    if (Array.isArray(question.options)) return question.options;

    if (typeof question.options === 'string') {
        try {
            const parsed = JSON.parse(question.options);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            // fallback: split by commas
            return question.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        }
    }

    if (typeof question.options === 'object' && question.options !== null) {
        return Object.values(question.options).filter(opt => opt != null);
    }

    return [];
}

// ==================== QUESTION SELECTION (ELA) ====================

/**
 * Select ELA questions with passage integrity:
 * - If a passage has >15 questions, it can be the only passage and we cannot add non-passage.
 * - Otherwise, pick one passage, then fill with non-passage up to 15.
 * - If not enough non-passage, try to add a second passage only if it fits completely.
 * - Never split a passage.
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

    // Group by passage
    const questionsByPassage = {};
    questionsWithPassages.forEach(question => {
        if (!questionsByPassage[question.passageId]) {
            questionsByPassage[question.passageId] = [];
        }
        questionsByPassage[question.passageId].push(question);
    });

    const passageIds = Object.keys(questionsByPassage);
    const selectedQuestions = [];
    const selectedPassageIds = [];

    // If no passages at all, just return random 15 from non-passage
    if (passageIds.length === 0) {
        const shuffled = [...questionsWithoutPassages].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, TEST_QUESTION_COUNT);
    }

    // Helper: can we add a passage without exceeding limit?
    const canAddPassage = (passageId) => {
        const passageSize = questionsByPassage[passageId].length;
        const currentTotal = selectedQuestions.length;
        return currentTotal + passageSize <= TEST_QUESTION_COUNT;
    };

    // Step 1: pick a random passage that fits (or if none fits, pick the smallest that exceeds? but then we can't add anything else)
    let firstPassageId = null;
    const fittingPassages = passageIds.filter(id => canAddPassage(id));
    if (fittingPassages.length > 0) {
        firstPassageId = fittingPassages[Math.floor(Math.random() * fittingPassages.length)];
    } else {
        // No passage fits entirely -> we have to pick one and exceed the limit. Choose the smallest oversized passage.
        firstPassageId = passageIds.reduce((a, b) => 
            questionsByPassage[a].length < questionsByPassage[b].length ? a : b
        );
        console.warn(`Passage ${firstPassageId} has ${questionsByPassage[firstPassageId].length} questions, exceeding ${TEST_QUESTION_COUNT}. It will be the only passage shown.`);
    }

    // Add first passage
    selectedQuestions.push(...questionsByPassage[firstPassageId]);
    selectedPassageIds.push(firstPassageId);
    console.log(`Selected first passage ${firstPassageId} with ${questionsByPassage[firstPassageId].length} questions`);

    // If we already hit or exceeded limit, stop
    if (selectedQuestions.length >= TEST_QUESTION_COUNT) {
        return selectedQuestions.slice(0, TEST_QUESTION_COUNT); // trim to limit (though passage may be truncated – warning given)
    }

    // Step 2: fill with non-passage questions
    const needed = TEST_QUESTION_COUNT - selectedQuestions.length;
    const availableNonPassage = questionsWithoutPassages.length;
    if (availableNonPassage >= needed) {
        // enough non-passage – take random needed
        const shuffledNon = [...questionsWithoutPassages].sort(() => 0.5 - Math.random());
        selectedQuestions.push(...shuffledNon.slice(0, needed));
        console.log(`Added ${needed} non-passage questions`);
        return selectedQuestions;
    }

    // Not enough non-passage – take all non-passage
    if (availableNonPassage > 0) {
        selectedQuestions.push(...questionsWithoutPassages);
        console.log(`Added all ${availableNonPassage} non-passage questions`);
    }

    // Step 3: try to add a second passage if it fits exactly in remaining slots
    const remainingSlots = TEST_QUESTION_COUNT - selectedQuestions.length;
    if (remainingSlots > 0 && passageIds.length > 1) {
        const remainingPassageIds = passageIds.filter(id => !selectedPassageIds.includes(id));
        // Find a passage that fits exactly in remaining slots
        const secondPassageId = remainingPassageIds.find(id => questionsByPassage[id].length === remainingSlots);
        if (secondPassageId) {
            selectedQuestions.push(...questionsByPassage[secondPassageId]);
            console.log(`Added second passage ${secondPassageId} with ${questionsByPassage[secondPassageId].length} questions`);
        } else {
            // optionally, pick a passage that is smaller than remaining and fill rest with non-passage? but non-passage already exhausted.
            // We'll pick a passage that is less than or equal to remaining and then drop some non-passage? Not ideal. Instead, we can add a smaller passage if available.
            const smallerPassages = remainingPassageIds.filter(id => questionsByPassage[id].length <= remainingSlots);
            if (smallerPassages.length > 0) {
                const chosen = smallerPassages[Math.floor(Math.random() * smallerPassages.length)];
                selectedQuestions.push(...questionsByPassage[chosen]);
                console.log(`Added second passage ${chosen} with ${questionsByPassage[chosen].length} questions (partial fill)`);
            }
        }
    }

    // Final trim (in case we still exceed due to oversized second passage)
    return selectedQuestions.slice(0, TEST_QUESTION_COUNT);
}

// ==================== DISPLAY FUNCTIONS ====================

/**
 * Injects required CSS once.
 */
function injectStyles() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'auto-question-style';
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
    styleInjected = true;
}

/**
 * Displays MCQ questions grouped by their passages.
 */
function displayMCQQuestions(questions, passagesMap = {}) {
    const container = document.getElementById("question-container");
    if (!container) {
        console.error('question-container not found');
        return;
    }

    injectStyles(); // ensure styles are present once

    container.innerHTML = '';
    container.className = 'question-container';

    // Group questions by passage
    const questionsByPassage = {};
    const questionsWithoutPassage = [];

    questions.forEach(question => {
        if (question.passageId && passagesMap[question.passageId]) {
            if (!questionsByPassage[question.passageId]) {
                questionsByPassage[question.passageId] = [];
            }
            questionsByPassage[question.passageId].push(question);
        } else {
            questionsWithoutPassage.push(question);
        }
    });

    let globalIndex = 1;

    // Display passages and their questions
    Object.keys(questionsByPassage).forEach(passageId => {
        const passage = passagesMap[passageId];
        const passageQuestions = questionsByPassage[passageId];

        const passageEl = document.createElement('div');
        passageEl.className = 'passage-container bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500';
        passageEl.innerHTML = `
            <h3 class="text-lg font-bold text-green-800 mb-2">${escapeHtml(passage.title || 'Reading Passage')}</h3>
            ${passage.subtitle ? `<h4 class="text-md text-gray-600 mb-3">${escapeHtml(passage.subtitle)}</h4>` : ''}
            ${passage.author ? `<p class="text-sm text-gray-500 mb-4">${escapeHtml(passage.author)}</p>` : ''}
            <div class="passage-content text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded border">${escapeHtml(passage.content)}</div>
        `;
        container.appendChild(passageEl);

        passageQuestions.forEach(q => {
            const qEl = createQuestionElement(q, globalIndex++);
            if (qEl) container.appendChild(qEl);
        });
    });

    // Questions without passages
    questionsWithoutPassage.forEach(q => {
        const qEl = createQuestionElement(q, globalIndex++);
        if (qEl) container.appendChild(qEl);
    });
}

/**
 * Creates a question element with optimized images and answer tracking.
 */
function createQuestionElement(q, displayIndex) {
    if (!q || typeof q !== 'object') {
        console.error('Invalid question object:', q);
        return null;
    }

    const questionId = q.id || `question-${displayIndex}`;
    const safeQuestionText = escapeHtml(q.question || '');
    const optimizedImageUrl = q.imageUrl ? optimizeImageUrl(q.imageUrl) : null;
    const showImageBefore = optimizedImageUrl && q.image_position !== 'after';
    const showImageAfter = optimizedImageUrl && q.image_position === 'after';

    const options = getQuestionOptions(q);
    const hasOptions = options.length > 0;

    // Escape options for display
    const safeOptions = options.map(opt => escapeHtml(opt));

    const wrapper = document.createElement('div');
    wrapper.className = 'bg-white p-4 border rounded-lg shadow-sm question-block mt-4';
    wrapper.setAttribute('data-question-id', questionId);

    // Build inner HTML without inline event handlers
    let html = '';

    if (showImageBefore) {
        html += `
            <div class="image-container mb-3">
                <img src="${optimizedImageUrl}" class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" alt="Question image" data-fullsize="${q.imageUrl}">
                <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
            </div>
        `;
    }

    html += `
        <p class="font-semibold mb-3 question-text text-gray-800">
            ${displayIndex}. ${safeQuestionText}
            <span class="answer-type-label">${hasOptions ? 'Multiple Choice' : 'Text Answer'}</span>
        </p>
    `;

    if (showImageAfter) {
        html += `
            <div class="image-container mt-3">
                <img src="${optimizedImageUrl}" class="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" alt="Question image" data-fullsize="${q.imageUrl}">
                <p class="text-xs text-gray-500 text-center mt-1">Click image to view full size</p>
            </div>
        `;
    }

    if (hasOptions) {
        html += `<div class="mt-3 space-y-2">`;
        safeOptions.forEach(opt => {
            html += `
                <label class="flex items-center py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                    <input type="radio" name="q${questionId}" value="${opt}" class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"> 
                    <span class="text-gray-700">${opt}</span>
                </label>
            `;
        });
        html += `</div>`;
    } else {
        html += `
            <div class="text-answer-container mt-3">
                <textarea id="text-answer-${questionId}" class="text-answer-input" placeholder="Type your answer here..." rows="3"></textarea>
                <p class="text-xs text-gray-500 mt-1">Type your answer in the box above</p>
            </div>
        `;
    }

    wrapper.innerHTML = html;

    // Attach event listeners safely
    if (hasOptions) {
        const radios = wrapper.querySelectorAll(`input[name="q${questionId}"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => saveAnswer(questionId, e.target.value));
        });
    } else {
        const textarea = wrapper.querySelector(`#text-answer-${questionId}`);
        if (textarea) {
            textarea.addEventListener('input', (e) => saveTextAnswer(questionId, e.target.value));
        }
    }

    // Attach click listeners to images (safe URL opening)
    const images = wrapper.querySelectorAll('.image-container img');
    images.forEach(img => {
        img.addEventListener('click', () => {
            const fullUrl = img.dataset.fullsize;
            if (fullUrl && !fullUrl.startsWith('javascript:')) {
                window.open(fullUrl, '_blank');
            } else {
                console.warn('Invalid image URL');
            }
        });
    });

    return wrapper;
}

/**
 * Displays creative writing section.
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

            <button id="continue-to-mcq-btn" class="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200 mt-4 w-full">
                Continue to Multiple-Choice Questions
            </button>
        </div>
    `;

    // Attach click handler to the button
    document.getElementById('continue-to-mcq-btn').addEventListener('click', () => {
        continueToMCQ(safeQuestionId, studentName, parentEmail, tutorEmail, grade);
    });
}

// ==================== CREATIVE WRITING SUBMISSION ====================

/**
 * Handle creative writing submission and redirect to MCQ.
 */
async function continueToMCQ(questionId, studentName, parentEmail, tutorEmail, grade) {
    const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
    const fileInput = document.getElementById(`creative-writing-file-${questionId}`);

    if (!questionTextarea) {
        alert("Error: Could not find text area. Please refresh the page and try again.");
        return;
    }

    const textAnswer = questionTextarea.value.trim();
    const file = fileInput?.files[0];
    const continueBtn = document.getElementById('continue-to-mcq-btn');

    if (continueBtn) {
        continueBtn.textContent = "Submitting Creative Writing...";
        continueBtn.disabled = true;
    }

    // Validate at least one input
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

            const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
            if (!response.ok) throw new Error("File upload failed. Please try again.");
            const result = await response.json();
            fileUrl = result.secure_url;
        }

        // Save to Firestore with auto-generated ID
        const submittedData = {
            questionId,
            textAnswer,
            fileUrl,
            submittedAt: new Date(),
            studentName,
            parentEmail,
            tutorEmail,
            grade,
            subject: 'ela',
            status: "pending_review",
            type: "creative_writing"
        };

        // Use addDoc instead of constructing document ID
        await addDoc(collection(db, "tutor_submissions"), submittedData);
        console.log("Creative writing submitted successfully");

        // Clear creative writing session before redirect
        if (currentSessionId) {
            sessionStorage.removeItem(currentSessionId);
            sessionStorage.removeItem(`${currentSessionId}-answers`);
        }

        // Redirect using URLSearchParams (safe)
        const url = new URL(window.location.href);
        url.searchParams.set('state', 'mcq');
        window.location.href = url.toString();

    } catch (error) {
        console.error("Error submitting creative writing:", error);
        alert(`Submission error: ${error.message}. Please try again.`);
        if (continueBtn) {
            continueBtn.textContent = "Continue to Multiple-Choice Questions";
            continueBtn.disabled = false;
        }
    }
}

// ==================== MAIN LOAD FUNCTION ====================

/**
 * The entry point to load and display questions for a test.
 */
export async function loadQuestions(subject, grade, state) {
    // Security checks for creative writing
    if (state === 'creative-writing') {
        if (subject.toLowerCase() !== 'ela' || !isGrade3Plus(grade)) {
            console.error("Security violation: creative writing not allowed");
            const params = new URLSearchParams(window.location.search);
            params.set('state', 'mcq');
            window.location.search = params.toString();
            return;
        }
    }

    const container = document.getElementById("question-container");
    const submitBtnContainer = document.getElementById("submit-button-container");

    if (!container) {
        console.error("CRITICAL: question-container element not found");
        return;
    }

    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your test...</p>`;
    if (submitBtnContainer) submitBtnContainer.style.display = 'none';

    currentSessionId = generateSessionId(grade, subject, state);

    // Restore from saved session if available
    const savedSession = getSavedSession();
    if (savedSession?.questions?.length) {
        console.log("Restoring saved session");
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

        // Fetch from both Firestore collections independently using allSettled
        const testsQuery = query(
            collection(db, "tests"),
            where(documentId(), '>=', `${grade}-${subject.toLowerCase().slice(0, 3)}`),
            where(documentId(), '<', `${grade}-${subject.toLowerCase().slice(0, 3)}` + '\uf8ff')
        );

        const adminQuery = query(
            collection(db, "admin_questions"),
            where("grade", "==", grade.replace('grade', '')),
            where("subject", "==", getAdminQuestionsSubject(subject))
        );

        const [testsResult, adminResult] = await Promise.allSettled([
            getDocs(testsQuery),
            getDocs(adminQuery)
        ]);

        // Process tests collection
        if (testsResult.status === 'fulfilled' && !testsResult.value.empty) {
            testsResult.value.docs.forEach(doc => {
                const data = doc.data();
                let testArray = [];
                if (data.tests) testArray = data.tests;
                else if (data.questions) testArray = [{ questions: data.questions }];

                const questions = testArray.flatMap(test => test.questions || []);
                const passages = testArray.flatMap(test => test.passages || []);
                allQuestions.push(...questions);
                allPassages.push(...passages);
            });
            console.log(`✅ Loaded ${allQuestions.length} questions from TESTS`);
        } else if (testsResult.status === 'rejected') {
            console.warn("Tests collection fetch failed:", testsResult.reason);
        }

        // Process admin_questions collection
        if (adminResult.status === 'fulfilled' && !adminResult.value.empty) {
            const adminQuestions = [];
            adminResult.value.docs.forEach(doc => {
                try {
                    const qData = doc.data();
                    if (!qData || (!qData.question && !qData.type)) return;

                    const questionSubject = qData.subject?.toLowerCase();
                    const expectedSubject = getAdminQuestionsSubject(subject).toLowerCase();
                    if (questionSubject !== expectedSubject) return;

                    adminQuestions.push({
                        ...qData,
                        firebaseId: doc.id,
                        id: doc.id || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        subject: subject.toLowerCase(),
                        grade: qData.grade?.startsWith('grade') ? qData.grade : `grade${qData.grade}`
                    });
                } catch (err) {
                    console.error('Error processing admin question:', doc.id, err);
                }
            });
            allQuestions.push(...adminQuestions);
            console.log(`✅ Loaded ${adminQuestions.length} questions from ADMIN_QUESTIONS`);
        } else if (adminResult.status === 'rejected') {
            console.warn("Admin questions fetch failed:", adminResult.reason);
        }

        // Fallback to GitHub if both failed or empty
        if (allQuestions.length === 0) {
            console.log("📦 Falling back to GitHub...");
            try {
                const gitRes = await fetch(GITHUB_URL);
                if (!gitRes.ok) throw new Error("GitHub file not found");
                const rawData = await gitRes.json();

                let testArray = [];
                if (rawData.tests) testArray = rawData.tests;
                else if (rawData.questions) testArray = [{ questions: rawData.questions }];

                allQuestions = testArray.flatMap(test => test.questions || []);
                allPassages = testArray.flatMap(test => test.passages || []);
                console.log(`✅ Loaded ${allQuestions.length} questions from GitHub`);
            } catch (gitErr) {
                console.error("GitHub fallback failed:", gitErr);
                throw new Error("No questions found in any source.");
            }
        }

        // Remove creative writing questions for non-ELA subjects
        if (subject.toLowerCase() !== 'ela') {
            const before = allQuestions.length;
            allQuestions = allQuestions.filter(q => q.type !== 'creative-writing');
            console.log(`🚫 Removed ${before - allQuestions.length} creative writing questions`);
        }

        // Build passages map
        const passagesMap = {};
        allPassages.forEach(p => {
            if (p.passageId && p.content) passagesMap[p.passageId] = p;
        });

        console.log(`🎯 FINAL: ${allQuestions.length} questions ready for ${grade} - STATE: ${state}`);

        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No ${subject} questions found in any source.</p>`;
            return;
        }

        // Handle creative writing state
        if (subject.toLowerCase() === 'ela' && state === 'creative-writing' && isGrade3Plus(grade)) {
            creativeWritingQuestion = allQuestions.find(q => q.type === 'creative-writing');
            if (!creativeWritingQuestion) {
                container.innerHTML = `<p class="text-red-600">❌ Creative writing question not found. Redirecting...</p>`;
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
            // MCQ state
            const filtered = allQuestions.filter(q => q.type !== 'creative-writing');
            if (filtered.length === 0) {
                container.innerHTML = `<p class="text-red-600">❌ No multiple-choice questions found.</p>`;
                return;
            }

            let selected = [];
            if (subject.toLowerCase() === 'ela') {
                selected = selectELAQuestions(filtered, passagesMap);
            } else {
                // Non-ELA: take random 15
                selected = [...filtered].sort(() => 0.5 - Math.random()).slice(0, TEST_QUESTION_COUNT);
            }

            loadedQuestions = selected.map((q, idx) => ({
                ...q,
                id: q.firebaseId || q.id || `question-${idx}`
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

/**
 * Display questions based on current state.
 */
function displayQuestionsBasedOnState(questions, state) {
    const passagesMap = getSavedSession()?.passages || {};
    if (state === 'creative-writing') {
        const cw = questions.find(q => q.type === 'creative-writing');
        if (cw) displayCreativeWriting(cw);
    } else {
        displayMCQQuestions(questions, passagesMap);
    }
}

// ==================== EXPORTS ====================

export function getAnswerData() {
    const saved = sessionStorage.getItem(`${currentSessionId}-answers`);
    return saved ? JSON.parse(saved) : {};
}

export function getAllLoadedQuestions() {
    return loadedQuestions;
}

export function getLoadedQuestions() {
    return loadedQuestions;
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

// ==================== GLOBAL EVENT HANDLERS ====================

window.handleLogout = function() {
    console.log("Logging out - clearing all test sessions");
    clearAllTestSessions();
    window.location.href = '/login.html';
};

window.addEventListener('beforeunload', function() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state === 'completed' || state === 'submitted') {
        clearTestSession(true);
    }
});
