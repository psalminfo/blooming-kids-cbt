// [Begin Complete management.js File]

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ##################################
// # SESSION CACHE & STATE (NOW PERSISTENT)
// ##################################

const CACHE_PREFIX = 'management_cache_';

// The in-memory cache that will be populated from localStorage on load.
const sessionCache = {
    tutors: null,
    students: null,
    pendingStudents: null,
    reports: null,
    breakStudents: null,
    parentFeedback: null,
    // --- NEW: Referral Approvals Cache ---
    pendingReferrals: null,
};

/**
 * Saves a specific piece of data to localStorage.
 * @param {string} key The key for the cache (e.g., 'tutors').
 * @param {any} data The data to store.
 */
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        sessionCache[key] = data; // Also update the in-memory cache
    } catch (error) {
        console.error("Could not save to localStorage:", error);
    }
}

/**
 * Loads all cached data from localStorage into the sessionCache object.
 */
function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const storedData = localStorage.getItem(CACHE_PREFIX + key);
            if (storedData) {
                sessionCache[key] = JSON.parse(storedData);
            }
        } catch (error) {
            console.error(`Could not load '${key}' from localStorage:`, error);
            localStorage.removeItem(CACHE_PREFIX + key); // Clear corrupted data
        }
    }
}

/**
 * Invalidates (clears) a specific cache from memory and localStorage.
 * @param {string} key The key of the cache to clear.
 */
function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}

// Load any persisted data as soon as the script runs
loadFromLocalStorage();

// Session-level state for the Pay Advice gift feature.
let payAdviceGifts = {};
let currentPayData = [];

// Utility function to capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ### UPDATED FUNCTION (Original) ###
// Utility function to convert data to CSV, now includes gift and final pay details
function convertPayAdviceToCSV(data) {
    const header = [
        'Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)',
        'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name'
    ];
    const rows = data.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return [
            `"${item.tutorName}"`,
            item.studentCount,
            item.totalStudentFees,
            item.managementFee,
            item.totalPay,
            giftAmount,
            finalPay,
            `"${item.beneficiaryBank || 'N/A'}"`,
            `"${item.beneficiaryAccount || 'N/A'}"`,
            `"${item.beneficiaryName || 'N/A'}"`
        ];
    });
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// ##################################
// # ACTION HANDLER FUNCTIONS
// ##################################

