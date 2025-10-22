// [Begin Complete management.js File]

import { auth, db } from './firebaseConfig.js';
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
    pendingReferrals: null,
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

// ##################################
// # REFERRAL APPROVAL FUNCTIONS
// ##################################

/**
 * Fetches pending referrals from Firestore
 */
async function fetchPendingReferrals() {
    try {
        const snapshot = await getDocs(query(
            collection(db, "pending_referrals"), 
            orderBy("createdAt", "desc")
        ));
        const referrals = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        saveToLocalStorage('pendingReferrals', referrals);
        return referrals;
    } catch (error) {
        console.error("Error fetching pending referrals:", error);
        return [];
    }
}

/**
 * Renders the pending referrals section
 */
function renderPendingReferralsSection(referrals) {
    if (referrals.length === 0) {
        return `
            <div class="mt-8">
                <h3 class="text-xl font-bold text-blue-700 mb-4">Pending Referrals</h3>
                <div class="bg-blue-50 p-6 rounded-lg text-center">
                    <p class="text-blue-600">No pending referrals to approve.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="mt-8">
            <h3 class="text-xl font-bold text-blue-700 mb-4">Pending Referrals (${referrals.length})</h3>
            <div class="space-y-4">
                ${referrals.map(referral => {
                    const date = referral.createdAt?.toDate 
                        ? referral.createdAt.toDate().toLocaleDateString() 
                        : 'Unknown date';
                    
                    return `
                        <div class="border border-blue-200 p-4 rounded-lg bg-blue-50 flex justify-between items-center">
                            <div>
                                <p class="font-semibold text-blue-800">${referral.referredStudentName || 'Unknown Student'}</p>
                                <p class="text-sm text-blue-600">Referred by: ${referral.referrerName || 'Unknown Parent'}</p>
                                <p class="text-sm text-gray-600">Email: ${referral.referrerEmail || 'N/A'}</p>
                                <p class="text-xs text-gray-500">Submitted: ${date}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button class="approve-referral-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full hover:bg-green-700" 
                                        data-referral-id="${referral.id}" 
                                        data-referrer-email="${referral.referrerEmail}">
                                    Approve
                                </button>
                                <button class="reject-referral-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full hover:bg-red-700" 
                                        data-referral-id="${referral.id}">
                                    Reject
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Handles approving a referral
 */
async function handleApproveReferral(referralId, referrerEmail) {
    if (confirm("Are you sure you want to approve this referral? This will increment the parent's referral count.")) {
        try {
            const batch = writeBatch(db);
            
            // Increment the referral count for the parent
            if (referrerEmail) {
                const parentRef = doc(db, "parents", referrerEmail);
                batch.update(parentRef, {
                    referralCount: increment(1)
                });
            }
            
            // Delete the pending referral
            const referralRef = doc(db, "pending_referrals", referralId);
            batch.delete(referralRef);
            
            await batch.commit();
            alert("Referral approved successfully! Parent's referral count has been updated.");
            
            // Invalidate cache and refresh
            invalidateCache('pendingReferrals');
            fetchAndRenderPendingApprovals();
            
        } catch (error) {
            console.error("Error approving referral:", error);
            alert("Failed to approve referral. Check the console for details.");
        }
    }
}

/**
 * Handles rejecting a referral
 */
async function handleRejectReferral(referralId) {
    if (confirm("Are you sure you want to reject this referral? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "pending_referrals", referralId));
            alert("Referral rejected successfully!");
            
            // Invalidate cache and refresh
            invalidateCache('pendingReferrals');
            fetchAndRenderPendingApprovals();
            
        } catch (error) {
            console.error("Error rejecting referral:", error);
            alert("Failed to reject referral. Check the console for details.");
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
            const filename = `pay_advice_${start}_to_${end}.csv`;
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        };
    }
}

async function loadPayAdviceData(startDate, endDate) {
    try {
        const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name"));
        const studentsSnapshot = await getDocs(query(
            collection(db, "students"),
            where("createdAt", ">=", Timestamp.fromDate(startDate)),
            where("createdAt", "<=", Timestamp.fromDate(endDate))
        ));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const studentsByTutor = {};
        students.forEach(student => {
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });
        const payData = tutorsSnapshot.docs.map(doc => {
            const tutor = doc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = totalStudentFees * 0.15;
            const totalPay = totalStudentFees - managementFee;
            return {
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: assignedStudents.length,
                totalStudentFees,
                managementFee,
                totalPay,
                beneficiaryBank: tutor.beneficiaryBank || 'N/A',
                beneficiaryAccount: tutor.beneficiaryAccount || 'N/A',
                beneficiaryName: tutor.beneficiaryName || 'N/A'
            };
        });
        currentPayData = payData;
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = students.length;
        renderPayAdviceTable(payData);
    } catch (error) {
        console.error("Error loading pay advice data:", error);
        document.getElementById('pay-advice-table-body').innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

function renderPayAdviceTable(payData) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (payData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No data for the selected date range.</td></tr>`;
        return;
    }
    tableBody.innerHTML = payData.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap font-medium">${item.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="number" class="gift-input w-24 p-1 border rounded" data-tutor-email="${item.tutorEmail}" value="${giftAmount}" min="0">
                </td>
                <td class="px-6 py-4 whitespace-nowrap font-bold">₦${finalPay.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="view-details-btn bg-blue-600 text-white px-3 py-1 rounded-full text-xs" data-tutor-email="${item.tutorEmail}">Details</button>
                </td>
            </tr>
        `;
    }).join('');
    document.querySelectorAll('.gift-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const giftAmount = Number(e.target.value) || 0;
            payAdviceGifts[tutorEmail] = giftAmount;
            renderPayAdviceTable(currentPayData); // Re-render to update final pay
        });
    });
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tutorEmail = button.dataset.tutorEmail;
            const tutorData = currentPayData.find(d => d.tutorEmail === tutorEmail);
            if (tutorData) {
                const giftAmount = payAdviceGifts[tutorEmail] || 0;
                const finalPay = tutorData.totalPay + giftAmount;
                const details = `
                    <strong>${tutorData.tutorName}</strong><br>
                    Students: ${tutorData.studentCount}<br>
                    Total Student Fees: ₦${tutorData.totalStudentFees.toFixed(2)}<br>
                    Management Fee (15%): ₦${tutorData.managementFee.toFixed(2)}<br>
                    Total Pay: ₦${tutorData.totalPay.toFixed(2)}<br>
                    Gift: ₦${giftAmount.toFixed(2)}<br>
                    <strong>Final Pay: ₦${finalPay.toFixed(2)}</strong><br>
                    Beneficiary Bank: ${tutorData.beneficiaryBank}<br>
                    Beneficiary Account: ${tutorData.beneficiaryAccount}<br>
                    Beneficiary Name: ${tutorData.beneficiaryName}
                `;
                alert(details);
            }
        });
    });
}

