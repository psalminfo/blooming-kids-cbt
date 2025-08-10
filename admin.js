import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

// --- Cloudinary Configuration ---
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.secure_url;
}

// ##################################################################
// # SECTION 1: DASHBOARD PANEL
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
                    <div class="mb-4"><label for="subject" class="block text-gray-700">Subject</label><select id="subject" required class="w-full mt-1 p-2 border rounded"><option value="">Select Subject</option><option value="Math">Math</option><option value="English">English</option><option value="Science">Science</option><option value="Social Studies">Social Studies</option></select></div>
                    <div class="mb-4"><label for="grade" class="block text-gray-700">Grade</label><select id="grade" required class="w-full mt-1 p-2 border rounded"><option value="">Select Grade</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option></select></div>
                    <div class="mb-4"><label for="questionType" class="block text-gray-700">Question Type</label><select id="questionType" class="w-full mt-1 p-2 border rounded"><option value="multiple-choice">Multiple Choice</option><option value="creative-writing">Creative Writing</option></select></div>
                    <div class="mb-4"><label for="questionText" class="block text-gray-700">Question Text</label><textarea id="questionText" class="w-full mt-1 p-2 border rounded" rows="3" required></textarea></div>
                    <div id="optionsContainer" class="mb-4"><h4 class="font-semibold mb-2">Options</h4><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1"><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2"></div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection"><label for="correctAnswer" class="block text-gray-700">Correct Answer</label><input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded"></div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <div id="studentReportSection">
                    <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                    <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                    <div id="reportContent" class="mt-4 space-y-4"><p class="text-gray-500">Please select a student to view their report.</p></div>
                </div>
            </div>
        </div>
    `;
    setupDashboardListeners();
}

function setupDashboardListeners() {
    document.getElementById('addQuestionForm').addEventListener('submit', handleAddQuestionSubmit);
    document.getElementById('addOptionBtn').addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });
    document.getElementById('studentDropdown').addEventListener('change', (e) => {
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
    try {
        const newQuestion = {
            topic: form.topic.value,
            subject: form.subject.value,
            grade: form.grade.value,
            type: form.questionType.value,
            question: form.questionText.value,
            options: Array.from(form.querySelectorAll('.option-input')).map(input => input.value).filter(v => v),
            correct_answer: form.correctAnswer.value,
        };
        await addDoc(collection(db, "admin_questions"), newQuestion);
        message.textContent = "Question saved successfully!";
        message.style.color = 'green';
        form.reset();
    } catch (error) {
        console.error("Error adding question:", error);
        message.textContent = "Error saving question.";
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
        option.textContent = `${student.studentName} (${student.parentEmail})`;
        studentDropdown.appendChild(option);
    });
}

async function loadAndRenderReport(docId) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `<p>Loading report...</p>`;
    try {
        const reportDoc = await getDoc(doc(db, "student_results", docId));
        const data = reportDoc.data();
        reportContent.innerHTML = `<div class="border rounded p-4"><p><strong>Student:</strong> ${data.studentName}</p><p><strong>Grade:</strong> ${data.grade}</p><p><strong>Score:</strong> ${data.score} / ${data.totalScoreableQuestions}</p></div>`;
    } catch (error) {
        reportContent.innerHTML = `<p class="text-red-500">Failed to load report.</p>`;
    }
}

// ##################################################################
// # SECTION 2: CONTENT MANAGER PANEL
// ##################################################################

async function renderContentManagerPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Content Checklist & Uploader</h2>
            <div id="content-manager-loader"><p>Loading test data from database...</p></div>
            <div id="content-manager-main" style="display:none;">
                <div class="mb-8 p-4 border rounded-md"><h3 class="text-xl font-semibold mb-2">Passage Upload</h3><p class="text-gray-600 mb-4">Select a passage to update. Changes are saved directly.</p><label for="passage-select" class="font-bold">Select Passage:</label><select id="passage-select" class="w-full p-2 border rounded mt-1 mb-2"></select><textarea id="passage-content" placeholder="Passage content..." class="w-full p-2 border rounded h-40"></textarea><button id="update-passage-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Save Passage</button></div>
                <div class="p-4 border rounded-md"><h3 class="text-xl font-semibold mb-2">Missing Images</h3><p class="text-gray-600 mb-4">Provide the image URL for questions that need one.</p><label for="image-select" class="font-bold">Select Question:</label><select id="image-select" class="w-full p-2 border rounded mt-1 mb-2"></select><input type="text" id="image-path" placeholder="Enter full image URL..." class="w-full p-2 border rounded"><button id="update-image-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Save Image URL</button></div>
                <p id="status" class="mt-4 font-bold"></p>
            </div>
        </div>
    `;
    await setupContentManager();
}

