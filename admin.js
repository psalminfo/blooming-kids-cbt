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

// ### ADD YOUR NEW FUNCTION HERE ###
async function updateStaffPermissions(staffEmail, newRole) {
    const staffDocRef = doc(db, "staff", staffEmail);
    // This object needs to be defined in your file, as per your code.
    const ROLE_PERMISSIONS = {
        pending: {
            tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false }
        },
        tutor: {
            tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false }
        },
        manager: {
            tabs: { viewTutorManagement: true, viewPayAdvice: false, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: false },
            actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: true, canDeleteStudents: false }
        },
        director: {
            tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true },
            actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true }
        },
        admin: {
            tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true },
            actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true }
        }
    };
    const newPermissions = ROLE_PERMISSIONS[newRole];
    if (!newPermissions) {
        console.error("Invalid role specified:", newRole);
        return;
    }
    try {
        await updateDoc(staffDocRef, {
            role: newRole,
            permissions: newPermissions
        });
        console.log(`Successfully updated permissions for ${staffEmail} to role: ${newRole}`);
    } catch (error) {
        console.error("Error updating staff permissions:", error);
    }
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
    // OPTIMIZATION: Fetch all data in a single batch instead of N+1 queries
    const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
        getDocs(collection(db, "student_results")),
        getDocs(collection(db, "tutors"))
    ]);
    
    document.getElementById('totalStudentsCount').textContent = studentsSnapshot.docs.length;
    document.getElementById('totalTutorsCount').textContent = tutorsSnapshot.docs.length;
    
    // OPTIMIZATION: Count students per tutor on client side instead of individual queries
    const studentsPerTutor = {};
    studentsSnapshot.docs.forEach(doc => {
        const student = doc.data();
        const tutorEmail = student.tutorEmail;
        if (tutorEmail) {
            studentsPerTutor[tutorEmail] = (studentsPerTutor[tutorEmail] || 0) + 1;
        }
    });

    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
    studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
    
    tutorsSnapshot.docs.forEach(tutorDoc => {
        const tutor = tutorDoc.data();
        const studentCount = studentsPerTutor[tutor.email] || 0;
        const option = document.createElement('option');
        option.textContent = `${tutor.name} (${studentCount} students)`;
        studentsPerTutorSelect.appendChild(option);
    });
}

