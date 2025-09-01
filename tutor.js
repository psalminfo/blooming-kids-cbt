import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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


// ### NEW ### Management Fee Module for designated staff
async function renderManagementFeeModule(container, tutorData) {
    // Only show this module if the tutor is marked as management staff
    if (!tutorData.isManagementStaff) {
        container.innerHTML = ''; // Clear the container if they are not staff
        return;
    }

    container.innerHTML = `
        <div class="bg-blue-50 p-4 rounded-lg shadow-md mt-6 border border-blue-200">
            <h3 class="text-lg font-bold text-blue-800 mb-2">Management Fee</h3>
            <p class="text-sm text-gray-600 mb-2">As you are part of the management staff, please set your monthly management fee.</p>
            <div class="flex items-center space-x-2">
                <label for="management-fee-input" class="font-semibold">Fee (₦):</label>
                <input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${tutorData.managementFee || 0}">
                <button id="save-tutor-fee-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Fee</button>
            </div>
        </div>
    `;

    document.getElementById('save-tutor-fee-btn').addEventListener('click', async () => {
        const newFee = parseFloat(document.getElementById('management-fee-input').value);
        if (!isNaN(newFee) && newFee >= 0) {
            const tutorRef = doc(db, "tutors", auth.currentUser.email);
            await updateDoc(tutorRef, { managementFee: newFee });
            alert('Management fee updated successfully!');
        } else {
            alert('Please enter a valid, non-negative number for the fee.');
        }
    });
}


// --- Utility Functions ---
function renderTutorDashboard(container, tutor) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Welcome, ${tutor.name}</h2>
            <div id="management-module"></div>
        </div>
    `;
    // The management module is called from onAuthStateChanged after tutor data is loaded
}

// --- STUDENT DATABASE FUNCTION ---
async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    let savedReports = {};

    onSnapshot(query(collection(db, "students"), where("tutorEmail", "==", tutor.email)), (studentsSnapshot) => {
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const studentsCount = students.length;

        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;
        
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
                    <input type="number" id="new-student-fee" class="w-full mt-1 p-2 border rounded" placeholder="Student Fee (₦)">
                    <button id="add-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Add Student</button>
                </div>`;
        }
        
        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;

        if (studentsCount === 0) {
            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        } else {
            studentsHTML += `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead><tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr></thead>
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
                    studentsHTML += `<button class="summer-break-btn bg-yellow-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                } else if (isStudentOnBreak) {
                    studentsHTML += `<span class="text-gray-400">On Break</span>`;
                }
                if (isSubmissionEnabled && !isStudentOnBreak) {
                    studentsHTML += `<button class="enter-report-btn bg-blue-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                } else if (!isStudentOnBreak) {
                    studentsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                }
                studentsHTML += `</td></tr>`;
            });
            studentsHTML += `</tbody></table></div>`;

            if (isSubmissionEnabled && students.some(s => !s.summerBreak)) {
                const activeStudentsCount = students.filter(s => !s.summerBreak).length;
                const allReportsSaved = Object.keys(savedReports).length === activeStudentsCount;
                studentsHTML += `
                    <div class="mt-6 text-right">
                        <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>
                            Submit All ${activeStudentsCount} Reports
                        </button>
                    </div>`;
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners(students);
    });

    function showReportModal(student) {
        const existingReport = savedReports[student.id] || {};
        const reportFormHTML = `
            <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>
            <div class="space-y-4">${['Introduction', 'Topics & Remarks', 'Progress & Achievements', 'Strengths & Weaknesses', 'Recommendations', 'General Comments'].map(label => {
                const id = `report-${label.split(' ')[0].toLowerCase()}`;
                const key = `${label.split(' ')[0].toLowerCase()}${label.includes('Weaknesses') ? 'Weaknesses' : ''}`;
                return `<div><label class="block text-gray-700 font-semibold">${label}</label><textarea id="${id}" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport[key] || ''}</textarea></div>`;
            }).join('')}</div>
            <div class="flex justify-end space-x-2 mt-4"><button id="cancel-report-btn" class="bg-gray-400 text-white px-6 py-2 rounded">Cancel</button><button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">Save Report</button></div>`;
        
        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
        document.body.appendChild(reportModal);

        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
        document.getElementById('modal-action-btn').addEventListener('click', () => {
            savedReports[student.id] = {
                studentId: student.id, studentName: student.studentName, grade: student.grade,
                introduction: document.getElementById('report-introduction').value,
                topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value,
                strengthsWeaknesses: document.getElementById('report-strengths').value,
                recommendations: document.getElementById('report-recommendations').value,
                generalComments: document.getElementById('report-general').value
            };
            alert(`${student.studentName}'s report has been saved.`);
            reportModal.remove();
        });
    }

    function attachEventListeners(students) {
        if (isTutorAddEnabled) {
            document.getElementById('add-student-btn')?.addEventListener('click', async () => {
                const studentData = {
                    studentName: document.getElementById('new-student-name').value,
                    grade: document.getElementById('new-student-grade').value,
                    subjects: document.getElementById('new-student-subject').value.split(',').map(s => s.trim()),
                    days: document.getElementById('new-student-days').value,
                    studentFee: parseFloat(document.getElementById('new-student-fee').value),
                    tutorEmail: tutor.email, summerBreak: false
                };
                if (studentData.studentName && studentData.grade && !isNaN(studentData.studentFee)) {
                    await addDoc(collection(db, "students"), studentData);
                } else {
                    alert('Please fill in all details correctly.');
                }
            });
        }
        
        document.querySelectorAll('.enter-report-btn').forEach(button => {
            button.addEventListener('click', (e) => showReportModal(students.find(s => s.id === e.target.dataset.studentId)));
        });

        document.getElementById('submit-all-reports-btn')?.addEventListener('click', async () => {
            if (confirm("Are you sure you want to submit all reports?")) {
                await submitAllReports(Object.values(savedReports), tutor);
            }
        });
        
        document.querySelectorAll('.summer-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                if (confirm("Mark student as on summer break?")) {
                    await updateDoc(doc(db, "students", e.target.dataset.studentId), { summerBreak: true });
                }
            });
        });
    }
}

