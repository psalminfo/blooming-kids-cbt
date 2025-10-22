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
    staffPermissions: null, // <--- UPDATE 1: ADDED - For storing user permissions
    listenersInitialized: false // <--- UPDATE 1: ADDED - Flag to ensure real-time listeners are only set up once
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
        // <--- UPDATE 2: EDITED FUNCTION - Skip the internal state flag when loading cache
        if (key === 'listenersInitialized') continue; 
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

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// --- Tutor & Student Directory Panel ---
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
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm);
        const studentMatch = assignedStudents.some(s =>
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            // CORRECTED LINE: Safely converts phone number to a string before searching
            (s.parentPhone && String(s.parentPhone).toLowerCase().includes(lowerCaseSearchTerm))
        );
        return tutorMatch || studentMatch;
    });

    if (filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No results found for "${searchTerm}".</p>`;
        return;
    }

    document.getElementById('tutor-count-badge').textContent = tutors.length;
    document.getElementById('student-count-badge').textContent = students.length;

    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = canEditStudents || canDeleteStudents;

    directoryList.innerHTML = filteredTutors.map(tutor => {
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(s =>
                searchTerm === '' || // show all students if no search term
                tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || // show all if tutor name matches
                s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                // CORRECTED LINE: Safely converts phone number to a string before searching
                (s.parentPhone && String(s.parentPhone).toLowerCase().includes(lowerCaseSearchTerm))
            );

        const studentsTableRows = assignedStudents
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(student => {
                const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                const actionButtons = `
                    ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Edit</button>` : ''}
                    ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                `;
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.studentName}</td>
                        <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                        <td class="px-4 py-2">${student.grade}</td>
                        <td class="px-4 py-2">${student.days}</td>
                        <td class="px-4 py-2">${subjects}</td>
                        <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                        <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                        ${showActionsColumn ? `<td class="px-4 py-2">${actionButtons}</td>` : ''}
                    </tr>
                `;
            }).join('');

        return `
            <div class="border rounded-lg shadow-sm">
                <details open>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                        ${tutor.name}
                        <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students shown)</span>
                    </summary>
                    <div class="border-t p-2">
                        <table class="min-w-full text-sm">
                            <thead class="bg-gray-50 text-left"><tr>
                                <th class="px-4 py-2 font-medium">Student Name</th><th class="px-4 py-2 font-medium">Fee</th>
                                <th class="px-4 py-2 font-medium">Grade</th><th class="px-4 py-2 font-medium">Days/Week</th>
                                <th class="px-4 py-2 font-medium">Subject</th><th class="px-4 py-2 font-medium">Parent's Name</th>
                                <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                ${showActionsColumn ? `<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                            </tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                        </table>
                    </div>
                </details>
            </div>
        `;
    }).join('');

    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(button => button.addEventListener('click', () => handleEditStudent(button.dataset.studentId)));
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(button => button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId)));
    }
}

