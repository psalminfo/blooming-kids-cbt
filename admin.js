// [Begin Updated admin.js File]

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc, orderBy, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
let activeTutorId = null;

// #################################################
// # PERSISTENT CACHE IMPLEMENTATION
// #################################################

const CACHE_PREFIX = 'admin_cache_';

const sessionCache = {
    tutors: null,
    students: null,
    reports: null,
    staff: null,
    breakStudents: null,
};

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        sessionCache[key] = data;
    } catch (error) {
        console.error("Could not save to localStorage:", error);
    }
}

function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const storedData = localStorage.getItem(CACHE_PREFIX + key);
            if (storedData) {
                sessionCache[key] = JSON.parse(storedData);
            }
        } catch (error) {
            console.error(`Could not load '${key}' from localStorage:`, error);
            localStorage.removeItem(CACHE_PREFIX + key);
        }
    }
}

function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}

loadFromLocalStorage();


// --- Utility Functions ---
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function convertPayAdviceToCSV(data) {
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)'];
    const rows = data.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.totalPay
    ]);
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

async function uploadImageToCloudinary(file) {
    const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.secure_url;
}

async function updateStaffPermissions(staffEmail, newRole) {
    const staffDocRef = doc(db, "staff", staffEmail);
    const ROLE_PERMISSIONS = {
        pending: { tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false, viewParentFeedback: false }, actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false } },
        tutor: { tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false, viewParentFeedback: false }, actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false } },
        manager: { tabs: { viewTutorManagement: true, viewPayAdvice: false, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: false, viewParentFeedback: true }, actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: true, canDeleteStudents: false } },
        director: { tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true, viewParentFeedback: true }, actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true } },
        admin: { tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true, viewParentFeedback: true }, actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true } }
    };
    const newPermissions = ROLE_PERMISSIONS[newRole];
    if (!newPermissions) {
        console.error("Invalid role specified:", newRole);
        return;
    }
    try {
        await updateDoc(staffDocRef, { role: newRole, permissions: newPermissions });
        invalidateCache('staff');
        console.log(`Successfully updated permissions for ${staffEmail} to role: ${newRole}`);
        fetchAndRenderStaff();
    } catch (error) {
        console.error("Error updating staff permissions:", error);
    }
}

// ##################################################################
// # SECTION 1: DASHBOARD PANEL (NOW CACHE-AWARE)
// ##################################################################
async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Students</h3><p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">...</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Tutors</h3><p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">...</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Students Per Tutor</h3><select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                     <div class="mb-4"><label for="topic" class="block text-gray-700">Topic</label><input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required></div>
                    <div class="mb-4"><label for="subject" class="block font-medium text-gray-700">Subject</label><select id="subject" name="subject" required class="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"><option value="" disabled selected>-- Select a Subject --</option><option value="English">English</option><option value="Math">Math</option><optgroup label="Science"><option value="Biology">Biology</option><option value="Chemistry">Chemistry</option><option value="Physics">Physics</option></optgroup></select></div>
                    <div class="mb-4"><label for="grade" class="block text-gray-700">Grade</label><select id="grade" required class="w-full mt-1 p-2 border rounded"><option value="">Select Grade</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>
                    <div class="mb-4"><label for="questionType" class="block text-gray-700">Question Type</label><select id="questionType" class="w-full mt-1 p-2 border rounded"><option value="multiple-choice">Multiple Choice</option><option value="creative-writing">Creative Writing</option><option value="comprehension">Comprehension</option></select></div>
                    <div class="mb-4" id="writingTypeSection" style="display:none;"><label for="writingType" class="block text-gray-700">Writing Type</label><select id="writingType" class="w-full mt-1 p-2 border rounded"><option value="Narrative">Narrative</option><option value="Descriptive">Descriptive</option><option value="Persuasive">Persuasive</option></select></div>
                     <div class="mb-4" id="comprehensionSection" style="display:none;"><label for="passage" class="block text-gray-700">Comprehension Passage</label><textarea id="passage" class="w-full mt-1 p-2 border rounded" rows="4"></textarea><div id="comprehensionQuestions" class="mt-4"><h4 class="font-semibold mb-2">Questions for Passage</h4></div><button type="button" id="addCompQuestionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mt-2">+ Add Question</button></div>
                    <div class="mb-4"><label for="questionText" class="block text-gray-700">Question Text</label><textarea id="questionText" class="w-full mt-1 p-2 border rounded" rows="3" required></textarea></div>
                    <div class="mb-4"><label for="imageUpload" class="block text-gray-700">Image (Optional)</label><input type="file" id="imageUpload" class="w-full mt-1"></div>
                     <div id="optionsContainer" class="mb-4"><h4 class="font-semibold mb-2">Options</h4><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1"><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2"></div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection"><label for="correctAnswer" class="block text-gray-700">Correct Answer</label><input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded"></div>
                     <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                 <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                <div id="reportContent" class="mt-4 space-y-4"><p class="text-gray-500">Please select a student to view their report.</p></div>
            </div>
         </div>
    `;
    setupDashboardListeners();
}

// ### NEW FUNCTION ###
// Ensures that essential data for the dashboard is loaded into the cache, fetching only if necessary.
async function ensureDashboardData() {
    try {
        if (!sessionCache.tutors) {
            console.log("Cache miss: Fetching tutors for dashboard...");
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
            const tutorsData = {};
            tutorsSnapshot.forEach(doc => {
                tutorsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            saveToLocalStorage('tutors', tutorsData);
        }
        if (!sessionCache.students) {
            console.log("Cache miss: Fetching students for dashboard...");
            const studentsSnapshot = await getDocs(collection(db, "students"));
            saveToLocalStorage('students', studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
    } catch (error) {
        console.error("Failed to ensure dashboard data:", error);
        // Handle error display if necessary
    }
}


async function setupDashboardListeners() {
    const addQuestionForm = document.getElementById('addQuestionForm');
    const questionTypeDropdown = document.getElementById('questionType');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const addCompQuestionBtn = document.getElementById('addCompQuestionBtn');
    const studentDropdown = document.getElementById('studentDropdown');

    addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
    addOptionBtn.addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });
    questionTypeDropdown.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('optionsContainer').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('addOptionBtn').style.display = type === 'multiple-choice' ? 'inline-block' : 'none';
        document.getElementById('correctAnswerSection').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('writingTypeSection').style.display = type === 'creative-writing' ? 'block' : 'none';
        document.getElementById('comprehensionSection').style.display = type === 'comprehension' ? 'block' : 'none';
    });
    addCompQuestionBtn.addEventListener('click', () => {
        const container = document.getElementById('comprehensionQuestions');
        const newQ = document.createElement('div');
        newQ.className = 'question-group mb-4 p-4 border rounded';
        newQ.innerHTML = `<textarea class="comp-question w-full mt-1 p-2 border rounded" rows="2" placeholder="Question"></textarea><div class="flex space-x-2 mt-2"><input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 1"><input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 2"></div><input type="text" class="comp-correct-answer w-full mt-2 p-2 border rounded" placeholder="Correct Answer">`;
        container.appendChild(newQ);
    });
    studentDropdown.addEventListener('change', (e) => {
        if (e.target.value) loadAndRenderReport(e.target.value);
    });

    // ### CHANGED ###
    // Load dashboard data using the new cache-aware functions.
    await ensureDashboardData(); // Make sure cache is populated
    loadCountersFromCache();   // Then load counters from the cache
    loadStudentDropdown();     // This still hits Firestore, as intended
}

async function handleAddQuestionSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const message = document.getElementById('formMessage');
    message.textContent = "Saving...";
    const imageFile = document.getElementById('imageUpload').files[0];

    try {
        let imageUrl = null;
        if (imageFile) {
            message.textContent = "Uploading image...";
            imageUrl = await uploadImageToCloudinary(imageFile);
        }
        message.textContent = "Saving question...";

        const questionType = form.questionType.value;
        let newQuestion = {
            topic: form.topic.value,
            subject: form.subject.value,
            grade: form.grade.value,
            type: questionType,
            image_url: imageUrl,
        };
        if (questionType === 'comprehension') {
            newQuestion.passage = form.passage.value;
            newQuestion.sub_questions = [];
            form.querySelectorAll('.question-group').forEach(group => {
                newQuestion.sub_questions.push({
                    question: group.querySelector('.comp-question').value,
                    options: Array.from(group.querySelectorAll('.comp-option')).map(i => i.value).filter(v => v),
                    correct_answer: group.querySelector('.comp-correct-answer').value,
                    type: 'multiple-choice',
                });
            });
        } else {
            newQuestion.question = form.questionText.value;
            if (questionType === 'creative-writing') {
                newQuestion.writing_type = form.writingType.value;
            } else { // multiple-choice
                newQuestion.options = Array.from(form.querySelectorAll('.option-input')).map(i => i.value).filter(v => v);
                newQuestion.correct_answer = form.correctAnswer.value;
            }
        }

        await addDoc(collection(db, "admin_questions"), newQuestion);
        message.textContent = "Question saved successfully!";
        message.style.color = 'green';
        form.reset();
    } catch (error) {
        console.error("Error adding question:", error);
        message.textContent = `Error: ${error.message}`;
        message.style.color = 'red';
    }
}

// ### CHANGED ###
// This function now reads from the cache and is highly efficient.
function loadCountersFromCache() {
    const tutors = sessionCache.tutors || {};
    const students = sessionCache.students || [];

    // 1. Set total counts from cache length
    document.getElementById('totalStudentsCount').textContent = students.length;
    document.getElementById('totalTutorsCount').textContent = Object.keys(tutors).length;

    // 2. Efficiently calculate students per tutor in memory
    const studentCounts = {};
    for (const student of students) {
        if (student.tutorEmail) {
            studentCounts[student.tutorEmail] = (studentCounts[student.tutorEmail] || 0) + 1;
        }
    }

    // 3. Populate the dropdown
    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
    studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
    for (const tutor of Object.values(tutors)) {
        const count = studentCounts[tutor.email] || 0;
        const option = document.createElement('option');
        option.textContent = `${tutor.name} (${count} students)`;
        studentsPerTutorSelect.appendChild(option);
    }
}


async function loadStudentDropdown() {
    const studentDropdown = document.getElementById('studentDropdown');
    try {
        const snapshot = await getDocs(collection(db, "student_results"));
        studentDropdown.innerHTML = `<option value="">Select Student</option>`;
        snapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${capitalize(student.studentName)} (${student.parentEmail})`;
            studentDropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading student results for dropdown:", error);
        studentDropdown.innerHTML = `<option value="">Failed to load students</option>`;
    }
}