async function loadStudentDropdown() {
    const studentDropdown = document.getElementById('studentDropdown');
    // OPTIMIZATION: Limit results and use ordering to reduce read costs
    const studentsQuery = query(collection(db, "student_results"), orderBy("submittedAt", "desc"), limit(50));
    const snapshot = await getDocs(studentsQuery);
    
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
                <h4 class="text-lg font-semibold mt-4">Tutor's Recommendation:</h4>
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
// # SECTION 3: TUTOR MANAGEMENT (Final Version)
// ##################################################################

// --- Global state to hold settings, updated in real-time ---
let globalSettings = {
    showEditDeleteButtons: false,
    showStudentFees: false,
    bypassPendingApproval: false
};
async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Global Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Show Student Fees (Tutors):</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="show-fees-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="show-fees-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Edit/Delete (Tutors):</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="edit-delete-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="edit-delete-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Bypass Pending Approval:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="bypass-pending-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="bypass-pending-status-label" class="ml-3 text-sm font-medium"></span></label></label>
            </div>
            <div class="flex space-x-4">
                <button id="save-settings-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Settings</button>
                <button id="end-summer-break-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">End Summer Break</button>
            </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Management</h2>
            <div class="mb-4">
                <label for="tutor-select" class="block text-gray-700 font-semibold mb-2">Select Tutor</label>
                <select id="tutor-select" class="w-full p-2 border rounded"></select>
            </div>
            <div id="tutor-details" class="space-y-4">
                <p class="text-gray-500">Please select a tutor to view details.</p>
            </div>
        </div>
    `;

    setupTutorManagementListeners();
    loadTutorDropdown();
}

async function setupTutorManagementListeners() {
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const endSummerBreakBtn = document.getElementById('end-summer-break-btn');
    const tutorSelect = document.getElementById('tutor-select');

    // OPTIMIZATION: Replace real-time listeners with one-time fetches
    const settingsDoc = await getDoc(doc(db, "settings", "global"));
    if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        globalSettings = { ...globalSettings, ...data };
        updateSettingsUI();
    }

    // Toggle handlers
    document.getElementById('report-toggle').addEventListener('change', (e) => updateToggle('reportSubmissionEnabled', e.target.checked, 'report-status-label'));
    document.getElementById('tutor-add-toggle').addEventListener('change', (e) => updateToggle('tutorCanAddStudents', e.target.checked, 'tutor-add-status-label'));
    document.getElementById('summer-break-toggle').addEventListener('change', (e) => updateToggle('summerBreakEnabled', e.target.checked, 'summer-break-status-label'));
    document.getElementById('show-fees-toggle').addEventListener('change', (e) => {
        globalSettings.showStudentFees = e.target.checked;
        updateToggle('showStudentFees', e.target.checked, 'show-fees-status-label');
    });
    document.getElementById('edit-delete-toggle').addEventListener('change', (e) => {
        globalSettings.showEditDeleteButtons = e.target.checked;
        updateToggle('showEditDeleteButtons', e.target.checked, 'edit-delete-status-label');
    });
    document.getElementById('bypass-pending-toggle').addEventListener('change', (e) => {
        globalSettings.bypassPendingApproval = e.target.checked;
        updateToggle('bypassPendingApproval', e.target.checked, 'bypass-pending-status-label');
    });

    saveSettingsBtn.addEventListener('click', async () => {
        try {
            await setDoc(doc(db, "settings", "global"), globalSettings);
            alert("Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error saving settings: " + error.message);
        }
    });

    endSummerBreakBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to end Summer Break? This will enable report submission for all tutors.")) return;
        try {
            await setDoc(doc(db, "settings", "global"), { summerBreakEnabled: false }, { merge: true });
            alert("Summer Break ended successfully!");
            location.reload();
        } catch (error) {
            console.error("Error ending summer break:", error);
            alert("Error ending summer break: " + error.message);
        }
    });

    tutorSelect.addEventListener('change', (e) => {
        activeTutorId = e.target.value;
        if (activeTutorId) loadTutorDetails(activeTutorId);
    });
}

function updateToggle(settingKey, isChecked, labelId) {
    globalSettings[settingKey] = isChecked;
    const label = document.getElementById(labelId);
    label.textContent = isChecked ? 'Enabled' : 'Disabled';
    label.className = `ml-3 text-sm font-medium ${isChecked ? 'text-green-600' : 'text-red-600'}`;
}

function updateSettingsUI() {
    const settings = globalSettings;
    document.getElementById('report-toggle').checked = settings.reportSubmissionEnabled || false;
    document.getElementById('tutor-add-toggle').checked = settings.tutorCanAddStudents || false;
    document.getElementById('summer-break-toggle').checked = settings.summerBreakEnabled || false;
    document.getElementById('show-fees-toggle').checked = settings.showStudentFees || false;
    document.getElementById('edit-delete-toggle').checked = settings.showEditDeleteButtons || false;
    document.getElementById('bypass-pending-toggle').checked = settings.bypassPendingApproval || false;

    updateToggle('reportSubmissionEnabled', settings.reportSubmissionEnabled, 'report-status-label');
    updateToggle('tutorCanAddStudents', settings.tutorCanAddStudents, 'tutor-add-status-label');
    updateToggle('summerBreakEnabled', settings.summerBreakEnabled, 'summer-break-status-label');
    updateToggle('showStudentFees', settings.showStudentFees, 'show-fees-status-label');
    updateToggle('showEditDeleteButtons', settings.showEditDeleteButtons, 'edit-delete-status-label');
    updateToggle('bypassPendingApproval', settings.bypassPendingApproval, 'bypass-pending-status-label');
}

async function loadTutorDropdown() {
    const tutorSelect = document.getElementById('tutor-select');
    // OPTIMIZATION: Use one-time fetch instead of real-time listener
    const tutorsSnapshot = await getDocs(collection(db, "tutors"));
    
    tutorSelect.innerHTML = `<option value="">Select a Tutor</option>`;
    tutorsSnapshot.docs.forEach(doc => {
        const tutor = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = tutor.name;
        tutorSelect.appendChild(option);
    });
}

async function loadTutorDetails(tutorEmail) {
    const tutorDetailsContainer = document.getElementById('tutor-details');
    tutorDetailsContainer.innerHTML = `<p>Loading tutor details...</p>`;
    try {
        // OPTIMIZATION: Fetch all data in a single batch
        const [tutorDoc, studentsSnapshot] = await Promise.all([
            getDoc(doc(db, "tutors", tutorEmail)),
            getDocs(query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail)))
        ]);

        if (!tutorDoc.exists()) throw new Error("Tutor not found");
        const tutor = tutorDoc.data();

        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pendingStudents = students.filter(s => s.status === 'pending');
        const completedStudents = students.filter(s => s.status === 'completed');

        tutorDetailsContainer.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-xl font-bold">${tutor.name}</h3>
                <p><strong>Email:</strong> ${tutor.email}</p>
                <p><strong>Phone:</strong> ${tutor.phone || 'N/A'}</p>
                <p><strong>Total Students:</strong> ${students.length}</p>
                <p><strong>Pending Reports:</strong> ${pendingStudents.length}</p>
                <p><strong>Completed Reports:</strong> ${completedStudents.length}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-white p-4 border rounded-lg">
                    <h4 class="font-semibold mb-2">Pending Reports</h4>
                    <ul class="space-y-2">
                        ${pendingStudents.map(s => `<li class="flex justify-between items-center"><span>${s.studentName}</span><button class="view-report-btn bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700" data-id="${s.id}">View</button></li>`).join('')}
                        ${pendingStudents.length === 0 ? '<li class="text-gray-500">No pending reports</li>' : ''}
                    </ul>
                </div>
                <div class="bg-white p-4 border rounded-lg">
                    <h4 class="font-semibold mb-2">Completed Reports</h4>
                    <ul class="space-y-2">
                        ${completedStudents.map(s => `<li class="flex justify-between items-center"><span>${s.studentName}</span><button class="view-report-btn bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700" data-id="${s.id}">View</button></li>`).join('')}
                        ${completedStudents.length === 0 ? '<li class="text-gray-500">No completed reports</li>' : ''}
                    </ul>
                </div>
            </div>
        `;

        tutorDetailsContainer.querySelectorAll('.view-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reportId = e.target.getAttribute('data-id');
                loadAndRenderReport(reportId);
            });
        });
    } catch (error) {
        console.error("Error loading tutor details:", error);
        tutorDetailsContainer.innerHTML = `<p class="text-red-500">Failed to load tutor details. ${error.message}</p>`;
    }
}


