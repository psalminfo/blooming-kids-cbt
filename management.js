// [Begin Updated management.js File]

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
                <div class="flex items-center gap-4">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents..." class="p-2 border rounded-md w-64">
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
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm))
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
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm))
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
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left font-semibold">Student Name</th>
                                    <th class="px-4 py-2 text-left font-semibold">Fee</th>
                                    <th class="px-4 py-2 text-left font-semibold">Grade</th>
                                    <th class="px-4 py-2 text-left font-semibold">Days</th>
                                    <th class="px-4 py-2 text-left font-semibold">Subjects</th>
                                    <th class="px-4 py-2 text-left font-semibold">Parent Name</th>
                                    <th class="px-4 py-2 text-left font-semibold">Parent Phone</th>
                                    ${showActionsColumn ? `<th class="px-4 py-2 text-left font-semibold">Actions</th>` : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${studentsTableRows}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>
        `;
    }).join('');

    // Attach event listeners for edit and delete buttons
    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleEditStudent(e.target.dataset.studentId));
        });
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteStudent(e.target.dataset.studentId));
        });
    }
}

// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-yellow-700 mb-4">Pending Approvals</h2>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals() {
    try {
        if (!sessionCache.pendingStudents) {
            const pendingStudentsSnapshot = await getDocs(collection(db, "pending_students"));
            saveToLocalStorage('pendingStudents', pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderPendingApprovalsFromCache();
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        document.getElementById('pending-approvals-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load pending data.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const pendingList = document.getElementById('pending-approvals-list');
    if (!pendingList) return;

    if (pendingStudents.length === 0) {
        pendingList.innerHTML = `<p class="text-center text-gray-500 py-10">No pending students at this time.</p>`;
        return;
    }

    pendingList.innerHTML = pendingStudents.map(student => {
        return `
            <div class="border rounded-lg p-4 shadow-sm flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-lg">${student.studentName}</h4>
                    <p class="text-sm text-gray-600">Grade: ${student.grade}</p>
                    <p class="text-sm text-gray-600">Subjects: ${student.subjects ? student.subjects.join(', ') : 'N/A'}</p>
                    <p class="text-sm text-gray-600">Parent: ${student.parentName || 'N/A'}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="approve-btn bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600" data-student-id="${student.id}">Approve</button>
                    <button class="reject-btn bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600" data-student-id="${student.id}">Reject</button>
                </div>
            </div>
        `;
    }).join('');

    // Attach event listeners
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleApproveStudent(e.target.dataset.studentId));
    });
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleRejectStudent(e.target.dataset.studentId));
    });
}

// --- Reports Panel ---
async function renderReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-blue-700 mb-4">Reports</h2>
            <div id="reports-content">
                <p>Reports will be displayed here.</p>
            </div>
        </div>
    `;
}