async function loadAndRenderReport(docId) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `<p>Loading report...</p>`;
    try {
        const reportDocSnap = await getDoc(doc(db, "student_results", docId));
        if (!reportDocSnap.exists()) throw new Error("Report not found");
        const data = reportDocSnap.data();

        const tutorName = data.tutorEmail ?
        (await getDoc(doc(db, "tutors", data.tutorEmail))).data()?.name || 'N/A' : 'N/A';
        const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
        const tutorReport = creativeWritingAnswer?.tutorReport || 'No report available.';
        const score = data.answers.filter(a => a.type !== 'creative-writing' && String(a.studentAnswer).toLowerCase() === String(a.correctAnswer).toLowerCase()).length;
        reportContent.innerHTML = `
            <div class="border rounded-lg shadow p-4 bg-white" id="report-block">
                <h3 class="text-xl font-bold mb-2">${capitalize(data.studentName)}</h3>
                <p><strong>Parent Email:</strong> ${data.parentEmail}</p>
                <p><strong>Grade:</strong> ${data.grade}</p>
                <p><strong>Tutor:</strong> ${tutorName}</p>
                 <p><strong>Date:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                <h4 class="text-lg font-semibold mt-4">Score: ${score} / ${data.totalScoreableQuestions}</h4>
                <h4 class="text-lg font-semibold mt-4">Tutor’s Recommendation:</h4>
                <p>${tutorReport}</p>
                <button id="downloadPdfBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4">Download PDF</button>
             </div>
        `;
        document.getElementById('downloadPdfBtn').addEventListener('click', () => {
            html2pdf().from(document.getElementById('report-block')).save(`${data.studentName}_report.pdf`);
        });
    } catch (error) {
        console.error("Error loading report:", error);
        reportContent.innerHTML = `<p class="text-red-500">Failed to load report. ${error.message}</p>`;
    }
}

// ##################################################################
// # SECTION 2: CONTENT MANAGER (No changes needed)
// ##################################################################