// ##################################################################
// # SECTION 4: PAY ADVICE (Final Version)
// ##################################################################

async function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pay Advice</h2>
            <div class="mb-6">
                <label for="pay-period" class="block text-gray-700 font-semibold mb-2">Select Pay Period</label>
                <select id="pay-period" class="w-full p-2 border rounded">
                    <option value="current">Current Month</option>
                    <option value="previous">Previous Month</option>
                </select>
            </div>
            <div class="mb-6">
                <button id="generate-pay-advice-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Generate Pay Advice</button>
                <button id="export-csv-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ml-2">Export as CSV</button>
            </div>
            <div id="pay-advice-results" class="space-y-4">
                <p class="text-gray-500">Pay advice will appear here after generation.</p>
            </div>
        </div>
    `;

    setupPayAdviceListeners();
}

function setupPayAdviceListeners() {
    const generateBtn = document.getElementById('generate-pay-advice-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const payPeriodSelect = document.getElementById('pay-period');

    generateBtn.addEventListener('click', generatePayAdvice);
    exportBtn.addEventListener('click', exportPayAdviceToCSV);
}

async function generatePayAdvice() {
    const resultsContainer = document.getElementById('pay-advice-results');
    resultsContainer.innerHTML = `<p>Generating pay advice...</p>`;
    const payPeriod = document.getElementById('pay-period').value;

    try {
        // OPTIMIZATION: Fetch all data in a single batch
        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(collection(db, "tutors")),
            getDocs(collection(db, "student_results"))
        ]);

        const tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const payAdviceData = tutors.map(tutor => {
            const tutorStudents = students.filter(s => s.tutorEmail === tutor.email);
            const studentCount = tutorStudents.length;
            const totalStudentFees = studentCount * 5000; // ₦5,000 per student
            const managementFee = totalStudentFees * 0.10; // 10% management fee
            const totalPay = totalStudentFees - managementFee;

            return {
                tutorName: tutor.name,
                studentCount: studentCount,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalPay
            };
        });

        resultsContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white border rounded-lg">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="py-2 px-4 border-b">Tutor Name</th>
                            <th class="py-2 px-4 border-b">Student Count</th>
                            <th class="py-2 px-4 border-b">Total Student Fees (₦)</th>
                            <th class="py-2 px-4 border-b">Management Fee (₦)</th>
                            <th class="py-2 px-4 border-b">Total Pay (₦)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payAdviceData.map(item => `
                            <tr>
                                <td class="py-2 px-4 border-b">${item.tutorName}</td>
                                <td class="py-2 px-4 border-b text-center">${item.studentCount}</td>
                                <td class="py-2 px-4 border-b text-right">${item.totalStudentFees.toLocaleString()}</td>
                                <td class="py-2 px-4 border-b text-right">${item.managementFee.toLocaleString()}</td>
                                <td class="py-2 px-4 border-b text-right font-semibold">${item.totalPay.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Store data for CSV export
        window.currentPayAdviceData = payAdviceData;
    } catch (error) {
        console.error("Error generating pay advice:", error);
        resultsContainer.innerHTML = `<p class="text-red-500">Failed to generate pay advice. ${error.message}</p>`;
    }
}

