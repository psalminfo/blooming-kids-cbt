import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc, orderBy, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
let activeTutorId = null;

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

// A simple (placeholder) image uploader. You might need a more robust solution.
async function uploadImageToCloudinary(file) {
    // This requires your own Cloudinary setup.
    // For now, it returns a placeholder.
    console.log("Image upload function called for:", file.name);
    return "https://via.placeholder.com/150";
}

// ##################################################################
// # SECTION 1: DASHBOARD PANEL (Restored to original as requested)
// ##################################################################

async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Students</h3><p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Tutors</h3><p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Students Per Tutor</h3><select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select></div>
        </div>
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

    loadCounters();
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

async function loadCounters() {
    const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
        getDocs(collection(db, "student_results")),
        getDocs(collection(db, "tutors"))
    ]);
    document.getElementById('totalStudentsCount').textContent = studentsSnapshot.docs.length;
    document.getElementById('totalTutorsCount').textContent = tutorsSnapshot.docs.length;
    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
    studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
    for (const tutorDoc of tutorsSnapshot.docs) {
        const tutor = tutorDoc.data();
        const studentsQuery = query(collection(db, "student_results"), where("tutorEmail", "==", tutor.email));
        const studentsUnderTutor = await getDocs(studentsQuery);
        const option = document.createElement('option');
        option.textContent = `${tutor.name} (${studentsUnderTutor.docs.length} students)`;
        studentsPerTutorSelect.appendChild(option);
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

        const tutorName = data.tutorEmail ? (await getDoc(doc(db, "tutors", data.tutorEmail))).data() ?.name || 'N/A' : 'N/A';
        const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
        const tutorReport = creativeWritingAnswer ?.tutorReport || 'No report available.';
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
// # SECTION 2: CONTENT MANAGER (Restored)
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
// # SECTION 3: TUTOR MANAGEMENT (Upgraded)
// ##################################################################

async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Global Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium"></span></label></label>
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
                <label for="tutor-select" class="block font-semibold">Select Tutor:</label>
                <select id="tutor-select" class="w-full p-2 border rounded mt-1"></select>
            </div>
            <div id="selected-tutor-details" class="mt-4"><p class="text-gray-500">Please select a tutor to view details.</p></div>
        </div>
    `;
    setupTutorManagementListeners();
}

async function setupTutorManagementListeners() {
    const settingsDocRef = doc(db, "settings", "global_settings");

    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            ['report', 'tutor-add', 'summer-break'].forEach(type => {
                const key = `is${capitalize(type.split('-')[0])}${capitalize(type.split('-')[1] || '')}Enabled`;
                const toggle = document.getElementById(`${type}-toggle`);
                const label = document.getElementById(`${type}-status-label`);
                if (toggle && label) {
                    toggle.checked = data[key];
                    label.textContent = data[key] ? 'Enabled' : 'Disabled';
                }
            });
        }
    });

    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, {
        isReportEnabled: e.target.checked
    }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, {
        isTutorAddEnabled: e.target.checked
    }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, {
        isSummerBreakEnabled: e.target.checked
    }));

    const tutorSelect = document.getElementById('tutor-select');
    tutorSelect.addEventListener('change', e => {
        activeTutorId = e.target.value;
        renderSelectedTutorDetails(activeTutorId);
    });

    // ### NEW ### Real-time counter updates
    onSnapshot(collection(db, "tutors"), (snapshot) => {
        const badge = document.getElementById('tutor-count-badge');
        if (badge) badge.textContent = snapshot.size;
    });
    onSnapshot(collection(db, "students"), (snapshot) => {
        const badge = document.getElementById('student-count-badge');
        if (badge) badge.textContent = snapshot.size;
    });

    onSnapshot(collection(db, "tutors"), (snapshot) => {
        const tutorsData = {};
        let currentSelection = tutorSelect.value;
        tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
        snapshot.forEach(doc => {
            tutorsData[doc.id] = {
                id: doc.id,
                ...doc.data()
            };
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            tutorSelect.appendChild(option);
        });
        window.allTutorsData = tutorsData;
        if (activeTutorId && tutorsData[activeTutorId]) {
            tutorSelect.value = activeTutorId;
        }
    });
}

// ### UPDATED ### With full student form and CSV/Excel import
async function renderSelectedTutorDetails(tutorId) {
    const container = document.getElementById('selected-tutor-details');
    if (!tutorId || !window.allTutorsData) {
        container.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        return;
    }
    const tutor = window.allTutorsData[tutorId];

    onSnapshot(query(collection(db, "students"), where("tutorEmail", "==", tutor.email)), (studentsSnapshot) => {
        const studentsListHTML = studentsSnapshot.docs.map(doc => {
            const student = doc.data();
            return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span>${student.studentName} (Grade ${student.grade}) - Fee: ₦${student.studentFee}</span>
                        <button class="remove-student-btn text-red-500 hover:text-red-700" data-student-id="${doc.id}">Remove</button>
                    </li>`;
        }).join('');

        const gradeOptions = Array.from({
            length: 12
        }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
        const dayOptions = Array.from({
            length: 7
        }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');

        container.innerHTML = `
            <div class="p-4 border rounded-lg shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-xl">${tutor.name} (${studentsSnapshot.size} students)</h4>
                    <label class="flex items-center space-x-2">
                        <span class="font-semibold">Management Staff:</span>
                        <input type="checkbox" id="management-staff-toggle" class="h-5 w-5" ${tutor.isManagementStaff ? 'checked' : ''}>
                    </label>
                </div>

                <div class="mb-4">
                    <p><strong>Students:</strong></p>
                    <ul class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                    <div class="add-student-form space-y-2">
                        <h5 class="font-semibold text-gray-700">Add New Student Manually:</h5>
                        <input type="text" id="new-student-name" class="w-full p-2 border rounded" placeholder="Parent Name">
                        <input type="text" id="new-student-name" class="w-full p-2 border rounded" placeholder="Student Name">
                        <select id="new-student-grade" class="w-full p-2 border rounded"><option value="">Select Grade</option>${gradeOptions}</select>
                        <input type="text" id="new-student-subject" class="w-full p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">
                        <select id="new-student-days" class="w-full p-2 border rounded"><option value="">Select Days per Week</option>${dayOptions}</select>
                        <input type="number" id="new-student-fee" class="w-full p-2 border rounded" placeholder="Student Fee (₦)">
                        <button id="add-student-btn" class="bg-green-600 text-white w-full px-4 py-2 rounded hover:bg-green-700">Add Student</button>
                    </div>

                    <div class="import-students-form">
                         <h5 class="font-semibold text-gray-700">Import Students from File:</h5>
                         <p class="text-xs text-gray-500 mb-2">Upload a .csv or .xlsx file with columns: <strong>Student Name, Grade, Subjects, Days, Fee</strong></p>
                         <input type="file" id="student-import-file" class="w-full text-sm border rounded p-1" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
                         <button id="import-students-btn" class="bg-blue-600 text-white w-full px-4 py-2 rounded mt-2 hover:bg-blue-700">Import Students</button>
                         <p id="import-status" class="text-sm mt-2"></p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('management-staff-toggle').addEventListener('change', async (e) => {
            await updateDoc(doc(db, "tutors", tutorId), {
                isManagementStaff: e.target.checked
            });
        });

        document.getElementById('add-student-btn').addEventListener('click', async () => {
            const studentData = {
                studentName: document.getElementById('new-student-name').value,
                grade: document.getElementById('new-student-grade').value,
                subjects: document.getElementById('new-student-subject').value.split(',').map(s => s.trim()),
                days: document.getElementById('new-student-days').value,
                studentFee: parseFloat(document.getElementById('new-student-fee').value),
                tutorEmail: tutor.email,
                summerBreak: false
            };
            if (studentData.studentName && studentData.grade && !isNaN(studentData.studentFee)) {
                await addDoc(collection(db, "students"), studentData);
            } else {
                alert('Please fill in all details correctly.');
            }
        });

        document.getElementById('import-students-btn').addEventListener('click', handleStudentImport);

        container.querySelectorAll('.remove-student-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('Are you sure?')) await deleteDoc(doc(db, "students", e.target.dataset.studentId));
        }));
    });
}

async function handleStudentImport() {
    const fileInput = document.getElementById('student-import-file');
    const statusEl = document.getElementById('import-status');
    const tutor = window.allTutorsData[activeTutorId];
    if (!fileInput.files[0]) return statusEl.textContent = "Please select a file first.";
    if (!tutor) return statusEl.textContent = "Error: No tutor selected.";

    statusEl.textContent = "Reading file...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {
                type: 'array'
            });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0) throw new Error("Sheet is empty or format is incorrect.");

            statusEl.textContent = `Importing ${json.length} students...`;
            const batch = writeBatch(db);
            json.forEach(row => {
                const studentDocRef = doc(collection(db, "students"));
                const studentData = {
                    studentName: row['Student Name'],
                    grade: row['Grade'],
                    subjects: (row['Subjects'] || '').toString().split(',').map(s => s.trim()),
                    days: row['Days'],
                    studentFee: parseFloat(row['Fee']),
                    tutorEmail: tutor.email,
                    summerBreak: false
                };
                if (!studentData.studentName || isNaN(studentData.studentFee)) return; // Skip invalid rows
                batch.set(studentDocRef, studentData);
            });
            await batch.commit();
            statusEl.textContent = `✅ Successfully imported ${json.length} students for ${tutor.name}.`;
            fileInput.value = ''; // Clear file input
        } catch (error) {
            statusEl.textContent = `❌ Error: ${error.message}`;
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}


// ##################################################################
// # SECTION 4: TUTOR REPORTS PANEL (Upgraded)
// ##################################################################

async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <div class="flex justify-between items-start mb-4">
                 <h2 class="text-2xl font-bold text-green-700">Tutor Reports</h2>
                 <div class="flex space-x-4">
                    <div class="bg-blue-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-blue-800 text-sm">Tutors Submitted</h4><p id="report-tutor-count" class="text-2xl text-blue-600 font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Reports</h4><p id="report-count" class="text-2xl text-green-600 font-extrabold">0</p></div>
                </div>
            </div>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-gray-500 text-center">Loading reports...</p></div>
        </div>
    `;
    await loadTutorReportsForAdmin();
}

// ### NEW ### This function now groups reports by tutor with dropdowns and a "Download All" button.
async function loadTutorReportsForAdmin() {
    const reportsListContainer = document.getElementById('tutor-reports-list');
    onSnapshot(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")), (snapshot) => {
        const tutorCountEl = document.getElementById('report-tutor-count');
        const reportCountEl = document.getElementById('report-count');
        if (!tutorCountEl || !reportCountEl) return;

        if (snapshot.empty) {
            reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">No reports have been submitted yet.</p>`;
            tutorCountEl.textContent = 0;
            reportCountEl.textContent = 0;
            return;
        }

        const reportsByTutor = {};
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            const tutorEmail = report.tutorEmail;
            if (!reportsByTutor[tutorEmail]) {
                reportsByTutor[tutorEmail] = {
                    name: report.tutorName || tutorEmail,
                    reports: []
                };
            }
            reportsByTutor[tutorEmail].reports.push(report);
        });

        tutorCountEl.textContent = Object.keys(reportsByTutor).length;
        reportCountEl.textContent = snapshot.size;

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
                            <div>
                                ${tutorData.name} 
                                <span class="ml-2 text-sm font-normal text-gray-500">(${tutorData.reports.length} reports)</span>
                            </div>
                            <button class="download-all-btn bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Download All as ZIP</button>
                        </summary>
                        <div class="p-4 border-t">
                            <ul class="space-y-2">${reportLinks}</ul>
                        </div>
                    </details>
                </div>
            `;
        }).join('');

        reportsListContainer.querySelectorAll('.download-single-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the dropdown from closing
                downloadAdminReport(e.target.dataset.reportId);
            });
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
                        // The 'true' argument tells the function to return the PDF data instead of saving it
                        const pdfBlob = await downloadAdminReport(report.id, true); 
                        if (pdfBlob) {
                            const fileName = `${report.studentName}_${new Date(report.submittedAt.seconds * 1000).toLocaleDateString().replace(/\//g, '-')}.pdf`;
                            zip.file(fileName, pdfBlob);
                        }
                    }

                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, `${reportsByTutor[tutorEmail].name}_Reports.zip`);

                } catch (error) {
                    console.error("Error creating ZIP file:", error);
                    alert("An error occurred while creating the ZIP file.");
                } finally {
                    button.textContent = 'Download All as ZIP';
                    button.disabled = false;
                }
            });
        });
    });
}