// --- Break Students Panel ---
async function renderBreakStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-red-700 mb-4">Students on Break</h2>
            <div id="break-students-content">
                <p>Students on break will be displayed here.</p>
            </div>
        </div>
    `;
}

// ##################################
// # PAY ADVICE PANEL & LOGIC
// ##################################

// New utility function to handle batching of IN queries
async function fetchPayAdviceInBatches(tutorEmails) {
    const BATCH_SIZE = 30; // Firestore 'IN' query limit
    const allPayAdvice = [];
    for (let i = 0; i < tutorEmails.length; i += BATCH_SIZE) {
        const batch = tutorEmails.slice(i, i + BATCH_SIZE);
        const q = query(collection(db, "pay_advice"), where("tutorEmail", "in", batch));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            allPayAdvice.push({ id: doc.id, ...doc.data() });
        });
    }
    return allPayAdvice;
}

async function fetchAndRenderPayAdvice(forceRefresh = false) {
    const payAdviceList = document.getElementById('pay-advice-list');
    if (!payAdviceList) return;

    payAdviceList.innerHTML = `<p class="text-center text-gray-500 py-10">Loading pay advice data...</p>`;
    document.getElementById('pay-advice-export-csv-btn').disabled = true;

    try {
        if (forceRefresh) {
            invalidateCache('payAdvice');
        }

        if (!sessionCache.payAdvice) {
            const tutorsSnapshot = await getDocs(collection(db, "tutors"));
            const tutorEmails = tutorsSnapshot.docs.map(doc => doc.data().email);

            // Use the new batched fetch function
            const payAdviceData = await fetchPayAdviceInBatches(tutorEmails);

            // Fetch beneficiary bank details for each tutor
            const beneficiaryDetails = {};
            const tutorPromises = payAdviceData.map(async (advice) => {
                if (advice.tutorEmail && !beneficiaryDetails[advice.tutorEmail]) {
                    const tutorDoc = await getDoc(doc(db, "tutors", advice.tutorEmail));
                    if (tutorDoc.exists()) {
                        beneficiaryDetails[advice.tutorEmail] = {
                            beneficiaryBank: tutorDoc.data().beneficiaryBank,
                            beneficiaryAccount: tutorDoc.data().beneficiaryAccount,
                            beneficiaryName: tutorDoc.data().beneficiaryName,
                        };
                    }
                }
            });
            await Promise.all(tutorPromises);

            const mergedData = payAdviceData.map(advice => ({
                ...advice,
                beneficiaryBank: beneficiaryDetails[advice.tutorEmail]?.beneficiaryBank,
                beneficiaryAccount: beneficiaryDetails[advice.tutorEmail]?.beneficiaryAccount,
                beneficiaryName: beneficiaryDetails[advice.tutorEmail]?.beneficiaryName,
            }));

            saveToLocalStorage('payAdvice', mergedData);
            currentPayData = mergedData;
        }

        renderPayAdviceFromCache();
    } catch (error) {
        console.error("Error loading pay advice data: ", error);
        payAdviceList.innerHTML = `<p class="text-center text-red-500 py-10">Error loading pay advice data: ${error.message}</p>`;
    }
}

function renderPayAdviceFromCache() {
    const payAdviceList = document.getElementById('pay-advice-list');
    if (!payAdviceList) return;

    const payAdviceData = sessionCache.payAdvice || [];
    currentPayData = payAdviceData; // Update the session-level state

    if (payAdviceData.length === 0) {
        payAdviceList.innerHTML = `<p class="text-center text-gray-500 py-10">No pay advice data found.</p>`;
        document.getElementById('pay-advice-export-csv-btn').disabled = true;
        return;
    }

    let totalPayAdvice = 0;
    payAdviceList.innerHTML = `
        <table class="min-w-full text-sm divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-2 text-left font-semibold">Tutor Name</th>
                    <th class="px-4 py-2 text-left font-semibold">Students</th>
                    <th class="px-4 py-2 text-left font-semibold">Total Fee (₦)</th>
                    <th class="px-4 py-2 text-left font-semibold">Mgt Fee (₦)</th>
                    <th class="px-4 py-2 text-left font-semibold">Total Pay (₦)</th>
                    <th class="px-4 py-2 text-left font-semibold">Gift (₦)</th>
                    <th class="px-4 py-2 text-left font-semibold">Final Pay (₦)</th>
                    <th class="px-4 py-2 text-left font-semibold">Date</th>
                    <th class="px-4 py-2 text-left font-semibold">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                ${payAdviceData.map(advice => {
                    totalPayAdvice += advice.totalPay;
                    const giftAmount = payAdviceGifts[advice.tutorEmail] || 0;
                    const finalPay = advice.totalPay + giftAmount;
                    const date = advice.dateGenerated ? advice.dateGenerated.toDate().toLocaleDateString() : 'N/A';

                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium">${advice.tutorName}</td>
                            <td class="px-4 py-2">${advice.studentCount}</td>
                            <td class="px-4 py-2">${advice.totalStudentFees.toFixed(2)}</td>
                            <td class="px-4 py-2">${advice.managementFee.toFixed(2)}</td>
                            <td class="px-4 py-2">${advice.totalPay.toFixed(2)}</td>
                            <td class="px-4 py-2">
                                <input type="number" class="w-20 p-1 border rounded gift-input" data-tutor-email="${advice.tutorEmail}" value="${giftAmount}">
                            </td>
                            <td class="px-4 py-2 final-pay-cell font-bold">${finalPay.toFixed(2)}</td>
                            <td class="px-4 py-2">${date}</td>
                            <td class="px-4 py-2">
                                <button class="btn-primary-small view-details-btn" data-pay-advice-id="${advice.id}">View Details</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('total-pay-advice').textContent = totalPayAdvice.toFixed(2);
    document.getElementById('pay-advice-export-csv-btn').disabled = false;

    // Attach event listeners for gift inputs and view details buttons
    document.querySelectorAll('.gift-input').forEach(input => {
        input.addEventListener('input', updateFinalPay);
    });

    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => handleViewPayAdviceDetails(e.target.dataset.payAdviceId));
    });
}


