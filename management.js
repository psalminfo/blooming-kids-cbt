import { auth, db } from './firebaseConfig.js';
// 1. UPDATED IMPORT: Added 'increment' for atomic field updates
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
    pendingReferrals: null, // <-- NEW: Added for referral system
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
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="assign-parentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="assign-parentPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="assign-studentFee" value="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
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
        const tutorData = JSON.parse(form.elements['assign-tutor'].value);

        const studentData = {
            studentName: form.elements['assign-studentName'].value,
            grade: form.elements['assign-grade'].value,
            days: form.elements['assign-days'].value,
            subjects: form.elements['assign-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['assign-parentName'].value,
            parentPhone: form.elements['assign-parentPhone'].value,
            studentFee: Number(form.elements['assign-studentFee'].value) || 0,
            tutorEmail: tutorData.email,
            tutorName: tutorData.name,
            status: 'active',
            createdAt: Timestamp.now(),
        };

        try {
            await addDoc(collection(db, "students"), studentData);
            alert(`Student ${studentData.studentName} successfully assigned to ${tutorData.name}!`);
            document.getElementById('assign-modal').remove();
            invalidateCache('students');
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });
}

async function handleSetTutorActiveStatus(tutorEmail, isActive) {
    if (!confirm(`Are you sure you want to set ${tutorEmail} to ${isActive ? 'Active' : 'Inactive'}?`)) return;

    try {
        await updateDoc(doc(db, "tutors", tutorEmail), {
            active: isActive,
            updatedAt: Timestamp.now()
        });
        alert(`Tutor ${tutorEmail} status updated to ${isActive ? 'Active' : 'Inactive'}.`);
        invalidateCache('tutors');
        renderManagementTutorView(document.getElementById('main-content'));
    } catch (error) {
        console.error("Error setting tutor status: ", error);
        alert("Failed to update tutor status. Check the console for details.");
    }
}

async function handleSetStudentStatus(studentId, newStatus) {
    if (!confirm(`Are you sure you want to set this student's status to ${newStatus}?`)) return;

    try {
        await updateDoc(doc(db, "students", studentId), {
            status: newStatus,
            updatedAt: Timestamp.now()
        });
        alert(`Student status updated to ${newStatus}.`);
        invalidateCache('students');
        renderManagementTutorView(document.getElementById('main-content'));
    } catch (error) {
        console.error("Error setting student status: ", error);
        alert("Failed to update student status. Check the console for details.");
    }
}

async function handleMoveStudentToBreak(studentId, studentName) {
    if (!confirm(`Are you sure you want to move student ${studentName} to Summer Break?`)) return;

    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }

        const studentData = studentDoc.data();
        const breakData = {
            ...studentData,
            originalStudentId: studentId,
            breakStart: Timestamp.now(),
        };

        const batch = writeBatch(db);
        // 1. Add to break_students
        const newBreakRef = doc(collection(db, "break_students"));
        batch.set(newBreakRef, breakData);

        // 2. Delete from students
        batch.delete(doc(db, "students", studentId));

        await batch.commit();

        alert(`Student ${studentName} successfully moved to Summer Break.`);
        invalidateCache('students');
        invalidateCache('breakStudents');
        renderManagementTutorView(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error moving student to break: ", error);
        alert("Failed to move student. Check the console for details.");
    }
}

async function handleMoveStudentOffBreak(breakStudentId, studentName) {
    if (!confirm(`Are you sure you want to move student ${studentName} OFF Summer Break and back to active students?`)) return;

    try {
        const breakDoc = await getDoc(doc(db, "break_students", breakStudentId));
        if (!breakDoc.exists()) {
            alert("Break student record not found!");
            return;
        }

        const breakData = breakDoc.data();
        const studentData = {
            studentName: breakData.studentName,
            grade: breakData.grade,
            days: breakData.days,
            subjects: breakData.subjects,
            parentName: breakData.parentName,
            parentPhone: breakData.parentPhone,
            studentFee: breakData.studentFee,
            tutorEmail: breakData.tutorEmail,
            tutorName: breakData.tutorName,
            status: 'active', // Set back to active
            createdAt: breakData.createdAt, // Preserve original creation date
            updatedAt: Timestamp.now(),
        };

        const batch = writeBatch(db);
        // 1. Add back to students (using a new ID if originalStudentId isn't reliable for existing doc)
        // For simplicity and safety, we'll create a new document in 'students'.
        const newStudentRef = doc(collection(db, "students"));
        batch.set(newStudentRef, studentData);

        // 2. Delete from break_students
        batch.delete(doc(db, "break_students", breakStudentId));

        await batch.commit();

        alert(`Student ${studentName} successfully moved back to Active Students.`);
        invalidateCache('breakStudents');
        invalidateCache('students');
        renderSummerBreakPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error moving student off break: ", error);
        alert("Failed to move student. Check the console for details.");
    }
}

