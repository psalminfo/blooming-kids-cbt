// [Begin Updated management.js File]

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

// ### UPDATED FUNCTION ###
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
            const mainContent = document.getElementById('main-content');
            if (targetCollection === 'students') {
                invalidateCache('students');
                if (mainContent) renderManagementTutorView(mainContent);
            } else {
                invalidateCache('pendingStudents');
                if (mainContent) renderPendingApprovalsPanel(mainContent);
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
                            <option value="">Select Tutor</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="assign-studentName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="assign-grade" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="assign-days" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="assign-subjects" placeholder="e.g., Math, English" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="assign-parentName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="assign-parentPhone" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="assign-studentFee" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const selectedTutor = JSON.parse(form.elements['assign-tutor'].value);
        const newStudentData = {
            tutorEmail: selectedTutor.email,
            tutorName: selectedTutor.name,
            studentName: form.elements['assign-studentName'].value,
            grade: form.elements['assign-grade'].value,
            days: form.elements['assign-days'].value,
            subjects: form.elements['assign-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['assign-parentName'].value,
            parentPhone: form.elements['assign-parentPhone'].value,
            studentFee: Number(form.elements['assign-studentFee'].value) || 0,
            status: 'active', // Newly assigned students are typically active
            isApproved: true,
            createdAt: Timestamp.now(),
        };

        try {
            await addDoc(collection(db, "students"), newStudentData);
            alert(`Student ${newStudentData.studentName} successfully assigned to ${newStudentData.tutorName}!`);
            document.getElementById('assign-modal').remove();

            // Invalidate the cache and re-render the view
            invalidateCache('students');
            const mainContent = document.getElementById('main-content');
            if (mainContent) renderManagementTutorView(mainContent);
        } catch (error) {
            console.error("Error adding new student: ", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });
}


async function handleRemoveStudent(studentId) {
    if (!confirm("Are you sure you want to remove this student? This action cannot be undone.")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "students", studentId));
        alert("Student successfully removed from the active list.");

        // Invalidate cache and re-render the view
        invalidateCache('students');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderManagementTutorView(mainContent);
    } catch (error) {
        console.error("Error removing student: ", error);
        alert("Failed to remove student. Check the console for details.");
    }
}

async function handleMoveStudentToBreak(studentId, studentName) {
    if (!confirm(`Are you sure you want to move ${studentName} to the Summer Break list?`)) {
        return;
    }

    try {
        const studentDocRef = doc(db, "students", studentId);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }
        const studentData = studentDoc.data();

        // 1. Add to break_students collection
        await setDoc(doc(db, "break_students", studentId), {
            ...studentData,
            status: 'break',
            movedAt: Timestamp.now(),
        });

        // 2. Delete from students collection
        await deleteDoc(studentDocRef);

        alert(`${studentName} successfully moved to Summer Break.`);

        // Invalidate both caches and re-render the Tutor view
        invalidateCache('students');
        invalidateCache('breakStudents');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderManagementTutorView(mainContent);
    } catch (error) {
        console.error("Error moving student to break: ", error);
        alert("Failed to move student. Check the console for details.");
    }
}

async function handleMoveStudentToActive(studentId, studentName) {
    if (!confirm(`Are you sure you want to move ${studentName} back to the Active list?`)) {
        return;
    }

    try {
        const studentDocRef = doc(db, "break_students", studentId);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) {
            alert("Student not found in break list!");
            return;
        }
        const studentData = studentDoc.data();

        // 1. Add to students collection
        await setDoc(doc(db, "students", studentId), {
            ...studentData,
            status: 'active',
            movedAt: Timestamp.now(), // Update the timestamp if needed
        });

        // 2. Delete from break_students collection
        await deleteDoc(studentDocRef);

        alert(`${studentName} successfully moved back to Active status.`);

        // Invalidate both caches and re-render the Break view
        invalidateCache('students');
        invalidateCache('breakStudents');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderSummerBreakPanel(mainContent);
    } catch (error) {
        console.error("Error moving student to active: ", error);
        alert("Failed to move student. Check the console for details.");
    }
}


