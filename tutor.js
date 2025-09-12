import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
                        <option value="Preschool">Preschool</option>
                        <option value="Kindergarten">Kindergarten</option>
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
                studentsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${student.studentName} (Grade ${student.grade})</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap space-x-2">`;

                if (isSummerBreakEnabled && !isStudentOnBreak) {
                    studentsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                } else if (isStudentOnBreak) {
                    studentsHTML += `<span class="text-gray-400">On Break</span>`;
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
                    <div class="mt-6 text-right">
                        <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>
                            Submit All Reports
                        </button>
                    </div>`;
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    function showReportModal(student) {
        const existingReport = savedReports[student.id] || {};
        const reportFormHTML = `
            <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>
            <div class="space-y-4">
                <div><label class="block font-semibold">Introduction</label><textarea id="report-intro" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.introduction || ''}</textarea></div>
                <div><label class="block font-semibold">Topics & Remarks</label><textarea id="report-topics" class="w-full mt-1 p-2 border rounded" rows="3">${existingReport.topics || ''}</textarea></div>
                <div><label class="block font-semibold">Progress & Achievements</label><textarea id="report-progress" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.progress || ''}</textarea></div>
                <div><label class="block font-semibold">Strengths & Weaknesses</label><textarea id="report-sw" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.strengthsWeaknesses || ''}</textarea></div>
                <div><label class="block font-semibold">Recommendations</label><textarea id="report-recs" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.recommendations || ''}</textarea></div>
                <div><label class="block font-semibold">General Comments</label><textarea id="report-general" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.generalComments || ''}</textarea></div>
                <div class="flex justify-end space-x-2">
                    <button id="cancel-report-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">${studentsCount === 1 ? 'Proceed to Submit' : 'Save Report'}</button>
                </div>
            </div>`;

        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
        document.body.appendChild(reportModal);

        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
        
        document.getElementById('modal-action-btn').addEventListener('click', async () => {
            const reportData = {
                studentId: student.id, studentName: student.studentName, grade: student.grade,
                // MODIFICATION: Add parent details to the report data object
                parentName: student.parentName,
                parentPhone: student.parentPhone,
                introduction: document.getElementById('report-intro').value,
                topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value,
                strengthsWeaknesses: document.getElementById('report-sw').value,
                recommendations: document.getElementById('report-recs').value,
                generalComments: document.getElementById('report-general').value
            };

            reportModal.remove(); // Close the report modal first

            if (studentsCount === 1) {
                // MODIFICATION: Show account modal before submitting
                showAccountDetailsModal([reportData]);
            } else {
                savedReports[student.id] = reportData;
                showCustomAlert(`${student.studentName}'s report has been saved.`);
                renderUI();
            }
        });
    }

    // NEW FUNCTION: Modal for Account Details
    function showAccountDetailsModal(reportsArray) {
        const accountFormHTML = `
            <h3 class="text-xl font-bold mb-4">Enter Your Payment Details</h3>
            <p class="text-sm text-gray-600 mb-4">Please provide your bank details for payment processing. This is required before final submission.</p>
            <div class="space-y-4">
                <div>
                    <label class="block font-semibold">Beneficiary Bank Name</label>
                    <input type="text" id="beneficiary-bank" class="w-full mt-1 p-2 border rounded" placeholder="e.g., Zenith Bank">
                </div>
                <div>
                    <label class="block font-semibold">Beneficiary Account Number</label>
                    <input type="text" id="beneficiary-account" class="w-full mt-1 p-2 border rounded" placeholder="Your 10-digit account number">
                </div>
                <div>
                    <label class="block font-semibold">Beneficiary Name</label>
                    <input type="text" id="beneficiary-name" class="w-full mt-1 p-2 border rounded" placeholder="Your full name as on the account">
                </div>
                <div class="flex justify-end space-x-2 mt-6">
                    <button id="cancel-account-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="confirm-submit-btn" class="bg-green-600 text-white px-6 py-2 rounded">Confirm & Submit Report(s)</button>
                </div>
            </div>`;

        const accountModal = document.createElement('div');
        accountModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        accountModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${accountFormHTML}</div>`;
        document.body.appendChild(accountModal);

        document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());

        document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
            const accountDetails = {
                beneficiaryBank: document.getElementById('beneficiary-bank').value.trim(),
                beneficiaryAccount: document.getElementById('beneficiary-account').value.trim(),
                beneficiaryName: document.getElementById('beneficiary-name').value.trim(),
            };

            if (!accountDetails.beneficiaryBank || !accountDetails.beneficiaryAccount || !accountDetails.beneficiaryName) {
                showCustomAlert("Please fill in all bank account details before submitting.");
                return;
            }

            accountModal.remove();
            await submitAllReports(reportsArray, accountDetails);
        });
    }
    
    // MODIFICATION: Updated function to accept and process accountDetails
    async function submitAllReports(reportsArray, accountDetails) {
        if (reportsArray.length === 0) {
            showCustomAlert("No reports to submit.");
            return;
        }

        const batch = writeBatch(db);

        reportsArray.forEach(report => {
            const newReportRef = doc(collection(db, "tutor_submissions"));
            batch.set(newReportRef, {
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                submittedAt: new Date(),
                // Report content
                ...report,
                // Account details
                ...accountDetails
            });
        });

        try {
            await batch.commit();
            showCustomAlert(`Successfully submitted ${reportsArray.length} report(s)!`);
            savedReports = {};
            renderUI();
        } catch (error) {
            console.error("Error submitting reports:", error);
            showCustomAlert(`Error: ${error.message}`);
        }
    }

    // NEW FUNCTION: Custom Alert Modal
    function showCustomAlert(message) {
        const alertModal = document.createElement('div');
        alertModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        alertModal.innerHTML = `
            <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-sm mx-auto text-center">
                <p class="text-lg font-semibold mb-4">${message}</p>
                <button id="close-alert-btn" class="bg-green-600 text-white px-6 py-2 rounded">OK</button>
            </div>`;
        document.body.appendChild(alertModal);
        document.getElementById('close-alert-btn').addEventListener('click', () => alertModal.remove());
    }

    function attachEventListeners() {
        if (isTutorAddEnabled) {
            document.getElementById('add-student-btn')?.addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value.trim();
                const parentPhone = document.getElementById('new-parent-phone').value.trim();
                const studentName = document.getElementById('new-student-name').value.trim();
                const studentGrade = document.getElementById('new-student-grade').value.trim();
                const studentSubjects = document.getElementById('new-student-subject').value.split(',').map(s => s.trim());
                const studentDays = document.getElementById('new-student-days').value.trim();
                const studentFee = parseFloat(document.getElementById('new-student-fee').value);
                const tutorEmail = tutor.email;

                if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays) {
                    showCustomAlert('Please fill in all parent and student details correctly.');
                    return;
                }

                // Check for duplicate student before adding
                const duplicateQuery = query(
                    collection(db, "students"),
                    where("tutorEmail", "==", tutorEmail),
                    where("studentName", "==", studentName),
                    where("parentName", "==", parentName)
                );
                
                try {
                    const querySnapshot = await getDocs(duplicateQuery);
                    if (!querySnapshot.empty) {
                        showCustomAlert('This student and parent combination already exists. Cannot add duplicate.');
                        return;
                    }

                    // No duplicate found, proceed with adding the new student
                    const studentData = {
                        parentName: parentName,
                        parentPhone: parentPhone,
                        studentName: studentName,
                        grade: studentGrade,
                        subjects: studentSubjects,
                        days: studentDays,
                        studentFee: studentFee,
                        tutorEmail: tutorEmail,
                        summerBreak: false
                    };

                    await addDoc(collection(db, "students"), studentData);
                    showCustomAlert(`${studentName} has been successfully added.`);
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`An error occurred: ${error.message}`);
                }
            });
        }
        
        document.querySelector('.submit-single-report-btn')?.addEventListener('click', (e) => {
            const student = students.find(s => s.id === e.target.dataset.studentId);
            showReportModal(student);
        });

        document.querySelectorAll('.enter-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const student = students.find(s => s.id === e.target.dataset.studentId);
                showReportModal(student);
            });
        });

        document.getElementById('submit-all-reports-btn')?.addEventListener('click', async () => {
            showCustomAlert("Are you ready to enter your payment details and submit all reports?");
            document.getElementById('close-alert-btn').addEventListener('click', () => {
                document.querySelector('.fixed.inset-0')?.remove();
                showAccountDetailsModal(Object.values(savedReports));
            });
        });
        
         document.querySelectorAll('.summer-break-btn').forEach(button => {
             button.addEventListener('click', async (e) => {
                 showCustomAlert("Are you sure you want to mark this student as on summer break?");
                 document.getElementById('close-alert-btn').addEventListener('click', async () => {
                    document.querySelector('.fixed.inset-0')?.remove();
                    await updateDoc(doc(db, "students", e.target.dataset.studentId), { summerBreak: true });
                    renderStudentDatabase(container, tutor);
                 });
             });
         });

        document.getElementById('save-management-fee-btn')?.addEventListener('click', async () => {
            const feeInput = document.getElementById('management-fee-input');
            const newFee = parseFloat(feeInput.value);
            if (!isNaN(newFee) && newFee >= 0) {
                const tutorRef = doc(db, "tutors", auth.currentUser.email);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert('Management fee updated successfully!');
            } else {
                showCustomAlert('Please enter a valid fee.');
            }
        });
    }

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