// ### UPDATED ### Now includes Parent Name, new heading, and logo.
async function downloadAdminReport(reportId, returnBlob = false) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) throw new Error("Report not found!");
        
        const reportData = reportDoc.data();
        
        // This is where the parent's email is retrieved
        let parentEmail = 'N/A';
        if (reportData.studentId) {
            const studentDoc = await getDoc(doc(db, "students", reportData.studentId));
            if (studentDoc.exists()) {
                parentEmail = studentDoc.data().parentEmail || 'N/A';
            }
        }

        // Get your logo URL from GitHub (see instructions)
        const logoUrl = "https://github.com/psalminfo/blooming-kids-cbt/blob/main/logo.png";
        
        const reportTemplate = `
            <div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <img src="${logoUrl}" alt="Company Logo" style="height: 80px; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3>
                    <h1 style="font-size: 1.2rem; font-weight: bold; color: #166534; margin-top: 0.5rem;">MONTHLY LEARNING REPORT</h1>
                    <p style="color: #4b5563;">Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <p><strong>Student's Name:</strong> ${reportData.studentName}</p>
                    <p><strong>Parent's Email:</strong> ${parentEmail}</p>
                    <p><strong>Grade:</strong> ${reportData.grade}</p>
                    <p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p>
                </div>
                ${Object.entries({
                    "INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS AND ACHIEVEMENTS": reportData.progress,
                    "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments
                }).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}
                <div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div>
            </div>`;
        
        const opt = {
            margin:       0.5,
            filename:     `${reportData.studentName}_report.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // If the function is asked to return the data (for zipping), it returns a blob.
        if (returnBlob) {
            return await html2pdf().from(reportTemplate).set(opt).outputPdf('blob');
        } else {
            // Otherwise, it saves the file directly.
            html2pdf().from(reportTemplate).set(opt).save();
        }

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert(`Failed to download report: ${error.message}`);
        return null; // Return null on error
    }
}


// ##################################################################
// # SECTION 5: PAY ADVICE PANEL (Upgraded)
// ##################################################################

async function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-gray-100 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium text-gray-700">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium text-gray-700">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                     <div class="bg-blue-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-blue-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl text-blue-600 font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl text-green-600 font-extrabold">0</p></div>
                    <button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th></tr></thead>
                    <tbody id="pay-advice-table-body" class="divide-y divide-gray-200"><tr><td colspan="5" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            endDate.setHours(23, 59, 59, 999); // Ensure end date includes the whole day
            loadPayAdviceData(startDate, endDate);
        }
    };

    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading pay data...</td></tr>`;

    // 1. Find tutors who submitted reports in the date range
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

    // 2. Get details for these active tutors and ALL students
    const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "tutors"), where("email", "in", activeTutorEmails))),
        getDocs(collection(db, "students"))
    ]);

    const allStudents = studentsSnapshot.docs.map(doc => doc.data());
    let totalStudentCount = 0;
    const payData = [];

    tutorsSnapshot.forEach(doc => {
        const tutor = doc.data();
        const assignedStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
        const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
        const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
        totalStudentCount += assignedStudents.length;

        payData.push({
            tutorName: tutor.name,
            studentCount: assignedStudents.length,
            totalStudentFees: totalStudentFees,
            managementFee: managementFee,
            totalPay: totalStudentFees + managementFee
        });
    });

    document.getElementById('pay-tutor-count').textContent = payData.length;
    document.getElementById('pay-student-count').textContent = totalStudentCount;

    tableBody.innerHTML = payData.map(d => `<tr><td class="px-6 py-4">${d.tutorName}</td><td class="px-6 py-4">${d.studentCount}</td><td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td><td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td><td class="px-6 py-4 font-bold">₦${d.totalPay.toFixed(2)}</td></tr>`).join('');

    document.getElementById('export-pay-csv-btn').onclick = () => {
        const csv = convertPayAdviceToCSV(payData);
        const blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8;'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Pay_Advice_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;
        link.click();
    };
}