async function handleApproveStudent(studentId, studentName) {
    if (!confirm(`Are you sure you want to APPROVE and move ${studentName} to the Active list?`)) {
        return;
    }

    try {
        const studentDocRef = doc(db, "pending_students", studentId);
        const studentDoc = await getDoc(studentDocRef);
        if (!studentDoc.exists()) {
            alert("Pending student not found!");
            return;
        }
        const studentData = studentDoc.data();

        // 1. Add to students collection
        await setDoc(doc(db, "students", studentId), {
            ...studentData,
            isApproved: true,
            status: 'active', // Set initial status as active
            approvedAt: Timestamp.now(),
        });

        // 2. Delete from pending_students collection
        await deleteDoc(studentDocRef);

        alert(`${studentName} successfully approved and moved to the Active student list.`);

        // Invalidate both caches and re-render the Pending view
        invalidateCache('students');
        invalidateCache('pendingStudents');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderPendingApprovalsPanel(mainContent);
    } catch (error) {
        console.error("Error approving student: ", error);
        alert("Failed to approve student. Check the console for details.");
    }
}

async function handleDeclineStudent(studentId, studentName) {
    if (!confirm(`Are you sure you want to DECLINE and permanently remove ${studentName} from the pending list?`)) {
        return;
    }

    try {
        // 1. Delete from pending_students collection
        await deleteDoc(doc(db, "pending_students", studentId));

        alert(`${studentName} successfully declined and removed.`);

        // Invalidate cache and re-render the Pending view
        invalidateCache('pendingStudents');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderPendingApprovalsPanel(mainContent);
    } catch (error) {
        console.error("Error declining student: ", error);
        alert("Failed to decline student. Check the console for details.");
    }
}


async function handleRemoveReport(reportId, tutorEmail) {
    if (!confirm("Are you sure you want to remove this report?")) return;

    try {
        const reportDocRef = doc(db, "reports", reportId);

        // Optional: Check if the corresponding parent_feedback exists and delete it
        const feedbackQuery = query(collection(db, "parent_feedback"), where("reportId", "==", reportId));
        const feedbackSnapshot = await getDocs(feedbackQuery);

        if (!feedbackSnapshot.empty) {
            const batch = writeBatch(db);
            feedbackSnapshot.docs.forEach(feedbackDoc => {
                batch.delete(feedbackDoc.ref);
            });
            await batch.commit();
            console.log("Associated parent feedback deleted.");
        }

        // Delete the report itself
        await deleteDoc(reportDocRef);
        alert("Report and associated feedback successfully removed.");

        // Invalidate the cache and re-render
        invalidateCache('reports');
        const mainContent = document.getElementById('main-content');
        if (mainContent) renderTutorReportsPanel(mainContent);
    } catch (error) {
        console.error("Error removing report: ", error);
        alert("Failed to remove report. Check the console for details.");
    }
}

// ##################################
// # DATA FETCHING FUNCTIONS (CORE)
// ##################################

/**
 * Fetches all tutors from Firestore.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchTutors(forceFetch = false) {
    if (!forceFetch && sessionCache.tutors) {
        return sessionCache.tutors;
    }
    try {
        const tutorsCol = collection(db, "staff");
        const q = query(tutorsCol, where("role", "==", "tutor"), orderBy("name"));
        const tutorSnapshot = await getDocs(q);
        const tutorsList = tutorSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('tutors', tutorsList);
        return tutorsList;
    } catch (error) {
        console.error("Error fetching tutors: ", error);
        return [];
    }
}

/**
 * Fetches all active students from Firestore.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchStudents(forceFetch = false) {
    if (!forceFetch && sessionCache.students) {
        return sessionCache.students;
    }
    try {
        const studentsCol = collection(db, "students");
        const studentSnapshot = await getDocs(studentsCol);
        const studentsList = studentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('students', studentsList);
        return studentsList;
    } catch (error) {
        console.error("Error fetching students: ", error);
        return [];
    }
}

/**
 * Fetches all students awaiting approval from Firestore.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchPendingStudents(forceFetch = false) {
    if (!forceFetch && sessionCache.pendingStudents) {
        return sessionCache.pendingStudents;
    }
    try {
        const pendingCol = collection(db, "pending_students");
        const pendingSnapshot = await getDocs(pendingCol);
        const pendingList = pendingSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('pendingStudents', pendingList);
        return pendingList;
    } catch (error) {
        console.error("Error fetching pending students: ", error);
        return [];
    }
}

/**
 * Fetches all reports from Firestore.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchReports(forceFetch = false) {
    if (!forceFetch && sessionCache.reports) {
        return sessionCache.reports;
    }
    try {
        const reportsCol = collection(db, "reports");
        const q = query(reportsCol, orderBy("timestamp", "desc"));
        const reportsSnapshot = await getDocs(q);
        const reportsList = reportsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate(), // Convert Firestore Timestamp to JS Date
            dateString: doc.data().timestamp.toDate().toLocaleDateString()
        }));
        saveToLocalStorage('reports', reportsList);
        return reportsList;
    } catch (error) {
        console.error("Error fetching reports: ", error);
        return [];
    }
}

/**
 * Fetches all students on summer break.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchBreakStudents(forceFetch = false) {
    if (!forceFetch && sessionCache.breakStudents) {
        return sessionCache.breakStudents;
    }
    try {
        const breakCol = collection(db, "break_students");
        const breakSnapshot = await getDocs(breakCol);
        const breakList = breakSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('breakStudents', breakList);
        return breakList;
    } catch (error) {
        console.error("Error fetching break students: ", error);
        return [];
    }
}

/**
 * Fetches all parent feedback documents.
 * @param {boolean} forceFetch Skips cache if true.
 */
