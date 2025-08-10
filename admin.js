import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

// --- Cloudinary Configuration ---
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ##################################################################
// # SECTION 1: DASHBOARD PANEL (Original Functionality)
// ##################################################################

async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md">
                <h3 class="font-bold text-blue-800">Total Students</h3>
                <p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">0</p>
            </div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md">
                <h3 class="font-bold text-blue-800">Total Tutors</h3>
                <p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">0</p>
            </div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md">
                <h3 class="font-bold text-blue-800">Students Per Tutor</h3>
                <select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4">
                        <label for="topic" class="block text-gray-700">Topic</label>
                        <input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label for="subject" class="block text-gray-700">Subject</label>
                        <select id="subject" required class="w-full mt-1 p-2 border rounded">
                            <option value="">Select Subject</option>
                            <option value="Math">Math</option>
                            <option value="English">English</option>
                            <option value="Science">Science</option>
                            <option value="Social Studies">Social Studies</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="grade" class="block text-gray-700">Grade</label>
                        <select id="grade" required class="w-full mt-1 p-2 border rounded">
                            <option value="">Select Grade</option>
                            <option value="3">Grade 3</option>
                            <option value="4">Grade 4</option>
                            <option value="5">Grade 5</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="questionType" class="block text-gray-700">Question Type</label>
                        <select id="questionType" class="w-full mt-1 p-2 border rounded">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="creative-writing">Creative Writing</option>
                            <option value="comprehension">Comprehension</option>
                        </select>
                    </div>
                    <div id="optionsContainer" class="mb-4">
                        <h4 class="font-semibold mb-2">Options</h4>
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1">
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2">
                    </div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection">
                        <label for="correctAnswer" class="block text-gray-700">Correct Answer</label>
                        <input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded">
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                </form>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <div id="studentReportSection">
                    <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                    <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                    <div id="reportContent" class="mt-4 space-y-4"></div>
                </div>
            </div>
        </div>
    `;

    // Re-attach all event listeners for the dashboard
    setupDashboardListeners();
    loadCounters();
    loadStudentDropdown();
}

function setupDashboardListeners() {
    // Listener for Add Question Form
    const addQuestionForm = document.getElementById('addQuestionForm');
    if (addQuestionForm) {
        addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
    }
    // ... other listeners for the dashboard ...
    document.getElementById('addOptionBtn').addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });
}

async function handleAddQuestionSubmit(e) {
    e.preventDefault();
    // Logic for adding a question to Firestore (as before)
    console.log("Adding question...");
}

async function loadCounters() {
    // Logic to load total students/tutors (as before)
    const totalStudentsCount = document.getElementById('totalStudentsCount');
    const totalTutorsCount = document.getElementById('totalTutorsCount');
    if (totalStudentsCount) totalStudentsCount.textContent = '...'; // Placeholder
}

async function loadStudentDropdown() {
    // Logic to populate the student dropdown (as before)
     const studentDropdown = document.getElementById('studentDropdown');
    if(studentDropdown) {
        studentDropdown.innerHTML = `<option value="">Select Student</option>`;
        studentDropdown.addEventListener('change', (e) => {
            const docId = e.target.value;
            if (docId) loadAndRenderReport(docId);
        });
    }
}

async function loadAndRenderReport(docId) {
    // Logic to load and display a single student report (as before)
    const reportContent = document.getElementById('reportContent');
    if(reportContent) reportContent.innerHTML = `<p>Loading report for ${docId}...</p>`;
}

// ##################################################################
// # SECTION 2: CONTENT MANAGER PANEL (New Functionality)
// ##################################################################

async function renderContentManagerPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Content Checklist & Uploader</h2>
            
            <div class="checklist-section mb-8 p-4 border rounded-md">
                <h3 class="text-xl font-semibold mb-2 text-gray-800">Passage Upload</h3>
                <p class="text-gray-600 mb-4">Select a passage to view its content and update it. Changes are saved directly to the database.</p>
                <label for="passage-select" class="font-bold">Select Passage to Update:</label>
                <select id="passage-select" class="w-full p-2 border rounded mt-1 mb-2"></select>
                <textarea id="passage-content" placeholder="Passage content will appear here..." class="w-full p-2 border rounded h-40"></textarea>
                <button id="update-passage-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Passage to DB</button>
            </div>

            <div class="checklist-section p-4 border rounded-md">
                <h3 class="text-xl font-semibold mb-2 text-gray-800">Missing Images</h3>
                <p class="text-gray-600 mb-4">For questions needing an image, provide the correct image URL and save it.</p>
                <label for="image-select" class="font-bold">Select Question with Missing Image:</label>
                <select id="image-select" class="w-full p-2 border rounded mt-1 mb-2"></select>
                <input type="text" id="image-path" placeholder="Enter full image URL (e.g., https://res.cloudinary.com/...)" class="w-full p-2 border rounded">
                <button id="update-image-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Save Image URL to DB</button>
            </div>
             <p id="status" class="mt-4 font-bold"></p>
        </div>
    `;
    
    // Once the HTML is in the DOM, run the logic for the content manager
    setupContentManager();
}