async function renderContentManagerPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Content Manager</h2>
            <div class="bg-gray-50 p-4 border rounded-lg mb-6">
                <label for="test-file-select" class="block font-bold text-gray-800">1. Select a Test File</label>
                <p class="text-sm text-gray-600 mb-2">Automatically finds test files in your GitHub repository.</p>
                <div id="file-loader" class="flex items-center space-x-2">
                    <select id="test-file-select" class="w-full p-2 border rounded"><option>Loading files...</option></select>
                    <button id="load-test-btn" class="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700">Load</button>
                </div>
                <div class="mt-2">
                    <input type="checkbox" id="force-reload-checkbox" class="mr-2">
                    <label for="force-reload-checkbox" class="text-sm text-gray-700">Reload from GitHub (overwrites saved progress)</label>
                 </div>
                <div id="loader-status" class="mt-2"></div>
            </div>
            <div id="manager-workspace" style="display:none;">
                 <h3 class="text-gray-800 font-bold mb-4 text-lg" id="loaded-file-name"></h3>
                <div class="mb-8 p-4 border rounded-md"><h4 class="text-xl font-semibold mb-2">2. Edit Incomplete Passages</h4><select id="passage-select" class="w-full p-2 border rounded mt-1 mb-2"></select><textarea id="passage-content" placeholder="Passage content..." class="w-full p-2 border rounded h-40"></textarea><button id="update-passage-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Save Passage to Firestore</button></div>
                <div class="p-4 border rounded-md"><h4 class="text-xl font-semibold mb-2">3. Add Missing Images</h4><select id="image-select" class="w-full p-2 border rounded mt-1 mb-2"></select><div id="image-preview-container" class="my-2" style="display:none;"><p class="font-semibold text-sm">Image to be replaced:</p><img id="image-preview" src="" class="border rounded max-w-xs mt-1"/></div><label class="font-bold mt-2">Upload New Image:</label><input type="file" id="image-upload-input" class="w-full mt-1 border p-2 rounded" accept="image/*"><button id="update-image-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Upload & Save Image to Firestore</button></div>
                <p id="status" class="mt-4 font-bold"></p>
            </div>
        </div>
    `;
    setupContentManager();
}

async function setupContentManager() {
    const GITHUB_USER = 'psalminfo';
    const GITHUB_REPO = 'blooming-kids-cbt';
    const GITHUB_IMAGE_PREVIEW_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/images/`;
    const API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/`;

    const loaderStatus = document.getElementById('loader-status');
    const workspace = document.getElementById('manager-workspace');
    const testFileSelect = document.getElementById('test-file-select');
    const loadTestBtn = document.getElementById('load-test-btn');
    const forceReloadCheckbox = document.getElementById('force-reload-checkbox');
    const status = document.getElementById('status');

    let loadedTestData = null;
    let currentTestDocId = null;
    async function discoverFiles() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Cannot access repository. Check username/repo. Status: ${response.status}`);
            const files = await response.json();
            testFileSelect.innerHTML = '<option value="">-- Select a Test File --</option>';
            const jsonFiles = files.filter(file => file.name.endsWith('.json'));
            if (jsonFiles.length === 0) {
                testFileSelect.innerHTML = '<option value="">No .json files found.</option>';
                return;
            }
            jsonFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.download_url;
                option.textContent = file.name;
                testFileSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error discovering files:', error);
            loaderStatus.innerHTML = `<p class="text-red-500"><strong>Error discovering files:</strong> ${error.message}</p>`;
        }
    }

    loadTestBtn.addEventListener('click', async () => {
        const url = testFileSelect.value;
        const fileName = testFileSelect.options[testFileSelect.selectedIndex].text;
        currentTestDocId = fileName.replace('.json', '');
        const forceReload = forceReloadCheckbox.checked;

        if (!url) {
            loaderStatus.innerHTML = `<p class="text-yellow-600">Please select a file.</p>`;
             return;
        }

        loaderStatus.innerHTML = `<p class="text-blue-600">Checking for test...</p>`;
        workspace.style.display = 'none';
        status.textContent = '';

        try {
            const testDocRef = doc(db, "tests", currentTestDocId);
            const docSnap = await getDoc(testDocRef);

            if (!forceReload && docSnap.exists()) {
                console.log("Loading saved progress from Firestore.");
                loaderStatus.innerHTML = `<p class="text-green-600 font-bold">✅ Loaded saved version from Firestore!</p>`;
                loadedTestData = docSnap.data();
            } else {
                const logMessage = forceReload ?
                "Force Reload activated. Fetching from GitHub." : "No saved version. Loading template from GitHub.";
                console.log(logMessage);
                loaderStatus.innerHTML = `<p class="text-blue-600">Loading latest version from GitHub...</p>`;

                const response = await fetch(url);
                if (!response.ok) throw new Error(`Could not fetch file from GitHub. Status: ${response.status}`);
                loadedTestData = await response.json();

                await setDoc(testDocRef, loadedTestData);
                loaderStatus.innerHTML = `<p class="text-green-600 font-bold">✅ Synced latest version from GitHub to Firestore!</p>`;
            }

            if (!loadedTestData || !loadedTestData.tests) throw new Error("Invalid test file format.");
            document.getElementById('loaded-file-name').textContent = `Editing: ${fileName}`;
            workspace.style.display = 'block';
            populateDropdowns();

        } catch (error) {
            console.error("Error loading test data:", error);
            loaderStatus.innerHTML = `<p class="text-red-500"><strong>Error:</strong> ${error.message}</p>`;
        }
    });

    const passageSelect = document.getElementById('passage-select');
    const passageContent = document.getElementById('passage-content');
    const imageSelect = document.getElementById('image-select');
    const imageUploadInput = document.getElementById('image-upload-input');
    const updatePassageBtn = document.getElementById('update-passage-btn');
    const updateImageBtn = document.getElementById('update-image-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');


    function populateDropdowns() {
        passageSelect.innerHTML = '<option value="">-- Select an incomplete passage --</option>';
        imageSelect.innerHTML = '<option value="">-- Select a question needing an image --</option>';
        imagePreviewContainer.style.display = 'none';
        loadedTestData.tests.forEach((test, testIndex) => {
            (test.passages || []).forEach((passage, passageIndex) => {
                if (passage.content && passage.content.includes("TO BE UPLOADED")) {
                    const option = document.createElement('option');
                    option.value = `${testIndex}-${passageIndex}`;
                     option.textContent = `[${test.subject} G${test.grade}] ${passage.title}`;
                    passageSelect.appendChild(option);
                }
            });
            (test.questions || []).forEach((question, questionIndex) => {
                if (question.imagePlaceholder && !question.imageUrl) {
                    
                    const option = document.createElement('option');
                    option.value = `${testIndex}-${questionIndex}`;
                    option.textContent = `[${test.subject} G${test.grade}] Q-ID ${question.questionId}`;
                    imageSelect.appendChild(option);
              
                 }
            });
        });
    }

    passageSelect.addEventListener('change', e => {
        if (!e.target.value) {
            passageContent.value = '';
            return;
        }
        const [testIndex, passageIndex] = e.target.value.split('-');
        passageContent.value = loadedTestData.tests[testIndex].passages[passageIndex].content || '';
    });
    imageSelect.addEventListener('change', e => {
        if (!e.target.value) {
            imagePreviewContainer.style.display = 'none';
            return;
        }
        const [testIndex, questionIndex] = e.target.value.split('-');
        const question = loadedTestData.tests[testIndex].questions[questionIndex];
        const imageName = question.imagePlaceholder;

        if (imageName) {
         
             imagePreview.src = GITHUB_IMAGE_PREVIEW_URL + imageName;
            imagePreviewContainer.style.display = 'block';
        } else {
            imagePreviewContainer.style.display = 'none';
        }
    });
    updatePassageBtn.addEventListener('click', async () => {
        const selected = passageSelect.value;
        if (!selected) {
            status.textContent = 'Please select a passage first.';
            status.style.color = 'orange';
            return;
        }
        status.textContent = 'Saving passage to Firestore...';
        status.style.color = 'blue';

        const [testIndex, passageIndex] = selected.split('-');
        loadedTestData.tests[testIndex].passages[passageIndex].content = passageContent.value;

        try {
            const testDocRef = doc(db, "tests", currentTestDocId);
            await setDoc(testDocRef, loadedTestData);
            status.textContent = `✅ Passage saved successfully!`;
            status.style.color = 'green';
       
             passageContent.value = '';
            populateDropdowns();
        } catch (error) {
            status.textContent = `❌ Error saving passage: ${error.message}`;
            status.style.color = 'red';
            console.error("Firestore update error:", error);
        }
    });

    updateImageBtn.addEventListener('click', async () => {
        const selectedImage = imageSelect.value;
        const file = imageUploadInput.files[0];
        if (!selectedImage || !file) {
            status.textContent = 'Please select a question and an image file.';
            status.style.color = 'orange';
            return;
      
         }

        try {
            status.textContent = 'Uploading image...';
            status.style.color = 'blue';
            const imageUrl = await uploadImageToCloudinary(file);

            status.textContent = 'Saving URL to Firestore...';
            const [testIndex, questionIndex] = selectedImage.split('-');
           
             loadedTestData.tests[testIndex].questions[questionIndex].imageUrl = imageUrl;
            delete loadedTestData.tests[testIndex].questions[questionIndex].imagePlaceholder;

            const testDocRef = doc(db, "tests", currentTestDocId);
            await setDoc(testDocRef, loadedTestData);

            status.textContent = `✅ Image URL saved successfully!`;
            status.style.color = 'green';
            imageUploadInput.value = '';
            populateDropdowns();
        } catch (error) {
            console.error('Error saving image:', error);
            status.textContent = `❌ Error: ${error.message}`;
            status.style.color = 'red';
        }
    });

    discoverFiles();
}


// ##################################################################
// # SECTION 3: TUTOR MANAGEMENT (OPTIMIZED)
// ##################################################################

let globalSettings = {};
// Populated by the single onSnapshot listener