// --- Reports Panel ---
async function renderReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Reports</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label for="start-date-report" class="block text-sm font-medium">Start Date</label><input type="date" id="start-date-report" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div><label for="end-date-report" class="block text-sm font-medium">End Date</label><input type="date" id="end-date-report" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div class="flex items-end">
                        <button id="generate-report-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full">Generate Report</button>
                    </div>
                    <div class="flex items-end">
                        <button id="export-report-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">Export CSV</button>
                    </div>
                </div>
            </div>
            <div id="reports-table-container" class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                        </tr>
                    </thead>
                    <tbody id="reports-table-body" class="divide-y"><tr><td colspan="5" class="text-center py-4">Select a date range and generate report.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('generate-report-btn').addEventListener('click', generateReport);
    document.getElementById('export-report-btn').addEventListener('click', exportReportToCSV);
}

async function generateReport() {
    const startDateInput = document.getElementById('start-date-report').value;
    const endDateInput = document.getElementById('end-date-report').value;
    if (!startDateInput || !endDateInput) {
        alert("Please select both start and end dates.");
        return;
    }
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);
    try {
        const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
        const studentsSnapshot = await getDocs(query(
            collection(db, "students"),
            where("createdAt", ">=", Timestamp.fromDate(startDate)),
            where("createdAt", "<=", Timestamp.fromDate(endDate))
        ));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const studentsByTutor = {};
        students.forEach(student => {
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });
        const reportData = tutorsSnapshot.docs.map(doc => {
            const tutor = doc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = totalStudentFees * 0.15;
            const totalPay = totalStudentFees - managementFee;
            return {
                tutorName: tutor.name,
                studentCount: assignedStudents.length,
                totalStudentFees,
                managementFee,
                totalPay
            };
        });
        saveToLocalStorage('reports', reportData);
        renderReportsTable(reportData);
    } catch (error) {
        console.error("Error generating report:", error);
        document.getElementById('reports-table-body').innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to generate report.</td></tr>`;
    }
}

function renderReportsTable(reportData) {
    const tableBody = document.getElementById('reports-table-body');
    if (reportData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No data for the selected date range.</td></tr>`;
        return;
    }
    tableBody.innerHTML = reportData.map(item => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap font-medium">${item.tutorName}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
            <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">₦${item.totalPay.toFixed(2)}</td>
        </tr>
    `).join('');
}

function exportReportToCSV() {
    const reportData = sessionCache.reports;
    if (!reportData || reportData.length === 0) {
        alert("No report data to export. Generate a report first.");
        return;
    }
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)'];
    const rows = reportData.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.totalPay
    ]);
    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const start = document.getElementById('start-date-report').value;
    const end = document.getElementById('end-date-report').value;
    const filename = `report_${start}_to_${end}.csv`;
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// --- Summer Break Panel ---
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Summer Break Management</h2>
            <div class="bg-yellow-50 p-4 rounded-lg mb-6">
                <p class="text-yellow-700">Students on summer break will be temporarily hidden from the active directory and will not appear in pay advice calculations until they resume.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-lg font-semibold mb-3">Active Students</h3>
                    <div id="active-students-list" class="space-y-2 max-h-96 overflow-y-auto">
                        <p class="text-center text-gray-500 py-4">Loading active students...</p>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-3">Students on Break</h3>
                    <div id="break-students-list" class="space-y-2 max-h-96 overflow-y-auto">
                        <p class="text-center text-gray-500 py-4">Loading students on break...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    fetchAndRenderSummerBreakLists();
}

async function fetchAndRenderSummerBreakLists() {
    try {
        const [activeStudentsSnapshot, breakStudentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "students"), where("summerBreak", "==", false))),
            getDocs(query(collection(db, "students"), where("summerBreak", "==", true)))
        ]);
        const activeStudents = activeStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const breakStudents = breakStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('students', [...activeStudents, ...breakStudents]);
        saveToLocalStorage('breakStudents', breakStudents);
        renderSummerBreakLists(activeStudents, breakStudents);
    } catch (error) {
        console.error("Error fetching summer break data:", error);
        document.getElementById('active-students-list').innerHTML = `<p class="text-center text-red-500 py-4">Failed to load data.</p>`;
        document.getElementById('break-students-list').innerHTML = `<p class="text-center text-red-500 py-4">Failed to load data.</p>`;
    }
}

function renderSummerBreakLists(activeStudents, breakStudents) {
    const activeList = document.getElementById('active-students-list');
    const breakList = document.getElementById('break-students-list');
    activeList.innerHTML = activeStudents.length > 0 ? activeStudents.map(student => `
        <div class="border border-green-200 p-3 rounded-lg bg-green-50 flex justify-between items-center">
            <div>
                <p class="font-semibold text-green-800">${student.studentName}</p>
                <p class="text-sm text-green-600">${student.tutorName} • ${student.grade}</p>
            </div>
            <button class="move-to-break-btn bg-yellow-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Move to Break</button>
        </div>
    `).join('') : `<p class="text-center text-gray-500 py-4">No active students.</p>`;
    breakList.innerHTML = breakStudents.length > 0 ? breakStudents.map(student => `
        <div class="border border-yellow-200 p-3 rounded-lg bg-yellow-50 flex justify-between items-center">
            <div>
                <p class="font-semibold text-yellow-800">${student.studentName}</p>
                <p class="text-sm text-yellow-600">${student.tutorName} • ${student.grade}</p>
            </div>
            <button class="move-to-active-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Move to Active</button>
        </div>
    `).join('') : `<p class="text-center text-gray-500 py-4">No students on break.</p>`;
    document.querySelectorAll('.move-to-break-btn').forEach(button => button.addEventListener('click', () => handleMoveToBreak(button.dataset.studentId)));
    document.querySelectorAll('.move-to-active-btn').forEach(button => button.addEventListener('click', () => handleMoveToActive(button.dataset.studentId)));
}

async function handleMoveToBreak(studentId) {
    try {
        await updateDoc(doc(db, "students", studentId), { summerBreak: true });
        alert("Student moved to summer break successfully!");
        invalidateCache('students');
        invalidateCache('breakStudents');
        fetchAndRenderSummerBreakLists();
    } catch (error) {
        console.error("Error moving student to break:", error);
        alert("Failed to move student to break. Check the console for details.");
    }
}

async function handleMoveToActive(studentId) {
    try {
        await updateDoc(doc(db, "students", studentId), { summerBreak: false });
        alert("Student moved back to active successfully!");
        invalidateCache('students');
        invalidateCache('breakStudents');
        fetchAndRenderSummerBreakLists();
    } catch (error) {
        console.error("Error moving student to active:", error);
        alert("Failed to move student to active. Check the console for details.");
    }
}

// --- Parent Feedback Panel ---
async function renderParentFeedbackPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Parent Feedback</h2>
            <div class="bg-blue-50 p-4 rounded-lg mb-6">
                <p class="text-blue-700">View and manage feedback submitted by parents.</p>
            </div>
            <div id="feedback-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading feedback...</p>
            </div>
        </div>
    `;
    fetchAndRenderParentFeedback();
}

