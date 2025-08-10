// js/dashboard.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Cloudinary and other constants from your original file ---
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// This function returns the HTML for your dashboard.
export function getDashboardHTML() {
    return `
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
                        <label for="grade" class="block text-gray-700">Grade</label>
                        <select id="grade" required class="w-full mt-1 p-2 border rounded">
                            <option value="">Select Grade</option>
                            <option value="3">Grade 3</option><option value="4">Grade 4</option><option value="5">Grade 5</option>
                            <option value="6">Grade 6</option><option value="7">Grade 7</option><option value="8">Grade 8</option>
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
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <div class="mb-4">
                    <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                    <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                </div>
                <div id="reportContent" class="space-y-4">
                    <p class="text-gray-500">Please select a student to view their report.</p>
                </div>
            </div>
        </div>
    `;
}

// This function attaches all event listeners from your original file.
export function initializeDashboard() {
    
    // --- All your helper and core functions are here ---
    async function uploadImageToCloudinary(file) { /* ... your original code ... */ }
    function capitalize(str) { /* ... your original code ... */ }
    async function loadAndRenderReport(docId) { 
        const reportContent = document.getElementById('reportContent');
        reportContent.innerHTML = `<p class="text-gray-500">Loading report...</p>`;
        // ... REST OF YOUR ORIGINAL loadAndRenderReport function
        try {
            const reportDoc = await getDoc(doc(db, "student_results", docId));
            if (!reportDoc.exists()) {
                 reportContent.innerHTML = `<p class="text-red-500">Report not found.</p>`;
                 return;
            }
            const data = reportDoc.data();
            const fullName = capitalize(data.studentName);
            reportContent.innerHTML = `
                <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block">
                    <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
                    <p><strong>Parent Email:</strong> ${data.parentEmail}</p>
                    <button id="downloadPdfBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4">Download Report PDF</button>
                </div>
            `;
            document.getElementById('downloadPdfBtn').addEventListener('click', () => {
                const element = document.getElementById('report-block');
                html2pdf().from(element).save(`${fullName}_Report.pdf`);
            });
        } catch (error) {
            console.error("Error loading report:", error);
            reportContent.innerHTML = `<p class="text-red-500">Failed to load report.</p>`;
        }
    }
    
    async function loadCounters() {
        // ... your original loadCounters function ...
        const totalStudentsCount = document.getElementById('totalStudentsCount');
        const totalTutorsCount = document.getElementById('totalTutorsCount');
        const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
            getDocs(collection(db, "student_results")),
            getDocs(collection(db, "tutors"))
        ]);
        totalStudentsCount.textContent = studentsSnapshot.size;
        totalTutorsCount.textContent = tutorsSnapshot.size;
    }

    // --- All your event listeners are here ---
    const addOptionBtn = document.getElementById('addOptionBtn');
    addOptionBtn.addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.querySelectorAll('.option-input').length + 1}`;
        optionsContainer.appendChild(newInput);
    });
    
    const studentDropdown = document.getElementById('studentDropdown');
    getDocs(collection(db, "student_results")).then(snapshot => {
        studentDropdown.innerHTML = `<option value="">Select Student</option>`;
        snapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.studentName} (${student.parentEmail})`;
            studentDropdown.appendChild(option);
        });
    });
    studentDropdown.addEventListener('change', (e) => {
        const docId = e.target.value;
        if (docId) loadAndRenderReport(docId);
    });

    // ... All other event listeners from your file ...
    const addQuestionForm = document.getElementById('addQuestionForm');
    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... your full form submission logic
        console.log("Saving question...");
    });
    
    // --- Initial data load for the dashboard ---
    loadCounters();
}