async function setupContentManager() {
    const loader = document.getElementById('content-manager-loader');
    const main = document.getElementById('content-manager-main');
    const statusDiv = document.getElementById('status');
    
    // Fetch test data from a 'tests' collection in Firestore
    let testsData = [];
    try {
        const querySnapshot = await getDocs(collection(db, "tests"));
        querySnapshot.forEach(doc => {
            testsData.push({ docId: doc.id, ...doc.data() });
        });
        loader.style.display = 'none';
        main.style.display = 'block';
    } catch (error) {
        loader.innerHTML = `<p class="text-red-500">Error loading test data: ${error.message}</p>`;
        return;
    }

    const passageSelect = document.getElementById('passage-select');
    const passageContent = document.getElementById('passage-content');
    const updatePassageBtn = document.getElementById('update-passage-btn');
    const imageSelect = document.getElementById('image-select');
    const imagePathInput = document.getElementById('image-path');
    const updateImageBtn = document.getElementById('update-image-btn');

    function populateDropdowns() {
        passageSelect.innerHTML = '<option value="">-- Select a Passage --</option>';
        imageSelect.innerHTML = '<option value="">-- Select a Question --</option>';
        testsData.forEach((test, testIndex) => {
            if(test.passages) {
                test.passages.forEach((passage, passageIndex) => {
                    const isComplete = passage.content && !passage.content.includes("TO BE UPLOADED");
                    const option = document.createElement('option');
                    option.value = `${testIndex}-${passageIndex}`;
                    option.textContent = `[${test.subject} G${test.grade}] ${passage.title} ${isComplete ? '✓' : '✗'}`;
                    passageSelect.appendChild(option);
                });
            }
            if(test.questions) {
                test.questions.forEach((question, questionIndex) => {
                    if (question.imagePlaceholder && !question.imageUrl) {
                         const option = document.createElement('option');
                         option.value = `${testIndex}-${questionIndex}`;
                         option.textContent = `[${test.subject} G${test.grade}] Q-ID ${question.questionId} ✗`;
                         imageSelect.appendChild(option);
                    }
                });
            }
        });
    }

    passageSelect.addEventListener('change', (e) => {
        if (!e.target.value) { passageContent.value = ''; return; }
        const [testIndex, passageIndex] = e.target.value.split('-');
        passageContent.value = testsData[testIndex].passages[passageIndex].content || '';
    });

    imageSelect.addEventListener('change', (e) => {
        if (!e.target.value) { imagePathInput.value = ''; return; }
    });

    updatePassageBtn.addEventListener('click', async () => {
        const selected = passageSelect.value;
        if (!selected) return;
        statusDiv.textContent = 'Saving passage...';
        const [testIndex, passageIndex] = selected.split('-');
        const testToUpdate = testsData[testIndex];
        testToUpdate.passages[passageIndex].content = passageContent.value;
        
        try {
            const testDocRef = doc(db, "tests", testToUpdate.docId);
            await updateDoc(testDocRef, { passages: testToUpdate.passages });
            statusDiv.textContent = `✅ Passage saved successfully to the database!`;
            populateDropdowns();
        } catch (error) {
            statusDiv.textContent = `❌ Error saving passage: ${error.message}`;
        }
    });

    updateImageBtn.addEventListener('click', async () => {
        const selected = imageSelect.value;
        if (!selected || !imagePathInput.value) return;
        statusDiv.textContent = 'Saving image URL...';
        const [testIndex, questionIndex] = selected.split('-');
        const testToUpdate = testsData[testIndex];
        testToUpdate.questions[questionIndex].imageUrl = imagePathInput.value;
        
        try {
            const testDocRef = doc(db, "tests", testToUpdate.docId);
            await updateDoc(testDocRef, { questions: testToUpdate.questions });
            statusDiv.textContent = `✅ Image URL saved successfully to the database!`;
            imagePathInput.value = '';
            populateDropdowns();
        } catch(error) {
            statusDiv.textContent = `❌ Error saving image URL: ${error.message}`;
        }
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
        navDashboard.classList.remove('active', 'text-blue-600');
        navContent.classList.remove('active', 'text-blue-600');
        activeButton.classList.add('active', 'text-blue-600');
    }

    navDashboard.addEventListener('click', () => {
        setActiveNav(navDashboard);
        renderAdminPanel(mainContent);
    });

    navContent.addEventListener('click', () => {
        setActiveNav(navContent);
        renderContentManagerPanel(mainContent);
    });
    
    renderAdminPanel(mainContent); // Initial render
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('logoutBtn').addEventListener('click', () => { signOut(auth); });
        initializeAdminPanel();
    } else {
        window.location.href = "admin-auth.html";
    }
});