// ##################################
// # DATA FETCHING & PROCESSING
// ##################################

/**
 * Fetches all tutors and their bank details.
 * @returns {Array} List of tutor objects.
 */
async function fetchTutors() {
    if (sessionCache.tutors) {
        return sessionCache.tutors;
    }

    try {
        const q = query(collection(db, "tutors"), where("approved", "==", true), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const tutors = querySnapshot.docs.map(doc => ({
            email: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('tutors', tutors);
        return tutors;
    } catch (error) {
        console.error("Error fetching tutors:", error);
        return [];
    }
}

/**
 * Fetches all active students.
 * @returns {Array} List of student objects.
 */
async function fetchStudents() {
    if (sessionCache.students) {
        return sessionCache.students;
    }

    try {
        const q = query(collection(db, "students"), orderBy("tutorName", "asc"), orderBy("studentName", "asc"));
        const querySnapshot = await getDocs(q);
        const students = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        saveToLocalStorage('students', students);
        return students;
    } catch (error) {
        console.error("Error fetching students:", error);
        return [];
    }
}

/**
 * Fetches all students currently marked for summer break.
 * @returns {Array} List of break student objects.
 */
async function fetchBreakStudents() {
    if (sessionCache.breakStudents) {
        return sessionCache.breakStudents;
    }
    try {
        const q = query(collection(db, "break_students"), orderBy("tutorName", "asc"), orderBy("studentName", "asc"));
        const querySnapshot = await getDocs(q);
        const breakStudents = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            breakStart: doc.data().breakStart ? doc.data().breakStart.toDate().toLocaleDateString() : 'N/A'
        }));
        saveToLocalStorage('breakStudents', breakStudents);
        return breakStudents;
    } catch (error) {
        console.error("Error fetching break students:", error);
        return [];
    }
}

/**
 * Fetches pending students for approval.
 * @returns {Array} List of pending student objects.
 */
async function fetchPendingStudents() {
    if (sessionCache.pendingStudents) {
        return sessionCache.pendingStudents;
    }

    try {
        const q = query(collection(db, "pending_students"), orderBy("createdAt", "asc"));
        const querySnapshot = await getDocs(q);
        const students = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toLocaleDateString() : 'N/A'
        }));
        saveToLocalStorage('pendingStudents', students);
        return students;
    } catch (error) {
        console.error("Error fetching pending students:", error);
        return [];
    }
}

/**
 * Approves a pending student: moves record from pending_students to students.
 * @param {string} studentId The ID of the pending student document.
 * @param {string} tutorEmail The email of the assigned tutor.
 */
async function handleApproveStudent(studentId, tutorEmail) {
    if (!confirm("Are you sure you want to APPROVE this student?")) return;

    try {
        const pendingDoc = await getDoc(doc(db, "pending_students", studentId));
        if (!pendingDoc.exists()) {
            alert("Pending student record not found!");
            return;
        }

        const studentData = pendingDoc.data();
        const tutor = sessionCache.tutors.find(t => t.email === tutorEmail);

        if (!tutor) {
            alert("Tutor not found in directory. Cannot approve student.");
            return;
        }

        const newStudentData = {
            ...studentData,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            status: 'active',
            createdAt: Timestamp.now(), // Override with fresh timestamp for active record
        };

        const batch = writeBatch(db);

        // 1. Add to students collection
        const newStudentRef = doc(collection(db, "students"));
        batch.set(newStudentRef, newStudentData);

        // 2. Delete from pending_students collection
        batch.delete(doc(db, "pending_students", studentId));

        await batch.commit();

        alert(`Student ${newStudentData.studentName} approved and assigned to ${tutor.name}.`);
        invalidateCache('pendingStudents');
        invalidateCache('students'); // Also invalidate active students cache
        renderPendingApprovalsPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error approving student: ", error);
        alert("Failed to approve student. Check the console for details.");
    }
}

/**
 * Rejects a pending student: deletes the record.
 * @param {string} studentId The ID of the pending student document.
 */
async function handleRejectStudent(studentId) {
    if (!confirm("Are you sure you want to REJECT this student? The record will be permanently deleted.")) return;

    try {
        await deleteDoc(doc(db, "pending_students", studentId));
        alert(`Student record ${studentId} rejected and removed.`);

        invalidateCache('pendingStudents');
        renderPendingApprovalsPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error rejecting student: ", error);
        alert("Failed to reject student. Check the console for details.");
    }
}

// ##################################
// # NEW REFERRAL SYSTEM LOGIC
// ##################################

/**
 * Fetches pending referrals from Firestore.
 * @returns {Array} List of pending referral objects.
 */