async function fetchParentFeedback(forceFetch = false) {
    if (!forceFetch && sessionCache.parentFeedback) {
        return sessionCache.parentFeedback;
    }
    try {
        const feedbackCol = collection(db, "parent_feedback");
        const q = query(feedbackCol, orderBy("timestamp", "desc"));
        const feedbackSnapshot = await getDocs(q);
        const feedbackList = feedbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate(), // Convert Firestore Timestamp to JS Date
            dateString: doc.data().timestamp.toDate().toLocaleDateString()
        }));
        saveToLocalStorage('parentFeedback', feedbackList);
        return feedbackList;
    } catch (error) {
        console.error("Error fetching parent feedback: ", error);
        return [];
    }
}


// ##################################
// # RENDERING FUNCTIONS
// ##################################

/**
 * Renders the main Tutor Management and Student List view.
 * @param {HTMLElement} container The main content container.
 */
async function renderManagementTutorView(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Loading data... please wait.</p>';

    try {
        const [tutors, students] = await Promise.all([
            fetchTutors(true), // Force fetch to get the latest list
            fetchStudents(true) // Force fetch
        ]);

        // Group students by tutorEmail
        const studentsByTutor = students.reduce((acc, student) => {
            const email = student.tutorEmail;
            if (email) {
                if (!acc[email]) acc[email] = [];
                acc[email].push(student);
            }
            return acc;
        }, {});

        let html = `
            <div class="space-y-6">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-green-700">Tutor & Active Student Management</h2>
                    <div class="flex space-x-2 mt-4 sm:mt-0">
                        <button onclick="showAssignStudentModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md transition duration-200">
                            + Assign Student
                        </button>
                    </div>
                </div>
                
                <h3 class="text-xl font-semibold text-gray-700">Tutor Directory (${tutors.length} Tutors)</h3>
                <div id="tutor-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        `;

        // Render Tutor Cards
        tutors.forEach(tutor => {
            const tutorStudents = studentsByTutor[tutor.email] || [];
            const studentCount = tutorStudents.length;

            html += `
                <div class="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                    <p class="font-bold text-lg text-green-800">${tutor.name || 'N/A'}</p>
                    <p class="text-sm text-gray-500 truncate">${tutor.email}</p>
                    <p class="text-md font-semibold mt-2">Students: <span class="text-blue-600">${studentCount}</span></p>
                    <div class="mt-4 border-t pt-3">
                        <p class="font-semibold text-gray-700 mb-2">Active Students (${studentCount}):</p>
                        <ul class="text-sm space-y-1 max-h-40 overflow-y-auto">
            `;

            if (studentCount > 0) {
                tutorStudents.forEach(student => {
                    html += `
                        <li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                            <span class="truncate">${capitalize(student.studentName)} (${student.grade})</span>
                            <div class="flex space-x-1">
                                <button onclick="handleEditStudent('${student.id}')" class="text-blue-500 hover:text-blue-700 transition duration-150 text-xs">Edit</button>
                                <button onclick="handleRemoveStudent('${student.id}')" class="text-red-500 hover:text-red-700 transition duration-150 text-xs">Remove</button>
                                <button onclick="handleMoveStudentToBreak('${student.id}', '${capitalize(student.studentName)}')" class="text-yellow-500 hover:text-yellow-700 transition duration-150 text-xs">Break</button>
                            </div>
                        </li>
                    `;
                });
            } else {
                html += '<li class="text-gray-400">No active students assigned.</li>';
            }

            html += `
                        </ul>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (error) {
        console.error("Error rendering tutor view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load data. Check console for errors.</p>';
    }
}

/**
 * Renders the Pay Advice panel.
 * @param {HTMLElement} container The main content container.
 */
async function renderPayAdvicePanel(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Calculating pay advice... please wait.</p>';

    try {
        const [tutors, students] = await Promise.all([
            fetchTutors(true),
            fetchStudents(true)
        ]);

        if (tutors.length === 0) {
            container.innerHTML = '<p class="text-center text-red-600">No tutors found to calculate pay advice.</p>';
            return;
        }

        const studentsByTutor = students.reduce((acc, student) => {
            const email = student.tutorEmail;
            if (email) {
                if (!acc[email]) acc[email] = [];
                acc[email].push(student);
            }
            return acc;
        }, {});

        const payData = tutors
            .map(tutor => {
                const tutorStudents = studentsByTutor[tutor.email] || [];
                const studentCount = tutorStudents.length;

                // Calculate total student fees
                const totalStudentFees = tutorStudents.reduce((sum, student) => sum + (student.studentFee || 0), 0);

                // Management fee is 20% of the total student fees
                const managementFee = totalStudentFees * 0.20;

                // Tutor's pay is the remaining 80%
                const totalPay = totalStudentFees - managementFee;

                return {
                    tutorName: tutor.name || 'N/A',
                    tutorEmail: tutor.email,
                    studentCount,
                    totalStudentFees: totalStudentFees.toFixed(2),
                    managementFee: managementFee.toFixed(2),
                    totalPay: totalPay.toFixed(2),
                    beneficiaryBank: tutor.beneficiaryBank || '',
                    beneficiaryAccount: tutor.beneficiaryAccount || '',
                    beneficiaryName: tutor.beneficiaryName || ''
                };
            })
            .sort((a, b) => b.totalPay - a.totalPay); // Sort by pay amount

        currentPayData = payData; // Store globally for CSV export

        let tableRows = payData.map(item => {
            // Get current gift amount for this tutor, default to 0
            const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
            const finalPay = (parseFloat(item.totalPay) + giftAmount).toFixed(2);

            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.tutorName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${item.studentCount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">₦${item.totalStudentFees}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-red-500">₦${item.managementFee}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">₦${item.totalPay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <input type="number" data-email="${item.tutorEmail}" value="${giftAmount}" placeholder="0" class="pay-gift-input w-20 p-1 border rounded text-right" min="0">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 final-pay-cell">₦${finalPay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        ${item.beneficiaryBank || 'N/A'} / ${item.beneficiaryAccount || 'N/A'} / ${item.beneficiaryName || 'N/A'}
                    </td>
                </tr>
            `;
        }).join('');

        let html = `
            <div class="space-y-6">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-green-700">Tutor Pay Advice Calculation</h2>
                    <div class="flex space-x-2 mt-4 sm:mt-0">
                        <button onclick="exportPayAdviceCSV()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md transition duration-200">
                            Export CSV
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Name</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mgmt Fee (20%)</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Pay (80%)</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gift (₦)</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Pay (₦)</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Details</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <p class="text-sm text-gray-600 mt-4">* Final Pay is calculated as Tutor Pay + Gift amount. Click 'Export CSV' to download the final payment instruction sheet.</p>
            </div>
        `;
        container.innerHTML = html;

        // Add event listeners for gift inputs
        document.querySelectorAll('.pay-gift-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const email = e.target.getAttribute('data-email');
                const gift = Number(e.target.value) || 0;
                payAdviceGifts[email] = gift;
                updateFinalPay(e.target.closest('tr'), email);
            });
        });

    } catch (error) {
        console.error("Error rendering pay advice view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load pay data. Check console for errors.</p>';
    }
}