// ### FIXED ### This function now saves one document per student report.
async function submitAllReports(reportsArray, tutor) {
    if (reportsArray.length === 0) return alert("No reports saved to submit.");

    const batch = writeBatch(db);
    reportsArray.forEach(report => {
        const newReportRef = doc(collection(db, "tutor_submissions"));
        batch.set(newReportRef, {
            ...report,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            submittedAt: new Date(),
            status: "submitted"
        });
    });

    try {
        await batch.commit();
        alert(`Successfully submitted ${reportsArray.length} report(s)!`);
        // We don't need to clear savedReports because the view will re-render
    } catch (error) {
        console.error("Error submitting reports:", error);
        alert(`Error: ${error.message}`);
    }
}


// --- Main App Initialization ---
function initializeTutorPanel() {
    const mainContent = document.getElementById('mainContent');
    const navDashboard = document.getElementById('navDashboard');
    const navStudentDatabase = document.getElementById('navStudentDatabase');

    function setActiveNav(activeButton) {
        [navDashboard, navStudentDatabase].forEach(nav => nav.classList.remove('active'));
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => {
        setActiveNav(navDashboard);
        renderTutorDashboard(mainContent, window.tutorData);
        // ### NEW ### Call management module render here
        const managementContainer = document.getElementById('management-module');
        if (managementContainer) {
            renderManagementFeeModule(managementContainer, window.tutorData);
        }
    });
    navStudentDatabase.addEventListener('click', () => {
        setActiveNav(navStudentDatabase);
        renderStudentDatabase(mainContent, window.tutorData);
    });

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
            logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "tutor-auth.html"));
        } else {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "tutor-auth.html";
    }
});
