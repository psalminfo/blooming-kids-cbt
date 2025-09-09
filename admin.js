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
    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isReportEnabled: e.target.checked }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isTutorAddEnabled: e.target.checked }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isSummerBreakEnabled: e.target.checked }));
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
        tutorSelect.innerHTML = `<option value="">Select Tutor</option>`;
        snapshot.forEach(doc => {
            const tutor = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${tutor.name || 'No Name'} (${doc.id})`;
            tutorSelect.appendChild(option);
            tutorsData[doc.id] = tutor;
        });
        if (tutorSelect.querySelector(`option[value="${currentSelection}"]`)) {
            tutorSelect.value = currentSelection;
        }
        if (activeTutorId) {
            renderSelectedTutorDetails(activeTutorId);
        }
    });
}

// ##################################################################
// # SECTION 4: STAFF PANEL (NEW)
// ##################################################################

async function renderStaffPanel(container, userPermissions) {
    const isAdmin = userPermissions.admin; // Check if the user has a general admin role

    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Staff Directory</h2>
            <p id="staff-loading-status">Loading staff members...</p>
            <div id="staff-list-container" class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </div>
        ${isAdmin ? `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-red-600 mb-4">End Summer Break</h2>
            <p class="text-gray-600 mb-4">This action will deactivate the summer break mode for all students, making their accounts active again and ready for a new session. This cannot be undone.</p>
            <button id="endBreakBtn" class="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition-colors duration-200">End Break for All Students</button>
            <p id="endBreakStatus" class="mt-4 text-sm font-semibold"></p>
        </div>
        ` : ''}
    `;

    // Fetch and display staff members
    try {
        const staffListContainer = container.querySelector('#staff-list-container');
        const statusElement = container.querySelector('#staff-loading-status');
        const querySnapshot = await getDocs(collection(db, "staff"));
        staffListContainer.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            statusElement.textContent = "No staff members found.";
        } else {
            statusElement.style.display = 'none';
            querySnapshot.forEach(doc => {
                const staff = doc.data();
                const staffCard = document.createElement('div');
                staffCard.className = 'bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200';
                staffCard.innerHTML = `
                    <h4 class="font-bold text-lg text-gray-800">${staff.name || 'N/A'}</h4>
                    <p class="text-sm text-gray-600">${staff.role || 'N/A'}</p>
                    <p class="text-sm text-gray-500">Email: ${doc.id}</p>
                    <p class="text-sm text-gray-500">Status: ${staff.status}</p>
                `;
                staffListContainer.appendChild(staffCard);
            });
        }
    } catch (error) {
        console.error("Error fetching staff:", error);
        container.querySelector('#staff-loading-status').textContent = "Failed to load staff members.";
    }

    // Set up end break functionality if user has permission
    if (isAdmin) {
        const endBreakBtn = container.querySelector('#endBreakBtn');
        const endBreakStatus = container.querySelector('#endBreakStatus');
        endBreakBtn.addEventListener('click', async () => {
            endBreakBtn.disabled = true;
            endBreakStatus.textContent = 'Ending break... This may take a moment.';
            endBreakStatus.style.color = 'blue';

            try {
                // Fetch all students on break
                const studentsRef = collection(db, "students");
                const q = query(studentsRef, where("summerBreak", "==", true));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    endBreakStatus.textContent = 'No students are currently on break.';
                    endBreakStatus.style.color = 'orange';
                    endBreakBtn.disabled = false;
                    return;
                }

                // Batch write to update all student documents
                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => {
                    const studentRef = doc.ref;
                    batch.update(studentRef, {
                        summerBreak: false,
                        summerBreakEndedAt: Timestamp.now()
                    });
                });

                // Set a global setting to signal break is over
                const settingsRef = doc(db, "settings", "global_settings");
                batch.update(settingsRef, { isSummerBreakEnabled: false });

                await batch.commit();

                endBreakStatus.textContent = 'Break ended and accounts have been reset successfully!';
                endBreakStatus.style.color = 'green';

            } catch (error) {
                console.error("Error ending break:", error);
                endBreakStatus.textContent = `Error: ${error.message}`;
                endBreakStatus.style.color = 'red';
            } finally {
                endBreakBtn.disabled = false;
            }
        });
    }
}


