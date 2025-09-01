import { auth, db } from './firebaseConfig.js';

import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";



// --- Global state to hold report submission status ---

let isSubmissionEnabled = false;

let isTutorAddEnabled = false;

let isSummerBreakEnabled = false;



// Listen for changes to the admin settings in real-time

const settingsDocRef = doc(db, "settings", "global_settings");

onSnapshot(settingsDocRef, (docSnap) => {

    if (docSnap.exists()) {

        const data = docSnap.data();

        isSubmissionEnabled = data.isReportEnabled;

        isTutorAddEnabled = data.isTutorAddEnabled;

        isSummerBreakEnabled = data.isSummerBreakEnabled;



        // Re-render the student database if the page is currently active

        const mainContent = document.getElementById('mainContent');

        if (mainContent.querySelector('#student-list-view')) {

            renderStudentDatabase(mainContent, window.tutorData);

        }

    }

});





// --- Utility Functions ---

function renderTutorDashboard(container, tutor) {

    container.innerHTML = `

        <div class="bg-white p-6 rounded-lg shadow-md mb-6">

            <h2 class="text-2xl font-bold text-green-700 mb-4">Welcome, ${tutor.name}</h2>

            <div class="mb-4">

                <input type="email" id="searchEmail" class="w-full mt-1 p-2 border rounded" placeholder="Search by parent email...">

                <button id="searchBtn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Search</button>

            </div>

        </div>

        <div id="pendingReportsContainer" class="space-y-4">

            <p class="text-gray-500">Loading pending submissions...</p>

        </div>

        <div id="gradedReportsContainer" class="space-y-4 hidden">

            <p class="text-gray-500">Loading graded submissions...</p>

        </div>

    `;

    document.getElementById('searchBtn').addEventListener('click', async () => {

        const email = document.getElementById('searchEmail').value.trim();

        await loadTutorReports(tutor.email, email || null);

    });

    loadTutorReports(tutor.email);

}



// This function loads the old individual submissions, which you might still want for historical data.

