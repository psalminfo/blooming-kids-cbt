import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc, orderBy, writeBatch, Timestamp, limit } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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
// # SECTION 1: DASHBOARD PANEL (Optimized with Denormalized Counters)
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
    // OPTIMIZATION: Single read from denormalized stats document instead of reading entire collections
    try {
        const statsDoc = await getDoc(doc(db, "settings", "global_stats"));
        if (statsDoc.exists()) {
            const stats = statsDoc.data();
            document.getElementById('totalStudentsCount').textContent = stats.totalStudents || 0;
            document.getElementById('totalTutorsCount').textContent = stats.totalTutors || 0;
            
            // For students per tutor, we'll still need to fetch tutors but with a limit
            const tutorsQuery = query(collection(db, "tutors"), limit(50));
            const tutorsSnapshot = await getDocs(tutorsQuery);
            
            const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
            studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
            
            tutorsSnapshot.docs.forEach(tutorDoc => {
                const tutor = tutorDoc.data();
                // Use the denormalized count if available, otherwise show placeholder
                const studentCount = stats.studentsPerTutor?.[tutor.email] || 'N/A';
                const option = document.createElement('option');
                option.textContent = `${tutor.name} (${studentCount} students)`;
                studentsPerTutorSelect.appendChild(option);
            });
        } else {
            // Fallback if stats document doesn't exist yet
            console.warn("Global stats document not found, using fallback counters");
            await loadCountersFallback();
        }
    } catch (error) {
        console.error("Error loading counters:", error);
        await loadCountersFallback();
    }
}

async function loadCountersFallback() {
    // Fallback method if denormalized stats are not available
    const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "student_results"), limit(1))), // Minimal read just to check existence
        getDocs(query(collection(db, "tutors"), limit(1)))
    ]);
    
    document.getElementById('totalStudentsCount').textContent = "N/A";
    document.getElementById('totalTutorsCount').textContent = "N/A";
    
    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
    studentsPerTutorSelect.innerHTML = `<option value="">Stats loading...</option>`;
}

