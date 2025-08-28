import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut, onIdTokenChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
let activeTutorId = null;

// --- Cloudinary Configuration ---
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// --- Utility Functions ---
async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.secure_url;
}

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}


// ##################################################################
// # SECTION 1: DASHBOARD PANEL (Restored to Original)
// ##################################################################

async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4"><label for="topic" class="block text-gray-700">Topic</label><input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required></div>
                    <div class="mb-4">
                        <label for="subject" class="block font-medium text-gray-700">Subject</label>
                        <select id="subject" name="subject" required class="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="" disabled selected>-- Select a Subject --</option>
                            <option value="English">English</option>
                            <option value="Math">Math</option>
                            <optgroup label="Science">
                                <option value="Biology">Biology</option>
                                <option value="Chemistry">Chemistry</option>
                                <option value="Physics">Physics</option>
                            </optgroup>
                        </select>
                    </div>
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

function setupDashboardListeners() {
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

    loadStudentDropdown();
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

async function loadStudentDropdown() {
    const studentDropdown = document.getElementById('studentDropdown');
    const snapshot = await getDocs(collection(db, "student_results"));
    studentDropdown.innerHTML = `<option value="">Select Student</option>`;
    snapshot.forEach(doc => {
        const student = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${capitalize(student.studentName)} (${student.parentEmail})`;
        studentDropdown.appendChild(option);
    });
}

async function loadAndRenderReport(docId) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `<p>Loading report...</p>`;
    try {
        const reportDocSnap = await getDoc(doc(db, "student_results", docId));
        if (!reportDocSnap.exists()) throw new Error("Report not found");
        const data = reportDocSnap.data();

        const tutorName = data.tutorEmail ? (await getDoc(doc(db, "tutors", data.tutorEmail))).data()?.name || 'N/A' : 'N/A';
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
// # SECTION 2: CONTENT MANAGER (FINAL VERSION)
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
                const logMessage = forceReload ? "Force Reload activated. Fetching from GitHub." : "No saved version. Loading template from GitHub.";
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
        if (!e.target.value) { passageContent.value = ''; return; }
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
// # SECTION 3: TUTOR MANAGEMENT (NEW)
// ##################################################################
async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor & Student Management</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Students</h3><p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
                <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Tutors</h3><p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
            </div>
            <div class="flex items-center justify-between space-x-4 mb-4">
                <label class="flex items-center">
                    <span class="text-gray-700 font-semibold">Report Submission Status:</span>
                    <label for="report-toggle" class="relative inline-flex items-center cursor-pointer ml-4">
                        <input type="checkbox" id="report-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span id="report-status-label" class="ml-3 text-sm font-medium text-gray-500">Disabled</span>
                    </label>
                </label>
            </div>
             <div class="mb-4">
                <h3 class="font-bold text-lg mb-2">Configure Emails</h3>
                <label for="report-email" class="block text-gray-700">Report Recipient Emails (comma-separated)</label>
                <input type="text" id="report-email" class="w-full mt-1 p-2 border rounded" placeholder="e.g., admin@example.com, accounting@example.com">
                 <label for="pay-email" class="block text-gray-700 mt-4">Pay Advice Recipient Emails (comma-separated)</label>
                <input type="text" id="pay-email" class="w-full mt-1 p-2 border rounded" placeholder="e.g., admin@example.com, hr@example.com">
                <button id="save-emails-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700">Save Emails</button>
            </div>
            <div class="mb-4">
                <h3 class="font-bold text-lg mb-2">Import Students (Google Sheet)</h3>
                <input type="file" id="importStudentsFile" class="w-full mt-1 p-2 border rounded" accept=".xlsx, .xls">
                <button id="importStudentsBtn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Import</button>
                <p id="import-status" class="mt-2 text-sm"></p>
            </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md">
            <h3 class="text-2xl font-bold text-green-700 mb-4">Manage Tutors</h3>
            <div class="mb-4">
                <label for="tutor-select" class="block font-semibold">Select Tutor:</label>
                <select id="tutor-select" class="w-full p-2 border rounded mt-1"></select>
            </div>
            <div id="selected-tutor-details" class="mt-4">
                <p class="text-gray-500">Please select a tutor to view details.</p>
            </div>
        </div>
    `;
    setupTutorManagementListeners();
}

async function setupTutorManagementListeners() {
    const reportToggle = document.getElementById('report-toggle');
    const reportStatusLabel = document.getElementById('report-status-label');
    const tutorSelect = document.getElementById('tutor-select');
    const selectedTutorDetails = document.getElementById('selected-tutor-details');
    const saveEmailsBtn = document.getElementById('save-emails-btn');
    const reportEmailInput = document.getElementById('report-email');
    const payEmailInput = document.getElementById('pay-email');
    const totalTutorsCount = document.getElementById('totalTutorsCount');
    const totalStudentsCount = document.getElementById('totalStudentsCount');

    // Listen to the settings document for real-time updates
    const settingsDocRef = doc(db, "settings", "report_submission");
    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isEnabled = data.enabled;
            reportToggle.checked = isEnabled;
            reportStatusLabel.textContent = isEnabled ? 'Enabled' : 'Disabled';
            reportStatusLabel.classList.toggle('text-green-600', isEnabled);
            reportStatusLabel.classList.toggle('text-gray-500', !isEnabled);

            reportEmailInput.value = data.reportEmails ? data.reportEmails.join(', ') : '';
            payEmailInput.value = data.payEmails ? data.payEmails.join(', ') : '';
        } else {
            setDoc(settingsDocRef, { enabled: false, reportEmails: [], payEmails: [] });
        }
    });

    // Toggle listener
    reportToggle.addEventListener('change', async (e) => {
        await updateDoc(settingsDocRef, { enabled: e.target.checked });
    });

    // Save Emails Listener
    saveEmailsBtn.addEventListener('click', async () => {
        const reportEmails = reportEmailInput.value.split(',').map(email => email.trim()).filter(email => email);
        const payEmails = payEmailInput.value.split(',').map(email => email.trim()).filter(email => email);
        await updateDoc(settingsDocRef, { reportEmails, payEmails });
        alert('Emails saved successfully!');
    });

    // Listen to the tutors collection for real-time updates to counts
    onSnapshot(collection(db, "tutors"), (querySnapshot) => {
        const totalTutors = querySnapshot.docs.length;
        totalTutorsCount.textContent = totalTutors;
    });

    // Listen to the students collection for real-time updates to counts
    onSnapshot(collection(db, "students"), (querySnapshot) => {
        const totalStudents = querySnapshot.docs.length;
        totalStudentsCount.textContent = totalStudents;
    });


    // Load tutors into the dropdown
    const tutorsSnapshot = await getDocs(collection(db, "tutors"));
    tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
    const tutorsData = {};
    tutorsSnapshot.forEach(doc => {
        const tutor = doc.data();
        tutorsData[doc.id] = tutor;
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = tutor.name;
        tutorSelect.appendChild(option);
    });

    tutorSelect.addEventListener('change', async (e) => {
        activeTutorId = e.target.value;
        if (!activeTutorId) {
            selectedTutorDetails.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
            return;
        }
        await renderSelectedTutorDetails(activeTutorId, tutorsData);
    });

    async function renderSelectedTutorDetails(tutorId, allTutorsData) {
        const tutor = allTutorsData[tutorId];
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsListHTML = studentsSnapshot.docs.map(studentDoc => {
            const student = studentDoc.data();
            return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span>${student.studentName} (${student.subjects.join(', ')}) - Fee: $${student.studentFee}</span>
                        <div class="flex space-x-2">
                             <button class="remove-student-btn text-red-500 hover:text-red-700" data-student-id="${studentDoc.id}">Remove</button>
                        </div>
                    </li>`;
        }).join('');

        selectedTutorDetails.innerHTML = `
            <div class="p-4 border rounded-lg shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-xl">${tutor.name} (${studentsSnapshot.docs.length} students)</h4>
                    <label class="flex items-center space-x-2">
                        <span>Management Staff:</span>
                        <input type="checkbox" id="management-staff-toggle" data-tutor-id="${tutorId}" class="h-5 w-5 rounded text-blue-600 focus:ring-blue-500" ${tutor.isManagementStaff ? 'checked' : ''}>
                    </label>
                </div>
                <div class="mb-4">
                     <p><strong>Students:</strong></p>
                     <ul class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul>
                </div>
                <div class="add-student-form border-t pt-4">
                    <h5 class="font-semibold text-gray-700 mb-2">Add New Student:</h5>
                    <input type="text" class="new-student-name w-full mt-1 p-2 border rounded" placeholder="Student Name">
                    <input type="text" class="new-student-grade w-full mt-1 p-2 border rounded" placeholder="Grade">
                    <input type="text" class="new-student-subject w-full mt-1 p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">
                    <input type="text" class="new-student-days w-full mt-1 p-2 border rounded" placeholder="Days of Class (e.g., M-W-F)">
                    <input type="number" class="new-student-fee w-full mt-1 p-2 border rounded" placeholder="Student Fee">
                    <button class="add-student-btn bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700" data-tutor-email="${tutor.email}">Add Student</button>
                </div>
            </div>
        `;
        document.getElementById('management-staff-toggle').addEventListener('change', async (e) => {
            const tutorDocRef = doc(db, "tutors", tutorId);
            await updateDoc(tutorDocRef, { isManagementStaff: e.target.checked });
        });
        document.querySelectorAll('.add-student-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const tutorEmail = e.target.getAttribute('data-tutor-email');
                const formContainer = e.target.closest('.add-student-form');
                const studentName = formContainer.querySelector('.new-student-name').value;
                const studentGrade = formContainer.querySelector('.new-student-grade').value;
                const subjects = formContainer.querySelector('.new-student-subject').value.split(',').map(s => s.trim());
                const days = formContainer.querySelector('.new-student-days').value;
                const studentFee = parseFloat(formContainer.querySelector('.new-student-fee').value);
                if (studentName && studentGrade && subjects.length && days && !isNaN(studentFee)) {
                    await addDoc(collection(db, "students"), {
                        studentName, grade: studentGrade, subjects, days, tutorEmail, studentFee
                    });
                    await renderSelectedTutorDetails(tutorId, allTutorsData);
                } else {
                    alert('Please fill in all student details correctly.');
                }
            });
        });
        document.querySelectorAll('.remove-student-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                if (confirm('Are you sure you want to remove this student?')) {
                    await deleteDoc(doc(db, "students", studentId));
                    await renderSelectedTutorDetails(tutorId, allTutorsData);
                }
            });
        });
    }

    onSnapshot(collection(db, "tutors"), async (querySnapshot) => {
        const tutorsData = {};
        tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
        querySnapshot.forEach(doc => {
            const tutor = doc.data();
            tutorsData[doc.id] = tutor;
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = tutor.name;
            tutorSelect.appendChild(option);
        });
        if (activeTutorId && tutorsData[activeTutorId]) {
            tutorSelect.value = activeTutorId;
            await renderSelectedTutorDetails(activeTutorId, tutorsData);
        } else {
            selectedTutorDetails.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        }
    });

    // Placeholder for Google Sheets Import logic
    document.getElementById('importStudentsBtn').addEventListener('click', () => {
        const importStatus = document.getElementById('import-status');
        importStatus.textContent = "Google Sheets import requires a Firebase Cloud Function. This is a placeholder.";
        importStatus.style.color = 'orange';
    });
}


// ##################################################################
// # SECTION 4: AUTHENTICATION & APP INITIALIZATION
// ##################################################################

function initializeAdminPanel() {
    const mainContent = document.getElementById('main-content');
    const navDashboard = document.getElementById('navDashboard');
    const navContent = document.getElementById('navContent');
    const navTutorManagement = document.getElementById('navTutorManagement');

    function setActiveNav(activeButton) {
        navDashboard.classList.remove('active');
        navContent.classList.remove('active');
        navTutorManagement.classList.remove('active');
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderAdminPanel(mainContent); });
    navContent.addEventListener('click', () => { setActiveNav(navContent); renderContentManagerPanel(mainContent); });
    navTutorManagement.addEventListener('click', () => { setActiveNav(navTutorManagement); renderTutorManagementPanel(mainContent); });
    
    renderAdminPanel(mainContent); // Initial render
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
        initializeAdminPanel();
    } else {
        window.location.href = "admin-auth.html";
    }
});