async function loadTutorReports(tutorEmail, parentEmail = null) {

    const pendingReportsContainer = document.getElementById('pendingReportsContainer');

    const gradedReportsContainer = document.getElementById('gradedReportsContainer');



    pendingReportsContainer.innerHTML = `<p class="text-gray-500">Loading pending submissions...</p>`;

    if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading graded submissions...</p>`;



    let submissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorEmail));

    if (parentEmail) {

        submissionsQuery = query(submissionsQuery, where("parentEmail", "==", parentEmail));

    }



    try {

        const querySnapshot = await getDocs(submissionsQuery);

        let pendingHTML = '';

        let gradedHTML = '';



        querySnapshot.forEach(doc => {

            const data = doc.data();

            const reportCardHTML = `

                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">

                    <p><strong>Student:</strong> ${data.studentName}</p>

                    <p><strong>Parent Email:</strong> ${data.parentEmail}</p>

                    <p><strong>Grade:</strong> ${data.grade}</p>

                    <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>

                    <div class="mt-4 border-t pt-4">

                        <h4 class="font-semibold">Creative Writing Submission:</h4>

                        ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-blue-500 hover:underline">Download File</a>` : `<p class="italic">${data.textAnswer || "No response"}</p>`}

                        <p class="mt-2"><strong>Status:</strong> ${data.status || 'Pending'}</p>

                        ${(data.status === 'pending_review') ? `

                            <textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>

                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>

                        ` : `

                            <p class="mt-2"><strong>Tutor's Report:</strong> ${data.tutorReport || 'N/A'}</p>

                        `}

                    </div>

                </div>

            `;

            if (data.status === 'pending_review') {

                pendingHTML += reportCardHTML;

            } else {

                gradedHTML += reportCardHTML;

            }

        });

        pendingReportsContainer.innerHTML = pendingHTML || `<p class="text-gray-500">No pending submissions found.</p>`;

        if (gradedReportsContainer) gradedReportsContainer.innerHTML = gradedHTML || `<p class="text-gray-500">No graded submissions found.</p>`;



        document.querySelectorAll('.submit-report-btn').forEach(button => {

            button.addEventListener('click', async (e) => {

                const docId = e.target.getAttribute('data-doc-id');

                const reportTextarea = e.target.closest('.border').querySelector('.tutor-report');

                const tutorReport = reportTextarea.value.trim();

                if (tutorReport) {

                    const docRef = doc(db, "tutor_submissions", docId);

                    await updateDoc(docRef, { tutorReport: tutorReport, status: 'Graded' });

                    loadTutorReports(tutorEmail, parentEmail); // Refresh the list

                }

            });

        });

    } catch (error) {

        console.error("Error loading tutor reports:", error);

        pendingReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;

        if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;

    }

}





// --- REVISED STUDENT DATABASE FUNCTION ---

async function renderStudentDatabase(container, tutor) {

    if (!container) {

        console.error("Container element not found.");

        return;

    }



    // --- State for multi-student report drafts ---

    let savedReports = {};



    // Fetch the students assigned to this tutor

    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));

    const studentsSnapshot = await getDocs(studentQuery);

    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const studentsCount = students.length;



    // --- Main UI Rendering Logic ---

    function renderUI() {

        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;



        // Display the "Add Student" form if enabled by admin

        if (isTutorAddEnabled) {

            studentsHTML += `

                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">

                    <h3 class="font-bold text-lg mb-2">Add a New Student</h3>

                    <input type="text" id="new-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">

                    <select id="new-student-grade" class="w-full mt-1 p-2 border rounded">

                        <option value="">Select Grade</option>

                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}

                    </select>

                    <input type="text" id="new-student-subject" class="w-full mt-1 p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">

                    <select id="new-student-days" class="w-full mt-1 p-2 border rounded">

                        <option value="">Select Days</option>

                        ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}

                    </select>

                    <input type="number" id="new-student-fee" class="w-full mt-1 p-2 border rounded" placeholder="Student Fee">

                    <button id="add-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Add Student</button>

                </div>`;

        }

        

        // Display submission status

        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;



        if (studentsCount === 0) {

            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;

        } else {

            studentsHTML += `

                <div class="overflow-x-auto">

                    <table class="min-w-full divide-y divide-gray-200">

                        <thead>

                            <tr>

                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>

                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>

                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>

                            </tr>

                        </thead>

                        <tbody class="bg-white divide-y divide-gray-200">`;



            students.forEach(student => {

                const isStudentOnBreak = student.summerBreak;

                const isReportSaved = savedReports[student.id];



                studentsHTML += `

                    <tr>

                        <td class="px-6 py-4 whitespace-nowrap">${student.studentName} (Grade ${student.grade})</td>

                        <td class="px-6 py-4 whitespace-nowrap">

                            <span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">

                                ${isReportSaved ? 'Report Saved' : 'Pending Report'}

                            </span>

                        </td>

                        <td class="px-6 py-4 whitespace-nowrap space-x-2">`;



                if (isSummerBreakEnabled && !isStudentOnBreak) {

                    studentsHTML += `<button class="summer-break-btn bg-yellow-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;

                } else if (isStudentOnBreak) {

                    studentsHTML += `<span class="text-gray-400">On Break</span>`;

                }



                if (isSubmissionEnabled && !isStudentOnBreak) {

                    // This is the core logic change

                    if (studentsCount === 1) {

                        studentsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Submit Report</button>`;

                    } else {

                         studentsHTML += `<button class="enter-report-btn bg-blue-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;

                    }

                } else if (!isStudentOnBreak) {

                    studentsHTML += `<span class="text-gray-400">Submission Disabled</span>`;

                }

                

                studentsHTML += `</td></tr>`;

            });



            studentsHTML += `</tbody></table></div>`;



            // Add the main "Submit All" button ONLY for multiple students

            if (studentsCount > 1 && isSubmissionEnabled) {

                const allReportsSaved = Object.keys(savedReports).length === students.filter(s => !s.summerBreak).length;

                studentsHTML += `

                    <div class="mt-6 text-right">

                        <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>

                            Submit All ${studentsCount} Reports

                        </button>

                    </div>`;

            }

        }

        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;

        attachEventListeners();

    }



    // --- Modal Logic ---

    function showReportModal(student) {

        // Use existing saved data if available, otherwise empty strings

        const existingReport = savedReports[student.id] || {};

        const reportFormHTML = `

            <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>

            <div class="space-y-4">

                <div>

                    <label class="block text-gray-700 font-semibold">Introduction</label>

                    <textarea id="report-intro" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., This is a comprehensive report on...">${existingReport.introduction || ''}</textarea>

                </div>

                <div>

                    <label class="block text-gray-700 font-semibold">Topics & Remarks</label>

                    <textarea id="report-topics" class="w-full mt-1 p-2 border rounded" rows="3" placeholder="e.g., Math: Multiplication, Remark: Excellent progress...">${existingReport.topics || ''}</textarea>

                </div>

                <div>

                    <label class="block text-gray-700 font-semibold">Progress & Achievements</label>

                    <textarea id="report-progress" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.progress || ''}</textarea>

                </div>

                <div>

                    <label class="block text-gray-700 font-semibold">Strengths & Weaknesses</label>

                    <textarea id="report-sw" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.strengthsWeaknesses || ''}</textarea>

                </div>

                <div>

                    <label class="block text-gray-700 font-semibold">Recommendations</label>

                    <textarea id="report-recs" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.recommendations || ''}</textarea>

                </div>

                <div>

                    <label class="block text-gray-700 font-semibold">General Comments</label>

                    <textarea id="report-general" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.generalComments || ''}</textarea>

                </div>

                <div class="flex justify-end space-x-2">

                    <button id="cancel-report-btn" class="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500">Cancel</button>

                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">

                        ${studentsCount === 1 ? 'Submit Report' : 'Save Report'}

                    </button>

                </div>

            </div>`;



        const reportModal = document.createElement('div');

        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';

        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;

        document.body.appendChild(reportModal);



        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());

        

        document.getElementById('modal-action-btn').addEventListener('click', async () => {

            const reportData = {

                studentId: student.id,

                studentName: student.studentName,

                grade: student.grade,

                introduction: document.getElementById('report-intro').value,

                topics: document.getElementById('report-topics').value,

                progress: document.getElementById('report-progress').value,

                strengthsWeaknesses: document.getElementById('report-sw').value,

                recommendations: document.getElementById('report-recs').value,

                generalComments: document.getElementById('report-general').value

            };



            // If only one student, submit directly. Otherwise, just save to local state.

            if (studentsCount === 1) {

                await submitAllReports([reportData]);

            } else {

                savedReports[student.id] = reportData;

                alert(`${student.studentName}'s report has been saved. Please continue with other students.`);

                renderUI(); // Re-render the main UI to update status

            }

            reportModal.remove();

        });

    }



    // --- Data Submission Logic ---

    async function submitAllReports(reportsArray) {

        if (reportsArray.length === 0) {

            alert("No reports to submit.");

            return;

        }



        const date = new Date();

        const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const docId = `${tutor.email}_${monthId}`;

        const reportDocRef = doc(db, "monthly_tutor_reports", docId);

        

        try {

            // Using setDoc with a custom ID prevents duplicate reports for the same month

            await setDoc(reportDocRef, {

                tutorEmail: tutor.email,

                tutorName: tutor.name,

                submissionMonth: monthId,

                submittedAt: new Date(),

                studentReports: reportsArray,

                status: "submitted" // You can use this for admin tracking

            });



            alert("Successfully submitted all reports for the month!");

            savedReports = {}; // Clear the saved reports

            renderUI(); // Re-render to show completion

        } catch (error) {

            console.error("Error submitting monthly report:", error);

            alert(`Error: ${error.message}`);

        }

    }



    // --- Event Listeners ---

    function attachEventListeners() {

        // Listener for adding a new student

        if (isTutorAddEnabled) {

            document.getElementById('add-student-btn')?.addEventListener('click', async () => {

                const studentName = document.getElementById('new-student-name').value;

                const studentGrade = document.getElementById('new-student-grade').value;

                const subjects = document.getElementById('new-student-subject').value.split(',').map(s => s.trim());

                const days = document.getElementById('new-student-days').value;

                const studentFee = parseFloat(document.getElementById('new-student-fee').value);

                if (studentName && studentGrade && subjects.length && days && !isNaN(studentFee)) {

                    await addDoc(collection(db, "students"), {

                        studentName, grade: studentGrade, subjects, days, tutorEmail: tutor.email, studentFee, summerBreak: false

                    });

                    // Refresh the entire view after adding a student

                    renderStudentDatabase(container, tutor);

                } else {

                    alert('Please fill in all student details correctly.');

                }

            });

        }

        

        // Listener for single student submission button

        document.querySelector('.submit-single-report-btn')?.addEventListener('click', (e) => {

            const studentId = e.target.getAttribute('data-student-id');

            const student = students.find(s => s.id === studentId);

            showReportModal(student);

        });



        // Listener for multi-student "Enter Report" buttons

        document.querySelectorAll('.enter-report-btn').forEach(button => {

            button.addEventListener('click', (e) => {

                const studentId = e.target.getAttribute('data-student-id');

                const student = students.find(s => s.id === studentId);

                showReportModal(student);

            });

        });



        // Listener for the final "Submit All Reports" button

        document.getElementById('submit-all-reports-btn')?.addEventListener('click', async () => {

            if (confirm("Are you sure you want to submit all reports for the month? This action cannot be undone.")) {

                const reportsArray = Object.values(savedReports);

                await submitAllReports(reportsArray);

            }

        });

        

        // Listeners for summer break buttons

         document.querySelectorAll('.summer-break-btn').forEach(button => {

            button.addEventListener('click', async (e) => {

                const studentId = e.target.getAttribute('data-student-id');

                if (confirm("Are you sure you want to mark this student as on summer break?")) {

                    await updateDoc(doc(db, "students", studentId), { summerBreak: true });

                    renderStudentDatabase(container, tutor); // Re-render after update

                }

            });

        });

    }



    // --- Initial Render ---

    renderUI();

}