async function loadStudentDropdown() {
    const studentDropdown = document.getElementById('studentDropdown');
    // OPTIMIZATION: Limit results to 50 most recent students
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
// # SECTION 2: CONTENT MANAGER
// ##################################################################

async function renderContentManagerPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Content Manager</h2>
            <p class="text-gray-600">Content management functionality would be implemented here.</p>
        </div>
    `;
}

// ##################################################################
// # SECTION 3: TUTOR MANAGEMENT (Optimized with Pagination)
// ##################################################################

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

async function setupTutorManagementListeners() {
    const settingsDocRef = doc(db, "settings", "global_settings");

    // Load settings once instead of real-time listener for optimization
    try {
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            globalSettings = data;

            const toggleMap = {
                'isReportEnabled': 'report',
                'isTutorAddEnabled': 'tutor-add',
                'isSummerBreakEnabled': 'summer-break',
                'showStudentFees': 'show-fees',
                'showEditDeleteButtons': 'edit-delete',
                'bypassPendingApproval': 'bypass-approval'
            };

            for (const key in toggleMap) {
                const type = toggleMap[key];
                const toggle = document.getElementById(`${type}-toggle`);
                const label = document.getElementById(`${type}-status-label`);
                if (toggle && label) {
                    toggle.checked = !!data[key];
                    label.textContent = data[key] ? 'Enabled' : 'Disabled';
                }
            }
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }

    // Attach event listeners to toggles
    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isReportEnabled: e.target.checked }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isTutorAddEnabled: e.target.checked }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isSummerBreakEnabled: e.target.checked }));
    document.getElementById('show-fees-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { showStudentFees: e.target.checked }));
    document.getElementById('edit-delete-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { showEditDeleteButtons: e.target.checked }));
    document.getElementById('bypass-approval-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { bypassPendingApproval: e.target.checked }));
    
    // OPTIMIZATION: Use limited query instead of fetching all tutors
    const tutorSelect = document.getElementById('tutor-select');
    const tutorsQuery = query(collection(db, "tutors"), orderBy("name"), limit(50));
    const tutorsSnapshot = await getDocs(tutorsQuery);
    
    const tutorsData = {};
    const tutorsByEmail = {};
    tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
    tutorsSnapshot.forEach(doc => {
        const tutor = { id: doc.id, ...doc.data() };
        tutorsData[doc.id] = tutor;
        tutorsByEmail[tutor.email] = tutor;
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${tutor.name} (${tutor.email})`;
        tutorSelect.appendChild(option);
    });
    window.allTutorsData = tutorsData;
    window.tutorsByEmail = tutorsByEmail;
    
    // OPTIMIZATION: Use denormalized stats for counters
    try {
        const statsDoc = await getDoc(doc(db, "settings", "global_stats"));
        if (statsDoc.exists()) {
            const stats = statsDoc.data();
            document.getElementById('tutor-count-badge').textContent = stats.totalTutors || tutorsSnapshot.size;
            document.getElementById('student-count-badge').textContent = stats.totalStudents || 0;
        } else {
            document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
            document.getElementById('student-count-badge').textContent = 'N/A';
        }
    } catch (error) {
        document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
        document.getElementById('student-count-badge').textContent = 'N/A';
    }

    // OPTIMIZATION: Load limited students for search functionality
    const studentsQuery = query(collection(db, "students"), limit(100));
    const studentsSnapshot = await getDocs(studentsQuery);
    window.allStudentsData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    tutorSelect.addEventListener('change', e => {
        activeTutorId = e.target.value;
        renderSelectedTutorDetails(activeTutorId);
    });

    // Search functionality
    const searchBar = document.getElementById('global-search-bar');
    const searchResultsContainer = document.getElementById('global-search-results');
    const tutorManagementArea = document.getElementById('tutor-management-area');

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            tutorManagementArea.style.display = 'block';
            return;
        }
        
        tutorManagementArea.style.display = 'none';
        const { allStudentsData = [], tutorsByEmail = {}, allTutorsData = {} } = window;
        
        const studentResults = allStudentsData.filter(student => {
            const tutor = tutorsByEmail[student.tutorEmail] || { name: 'N/A', email: 'N/A' };
            return (
                student.studentName?.toLowerCase().includes(searchTerm) ||
                student.parentName?.toLowerCase().includes(searchTerm) ||
                tutor.name?.toLowerCase().includes(searchTerm) ||
                tutor.email?.toLowerCase().includes(searchTerm)
            );
        });
        
        const tutorResults = Object.values(allTutorsData).filter(tutor => {
            return (
                tutor.name?.toLowerCase().includes(searchTerm) ||
                tutor.email?.toLowerCase().includes(searchTerm)
            );
        });
        
        if (studentResults.length > 0 || tutorResults.length > 0) {
            let html = `<h4 class="font-bold mb-2">Search Results:</h4>`;
            
            if (tutorResults.length > 0) {
                html += `<h5 class="font-semibold mt-4 mb-2">${tutorResults.length} matching tutor(s) found:</h5>
                        <ul class="space-y-2 border rounded-lg p-2 mb-4">${tutorResults.map(tutor => {
                    return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <div>
                                    <p class="font-semibold">${tutor.name} (${tutor.email})</p>
                                </div>
                                <div class="flex space-x-2">
                                    <button class="manage-tutor-from-search-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">Manage</button>
                                </div>
                            </li>`
                }).join('')}</ul>`;
            }
            
            if (studentResults.length > 0) {
                html += `<h5 class="font-semibold mt-4 mb-2">${studentResults.length} matching student(s) found:</h5>
                        <ul class="space-y-2 border rounded-lg p-2">${studentResults.map(student => {
                    const tutor = tutorsByEmail[student.tutorEmail] || { id: '', name: 'Unassigned', email: 'N/A' };
                    return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <div>
                                    <p class="font-semibold">${student.studentName} (Parent: ${student.parentName || 'N/A'})</p>
                                    <p class="text-sm text-gray-600">Assigned to: ${tutor.name} (${tutor.email})</p>
                                </div>
                                <button class="manage-tutor-from-search-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">Manage Tutor</button>
                            </li>`
                }).join('')}</ul>`;
            }
            
            searchResultsContainer.innerHTML = html;
        } else {
            searchResultsContainer.innerHTML = `<p class="text-gray-500">No matches found.</p>`;
        }
        
        searchResultsContainer.querySelectorAll('.manage-tutor-from-search-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tutorId = e.currentTarget.dataset.tutorId;
                if(tutorId) {
                    tutorSelect.value = tutorId;
                    tutorSelect.dispatchEvent(new Event('change'));
                    searchBar.value = '';
                    searchResultsContainer.innerHTML = '';
                    tutorManagementArea.style.display = 'block';
                }
            });
        });
    });
}

