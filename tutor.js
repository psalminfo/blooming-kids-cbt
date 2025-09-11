import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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


// ##################################################################
// # SECTION 1: TUTOR DASHBOARD (Updated as requested)
// ##################################################################
function renderTutorDashboard(container, tutor) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Welcome, ${tutor.name}</h2>
            <div class="mb-4">
                <input type="text" id="searchName" class="w-full mt-1 p-2 border rounded" placeholder="Search by parent name...">
                <button id="searchBtn" class="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700">Search</button>
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
        const name = document.getElementById('searchName').value.trim();
        await loadTutorReports(tutor.email, name || null);
    });
    loadTutorReports(tutor.email);
}

async function loadTutorReports(tutorEmail, parentName = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');

    pendingReportsContainer.innerHTML = `<p class="text-gray-500">Loading pending submissions...</p>`;
    if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading graded submissions...</p>`;

    // Query now searches by parentName instead of parentEmail
    let submissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorEmail));
    if (parentName) {
        submissionsQuery = query(submissionsQuery, where("parentName", "==", parentName));
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
                    <p><strong>Parent Name:</strong> ${data.parentName || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                    <div class="mt-4 border-t pt-4">
                        <h4 class="font-semibold">Creative Writing Submission:</h4>
                        ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-green-600 hover:underline">Download File</a>` : `<p class="italic">${data.textAnswer || "No response"}</p>`}
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
                    loadTutorReports(tutorEmail, parentName); // Refresh the list
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
        if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}


// ##################################################################
// # SECTION 2: STUDENT DATABASE (Updated as requested)
// ##################################################################