// --- Main App Initialization ---

function initializeTutorPanel() {

    const mainContent = document.getElementById('mainContent');

    const navDashboard = document.getElementById('navDashboard');

    const navStudentDatabase = document.getElementById('navStudentDatabase');



    function setActiveNav(activeButton) {

        navDashboard.classList.remove('active');

        navStudentDatabase.classList.remove('active');

        activeButton.classList.add('active');

    }



    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderTutorDashboard(mainContent, window.tutorData); });

    navStudentDatabase.addEventListener('click', () => { setActiveNav(navStudentDatabase); renderStudentDatabase(mainContent, window.tutorData); });



    // Default to the student database view

    setActiveNav(navStudentDatabase);

    renderStudentDatabase(mainContent, window.tutorData);

}



onAuthStateChanged(auth, async (user) => {

    const mainContent = document.getElementById('mainContent');

    const logoutBtn = document.getElementById('logoutBtn');



    if (user) {

        const tutorRef = doc(db, "tutors", user.email);

        const tutorSnap = await getDoc(tutorRef);

        if (tutorSnap.exists()) {

            window.tutorData = tutorSnap.data();

            initializeTutorPanel();

            logoutBtn.addEventListener('click', async () => {

                await signOut(auth);

                window.location.href = "tutor-auth.html";

            });

        } else {

            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;

            logoutBtn.classList.add('hidden');

        }

    } else {

        window.location.href = "tutor-auth.html";

    }

});
