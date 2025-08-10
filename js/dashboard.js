// js/dashboard.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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
                        <label for="questionType" class="block text-gray-700">Question Type</label>
                        <select id="questionType" class="w-full mt-1 p-2 border rounded">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="creative-writing">Creative Writing</option>
                            <option value="comprehension">Comprehension</option>
                        </select>
                    </div>

                    <div class="mb-4" id="comprehensionSection" style="display:none;">
                        <label for="passage" class="block text-gray-700">Comprehension Passage</label>
                        <textarea id="passage" class="w-full mt-1 p-2 border rounded" rows="6" placeholder="Paste the full passage here..."></textarea>
                        <div id="comprehensionQuestions" class="mt-4">
                            <h4 class="font-semibold mb-2">Questions for this Passage</h4>
                            <div class="question-group mb-4 p-4 border rounded">
                                <textarea class="comp-question w-full mt-1 p-2 border rounded" rows="2" placeholder="Question"></textarea>
                                <div class="options-group flex space-x-2 mt-2">
                                    <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 1">
                                    <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 2">
                                </div>
                                <input type="text" class="comp-correct-answer w-full mt-2 p-2 border rounded" placeholder="Correct Answer">
                            </div>
                        </div>
                    </div>

                    <div id="standardQuestionSection">
                        <div class="mb-4">
                            <label for="topic" class="block text-gray-700">Topic</label>
                            <input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required>
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
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Student Reports</h2>
                <div id="reportsListContainer" class="space-y-2"></div>
                <div id="singleReportView" class="mt-6" style="display:none;"></div>
            </div>
        </div>
    `;
}

export function initializeDashboard() {
    
    function capitalize(str) { return str.replace(/\b\w/g, l => l.toUpperCase()); }

    // FIX 2: Correct PDF download logic is inside this function
    async function renderSingleReport(docId) {
        const singleReportView = document.getElementById('singleReportView');
        const reportsListContainer = document.getElementById('reportsListContainer');
        singleReportView.style.display = 'block';
        reportsListContainer.style.display = 'none'; // Hide the list
        singleReportView.innerHTML = `<p class="text-gray-500 p-6">Loading report...</p>`;
        
        try {
            const reportDoc = await getDoc(doc(db, "student_results", docId));
            if (!reportDoc.exists()) throw new Error("Report not found");
            const data = reportDoc.data();
            const fullName = capitalize(data.studentName);

            singleReportView.innerHTML = `
                <div id="report-block">
                    <div class="flex justify-between items-center">
                         <h2 class="text-2xl font-bold text-green-700">Report for ${fullName}</h2>
                         <button id="closeReportBtn" class="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm">&times; Close</button>
                    </div>
                    <p class="mt-4"><strong>Parent Email:</strong> ${data.parentEmail}</p>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p class="font-bold mt-2">Score: ${data.answers.filter(a => a.isCorrect).length} / ${data.totalScoreableQuestions}</p>
                </div>
                <button id="downloadPdfBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4">Download Report PDF</button>
            `;

            document.getElementById('downloadPdfBtn').addEventListener('click', () => {
                const element = document.getElementById('report-block');
                const opt = { margin: 1, filename: `${fullName}_Report.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }};
                html2pdf().from(element).set(opt).save();
            });

            document.getElementById('closeReportBtn').addEventListener('click', () => {
                singleReportView.style.display = 'none';
                reportsListContainer.style.display = 'block'; // Show the list again
            });

        } catch (error) {
            console.error("Error rendering single report:", error);
            singleReportView.innerHTML = `<p class="text-red-500 p-6">Could not load report.</p>`;
        }
    }

    // FIX 1: Complete logic for Students Per Tutor dropdown
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
            
            studentsPerTutorSelect.innerHTML = `<option value="">Select a Tutor</option>`;
            for (const tutorDoc of tutorsSnapshot.docs) {
                const tutor = tutorDoc.data();
                const studentsQuery = query(collection(db, "student_results"), where("tutorEmail", "==", tutor.email));
                const studentsUnderTutor = await getDocs(studentsQuery);
                const option = document.createElement('option');
                option.textContent = `${tutor.name} (${studentsUnderTutor.size} students)`;
                option.value = tutor.email;
                studentsPerTutorSelect.appendChild(option);
            }
        } catch (error) { console.error("Error loading counters:", error); }
    }

    // --- All Event Listeners ---
    document.getElementById('addOptionBtn').addEventListener('click', () => { /* ... same as before ... */ });
    document.getElementById('reportsListContainer').addEventListener('click', (e) => {
        if (e.target.classList.contains('view-report-btn')) renderSingleReport(e.target.dataset.id);
    });

    // FIX 3: Event listener for Question Type dropdown
    document.getElementById('questionType').addEventListener('change', (e) => {
        const type = e.target.value;
        const comprehensionSection = document.getElementById('comprehensionSection');
        const standardQuestionSection = document.getElementById('standardQuestionSection');
        
        comprehensionSection.style.display = type === 'comprehension' ? 'block' : 'none';
        standardQuestionSection.style.display = type === 'comprehension' ? 'none' : 'block';
    });

    // Initial data load for the dashboard
    loadCounters();
    // Your other functions like loadAllReports() etc. would be called here
}
