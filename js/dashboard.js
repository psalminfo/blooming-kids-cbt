// js/dashboard.js

// Make sure the path to your firebaseConfig.js is correct
import { db } from '../firebaseConfig.js';
import { collection, getDocs, doc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export function getDashboardHTML() {
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-gray-500 text-lg">Total Students</h3>
                <p id="totalStudentsCount" class="text-3xl font-bold text-green-700">0</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-gray-500 text-lg">Total Tutors</h3>
                <p id="totalTutorsCount" class="text-3xl font-bold text-green-700">0</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                 <h3 class="text-gray-500 text-lg">Students Per Tutor</h3>
                 <select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4">
                        <label for="topic" class="block text-gray-700">Topic</label>
                        <input type="text" id="topic" required>
                    </div>
                    <div id="optionsContainer" class="mb-4">
                        <label class="block text-gray-700">Options</label>
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1">
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2">
                    </div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection">
                         <label for="correctAnswer" class="block text-gray-700">Correct Answer</label>
                         <input type="text" id="correctAnswer">
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Student Reports</h2>
                <div id="reportsListContainer" class="space-y-2">
                    <p class="text-gray-500">Loading reports...</p>
                </div>
            </div>
        </div>
        
        <div id="singleReportView" class="mt-6" style="display:none;"></div>
    `;
}

export function initializeDashboard() {
    // This function now contains all your restored logic
    const addOptionBtn = document.getElementById('addOptionBtn');
    if (addOptionBtn) {
        addOptionBtn.addEventListener('click', () => {
            const optionsContainer = document.getElementById('optionsContainer');
            const newOptionInput = document.createElement('input');
            newOptionInput.type = 'text';
            newOptionInput.className = 'option-input w-full mt-1 p-2 border rounded';
            newOptionInput.placeholder = `Option ${optionsContainer.getElementsByClassName('option-input').length + 1}`;
            optionsContainer.appendChild(newOptionInput);
        });
    }

    async function loadCounters() {
        const totalStudentsCount = document.getElementById('totalStudentsCount');
        const totalTutorsCount = document.getElementById('totalTutorsCount');
        const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');

        try {
            const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
                getDocs(collection(db, "student_results")),
                getDocs(collection(db, "tutors"))
            ]);
            
            totalStudentsCount.textContent = studentsSnapshot.size;
            totalTutorsCount.textContent = tutorsSnapshot.size;

            studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
            // This part is complex and depends on your data structure, but here's the idea:
            // for (const tutorDoc of tutorsSnapshot.docs) { ... }
        } catch (error) {
            console.error("Error loading counters:", error);
        }
    }

    async function loadAllReports() {
        const reportsListContainer = document.getElementById('reportsListContainer');
        try {
            const reportsSnapshot = await getDocs(collection(db, "student_results"));
            if (reportsSnapshot.empty) {
                reportsListContainer.innerHTML = `<p class="text-gray-500">No student reports found.</p>`;
                return;
            }
            reportsListContainer.innerHTML = ''; // Clear loading message
            reportsSnapshot.forEach(doc => {
                const report = doc.data();
                const reportElement = document.createElement('div');
                reportElement.className = 'flex justify-between items-center p-3 border rounded-lg';
                reportElement.innerHTML = `
                    <div>
                        <p class="font-semibold text-gray-800">${report.studentName}</p>
                        <p class="text-sm text-gray-500">${new Date(report.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                    </div>
                    <button class="view-report-btn bg-blue-600 text-white px-4 py-1 rounded text-sm" data-id="${doc.id}">View</button>
                `;
                reportsListContainer.appendChild(reportElement);
            });
        } catch (error) {
            console.error("Error loading reports:", error);
            reportsListContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
        }
    }
    
    document.getElementById('reportsListContainer').addEventListener('click', async (e) => {
        if (e.target.classList.contains('view-report-btn')) {
            const docId = e.target.dataset.id;
            await renderSingleReport(docId);
        }
    });

    async function renderSingleReport(docId) {
        const singleReportView = document.getElementById('singleReportView');
        singleReportView.style.display = 'block';
        singleReportView.innerHTML = `<p class="text-gray-500 p-6">Loading report...</p>`;
        try {
            const reportDoc = await getDoc(doc(db, "student_results", docId));
            if (!reportDoc.exists()) {
                singleReportView.innerHTML = `<p class="text-red-500 p-6">Report not found.</p>`;
                return;
            }
            const data = reportDoc.data();
            singleReportView.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <div class="flex justify-between items-center">
                         <h2 class="text-2xl font-bold text-green-700">Report for ${data.studentName}</h2>
                         <button id="closeReportBtn" class="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm">Close</button>
                    </div>
                    <p class="mt-4"><strong>Score:</strong> ${data.answers.filter(a => a.isCorrect).length} / ${data.totalScoreableQuestions}</p>
                    <p><strong>Parent Email:</strong> ${data.parentEmail}</p>
                    </div>
            `;
            document.getElementById('closeReportBtn').addEventListener('click', () => {
                singleReportView.style.display = 'none';
            });
        } catch (error) {
            console.error("Error rendering single report:", error);
            singleReportView.innerHTML = `<p class="text-red-500 p-6">Could not load report.</p>`;
        }
    }
    
    // Initial data load for the dashboard
    loadCounters();
    loadAllReports();
}