async function fetchPendingReferrals() {
    if (sessionCache.pendingReferrals) {
        return sessionCache.pendingReferrals;
    }

    try {
        const q = query(collection(db, "pending_referrals"), orderBy("createdAt", "asc"));
        const querySnapshot = await getDocs(q);
        const referrals = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toLocaleDateString() : 'N/A'
        }));
        saveToLocalStorage('pendingReferrals', referrals);
        return referrals;
    } catch (error) {
        console.error("Error fetching pending referrals:", error);
        return [];
    }
}

/**
 * Approves a referral: increments parent's referralCount and deletes the referral record.
 * @param {string} referralId The ID of the referral document.
 * @param {string} refererEmail The email of the parent who made the referral (the parent's doc ID).
 */
async function handleApproveReferral(referralId, refererEmail) {
    if (!confirm("Are you sure you want to APPROVE this referral? The referrer will be rewarded.")) return;

    try {
        const batch = writeBatch(db);

        // 1. Reward: Atomically increment referralCount on the parent's document
        // Assumes parent's document ID in the 'parents' collection is their email
        const parentDocRef = doc(db, "parents", refererEmail);
        batch.update(parentDocRef, {
            referralCount: increment(1)
        });

        // 2. Cleanup: Delete the referral from the pending_referrals collection
        const referralDocRef = doc(db, "pending_referrals", referralId);
        batch.delete(referralDocRef);

        await batch.commit();

        alert(`Referral ${referralId} approved. Parent (${refererEmail}) reward applied!`);
        invalidateCache('pendingReferrals');
        // Re-render the pending approvals panel
        renderPendingApprovalsPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error approving referral: ", error);
        alert(`Failed to approve referral. Check the console for details. Error: ${error.message}`);
    }
}

/**
 * Rejects a referral: deletes the referral record without rewarding the parent.
 * @param {string} referralId The ID of the referral document.
 */
async function handleRejectReferral(referralId) {
    if (!confirm("Are you sure you want to REJECT this referral?")) return;

    try {
        await deleteDoc(doc(db, "pending_referrals", referralId));
        alert(`Referral ${referralId} rejected and removed.`);

        invalidateCache('pendingReferrals');
        // Re-render the pending approvals panel
        renderPendingApprovalsPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error rejecting referral: ", error);
        alert(`Failed to reject referral. Check the console for details. Error: ${error.message}`);
    }
}

/**
 * Renders the section for pending referral approvals.
 * @param {Array} referrals List of pending referral objects.
 * @returns {string} HTML string for the referrals section.
 */
function renderPendingReferralsSection(referrals) {
    let referralsHtml = `<h3 class="text-2xl font-semibold text-blue-700 mb-4">Pending Referral Approvals (${referrals.length})</h3>`;

    if (referrals.length === 0) {
        referralsHtml += `<p class="text-gray-500">No pending referrals at this time.</p>`;
        return referralsHtml;
    }

    referralsHtml += `<div class="space-y-4">`;

    referrals.forEach(ref => {
        referralsHtml += `
            <div class="bg-blue-100 p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
                <div class="mb-2 md:mb-0">
                    <p class="font-bold text-blue-800">Referrer (Parent): <span class="text-blue-900">${ref.refererName || 'N/A'}</span></p>
                    <p class="text-sm text-blue-600">Email: ${ref.refererEmail}</p>
                    <p class="text-sm text-blue-600">Referred Student: ${ref.referredStudentName}</p>
                    <p class="text-xs text-blue-500 mt-1">Date: ${ref.createdAt}</p>
                </div>
                <div class="flex space-x-2">
                    <button data-id="${ref.id}" data-email="${ref.refererEmail}" class="approve-referral-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-150 text-sm">Approve</button>
                    <button data-id="${ref.id}" class="reject-referral-btn px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150 text-sm">Reject</button>
                </div>
            </div>
        `;
    });

    referralsHtml += `</div><hr class="my-6 border-blue-300">`;
    return referralsHtml;
}


// ##################################
// # REPORT FETCHING & PROCESSING
// ##################################

/**
 * Fetches all reports and groups them by tutor.
 * @returns {Object} Reports grouped by tutor email.
 */
async function fetchReports() {
    if (sessionCache.reports) {
        return sessionCache.reports;
    }

    try {
        const q = query(collection(db, "reports"), orderBy("tutorEmail", "asc"), orderBy("submissionDate", "desc"));
        const querySnapshot = await getDocs(q);

        const reportsByTutor = {};
        querySnapshot.docs.forEach(doc => {
            const report = {
                id: doc.id,
                ...doc.data(),
                submissionDate: doc.data().submissionDate ? doc.data().submissionDate.toDate().toLocaleDateString() : 'N/A'
            };
            const tutorEmail = report.tutorEmail;
            if (!reportsByTutor[tutorEmail]) {
                reportsByTutor[tutorEmail] = {
                    tutorName: report.tutorName || 'Unknown Tutor',
                    reports: []
                };
            }
            reportsByTutor[tutorEmail].reports.push(report);
        });

        saveToLocalStorage('reports', reportsByTutor);
        return reportsByTutor;
    } catch (error) {
        console.error("Error fetching reports:", error);
        return {};
    }
}