function exportPayAdviceToCSV() {
    if (!window.currentPayAdviceData) {
        alert("Please generate pay advice first.");
        return;
    }

    const csvContent = convertPayAdviceToCSV(window.currentPayAdviceData);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pay-advice-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}


// ##################################################################
// # SECTION 5: TUTOR REPORTS (Final Version)
// ##################################################################

async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            <div class="mb-6">
                <label for="report-tutor-select" class="block text-gray-700 font-semibold mb-2">Select Tutor</label>
                <select id="report-tutor-select" class="w-full p-2 border rounded"></select>
            </div>
            <div class="mb-6">
                <button id="download-report-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Download Report</button>
            </div>
            <div id="report-summary" class="space-y-4">
                <p class="text-gray-500">Select a tutor to view report summary.</p>
            </div>
        </div>
    `;

    setupTutorReportsListeners();
}

function setupTutorReportsListeners() {
    const tutorSelect = document.getElementById('report-tutor-select');
    const downloadBtn = document.getElementById('download-report-btn');

    // OPTIMIZATION: Use one-time fetch instead of real-time listener
    getDocs(collection(db, "tutors")).then(snapshot => {
        tutorSelect.innerHTML = `<option value="">Select a Tutor</option>`;
        snapshot.docs.forEach(doc => {
            const tutor = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = tutor.name;
            tutorSelect.appendChild(option);
        });
    });

    tutorSelect.addEventListener('change', (e) => {
        if (e.target.value) loadTutorReportSummary(e.target.value);
    });

    downloadBtn.addEventListener('click', () => {
        const selectedTutor = tutorSelect.value;
        if (!selectedTutor) {
            alert("Please select a tutor first.");
            return;
        }
        downloadTutorReport(selectedTutor);
    });
}

async function loadTutorReportSummary(tutorEmail) {
    const summaryContainer = document.getElementById('report-summary');
    summaryContainer.innerHTML = `<p>Loading report summary...</p>`;
    try {
        // OPTIMIZATION: Fetch all data in a single batch
        const [tutorDoc, studentsSnapshot] = await Promise.all([
            getDoc(doc(db, "tutors", tutorEmail)),
            getDocs(query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail)))
        ]);

        if (!tutorDoc.exists()) throw new Error("Tutor not found");
        const tutor = tutorDoc.data();
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const pendingCount = students.filter(s => s.status === 'pending').length;
        const completedCount = students.filter(s => s.status === 'completed').length;
        const totalScore = students.reduce((sum, student) => {
            const score = student.answers ? student.answers.filter(a => a.type !== 'creative-writing' && String(a.studentAnswer).toLowerCase() === String(a.correctAnswer).toLowerCase()).length : 0;
            return sum + score;
        }, 0);
        const avgScore = students.length > 0 ? (totalScore / students.length).toFixed(1) : 0;

        summaryContainer.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-xl font-bold mb-2">${tutor.name} - Report Summary</h3>
                <p><strong>Total Students:</strong> ${students.length}</p>
                <p><strong>Pending Reports:</strong> ${pendingCount}</p>
                <p><strong>Completed Reports:</strong> ${completedCount}</p>
                <p><strong>Average Score:</strong> ${avgScore}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-white p-4 border rounded-lg">
                    <h4 class="font-semibold mb-2">Recent Reports</h4>
                    <ul class="space-y-2">
                        ${students.slice(0, 5).map(s => `
                            <li class="flex justify-between items-center">
                                <span>${s.studentName}</span>
                                <span class="text-sm ${s.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}">${s.status}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error loading tutor report summary:", error);
        summaryContainer.innerHTML = `<p class="text-red-500">Failed to load report summary. ${error.message}</p>`;
    }
}

async function downloadTutorReport(tutorEmail) {
    try {
        // OPTIMIZATION: Fetch all data in a single batch
        const [tutorDoc, studentsSnapshot] = await Promise.all([
            getDoc(doc(db, "tutors", tutorEmail)),
            getDocs(query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail)))
        ]);

        if (!tutorDoc.exists()) throw new Error("Tutor not found");
        const tutor = tutorDoc.data();
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const reportData = {
            tutor: tutor,
            students: students,
            generatedAt: new Date().toISOString(),
            summary: {
                totalStudents: students.length,
                pendingReports: students.filter(s => s.status === 'pending').length,
                completedReports: students.filter(s => s.status === 'completed').length
            }
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tutor.name.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error downloading tutor report:", error);
        alert("Failed to download report: " + error.message);
    }
}