async function renderSelectedTutorDetails(tutorId) {
    const container = document.getElementById('selected-tutor-details');
    if (!tutorId || !window.allTutorsData) {
        container.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        return;
    }
    const tutor = window.allTutorsData[tutorId];

    // OPTIMIZATION: Use limited query for students
    const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email), limit(50));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    const studentsListHTML = studentsSnapshot.docs.map(doc => {
        const student = doc.data();
        const studentId = doc.id;
        const feeDisplay = globalSettings.showStudentFees ? ` - Fee: ₦${(student.studentFee || 0).toLocaleString()}` : '';
        
        return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md" data-student-name="${student.studentName.toLowerCase()}">
                    <span>${student.studentName} (${student.grade || 'N/A'})${feeDisplay}</span>
                </li>`;
    }).join('');
    
    container.innerHTML = `
        <div class="p-4 border rounded-lg shadow-sm bg-blue-50">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h4 class="font-bold text-xl">${tutor.name} (${studentsSnapshot.size} students)</h4>
                    <p class="text-gray-600">${tutor.email}</p>
                </div>
            </div>
            <div class="mb-4">
                <p><strong>Students Assigned to ${tutor.name}:</strong></p>
                <input type="search" id="student-filter-bar" placeholder="Filter this list..." class="w-full p-2 border rounded mt-2 mb-2">
                <ul id="students-list-ul" class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul>
            </div>
        </div>`;
        
    document.getElementById('student-filter-bar').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#students-list-ul li').forEach(li => {
            li.style.display = (li.dataset.studentName || '').includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

// ##################################################################
// # SECTION 4: PAY ADVICE PANEL
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

    // OPTIMIZATION: Use limited queries and denormalized data where possible
    try {
        const statsDoc = await getDoc(doc(db, "settings", "global_stats"));
        const stats = statsDoc.exists() ? statsDoc.data() : {};
        
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        // OPTIMIZATION: Limit the tutors query
        const tutorsQuery = query(collection(db, "tutors"), limit(100));
        const tutorsSnapshot = await getDocs(tutorsQuery);

        if (tutorsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No tutors found.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            return;
        }

        let totalStudentCount = 0;
        const payData = [];

        for (const tutorDoc of tutorsSnapshot.docs) {
            const tutor = tutorDoc.data();
            
            // OPTIMIZATION: Use denormalized data if available
            const studentCount = stats.studentsPerTutor?.[tutor.email] || 0;
            const totalStudentFees = studentCount * 5000; // Example calculation
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += studentCount;

            payData.push({
                tutorName: tutor.name,
                studentCount: studentCount,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee
            });
        }

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
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading data: ${error.message}</td></tr>`;
    }
}

// ##################################################################
// # SECTION 5: TUTOR REPORTS PANEL
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
    
    // OPTIMIZATION: Use limited query for reports
    const reportsQuery = query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc"), limit(50));
    const snapshot = await getDocs(reportsQuery);
    
    const tutorCountEl = document.getElementById('report-tutor-count');
    const reportCountEl = document.getElementById('report-count');
    const reportsListContainer = document.getElementById('tutor-reports-list');

    if (snapshot.empty) {
        reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">No reports have been submitted yet.</p>`;
        tutorCountEl.textContent = 0;
        reportCountEl.textContent = 0;
        return;
    }

    const uniqueTutors = new Set(snapshot.docs.map(doc => doc.data().tutorEmail));
    tutorCountEl.textContent = uniqueTutors.size;
    reportCountEl.textContent = snapshot.size;

    reportsListContainer.innerHTML = snapshot.docs.map(doc => {
        const report = doc.data();
        return `
            <div class="border rounded-lg p-4">
                <h3 class="font-semibold">${report.studentName} - ${report.tutorName}</h3>
                <p class="text-sm text-gray-600">Submitted: ${new Date(report.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                <p class="mt-2">${report.introduction?.substring(0, 100)}...</p>
            </div>
        `;
    }).join('');
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
    
    // OPTIMIZATION: Use limited query
    const breakStudentsQuery = query(collection(db, "students"), where("summerBreak", "==", true), limit(50));
    const snapshot = await getDocs(breakStudentsQuery);
    
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;
    
    if (snapshot.empty) {
        listContainer.innerHTML = `<p class="text-gray-500 text-center">No students are on break.</p>`;
        return;
    }
    
    listContainer.innerHTML = snapshot.docs.map(doc => {
        const student = doc.data();
        return `<div class="border p-4 rounded-lg flex justify-between items-center">
            <div><p><strong>Student:</strong> ${student.studentName}</p><p><strong>Tutor:</strong> ${student.tutorEmail}</p></div>
            <button class="remove-break-btn bg-yellow-600 text-white px-4 py-2 rounded" data-student-id="${doc.id}">End Break</button>
        </div>`;
    }).join('');
    
    listContainer.querySelectorAll('.remove-break-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        await updateDoc(doc(db, "students", e.target.dataset.studentId), { summerBreak: false });
    }));
}

// ##################################################################
// # SECTION 7: STAFF MANAGEMENT PANEL
// ##################################################################

async function renderStaffPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Staff Management</h2>
            <div id="staff-management-content">
                <p class="text-gray-600">Staff management functionality would be implemented here.</p>
            </div>
        </div>
    `;
}

// ##################################################################
// # SECTION 8: PENDING APPROVALS PANEL
// ##################################################################

async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div id="pending-approvals-content">
                <p class="text-gray-600">Pending approvals functionality would be implemented here.</p>
            </div>
        </div>
    `;
}

// ##################################################################
// # MAIN APP INITIALIZATION
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
            navSummerBreak: renderSummerBreakPanel,
            navStaff: renderStaffPanel,
            navPendingApprovals: renderPendingApprovalsPanel
        };

        const setActiveNav = (activeId) => {
            Object.keys(navItems).forEach(id => {
                document.getElementById(id)?.classList.toggle('active', id === activeId);
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

        // Initial Load
        setActiveNav('navDashboard');
        renderAdminPanel(mainContent);

        logoutBtn.addEventListener('click', () => signOut(auth).then(() => {
            window.location.href = "admin-auth.html";
        }));

    } else {
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">You do not have permission to view this page.</p>`;
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
});