// --- Pay Advice Panel ---
async function renderPayAdvicePanel(container) {
    const canExport = window.userData.permissions?.actions?.canExportPayAdvice === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                    ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gift (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Final Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="8" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            payAdviceGifts = {}; // Reset gifts on new date range
            currentPayData = []; // Reset data
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);

    const exportBtn = document.getElementById('export-pay-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const csv = convertPayAdviceToCSV(currentPayData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const start = document.getElementById('start-date').value;
            const end = document.getElementById('end-date').value;
            link.href = URL.createObjectURL(blob);
            link.download = `Pay_Advice_${start}_to_${end}.csv`;
            link.click();
        };
    }
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const reportsQuery = query(
        collection(db, "tutor_submissions"),
        where("submittedAt", ">=", startTimestamp),
        where("submittedAt", "<=", endTimestamp)
    );

    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No active tutors in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            currentPayData = [];
            return;
        }

        const tutorBankDetails = {};
        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.beneficiaryBank && data.beneficiaryAccount) {
                tutorBankDetails[data.tutorEmail] = {
                    beneficiaryBank: data.beneficiaryBank,
                    beneficiaryAccount: data.beneficiaryAccount,
                    beneficiaryName: data.beneficiaryName || 'N/A',
                };
            }
        });

        // ### FIXED SECTION ###
        // Firestore 'in' queries are limited to 30 values. This function fetches tutors by chunking the email list.
        const fetchTutorsInChunks = async (emails) => {
            if (emails.length === 0) return [];
            const chunks = [];
            for (let i = 0; i < emails.length; i += 30) {
                chunks.push(emails.slice(i, i + 30));
            }

            const queryPromises = chunks.map(chunk =>
                getDocs(query(collection(db, "tutors"), where("email", "in", chunk)))
            );
            
            const querySnapshots = await Promise.all(queryPromises);

            // Combine the docs from all snapshot results into a single array
            return querySnapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };

        const activeTutors = await fetchTutorsInChunks(activeTutorEmails);
        
        // Group reports by tutor
        const reportsByTutor = reportsSnapshot.docs.reduce((acc, doc) => {
            const data = doc.data();
            acc[data.tutorEmail] = acc[data.tutorEmail] || [];
            acc[data.tutorEmail].push(data);
            return acc;
        }, {});

        const payAdviceData = activeTutors.map(tutor => {
            const reports = reportsByTutor[tutor.email] || [];
            const studentCount = reports.length;
            const totalStudentFees = reports.reduce((sum, r) => sum + (r.studentFee || 0), 0);
            
            // Calculate management fee (20% of total fees) and tutor pay
            const managementFee = totalStudentFees * 0.20;
            const totalPay = totalStudentFees - managementFee;
            const bankDetails = tutorBankDetails[tutor.email] || {};

            return {
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount,
                totalStudentFees: totalStudentFees.toFixed(2),
                managementFee: managementFee.toFixed(2),
                totalPay: totalPay, // Keep as number for sorting/calculations
                ...bankDetails
            };
        }).filter(item => item.studentCount > 0); // Only include tutors who submitted reports

        currentPayData = payAdviceData; // Save to global variable for CSV export

        document.getElementById('pay-tutor-count').textContent = payAdviceData.length;
        document.getElementById('pay-student-count').textContent = reportsSnapshot.docs.length;

        tableBody.innerHTML = payAdviceData.sort((a, b) => b.totalPay - a.totalPay).map(item => {
            const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
            const finalPay = (item.totalPay + giftAmount).toFixed(2);
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap font-medium">${item.tutorName}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
                    <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees}</td>
                    <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee}</td>
                    <td class="px-6 py-4 whitespace-nowrap font-semibold text-blue-700">₦${item.totalPay.toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="number" data-email="${item.tutorEmail}" value="${giftAmount}" min="0" class="gift-input w-24 p-1 border rounded text-right">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap font-extrabold text-green-700">₦${finalPay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${item.beneficiaryAccount ? `
                            <p class="text-gray-600">${item.beneficiaryBank}</p>
                            <p class="text-gray-800 font-medium">${item.beneficiaryAccount}</p>
                        ` : '<span class="text-red-500">No Bank Info</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.gift-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const email = e.target.dataset.email;
                const gift = Number(e.target.value) || 0;
                payAdviceGifts[email] = gift;
                // Re-render the table section to update Final Pay
                renderPayAdviceTable(payAdviceData);
            });
        });

    } catch (error) {
        console.error("Error fetching pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

function renderPayAdviceTable(data) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = data.sort((a, b) => b.totalPay - a.totalPay).map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = (item.totalPay + giftAmount).toFixed(2);
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap font-medium">${item.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee}</td>
                <td class="px-6 py-4 whitespace-nowrap font-semibold text-blue-700">₦${item.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="number" data-email="${item.tutorEmail}" value="${giftAmount}" min="0" class="gift-input w-24 p-1 border rounded text-right">
                </td>
                <td class="px-6 py-4 whitespace-nowrap font-extrabold text-green-700">₦${finalPay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${item.beneficiaryAccount ? `
                        <p class="text-gray-600">${item.beneficiaryBank}</p>
                        <p class="text-gray-800 font-medium">${item.beneficiaryAccount}</p>
                    ` : '<span class="text-red-500">No Bank Info</span>'}
                </td>
            </tr>
        `;
    }).join('');

    // Re-attach event listeners for the newly rendered inputs
    document.querySelectorAll('.gift-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const email = e.target.dataset.email;
            const gift = Number(e.target.value) || 0;
            payAdviceGifts[email] = gift;
            renderPayAdviceTable(data); // Re-render with new gift value
        });
    });
}