function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-indigo-700 mb-4">Pay Advice</h2>
            <div class="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div class="flex items-center gap-4">
                    <button id="refresh-pay-advice-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="pay-advice-export-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export as CSV</button>
                </div>
                <div class="bg-indigo-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-indigo-800 text-sm">Total Pay Advice (₦)</h4>
                    <p id="total-pay-advice" class="text-2xl font-extrabold">0.00</p>
                </div>
            </div>
            <div id="pay-advice-list" class="overflow-x-auto">
                <p class="text-center text-gray-500 py-10">No pay advice data loaded.</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pay-advice-btn').addEventListener('click', () => fetchAndRenderPayAdvice(true));
    document.getElementById('pay-advice-export-csv-btn').addEventListener('click', () => {
        const csv = convertPayAdviceToCSV(currentPayData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "pay_advice.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    fetchAndRenderPayAdvice();
}

function updateFinalPay(event) {
    const input = event.target;
    const tutorEmail = input.dataset.tutorEmail;
    const giftAmount = parseFloat(input.value) || 0;
    payAdviceGifts[tutorEmail] = giftAmount;

    // Recalculate and update the final pay for this row
    const row = input.closest('tr');
    const payAdviceItem = currentPayData.find(item => item.tutorEmail === tutorEmail);
    if (payAdviceItem) {
        const finalPay = payAdviceItem.totalPay + giftAmount;
        const finalPayCell = row.querySelector('.final-pay-cell');
        if (finalPayCell) {
            finalPayCell.textContent = finalPay.toFixed(2);
        }
    }
}

async function handleViewPayAdviceDetails(payAdviceId) {
    try {
        const payAdviceDoc = await getDoc(doc(db, "pay_advice", payAdviceId));
        if (!payAdviceDoc.exists()) {
            alert("Pay advice not found!");
            return;
        }
        const details = payAdviceDoc.data();
        const detailsHtml = `
            <div class="p-4 bg-gray-100 rounded-lg shadow-inner">
                <h4 class="font-bold text-lg mb-2">Details for ${details.tutorName}</h4>
                <p><strong>Students:</strong> ${details.students.map(s => `${s.studentName} (${s.studentFee})`).join(', ')}</p>
                <p><strong>Subjects:</strong> ${details.subjects}</p>
                <p><strong>Report ID:</strong> ${details.reportId}</p>
                <p><strong>Date Generated:</strong> ${details.dateGenerated.toDate().toLocaleDateString()}</p>
            </div>
        `;
        document.getElementById('pay-advice-details-modal').innerHTML = detailsHtml;
        document.getElementById('pay-advice-details-modal').classList.remove('hidden');
    } catch (error) {
        console.error("Error fetching pay advice details: ", error);
        alert("Error fetching details. Check the console for more info.");
    }
}

// ##################################
// # MAIN NAVIGATION & APP LOGIC
// ##################################

const mainContent = document.getElementById('main-content');
const navLinks = document.getElementById('nav-links');
const logoutBtn = document.getElementById('logout-btn');

const allNavItems = {
    'directory': {
        name: 'Directory',
        fn: renderManagementTutorView,
        requiredPermission: 'readStudents'
    },
    'pending-approvals': {
        name: 'Pending Approvals',
        fn: renderPendingApprovalsPanel,
        requiredPermission: 'manageApprovals'
    },
    'pay-advice': {
        name: 'Pay Advice',
        fn: renderPayAdvicePanel,
        requiredPermission: 'readPayAdvice'
    },
    'reports': {
        name: 'Reports',
        fn: renderReportsPanel,
        requiredPermission: 'readReports'
    },
    'break-students': {
        name: 'Break Students',
        fn: renderBreakStudentsPanel,
        requiredPermission: 'manageBreakStudents'
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data().permissions) {
                const userPermissions = docSnap.data().permissions;
                const userRoles = docSnap.data().roles || [];

                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data().name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Roles: ${userRoles.map(capitalize).join(', ')}`;
                if (navLinks) {
                    navLinks.innerHTML = '';
                    const hasDefaultContent = window.location.hash.length <= 1;
                    let activeNavId = 'directory'; // Default view
                    let isInitialRender = true;

                    for (const id in allNavItems) {
                        const navItem = allNavItems[id];
                        if (userPermissions.views[navItem.requiredPermission]) {
                            const li = document.createElement('li');
                            const a = document.createElement('a');
                            a.href = `#${id}`;
                            a.textContent = navItem.name;
                            a.className = `cursor-pointer block p-2 rounded-lg transition-colors hover:bg-green-200`;
                            li.appendChild(a);
                            navLinks.appendChild(li);

                            if (hasDefaultContent && isInitialRender) {
                                a.classList.add('bg-green-500', 'text-white');
                                isInitialRender = false;
                            } else if (window.location.hash.substring(1) === id) {
                                a.classList.add('bg-green-500', 'text-white');
                                activeNavId = id;
                            }
                        }
                    }

                    window.onhashchange = () => {
                        const newHash = window.location.hash.substring(1);
                        if (newHash && allNavItems[newHash] && userPermissions.views[allNavItems[newHash].requiredPermission]) {
                            activeNavId = newHash;
                            Array.from(navLinks.querySelectorAll('a')).forEach(a => {
                                a.classList.remove('bg-green-500', 'text-white');
                                if (a.getAttribute('href') === `#${activeNavId}`) {
                                    a.classList.add('bg-green-500', 'text-white');
                                }
                            });
                            allNavItems[activeNavId].fn(mainContent);
                        } else {
                            // Re-apply styles to the default or last valid active item if hash is invalid
                            const currentItem = allNavItems[activeNavId];
                            if(currentItem) currentItem.fn(mainContent);
                        }
                    }

                    if (window.location.hash.substring(1) && allNavItems[window.location.hash.substring(1)]) {
                        const activeNavId = window.location.hash.substring(1);
                        if (userPermissions.views[allNavItems[activeNavId].requiredPermission]) {
                            allNavItems[activeNavId].fn(mainContent);
                        } else {
                            const currentItem = allNavItems[activeNavId];
                            if(currentItem) currentItem.fn(mainContent);
                        }
                    } else {
                        const currentItem = allNavItems[activeNavId];
                        if(currentItem) currentItem.fn(mainContent);
                    }
                }
            } else {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
            }
        });

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


// [End Updated management.js File]
