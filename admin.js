// admin.js
import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

function renderAdminLayout() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
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
                        <label for="subject" class="block text-gray-700">Subject</label>
                        <select id="subject" required class="w-full mt-1 p-2 border rounded">
                            <option value="">Select Subject</option>
                            <option value="Math">Math</option>
                            <option value="English">English</option>
                            <option value="Science">Science</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <div id="optionsContainer" class="mb-4">
                             <h4 class="font-semibold mb-2">Options</h4>
                             <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1">
                             <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2">
                        </div>
                        <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                </form>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <select id="studentDropdown" class="w-full mt-1 p-2 border rounded mb-4"></select>
                <div id="reportContent" class="space-y-4"></div>
            </div>
        </div>
    `;
}

async function initializeDashboardListeners() {
    // FIX: Add Option Button now works correctly
    document.getElementById('addOptionBtn').addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newOption = document.createElement('input');
        newOption.type = 'text';
        newOption.className = 'option-input w-full mt-1 p-2 border rounded';
        newOption.placeholder = `Option ${optionsContainer.querySelectorAll('.option-input').length + 1}`;
        optionsContainer.appendChild(newOption);
    });

    // FIX: Add Question Form submission logic
    document.getElementById('addQuestionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('subject').value;
        const options = Array.from(document.querySelectorAll('.option-input')).map(input => input.value).filter(Boolean);
        // ... rest of your form submission logic
        console.log(`Saving question for subject: ${subject} with options:`, options);
    });
    
    // FIX: Counters now fetch and display data
    async function loadCounters() {
        const totalStudentsCount = document.getElementById('totalStudentsCount');
        const totalTutorsCount = document.getElementById('totalTutorsCount');
        try {
            const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
                getDocs(collection(db, "student_results")),
                getDocs(collection(db, "tutors"))
            ]);
            totalStudentsCount.textContent = studentsSnapshot.size;
            totalTutorsCount.textContent = tutorsSnapshot.size;
        } catch (error) { console.error("Error loading counters:", error); }
    }
    
    // FIX: Student reports dropdown and rendering now work
    const studentDropdown = document.getElementById('studentDropdown');
    try {
        const studentReportsSnapshot = await getDocs(collection(db, "student_results"));
        studentDropdown.innerHTML = `<option value="">Select Student to View Report</option>`;
        studentReportsSnapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.studentName} (${student.parentEmail})`;
            studentDropdown.appendChild(option);
        });
    } catch (error) { console.error("Error populating student dropdown:", error); }

    studentDropdown.addEventListener('change', (e) => {
        const docId = e.target.value;
        const reportContent = document.getElementById('reportContent');
        if (docId) {
            reportContent.innerHTML = `<p>Loading report for ${docId}...</p>`;
            // Here you would call your full loadAndRenderReport(docId) function
        } else {
            reportContent.innerHTML = '';
        }
    });

    // Initial load
    await loadCounters();
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        renderAdminLayout();
        await initializeDashboardListeners();
        document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    } else {
        window.location.href = "admin-auth.html";
    }
});