// --- Break Students Panel ---
async function renderBreakStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Break</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh List</button>
            </div>
            <div id="break-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading list...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('breakStudents');
    }

    try {
        if (!sessionCache.breakStudents) {
            const breakQuery = query(collection(db, "students"), where("summerBreak", "==", true));
            const snapshot = await getDocs(breakQuery);
            saveToLocalStorage('breakStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderBreakStudentsFromCache();

    } catch (error) {
        console.error("Error fetching break students:", error);
        document.getElementById('break-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const students = sessionCache.breakStudents || [];
    const container = document.getElementById('break-list');
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-10">No students are currently marked as on break.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Fee (₦)</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Start Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${students.map(s => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap font-medium">${s.studentName} (${s.grade})</td>
                            <td class="px-6 py-4 whitespace-nowrap">${s.tutorName || 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">₦${(s.studentFee || 0).toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${s.breakStart ? new Date(s.breakStart.toDate()).toLocaleDateString() : 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <button class="end-break-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs hover:bg-green-600" data-student-id="${s.id}">End Break</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.end-break-btn').forEach(button => {
        button.addEventListener('click', () => handleEndBreak(button.dataset.studentId));
    });
}

async function handleEndBreak(studentId) {
    if (confirm("Are you sure you want to end the break for this student and mark them as active?")) {
        try {
            const studentRef = doc(db, "students", studentId);
            await updateDoc(studentRef, {
                summerBreak: false,
                breakStart: deleteField(),
                breakEnd: Timestamp.now()
            });
            alert("Student marked as active!");
            // Invalidate both relevant caches and re-render
            invalidateCache('breakStudents');
            invalidateCache('students');
            fetchAndRenderBreakStudents(true); 
        } catch (error) {
            console.error("Error ending student break: ", error);
            alert("Failed to mark student as active. Check the console for details.");
        }
    }
}


// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    const canApprove = window.userData.permissions?.actions?.canApproveStudents === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Student Approvals</h2>
                <button id="refresh-pending-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh List</button>
            </div>
            <div id="pending-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading list...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('pendingStudents');
    }

    try {
        if (!sessionCache.pendingStudents) {
            const snapshot = await getDocs(collection(db, "pending_students"));
            saveToLocalStorage('pendingStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderPendingApprovalsFromCache();

    } catch (error) {
        console.error("Error fetching pending students:", error);
        document.getElementById('pending-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const students = sessionCache.pendingStudents || [];
    const container = document.getElementById('pending-list');
    const canApprove = window.userData.permissions?.actions?.canApproveStudents === true;

    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-10">No students are currently pending approval.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Assigned Tutor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Parent Info</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Fee/Subjects</th>
                        ${canApprove ? `<th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>` : ''}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${students.map(s => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap font-medium">${s.studentName} (${s.grade})</td>
                            <td class="px-6 py-4 whitespace-nowrap">${s.tutorName || 'Unassigned'} (${s.tutorEmail || 'N/A'})</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <p>${s.parentName || 'N/A'}</p>
                                <p class="text-sm text-gray-500">${s.parentPhone || 'N/A'}</p>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <p>₦${(s.studentFee || 0).toFixed(2)}</p>
                                <p class="text-sm text-gray-500">${s.subjects ? s.subjects.join(', ') : 'N/A'}</p>
                            </td>
                            ${canApprove ? `
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <button class="approve-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs hover:bg-green-600 mr-2" data-student-id="${s.id}">Approve</button>
                                    <button class="reject-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs hover:bg-red-600 mr-2" data-student-id="${s.id}">Reject</button>
                                    <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-600" data-student-id="${s.id}">Edit</button>
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (canApprove) {
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId));
        });
        document.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId));
        });
        document.querySelectorAll('.edit-pending-btn').forEach(button => {
            button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId));
        });
    }
}

// --- Parent Feedback Panel ---
async function renderParentFeedbackPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Parent Feedback (From Tutor Submissions)</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Feedback Items</h4><p id="feedback-count" class="text-2xl font-extrabold">0</p></div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-yellow-800 text-sm">Actionable Items</h4><p id="actionable-count" class="text-2xl font-extrabold">0</p></div>
                <button id="refresh-feedback-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 h-full">Refresh List</button>
            </div>
            <div id="feedback-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading list...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-feedback-btn').addEventListener('click', () => fetchAndRenderParentFeedback(true));
    fetchAndRenderParentFeedback();
}

async function fetchAndRenderParentFeedback(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('parentFeedback');
    }

    try {
        if (!sessionCache.parentFeedback) {
            // Query submissions that have a parent comment
            const feedbackQuery = query(collection(db, "tutor_submissions"), where("parentComment", "!=", null));
            const snapshot = await getDocs(feedbackQuery);
            // Filter out empty comments and map the relevant fields
            const feedbackData = snapshot.docs.filter(doc => doc.data().parentComment && doc.data().parentComment.trim() !== '').map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('parentFeedback', feedbackData);
        }
        renderParentFeedbackFromCache();

    } catch (error) {
        console.error("Error fetching parent feedback:", error);
        document.getElementById('feedback-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderParentFeedbackFromCache() {
    const feedbackItems = sessionCache.parentFeedback || [];
    const container = document.getElementById('feedback-list');

    if (!container) return;

    if (feedbackItems.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-10">No parent feedback found in tutor submissions.</p>`;
        document.getElementById('feedback-count').textContent = 0;
        document.getElementById('actionable-count').textContent = 0;
        return;
    }

    // Simple heuristic for actionable items (e.g., contains 'problem', 'issue', 'need', 'concern', 'unhappy', etc.)
    const actionableRegex = /\b(problem|issue|need|concern|unhappy|disappoint|late|absent|slow|improve)\b/i;
    const actionableItems = feedbackItems.filter(item => actionableRegex.test(item.parentComment));

    document.getElementById('feedback-count').textContent = feedbackItems.length;
    document.getElementById('actionable-count').textContent = actionableItems.length;


    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Submission Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student / Tutor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Parent Feedback</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Rating</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${feedbackItems.map(item => {
                        const isActionable = actionableRegex.test(item.parentComment);
                        const rowClass = isActionable ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50';
                        return `
                            <tr class="${rowClass}">
                                <td class="px-6 py-4 whitespace-nowrap">${item.submittedAt ? new Date(item.submittedAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <p class="font-medium">${item.studentName || 'N/A'}</p>
                                    <p class="text-sm text-gray-500">${item.tutorName || 'N/A'}</p>
                                </td>
                                <td class="px-6 py-4 max-w-lg text-wrap">${item.parentComment || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    ${item.parentRating ? `${'⭐'.repeat(item.parentRating)} (${item.parentRating}/5)` : 'N/A'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}



// ##################################
// # INITIALIZATION & AUTHENTICATION
// ##################################

// NOTE: This entire block has been refactored for efficiency, real-time stability, and proper logout cleanup.

onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById('logout-btn');
    const mainContent = document.getElementById('main-content');

    if (user) {
        const userId = user.uid;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const staffDocRef = doc(db, `artifacts/${appId}/public/data/staff`, userId);

        // <--- UPDATE 3: REPLACED ENTIRE AUTHENTICATION/PERMISSIONS BLOCK WITH THIS EFFICIENT LISTENER ---
        // Fetch staff profile and permissions using ONE real-time listener (onSnapshot)
        onSnapshot(staffDocRef, (docSnap) => {
            window.userData = docSnap.data(); // Make user data globally available for permissions checks
            
            // Check if the staff document exists
            if (!docSnap.exists()) {
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory. Please contact administrator.</p>`;
                if (logoutBtn) logoutBtn.classList.remove('hidden'); // Show logout even if account isn't registered
                return;
            }

            const staffData = docSnap.data();
            
            if (staffData.approved === true) {
                // Account is approved and active
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name || 'Staff Member'}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${staffData.role || 'Unassigned'}`;
                if (logoutBtn) logoutBtn.classList.remove('hidden');

                // Get permissions and save them
                const permissions = staffData.permissions || {};
                saveToLocalStorage('staffPermissions', permissions); // Persist permissions

                // Initialize real-time data listeners only once using the guard flag
                if (!sessionCache.listenersInitialized) {
                    setupRealtimeListeners(userId, () => setActiveNav(activeNavId)); // Assuming setupRealtimeListeners is defined elsewhere
                    sessionCache.listenersInitialized = true;
                }

                // Render the sidebar and ensure the correct view is active (handles permission changes)
                renderSidebar(permissions);

                // Logic to check and load the active view (retains existing navigation logic)
                const activeNavId = document.querySelector('.nav-item.active')?.id || 'management-tutor-view-link';

                if (window.userData.permissions?.views?.canAccessViews) {
                    if (!allNavItems[activeNavId] || !window.userData.permissions.views[activeNavId.replace('-link', '')]) {
                        // Find the first available view and load it
                        const firstAvailableView = Object.keys(allNavItems).find(id => window.userData.permissions.views[id.replace('-link', '')]);
                        if(firstAvailableView) {
                            allNavItems[firstAvailableView].fn(mainContent);
                        } else {
                            if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                        }
                    } else {
                        const currentItem = allNavItems[activeNavId];
                        if(currentItem) currentItem.fn(mainContent);
                    }
                } else {
                    if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                }

            } else {
                // Account pending approval
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${staffData.name || 'Staff Member'}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval by an administrator.</p>`;
            }
        }, (error) => {
            console.error("Staff data listener error:", error);
            // showNotification("Failed to fetch user profile/permissions.", 'error'); // Assuming showNotification is defined elsewhere
        });
        
        // Setup robust logout listener
        if(logoutBtn) logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.clear(); // <--- UPDATE 3: CRITICAL FIX: Clear cache on secure logout
                window.location.href = "management-auth.html";
            }).catch(e => {
                console.error("Logout failed:", e);
                // showNotification("Logout failed. Please try again.", 'error'); 
                alert("Logout failed. Please try again.");
            });
        });

    } else {
        // No user is signed in, redirect to login page
        window.location.href = "management-auth.html";
    }
});

// [End Updated management.js File]