// ##################################################################
// # SECTION 6: SUMMER BREAK PANEL
// ##################################################################
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Students on Summer Break</h2>
            <div id="break-students-list" class="space-y-4"><p class="text-gray-500 text-center">Loading students...</p></div>
        </div>
    `;
    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        const listContainer = document.getElementById('break-students-list');
        if (!listContainer) return;
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-gray-500 text-center">No students are on break.</p>`;
            return;
        }
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            return `<div class="border p-4 rounded-lg flex justify-between items-center"><div><p><strong>Student:</strong> ${student.studentName}</p><p><strong>Tutor:</strong> ${student.tutorEmail}</p></div><button class="remove-break-btn bg-yellow-600 text-white px-4 py-2 rounded" data-student-id="${doc.id}">End Break</button></div>`;
        }).join('');
        listContainer.querySelectorAll('.remove-break-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            await updateDoc(doc(db, "students", e.target.dataset.studentId), {
                summerBreak: false
            });
        }));
    });
}

// ##################################################################
// # SECTION 7: RENDER STAFF PANEL (This is the new section)
// ##################################################################

async function renderStaffPanel(container) {
    const ROLE_PERMISSIONS = {
        pending: {
            tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndBreak: false }
        },
        tutor: {
            tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndBreak: false }
        },
        manager: {
            tabs: { viewTutorManagement: true, viewPayAdvice: false, viewTutorReports: true, viewSummerBreak: true },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndBreak: true }
        },
        director: {
            tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true },
            actions: { canDownloadReports: true, canExportPayAdvice: true, canEndBreak: true }
        },
        admin: {
            tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true },
            actions: { canDownloadReports: true, canExportPayAdvice: true, canEndBreak: true }
        }
    };

    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Staff Management</h2>
            <p class="text-sm text-gray-600 mb-4">Assign a role to apply default permissions, then click "Manage Permissions" to customize.</p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Email</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Assign Role</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                    </tr></thead>
                    <tbody id="staff-table-body" class="bg-white divide-y divide-gray-200"></tbody>
                </table>
            </div>
        </div>
    `;

    const tableBody = document.getElementById('staff-table-body');
    onSnapshot(collection(db, "staff"), (snapshot) => {
        tableBody.innerHTML = snapshot.docs.map(doc => {
            const staff = doc.data();
            const optionsHTML = Object.keys(ROLE_PERMISSIONS).map(role =>
                `<option value="${role}" ${staff.role === role ? 'selected' : ''}>${capitalize(role)}</option>`
            ).join('');

            return `
                <tr>
                    <td class="px-6 py-4 font-medium">${staff.name}</td>
                    <td class="px-6 py-4">${staff.email}</td>
                    <td class="px-6 py-4">
                        <select data-email="${staff.email}" class="role-select p-2 border rounded bg-white">
                            ${optionsHTML}
                        </select>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2 items-center">
                            <button data-id="${doc.id}" class="manage-permissions-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Manage Permissions</button>
                            ${staff.permissions?.actions?.canEndBreak ? `<button data-id="${doc.id}" class="end-break-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">End Break</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const newRole = e.target.value;
                const staffEmail = e.target.dataset.email;
                const permissionsTemplate = ROLE_PERMISSIONS[newRole];
                if (confirm(`Change role to "${capitalize(newRole)}"? This will apply default permissions.`)) {
                    await updateDoc(doc(db, "staff", staffEmail), { role: newRole, permissions: permissionsTemplate });
                    alert('Role and default permissions updated!');
                } else {
                    const originalRole = snapshot.docs.find(d => d.id === staffEmail).data().role;
                    e.target.value = originalRole;
                }
            });
        });

        document.querySelectorAll('.manage-permissions-btn').forEach(button => {
            button.addEventListener('click', (e) => openPermissionsModal(e.target.dataset.id));
        });

        document.querySelectorAll('.end-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const staffId = e.target.dataset.id;
                if (confirm("Are you sure you want to end the summer break for ALL students? This cannot be undone.")) {
                    e.target.disabled = true;
                    e.target.textContent = 'Ending...';
                    try {
                        const studentsRef = collection(db, "students");
                        const q = query(studentsRef, where("summerBreak", "==", true));
                        const querySnapshot = await getDocs(q);
                        const batch = writeBatch(db);
                        querySnapshot.forEach((doc) => {
                            batch.update(doc.ref, { summerBreak: false, summerBreakEndedAt: Timestamp.now() });
                        });
                        await batch.commit();
                        alert('Break ended successfully for all students!');
                    } catch (error) {
                        console.error("Error ending break:", error);
                        alert(`Failed to end break: ${error.message}`);
                    } finally {
                        e.target.disabled = false;
                        e.target.textContent = 'End Break';
                    }
                }
            });
        });
    });
}

// ### NEW HELPER FUNCTION ### This creates the permissions pop-up.
async function openPermissionsModal(staffId) {
    const staffDoc = await getDoc(doc(db, "staff", staffId));
    if (!staffDoc.exists()) return alert("Staff member not found.");

    const staffData = staffDoc.data();
    const permissions = staffData.permissions || { tabs: {}, actions: {} };

    const modalHTML = `
        <div id="permissions-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
                <h3 class="text-2xl font-bold mb-4">Edit Permissions for ${staffData.name}</h3>
                <p class="text-sm text-gray-500 mb-4">Current Role: <span class="font-semibold">${capitalize(staffData.role)}</span></p>

                <div class="space-y-4">
                    <div class="border-t pt-4">
                        <h4 class="font-semibold mb-2">Tab Visibility:</h4>
                        <div class="grid grid-cols-2 gap-2">
                            <label class="flex items-center"><input type="checkbox" id="p-viewTutorManagement" class="mr-2" ${permissions.tabs?.viewTutorManagement ? 'checked' : ''}> Tutor List</label>
                            <label class="flex items-center"><input type="checkbox" id="p-viewPayAdvice" class="mr-2" ${permissions.tabs?.viewPayAdvice ? 'checked' : ''}> Pay Advice</label>
                            <label class="flex items-center"><input type="checkbox" id="p-viewTutorReports" class="mr-2" ${permissions.tabs?.viewTutorReports ? 'checked' : ''}> Tutor Reports</label>
                            <label class="flex items-center"><input type="checkbox" id="p-viewSummerBreak" class="mr-2" ${permissions.tabs?.viewSummerBreak ? 'checked' : ''}> Summer Break</label>
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <h4 class="font-semibold mb-2">Specific Actions:</h4>
                        <label class="flex items-center"><input type="checkbox" id="p-canDownloadReports" class="mr-2" ${permissions.actions?.canDownloadReports ? 'checked' : ''}> Can Download Reports</label>
                        <label class="flex items-center"><input type="checkbox" id="p-canExportPayAdvice" class="mr-2" ${permissions.actions?.canExportPayAdvice ? 'checked' : ''}> Can Export Pay Advice</label>
                        <label class="flex items-center"><input type="checkbox" id="p-canEndBreak" class="mr-2" ${permissions.actions?.canEndBreak ? 'checked' : ''}> Can End Break</label>
                    </div>
                </div>

                <div class="flex justify-end space-x-4 mt-6">
                    <button id="cancel-permissions" class="bg-gray-300 px-4 py-2 rounded">Cancel</button>
                    <button id="save-permissions" class="bg-green-600 text-white px-4 py-2 rounded">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => document.getElementById('permissions-modal').remove();

    document.getElementById('cancel-permissions').addEventListener('click', closeModal);
    document.getElementById('save-permissions').addEventListener('click', async () => {
        const newPermissions = {
            tabs: {
                viewTutorManagement: document.getElementById('p-viewTutorManagement').checked,
                viewPayAdvice: document.getElementById('p-viewPayAdvice').checked,
                viewTutorReports: document.getElementById('p-viewTutorReports').checked,
                viewSummerBreak: document.getElementById('p-viewSummerBreak').checked,
            },
            actions: {
                canDownloadReports: document.getElementById('p-canDownloadReports').checked,
                canExportPayAdvice: document.getElementById('p-canExportPayAdvice').checked,
                canEndBreak: document.getElementById('p-canEndBreak').checked,
            }
        };

        await updateDoc(doc(db, "staff", staffId), { permissions: newPermissions });
        alert("Custom permissions saved successfully!");
        closeModal();
    });
}