async function handleEditStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "students");
    } catch (error) {
        console.error("Error fetching student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

async function handleEditPendingStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "pending_students", studentId));
        if (!studentDoc.exists()) {
            alert("Pending student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "pending_students");
    } catch (error) {
        console.error("Error fetching pending student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

function showEditStudentModal(studentId, studentData, collectionName) {
    const modalHtml = `
        <div id="edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('edit-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects ? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('edit-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const editedId = form.elements['edit-student-id'].value;
        const targetCollection = form.elements['edit-collection-name'].value;
        const updatedData = {
            studentName: form.elements['edit-studentName'].value,
            grade: form.elements['edit-grade'].value,
            days: form.elements['edit-days'].value,
            subjects: form.elements['edit-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['edit-parentName'].value,
            parentPhone: form.elements['edit-parentPhone'].value,
            studentFee: Number(form.elements['edit-studentFee'].value) || 0,
        };
        try {
            await updateDoc(doc(db, targetCollection, editedId), updatedData);
            alert("Student details updated successfully!");
            document.getElementById('edit-modal').remove();
            // Invalidate cache and re-render the relevant view
            if (targetCollection === 'students') {
                invalidateCache('students');
                renderManagementTutorView(document.getElementById('main-content'));
            } else {
                invalidateCache('pendingStudents');
                renderPendingApprovalsPanel(document.getElementById('main-content'));
            }
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to save changes. Check the console for details.");
        }
    });
}

function showAssignStudentModal() {
    const tutors = sessionCache.tutors || [];
    if (tutors.length === 0) {
        alert("Tutor list is not available. Please refresh the directory and try again.");
        return;
    }

    const tutorOptions = tutors
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => `<option value='${JSON.stringify({email: tutor.email, name: tutor.name})}'>${tutor.name} (${tutor.email})</option>`)
        .join('');

    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('assign-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Assign New Student</h3>
                <form id="assign-student-form">
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Assign to Tutor</label>
                        <select id="assign-tutor" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="" disabled selected>Select a tutor...</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="assign-studentName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="assign-grade" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="assign-days" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="assign-subjects" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="assign-parentName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="assign-parentPhone" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="assign-studentFee" required value="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const selectedTutorData = JSON.parse(form.elements['assign-tutor'].value);

        const newStudentData = {
            studentName: form.elements['assign-studentName'].value,
            grade: form.elements['assign-grade'].value,
            days: form.elements['assign-days'].value,
            subjects: form.elements['assign-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['assign-parentName'].value,
            parentPhone: form.elements['assign-parentPhone'].value,
            studentFee: Number(form.elements['assign-studentFee'].value) || 0,
            tutorEmail: selectedTutorData.email,
            tutorName: selectedTutorData.name,
            status: 'approved',
            summerBreak: false,
            createdAt: Timestamp.now()
        };

        try {
            await addDoc(collection(db, "students"), newStudentData);
            alert(`Student "${newStudentData.studentName}" assigned successfully to ${newStudentData.tutorName}!`);
            document.getElementById('assign-modal').remove();
            invalidateCache('students');
            fetchAndRenderDirectory(true);
        } catch (error) {
            console.error("Error assigning student: ", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });
}

async function handleDeleteStudent(studentId) {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            alert("Student deleted successfully!");
            invalidateCache('students'); // Invalidate cache
            renderManagementTutorView(document.getElementById('main-content')); // Rerender
        } catch (error) {
            console.error("Error removing student: ", error);
            alert("Error deleting student. Check the console for details.");
        }
    }
}

async function handleApproveStudent(studentId) {
    if (confirm("Are you sure you want to approve this student?")) {
        try {
            const studentRef = doc(db, "pending_students", studentId);
            const studentDoc = await getDoc(studentRef);
            if (!studentDoc.exists()) {
                alert("Student not found.");
                return;
            }
            const studentData = studentDoc.data();
            const batch = writeBatch(db);
            const newStudentRef = doc(db, "students", studentId);
            batch.set(newStudentRef, { ...studentData, status: 'approved' });
            batch.delete(studentRef);
            await batch.commit();
            alert("Student approved successfully!");
            invalidateCache('pendingStudents'); // Invalidate cache
            invalidateCache('students');
            fetchAndRenderPendingApprovals(); // Re-fetch and render the current panel
        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will delete their entry.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected successfully!");
            invalidateCache('pendingStudents'); // Invalidate cache
            fetchAndRenderPendingApprovals(); // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// --- NEW: Referral Transaction Approval Handler ---
async function handleApproveReferralTransaction(transactionId, referrerEmail, rewardAmount) {
    if (confirm(`Approve this referral transaction for ₦${rewardAmount.toLocaleString()}? This will credit the referrer's account.`)) {
        try {
            const batch = writeBatch(db);

            // 1. Update the referral transaction status to 'Approved'
            const transactionRef = doc(db, "referral_transactions", transactionId);
            batch.update(transactionRef, {
                status: 'Approved',
                approvedAt: Timestamp.now()
            });

            // 2. Atomically update the referring parent's totalReferralEarnings
            const parentRef = doc(db, "parents", referrerEmail);
            
            // Get the current earnings before the batch is committed.
            const parentDoc = await getDoc(parentRef);
            const currentEarnings = parentDoc.exists() ? (parentDoc.data().totalReferralEarnings || 0) : 0;
            const newEarnings = currentEarnings + rewardAmount;
            
            // Use set with merge: true to update/create the earnings field without overwriting other parent data
            batch.set(parentRef, { totalReferralEarnings: newEarnings }, { merge: true });
            
            await batch.commit();
            alert(`Referral transaction approved and parent's earnings credited with ₦${rewardAmount.toLocaleString()}!`);

            // Invalidate cache and re-fetch
            invalidateCache('pendingReferrals');
            fetchAndRenderPendingApprovals();

        } catch (error) {
            console.error("Error approving referral transaction: ", error);
            alert("Error approving referral transaction. Check the console for details.");
        }
    }
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// --- Tutor & Student Directory Panel (Original) ---
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents..." class="p-2 border rounded-md w-64">
                    <button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign New Student</button>
                    <button id="refresh-directory-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                    <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                    <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    document.getElementById('assign-student-btn').addEventListener('click', showAssignStudentModal);
    document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
    document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
    fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors');
        invalidateCache('students');
    }

    try {
        // If cache is empty, fetch from server. Otherwise, the existing cache (from localStorage) will be used.
        if (!sessionCache.tutors || !sessionCache.students) {
            document.getElementById('directory-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;

            const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "tutors"), orderBy("name"))),
                getDocs(collection(db, "students"))
            ]);

            // Save newly fetched data to localStorage
            saveToLocalStorage('tutors', tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            saveToLocalStorage('students', studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        renderDirectoryFromCache();
    } catch (error) {
        console.error("Error fetching directory data:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const directoryList = document.getElementById('directory-list');
    if (!directoryList) return;

    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No directory data found. Click Refresh to fetch from the server.</p>`;
        return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const studentsByTutor = {};
    students.forEach(student => {
        if (!studentsByTutor[student.tutorEmail]) {
            studentsByTutor[student.tutorEmail] = [];
        }
        studentsByTutor[student.tutorEmail].push(student);
    });

    const filteredTutors = tutors.filter(tutor => {
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || tutor.email.toLowerCase().includes(lowerCaseSearchTerm);
        const studentMatch = assignedStudents.some(s =>
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (s.parentPhone && s.parentPhone.includes(lowerCaseSearchTerm))
        );
        return tutorMatch || studentMatch;
    });

    const tutorHtml = filteredTutors.map(tutor => {
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const studentListHtml = assignedStudents
            .filter(s => {
                if (!searchTerm) return true; // Show all if no search
                return s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                       (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                       (s.parentPhone && s.parentPhone.includes(lowerCaseSearchTerm));
            })
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(student => `
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded-md border-l-4 border-yellow-500 hover:bg-gray-100">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-800">${student.studentName} (Gr. ${student.grade})</p>
                        <p class="text-xs text-gray-500">Parent: ${student.parentName || 'N/A'} (${student.parentPhone || 'N/A'})</p>
                        <p class="text-xs text-gray-500">Fee: ₦${(student.studentFee || 0).toLocaleString()} | Subjects: ${student.subjects ? student.subjects.join(', ') : 'N/A'}</p>
                    </div>
                    <div class="space-x-2">
                        <button onclick="handleEditStudent('${student.id}')" class="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600">Edit</button>
                        <button onclick="handleDeleteStudent('${student.id}')" class="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">Delete</button>
                    </div>
                </div>
            `).join('');

        const tutorClasses = `bg-white p-5 rounded-lg shadow-lg border-l-8 border-green-600 ${assignedStudents.length === 0 ? 'opacity-70' : ''}`;
        
        return `
            <div class="${tutorClasses}">
                <div class="flex justify-between items-center">
                    <h3 class="text-xl font-bold text-green-700">${tutor.name} (${assignedStudents.length})</h3>
                    <span class="text-sm text-gray-500">${tutor.email}</span>
                </div>
                <div class="mt-4 space-y-2">
                    ${studentListHtml || '<p class="text-center text-gray-400 p-2">No students assigned or matching search term.</p>'}
                </div>
            </div>
        `;
    }).join('');

    if (filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No tutors or students match your search term.</p>`;
    } else {
        directoryList.innerHTML = tutorHtml;
    }

    // Update badges
    if (document.getElementById('tutor-count-badge')) document.getElementById('tutor-count-badge').textContent = tutors.length.toLocaleString();
    if (document.getElementById('student-count-badge')) document.getElementById('student-count-badge').textContent = students.length.toLocaleString();
}

// --- Tutor Reports Panel (Original) ---
async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-blue-700">Tutor Reports</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="report-search" placeholder="Search by Tutor/Student" class="p-2 border rounded-md w-64">
                    <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            <div id="report-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading reports...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-reports-btn').addEventListener('click', () => fetchAndRenderReports(true));
    document.getElementById('report-search').addEventListener('input', (e) => renderReportsFromCache(e.target.value));
    fetchAndRenderReports();
}

