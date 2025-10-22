// [Begin Complete management.js File]

import { auth, db } from './firebaseConfig.js';
// REQUIRED CHANGE 1: Add 'increment' to Firestore imports
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc, increment } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
    pendingReferrals: null, // REQUIRED CHANGE 2: Add pendingReferrals to cache
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

// REQUIRED CHANGE 3: Implement handleApproveReferral
async function handleApproveReferral(referralId, refererEmail) {
    if (confirm("Are you sure you want to approve this referral? The referrer will be rewarded.")) {
        try {
            const batch = writeBatch(db);
            
            // 1. Reward: Atomically increment the referralCount field on the parent's document
            const parentRef = doc(db, "parents", refererEmail);
            batch.update(parentRef, {
                referralCount: increment(1) // Uses the imported 'increment'
            });

            // 2. Cleanup: Delete the entry from the pending_referrals collection
            const referralRef = doc(db, "pending_referrals", referralId);
            batch.delete(referralRef);

            await batch.commit();
            alert("Referral approved and referrer rewarded successfully!");
            invalidateCache('pendingReferrals');
            fetchAndRenderPendingApprovals(); // Re-fetch and render the current panel
        } catch (error) {
            console.error("Error approving referral:", error);
            alert("Error approving referral. Check the console for details. (Ensure parent document exists for reward)");
        }
    }
}

// REQUIRED CHANGE 3: Implement handleRejectReferral
async function handleRejectReferral(referralId) {
    if (confirm("Are you sure you want to reject this referral? This will delete the entry.")) {
        try {
            await deleteDoc(doc(db, "pending_referrals", referralId));
            alert("Referral rejected successfully!");
            invalidateCache('pendingReferrals');
            fetchAndRenderPendingApprovals(); // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting referral:", error);
            alert("Error rejecting referral. Check the console for details.");
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
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
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
            return querySnapshots.flatMap(snapshot => snapshot.docs);
        };

        // Fetch both tutors (in chunks) and all students concurrently.
        const [tutorDocs, studentsSnapshot] = await Promise.all([
            fetchTutorsInChunks(activeTutorEmails),
            getDocs(collection(db, "students"))
        ]);
        // ### END FIXED SECTION ###

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];
        
        // Iterate over the combined array of tutor documents
        tutorDocs.forEach(doc => {
            const tutor = doc.data();
            const assignedStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += assignedStudents.length;
            const bankDetails = tutorBankDetails[tutor.email] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: assignedStudents.length,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee,
                ...bankDetails
            });
        });
        currentPayData = payData; // Store for reuse
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        renderPayAdviceTable();

    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