/**
 * Updates the final pay cell for a given row when the gift input changes.
 * @param {HTMLTableRowElement} row The table row element.
 * @param {string} tutorEmail The email of the tutor.
 */
function updateFinalPay(row, tutorEmail) {
    const item = currentPayData.find(d => d.tutorEmail === tutorEmail);
    if (!item) return;

    const giftAmount = payAdviceGifts[tutorEmail] || 0;
    const totalPay = parseFloat(item.totalPay);
    const finalPay = (totalPay + giftAmount).toFixed(2);

    const finalPayCell = row.querySelector('.final-pay-cell');
    if (finalPayCell) {
        finalPayCell.textContent = `₦${finalPay}`;
    }
}

/**
 * Exports the current pay advice data (including gifts) to a CSV file.
 */
function exportPayAdviceCSV() {
    if (currentPayData.length === 0) {
        alert("No data to export.");
        return;
    }
    const csvContent = convertPayAdviceToCSV(currentPayData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Pay_Advice_${new Date().toLocaleDateString('en-CA')}.csv`);
}


/**
 * Renders the Tutor Reports panel.
 * @param {HTMLElement} container The main content container.
 */
async function renderTutorReportsPanel(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Loading reports... please wait.</p>';

    try {
        const [reports, parentFeedback] = await Promise.all([
            fetchReports(true),
            fetchParentFeedback(true)
        ]);

        if (reports.length === 0) {
            container.innerHTML = '<p class="text-center text-red-600">No reports have been submitted yet.</p>';
            return;
        }

        // Group feedback by reportId
        const feedbackByReport = parentFeedback.reduce((acc, feedback) => {
            if (feedback.reportId) {
                acc[feedback.reportId] = feedback;
            }
            return acc;
        }, {});

        let tableRows = reports.map(report => {
            const feedback = feedbackByReport[report.id];
            const feedbackStatus = feedback ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Received</span>` : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>`;
            const feedbackText = feedback ? `<div class="mt-1 text-xs text-gray-500">${feedback.feedbackText.substring(0, 50)}...</div>` : '';

            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${report.dateString}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${report.tutorName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${report.studentName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${capitalize(report.subject)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${feedbackStatus}
                        ${feedbackText}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="downloadReportAsPDF('${report.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">PDF</button>
                        <button onclick="handleRemoveReport('${report.id}', '${report.tutorEmail}')" class="text-red-600 hover:text-red-900">Remove</button>
                    </td>
                </tr>
            `;
        }).join('');

        let html = `
            <div class="space-y-6">
                <div class="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-green-700">Tutor Reports & Parent Feedback</h2>
                </div>
                
                <div class="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback Status</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error rendering reports view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load reports. Check console for errors.</p>';
    }
}

/**
 * Renders the Summer Break student panel.
 * @param {HTMLElement} container The main content container.
 */
async function renderSummerBreakPanel(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Loading break students... please wait.</p>';

    try {
        const breakStudents = await fetchBreakStudents(true);

        let tableRows = breakStudents.map(student => {
            const movedDate = student.movedAt ? student.movedAt.toLocaleDateString() : 'N/A';
            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${capitalize(student.studentName)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.tutorName || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.grade}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.subjects ? student.subjects.join(', ') : 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movedDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="handleMoveStudentToActive('${student.id}', '${capitalize(student.studentName)}')" class="text-green-600 hover:text-green-900">Move to Active</button>
                    </td>
                </tr>
            `;
        }).join('');

        let html = `
            <div class="space-y-6">
                <div class="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-green-700">Summer Break Students (${breakStudents.length})</h2>
                </div>
                
                <div class="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moved Date</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error rendering break students view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load break students. Check console for errors.</p>';
    }
}


/**
 * Renders the Pending Approvals panel.
 * @param {HTMLElement} container The main content container.
 */
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Loading pending students... please wait.</p>';

    try {
        const pendingStudents = await fetchPendingStudents(true);

        if (pendingStudents.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                    <p class="mt-4 text-gray-600">No students are currently awaiting approval. All clear! 🎉</p>
                </div>
            `;
            return;
        }

        let tableRows = pendingStudents.map(student => {
            const date = student.createdAt ? student.createdAt.toLocaleDateString() : 'N/A';
            return `
                <tr class="hover:bg-yellow-50 border-b">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${capitalize(student.studentName)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.tutorName || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.grade}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="handleEditPendingStudent('${student.id}')" class="text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                        <button onclick="handleApproveStudent('${student.id}', '${capitalize(student.studentName)}')" class="text-green-600 hover:text-green-900 mr-2">Approve</button>
                        <button onclick="handleDeclineStudent('${student.id}', '${capitalize(student.studentName)}')" class="text-red-600 hover:text-red-900">Decline</button>
                    </td>
                </tr>
            `;
        }).join('');

        let html = `
            <div class="space-y-6">
                <div class="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-yellow-700">Pending Student Approvals (${pendingStudents.length})</h2>
                </div>
                
                <div class="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Tutor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Date</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error rendering pending students view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load pending students. Check console for errors.</p>';
    }
}

/**
 * Renders the Parent Feedback panel.
 * @param {HTMLElement} container The main content container.
 */
async function renderParentFeedbackPanel(container) {
    container.innerHTML = '<p class="text-center text-xl text-green-700">Loading parent feedback... please wait.</p>';

    try {
        const feedbackList = await fetchParentFeedback(true);

        if (feedbackList.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    <h2 class="text-2xl font-bold text-green-700">Parent Feedback</h2>
                    <p class="mt-4 text-gray-600">No parent feedback has been received yet.</p>
                </div>
            `;
            return;
        }

        let cards = feedbackList.map(feedback => {
            return `
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <p class="text-lg font-bold text-green-800">${feedback.studentName || 'N/A'}</p>
                    <p class="text-sm text-gray-500 mb-3">Tutor: ${feedback.tutorName || 'N/A'} | Report Date: ${feedback.reportDateString || 'N/A'}</p>
                    <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p class="text-md font-semibold text-gray-700 mb-2">Parent Comment:</p>
                        <p class="text-gray-600 italic">${feedback.feedbackText || 'No comment provided.'}</p>
                    </div>
                    <div class="mt-4 text-xs text-right text-gray-400">Received on: ${feedback.dateString}</div>
                </div>
            `;
        }).join('');

        let html = `
            <div class="space-y-6">
                <div class="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 class="text-2xl font-bold text-green-700">Parent Feedback Received (${feedbackList.length})</h2>
                </div>
                
                <div id="feedback-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${cards}
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error rendering parent feedback view:", error);
        container.innerHTML = '<p class="text-center text-red-600">Failed to load parent feedback. Check console for errors.</p>';
    }
}


/**
 * Generates a PDF of a specific report.
 * NOTE: This relies on the 'html2pdf.bundle.min.js' script being loaded in management.html
 * @param {string} reportId The ID of the report document.
 */
async function downloadReportAsPDF(reportId) {
    try {
        const report = sessionCache.reports.find(r => r.id === reportId);
        if (!report) {
            alert("Report details not found in cache. Please refresh.");
            return;
        }

        // Build HTML for the PDF
        const pdfContentHtml = `
            <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
                <h1 style="color: #047857; border-bottom: 2px solid #047857; padding-bottom: 10px;">Tutor Report for ${report.studentName}</h1>
                <p><strong>Tutor:</strong> ${report.tutorName}</p>
                <p><strong>Date:</strong> ${report.dateString}</p>
                <p><strong>Subject:</strong> ${capitalize(report.subject)}</p>
                <p><strong>Grade:</strong> ${report.grade}</p>
                <hr style="margin-top: 15px; margin-bottom: 15px;">
                
                <h2 style="color: #10b981; font-size: 1.2em;">Report Details</h2>
                <div style="border: 1px solid #d1fae5; padding: 15px; border-radius: 8px; background-color: #f0fdf4;">
                    <p><strong>Topic Covered:</strong> ${report.topicCovered || 'N/A'}</p>
                    <p><strong>Attendance:</strong> ${report.attendance || 'N/A'}</p>
                    <p><strong>Student Engagement:</strong> ${report.engagement || 'N/A'}</p>
                    <p><strong>Progress/Areas of Concern:</strong> ${report.progressNotes || 'N/A'}</p>
                    <p><strong>Next Steps:</strong> ${report.nextSteps || 'N/A'}</p>
                    <p><strong>Management Notes:</strong> ${report.managementNotes || 'N/A'}</p>
                </div>
                
                <hr style="margin-top: 15px; margin-bottom: 15px;">

                <h2 style="color: #10b981; font-size: 1.2em;">Assessment Summary</h2>
                ${report.assessmentScore ? `<p><strong>Assessment Score:</strong> ${report.assessmentScore}%</p>` : ''}
                
                <p style="margin-top: 20px; text-align: center; color: #9ca3af;">Generated by Blooming Kids House Management Portal</p>
            </div>
        `;

        const element = document.createElement('div');
        element.innerHTML = pdfContentHtml;

        const fileName = `Report_${report.studentName.replace(/\s/g, '_')}_${report.dateString.replace(/\//g, '-')}.pdf`;

        // Check if html2pdf is available
        if (typeof html2pdf === 'undefined') {
            alert("PDF generation library is not loaded. Please ensure 'html2pdf.bundle.min.js' is linked in your HTML.");
            return;
        }

        // Generate PDF using the global html2pdf object
        html2pdf().from(element).set({
            margin: 10,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).save();

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("An error occurred during PDF generation.");
    }
}


// ##################################
// # NAVIGATION & INITIALIZATION
// ##################################

// Mapping of nav button IDs to rendering functions and names
const allNavItems = {
    'navTutorManagement': { fn: renderManagementTutorView, name: 'Tutor & Student List' },
    'navPayAdvice': { fn: renderPayAdvicePanel, name: 'Pay Advice' },
    'navTutorReports': { fn: renderTutorReportsPanel, name: 'Tutor Reports' },
    'navSummerBreak': { fn: renderSummerBreakPanel, name: 'Summer Break' },
    'navPendingApprovals': { fn: renderPendingApprovalsPanel, name: 'Pending Approvals' },
    'navParentFeedback': { fn: renderParentFeedbackPanel, name: 'Parent Feedback' },
    // Add other nav items here as they are created
};
let activeNavId = 'navTutorManagement';

/**
 * Handles the navigation click, highlights the button, and renders the corresponding view.
 * @param {string} navId The ID of the navigation button clicked.
 */
function handleNavigation(navId) {
    activeNavId = navId;

    // Remove active class from all buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-green-700', 'text-white');
        btn.classList.add('text-gray-500', 'hover:text-green-700');
    });

    // Add active class to the clicked button
    const activeBtn = document.getElementById(navId);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-500', 'hover:text-green-700');
        activeBtn.classList.add('bg-green-700', 'text-white', 'rounded-full', 'px-4', 'py-2');
    }

    // Call the corresponding rendering function
    const mainContent = document.getElementById('main-content');
    if (mainContent && allNavItems[navId]) {
        allNavItems[navId].fn(mainContent);
    }
}