async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
             <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Global Settings</h2>
                <button id="refresh-tutor-data-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh Data</button>
           
             </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Show Student Fees (Tutors):</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="show-fees-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="show-fees-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Edit/Delete (Tutors):</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="edit-delete-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="edit-delete-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                
                 <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Direct Student Add (Tutors):</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="bypass-approval-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="bypass-approval-status-label" class="ml-3 text-sm font-medium"></span></label></label>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-start mb-4">
      
                 <h3 class="text-2xl font-bold text-green-700">Manage Tutors</h3>
                <div class="flex space-x-4">
                    <div class="bg-blue-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-blue-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl text-blue-600 font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl text-green-600 font-extrabold">0</p></div>
  
                 </div>
            </div>

            <div class="mb-4">
                <label for="global-search-bar" class="block font-semibold">Search Student, Parent, or Tutor:</label>
                <input type="search" id="global-search-bar" class="w-full p-2 border rounded mt-1" placeholder="Start typing a name...">
           
             </div>
            <div id="global-search-results" class="mb-4"></div>

            <div id="tutor-management-area">
                <div class="mb-4">
                    <label for="tutor-select" class="block font-semibold">Select Tutor Manually:</label>
                    <select id="tutor-select" class="w-full p-2 border rounded mt-1"></select>
    
                 </div>
                <div id="selected-tutor-details" class="mt-4"><p class="text-gray-500">Please select a tutor to view details.</p></div>
            </div>
        </div>
    `;
    setupTutorManagementListeners();
}

function setupTutorManagementListeners() {
    const settingsDocRef = doc(db, "settings", "global_settings");
    // EFFICIENT: This single-doc listener is kept for real-time settings updates.
    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            globalSettings = data;

            const toggleMap = { 'isReportEnabled': 'report', 'isTutorAddEnabled': 'tutor-add', 'isSummerBreakEnabled': 'summer-break', 'showStudentFees': 'show-fees', 'showEditDeleteButtons': 'edit-delete', 'bypassPendingApproval': 'bypass-approval' };

            for (const key in toggleMap) {
             
                 const type = toggleMap[key];
                const toggle = document.getElementById(`${type}-toggle`);
                const label = document.getElementById(`${type}-status-label`);
                if (toggle && label) {
                    toggle.checked = !!data[key];
              
                     label.textContent = data[key] ? 'Enabled' : 'Disabled';
                }
            }
            if (activeTutorId) {
                renderSelectedTutorDetailsFromCache(activeTutorId);
            }
        }
    });
    // Attach listeners to toggles to update Firestore
    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isReportEnabled: e.target.checked }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isTutorAddEnabled: e.target.checked }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isSummerBreakEnabled: e.target.checked }));
    document.getElementById('show-fees-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { showStudentFees: e.target.checked }));
    document.getElementById('edit-delete-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { showEditDeleteButtons: e.target.checked }));
    document.getElementById('bypass-approval-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { bypassPendingApproval: e.target.checked }));
    
    // UI Interaction Listeners
    document.getElementById('tutor-select').addEventListener('change', e => {
        activeTutorId = e.target.value;
        renderSelectedTutorDetailsFromCache(activeTutorId);
    });
    document.getElementById('global-search-bar').addEventListener('input', handleGlobalSearch);
    document.getElementById('refresh-tutor-data-btn').addEventListener('click', () => fetchTutorManagementData(true));
    
    fetchTutorManagementData(); // Initial fetch
}

async function fetchTutorManagementData(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors');
        invalidateCache('students');
    }

    try {
        const tutorSelect = document.getElementById('tutor-select');
        const detailsContainer = document.getElementById('selected-tutor-details');
        if (tutorSelect) tutorSelect.innerHTML = '<option>Loading Data...</option>';
        if (detailsContainer) detailsContainer.innerHTML = '';
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
            const tutorsData = {};
            tutorsSnapshot.forEach(doc => {
                tutorsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            saveToLocalStorage('tutors', tutorsData);
        }
        if (!sessionCache.students) {
            const studentsSnapshot = await getDocs(collection(db, "students"));
            saveToLocalStorage('students', studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        renderTutorManagementFromCache();
    } catch (error) {
        console.error("Error fetching tutor management data:", error);
        document.getElementById('tutor-management-area').innerHTML = '<p class="text-red-500">Failed to load data.</p>';
    }
}

function renderTutorManagementFromCache() {
    const tutorsData = sessionCache.tutors || {};
    const studentsData = sessionCache.students || [];
    const tutorSelect = document.getElementById('tutor-select');
    
    if (!tutorSelect) return;
    tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
    Object.values(tutorsData).forEach(tutor => {
        const option = document.createElement('option');
        option.value = tutor.id;
        option.textContent = `${tutor.name} (${tutor.email})`;
        tutorSelect.appendChild(option);
    });
    document.getElementById('tutor-count-badge').textContent = Object.keys(tutorsData).length;
    document.getElementById('student-count-badge').textContent = studentsData.length;

    if (activeTutorId && tutorsData[activeTutorId]) {
        tutorSelect.value = activeTutorId;
        renderSelectedTutorDetailsFromCache(activeTutorId);
    } else {
         document.getElementById('selected-tutor-details').innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
    }
}

function handleGlobalSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const searchResultsContainer = document.getElementById('global-search-results');
    const tutorManagementArea = document.getElementById('tutor-management-area');
    const tutorSelect = document.getElementById('tutor-select');

    if (searchTerm.length < 2) {
        searchResultsContainer.innerHTML = '';
        tutorManagementArea.style.display = 'block';
        return;
    }
    
    tutorManagementArea.style.display = 'none';
    const students = sessionCache.students || [];
    const tutors = sessionCache.tutors || {};
    const tutorsByEmail = Object.values(tutors).reduce((acc, tutor) => {
        acc[tutor.email] = tutor;
        return acc;
    }, {});
    const studentResults = students.filter(student => 
        student.studentName?.toLowerCase().includes(searchTerm) ||
        student.parentName?.toLowerCase().includes(searchTerm)
    );
    const tutorResults = Object.values(tutors).filter(tutor => 
        tutor.name?.toLowerCase().includes(searchTerm) ||
        tutor.email?.toLowerCase().includes(searchTerm)
    );
    let html = `<h4 class="font-bold mb-2">Search Results:</h4>`;
    if (tutorResults.length > 0) {
        html += `<h5 class="font-semibold mt-4 mb-2">${tutorResults.length} matching tutor(s) found:</h5><ul class="space-y-2 border rounded-lg p-2 mb-4">${tutorResults.map(tutor => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md"><div><p class="font-semibold">${tutor.name} (${tutor.email})</p></div><div class="flex space-x-2"><button class="manage-tutor-from-search-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">Manage</button></div></li>`).join('')}</ul>`;
    }
    if (studentResults.length > 0) {
        html += `<h5 class="font-semibold mt-4 mb-2">${studentResults.length} matching student(s) found:</h5><ul class="space-y-2 border rounded-lg p-2">${studentResults.map(student => { const tutor = tutorsByEmail[student.tutorEmail] || { id: '', name: 'Unassigned' }; return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md"><div><p class="font-semibold">${student.studentName} (Parent: ${student.parentName || 'N/A'})</p><p class="text-sm text-gray-600">Assigned to: ${tutor.name}</p></div><button class="manage-tutor-from-search-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">Manage Tutor</button></li>` }).join('')}</ul>`;
    }
    searchResultsContainer.innerHTML = (studentResults.length || tutorResults.length) ? html : `<p class="text-gray-500">No matches found.</p>`;
    searchResultsContainer.querySelectorAll('.manage-tutor-from-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tutorId = e.currentTarget.dataset.tutorId;
            if (tutorId) {
                activeTutorId = tutorId;
                tutorSelect.value = tutorId;
                renderSelectedTutorDetailsFromCache(tutorId);
      
                 document.getElementById('global-search-bar').value = '';
                searchResultsContainer.innerHTML = '';
                tutorManagementArea.style.display = 'block';
            }
        });
    });
}

function resetStudentForm() {
    const form = document.querySelector('.add-student-form');
    if (!form) return;
    form.querySelector('#new-parent-name').value = '';
    form.querySelector('#new-parent-phone').value = '';
    form.querySelector('#new-student-name').value = '';
    form.querySelector('#new-student-grade').value = '';
    form.querySelector('#new-student-subjects').value = '';
    form.querySelector('#new-student-days').value = '';
    form.querySelector('#new-student-fee').value = '';

    const actionButton = form.querySelector('#add-student-btn');
    if (actionButton) {
        actionButton.textContent = 'Add Student';
        delete actionButton.dataset.editingId;
    }
    const cancelButton = form.querySelector('#cancel-edit-btn');
    if (cancelButton) {
        cancelButton.remove();
    }
}

function renderSelectedTutorDetailsFromCache(tutorId) {
    const container = document.getElementById('selected-tutor-details');
    if (!tutorId || !sessionCache.tutors) {
        container.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        return;
    }
    const tutor = sessionCache.tutors[tutorId];
    const assignedStudents = (sessionCache.students || []).filter(s => s.tutorEmail === tutor.email);
    const studentsListHTML = assignedStudents.map(student => {
        const feeDisplay = globalSettings.showStudentFees ? ` - Fee: ₦${(student.studentFee || 0).toLocaleString()}` : '';
        const editDeleteButtons = `
            <button class="edit-student-btn text-blue-500 hover:text-blue-700 font-semibold" data-student-id="${student.id}" data-parent-name="${student.parentName || ''}" data-parent-phone="${student.parentPhone || ''}" data-student-name="${student.studentName}" data-grade="${student.grade}" data-subjects="${(student.subjects || []).join(', ')}" data-days="${student.days}" data-fee="${student.studentFee}">Edit</button>
            <button class="delete-student-btn text-red-500 hover:text-red-700 font-semibold" data-student-id="${student.id}">Delete</button>
        `;
        return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md" data-student-name="${student.studentName.toLowerCase()}"><span>${student.studentName} (${student.grade || 'N/A'})${feeDisplay}</span><div class="flex items-center space-x-2">${editDeleteButtons}</div></li>`;
    }).join('');
    const gradeOptions = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    const dayOptions = Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    container.innerHTML = `
        <div class="p-4 border rounded-lg shadow-sm bg-blue-50">
            <div class="flex items-center justify-between mb-4">
                <div><h4 class="font-bold text-xl">${tutor.name} (${assignedStudents.length} students)</h4><p class="text-gray-600">${tutor.email}</p></div>
                <div class="flex items-center space-x-4"><label class="flex items-center space-x-2"><span class="font-semibold">Management Staff:</span><input type="checkbox" id="management-staff-toggle" class="h-5 w-5" ${tutor.isManagementStaff ? 'checked' : ''}></label><button id="delete-tutor-btn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Delete Tutor</button></div>
            </div>
            <div class="mb-4"><p><strong>Students Assigned to ${tutor.name}:</strong></p><input type="search" id="student-filter-bar" placeholder="Filter this list..." class="w-full p-2 border rounded mt-2 mb-2"><ul id="students-list-ul" class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                <div class="add-student-form space-y-2">
                    <h5 class="font-semibold text-gray-700">Add/Edit Student Details:</h5>
                    <input type="text" id="new-parent-name" class="w-full p-2 border rounded" placeholder="Parent Name">
                    <input type="text" id="new-parent-phone" class="w-full p-2 border rounded" placeholder="Parent Phone Number">
                    <input type="text" id="new-student-name" class="w-full p-2 border rounded" placeholder="Student Name">
                    <select id="new-student-grade" class="w-full p-2 border rounded"><option value="">Select Grade</option>${gradeOptions}</select>
                    <input type="text" id="new-student-subjects" class="w-full p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">
                    <select id="new-student-days" class="w-full p-2 border rounded"><option value="">Select Days per Week</option>${dayOptions}</select>
                    <input type="number" id="new-student-fee" class="w-full p-2 border rounded" placeholder="Student Fee (₦)">
                    <button id="add-student-btn" class="bg-green-600 text-white w-full px-4 py-2 rounded hover:bg-green-700">Add Student</button>
                </div>
 
                 <div class="import-students-form">
                    <h5 class="font-semibold text-gray-700">Import Students for ${tutor.name}:</h5>
                    <p class="text-xs text-gray-500 mb-2">Upload a .csv or .xlsx file with columns: <strong>parentName, parentPhone, studentName, grade, subjects, days, studentFee</strong></p>
                    <input type="file" id="student-import-file" class="w-full text-sm border rounded p-1" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
           
                  <button id="import-students-btn" class="bg-blue-600 text-white w-full px-4 py-2 rounded mt-2 hover:bg-blue-700">Import Students</button>
                  <p id="import-status" class="text-sm mt-2"></p>
                </div>
            </div>
        </div>`;
    // --- Attach Listeners for the newly created elements ---
    document.getElementById('management-staff-toggle').addEventListener('change', (e) => updateDoc(doc(db, "tutors", tutorId), { isManagementStaff: e.target.checked }));
    document.getElementById('delete-tutor-btn').addEventListener('click', async () => {
        if (assignedStudents.length > 0) {
            alert(`Cannot delete tutor "${tutor.name}" because they have ${assignedStudents.length} student(s) assigned. Please reassign or delete these students first.`);
            return;
        }
        if (confirm(`Are you sure you want to delete tutor "${tutor.name}"? This action cannot be undone.`)) {
            try {
                await deleteDoc(doc(db, "tutors", tutorId));
                alert(`Tutor "${tutor.name}" has been successfully deleted.`);
                invalidateCache('tutors'); // Invalidate
                activeTutorId = null;
                fetchTutorManagementData();
      
             } catch (error) { console.error("Error deleting tutor:", error); alert(`Error deleting tutor: ${error.message}`); }
        }
    });
    document.getElementById('student-filter-bar').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#students-list-ul li').forEach(li => {
            li.style.display = (li.dataset.studentName || '').includes(searchTerm) ? 'flex' : 'none';
        });
    });
    document.getElementById('add-student-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const editingId = btn.dataset.editingId;
        const studentData = {
            parentName: document.getElementById('new-parent-name').value,
            parentPhone: document.getElementById('new-parent-phone').value,
            studentName: document.getElementById('new-student-name').value,
            grade: document.getElementById('new-student-grade').value,
            subjects: document.getElementById('new-student-subjects').value.split(',').map(s => s.trim()),
            days: document.getElementById('new-student-days').value,
            studentFee: parseFloat(document.getElementById('new-student-fee').value),
            tutorEmail: tutor.email,
        };
      
         if (studentData.studentName && studentData.grade && !isNaN(studentData.studentFee)) {
            if (editingId) {
                await updateDoc(doc(db, "students", editingId), studentData);
            } else {
                studentData.summerBreak = false;
                await addDoc(collection(db, "students"), studentData);
            }
            invalidateCache('students'); // Invalidate
            fetchTutorManagementData(); // Refetch and re-render
            resetStudentForm();
        } else {
            alert('Please fill in Student Name, Grade, and Fee correctly.');
        }
    });

    document.getElementById('import-students-btn').addEventListener('click', () => handleStudentImport(tutor));

    container.querySelectorAll('.edit-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const data = e.currentTarget.dataset;
            document.getElementById('new-parent-name').value = data.parentName;
            document.getElementById('new-parent-phone').value = data.parentPhone || '';
            document.getElementById('new-student-name').value = data.studentName;
            document.getElementById('new-student-grade').value = data.grade;
            document.getElementById('new-student-subjects').value = data.subjects;
       
             document.getElementById('new-student-days').value = data.days;
            document.getElementById('new-student-fee').value = data.fee;

            const actionButton = document.getElementById('add-student-btn');
            actionButton.textContent = 'Update Student';
            actionButton.dataset.editingId = data.studentId;

            if (!document.getElementById('cancel-edit-btn')) {
                const cancelButton = document.createElement('button');
  
                 cancelButton.id = 'cancel-edit-btn';
                cancelButton.textContent = 'Cancel Edit';
                cancelButton.className = 'bg-gray-500 text-white w-full px-4 py-2 rounded hover:bg-gray-600 mt-2';
                actionButton.insertAdjacentElement('afterend', cancelButton);
                cancelButton.addEventListener('click', resetStudentForm);
            }
        });
    });
    container.querySelectorAll('.delete-student-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if (confirm('Are you sure you want to delete this student?')) {
            await deleteDoc(doc(db, "students", e.target.dataset.studentId));
            invalidateCache('students'); // Invalidate
            fetchTutorManagementData(); // Refetch and re-render
        }
    }));
}