/**
 * Fetches all parent feedback.
 * @returns {Array} List of feedback objects.
 */
async function fetchParentFeedback() {
    if (sessionCache.parentFeedback) {
        return sessionCache.parentFeedback;
    }
    try {
        const q = query(collection(db, "parent_feedback"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const feedback = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toLocaleString() : 'N/A',
            isRead: doc.data().isRead || false, // Ensure isRead exists
        }));

        saveToLocalStorage('parentFeedback', feedback);
        return feedback;
    } catch (error) {
        console.error("Error fetching parent feedback:", error);
        return [];
    }
}

async function handleMarkFeedbackAsRead(feedbackId) {
    try {
        await updateDoc(doc(db, "parent_feedback", feedbackId), {
            isRead: true,
        });
        invalidateCache('parentFeedback');
        renderParentFeedbackPanel(document.getElementById('main-content'));
    } catch (error) {
        console.error("Error marking feedback as read: ", error);
        alert("Failed to mark feedback as read. Check the console for details.");
    }
}

// ##################################
// # RENDERING FUNCTIONS
// ##################################

/**
 * Renders the section for pending student approvals.
 * @param {Array} students List of pending student objects.
 * @returns {string} HTML string for the students section.
 */
function renderPendingStudentsSection(students) {
    const tutors = sessionCache.tutors || [];
    const tutorOptions = tutors
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => `<option value="${tutor.email}">${tutor.name} (${tutor.email})</option>`)
        .join('');

    let studentsHtml = `<h3 class="text-2xl font-semibold text-orange-700 mb-4">Pending Student Approvals (${students.length})</h3>`;

    if (students.length === 0) {
        studentsHtml += `<p class="text-gray-500">No pending students at this time.</p>`;
        return studentsHtml;
    }

    studentsHtml += `<div class="space-y-4 mb-8">`;

    students.forEach(student => {
        studentsHtml += `
            <div class="bg-orange-100 p-4 rounded-lg shadow-sm">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div class="mb-2 md:mb-0">
                        <p class="font-bold text-orange-800">${student.studentName} (Grade ${student.grade})</p>
                        <p class="text-sm text-orange-600">Parent: ${student.parentName || 'N/A'}</p>
                        <p class="text-xs text-orange-500 mt-1">Date: ${student.createdAt}</p>
                        <button data-id="${student.id}" class="edit-pending-student-btn text-xs text-blue-500 hover:text-blue-700 mt-1">Edit Details</button>
                    </div>
                    <div class="flex items-center space-x-2 mt-2 md:mt-0">
                        <select id="tutor-assign-${student.id}" class="w-48 p-2 border border-gray-300 rounded-md text-sm">
                            <option value="" disabled selected>Assign Tutor...</option>
                            ${tutorOptions}
                        </select>
                        <button data-id="${student.id}" class="approve-student-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-150 text-sm">Approve</button>
                        <button data-id="${student.id}" class="reject-student-btn px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150 text-sm">Reject</button>
                    </div>
                </div>
            </div>
        `;
    });

    studentsHtml += `</div><hr class="my-6 border-orange-300">`;
    return studentsHtml;
}

/**
 * Fetches and renders both pending students and pending referrals.
 */