// Attach event listeners and handle initial load
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const docSnap = await getDoc(staffDocRef);

        if (docSnap.exists() && docSnap.data().isApproved) {
            const userData = docSnap.data();
            const userPermissions = userData.permissions || {}; // { navTutorManagement: true, ... }

            if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${userData.name}`;
            if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${capitalize(userData.role)}`;
            
            // Initial navigation setup
            let firstAllowedNav = null;
            document.querySelectorAll('.nav-btn').forEach(btn => {
                const navId = btn.id;
                
                // Set up click handler
                btn.onclick = () => handleNavigation(navId);

                // Show/Hide based on permissions
                if (userPermissions[navId] === true) {
                    btn.classList.remove('hidden');
                    if (firstAllowedNav === null) {
                        firstAllowedNav = navId;
                    }
                } else {
                    btn.classList.add('hidden');
                }
            });

            // Trigger the initial view render
            if (firstAllowedNav) {
                activeNavId = firstAllowedNav;
                const currentItem = allNavItems[activeNavId];
                if(currentItem) currentItem.fn(mainContent);
            } else {
                if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
            }
        } else {
            if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name}`;
            if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
        }

        const staffDocSnap = await getDoc(staffDocRef);
        if (!staffDocSnap.exists()) {
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    } else {
        window.location.href = "management-auth.html";
    }
});