function renderPayAdviceTable() {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = currentPayData.map(d => {
        const giftAmount = payAdviceGifts[d.tutorEmail] || 0;
        const finalPay = d.totalPay + giftAmount;
        return `
            <tr>
                <td class="px-6 py-4">${d.tutorName}</td>
                <td class="px-6 py-4">${d.studentCount}</td>
                <td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 text-blue-600 font-bold">₦${giftAmount.toFixed(2)}</td>
                <td class="px-6 py-4 font-bold">₦${finalPay.toFixed(2)}</td>
                <td class="px-6 py-4">
                    <button class="add-gift-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-tutor-email="${d.tutorEmail}">Add Gift</button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.add-gift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const currentGift = payAdviceGifts[tutorEmail] || 0;
            const giftInput = prompt(`Enter gift amount for ${tutorEmail}:`, currentGift);

            if (giftInput !== null) {
                const giftAmount = parseFloat(giftInput);
                if (!isNaN(giftAmount) && giftAmount >= 0) {
                    payAdviceGifts[tutorEmail] = giftAmount;
                    renderPayAdviceTable(); // Re-render the table with the new gift
                } else {
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}

// --- Tutor Reports Panel ---
async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor Reports</h2>
                <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Unique Tutors Submitted</h4>
                    <p id="report-tutor-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Reports Submitted</h4>
                    <p id="report-total-count" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-center">Loading reports...</p></div>
        </div>
    `;
    document.getElementById('refresh-reports-btn').addEventListener('click', () => fetchAndRenderTutorReports(true));
    fetchAndRenderTutorReports();
}

async function fetchAndRenderTutorReports(forceRefresh = false) {
    if (forceRefresh) invalidateCache('reports');

    const reportsListContainer = document.getElementById('tutor-reports-list');
    
    try {
        if (!sessionCache.reports) {
            reportsListContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching reports from server...</p>`;
            const snapshot = await getDocs(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")));
            saveToLocalStorage('reports', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        renderTutorReportsFromCache();
    } catch(error) {
        console.error("Error fetching reports:", error);
        reportsListContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load reports.</p>`;
    }
}

function renderTutorReportsFromCache() {
    const reports = sessionCache.reports || [];
    const reportsListContainer = document.getElementById('tutor-reports-list');
    if (!reportsListContainer) return;

    if (reports.length === 0) {
        reportsListContainer.innerHTML = `<p class="text-center text-gray-500">No reports found. Click Refresh to fetch from server.</p>`;
        return;
    }

    const reportsByTutor = {};
    reports.forEach(report => {
        if (!reportsByTutor[report.tutorEmail]) {
            reportsByTutor[report.tutorEmail] = { name: report.tutorName || report.tutorEmail, reports: [] };
        }
        reportsByTutor[report.tutorEmail].reports.push(report);
    });

    document.getElementById('report-tutor-count').textContent = Object.keys(reportsByTutor).length;
    document.getElementById('report-total-count').textContent = reports.length;

    const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;

    reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
        const reportLinks = tutorData.reports.map(report => {
            const buttonHTML = canDownload ? `<button class="download-report-btn bg-green-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">Download</button>` : `<button class="view-report-btn bg-gray-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">View</button>`;
            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">${report.studentName}<span>${buttonHTML}</span></li>`;
        }).join('');

        const zipButtonHTML = canDownload ? `<div class="p-4 border-t"><button class="zip-reports-btn bg-blue-600 text-white px-4 py-2 text-sm rounded w-full hover:bg-blue-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Zip & Download All Reports</button></div>` : '';

        return `<details class="border rounded-lg">
            <summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary>
            <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
            ${zipButtonHTML}
        </details>`;
    }).join('');

    document.querySelectorAll('.download-report-btn').forEach(button => button.addEventListener('click', (e) => {
        e.stopPropagation();
        viewReportInNewTab(e.target.dataset.reportId, true);
    }));
    document.querySelectorAll('.view-report-btn').forEach(button => button.addEventListener('click', (e) => {
        e.stopPropagation();
        viewReportInNewTab(e.target.dataset.reportId, false);
    }));
    document.querySelectorAll('.zip-reports-btn').forEach(button => button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tutorEmail = e.target.dataset.tutorEmail;
        const tutorData = reportsByTutor[tutorEmail];
        if (tutorData) await zipAndDownloadTutorReports(tutorData.reports, tutorData.name, e.target);
    }));
}

// REQUIRED CHANGE 3: New function to fetch pending referrals
async function fetchPendingReferrals() {
    try {
        const snapshot = await getDocs(query(collection(db, "pending_referrals"), orderBy("createdAt", "desc"))); // REQUIRED: ordered by createdAt
        const referrals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('pendingReferrals', referrals);
        return referrals;
    } catch (error) {
        console.error("Error fetching pending referrals:", error);
        return [];
    }
}

