import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut, onIdTokenChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const functions = getFunctions();

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

// Updated to check report submission status
async function loadTutorReports(tutorEmail, parentEmail = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
    pendingReportsContainer.innerHTML = `<p class="text-gray-500">Loading pending submissions...</p>`;
    if(gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading graded submissions...</p>`;
    
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
                        ${(data.status === 'pending_review' && isSubmissionEnabled) ? `
                            <textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>
                        ` : `
                            <p class="mt-2 text-red-500">Submissions are currently disabled by the admin.</p>
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
        if(gradedReportsContainer) gradedReportsContainer.innerHTML = gradedHTML || `<p class="text-gray-500">No graded submissions found.</p>`;
        
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
        if(gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}

// NEW: Student Database View
async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const studentsSnapshot = await getDocs(studentQuery);
    const studentsCount = studentsSnapshot.docs.length;
    let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students</h2>`;

    if (isTutorAddEnabled) {
        studentsHTML += `
            <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                <input type="text" id="new-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">
                <select id="new-student-grade" class="w-full mt-1 p-2 border rounded">
                    <option value="">Select Grade</option>
                    ${Array.from({length: 12}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
                <input type="text" id="new-student-subject" class="w-full mt-1 p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">
                <select id="new-student-days" class="w-full mt-1 p-2 border rounded">
                    <option value="">Select Days</option>
                    ${Array.from({length: 7}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
                <input type="number" id="new-student-fee" class="w-full mt-1 p-2 border rounded" placeholder="Student Fee">
                <button id="add-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Add Student</button>
            </div>
        `;
    }

    studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;
    
    if (studentsSnapshot.empty) {
        studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        return;
    }

    studentsHTML += `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject(s)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days of Class</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
    
    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        const isStudentOnBreak = student.summerBreak;
        studentsHTML += `<tr><td class="px-6 py-4 whitespace-nowrap">${student.studentName}</td><td class="px-6 py-4 whitespace-nowrap">${student.grade}</td><td class="px-6 py-4 whitespace-nowrap">${student.subjects.join(', ')}</td><td class="px-6 py-4 whitespace-nowrap">${student.days}</td><td class="px-6 py-4 whitespace-nowrap space-x-2">`;
        
        // Corrected syntax for button display
        if (isSummerBreakEnabled && !isStudentOnBreak) {
             studentsHTML += `<button class="summer-break-btn bg-yellow-600 text-white px-3 py-1 rounded" data-student-id="${doc.id}">Summer Break</button>`;
        } else if (isStudentOnBreak) {
            studentsHTML += `<span class="text-gray-400">On Break</span>`;
        }

        if (isSubmissionEnabled && !isStudentOnBreak) {
            studentsHTML += `<button class="submit-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${doc.id}">Submit Report</button>`;
        } else {
             studentsHTML += `<span class="text-gray-400">Not Enabled</span>`;
        }
        
        studentsHTML += `</td></tr>`;
    });
    
    studentsHTML += `</tbody></table></div>`;
    container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;

    document.querySelectorAll('.summer-break-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
             if (confirm("Are you sure you want to mark this student as on summer break?")) {
                await updateDoc(doc(db, "students", studentId), { summerBreak: true });
                renderStudentDatabase(container, tutor);
            }
        });
    });

     if (isTutorAddEnabled) {
         document.getElementById('add-student-btn').addEventListener('click', async () => {
            const studentName = document.getElementById('new-student-name').value;
            const studentGrade = document.getElementById('new-student-grade').value;
            const subjects = document.getElementById('new-student-subject').value.split(',').map(s => s.trim());
            const days = document.getElementById('new-student-days').value;
            const studentFee = parseFloat(document.getElementById('new-student-fee').value);
             if (studentName && studentGrade && subjects.length && days && !isNaN(studentFee)) {
                await addDoc(collection(db, "students"), {
                    studentName, grade: studentGrade, subjects, days, tutorEmail: tutor.email, studentFee, summerBreak: false
                });
                document.getElementById('new-student-name').value = '';
                document.getElementById('new-student-grade').value = '';
                document.getElementById('new-student-subject').value = '';
                document.getElementById('new-student-days').value = '';
                document.getElementById('new-student-fee').value = '';
                renderStudentDatabase(container, tutor);
            } else {
                alert('Please fill in all student details correctly.');
            }
        });
    }

     document.querySelectorAll('.submit-report-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const studentDoc = await getDoc(doc(db, "students", studentId));
            const studentData = studentDoc.data();
            
            // Show a structured report form
            const reportFormHTML = `
                <h3 class="text-xl font-bold mb-4">Submit Report for ${studentData.studentName}</h3>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">Introduction</label>
                    <textarea id="report-intro" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., This is a comprehensive report on BRYAN’s progress..."></textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">Topics & Remarks</label>
                    <textarea id="report-topics" class="w-full mt-1 p-2 border rounded" rows="3" placeholder="e.g., Math: Multiplication, Remark: Bryan is doing well..."></textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">Progress & Achievements</label>
                    <textarea id="report-progress" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., We will surely have some good reports soon..."></textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">Strengths & Weaknesses</label>
                    <textarea id="report-sw" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., Strengths: Good attitude. Weaknesses: Needs to focus more."></textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">Recommendations</label>
                    <textarea id="report-recs" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., I would like to ask for him to be allowed to focus while in class, less distractions."></textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-semibold">General Comments</label>
                    <textarea id="report-general" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., Bryan is always smiling; he is always happy..."></textarea>
                </div>
                <button id="submit-structured-report-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Submit Report</button>
                <button id="cancel-report-btn" class="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500 ml-2">Cancel</button>
            `;
            const reportModal = document.createElement('div');
            reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center';
            reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl max-w-lg mx-auto">${reportFormHTML}</div>`;
            document.body.appendChild(reportModal);

            document.getElementById('cancel-report-btn').addEventListener('click', () => {
                reportModal.remove();
            });

            document.getElementById('submit-structured-report-btn').addEventListener('click', async () => {
                const reportData = {
                    introduction: document.getElementById('report-intro').value,
                    topics: document.getElementById('report-topics').value,
                    progress: document.getElementById('report-progress').value,
                    strengthsWeaknesses: document.getElementById('report-sw').value,
                    recommendations: document.getElementById('report-recs').value,
                    generalComments: document.getElementById('report-general').value
                };
                
                // Add a unique ID for the submission
                const submissionId = doc(collection(db, "tutor_submissions")).id;
                
                const processSubmission = httpsCallable(functions, 'processTutorSubmission');
                try {
                    const result = await processSubmission({
                        studentId: studentId,
                        reportData: reportData,
                        submissionId: submissionId
                    });
                    alert(result.data.message);
                    reportModal.remove();
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    alert(`Error submitting report: ${error.message}`);
                }
            });
        });
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
    
    renderTutorDashboard(mainContent, window.tutorData);
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