async function fetchAndRenderReports(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('reports');
    }

    try {
        if (!sessionCache.reports) {
            document.getElementById('report-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching reports from server...</p>`;
            
            const reportsSnapshot = await getDocs(query(collection(db, "tutor_reports"), orderBy("timestamp", "desc")));
            
            const fetchedReports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('reports', fetchedReports);
        }

        renderReportsFromCache();

    } catch (error) {
        console.error("Error fetching tutor reports:", error);
        document.getElementById('report-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load reports.</p>`;
    }
}

function renderReportsFromCache(searchTerm = '') {
    const reports = sessionCache.reports || [];
    const reportList = document.getElementById('report-list');
    if (!reportList) return;

    if (reports.length === 0) {
        reportList.innerHTML = `<p class="text-center text-gray-500 py-10">No tutor reports found.</p>`;
        return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredReports = reports.filter(report => {
        return report.tutorName.toLowerCase().includes(lowerCaseSearchTerm) ||
               report.studentName.toLowerCase().includes(lowerCaseSearchTerm);
    });

    const reportsHtml = filteredReports.map(report => {
        const date = new Date(report.timestamp.seconds * 1000).toLocaleDateString();
        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-blue-700">${report.tutorName} - ${report.studentName}</h3>
                    <span class="text-sm text-gray-500">${date}</span>
                </div>
                <p class="text-sm mt-2 text-gray-700">
                    <span class="font-semibold">Subject:</span> ${capitalize(report.subject)} | 
                    <span class="font-semibold">Grade:</span> ${report.grade}
                </p>
                <p class="text-sm mt-2">
                    <span class="font-semibold text-gray-800">Summary:</span> 
                    ${report.summary.substring(0, 150)}${report.summary.length > 150 ? '...' : ''}
                </p>
                <button onclick="showReportModal('${report.id}')" class="mt-3 text-blue-500 hover:text-blue-700 font-semibold text-sm">View Full Report</button>
            </div>
        `;
    }).join('');

    if (filteredReports.length === 0) {
        reportList.innerHTML = `<p class="text-center text-gray-500 py-10">No reports match your search term.</p>`;
    } else {
        reportList.innerHTML = reportsHtml;
    }
}

async function showReportModal(reportId) {
    const report = sessionCache.reports.find(r => r.id === reportId);
    if (!report) {
        alert("Report data not found in cache.");
        return;
    }

    const date = new Date(report.timestamp.seconds * 1000).toLocaleString();

    const modalHtml = `
        <div id="report-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('report-modal').remove()">&times;</button>
                <h3 class="text-2xl font-bold mb-4 text-blue-700">${report.studentName}'s Report</h3>
                <div class="border-b pb-2 mb-4 text-sm text-gray-600">
                    <p><span class="font-semibold">Tutor:</span> ${report.tutorName} (${report.tutorEmail})</p>
                    <p><span class="font-semibold">Date:</span> ${date}</p>
                    <p><span class="font-semibold">Subject & Grade:</span> ${capitalize(report.subject)} (Gr. ${report.grade})</p>
                </div>
                <div class="space-y-4 max-h-96 overflow-y-auto pr-4">
                    <p><span class="font-bold text-gray-800">Summary:</span> ${report.summary}</p>
                    <p><span class="font-bold text-gray-800">Strengths:</span> ${report.strengths}</p>
                    <p><span class="font-bold text-gray-800">Areas for Improvement:</span> ${report.improvements}</p>
                    <p><span class="font-bold text-gray-800">Next Steps:</span> ${report.nextSteps}</p>
                    <p><span class="font-bold text-gray-800">Assignment:</span> ${report.assignment || 'N/A'}</p>
                </div>
                <div class="flex justify-end mt-4">
                    <button type="button" onclick="document.getElementById('report-modal').remove()" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- Parent Feedback Panel (Original) ---
async function renderParentFeedbackPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-purple-700">Parent Feedback & Responses</h2>
                <button id="refresh-feedback-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="feedback-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading feedback...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-feedback-btn').addEventListener('click', () => fetchAndRenderFeedback(true));
    fetchAndRenderFeedback();
}

async function fetchAndRenderFeedback(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('parentFeedback');
    }

    try {
        if (!sessionCache.parentFeedback) {
            document.getElementById('feedback-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching feedback from server...</p>`;
            
            // Assuming a 'parent_feedback' collection
            const feedbackSnapshot = await getDocs(query(collection(db, "parent_feedback"), orderBy("timestamp", "desc")));
            
            const fetchedFeedback = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('parentFeedback', fetchedFeedback);
        }

        renderFeedbackFromCache();

    } catch (error) {
        console.error("Error fetching parent feedback:", error);
        document.getElementById('feedback-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load feedback.</p>`;
    }
}

function renderFeedbackFromCache() {
    const feedbackList = sessionCache.parentFeedback || [];
    const feedbackContainer = document.getElementById('feedback-list');
    if (!feedbackContainer) return;

    if (feedbackList.length === 0) {
        feedbackContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No parent feedback found.</p>`;
        return;
    }

    const feedbackHtml = feedbackList.map(feedback => {
        const date = new Date(feedback.timestamp.seconds * 1000).toLocaleDateString();
        const statusClass = feedback.response ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
        const responseText = feedback.response || 'No response yet.';

        return `
            <div class="p-4 rounded-lg shadow-sm border-l-4 ${statusClass}">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-purple-700">${feedback.parentName || feedback.parentEmail}</h3>
                    <span class="text-sm text-gray-500">${date}</span>
                </div>
                <p class="text-sm mt-2">
                    <span class="font-semibold text-gray-800">Student:</span> ${feedback.studentName || 'N/A'}
                </p>
                <p class="text-sm mt-2 italic text-gray-600">"${feedback.message}"</p>
                <div class="mt-3 p-3 bg-white rounded border border-gray-200">
                    <p class="font-semibold text-gray-800">Response:</p>
                    <p class="text-sm text-gray-700">${responseText}</p>
                </div>
                <button onclick="showResponseModal('${feedback.id}', '${encodeURIComponent(feedback.response || '')}')" class="mt-3 text-blue-500 hover:text-blue-700 font-semibold text-sm">
                    ${feedback.response ? 'Edit Response' : 'Add Response'}
                </button>
            </div>
        `;
    }).join('');

    feedbackContainer.innerHTML = feedbackHtml;
}

function showResponseModal(feedbackId, existingResponseEncoded) {
    const existingResponse = decodeURIComponent(existingResponseEncoded);
    const modalHtml = `
        <div id="response-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('response-modal').remove()">&times;</button>
                <h3 class="text-2xl font-bold mb-4 text-blue-700">Send Parent Response</h3>
                <form id="response-form">
                    <input type="hidden" id="feedback-id" value="${feedbackId}">
                    <div class="mb-4">
                        <label for="response-text" class="block text-sm font-medium text-gray-700">Your Response to Parent</label>
                        <textarea id="response-text" rows="5" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">${existingResponse}</textarea>
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save and Send</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('response-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const responseText = document.getElementById('response-text').value;
        try {
            await updateDoc(doc(db, "parent_feedback", feedbackId), {
                response: responseText,
                respondedAt: Timestamp.now()
            });
            alert("Response saved successfully!");
            document.getElementById('response-modal').remove();
            invalidateCache('parentFeedback');
            fetchAndRenderFeedback();
        } catch (error) {
            console.error("Error saving response:", error);
            alert("Failed to save response. Check console.");
        }
    });
}


// --- Summer Break Panel (Original) ---
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-orange-700">Summer Break Management</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div class="mb-4 flex space-x-4">
                <button id="toggle-all-btn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Toggle All Students Break Status</button>
            </div>
            <div id="break-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading break students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    document.getElementById('toggle-all-btn').addEventListener('click', toggleAllStudentsBreakStatus);
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('breakStudents');
    }

    try {
        if (!sessionCache.breakStudents) {
            document.getElementById('break-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching students data...</p>`;
            
            // Fetch all students (assuming 'students' collection has the 'summerBreak' field)
            const studentsSnapshot = await getDocs(query(collection(db, "students"), orderBy("studentName")));
            
            const studentsData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('breakStudents', studentsData);
        }

        renderBreakStudentsFromCache();

    } catch (error) {
        console.error("Error fetching break students:", error);
        document.getElementById('break-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load student data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const students = sessionCache.breakStudents || [];
    const breakListContainer = document.getElementById('break-list');
    if (!breakListContainer) return;

    if (students.length === 0) {
        breakListContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No students found.</p>`;
        return;
    }

    const breakStudentsHtml = students.map(student => {
        const isOnBreak = student.summerBreak === true;
        const statusText = isOnBreak ? 'On Break' : 'Active';
        const statusClass = isOnBreak ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800';
        const buttonText = isOnBreak ? 'Activate' : 'Set to Break';
        const buttonClass = isOnBreak ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h3 class="font-bold text-gray-800">${student.studentName} (Gr. ${student.grade})</h3>
                    <p class="text-sm text-gray-600">${student.tutorName || 'N/A'}</p>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusClass}">${statusText}</span>
                    <button onclick="toggleStudentBreakStatus('${student.id}', ${isOnBreak})" 
                            class="text-white px-4 py-2 rounded-lg text-sm ${buttonClass}">
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    breakListContainer.innerHTML = breakStudentsHtml;
}

async function toggleStudentBreakStatus(studentId, currentStatus) {
    const newStatus = !currentStatus;
    try {
        await updateDoc(doc(db, "students", studentId), {
            summerBreak: newStatus
        });
        alert(`Student status updated to ${newStatus ? 'On Break' : 'Active'}!`);
        invalidateCache('breakStudents');
        fetchAndRenderBreakStudents(); // Re-fetch and render
    } catch (error) {
        console.error("Error updating break status:", error);
        alert("Failed to update break status. Check console.");
    }
}

async function toggleAllStudentsBreakStatus() {
    if (!confirm("Are you sure you want to toggle the break status of ALL students?")) {
        return;
    }

    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const batch = writeBatch(db);
        const toggleValue = studentsSnapshot.docs.some(doc => doc.data().summerBreak !== true); // If any student is NOT on break, the action is to set all to break.
        
        studentsSnapshot.docs.forEach(docSnapshot => {
            const studentRef = doc(db, "students", docSnapshot.id);
            batch.update(studentRef, { summerBreak: toggleValue });
        });

        await batch.commit();
        alert(`All ${studentsSnapshot.docs.length} students set to ${toggleValue ? 'On Break' : 'Active'}!`);
        invalidateCache('breakStudents');
        fetchAndRenderBreakStudents();
    } catch (error) {
        console.error("Error toggling all students break status:", error);
        alert("Failed to toggle all students break status. Check console.");
    }
}


// --- NEW HELPER FUNCTION FOR REFERRAL RENDERING ---
function renderReferralApprovals(referrals) {
    if (!referrals || referrals.length === 0) {
        return '<p class="text-center text-gray-500 py-4 bg-yellow-50 rounded-lg">No pending referral transactions.</p>';
    }

    return referrals.map(ref => {
        const rewardAmount = ref.rewardAmount || 5000; // Default to ₦5,000
        const dateString = ref.transactionDate ? new Date(ref.transactionDate.seconds * 1000).toLocaleDateString() : 'N/A';
        const transactionId = ref.id;
        const referrerEmail = ref.referrerEmail;
        const referredStudentName = ref.referredStudentName || 'Unknown Student';

        return `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-yellow-400 flex justify-between items-center flex-wrap gap-3">
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-yellow-800 truncate">Referral for: ${referredStudentName}</p>
                    <p class="text-sm text-gray-600">Referrer: ${ref.referrerName || ref.referrerEmail}</p>
                    <p class="text-xs text-gray-500">Code: <span class="font-mono font-bold">${ref.referralCode}</span> | Reward: ₦${rewardAmount.toLocaleString()}</p>
                    <p class="text-xs text-gray-400">Date: ${dateString}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="handleApproveReferralTransaction('${transactionId}', '${referrerEmail}', ${rewardAmount})"
                            class="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700 transition duration-150">Approve</button>
                </div>
            </div>
        `;
    }).join('');
}


// --- Pay Advice Panel (Original) ---
async function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-teal-700">Tutor Pay Advice</h2>
                <div class="flex items-center gap-4">
                    <button id="download-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Download CSV</button>
                    <button id="refresh-pay-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            <div id="pay-advice-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pay data...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pay-btn').addEventListener('click', () => fetchAndRenderPayAdvice(true));
    document.getElementById('download-csv-btn').addEventListener('click', () => {
        if (currentPayData.length === 0) {
            alert("No pay data to download.");
            return;
        }
        const csv = convertPayAdviceToCSV(currentPayData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'Tutor_Pay_Advice.csv');
    });
    fetchAndRenderPayAdvice();
}

async function fetchAndRenderPayAdvice(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors'); 
        invalidateCache('students'); 
    }

    try {
        if (!sessionCache.tutors || !sessionCache.students) {
            await fetchAndRenderDirectory(true); // Re-use directory fetch, force refresh
        }

        const tutors = sessionCache.tutors || [];
        const students = sessionCache.students || [];
        
        if (tutors.length === 0) {
            document.getElementById('pay-advice-list').innerHTML = `<p class="text-center text-gray-500 py-10">No tutors found to calculate pay advice.</p>`;
            currentPayData = [];
            return;
        }

        const payAdviceData = tutors.map(tutor => {
            const assignedStudents = students.filter(s => s.tutorEmail === tutor.email && s.summerBreak !== true);
            const studentCount = assignedStudents.length;
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            
            // Assuming 25% management fee
            const managementFee = Math.round(totalStudentFees * 0.25);
            const totalPay = totalStudentFees - managementFee;
            
            return {
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount,
                totalStudentFees,
                managementFee,
                totalPay,
                beneficiaryBank: tutor.bankName,
                beneficiaryAccount: tutor.accountNumber,
                beneficiaryName: tutor.accountName,
            };
        }).sort((a, b) => b.totalPay - a.totalPay);

        currentPayData = payAdviceData;
        renderPayAdviceFromData(payAdviceData);

    } catch (error) {
        console.error("Error fetching pay advice data:", error);
        document.getElementById('pay-advice-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to calculate pay advice.</p>`;
    }
}

function renderPayAdviceFromData(data) {
    const payAdviceList = document.getElementById('pay-advice-list');
    if (!payAdviceList) return;

    const payAdviceHtml = data.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        const studentText = `${item.studentCount} Student${item.studentCount !== 1 ? 's' : ''}`;
        
        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border-l-4 border-teal-500">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-teal-700">${item.tutorName} (${item.tutorEmail})</h3>
                        <p class="text-xs text-gray-500">${studentText}</p>
                    </div>
                    <span class="text-xl font-extrabold text-teal-600">₦${finalPay.toLocaleString()}</span>
                </div>
                <div class="mt-3 text-sm space-y-1">
                    <p>Total Fees: ₦${item.totalStudentFees.toLocaleString()}</p>
                    <p>Management Fee (25%): ₦${item.managementFee.toLocaleString()}</p>
                    <p class="font-semibold text-gray-800">Net Pay: ₦${item.totalPay.toLocaleString()}</p>
                    <p class="text-red-500">Gift/Bonus: ₦${giftAmount.toLocaleString()} 
                        <button onclick="showGiftModal('${item.tutorEmail}', '${item.tutorName}')" class="ml-2 text-xs text-blue-500 hover:text-blue-700">[Add/Edit]</button>
                    </p>
                    <div class="mt-2 p-2 border-t border-gray-200">
                        <p class="font-semibold text-xs">Bank Details:</p>
                        <p class="text-xs">${item.beneficiaryBank || 'N/A'} - ${item.beneficiaryAccount || 'N/A'} (${item.beneficiaryName || 'N/A'})</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    payAdviceList.innerHTML = payAdviceHtml;
}

function showGiftModal(tutorEmail, tutorName) {
    const existingGift = payAdviceGifts[tutorEmail] || 0;
    
    const modalHtml = `
        <div id="gift-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-sm rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('gift-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-teal-700">Add Gift/Bonus for ${tutorName}</h3>
                <form id="gift-form">
                    <input type="hidden" id="gift-tutor-email" value="${tutorEmail}">
                    <div class="mb-4">
                        <label for="gift-amount" class="block text-sm font-medium text-gray-700">Bonus Amount (₦)</label>
                        <input type="number" id="gift-amount" value="${existingGift}" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Bonus</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('gift-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = Number(document.getElementById('gift-amount').value);
        payAdviceGifts[tutorEmail] = amount;
        
        alert(`Bonus of ₦${amount.toLocaleString()} saved for ${tutorName}. Click Download CSV to export the final pay advice.`);
        document.getElementById('gift-modal').remove();
        renderPayAdviceFromData(currentPayData); // Re-render the pay advice list to show the update
    });
}


// --- Pending Approvals Panel (UPDATED) ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-red-700">Pending Approvals Dashboard</h2>
                <button id="refresh-approvals-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="approvals-content">
                <p class="text-center text-gray-500 py-10">Loading pending items...</p>
            </div>
        </div>
    `;

    document.getElementById('refresh-approvals-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    
    // Initial fetch and render
    fetchAndRenderPendingApprovals();
}


function renderApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const pendingReferrals = sessionCache.pendingReferrals || []; // Get new data from cache
    const approvalsContent = document.getElementById('approvals-content');
    if (!approvalsContent) return;
    
    // --- 1. Referral Approvals Section (NEW) ---
    const referralListHtml = renderReferralApprovals(pendingReferrals);
    
    let htmlContent = `
        <h3 class="text-xl font-bold text-yellow-700 mt-0 mb-4 border-b pb-2">Pending Referral Transactions (<span id="referral-count">${pendingReferrals.length}</span>)</h3>
        <div id="referral-approvals-list" class="space-y-3">
            ${referralListHtml}
        </div>
    `;
    
    // --- 2. Student Approvals Section (Existing) ---
    const studentListHtml = pendingStudents.length === 0 
        ? '<p class="text-center text-gray-500 py-4 bg-green-50 rounded-lg">No pending student registrations.</p>'
        : pendingStudents.map(student => `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-red-400 flex justify-between items-center flex-wrap gap-3">
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-red-800 truncate">${student.studentName} (Gr. ${student.grade})</p>
                    <p class="text-sm text-gray-600">Parent: ${student.parentName} (${student.parentPhone})</p>
                    <p class="text-xs text-gray-500">Tutor Email: ${student.tutorEmail}</p>
                    <p class="text-xs text-gray-400">Registered: ${new Date(student.createdAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="handleEditPendingStudent('${student.id}')" class="bg-blue-500 text-white text-sm px-3 py-1 rounded hover:bg-blue-600 transition duration-150">Edit</button>
                    <button onclick="handleApproveStudent('${student.id}')" class="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700 transition duration-150">Approve</button>
                    <button onclick="handleRejectStudent('${student.id}')" class="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700 transition duration-150">Reject</button>
                </div>
            </div>
        `).join('');

    htmlContent += `
        <h3 class="text-xl font-bold text-green-700 mt-8 mb-4 border-b pb-2">Pending Student Registrations (<span id="student-count">${pendingStudents.length}</span>)</h3>
        <div id="student-approvals-list" class="space-y-3">
            ${studentListHtml}
        </div>
    `;

    approvalsContent.innerHTML = htmlContent;
}

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('pendingStudents');
        invalidateCache('pendingReferrals'); // Invalidate new cache
    }

    try {
        if (!sessionCache.pendingStudents || !sessionCache.pendingReferrals) { // Check both caches
            document.getElementById('approvals-content').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;

            const [pendingStudentsSnapshot, pendingReferralsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "pending_students"), orderBy("createdAt", "desc"))),
                // --- NEW: Fetch Pending Referral Transactions ---
                getDocs(query(collection(db, "referral_transactions"), where("status", "==", "Pending"), orderBy("transactionDate", "desc"))),
            ]);

            // Save newly fetched data to localStorage
            saveToLocalStorage('pendingStudents', pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            saveToLocalStorage('pendingReferrals', pendingReferralsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        renderApprovalsFromCache();
    } catch (error) {
        console.error("Error fetching pending approvals data:", error);
        document.getElementById('approvals-content').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load pending approvals data.</p>`;
    }
}


// --- Tutor Search Functions (Original) ---
// Global function to find tutor name by email (used by other functions)
function findTutorName(email) {
    const tutor = sessionCache.tutors?.find(t => t.email === email);
    return tutor ? tutor.name : 'Unknown Tutor';
}


// --- Main App Logic (Original) ---
const allNavItems = {
    // Nav items and their corresponding rendering functions
    'navTutorManagement': { fn: renderManagementTutorView, title: 'Tutor & Student List', requiredRole: 'Administrator' },
    'navPayAdvice': { fn: renderPayAdvicePanel, title: 'Pay Advice', requiredRole: 'Administrator' },
    'navTutorReports': { fn: renderTutorReportsPanel, title: 'Tutor Reports', requiredRole: 'Administrator' },
    'navSummerBreak': { fn: renderSummerBreakPanel, title: 'Summer Break Management', requiredRole: 'Administrator' },
    'navPendingApprovals': { fn: renderPendingApprovalsPanel, title: 'Pending Approvals Dashboard', requiredRole: 'Administrator' },
    'navParentFeedback': { fn: renderParentFeedbackPanel, title: 'Parent Feedback', requiredRole: 'Administrator' },
};

let activeNavId = 'navTutorManagement'; // Default view

window.onload = () => {
    // Expose global functions for onclick events in dynamically generated HTML
    window.handleEditStudent = handleEditStudent;
    window.handleDeleteStudent = handleDeleteStudent;
    window.handleEditPendingStudent = handleEditPendingStudent;
    window.handleApproveStudent = handleApproveStudent;
    window.handleRejectStudent = handleRejectStudent;
    window.showReportModal = showReportModal;
    window.showResponseModal = showResponseModal;
    window.toggleStudentBreakStatus = toggleStudentBreakStatus;
    window.showGiftModal = showGiftModal;
    
    // --- NEW: Expose Referral Approval Handler ---
    window.handleApproveReferralTransaction = handleApproveReferralTransaction;

    const navButtons = document.querySelectorAll('.nav-btn');
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');

    function setActiveNav(navId) {
        navButtons.forEach(btn => btn.classList.remove('bg-green-600', 'text-white'));
        document.getElementById(navId).classList.add('bg-green-600', 'text-white');
        activeNavId = navId;
        localStorage.setItem('managementActiveNav', navId);
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const navId = btn.id;
            setActiveNav(navId);
            const item = allNavItems[navId];
            if (item) item.fn(mainContent);
        });
    });

    const savedNavId = localStorage.getItem('managementActiveNav') || 'navTutorManagement';

    // Firebase Auth State Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const staffDocRef = doc(db, "staff", user.email);
            const docSnap = await getDoc(staffDocRef);

            if (docSnap.exists() && docSnap.data().role) {
                const staffData = docSnap.data();
                const userRole = staffData.role;
                
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${userRole}`;

                // Filter navigation based on role (simple check: only 'Administrator' sees all)
                navButtons.forEach(btn => {
                    const navItem = allNavItems[btn.id];
                    if (navItem && navItem.requiredRole === userRole) {
                        btn.classList.remove('hidden');
                    } else if (navItem) {
                        btn.classList.add('hidden');
                    }
                });

                if (mainContent) {
                    if (userRole === 'Administrator') {
                        // All nav buttons are visible, load the last active one or default
                        setActiveNav(savedNavId);
                        const currentItem = allNavItems[savedNavId];
                        if(currentItem) currentItem.fn(mainContent);
                    } else {
                        // User has a role but is not admin, show a filtered view or message
                        if (mainContent) mainContent.innerHTML = `<p class=\"text-center\">You have no permissions assigned.</p>`;
                    }
                }
            } else {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name || user.email}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class=\"text-center mt-12 text-yellow-600 font-semibold\">Your account is awaiting approval.</p>`;
            }
        } else {
            window.location.href = "management-auth.html";
        }
        
        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    });
};

// [End Complete management.js File]