async function fetchAndRenderPendingApprovals(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Pending Approvals Dashboard</h2><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Loading pending items...</p></div>`;

    await fetchTutors(); // Ensure tutors are cached for assignment dropdowns

    // 1. Fetch data
    const students = await fetchPendingStudents();
    const referrals = await fetchPendingReferrals(); // <-- NEW: Fetch referrals

    container.innerHTML = `
        <h2 class="text-3xl font-bold text-green-700 mb-6">Pending Approvals Dashboard</h2>
        <div id="pending-students-section"></div>
        <div id="pending-referrals-section"></div>
    `;

    // 2. Render sections
    document.getElementById('pending-students-section').innerHTML = renderPendingStudentsSection(students);
    document.getElementById('pending-referrals-section').innerHTML = renderPendingReferralsSection(referrals); // <-- NEW: Render referrals

    // 3. Attach Event Listeners for Students
    container.querySelectorAll('.edit-pending-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleEditPendingStudent(e.target.dataset.id));
    });

    container.querySelectorAll('.approve-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentId = e.target.dataset.id;
            const selectElement = document.getElementById(`tutor-assign-${studentId}`);
            const tutorEmail = selectElement.value;
            if (!tutorEmail) {
                alert("Please select a tutor before approving.");
                return;
            }
            handleApproveStudent(studentId, tutorEmail);
        });
    });

    container.querySelectorAll('.reject-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleRejectStudent(e.target.dataset.id));
    });

    // 4. Attach Event Listeners for Referrals <-- NEW
    container.querySelectorAll('.approve-referral-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const referralId = e.target.dataset.id;
            const refererEmail = e.target.dataset.email;
            handleApproveReferral(referralId, refererEmail);
        });
    });

    container.querySelectorAll('.reject-referral-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const referralId = e.target.dataset.id;
            handleRejectReferral(referralId);
        });
    });
}

function renderManagementTutorView(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Tutor & Student Management</h2><div class="flex justify-start space-x-4 mb-4"><button id="addStudentBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Assign New Student</button></div><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Loading directory data...</p></div>`;

    const renderData = async () => {
        const tutors = await fetchTutors();
        const students = await fetchStudents();

        let html = `
            <h2 class="text-3xl font-bold text-green-700 mb-6">Tutor & Student Management</h2>
            <div class="flex justify-start space-x-4 mb-8">
                <button id="addStudentBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition duration-150">Assign New Student</button>
            </div>
            <div class="space-y-8">
        `;

        // Group students by tutor
        const studentsByTutor = students.reduce((acc, student) => {
            const key = student.tutorEmail || 'unassigned';
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(student);
            return acc;
        }, {});

        // Combine tutors with their students
        tutors.forEach(tutor => {
            const tutorStudents = studentsByTutor[tutor.email] || [];
            const activeStudents = tutorStudents.filter(s => s.status === 'active');
            const inactiveStudents = tutorStudents.filter(s => s.status === 'inactive' || s.status === 'suspended');

            html += `
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-bold text-gray-800">${tutor.name} (${tutor.email})</h3>
                        <div class="flex space-x-2">
                            <span class="px-3 py-1 text-sm font-semibold rounded-full ${tutor.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${tutor.active ? 'Active' : 'Inactive'}
                            </span>
                            <button data-email="${tutor.email}" data-status="${!tutor.active}" class="set-tutor-status-btn px-3 py-1 text-sm bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition duration-150">
                                ${tutor.active ? 'Set Inactive' : 'Set Active'}
                            </button>
                        </div>
                    </div>

                    <p class="text-gray-600 mb-2">Total Students: ${tutorStudents.length} (Active: ${activeStudents.length})</p>

                    ${renderStudentList(activeStudents, 'Active', 'green')}
                    ${renderStudentList(inactiveStudents, 'Inactive/Suspended', 'red')}

                </div>
            `;
            delete studentsByTutor[tutor.email]; // Remove processed tutor
        });

        // Handle unassigned students
        const unassignedStudents = studentsByTutor['unassigned'] || [];
        if (unassignedStudents.length > 0) {
            html += `
                <div class="bg-red-50 p-6 rounded-xl shadow-lg border border-red-200">
                    <h3 class="text-2xl font-bold text-red-800">Unassigned Students (${unassignedStudents.length})</h3>
                    ${renderStudentList(unassignedStudents, 'Unassigned', 'red')}
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;

        // Attach event listeners
        document.getElementById('addStudentBtn').addEventListener('click', showAssignStudentModal);
        container.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleEditStudent(e.target.dataset.id));
        });
        container.querySelectorAll('.set-tutor-status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleSetTutorActiveStatus(e.target.dataset.email, e.target.dataset.status === 'true'));
        });
        container.querySelectorAll('.set-student-status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleSetStudentStatus(e.target.dataset.id, e.target.dataset.status));
        });
        container.querySelectorAll('.move-to-break-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleMoveStudentToBreak(e.target.dataset.id, e.target.dataset.name));
        });
    };

    renderData();
}

function renderStudentList(students, title, color) {
    if (students.length === 0) {
        return `<p class="text-sm text-gray-500 mt-2">${title} Students: None</p>`;
    }

    let listHtml = `
        <h4 class="text-lg font-semibold text-${color}-700 mt-4 mb-2">${title} Students (${students.length})</h4>
        <div class="space-y-3 border-l-2 border-${color}-400 pl-4">
    `;

    students.forEach(student => {
        const studentFee = student.studentFee ? `₦${student.studentFee.toLocaleString()}` : 'N/A';
        const isSuspended = student.status === 'suspended';
        const isInactive = student.status === 'inactive';
        const isUnassigned = student.tutorEmail === 'unassigned';

        let statusToggleBtn = '';
        if (isSuspended || isInactive) {
            statusToggleBtn = `<button data-id="${student.id}" data-status="active" class="set-student-status-btn px-3 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition duration-150">Set Active</button>`;
        } else if (student.status === 'active') {
            statusToggleBtn = `<button data-id="${student.id}" data-status="suspended" class="set-student-status-btn px-3 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-150">Set Suspended</button>`;
        }

        listHtml += `
            <div class="p-3 bg-${color}-50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-${color}-800 truncate">${student.studentName} (Grade ${student.grade})</p>
                    <p class="text-xs text-gray-600">Subjects: ${student.subjects.join(', ')} | Days: ${student.days}</p>
                    <p class="text-xs text-gray-600">Parent: ${student.parentName || 'N/A'} (${student.parentPhone || 'N/A'}) | Fee: ${studentFee}</p>
                </div>
                <div class="flex space-x-2 mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
                    <button data-id="${student.id}" class="edit-student-btn px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-150">Edit</button>
                    ${statusToggleBtn}
                    ${student.status === 'active' && !isUnassigned ?
                        `<button data-id="${student.id}" data-name="${student.studentName}" class="move-to-break-btn px-3 py-1 text-xs bg-purple-500 text-white rounded-full hover:bg-purple-600 transition duration-150">Break</button>`
                        : ''}
                </div>
            </div>
        `;
    });

    listHtml += `</div>`;
    return listHtml;
}

function renderPayAdvicePanel(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Tutor Pay Advice Generation</h2><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Calculating pay advice...</p></div>`;

    const calculatePay = async () => {
        const tutors = await fetchTutors();
        const students = await fetchStudents();

        const payAdvice = tutors.map(tutor => {
            const tutorStudents = students.filter(s => s.tutorEmail === tutor.email && s.status === 'active');
            const studentCount = tutorStudents.length;

            const totalStudentFees = tutorStudents.reduce((sum, s) => sum + (Number(s.studentFee) || 0), 0);
            const managementFee = totalStudentFees * 0.4; // 40% management fee
            const totalPay = totalStudentFees - managementFee;

            return {
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: studentCount,
                totalStudentFees: totalStudentFees.toFixed(2),
                managementFee: managementFee.toFixed(2),
                totalPay: totalPay.toFixed(2),
                beneficiaryBank: tutor.beneficiaryBank || 'N/A',
                beneficiaryAccount: tutor.beneficiaryAccount || 'N/A',
                beneficiaryName: tutor.beneficiaryName || 'N/A',
            };
        });

        currentPayData = payAdvice; // Store data globally for CSV export

        let html = `
            <h2 class="text-3xl font-bold text-green-700 mb-6">Tutor Pay Advice Generation</h2>
            <div class="mb-4 flex justify-between items-center">
                <p class="text-lg text-gray-600 font-semibold">Total Tutors: ${payAdvice.length}</p>
                <button id="exportPayAdviceBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md transition duration-150">Export to CSV</button>
            </div>
            <div class="overflow-x-auto bg-white p-4 rounded-xl shadow-lg">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fee (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mgt Fee (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Pay (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gift (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Pay (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Details</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${payAdvice.map(item => {
                            const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
                            const finalPay = (parseFloat(item.totalPay) + giftAmount).toFixed(2);
                            return `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.tutorName}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.studentCount}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.totalStudentFees}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.managementFee}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-semibold">${item.totalPay}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" value="${giftAmount}" data-email="${item.tutorEmail}" class="gift-input w-20 p-1 border rounded text-right text-sm">
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-700 font-bold final-pay-cell" data-email="${item.tutorEmail}">${finalPay}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                        <p>Name: ${item.beneficiaryName}</p>
                                        <p>Acc: ${item.beneficiaryAccount}</p>
                                        <p>Bank: ${item.beneficiaryBank}</p>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;

        // Attach event listeners for gifts
        container.querySelectorAll('.gift-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const email = e.target.dataset.email;
                const gift = parseFloat(e.target.value) || 0;
                payAdviceGifts[email] = gift;
                updateFinalPay(email, gift);
            });
        });

        // Attach event listener for CSV export
        document.getElementById('exportPayAdviceBtn').addEventListener('click', () => {
            const csv = convertPayAdviceToCSV(currentPayData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            saveAs(blob, `PayAdvice_${new Date().toISOString().slice(0, 10)}.csv`);
        });
    };

    function updateFinalPay(email, newGift) {
        const row = currentPayData.find(d => d.tutorEmail === email);
        if (row) {
            const finalPay = (parseFloat(row.totalPay) + newGift).toFixed(2);
            document.querySelector(`.final-pay-cell[data-email="${email}"]`).textContent = finalPay;
        }
    }

    calculatePay();
}