async function handleStudentImport(tutor) {
    const fileInput = document.getElementById('student-import-file');
    const statusEl = document.getElementById('import-status');
    if (!fileInput.files[0]) return statusEl.textContent = "Please select a file first.";
    if (!tutor) return statusEl.textContent = "Error: No tutor selected.";
    statusEl.textContent = "Reading file...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            if (json.length === 0) throw new Error("Sheet is empty or format is incorrect.");
            statusEl.textContent = `Importing ${json.length} students...`;
            const batch = writeBatch(db);
            json.forEach(row => {
                const studentDocRef = doc(collection(db, "students"));
                const studentData = {
                    parentName: row['parentName'] || '',
    parentPhone: row['parentPhone'] || '',
    studentName: row['studentName'],
    grade: row['grade'],
    subjects: (row['subjects'] || '').toString().split(',').map(s => s.trim()), 
    days: row['days'],
    studentFee: parseFloat(row['studentFee']),
    tutorEmail: tutor.email,
    summerBreak: false
                };
                if (!studentData.studentName || isNaN(studentData.studentFee)) return;
                batch.set(studentDocRef, studentData);
            });
            await batch.commit();
            statusEl.textContent = `✅ Successfully imported ${json.length} students for ${tutor.name}.`;
            fileInput.value = '';
            invalidateCache('students'); // Invalidate
            fetchTutorManagementData();
        } catch (error) {
            statusEl.textContent = `❌ Error: ${error.message}`;
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ##################################################################
// # SECTION 4: TUTOR REPORTS PANEL (OPTIMIZED)
// ##################################################################
async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <div class="flex justify-between items-start mb-4">
                 <h2 class="text-2xl font-bold text-green-700">Tutor Reports</h2>
                 <div class="flex items-center space-x-4">
     
                     <div class="bg-blue-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-blue-800 text-sm">Tutors Submitted</h4><p id="report-tutor-count" class="text-2xl text-blue-600 font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Reports</h4><p id="report-count" class="text-2xl text-green-600 font-extrabold">0</p></div>
                    <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            
             </div>
            </div>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-gray-500 text-center">Loading reports...</p></div>
        </div>
    `;
    document.getElementById('refresh-reports-btn').addEventListener('click', () => fetchAndRenderTutorReports(true));
    fetchAndRenderTutorReports();
}

async function fetchAndRenderTutorReports(forceRefresh = false) {
    if (forceRefresh) invalidateCache('reports');
    try {
        if (!sessionCache.reports) {
            document.getElementById('tutor-reports-list').innerHTML = `<p class="text-gray-500 text-center">Fetching reports from server...</p>`;
            const snapshot = await getDocs(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")));
            saveToLocalStorage('reports', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderTutorReportsFromCache();
    } catch (error) {
        console.error("Error fetching reports:", error);
        document.getElementById('tutor-reports-list').innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}

function renderTutorReportsFromCache() {
    const reportsListContainer = document.getElementById('tutor-reports-list');
    const reports = sessionCache.reports || [];
    const tutorCountEl = document.getElementById('report-tutor-count');
    const reportCountEl = document.getElementById('report-count');
    if (reports.length === 0) {
        reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">No reports have been submitted yet.</p>`;
        tutorCountEl.textContent = 0;
        reportCountEl.textContent = 0;
        return;
    }

    const reportsByTutor = {};
    reports.forEach(report => {
        const tutorEmail = report.tutorEmail;
        if (!reportsByTutor[tutorEmail]) {
            reportsByTutor[tutorEmail] = { name: report.tutorName || tutorEmail, reports: [] };
        }
        reportsByTutor[tutorEmail].reports.push(report);
    });
    tutorCountEl.textContent = Object.keys(reportsByTutor).length;
    reportCountEl.textContent = reports.length;

    reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
        const reportLinks = tutorData.reports.map(report => `
            <li class="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                <span>${report.studentName} - ${new Date(report.submittedAt.seconds * 1000).toLocaleDateString()}</span>
                <button class="download-single-report-btn bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600" data-report-id="${report.id}">Download PDF</button>
            
             </li>
        `).join('');
        return `
            <div class="border rounded-lg shadow-sm">
                <details>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                        <div>${tutorData.name} 
                         <span class="ml-2 text-sm font-normal text-gray-500">(${tutorData.reports.length} reports)</span></div>
                        <button class="download-all-btn bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Download All as ZIP</button>
                    </summary>
                    <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
                </details>
 
             </div>
        `;
    }).join('');

    reportsListContainer.querySelectorAll('.download-single-report-btn').forEach(button => {
        button.addEventListener('click', (e) => { e.stopPropagation(); downloadAdminReport(e.target.dataset.reportId); });
    });
    reportsListContainer.querySelectorAll('.download-all-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tutorEmail = e.target.dataset.tutorEmail;
            const reportsToDownload = reportsByTutor[tutorEmail].reports;
            button.textContent = 'Zipping...';
            button.disabled = true;
            try {
   
                 const zip = new JSZip();
                for (const report of reportsToDownload) {
                    const pdfBlob = await downloadAdminReport(report.id, true); 
                    if (pdfBlob) {
              
                         const fileName = `${report.studentName}_${new Date(report.submittedAt.seconds * 1000).toLocaleDateString().replace(/\//g, '-')}.pdf`;
                        zip.file(fileName, pdfBlob);
                    }
                }
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `${reportsByTutor[tutorEmail].name}_Reports.zip`);
            } catch (error) { console.error("Error creating ZIP file:", error); alert("An error occurred while creating the ZIP file.");
            } finally { button.textContent = 'Download All as ZIP'; button.disabled = false;
            }
        });
    });
}