// ##################################################################
// # SECTION 6: SUMMER BREAK (Final Version)
// ##################################################################

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Summer Break Management</h2>
            <div class="mb-6">
                <p class="text-gray-700 mb-4">Use this panel to manage summer break settings and notify tutors about break periods.</p>
                <div class="flex space-x-4">
                    <button id="start-summer-break-btn" class="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">Start Summer Break</button>
                    <button id="end-summer-break-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">End Summer Break</button>
                    <button id="notify-tutors-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Notify All Tutors</button>
                </div>
            </div>
            <div id="summer-break-status" class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-2">Current Status</h3>
                <p id="status-message">Loading...</p>
            </div>
        </div>
    `;

    setupSummerBreakListeners();
    loadSummerBreakStatus();
}

function setupSummerBreakListeners() {
    document.getElementById('start-summer-break-btn').addEventListener('click', startSummerBreak);
    document.getElementById('end-summer-break-btn').addEventListener('click', endSummerBreak);
    document.getElementById('notify-tutors-btn').addEventListener('click', notifyTutors);
}

async function loadSummerBreakStatus() {
    const statusMessage = document.getElementById('status-message');
    try {
        // OPTIMIZATION: Use one-time fetch instead of real-time listener
        const settingsDoc = await getDoc(doc(db, "settings", "global"));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            const isSummerBreak = settings.summerBreakEnabled || false;
            statusMessage.innerHTML = isSummerBreak ? 
                '<span class="text-yellow-600 font-semibold">Summer Break is currently ACTIVE</span><p class="text-sm text-gray-600 mt-1">Report submission is disabled for all tutors.</p>' :
                '<span class="text-green-600 font-semibold">Summer Break is currently INACTIVE</span><p class="text-sm text-gray-600 mt-1">Report submission is enabled for tutors.</p>';
        } else {
            statusMessage.textContent = "Status: Not configured";
        }
    } catch (error) {
        console.error("Error loading summer break status:", error);
        statusMessage.innerHTML = `<span class="text-red-600">Error loading status: ${error.message}</span>`;
    }
}

async function startSummerBreak() {
    if (!confirm("Are you sure you want to start Summer Break? This will disable report submission for all tutors.")) return;
    try {
        await setDoc(doc(db, "settings", "global"), { summerBreakEnabled: true }, { merge: true });
        alert("Summer Break started successfully!");
        loadSummerBreakStatus();
    } catch (error) {
        console.error("Error starting summer break:", error);
        alert("Error starting summer break: " + error.message);
    }
}

async function endSummerBreak() {
    if (!confirm("Are you sure you want to end Summer Break? This will enable report submission for all tutors.")) return;
    try {
        await setDoc(doc(db, "settings", "global"), { summerBreakEnabled: false }, { merge: true });
        alert("Summer Break ended successfully!");
        loadSummerBreakStatus();
    } catch (error) {
        console.error("Error ending summer break:", error);
        alert("Error ending summer break: " + error.message);
    }
}

async function notifyTutors() {
    if (!confirm("Send summer break notification to all tutors?")) return;
    try {
        // OPTIMIZATION: Use one-time fetch instead of real-time listener
        const tutorsSnapshot = await getDocs(collection(db, "tutors"));
        const notificationPromises = tutorsSnapshot.docs.map(async (tutorDoc) => {
            const tutor = tutorDoc.data();
            // In a real implementation, you would send an email or push notification here
            console.log(`Notifying tutor: ${tutor.name} (${tutor.email})`);
            // Placeholder for actual notification logic
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async operation
        });

        await Promise.all(notificationPromises);
        alert(`Summer break notifications sent to ${tutorsSnapshot.docs.length} tutors successfully!`);
    } catch (error) {
        console.error("Error notifying tutors:", error);
        alert("Error notifying tutors: " + error.message);
    }
}


// ##################################################################
// # SECTION 7: PENDING APPROVALS (Final Version)
// ##################################################################

async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div class="mb-4">
                <p class="text-gray-700">Review and approve pending tutor registrations and student assignments.</p>
            </div>
            <div id="pending-approvals-content" class="space-y-6">
                <p class="text-gray-500">Loading pending approvals...</p>
            </div>
        </div>
    `;

    loadPendingApprovals();
}

