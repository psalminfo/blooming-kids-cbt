import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
// NEW: Global state for new admin settings
let showStudentFees = false;
let showEditDeleteButtons = false;

// Listen for changes to the admin settings in real-time
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;
        isBypassApprovalEnabled = data.bypassPendingApproval;
        // NEW: Update the new global settings
        showStudentFees = data.showStudentFees;
        showEditDeleteButtons = data.showEditDeleteButtons;

        // Re-render the student database if the page is currently active
        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// ##################################################################
// # SECTION 1: TUTOR DASHBOARD
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
                        ${(data.status === 'pending_review') ?
                            `<textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>`
                            : `<p class="mt-2"><strong>Tutor's Report:</strong> ${data.tutorReport || 'N/A'}</p>`
                        }
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
// # SECTION 2: STUDENT DATABASE (MERGED FUNCTIONALITY)
// ##################################################################

// Helper function to generate the new student form fields
function getNewStudentFormFields() {
    // Generate Grade Options
    const gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool">Preschool</option>
        <option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;

    // Generate Fee Options
    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 20000; fee <= 200000; fee += 5000) {
        feeOptions += `<option value="${fee}">${fee.toLocaleString()}</option>`;
    }
    
    // Define Subjects
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa"],
        "Tech Courses": ["Coding", "Stop motion animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Child counseling programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="new-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="subjects" value="${subject}"> ${subject}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="subjects" value="Music"> Music</label></div>
    </div>`;

    return `
        <input type="text" id="new-parent-name" class="w-full mt-1 p-2 border rounded" placeholder="Parent Name">
        <input type="tel" id="new-parent-phone" class="w-full mt-1 p-2 border rounded" placeholder="Parent Phone Number">
        <input type="text" id="new-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">
        <select id="new-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select>
        ${subjectsHTML}
        <select id="new-student-days" class="w-full mt-1 p-2 border rounded">
            <option value="">Select Days per Week</option>
            ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
        <select id="new-student-fee" class="w-full mt-1 p-2 border rounded">${feeOptions}</select>
    `;
}

// Function to handle grade string formatting
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
}

// Function to show the edit student modal
function showEditStudentModal(student) {
    // Generate Grade Options with the current grade selected
    let gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool" ${student.grade === 'Preschool' ? 'selected' : ''}>Preschool</option>
        <option value="Kindergarten" ${student.grade === 'Kindergarten' ? 'selected' : ''}>Kindergarten</option>
    `;
    for (let i = 1; i <= 12; i++) {
        const gradeValue = `Grade ${i}`;
        gradeOptions += `<option value="${gradeValue}" ${student.grade === gradeValue ? 'selected' : ''}>${gradeValue}</option>`;
    }
    gradeOptions += `
        <option value="Pre-College" ${student.grade === 'Pre-College' ? 'selected' : ''}>Pre-College</option>
        <option value="College" ${student.grade === 'College' ? 'selected' : ''}>College</option>
        <option value="Adults" ${student.grade === 'Adults' ? 'selected' : ''}>Adults</option>
    `;

    // Generate Fee Options with the current fee selected
    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 20000; fee <= 200000; fee += 5000) {
        feeOptions += `<option value="${fee}" ${student.studentFee === fee ? 'selected' : ''}>${fee.toLocaleString()}</option>`;
    }
    
    // Generate Days Options with the current days selected
    let daysOptions = '<option value="">Select Days per Week</option>';
    for (let i = 1; i <= 7; i++) {
        daysOptions += `<option value="${i}" ${student.days == i ? 'selected' : ''}>${i}</option>`;
    }

    // Define Subjects
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa"],
        "Tech Courses": ["Coding", "Stop motion animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Child counseling programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="edit-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => {
                        const isChecked = student.subjects && student.subjects.includes(subject);
                        return `<div><label class="text-sm font-normal"><input type="checkbox" name="edit-subjects" value="${subject}" ${isChecked ? 'checked' : ''}> ${subject}</label></div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="edit-subjects" value="Music" ${student.subjects && student.subjects.includes('Music') ? 'checked' : ''}> Music</label></div>
    </div>`;

    const editFormHTML = `
        <h3 class="text-xl font-bold mb-4">Edit Student: ${student.studentName}</h3>
        <div class="space-y-4">
            <div>
                <label class="block font-semibold">Parent Name</label>
                <input type="text" id="edit-parent-name" class="w-full mt-1 p-2 border rounded" value="${student.parentName || ''}" placeholder="Parent Name">
            </div>
            <div>
                <label class="block font-semibold">Parent Phone Number</label>
                <input type="tel" id="edit-parent-phone" class="w-full mt-1 p-2 border rounded" value="${student.parentPhone || ''}" placeholder="Parent Phone Number">
            </div>
            <div>
                <label class="block font-semibold">Student Name</label>
                <input type="text" id="edit-student-name" class="w-full mt-1 p-2 border rounded" value="${student.studentName || ''}" placeholder="Student Name">
            </div>
            <div>
                <label class="block font-semibold">Grade</label>
                <select id="edit-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select>
            </div>
            ${subjectsHTML}
            <div>
                <label class="block font-semibold">Days per Week</label>
                <select id="edit-student-days" class="w-full mt-1 p-2 border rounded">${daysOptions}</select>
            </div>
            <div>
                <label class="block font-semibold">Fee (₦)</label>
                <select id="edit-student-fee" class="w-full mt-1 p-2 border rounded">${feeOptions}</select>
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-edit-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                <button id="save-edit-btn" class="bg-green-600 text-white px-6 py-2 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Save Changes</button>
            </div>
        </div>`;

    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    editModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${editFormHTML}</div>`;
    document.body.appendChild(editModal);

    document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.remove());
    document.getElementById('save-edit-btn').addEventListener('click', async (e) => {
        const studentId = e.target.getAttribute('data-student-id');
        const collectionName = e.target.getAttribute('data-collection');
        
        const parentName = document.getElementById('edit-parent-name').value.trim();
        const parentPhone = document.getElementById('edit-parent-phone').value.trim();
        const studentName = document.getElementById('edit-student-name').value.trim();
        const studentGrade = document.getElementById('edit-student-grade').value.trim();
        
        const selectedSubjects = [];
        document.querySelectorAll('input[name="edit-subjects"]:checked').forEach(checkbox => {
            selectedSubjects.push(checkbox.value);
        });

        const studentDays = document.getElementById('edit-student-days').value.trim();
        const studentFee = parseFloat(document.getElementById('edit-student-fee').value);

        if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
            showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
            return;
        }

        try {
            const studentData = {
                parentName: parentName,
                parentPhone: parentPhone,
                studentName: studentName,
                grade: studentGrade,
                subjects: selectedSubjects,
                days: studentDays,
                studentFee: studentFee
            };

            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, studentData);
            
            editModal.remove();
            showCustomAlert('Student details updated successfully!');
            
            // Refresh the student database view
            const mainContent = document.getElementById('mainContent');
            renderStudentDatabase(mainContent, window.tutorData);
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`An error occurred: ${error.message}`);
        }
    });
}

async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    let savedReports = {};

    // Fetch both approved and pending students
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery)
    ]);
    const approvedStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }));
    const pendingStudents = pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: true, collection: "pending_students" }));

    let students = [...approvedStudents, ...pendingStudents];

    // Duplicate Student Cleanup
    const seenStudents = new Set();
    const duplicatesToDelete = [];
    students = students.filter(student => {
        const studentIdentifier = `${student.studentName}-${student.tutorEmail}`;
        if (seenStudents.has(studentIdentifier)) {
            duplicatesToDelete.push({ id: student.id, collection: student.collection });
            return false;
        }
        seenStudents.add(studentIdentifier);
        return true;
    });
    if (duplicatesToDelete.length > 0) {
        const batch = writeBatch(db);
        duplicatesToDelete.forEach(dup => {
            batch.delete(doc(db, dup.collection, dup.id));
        });
        await batch.commit();
        console.log(`Cleaned up ${duplicatesToDelete.length} duplicate student entries.`);
    }

    const studentsCount = students.length;

    function renderUI() {
        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;
        if (isTutorAddEnabled) {
            studentsHTML += `
                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                    <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                    <div class="space-y-2">
                        ${getNewStudentFormFields()}
                    </div>
                    <button id="add-student-btn" class="bg-green-600 text-white px-4 py-2 rounded mt-3 hover:bg-green-700">Add Student</button>
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

                // NEW: Check global settings to show fees
                const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                
                let statusHTML = '';
                let actionsHTML = '';
                
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} days/week` : 'N/A';

                if (student.isPending) {
                    statusHTML = `<span class="status-indicator text-yellow-600 font-semibold">Awaiting Approval</span>`;
                    actionsHTML = `<span class="text-gray-400">No actions available</span>`;
                } else {
                    statusHTML = `<span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span>`;

                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                    } else if (isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">On Break</span>`;
                    }

                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                    
                    // NEW: Add Edit/Delete buttons if enabled by admin
                    if (showEditDeleteButtons && !isStudentOnBreak) {
                        actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Edit</button>`;
                        actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Delete</button>`;
                    }
                }
                
                studentsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${student.studentName} (${cleanGradeString(student.grade)})
                            <div class="text-xs text-gray-500">Subjects: ${subjects} | Days: ${days}</div>
                            ${feeDisplay}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">${statusHTML}</td>
                        <td class="px-6 py-4 whitespace-nowrap space-x-2">${actionsHTML}</td>
                    </tr>`;
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

            if (approvedStudents.length > 1 && isSubmissionEnabled) {
                const submittableStudents = approvedStudents.filter(s => !s.summerBreak).length;
                const allReportsSaved = Object.keys(savedReports).length === submittableStudents;
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
        const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak).length === 1;
        
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
                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
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
                parentName: student.parentName, parentPhone: student.parentPhone,
                introduction: document.getElementById('report-intro').value,
                topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value,
                strengthsWeaknesses: document.getElementById('report-sw').value,
                recommendations: document.getElementById('report-recs').value,
                generalComments: document.getElementById('report-general').value
            };

            reportModal.remove();

            if (isSingleApprovedStudent) {
                showAccountDetailsModal([reportData]);
            } else {
                savedReports[student.id] = reportData;
                showCustomAlert(`${student.studentName}'s report has been saved.`);
                renderUI();
            }
        });
    }

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
                ...report,
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

    function showCustomAlert(message) {
        const alertModal = document.createElement('div');
        alertModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        alertModal.innerHTML = `
            <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                <p class="mb-4">${message}</p>
                <button id="alert-ok-btn" class="bg-green-600 text-white px-6 py-2 rounded float-right">OK</button>
            </div>`;
        document.body.appendChild(alertModal);
        document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
    }

    function attachEventListeners() {
        // Add new student
        if (isTutorAddEnabled) {
            document.getElementById('add-student-btn').addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value.trim();
                const parentPhone = document.getElementById('new-parent-phone').value.trim();
                const studentName = document.getElementById('new-student-name').value.trim();
                const studentGrade = document.getElementById('new-student-grade').value.trim();
                
                const selectedSubjects = [];
                document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => {
                    selectedSubjects.push(checkbox.value);
                });

                const studentDays = document.getElementById('new-student-days').value.trim();
                const studentFee = parseFloat(document.getElementById('new-student-fee').value);

                if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
                    showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
                    return;
                }

                const studentData = {
                    parentName: parentName,
                    parentPhone: parentPhone,
                    studentName: studentName,
                    grade: studentGrade,
                    subjects: selectedSubjects,
                    days: studentDays,
                    studentFee: studentFee,
                    tutorEmail: tutor.email,
                    tutorName: tutor.name
                };

                try {
                    if (isBypassApprovalEnabled) {
                        await addDoc(collection(db, "students"), studentData);
                        showCustomAlert('Student added successfully!');
                    } else {
                        await addDoc(collection(db, "pending_students"), studentData);
                        showCustomAlert('Student added and is pending approval.');
                    }
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`An error occurred: ${error.message}`);
                }
            });
        }

        // Enter/edit report
        document.querySelectorAll('.enter-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        // Submit single report
        document.querySelectorAll('.submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        // Summer break
        document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                const studentRef = doc(db, "students", studentId);
                await updateDoc(studentRef, { summerBreak: true });
                showCustomAlert(`${student.studentName} has been marked as on summer break.`);
                renderStudentDatabase(container, tutor);
            });
        });

        // Submit all reports
        const submitAllBtn = document.getElementById('submit-all-reports-btn');
        if (submitAllBtn) {
            submitAllBtn.addEventListener('click', () => {
                const reportsToSubmit = Object.values(savedReports);
                showAccountDetailsModal(reportsToSubmit);
            });
        }

        // Save management fee
        const saveFeeBtn = document.getElementById('save-management-fee-btn');
        if (saveFeeBtn) {
            saveFeeBtn.addEventListener('click', async () => {
                const newFee = parseFloat(document.getElementById('management-fee-input').value);
                if (isNaN(newFee) || newFee < 0) {
                    showCustomAlert("Please enter a valid fee amount.");
                    return;
                }
                const tutorRef = doc(db, "tutors", tutor.id);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert("Management fee updated successfully.");
                window.tutorData.managementFee = newFee;
            });
        }
        
        // NEW: Edit student button
        document.querySelectorAll('.edit-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                if (student) {
                    showEditStudentModal(student);
                }
            });
        });

        // NEW: Delete student button
        document.querySelectorAll('.delete-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                
                if (student && confirm(`Are you sure you want to delete ${student.studentName}? This action cannot be undone.`)) {
                    try {
                        await deleteDoc(doc(db, collectionName, studentId));
                        showCustomAlert('Student deleted successfully!');
                        renderStudentDatabase(container, tutor);
                    } catch (error) {
                        console.error("Error deleting student:", error);
                        showCustomAlert(`An error occurred: ${error.message}`);
                    }
                }
            });
        });
    }

    renderUI();
}

// ##################################################################
// # SECTION 3: MAIN APP INITIALIZATION
// ##################################################################
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email));
            const querySnapshot = await getDocs(tutorQuery);
            if (!querySnapshot.empty) {
                const tutorDoc = querySnapshot.docs[0];
                const tutorData = { id: tutorDoc.id, ...tutorDoc.data() };
                window.tutorData = tutorData;
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
            } else {
                console.error("No matching tutor found.");
                document.getElementById('mainContent').innerHTML = `<p class="text-red-500">Error: No tutor profile found for your email.</p>`;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch(error => {
            console.error("Error signing out:", error);
        });
    });

    document.getElementById('navDashboard').addEventListener('click', () => {
        if (window.tutorData) {
            renderTutorDashboard(document.getElementById('mainContent'), window.tutorData);
        }
    });

    document.getElementById('navStudentDatabase').addEventListener('click', () => {
        if (window.tutorData) {
            renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
        }
    });
});