async function downloadAdminReport(reportId, returnBlob = false) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) throw new Error("Report not found!");
        const reportData = reportDoc.data();
        let parentEmail = 'N/A';
        if (reportData.studentId) {
            const studentDoc = await getDoc(doc(db, "students", reportData.studentId));
            if (studentDoc.exists()) {
                parentEmail = studentDoc.data().parentEmail || 'N/A';
            }
        }
        const logoUrl = "https://github.com/psalminfo/blooming-kids-cbt/blob/main/logo.png";
        const reportTemplate = `<div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;"><div style="text-align: center; margin-bottom: 2rem;"><img src="${logoUrl}" alt="Company Logo" style="height: 80px; margin-bottom: 1rem;"><h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3><h1 style="font-size: 1.2rem; font-weight: bold; color: #166534; margin-top: 0.5rem;">MONTHLY LEARNING REPORT</h1><p style="color: #4b5563;">Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;"><p><strong>Student's Name:</strong> ${reportData.studentName}</p><p><strong>Parent's Email:</strong> ${parentEmail}</p><p><strong>Grade:</strong> ${reportData.grade}</p><p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p></div>${Object.entries({"INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS AND ACHIEVEMENTS": reportData.progress,"STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments}).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}<div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div></div>`;
        const opt = { margin: 0.5, filename: `${reportData.studentName}_report.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        if (returnBlob) {
            return await html2pdf().from(reportTemplate).set(opt).outputPdf('blob');
        } else {
            html2pdf().from(reportTemplate).set(opt).save();
        }
    } 
    catch (error) {
        console.error("Error generating PDF:", error);
        alert(`Failed to download report: ${error.message}`);
        return null; 
    }
}


// ##################################################################
// # SECTION 5: PAY ADVICE PANEL (CORRECTED)
// ##################################################################

async function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
           
             <div class="bg-gray-100 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label for="start-date" class="block text-sm font-medium text-gray-700">Start Date</label><input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md"></div>
                <div><label for="end-date" class="block text-sm font-medium text-gray-700">End Date</label><input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md"></div>
                <div class="flex items-center space-x-4 col-span-2"><div class="bg-blue-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-blue-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl text-blue-600 font-extrabold">0</p></div><div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl text-green-600 font-extrabold">0</p></div><button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button></div>
            </div>
            <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th></tr></thead><tbody id="pay-advice-table-body" class="divide-y divide-gray-200"><tr><td colspan="5" class="text-center py-4">Select a date range.</td></tr></tbody></table></div>
        </div>
    `;
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const handleDateChange = () => {
        const startDate = startDateInput.value ?
        new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading pay data...</td></tr>`;

    try {
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No tutors submitted reports in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            return;
        }

        // ### FIXED SECTION ###
        // Firestore 'in' queries are limited to 30 values. This function fetches tutors by chunking the email list.
        const fetchTutorsInChunks = async (emails) => {
            if (emails.length === 0) return [];
            const chunks = [];
            for (let i = 0; i < emails.length; i += 30) {
                chunks.push(emails.slice(i, i + 30));
            }
            const queryPromises = chunks.map(chunk =>
                getDocs(query(collection(db, "tutors"), where("email", "in", chunk)))
            );
            const querySnapshots = await Promise.all(queryPromises);
            return querySnapshots.flatMap(snapshot => snapshot.docs); // Combine docs from all snapshots
        };

        // Fetch both tutors (in chunks) and all students concurrently.
        const [tutorDocs, studentsSnapshot] = await Promise.all([
            fetchTutorsInChunks(activeTutorEmails),
            getDocs(collection(db, "students"))
        ]);
        // ### END FIXED SECTION ###

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];
        tutorDocs.forEach(doc => { // Iterate over the combined array of tutor documents
            const tutor = doc.data();
            const assignedStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += assignedStudents.length;
            payData.push({ tutorName: tutor.name, studentCount: assignedStudents.length, totalStudentFees: totalStudentFees, managementFee: managementFee, totalPay: totalStudentFees + managementFee });
        });

        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        tableBody.innerHTML = payData.map(d => `<tr><td class="px-6 py-4">${d.tutorName}</td><td class="px-6 py-4">${d.studentCount}</td><td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td><td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td><td class="px-6 py-4 font-bold">₦${d.totalPay.toFixed(2)}</td></tr>`).join('');
        
        document.getElementById('export-pay-csv-btn').onclick = () => {
            const csv = convertPayAdviceToCSV(payData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Pay_Advice_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;
            link.click();
        };
    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load pay data. Check console.</td></tr>`;
    }
}