// ##################################################################
// # MAIN APP INITIALIZATION (FIXED & MERGED)
// ##################################################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        mainContent.innerHTML = '';
        
        // This object maps the button ID to the function that renders its content.
        const navItems = {
            navDashboard: renderAdminPanel,
            navContent: renderContentManagerPanel,
            navStaff: renderStaffPanel, // This line correctly adds the new panel
            navTutorManagement: renderTutorManagementPanel,
            navPayAdvice: renderPayAdvicePanel,
            navTutorReports: renderTutorReportsPanel,
            navSummerBreak: renderSummerBreakPanel
        };

        const setActiveNav = (activeId) => {
            Object.keys(navItems).forEach(id => {
                const navElement = document.getElementById(id);
                if (navElement) {
                     navElement.classList.toggle('active', id === activeId);
                }
            });
        };

        Object.entries(navItems).forEach(([id, renderFn]) => {
            const navElement = document.getElementById(id);
            if (navElement) {
                navElement.addEventListener('click', () => {
                    setActiveNav(id);
                    renderFn(mainContent);
                });
            }
        });

        // Initial Load on page open
        setActiveNav('navDashboard');
        renderAdminPanel(mainContent);

        logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "admin-auth.html"));

    } else {
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">You do not have permission to view this page.</p>`;
        logoutBtn.classList.add('hidden');
    }
});