function renderTutorReportsPanel(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Tutor Reports</h2><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Loading reports...</p></div>`;

    const renderReports = async () => {
        const reportsByTutor = await fetchReports();
        const tutorEmails = Object.keys(reportsByTutor).sort();

        let html = `
            <h2 class="text-3xl font-bold text-green-700 mb-6">Tutor Reports</h2>
            <div class="space-y-8">
        `;

        if (tutorEmails.length === 0) {
            html += `<p class="text-gray-500">No tutor reports found.</p>`;
        } else {
            tutorEmails.forEach(email => {
                const tutorData = reportsByTutor[email];
                html += `
                    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4">${tutorData.tutorName} (${email})</h3>
                        <div class="space-y-3">
                            ${tutorData.reports.map(report => `
                                <div class="p-3 bg-indigo-50 rounded-lg flex justify-between items-center report-item">
                                    <div>
                                        <p class="font-medium text-indigo-800">${report.studentName} - ${capitalize(report.subject)} Test</p>
                                        <p class="text-xs text-gray-600">Submitted: ${report.submissionDate} | Score: ${report.score}</p>
                                    </div>
                                    <button data-report='${JSON.stringify(report)}' class="view-report-btn px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-150">View Details</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;

        container.querySelectorAll('.view-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reportData = JSON.parse(e.target.dataset.report);
                showReportDetailModal(reportData);
            });
        });
    };

    renderReports();
}

function showReportDetailModal(report) {
    const questionsHtml = report.questions.map((q, index) => {
        const isCorrect = q.selectedAnswer === q.correctAnswer;
        const resultClass = isCorrect ? 'text-green-600' : 'text-red-600';
        const resultIcon = isCorrect ? '✅' : '❌';
        const correction = isCorrect ? '' : `<p class="text-sm text-red-500 mt-1">Correct Answer: ${q.correctAnswer}</p>`;

        return `
            <div class="p-3 border-b border-gray-100 last:border-b-0">
                <p class="font-semibold text-gray-700">Q${index + 1}: ${q.questionText}</p>
                <p class="text-sm">Selected: <span class="${resultClass}">${q.selectedAnswer} ${resultIcon}</span></p>
                ${correction}
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div id="report-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('report-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-green-700">Tutor Report Details</h3>

                <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <p><strong>Student:</strong> ${report.studentName}</p>
                    <p><strong>Tutor:</strong> ${report.tutorName}</p>
                    <p><strong>Subject:</strong> ${capitalize(report.subject)}</p>
                    <p><strong>Grade:</strong> ${report.grade}</p>
                    <p><strong>Score:</strong> <span class="text-green-600 font-bold">${report.score}</span></p>
                    <p><strong>Date:</strong> ${report.submissionDate}</p>
                </div>

                <h4 class="text-lg font-semibold mt-6 mb-3 border-t pt-3">Questions & Answers</h4>
                <div class="max-h-96 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                    ${questionsHtml}
                </div>

            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function renderSummerBreakPanel(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Summer Break Management</h2><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Loading break list...</p></div>`;

    const renderBreakList = async () => {
        const breakStudents = await fetchBreakStudents();

        let html = `
            <h2 class="text-3xl font-bold text-green-700 mb-6">Summer Break Management</h2>
            <p class="text-lg text-gray-600 font-semibold mb-4">Students on Break: ${breakStudents.length}</p>
            <div class="space-y-4">
        `;

        if (breakStudents.length === 0) {
            html += `<p class="text-gray-500">No students are currently on a summer break status.</p>`;
        } else {
            breakStudents.forEach(student => {
                html += `
                    <div class="bg-purple-100 p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div class="mb-2 md:mb-0">
                            <p class="font-bold text-purple-800">${student.studentName} (Grade ${student.grade})</p>
                            <p class="text-sm text-purple-600">Tutor: ${student.tutorName}</p>
                            <p class="text-xs text-purple-500 mt-1">Break Start: ${student.breakStart}</p>
                        </div>
                        <button data-id="${student.id}" data-name="${student.studentName}" class="move-off-break-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-150 text-sm">Move to Active</button>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;

        container.querySelectorAll('.move-off-break-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleMoveStudentOffBreak(e.target.dataset.id, e.target.dataset.name));
        });
    };

    renderBreakList();
}

function renderParentFeedbackPanel(container) {
    container.innerHTML = `<h2 class="text-3xl font-bold text-green-700 mb-6">Parent Feedback</h2><div class="flex justify-center items-center h-48"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Loading feedback...</p></div>`;

    const renderFeedback = async () => {
        const feedback = await fetchParentFeedback();
        const unreadCount = feedback.filter(f => !f.isRead).length;

        let html = `
            <h2 class="text-3xl font-bold text-green-700 mb-6">Parent Feedback</h2>
            <p class="text-lg text-gray-600 font-semibold mb-4">Total Feedback: ${feedback.length} | Unread: <span class="text-red-600">${unreadCount}</span></p>
            <div class="space-y-4">
        `;

        if (feedback.length === 0) {
            html += `<p class="text-gray-500">No parent feedback found.</p>`;
        } else {
            feedback.forEach(f => {
                const bgColor = f.isRead ? 'bg-gray-50' : 'bg-yellow-100 border-yellow-400';
                const statusText = f.isRead ? 'Read' : 'Unread';
                const statusColor = f.isRead ? 'text-gray-500' : 'text-red-600 font-bold';
                const markAsReadButton = f.isRead ? '' : `<button data-id="${f.id}" class="mark-as-read-btn px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 text-sm">Mark as Read</button>`;

                html += `
                    <div class="p-4 rounded-lg shadow-sm border ${bgColor}">
                        <div class="flex justify-between items-start mb-2">
                            <p class="font-bold text-gray-800">${f.parentName || 'Anonymous Parent'} - <span class="text-sm ${statusColor}">${statusText}</span></p>
                            <p class="text-xs text-gray-500">${f.timestamp}</p>
                        </div>
                        <p class="text-sm text-gray-700 mb-2">Tutor: ${f.tutorName || 'N/A'}</p>
                        <p class="text-gray-700 italic border-l-4 border-yellow-500 pl-3 py-1">"${f.feedback}"</p>
                        <div class="mt-3 flex justify-end">
                            ${markAsReadButton}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;

        container.querySelectorAll('.mark-as-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleMarkFeedbackAsRead(e.target.dataset.id));
        });
    };

    renderFeedback();
}

// ##################################
// # INITIALIZATION & NAVIGATION
// ##################################

// Map navigation IDs to their rendering functions
const allNavItems = {
    'navTutorManagement': { fn: renderManagementTutorView, requiredRoles: ['admin', 'manager'] },
    'navPayAdvice': { fn: renderPayAdvicePanel, requiredRoles: ['admin', 'manager'] },
    'navTutorReports': { fn: renderTutorReportsPanel, requiredRoles: ['admin', 'manager'] },
    'navSummerBreak': { fn: renderSummerBreakPanel, requiredRoles: ['admin', 'manager'] },
    'navPendingApprovals': { fn: fetchAndRenderPendingApprovals, requiredRoles: ['admin', 'manager'] },
    'navParentFeedback': { fn: renderParentFeedbackPanel, requiredRoles: ['admin', 'manager'] }
    // Add other nav items here as they are created
};

let activeNavId = 'navTutorManagement'; // Default view

function setActiveNavButton(id) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.id === id) {
            btn.classList.remove('text-gray-500', 'hover:text-white');
            btn.classList.add('bg-green-600', 'text-white', 'shadow-lg');
            btn.style.setProperty('background-color', '#10B981', 'important'); // Tailwind emerald-500
        } else {
            btn.classList.remove('bg-green-600', 'text-white', 'shadow-lg');
            btn.classList.add('text-gray-500', 'hover:text-white');
            btn.style.removeProperty('background-color');
        }
    });
}

// Setup navigation event listeners
document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.getElementById('main-content');
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            activeNavId = e.target.id;
            setActiveNavButton(activeNavId);
            const navItem = allNavItems[activeNavId];
            if (navItem) {
                // Execute the rendering function
                navItem.fn(mainContent);
                // Save the active view ID to localStorage
                localStorage.setItem('activeManagementView', activeNavId);
            }
        });
    });

    // Check Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        const logoutBtn = document.getElementById('logoutBtn');
        const staffDocRef = user ? doc(db, "tutors", user.email) : null;

        if (user && staffDocRef) {
            // Check staff directory for existing user
            const unsub = onSnapshot(staffDocRef, async (docSnap) => {
                if (!docSnap.exists() || !docSnap.data().approved) {
                    if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name || user.email}`;
                    if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                    if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
                    return;
                }

                const userData = docSnap.data();
                const userRole = userData.role || 'tutor';
                const userName = userData.name || user.email;
                const userPermissions = userData.permissions || [];

                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${userName}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${capitalize(userRole)}`;

                // Filter navigation based on user role/permissions
                const availableNavIds = Object.keys(allNavItems).filter(navId => {
                    const item = allNavItems[navId];
                    if (item.requiredRoles.includes(userRole)) return true;
                    // Additional logic for specific permissions if needed later
                    return false;
                });

                navButtons.forEach(btn => {
                    if (availableNavIds.includes(btn.id)) {
                        btn.classList.remove('hidden');
                    } else {
                        btn.classList.add('hidden');
                    }
                });

                // Load the last active view or the default view
                if (mainContent) {
                    if (availableNavIds.length > 0) {
                        const lastActiveView = localStorage.getItem('activeManagementView');
                        if (lastActiveView && availableNavIds.includes(lastActiveView)) {
                            activeNavId = lastActiveView;
                            setActiveNavButton(activeNavId);
                            allNavItems[activeNavId].fn(mainContent);
                        } else {
                            // Default to the first available nav item
                            activeNavId = availableNavIds[0];
                            setActiveNavButton(activeNavId);
                            const currentItem = allNavItems[activeNavId];
                            if(currentItem) currentItem.fn(mainContent);
                        }
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                    }
                }
            });

        } else {
            window.location.href = "management-auth.html";
        }

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    });
});