// ##################################################################
// # SECTION 6: SUMMER BREAK PANEL (OPTIMIZED)
// ##################################################################
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
        
             </div>
            <div id="break-students-list" class="space-y-4"><p class="text-gray-500 text-center">Loading students...</p></div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) invalidateCache('breakStudents');
    try {
        if (!sessionCache.breakStudents) {
            document.getElementById('break-students-list').innerHTML = `<p class="text-gray-500 text-center">Fetching data...</p>`;
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            saveToLocalStorage('breakStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderBreakStudentsFromCache();
    } catch(error) {
        console.error("Error fetching summer break students:", error);
        document.getElementById('break-students-list').innerHTML = `<p class="text-red-500">Failed to load data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const listContainer = document.getElementById('break-students-list');
    const breakStudents = sessionCache.breakStudents || [];

    if (breakStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500 text-center">No students are on break.</p>`;
        return;
    }
    listContainer.innerHTML = breakStudents.map(student => {
        return `<div class="border p-4 rounded-lg flex justify-between items-center"><div><p><strong>Student:</strong> ${student.studentName}</p><p><strong>Tutor:</strong> ${student.tutorEmail}</p></div><button class="remove-break-btn bg-yellow-600 text-white px-4 py-2 rounded" data-student-id="${student.id}">End Break</button></div>`;
    }).join('');
    listContainer.querySelectorAll('.remove-break-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        await updateDoc(doc(db, "students", e.target.dataset.studentId), { summerBreak: false });
        invalidateCache('students'); // Invalidate main student list
        invalidateCache('breakStudents'); // Invalidate this list
        fetchAndRenderBreakStudents(); // Re-fetch and re-render this panel
    }));
}

// ##################################################################
// # SECTION 7: STAFF PANEL (OPTIMIZED)
// ##################################################################
async function renderStaffPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Staff Management</h2>
                <button id="refresh-staff-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            
             </div>
            <p class="text-sm text-gray-600 mb-4">Assign a role to apply default permissions, then click "Manage Permissions" to customize.</p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium uppercase">Name</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Email</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Assign Role</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th></tr></thead><tbody id="staff-table-body" class="bg-white divide-y divide-gray-200"><p>Loading staff...</p></tbody></table>
          
             </div>
        </div>
    `;
    document.getElementById('refresh-staff-btn').addEventListener('click', () => fetchAndRenderStaff(true));
    fetchAndRenderStaff();
}

async function fetchAndRenderStaff(forceRefresh = false) {
    if (forceRefresh) invalidateCache('staff');
    try {
        if (!sessionCache.staff) {
            document.getElementById('staff-table-body').innerHTML = `<tr><td colspan="4" class="text-center p-4">Fetching staff data...</td></tr>`;
            const snapshot = await getDocs(collection(db, "staff"));
            saveToLocalStorage('staff', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderStaffFromCache();
    } catch(error) {
        console.error("Error fetching staff:", error);
        document.getElementById('staff-table-body').innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-500">Failed to load staff data.</td></tr>`;
    }
}

function renderStaffFromCache() {
    const tableBody = document.getElementById('staff-table-body');
    const staffList = sessionCache.staff || [];
    const ROLE_PERMISSIONS = {
        pending: {}, tutor: {}, manager: {}, director: {}, admin: {}
    };
    tableBody.innerHTML = staffList.map(staff => {
        const optionsHTML = Object.keys(ROLE_PERMISSIONS).map(role => `<option value="${role}" ${staff.role === role ? 'selected' : ''}>${capitalize(role)}</option>`).join('');
        return `
            <tr>
                <td class="px-6 py-4 font-medium">${staff.name}</td><td class="px-6 py-4">${staff.email}</td>
                <td class="px-6 py-4"><select data-email="${staff.email}" data-original-role="${staff.role}" class="role-select p-2 border rounded bg-white">${optionsHTML}</select></td>
        
                 <td class="px-6 py-4"><button data-id="${staff.id}" class="manage-permissions-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Manage Permissions</button></td>
            </tr>
        `;
    }).join('');
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            if (confirm(`Change role to "${capitalize(e.target.value)}"? This will apply default permissions.`)) {
                await updateStaffPermissions(e.target.dataset.email, e.target.value);
            } else {
                e.target.value = e.target.dataset.originalRole;
            }
  
             });
    });
    document.querySelectorAll('.manage-permissions-btn').forEach(button => {
        button.addEventListener('click', (e) => openPermissionsModal(e.target.dataset.id));
    });
}