// ##################################################################
// # MAIN APP INITIALIZATION (Updated)
// ##################################################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        mainContent.innerHTML = '';
        const navItems = {
            navDashboard: renderAdminPanel,
            navContent: renderContentManagerPanel,
            navTutorManagement: renderTutorManagementPanel,
            navPayAdvice: renderPayAdvicePanel,
            navTutorReports: renderTutorReportsPanel,
            navSummerBreak: renderSummerBreakPanel
        };

        const setActiveNav = (activeId) => Object.keys(navItems).forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === activeId);
        });

        Object.entries(navItems).forEach(([id, renderFn]) => {
            const navElement = document.getElementById(id);
            if (navElement) {
                navElement.addEventListener('click', () => {
                    setActiveNav(id);
                    renderFn(mainContent);
                });
            }
        });

        // Initial Load
        setActiveNav('navDashboard');
        renderAdminPanel(mainContent);

        logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "admin-auth.html"));

    } else {
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">You do not have permission to view this page.</p>`;
        logoutBtn.classList.add('hidden');
    }
});

onAuthStateChanged(auth, async (user) => {
    // ...
    if (user && user.email === ADMIN_EMAIL) {
        // ...
        const navItems = {
            navDashboard: renderAdminPanel,
            navContent: renderContentManagerPanel,
            navStaff: renderStaffPanel, // ### ADD THIS LINE ###
            navTutorManagement: renderTutorManagementPanel,
            // ... rest of the items
        };
        // ...
    }
    // ...
});