// REQUIRED CHANGE 3: New function to render the referrals section
function renderPendingReferralsSection(referrals) {
    const listHtml = referrals.length > 0 ? referrals.map(ref => `
        <div class="p-4 border-b hover:bg-yellow-50 flex justify-between items-center flex-wrap gap-2">
            <div>
                <p class="font-semibold text-yellow-800">${ref.refererName || ref.refererEmail} referred ${ref.studentName || 'a student'}</p>
                <p class="text-sm text-gray-600">Referrer Email: <span class="font-mono">${ref.refererEmail}</span></p>
                <p class="text-sm text-gray-600">Referred Student Name: ${ref.studentName}</p>
                <p class="text-xs text-gray-500">Date: ${ref.createdAt.toDate().toLocaleString()}</p>
            </div>
            <div class="flex space-x-2">
                <button class="approve-referral-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        data-referral-id="${ref.id}" data-referer-email="${ref.refererEmail}">Approve & Reward</button>
                <button class="reject-referral-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        data-referral-id="${ref.id}">Reject</button>
            </div>
        </div>
    `).join('') : '<p class="text-center text-gray-500 py-4">No pending referrals.</p>';

    return `
        <div class="bg-yellow-100 p-4 rounded-lg shadow-inner mt-4">
            <h3 class="text-xl font-bold text-yellow-900 mb-3">Referral Approvals (${referrals.length})</h3>
            <div id="pending-referrals-list">
                ${listHtml}
            </div>
        </div>
    `;
}

// New function to render the students section (refactored from old renderPendingApprovalsFromCache)
function renderPendingStudentsSection(students) {
    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;

    const studentsListHtml = students.length > 0 ? students.map(student => {
        const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
        const dateString = student.createdAt ? student.createdAt.toDate().toLocaleDateString() : 'N/A';
        const editButton = canEditStudents ? `<button class="edit-pending-student-btn bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600" data-student-id="${student.id}">Edit</button>` : '';
        return `
            <div class="p-4 border-b hover:bg-green-50 flex justify-between items-center flex-wrap gap-2">
                <div>
                    <p class="font-semibold text-green-800">${student.studentName} (${student.grade})</p>
                    <p class="text-sm text-gray-600">Tutor: ${student.tutorName || 'Unassigned'}</p>
                    <p class="text-xs text-gray-500">Subjects: ${subjects} | Parent: ${student.parentName} | Date: ${dateString}</p>
                </div>
                <div class="flex space-x-2">
                    ${editButton}
                    <button class="approve-student-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" data-student-id="${student.id}">Approve</button>
                    <button class="reject-student-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700" data-student-id="${student.id}">Reject</button>
                </div>
            </div>
        `;
    }).join('') : '<p class="text-center text-gray-500 py-4">No pending students.</p>';

    return `
        <div class="bg-green-100 p-4 rounded-lg shadow-inner">
            <h3 class="text-xl font-bold text-green-900 mb-3">Student Approvals (${students.length})</h3>
            <div id="pending-students-list">
                ${studentsListHtml}
            </div>
        </div>
    `;
}

// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                <button id="refresh-pending-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    fetchAndRenderPendingApprovals();
}