async function openPermissionsModal(staffId) {
    const staffDoc = await getDoc(doc(db, "staff", staffId));
    if (!staffDoc.exists()) return alert("Staff member not found.");
    const staffData = staffDoc.data();
    const permissions = staffData.permissions || { tabs: {}, actions: {} };
    const modalHTML = `
        <div id="permissions-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
                <h3 class="text-2xl font-bold mb-4">Edit Permissions for ${staffData.name}</h3><p class="text-sm text-gray-500 mb-4">Current Role: <span class="font-semibold">${capitalize(staffData.role)}</span></p>
                <div class="space-y-4"><div class="border-t pt-4"><h4 class="font-semibold mb-2">Tab Visibility:</h4><div class="grid grid-cols-2 gap-2">
   
                     <label class="flex items-center"><input type="checkbox" id="p-viewTutorManagement" class="mr-2" ${permissions.tabs?.viewTutorManagement ? 'checked' : ''}> Tutor & Student List</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewPayAdvice" class="mr-2" ${permissions.tabs?.viewPayAdvice ? 'checked' : ''}> Pay Advice</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewTutorReports" class="mr-2" ${permissions.tabs?.viewTutorReports ? 'checked' : ''}> Tutor Reports</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewSummerBreak" class="mr-2" ${permissions.tabs?.viewSummerBreak ? 'checked' : ''}> Summer Break</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewPendingApprovals" class="mr-2" ${permissions.tabs?.viewPendingApprovals ? 'checked' : ''}> Pending Approvals</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewStaffManagement" class="mr-2" ${permissions.tabs?.viewStaffManagement ? 'checked' : ''}> Staff Management</label>
                    <label class="flex items-center"><input type="checkbox" id="p-viewParentFeedback" class="mr-2" ${permissions.tabs?.viewParentFeedback ? 'checked' : ''}> Parent Feedback</label>
                </div></div><div class="border-t pt-4"><h4 class="font-semibold mb-2">Specific Actions:</h4>
                    <label class="flex items-center"><input type="checkbox" id="p-canDownloadReports" class="mr-2" ${permissions.actions?.canDownloadReports ? 'checked' : ''}> Can Download Reports</label>
                    <label class="flex items-center"><input type="checkbox" id="p-canExportPayAdvice" class="mr-2" ${permissions.actions?.canExportPayAdvice ? 'checked' : ''}> Can Export Pay Advice</label>
                    <label class="flex items-center"><input type="checkbox" id="p-canEndSummerBreak" class="mr-2" ${permissions.actions?.canEndSummerBreak ? 'checked' : ''}> Can End Summer Break</label>
                    <label class="flex items-center"><input type="checkbox" id="p-canEditStudents" class="mr-2" ${permissions.actions?.canEditStudents ? 'checked' : ''}> Can Edit Students</label>
                    <label class="flex items-center"><input type="checkbox" id="p-canDeleteStudents" class="mr-2" ${permissions.actions?.canDeleteStudents ? 'checked' : ''}> Can Delete Students</label>
                </div></div>
                <div class="flex justify-end space-x-4 mt-6"><button id="cancel-permissions" class="bg-gray-300 px-4 py-2 rounded">Cancel</button><button id="save-permissions" class="bg-green-600 text-white px-4 py-2 rounded">Save Changes</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const closeModal = () => document.getElementById('permissions-modal').remove();
    document.getElementById('cancel-permissions').addEventListener('click', closeModal);
    document.getElementById('save-permissions').addEventListener('click', async () => {
        const newPermissions = {
            tabs: { viewTutorManagement: document.getElementById('p-viewTutorManagement').checked, viewPayAdvice: document.getElementById('p-viewPayAdvice').checked, viewTutorReports: document.getElementById('p-viewTutorReports').checked, viewSummerBreak: document.getElementById('p-viewSummerBreak').checked, viewPendingApprovals: document.getElementById('p-viewPendingApprovals').checked, viewStaffManagement: document.getElementById('p-viewStaffManagement').checked, viewParentFeedback: document.getElementById('p-viewParentFeedback').checked },
            actions: { canDownloadReports: document.getElementById('p-canDownloadReports').checked, canExportPayAdvice: document.getElementById('p-canExportPayAdvice').checked, canEndSummerBreak: document.getElementById('p-canEndSummerBreak').checked, canEditStudents: document.getElementById('p-canEditStudents').checked, canDeleteStudents: document.getElementById('p-canDeleteStudents').checked }
        };
        await updateDoc(doc(db, "staff", staffId), { permissions: newPermissions });
        alert("Custom permissions saved successfully!");
        invalidateCache('staff'); // Invalidate
        fetchAndRenderStaff();
        closeModal();
    });
}


// ##################################################################
// # SECTION 8: PENDING APPROVALS (No changes needed)
// ##################################################################
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2><div id="pending-list" class="space-y-4"></div>`;
    const pendingListContainer = document.getElementById('pending-list');
    pendingListContainer.innerHTML = `<p class="text-gray-500">Loading pending accounts...</p>`;
    try {
        const tutorsQuery = query(collection(db, "tutors"), where("status", "==", "pending"));
        const studentsQuery = query(collection(db, "students"), where("approvalStatus", "==", "pending"));
        const [tutorsSnap, studentsSnap] = await Promise.all([getDocs(tutorsQuery), getDocs(studentsQuery)]);
        let pendingHTML = '';
        tutorsSnap.forEach(doc => { const tutor = doc.data(); pendingHTML += `<div class="bg-white p-4 rounded-lg shadow-sm border border-yellow-200"><p class="font-semibold">${tutor.name} (Tutor)</p><p class="text-gray-600 text-sm">${tutor.email}</p><div class="mt-2 space-x-2"><button class="approve-btn bg-green-500 text-white px-3 py-1 rounded" data-id="${doc.id}" data-type="tutor">Approve</button><button class="reject-btn bg-red-500 text-white px-3 py-1 rounded" data-id="${doc.id}" data-type="tutor">Reject</button></div></div>`; });
        studentsSnap.forEach(doc => { const student = doc.data(); pendingHTML += `<div class="bg-white p-4 rounded-lg shadow-sm border border-yellow-200"><p class="font-semibold">${student.studentName} (Student - Grade ${student.grade})</p><p class="text-gray-600 text-sm">Parent: ${student.parentName}</p><div class="mt-2 space-x-2"><button class="approve-btn bg-green-500 text-white px-3 py-1 rounded" data-id="${doc.id}" data-type="student">Approve</button><button class="reject-btn bg-red-500 text-white px-3 py-1 rounded" data-id="${doc.id}" data-type="student">Reject</button></div></div>`; });
        pendingListContainer.innerHTML = pendingHTML || `<p class="text-gray-500">No pending accounts to review.</p>`;
        document.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, btn.dataset.type, 'approved')));
        document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, btn.dataset.type, 'rejected')));
    } catch (error) {
        console.error("Error loading pending approvals:", error);
        pendingListContainer.innerHTML = `<p class="text-red-500">Failed to load pending approvals.</p>`;
    }
}

async function handleApproval(id, type, status) {
    const collectionName = type === 'tutor' ? 'tutors' : 'students';
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, { [type === 'tutor' ? 'status' : 'approvalStatus']: status });
    alert(`${capitalize(type)} ${status} successfully.`);
    // Invalidate caches since a tutor/student was added/removed from circulation
    if (type === 'tutor') invalidateCache('tutors');
    if (type === 'student') invalidateCache('students');
    renderPendingApprovalsPanel(document.getElementById('main-content'));
}

// ##################################################################
// # MAIN APP INITIALIZATION (Unchanged)
// ##################################################################
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        mainContent.innerHTML = '';
        const navItems = {
            navDashboard: renderAdminPanel, navContent: renderContentManagerPanel, navTutorManagement: renderTutorManagementPanel,
            navPayAdvice: renderPayAdvicePanel, navTutorReports: renderTutorReportsPanel, navSummerBreak: renderSummerBreakPanel,
  
             navStaff: renderStaffPanel, navPendingApprovals: renderPendingApprovalsPanel
        };
        const setActiveNav = (activeId) => Object.keys(navItems).forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === activeId);
        });
        Object.entries(navItems).forEach(([id, renderFn]) => {
            const navElement = document.getElementById(id);
            if (navElement) {
                navElement.addEventListener('click', () => { setActiveNav(id); renderFn(mainContent); });
            }
        });
        setActiveNav('navDashboard');
        renderAdminPanel(mainContent);
        logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "admin-auth.html"));
    } else {
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">You do not have permission to view this page.</p>`;
        logoutBtn.classList.add('hidden');
    }
});


// [End Updated admin.js File]