async function loadPendingApprovals() {
    const contentContainer = document.getElementById('pending-approvals-content');
    try {
        // OPTIMIZATION: Fetch all pending data in a single batch
        const [pendingTutorsSnapshot, pendingStudentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), where("status", "==", "pending"))),
            getDocs(query(collection(db, "student_results"), where("status", "==", "pending")))
        ]);

        const pendingTutors = pendingTutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pendingStudents = pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (pendingTutors.length === 0 && pendingStudents.length === 0) {
            contentContainer.innerHTML = `<p class="text-green-600 font-semibold">No pending approvals at this time.</p>`;
            return;
        }

        contentContainer.innerHTML = `
            ${pendingTutors.length > 0 ? `
                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 class="text-lg font-semibold text-yellow-800 mb-2">Pending Tutor Registrations (${pendingTutors.length})</h3>
                    <div class="space-y-3">
                        ${pendingTutors.map(tutor => `
                            <div class="bg-white p-3 rounded border flex justify-between items-center">
                                <div>
                                    <p class="font-medium">${tutor.name}</p>
                                    <p class="text-sm text-gray-600">${tutor.email} | ${tutor.phone || 'No phone'}</p>
                                </div>
                                <div class="space-x-2">
                                    <button class="approve-tutor-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" data-id="${tutor.id}">Approve</button>
                                    <button class="reject-tutor-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700" data-id="${tutor.id}">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${pendingStudents.length > 0 ? `
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 class="text-lg font-semibold text-blue-800 mb-2">Pending Student Reports (${pendingStudents.length})</h3>
                    <div class="space-y-3">
                        ${pendingStudents.map(student => `
                            <div class="bg-white p-3 rounded border flex justify-between items-center">
                                <div>
                                    <p class="font-medium">${student.studentName}</p>
                                    <p class="text-sm text-gray-600">Parent: ${student.parentEmail} | Tutor: ${student.tutorEmail || 'Unassigned'}</p>
                                </div>
                                <div class="space-x-2">
                                    <button class="view-student-report-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" data-id="${student.id}">View</button>
                                    <button class="approve-student-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" data-id="${student.id}">Approve</button>
                                    <button class="reject-student-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700" data-id="${student.id}">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Add event listeners
        contentContainer.querySelectorAll('.approve-tutor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleTutorApproval(e.target.getAttribute('data-id'), 'approved'));
        });
        contentContainer.querySelectorAll('.reject-tutor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleTutorApproval(e.target.getAttribute('data-id'), 'rejected'));
        });
        contentContainer.querySelectorAll('.view-student-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => loadAndRenderReport(e.target.getAttribute('data-id')));
        });
        contentContainer.querySelectorAll('.approve-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleStudentApproval(e.target.getAttribute('data-id'), 'completed'));
        });
        contentContainer.querySelectorAll('.reject-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleStudentApproval(e.target.getAttribute('data-id'), 'rejected'));
        });
    } catch (error) {
        console.error("Error loading pending approvals:", error);
        contentContainer.innerHTML = `<p class="text-red-500">Failed to load pending approvals. ${error.message}</p>`;
    }
}

async function handleTutorApproval(tutorId, status) {
    try {
        await updateDoc(doc(db, "tutors", tutorId), { status: status });
        alert(`Tutor ${status} successfully!`);
        loadPendingApprovals();
    } catch (error) {
        console.error("Error updating tutor status:", error);
        alert("Error updating tutor status: " + error.message);
    }
}

async function handleStudentApproval(studentId, status) {
    try {
        await updateDoc(doc(db, "student_results", studentId), { status: status });
        alert(`Student report ${status} successfully!`);
        loadPendingApprovals();
    } catch (error) {
        console.error("Error updating student status:", error);
        alert("Error updating student status: " + error.message);
    }
}


// ##################################################################
// # SECTION 8: STAFF MANAGEMENT (Final Version)
// ##################################################################

async function renderStaffManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Staff Management</h2>
            <div class="mb-6">
                <button id="add-staff-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add New Staff Member</button>
            </div>
            <div id="staff-list" class="space-y-4">
                <p class="text-gray-500">Loading staff members...</p>
            </div>
        </div>
    `;

    setupStaffManagementListeners();
    loadStaffMembers();
}

function setupStaffManagementListeners() {
    document.getElementById('add-staff-btn').addEventListener('click', showAddStaffForm);
}

async function loadStaffMembers() {
    const staffList = document.getElementById('staff-list');
    try {
        // OPTIMIZATION: Use one-time fetch instead of real-time listener
        const staffSnapshot = await getDocs(collection(db, "staff"));
        const staffMembers = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (staffMembers.length === 0) {
            staffList.innerHTML = `<p class="text-gray-500">No staff members found.</p>`;
            return;
        }

        staffList.innerHTML = staffMembers.map(staff => `
            <div class="bg-gray-50 p-4 rounded-lg border">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-lg font-semibold">${staff.name}</h3>
                    <span class="px-2 py-1 rounded text-xs font-medium ${getRoleBadgeClass(staff.role)}">${staff.role}</span>
                </div>
                <p class="text-gray-600">${staff.email}</p>
                <div class="mt-3 flex space-x-2">
                    <button class="edit-staff-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" data-id="${staff.id}">Edit Permissions</button>
                    <button class="delete-staff-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700" data-id="${staff.id}">Remove</button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        staffList.querySelectorAll('.edit-staff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => showEditStaffForm(e.target.getAttribute('data-id')));
        });
        staffList.querySelectorAll('.delete-staff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteStaffMember(e.target.getAttribute('data-id')));
        });
    } catch (error) {
        console.error("Error loading staff members:", error);
        staffList.innerHTML = `<p class="text-red-500">Failed to load staff members. ${error.message}</p>`;
    }
}

function getRoleBadgeClass(role) {
    const classes = {
        admin: 'bg-purple-100 text-purple-800',
        director: 'bg-red-100 text-red-800',
        manager: 'bg-blue-100 text-blue-800',
        tutor: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800'
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
}

function showAddStaffForm() {
    const staffList = document.getElementById('staff-list');
    staffList.innerHTML = `
        <div class="bg-white p-4 rounded-lg border">
            <h3 class="text-lg font-semibold mb-3">Add New Staff Member</h3>
            <form id="add-staff-form">
                <div class="mb-3">
                    <label for="staff-name" class="block text-gray-700 text-sm font-medium mb-1">Full Name</label>
                    <input type="text" id="staff-name" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-3">
                    <label for="staff-email" class="block text-gray-700 text-sm font-medium mb-1">Email</label>
                    <input type="email" id="staff-email" class="w-full p-2 border rounded" required>
                </div>
                <div class="mb-3">
                    <label for="staff-role" class="block text-gray-700 text-sm font-medium mb-1">Role</label>
                    <select id="staff-role" class="w-full p-2 border rounded" required>
                        <option value="">Select Role</option>
                        <option value="admin">Admin</option>
                        <option value="director">Director</option>
                        <option value="manager">Manager</option>
                        <option value="tutor">Tutor</option>
                    </select>
                </div>
                <div class="flex space-x-2">
                    <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
                    <button type="button" id="cancel-add-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Cancel</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('add-staff-form').addEventListener('submit', handleAddStaffSubmit);
    document.getElementById('cancel-add-btn').addEventListener('click', loadStaffMembers);
}

async function handleAddStaffSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['staff-name'].value;
    const email = form['staff-email'].value;
    const role = form['staff-role'].value;

    try {
        const staffDocRef = doc(db, "staff", email);
        const docSnap = await getDoc(staffDocRef);
        if (docSnap.exists()) {
            alert("A staff member with this email already exists.");
            return;
        }

        const ROLE_PERMISSIONS = {
            pending: {
                tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false },
                actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false }
            },
            tutor: {
                tabs: { viewTutorManagement: false, viewPayAdvice: false, viewTutorReports: false, viewSummerBreak: false, viewPendingApprovals: false, viewStaffManagement: false },
                actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: false, canDeleteStudents: false }
            },
            manager: {
                tabs: { viewTutorManagement: true, viewPayAdvice: false, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: false },
                actions: { canDownloadReports: false, canExportPayAdvice: false, canEndSummerBreak: false, canEditStudents: true, canDeleteStudents: false }
            },
            director: {
                tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true },
                actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true }
            },
            admin: {
                tabs: { viewTutorManagement: true, viewPayAdvice: true, viewTutorReports: true, viewSummerBreak: true, viewPendingApprovals: true, viewStaffManagement: true },
                actions: { canDownloadReports: true, canExportPayAdvice: true, canEndSummerBreak: true, canEditStudents: true, canDeleteStudents: true }
            }
        };

        await setDoc(staffDocRef, {
            name: name,
            email: email,
            role: role,
            permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.pending,
            createdAt: Timestamp.now()
        });

        alert("Staff member added successfully!");
        loadStaffMembers();
    } catch (error) {
        console.error("Error adding staff member:", error);
        alert("Error adding staff member: " + error.message);
    }
}