// REQUIRED CHANGE 4: Update fetchAndRenderPendingApprovals to handle both students and referrals
async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    const listContainer = document.getElementById('pending-approvals-list');
    if (forceRefresh) {
        invalidateCache('pendingStudents');
        invalidateCache('pendingReferrals'); // Invalidate new cache
    }

    try {
        // REQUIRED CHANGE 4: Check for both students and referrals cache
        if (!sessionCache.pendingStudents || !sessionCache.pendingReferrals) { 
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching pending approvals...</p>`;
            
            // REQUIRED CHANGE 4: Call and await both fetch operations concurrently
            const [studentsSnapshot, referralsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "pending_students"))),
                getDocs(query(collection(db, "pending_referrals"), orderBy("createdAt", "desc")))
            ]);

            // Save new caches
            saveToLocalStorage('pendingStudents', studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            saveToLocalStorage('pendingReferrals', referralsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
        }
        renderPendingApprovalsFromCache();
    } catch(error) {
        console.error("Error fetching pending approvals data:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

// REQUIRED CHANGE 4: Update renderPendingApprovalsFromCache to render both sections and attach new listeners
function renderPendingApprovalsFromCache() {
    const students = sessionCache.pendingStudents || [];
    const referrals = sessionCache.pendingReferrals || []; // Get referrals from cache
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (students.length === 0 && referrals.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No pending approvals (students or referrals) at this time.</p>`;
        return;
    }
    
    // REQUIRED CHANGE 4: Render both sections
    const studentsSection = renderPendingStudentsSection(students); 
    const referralsSection = renderPendingReferralsSection(referrals); 
    
    listContainer.innerHTML = studentsSection + referralsSection; // Combine the two sections

    // Attach existing student event listeners
    document.querySelectorAll('.edit-pending-student-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-student-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-student-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));

    // REQUIRED CHANGE 4: Attach new referral event listeners
    document.querySelectorAll('.approve-referral-btn').forEach(button => button.addEventListener('click', () => {
        handleApproveReferral(button.dataset.referralId, button.dataset.refererEmail);
    }));
    document.querySelectorAll('.reject-referral-btn').forEach(button => button.addEventListener('click', () => {
        handleRejectReferral(button.dataset.referralId);
    }));
}

// --- Summer Break Panel ---
// ... (Content for Summer Break Panel remains unchanged)
async function fetchAndRenderSummerBreak(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('breakStudents');
    }

    const listContainer = document.getElementById('summer-break-list');
    listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Loading students...</p>`;

    try {
        if (!sessionCache.breakStudents) {
            const studentsSnapshot = await getDocs(query(collection(db, "students"), where("status", "==", "approved")));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter only students marked with summerBreak: true
            const breakStudents = allStudents.filter(s => s.summerBreak === true);
            saveToLocalStorage('breakStudents', breakStudents);
        }

        renderSummerBreakFromCache();
    } catch (error) {
        console.error("Error fetching summer break data:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderSummerBreakFromCache() {
    const breakStudents = sessionCache.breakStudents || [];
    const listContainer = document.getElementById('summer-break-list');
    if (!listContainer) return;

    document.getElementById('break-student-count-badge').textContent = breakStudents.length;

    if (breakStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-green-600 py-10 font-semibold">No students currently marked as being on summer break.</p>`;
        return;
    }

    const studentsTableRows = breakStudents
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
        .map(student => {
            const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2 font-medium">${student.studentName}</td>
                    <td class="px-4 py-2">${student.tutorName}</td>
                    <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                    <td class="px-4 py-2">${subjects}</td>
                    <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                    <td class="px-4 py-2">
                        <button class="remove-break-btn bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700" data-student-id="${student.id}">Remove Break</button>
                    </td>
                </tr>
            `;
        }).join('');

    listContainer.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Student Name</th>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Tutor</th>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Fee</th>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Subjects</th>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Parent Name</th>
                        <th class="px-4 py-2 text-left text-xs font-medium uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.remove-break-btn').forEach(button => button.addEventListener('click', (e) => handleRemoveSummerBreak(e.target.dataset.studentId)));
}

async function handleRemoveSummerBreak(studentId) {
    if (confirm("Are you sure you want to remove this student from summer break? They will return to the active directory.")) {
        try {
            await updateDoc(doc(db, "students", studentId), { summerBreak: false });
            alert("Student returned to active directory successfully!");
            invalidateCache('breakStudents');
            invalidateCache('students'); // Also update the main student list
            renderSummerBreakPanel(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error removing student from break: ", error);
            alert("Error updating student status. Check the console for details.");
        }
    }
}

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Summer Break Management</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-red-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-red-800 text-sm">Students on Break</h4>
                    <p id="break-student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="summer-break-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading data...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderSummerBreak(true));
    fetchAndRenderSummerBreak();
}

// --- Parent Feedback Panel ---
// ... (Content for Parent Feedback Panel remains unchanged)
async function renderParentFeedbackPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Parent Feedback</h2>
                <button id="refresh-feedback-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="feedback-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading feedback...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-feedback-btn').addEventListener('click', () => fetchAndRenderParentFeedback(true));
    fetchAndRenderParentFeedback();
}

async function fetchAndRenderParentFeedback(forceRefresh = false) {
    if (forceRefresh) invalidateCache('parentFeedback');

    const feedbackListContainer = document.getElementById('feedback-list');
    
    try {
        if (!sessionCache.parentFeedback) {
            feedbackListContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching feedback from server...</p>`;
            const snapshot = await getDocs(query(collection(db, "parent_feedback"), orderBy("submittedAt", "desc")));
            saveToLocalStorage('parentFeedback', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        renderParentFeedbackFromCache();
    } catch(error) {
        console.error("Error fetching feedback:", error);
        feedbackListContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load feedback.</p>`;
    }
}

function renderParentFeedbackFromCache() {
    const feedback = sessionCache.parentFeedback || [];
    const feedbackListContainer = document.getElementById('feedback-list');
    if (!feedbackListContainer) return;

    if (feedback.length === 0) {
        feedbackListContainer.innerHTML = `<p class="text-center text-gray-500">No parent feedback found.</p>`;
        return;
    }

    feedbackListContainer.innerHTML = feedback.map(item => {
        const dateString = item.submittedAt ? item.submittedAt.toDate().toLocaleString() : 'N/A';
        const ratingColor = item.rating >= 4 ? 'text-green-600' : item.rating >= 2 ? 'text-yellow-600' : 'text-red-600';

        return `
            <div class="border rounded-lg shadow-sm p-4 bg-gray-50">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-semibold text-lg">${item.parentName || 'Anonymous Parent'} (${item.studentName})</p>
                        <p class="text-sm text-gray-600">Tutor: ${item.tutorName || 'N/A'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">${dateString}</p>
                        <p class="font-bold text-xl ${ratingColor}">${item.rating}/5 Stars</p>
                    </div>
                </div>
                <div class="mt-3 p-3 bg-white border rounded-md">
                    <h4 class="font-medium text-gray-700 mb-1">Feedback:</h4>
                    <p class="text-gray-800 whitespace-pre-wrap">${item.comments || 'No comments provided.'}</p>
                </div>
            </div>
        `;
    }).join('');
}


// ##################################
// # REPORT DOWNLOAD UTILITIES
// ##################################

// Utility function to convert TutorSubmission data to CSV
function convertTutorSubmissionToCSV(reportData) {
    const header = [
        'Field', 'Value'
    ];
    const rows = [
        ['Report ID', reportData.id],
        ['Submitted At', reportData.submittedAt ? reportData.submittedAt.toDate().toLocaleString() : 'N/A'],
        ['Tutor Name', reportData.tutorName || 'N/A'],
        ['Tutor Email', reportData.tutorEmail || 'N/A'],
        ['Student Name', reportData.studentName || 'N/A'],
        ['Student Grade', reportData.grade || 'N/A'],
        ['Subjects', Array.isArray(reportData.subjects) ? reportData.subjects.join(', ') : reportData.subjects || 'N/A'],
        ['Lesson Date', reportData.lessonDate || 'N/A'],
        ['Lesson Time', reportData.lessonTime || 'N/A'],
        ['Attendance', reportData.attendance || 'N/A'],
        ['Topics Covered', reportData.topicsCovered || 'N/A'],
        ['Student Performance', reportData.studentPerformance || 'N/A'],
        ['Homework Assigned', reportData.homeworkAssigned || 'N/A'],
        ['Next Lesson Plan', reportData.nextLessonPlan || 'N/A'],
        ['Issues/Concerns', reportData.issues || 'N/A'],
        ['Beneficiary Name', reportData.beneficiaryName || 'N/A'],
        ['Beneficiary Bank', reportData.beneficiaryBank || 'N/A'],
        ['Beneficiary Account', reportData.beneficiaryAccount || 'N/A'],
        ['Is First Report', reportData.isFirstReport ? 'Yes' : 'No']
    ];
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Function to fetch and open report in a new tab (or trigger download)
async function viewReportInNewTab(reportId, download = false) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) {
            alert("Report not found!");
            return;
        }
        const reportData = { id: reportDoc.id, ...reportDoc.data() };
        const csvContent = convertTutorSubmissionToCSV(reportData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const filename = `Tutor_Report_${reportData.tutorName.replace(/\s/g, '_')}_${reportData.studentName.replace(/\s/g, '_')}_${reportId.substring(0, 8)}.csv`;

        if (download) {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        } else {
            // Open in a new tab for viewing (using a simple data URI if supported, but CSV is often downloaded)
            window.open(url, '_blank');
        }
    } catch (error) {
        console.error("Error fetching or opening report:", error);
        alert("Failed to access report data.");
    }
}

// Placeholder for zip library (assumes JSZip or similar is imported elsewhere, or handles simple multiple downloads)
async function zipAndDownloadTutorReports(reports, tutorName, buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Preparing Zip...';
    buttonElement.disabled = true;

    // A simpler implementation without an external library: sequential download prompt (less ideal but avoids external dependency)
    // In a real-world scenario, you would use JSZip or a server-side endpoint.
    if (confirm(`You are about to download ${reports.length} reports for ${tutorName}. Proceed?`)) {
        for (const report of reports) {
            await viewReportInNewTab(report.id, true);
            // Small delay to allow browser to handle multiple downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        alert("All reports queued for download.");
    }

    buttonElement.textContent = originalText;
    buttonElement.disabled = false;
}


// ##################################
// # NAVIGATION & AUTHENTICATION
// ##################################

const allNavItems = {
    'tutor-management': { text: 'Tutor Management', fn: renderManagementTutorView, requiredPermission: 'canViewTutorDirectory' },
    'pending-approvals': { text: 'Pending Approvals', fn: renderPendingApprovalsPanel, requiredPermission: 'canViewPendingApprovals' },
    'pay-advice': { text: 'Pay Advice', fn: renderPayAdvicePanel, requiredPermission: 'canViewPayAdvice' },
    'reports': { text: 'Tutor Reports', fn: renderTutorReportsPanel, requiredPermission: 'canViewTutorReports' },
    'summer-break': { text: 'Summer Break', fn: renderSummerBreakPanel, requiredPermission: 'canViewSummerBreak' },
    'parent-feedback': { text: 'Parent Feedback', fn: renderParentFeedbackPanel, requiredPermission: 'canViewParentFeedback' },
};

let userPermissions = null;
let activeNavId = null;

function renderNavigation(container) {
    container.innerHTML = Object.entries(allNavItems)
        .filter(([, item]) => userPermissions?.views?.[item.requiredPermission] === true)
        .map(([id, item]) => `
            <li class="nav-item">
                <a href="#" id="${id}-nav" data-nav-id="${id}" 
                   class="nav-link block px-4 py-2 rounded-md transition duration-150 ease-in-out hover:bg-gray-200">
                   ${item.text}
                </a>
            </li>
        `).join('');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const navId = e.target.dataset.navId;
            setActiveNav(navId);
        });
    });
}

function setActiveNav(navId) {
    const mainContent = document.getElementById('main-content');
    if (activeNavId) {
        document.getElementById(`${activeNavId}-nav`)?.classList.remove('bg-gray-300');
    }

    activeNavId = navId;
    document.getElementById(`${activeNavId}-nav`)?.classList.add('bg-gray-300');

    const item = allNavItems[navId];
    if (item && item.fn) {
        item.fn(mainContent);
    }
}


onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const navContainer = document.getElementById('nav-container');
    const logoutBtn = document.getElementById('logout-btn');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        
        // Listen for real-time updates to staff document for permissions
        onSnapshot(staffDocRef, async (docSnap) => {
            window.userData = docSnap.data(); // Make data globally available for permission checks
            
            if (docSnap.exists() && docSnap.data()?.isApproved === true) {
                const data = docSnap.data();
                userPermissions = data.permissions;

                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Welcome, ${data.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${data.role}`;
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                
                renderNavigation(navContainer);

                // Initial view load
                if (!activeNavId) {
                    // Default to the first permissioned view
                    const firstPermittedId = Object.entries(allNavItems).find(([, item]) => userPermissions?.views?.[item.requiredPermission] === true)?.[0];
                    if (firstPermittedId) {
                        setActiveNav(firstPermittedId);
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                    }
                } else {
                    // Re-render the active view to refresh data/permissions
                    const currentItem = allNavItems[activeNavId];
                    if(currentItem) currentItem.fn(mainContent);
                }
            } else if (docSnap.exists() && docSnap.data()?.isApproved === false) {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
            } else {
                 if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
                 if (logoutBtn) logoutBtn.classList.add('hidden');
            }
        });

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    } else {
        window.location.href = "management-auth.html";
    }
});

// [End Updated management.js File]