async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    let savedReports = {};

    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const studentsSnapshot = await getDocs(studentQuery);
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const studentsCount = students.length;

    function renderUI() {
        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;

        if (isTutorAddEnabled) {
            studentsHTML += `
                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                    <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                    <input type="text" id="new-parent-name" class="w-full mt-1 p-2 border rounded" placeholder="Parent Name">
                    <input type="tel" id="new-parent-phone" class="w-full mt-1 p-2 border rounded" placeholder="Parent Phone Number">
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
                    <input type="number" id="new-student-fee" class="w-full mt-1 p-2 border rounded" placeholder="Student Fee (₦)">
                    <button id="add-student-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700">Add Student</button>
                </div>`;
        }
        
        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;

        if (studentsCount === 0) {
            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        } else {
            studentsHTML += `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                        <tbody class="bg-white divide-y divide-gray-200">`;

            students.forEach(student => {
                const isStudentOnBreak = student.summerBreak;
                const isReportSaved = savedReports[student.id];

                // Determine the status text based on the new approvalStatus field
                let statusText = '';
                let statusClass = '';
                if (student.approvalStatus === 'pending') {
                    statusText = 'Awaiting Approval';
                    statusClass = 'text-yellow-600 font-semibold';
                } else if (isStudentOnBreak) {
                    statusText = 'On Break';
                    statusClass = 'text-gray-500';
                } else if (isReportSaved) {
                    statusText = 'Report Saved';
                    statusClass = 'text-green-600 font-semibold';
                } else {
                    statusText = 'Pending Report';
                    statusClass = 'text-gray-500';
                }

                studentsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${student.studentName} (Grade ${student.grade})</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="status-indicator ${statusClass}">${statusText}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap space-x-2">`;
                
                // Show actions only if not pending approval
                if (student.approvalStatus !== 'pending') {
                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        studentsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                    }
                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (studentsCount === 1) {
                            studentsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Submit Report</button>`;
                        } else {
                            studentsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        studentsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                }
                
                studentsHTML += `</td></tr>`;
            });

            studentsHTML += `</tbody></table></div>`;
            
            if (tutor.isManagementStaff) {
                studentsHTML += `
                    <div class="bg-green-50 p-4 rounded-lg shadow-md mt-6">
                        <h3 class="text-lg font-bold text-green-800 mb-2">Management Fee</h3>
                        <p class="text-sm text-gray-600 mb-2">As you are part of the management staff, please set your monthly management fee before final submission.</p>
                        <div class="flex items-center space-x-2">
                            <label for="management-fee-input" class="font-semibold">Fee (₦):</label>
                            <input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${tutor.managementFee || 0}">
                            <button id="save-management-fee-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Fee</button>
                        </div>
                    </div>`;
            }

            if (studentsCount > 1 && isSubmissionEnabled) {
                const allReportsSaved = Object.keys(savedReports).length === students.filter(s => !s.summerBreak).length;
                studentsHTML += `
                    <div class="bg-blue-50 p-4 rounded-lg shadow-md mt-6">
                        <h3 class="text-lg font-bold text-blue-800 mb-2">Bulk Report Submission</h3>
                        <p class="text-sm text-gray-600 mb-2">You have saved reports for ${Object.keys(savedReports).length} out of ${students.filter(s => !s.summerBreak).length} students.</p>
                        <button id="submit-all-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400" ${!allReportsSaved ? 'disabled' : ''}>Submit All Reports</button>
                    </div>`;
            }
        }

        container.innerHTML = studentsHTML;
        addStudentEventListeners();
    }

    function addStudentEventListeners() {
        if (isTutorAddEnabled) {
            document.getElementById('add-student-btn')?.addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value;
                const parentPhone = document.getElementById('new-parent-phone').value;
                const studentName = document.getElementById('new-student-name').value;
                const studentGrade = document.getElementById('new-student-grade').value;
                const studentSubject = document.getElementById('new-student-subject').value;
                const studentDays = document.getElementById('new-student-days').value;
                const studentFee = document.getElementById('new-student-fee').value;

                if (parentName && parentPhone && studentName && studentGrade && studentSubject && studentDays && studentFee) {
                    await addStudent(tutor.email, parentName, parentPhone, studentName, studentGrade, studentSubject, studentDays, studentFee);
                    renderStudentDatabase(container, tutor); // Re-render to show the new student
                } else {
                    alert('Please fill in all fields to add a student.');
                }
            });
        }

        document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                const studentRef = doc(db, "students", studentId);
                await updateDoc(studentRef, { summerBreak: true });
                renderStudentDatabase(container, tutor);
            });
        });

        document.querySelectorAll('.enter-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                renderReportSubmissionForm(container, students.find(s => s.id === studentId), tutor, savedReports);
            });
        });

        document.querySelectorAll('.submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                const reportData = {
                    tutorEmail: tutor.email,
                    studentId: student.id,
                    studentName: student.studentName,
                    parentName: student.parentName,
                    grade: student.grade,
                    submittedAt: new Date(),
                    status: 'pending_review',
                    textAnswer: 'No creative writing submission.',
                    fileUrl: ''
                };
                await addDoc(collection(db, "tutor_submissions"), reportData);
                renderStudentDatabase(container, tutor);
                alert('Report submitted for approval.');
            });
        });

        document.getElementById('save-management-fee-btn')?.addEventListener('click', async () => {
            const managementFee = document.getElementById('management-fee-input').value;
            const tutorRef = doc(db, "tutors", tutor.email);
            await updateDoc(tutorRef, { managementFee: parseFloat(managementFee) });
            alert('Management fee saved.');
        });

        document.getElementById('submit-all-reports-btn')?.addEventListener('click', async () => {
            const batch = writeBatch(db);
            let hasReportsToSubmit = false;
            students.filter(s => savedReports[s.id]).forEach(student => {
                const report = savedReports[student.id];
                if (report) {
                    const submissionRef = doc(collection(db, "tutor_submissions"));
                    batch.set(submissionRef, { ...report, status: 'pending_review', submittedAt: new Date() });
                    hasReportsToSubmit = true;
                }
            });

            if (hasReportsToSubmit) {
                await batch.commit();
                savedReports = {}; // Clear local saved reports
                renderStudentDatabase(container, tutor);
                alert('All saved reports have been submitted for approval.');
            } else {
                alert('No reports to submit.');
            }
        });

        // Function to submit a single saved report, not used directly but for consistency
        async function submitSingleSavedReport(report) {
            const submissionRef = doc(collection(db, "tutor_submissions"));
            await setDoc(submissionRef, { ...report, status: 'pending_review', submittedAt: new Date() });
            // After submission, clear the saved report locally
            delete savedReports[report.studentId];
            renderStudentDatabase(container, tutor);
        }

    }

    renderUI();
}

async function addStudent(tutorEmail, parentName, parentPhone, studentName, studentGrade, studentSubject, studentDays, studentFee) {
    // Check if the student already exists
    const q = query(collection(db, "students"), where("studentName", "==", studentName), where("tutorEmail", "==", tutorEmail));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        alert("A student with this name already exists under your account.");
        return;
    }

    // Use addDoc to automatically generate a new ID
    await addDoc(collection(db, "students"), {
        tutorEmail: tutorEmail,
        parentName: parentName,
        parentPhone: parentPhone,
        studentName: studentName,
        grade: studentGrade,
        subjects: studentSubject,
        days: studentDays,
        fee: parseFloat(studentFee),
        approvalStatus: 'pending' // New field added
    });
    alert('Student added successfully. Awaiting management approval.');
}


// ##################################################################
// # SECTION 3: REPORT SUBMISSION FORM (NO CHANGES NEEDED)
// ##################################################################

async function renderReportSubmissionForm(container, student, tutor, savedReports) {
    // ... no changes to this function
}


// ##################################################################
// # SECTION 4: INITIALIZATION (NO CHANGES NEEDED)
// ##################################################################

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

    // Default to Student Database on load
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