// ##################################################################
// # SECTION 5: SUMMER BREAK PANEL (Restored)
// ##################################################################

async function renderSummerBreakPanel(container, userPermissions) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-red-600 mb-4">End Summer Break</h2>
            <p class="text-gray-600 mb-4">This action will deactivate the summer break mode for all students, making their accounts active again and ready for a new session. This cannot be undone.</p>
            ${userPermissions.canEndBreak ? `
                <button id="endBreakBtn" class="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition-colors duration-200">End Break for All Students</button>
            ` : `<p class="text-red-500 font-semibold">You do not have permission to perform this action.</p>`}
            <p id="endBreakStatus" class="mt-4 text-sm font-semibold"></p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-blue-600 mb-4">Students on Break</h2>
            <p id="studentsOnBreakStatus">Loading students...</p>
            <div id="studentsOnBreakList" class="mt-4 space-y-2"></div>
        </div>
    `;

    const endBreakBtn = container.querySelector('#endBreakBtn');
    if (endBreakBtn) {
        const endBreakStatus = container.querySelector('#endBreakStatus');
        endBreakBtn.addEventListener('click', async () => {
            endBreakBtn.disabled = true;
            endBreakStatus.textContent = 'Ending break... This may take a moment.';
            endBreakStatus.style.color = 'blue';

            try {
                // Get all students
                const studentsRef = collection(db, "students");
                const q = query(studentsRef, where("summerBreak", "==", true));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    endBreakStatus.textContent = 'No students are currently on break.';
                    endBreakStatus.style.color = 'orange';
                    endBreakBtn.disabled = false;
                    return;
                }

                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => {
                    const studentRef = doc.ref;
                    batch.update(studentRef, {
                        summerBreak: false,
                        summerBreakEndedAt: Timestamp.now()
                    });
                });

                // Also update the global setting
                const settingsRef = doc(db, "settings", "global_settings");
                batch.update(settingsRef, { isSummerBreakEnabled: false });

                await batch.commit();

                endBreakStatus.textContent = 'Break ended and accounts have been reset successfully!';
                endBreakStatus.style.color = 'green';

            } catch (error) {
                console.error("Error ending break:", error);
                endBreakStatus.textContent = `Error: ${error.message}`;
                endBreakStatus.style.color = 'red';
            } finally {
                endBreakBtn.disabled = false;
            }
        });
    }

    try {
        const studentsOnBreakList = container.querySelector('#studentsOnBreakList');
        const studentsOnBreakStatus = container.querySelector('#studentsOnBreakStatus');

        onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
            studentsOnBreakList.innerHTML = '';
            if (snapshot.empty) {
                studentsOnBreakStatus.textContent = "No students are currently on break.";
            } else {
                studentsOnBreakStatus.style.display = 'none';
                snapshot.forEach(doc => {
                    const student = doc.data();
                    const studentDiv = document.createElement('div');
                    studentDiv.className = 'p-2 bg-gray-100 rounded';
                    studentDiv.textContent = `${student.studentName} (${student.parentEmail}) - Break started: ${student.summerBreakStartedAt ? new Date(student.summerBreakStartedAt.seconds * 1000).toLocaleDateString() : 'N/A'}`;
                    studentsOnBreakList.appendChild(studentDiv);
                });
            }
        });
    } catch (error) {
        console.error("Error loading students on break:", error);
        container.querySelector('#studentsOnBreakStatus').textContent = "Failed to load student data.";
    }
}


// ##################################################################
// # MAIN LOGIC
// ##################################################################

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');

    onAuthStateChanged(auth, async (user) => {
        if (user && user.email === ADMIN_EMAIL) {
            console.log("Admin user logged in:", user.email);

            // Fetch user permissions
            const staffDocRef = doc(db, "staff", user.email);
            const staffDocSnap = await getDoc(staffDocRef);
            const userPermissions = staffDocSnap.exists() ? staffDocSnap.data().permissions || {} : {};

            const navItems = {
                navDashboard: renderAdminPanel,
                navContent: renderContentManagerPanel,
                navStaff: (container) => renderStaffPanel(container, userPermissions), // Updated to pass permissions
                navTutorManagement: renderTutorManagementPanel,
                navSummerBreak: (container) => renderSummerBreakPanel(container, userPermissions) // Updated to pass permissions
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
});