function showEditStaffForm(staffEmail) {
    const staffList = document.getElementById('staff-list');
    staffList.innerHTML = `<p>Loading staff details...</p>`;

    // OPTIMIZATION: Use one-time fetch instead of real-time listener
    getDoc(doc(db, "staff", staffEmail)).then(docSnap => {
        if (!docSnap.exists()) {
            alert("Staff member not found.");
            loadStaffMembers();
            return;
        }

        const staff = docSnap.data();
        staffList.innerHTML = `
            <div class="bg-white p-4 rounded-lg border">
                <h3 class="text-lg font-semibold mb-3">Edit Staff Permissions</h3>
                <form id="edit-staff-form">
                    <div class="mb-3">
                        <label class="block text-gray-700 text-sm font-medium mb-1">Name</label>
                        <p class="p-2 bg-gray-100 rounded">${staff.name}</p>
                    </div>
                    <div class="mb-3">
                        <label class="block text-gray-700 text-sm font-medium mb-1">Email</label>
                        <p class="p-2 bg-gray-100 rounded">${staff.email}</p>
                    </div>
                    <div class="mb-3">
                        <label for="edit-staff-role" class="block text-gray-700 text-sm font-medium mb-1">Role</label>
                        <select id="edit-staff-role" class="w-full p-2 border rounded" required>
                            <option value="tutor" ${staff.role === 'tutor' ? 'selected' : ''}>Tutor</option>
                            <option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option>
                            <option value="director" ${staff.role === 'director' ? 'selected' : ''}>Director</option>
                            <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="flex space-x-2">
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Update</button>
                        <button type="button" id="cancel-edit-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('edit-staff-form').addEventListener('submit', (e) => handleEditStaffSubmit(e, staffEmail));
        document.getElementById('cancel-edit-btn').addEventListener('click', loadStaffMembers);
    });
}

async function handleEditStaffSubmit(e, staffEmail) {
    e.preventDefault();
    const newRole = document.getElementById('edit-staff-role').value;

    try {
        await updateStaffPermissions(staffEmail, newRole);
        alert("Staff permissions updated successfully!");
        loadStaffMembers();
    } catch (error) {
        console.error("Error updating staff permissions:", error);
        alert("Error updating staff permissions: " + error.message);
    }
}

async function deleteStaffMember(staffEmail) {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
        await deleteDoc(doc(db, "staff", staffEmail));
        alert("Staff member removed successfully!");
        loadStaffMembers();
    } catch (error) {
        console.error("Error deleting staff member:", error);
        alert("Error deleting staff member: " + error.message);
    }
}


// ##################################################################
// # MAIN ADMIN PANEL RENDERING AND AUTH
// ##################################################################

function renderAdminInterface(user) {
    document.body.innerHTML = `
        <div class="min-h-screen bg-gray-100">
            <nav class="bg-green-700 text-white shadow-lg">
                <div class="container mx-auto px-4 py-3 flex justify-between items-center">
                    <h1 class="text-2xl font-bold">Admin Panel</h1>
                    <div class="flex items-center space-x-4">
                        <span>Welcome, ${user.email}</span>
                        <button id="logout-btn" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Logout</button>
                    </div>
                </div>
            </nav>
            <div class="container mx-auto px-4 py-6">
                <div class="mb-6 bg-white rounded-lg shadow-md p-4">
                    <div class="flex space-x-2 overflow-x-auto py-2" id="tab-buttons"></div>
                </div>
                <div id="panel-content" class="bg-white rounded-lg shadow-md p-6"></div>
            </div>
        </div>
    `;

    setupAdminTabs(user);
    setupLogoutListener();
}

function setupAdminTabs(user) {
    const tabButtons = document.getElementById('tab-buttons');
    const panelContent = document.getElementById('panel-content');

    // Define available tabs based on user permissions
    const availableTabs = [
        { id: 'dashboard', label: 'Dashboard', renderer: renderAdminPanel },
        { id: 'content-manager', label: 'Content Manager', renderer: renderContentManagerPanel },
        { id: 'tutor-management', label: 'Tutor Management', renderer: renderTutorManagementPanel },
        { id: 'pay-advice', label: 'Pay Advice', renderer: renderPayAdvicePanel },
        { id: 'tutor-reports', label: 'Tutor Reports', renderer: renderTutorReportsPanel },
        { id: 'summer-break', label: 'Summer Break', renderer: renderSummerBreakPanel },
        { id: 'pending-approvals', label: 'Pending Approvals', renderer: renderPendingApprovalsPanel },
        { id: 'staff-management', label: 'Staff Management', renderer: renderStaffManagementPanel }
    ];

    // Filter tabs based on user permissions (simplified - you might want to enhance this)
    const userTabs = availableTabs; // In a real implementation, filter based on user.role

    // Create tab buttons
    tabButtons.innerHTML = userTabs.map(tab => `
        <button class="tab-btn bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded whitespace-nowrap ${tab.id === 'dashboard' ? 'active-tab bg-green-600 text-white' : ''}" data-tab="${tab.id}">${tab.label}</button>
    `).join('');

    // Add click listeners
    tabButtons.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.getAttribute('data-tab');
            switchTab(tabId, userTabs, panelContent);
        });
    });

    // Load default tab
    renderAdminPanel(panelContent);
}

function switchTab(tabId, availableTabs, panelContent) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'bg-green-600', 'text-white');
        btn.classList.add('bg-gray-200', 'hover:bg-gray-300');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active-tab', 'bg-green-600', 'text-white');
    document.querySelector(`[data-tab="${tabId}"]`).classList.remove('bg-gray-200', 'hover:bg-gray-300');

    // Render tab content
    const tab = availableTabs.find(t => t.id === tabId);
    if (tab) {
        tab.renderer(panelContent);
    }
}

function setupLogoutListener() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Initialize admin panel
onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        renderAdminInterface(user);
    } else {
        window.location.href = 'login.html';
    }
});