async function fetchAndRenderParentFeedback() {
    try {
        const feedbackSnapshot = await getDocs(query(collection(db, "parent_feedback"), orderBy("submittedAt", "desc")));
        const feedback = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('parentFeedback', feedback);
        renderParentFeedbackList(feedback);
    } catch (error) {
        console.error("Error fetching parent feedback:", error);
        document.getElementById('feedback-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load feedback.</p>`;
    }
}

function renderParentFeedbackList(feedback) {
    const feedbackList = document.getElementById('feedback-list');
    if (feedback.length === 0) {
        feedbackList.innerHTML = `<p class="text-center text-gray-500 py-10">No feedback submitted yet.</p>`;
        return;
    }
    feedbackList.innerHTML = feedback.map(item => {
        const date = item.submittedAt?.toDate ? item.submittedAt.toDate().toLocaleDateString() : 'Unknown date';
        return `
            <div class="border border-blue-200 p-4 rounded-lg bg-blue-50">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-semibold text-blue-800">${item.parentName || 'Anonymous Parent'}</h3>
                    <span class="text-sm text-blue-600">${date}</span>
                </div>
                <p class="text-blue-700 mb-3">${item.feedback}</p>
                <div class="text-sm text-gray-600">
                    <p>Tutor: ${item.tutorName || 'N/A'}</p>
                    <p>Email: ${item.parentEmail || 'N/A'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div class="bg-yellow-50 p-4 rounded-lg mb-6">
                <p class="text-yellow-700">Approve or reject new student applications and referrals submitted by parents.</p>
            </div>
            <div id="pending-approvals-content">
                <p class="text-center text-gray-500 py-10">Loading pending approvals...</p>
            </div>
        </div>
    `;
    fetchAndRenderPendingApprovals();
}

// ### UPDATED FUNCTION ###
async function fetchAndRenderPendingApprovals() {
    try {
        // Fetch both pending students and pending referrals
        const [pendingStudents, pendingReferrals] = await Promise.all([
            fetchPendingStudents(),
            fetchPendingReferrals()
        ]);
        
        const contentDiv = document.getElementById('pending-approvals-content');
        
        let html = '';
        
        // Render pending students section
        if (pendingStudents.length > 0) {
            html += `
                <div>
                    <h3 class="text-xl font-bold text-yellow-700 mb-4">Pending Students (${pendingStudents.length})</h3>
                    <div class="space-y-4">
                        ${pendingStudents.map(student => {
                            const date = student.createdAt?.toDate 
                                ? student.createdAt.toDate().toLocaleDateString() 
                                : 'Unknown date';
                            const subjects = student.subjects && Array.isArray(student.subjects) 
                                ? student.subjects.join(', ') 
                                : 'N/A';
                            
                            return `
                                <div class="border border-yellow-200 p-4 rounded-lg bg-yellow-50 flex justify-between items-center">
                                    <div class="flex-1">
                                        <div class="flex justify-between items-start mb-2">
                                            <p class="font-semibold text-yellow-800">${student.studentName}</p>
                                            <span class="text-sm text-yellow-600">${date}</span>
                                        </div>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                            <p><span class="font-medium">Grade:</span> ${student.grade}</p>
                                            <p><span class="font-medium">Days/Week:</span> ${student.days}</p>
                                            <p><span class="font-medium">Subjects:</span> ${subjects}</p>
                                            <p><span class="font-medium">Fee:</span> ₦${(student.studentFee || 0).toFixed(2)}</p>
                                            <p><span class="font-medium">Parent:</span> ${student.parentName || 'N/A'}</p>
                                            <p><span class="font-medium">Phone:</span> ${student.parentPhone || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div class="flex flex-col space-y-2 ml-4">
                                        <button class="edit-pending-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Edit</button>
                                        <button class="approve-student-btn bg-green-600 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Approve</button>
                                        <button class="reject-student-btn bg-red-600 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Reject</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div>
                    <h3 class="text-xl font-bold text-yellow-700 mb-4">Pending Students</h3>
                    <div class="bg-yellow-50 p-6 rounded-lg text-center">
                        <p class="text-yellow-600">No pending students to approve.</p>
                    </div>
                </div>
            `;
        }
        
        // Render pending referrals section
        html += renderPendingReferralsSection(pendingReferrals);
        
        contentDiv.innerHTML = html;
        
        // Attach event listeners for student actions
        if (pendingStudents.length > 0) {
            document.querySelectorAll('.edit-pending-student-btn').forEach(button => 
                button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId))
            );
            document.querySelectorAll('.approve-student-btn').forEach(button => 
                button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId))
            );
            document.querySelectorAll('.reject-student-btn').forEach(button => 
                button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId))
            );
        }
        
        // Attach event listeners for referral actions
        if (pendingReferrals.length > 0) {
            document.querySelectorAll('.approve-referral-btn').forEach(button => 
                button.addEventListener('click', () => 
                    handleApproveReferral(button.dataset.referralId, button.dataset.referrerEmail)
                )
            );
            document.querySelectorAll('.reject-referral-btn').forEach(button => 
                button.addEventListener('click', () => 
                    handleRejectReferral(button.dataset.referralId)
                )
            );
        }
        
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        document.getElementById('pending-approvals-content').innerHTML = 
            `<p class="text-center text-red-500 py-10">Failed to load pending approvals.</p>`;
    }
}

async function fetchPendingStudents() {
    try {
        const snapshot = await getDocs(query(collection(db, "pending_students"), orderBy("createdAt", "desc")));
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('pendingStudents', students);
        return students;
    } catch (error) {
        console.error("Error fetching pending students:", error);
        return [];
    }
}

// ##################################
// # MAIN APP INITIALIZATION
// ##################################

function initializeManagementApp() {
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll('.nav-link');
    const logoutBtn = document.getElementById('logout-btn');

    // Set initial view
    renderManagementTutorView(mainContent);

    // Navigation event listeners
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPanel = link.dataset.panel;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            switch (targetPanel) {
                case 'directory':
                    renderManagementTutorView(mainContent);
                    break;
                case 'pay-advice':
                    renderPayAdvicePanel(mainContent);
                    break;
                case 'reports':
                    renderReportsPanel(mainContent);
                    break;
                case 'summer-break':
                    renderSummerBreakPanel(mainContent);
                    break;
                case 'parent-feedback':
                    renderParentFeedbackPanel(mainContent);
                    break;
                case 'pending-approvals':
                    renderPendingApprovalsPanel(mainContent);
                    break;
            }
        });
    });

    // Logout event listener
    logoutBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to log out?")) {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Error signing out:", error);
                alert("Error signing out. Check the console for details.");
            }
        }
    });
}

// Wait for DOM and auth state
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Check if user has admin role
            getDoc(doc(db, "admins", user.email)).then((docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    window.userData = userData; // Store for permission checks
                    document.getElementById('admin-name').textContent = userData.name || 'Admin';
                    initializeManagementApp();
                } else {
                    alert("You are not authorized to access the management dashboard.");
                    signOut(auth).then(() => {
                        window.location.href = 'login.html';
                    });
                }
            }).catch((error) => {
                console.error("Error checking admin status:", error);
                alert("Error verifying admin access.");
                signOut(auth).then(() => {
                    window.location.href = 'login.html';
                });
            });
        } else {
            window.location.href = 'login.html';
        }
    });
});

// [End Updated management.js File]