function setupContentManager() {
    // In a real app, this data would be fetched from Firestore.
    // We use this local object to simulate the database.
    const contentData = {
      "tests": [
        { "id": "staar_g3_reading_2018", "subject": "Reading", "grade": 3, "passages": [
            {"passageId": "p1", "title": "Racing Team", "content": "[PASSAGE TEXT TO BE UPLOADED]"},
            {"passageId": "p2", "title": "Star Parties", "content": "The night sky is full of wonders..."}
        ], "questions": [
            {"questionId": "g3r_2", "passageId": "p1", "imagePlaceholder": "g3r_p1_illustration.png"}
        ]},
        { "id": "staar_g4_math_2022", "subject": "Math", "grade": 4, "questions": [
            {"questionId": "g4m_8", "passageId": null, "imagePlaceholder": "g4m_q8_angles.png"},
            {"questionId": "g4m_27", "passageId": null, "imageUrl": "assets/g4m_q27_protractor.png"}
        ]}
      ]
    };

    const passageSelect = document.getElementById('passage-select');
    const passageContent = document.getElementById('passage-content');
    const updatePassageBtn = document.getElementById('update-passage-btn');
    const imageSelect = document.getElementById('image-select');
    const imagePathInput = document.getElementById('image-path');
    const updateImageBtn = document.getElementById('update-image-btn');
    const statusDiv = document.getElementById('status');

    function populateDropdowns() {
        passageSelect.innerHTML = '<option value="">-- Select a Passage --</option>';
        imageSelect.innerHTML = '<option value="">-- Select a Question --</option>';

        contentData.tests.forEach((test, testIndex) => {
            if(test.passages) {
                test.passages.forEach((passage, passageIndex) => {
                    const isComplete = !passage.content.includes("TO BE UPLOADED");
                    const option = document.createElement('option');
                    option.value = `${testIndex}-${passageIndex}`;
                    option.textContent = `[${test.subject} G${test.grade}] ${passage.title} ${isComplete ? '✓' : '✗'}`;
                    passageSelect.appendChild(option);
                });
            }
            if(test.questions) {
                test.questions.forEach((question, questionIndex) => {
                    if (question.imagePlaceholder) {
                         const option = document.createElement('option');
                         option.value = `${testIndex}-${questionIndex}`;
                         option.textContent = `[${test.subject} G${test.grade}] Q-ID ${question.questionId} (${question.imagePlaceholder}) ✗`;
                         imageSelect.appendChild(option);
                    }
                });
            }
        });
    }

    passageSelect.addEventListener('change', (e) => {
        if (!e.target.value) { passageContent.value = ''; return; }
        const [testIndex, passageIndex] = e.target.value.split('-');
        passageContent.value = contentData.tests[testIndex].passages[passageIndex].content;
    });

    imageSelect.addEventListener('change', (e) => {
        if (!e.target.value) { imagePathInput.value = ''; return; }
        const [testIndex, questionIndex] = e.target.value.split('-');
        const question = contentData.tests[testIndex].questions[questionIndex];
        imagePathInput.value = question.imageUrl || '';
    });

    updatePassageBtn.addEventListener('click', () => {
        const selected = passageSelect.value;
        if (!selected) return;
        const [testIndex, passageIndex] = selected.split('-');
        const passage = contentData.tests[testIndex].passages[passageIndex];
        passage.content = passageContent.value;
        
        // ** SIMULATED FIRESTORE UPDATE **
        console.log(`SIMULATING FIRESTORE UPDATE for test '${contentData.tests[testIndex].id}', passage '${passage.title}'`);
        // Real code would be: await updateDoc(doc(db, "tests", contentData.tests[testIndex].id), { ... });

        statusDiv.textContent = `✅ Passage '${passage.title}' updated locally. Check console for simulated DB call.`;
        populateDropdowns();
    });

    updateImageBtn.addEventListener('click', () => {
        const selected = imageSelect.value;
        if (!selected) return;
        const [testIndex, questionIndex] = selected.split('-');
        const question = contentData.tests[testIndex].questions[questionIndex];
        
        question.imageUrl = imagePathInput.value;
        delete question.imagePlaceholder; // Fulfill the placeholder

        // ** SIMULATED FIRESTORE UPDATE **
        console.log(`SIMULATING FIRESTORE UPDATE for test '${contentData.tests[testIndex].id}', question '${question.questionId}'`);
        // Real code would be: await updateDoc(doc(db, "tests", contentData.tests[testIndex].id), { ... });
        
        statusDiv.textContent = `✅ Image for Question '${question.questionId}' updated locally. Check console for simulated DB call.`;
        populateDropdowns();
        imagePathInput.value = '';
    });

    populateDropdowns();
}

// ##################################################################
// # SECTION 3: AUTHENTICATION & APP INITIALIZATION
// ##################################################################

function initializeAdminPanel() {
    const mainContent = document.getElementById('main-content');
    const navDashboard = document.getElementById('navDashboard');
    const navContent = document.getElementById('navContent');

    function setActiveNav(activeButton) {
        navDashboard.classList.remove('active');
        navContent.classList.remove('active');
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => {
        setActiveNav(navDashboard);
        renderAdminPanel(mainContent);
    });

    navContent.addEventListener('click', () => {
        setActiveNav(navContent);
        renderContentManagerPanel(mainContent);
    });
    
    // Initial render
    renderAdminPanel(mainContent);
}

onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        initializeAdminPanel();
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "admin-auth.html";
        });
    } else {
        window.location.href = "admin-auth.html";
    }
});
