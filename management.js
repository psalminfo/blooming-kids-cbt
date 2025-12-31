import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc, limit, startAfter } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
    referralDataMap: null,
    enrollments: null, // NEW: Added enrollments cache
};

/**
 * Saves a specific piece of data to localStorage.
 * @param {string} key The key for the cache (e.g., 'tutors').
 * @param {any} data The data to store.
 */
function saveToLocalStorage(key, data) {
    // Don't cache reports to avoid quota issues
    if (key === 'reports' || key === 'enrollments') {
        sessionCache[key] = data; // Keep in memory only
        return;
    }
    
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

// Pagination state for reports
let reportsLastVisible = null;
let reportsFirstVisible = null;
let currentReportsPage = 1;

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
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('edit-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects ? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Email</label><input type="email" id="edit-parentEmail" value="${studentData.parentEmail || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Tutor Email</label><input type="email" id="edit-tutorEmail" value="${studentData.tutorEmail || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-4"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('edit-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
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
        const saveBtn = form.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const updatedData = {
            studentName: form.querySelector('#edit-studentName').value,
            grade: form.querySelector('#edit-grade').value,
            days: form.querySelector('#edit-days').value,
            subjects: form.querySelector('#edit-subjects').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            parentName: form.querySelector('#edit-parentName').value,
            parentPhone: form.querySelector('#edit-parentPhone').value,
            parentEmail: form.querySelector('#edit-parentEmail').value,
            tutorEmail: form.querySelector('#edit-tutorEmail').value,
            studentFee: Number(form.querySelector('#edit-studentFee').value) || 0,
            lastUpdated: Timestamp.now(),
        };

        try {
            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, updatedData);
            alert("Student data updated successfully!");
            closeManagementModal('edit-modal');
            
            // Invalidate the cache to force a refresh of the main view
            if (collectionName === 'students') invalidateCache('students');
            if (collectionName === 'pending_students') invalidateCache('pendingStudents');
            
            // Re-load the current view to show changes
            const currentNavId = document.querySelector('.nav-btn.active')?.id;
            const mainContent = document.getElementById('main-content');
            if (currentNavId && allNavItems[currentNavId] && mainContent) {
                allNavItems[currentNavId].fn(mainContent);
            }

        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to update student data. Check console for details.");
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
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
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('assign-modal')">&times;</button>
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
                        <button type="button" onclick="closeManagementModal('assign-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
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
            closeManagementModal('assign-modal');
            invalidateCache('students');
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error assigning student: ", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });
}

// NEW FUNCTION: Reassign Student Modal
function showReassignStudentModal() {
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
        <div id="reassign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('reassign-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Reassign Student to Different Tutor</h3>
                <form id="reassign-student-form">
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Search Student Name</label>
                        <input type="text" id="reassign-student-search" placeholder="Enter student name..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                        <button type="button" id="search-student-btn" class="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm">Search Student</button>
                    </div>
                    <div id="student-search-results" class="mb-4 max-h-40 overflow-y-auto border rounded-md p-2 hidden">
                        <p class="text-sm text-gray-500">Search results will appear here...</p>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Assign to New Tutor</label>
                        <select id="reassign-tutor" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="" disabled selected>Select new tutor...</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <input type="hidden" id="selected-student-id">
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('reassign-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Reassign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Search student functionality
    document.getElementById('search-student-btn').addEventListener('click', async () => {
        const searchTerm = document.getElementById('reassign-student-search').value.trim();
        if (!searchTerm) {
            alert("Please enter a student name to search.");
            return;
        }

        try {
            const studentsSnapshot = await getDocs(collection(db, "students"));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const searchResults = allStudents.filter(student => 
                student.studentName.toLowerCase().includes(searchTerm.toLowerCase())
            );

            const resultsContainer = document.getElementById('student-search-results');
            resultsContainer.classList.remove('hidden');
            
            if (searchResults.length === 0) {
                resultsContainer.innerHTML = '<p class="text-sm text-gray-500">No students found matching your search.</p>';
                return;
            }

            resultsContainer.innerHTML = searchResults.map(student => `
                <div class="p-2 border-b cursor-pointer hover:bg-gray-50 student-result" data-student-id="${student.id}" data-student-name="${student.studentName}" data-current-tutor="${student.tutorEmail}">
                    <p class="font-medium">${student.studentName}</p>
                    <p class="text-xs text-gray-500">Current Tutor: ${student.tutorEmail} | Grade: ${student.grade}</p>
                </div>
            `).join('');

            // Add click handlers for search results
            document.querySelectorAll('.student-result').forEach(result => {
                result.addEventListener('click', () => {
                    const studentId = result.dataset.studentId;
                    const studentName = result.dataset.studentName;
                    const currentTutor = result.dataset.currentTutor;
                    
                    document.getElementById('selected-student-id').value = studentId;
                    document.getElementById('reassign-student-search').value = studentName;
                    
                    // Highlight selected result
                    document.querySelectorAll('.student-result').forEach(r => r.classList.remove('bg-blue-100'));
                    result.classList.add('bg-blue-100');
                    
                    alert(`Selected: ${studentName} (Currently with: ${currentTutor})`);
                });
            });

        } catch (error) {
            console.error("Error searching students:", error);
            alert("Failed to search students. Check console for details.");
        }
    });

    // Reassign form submission
    document.getElementById('reassign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const studentId = document.getElementById('selected-student-id').value;
        const selectedTutorData = JSON.parse(form.elements['reassign-tutor'].value);

        if (!studentId) {
            alert("Please select a student from the search results.");
            return;
        }

        try {
            const studentRef = doc(db, "students", studentId);
            const studentDoc = await getDoc(studentRef);
            
            if (!studentDoc.exists()) {
                alert("Student not found!");
                return;
            }

            const studentData = studentDoc.data();
            const oldTutor = studentData.tutorEmail;
            const newTutor = selectedTutorData.email;

            await updateDoc(studentRef, {
                tutorEmail: newTutor,
                tutorName: selectedTutorData.name,
                lastUpdated: Timestamp.now()
            });

            alert(`Student "${studentData.studentName}" reassigned from ${oldTutor} to ${selectedTutorData.name} successfully!`);
            closeManagementModal('reassign-modal');
            invalidateCache('students');
            renderManagementTutorView(document.getElementById('main-content'));

        } catch (error) {
            console.error("Error reassigning student:", error);
            alert("Failed to reassign student. Check the console for details.");
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
            renderPendingApprovalsPanel(document.getElementById('main-content')); // Re-fetch and render the current panel
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
            renderPendingApprovalsPanel(document.getElementById('main-content')); // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// ##################################
// # REFERRAL MANAGEMENT FUNCTIONS (PHASE 4: NEW)
// ##################################

/**
 * Utility function to format amount to Nigerian Naira.
 */
function formatNaira(amount) {
    return `₦${(amount || 0).toLocaleString()}`;
}

/**
 * Loads the Referral Tracking dashboard for admin view.
 * @param {HTMLElement} mainContent The container element to render into.
 */
async function renderReferralsAdminPanel(container) {
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading referral tracking data...</p></div>';

    try {
        // 1. Fetch all parents with referral codes and all referral transactions
        const parentsQuery = query(collection(db, 'parent_users'), where('referralCode', '!=', null));
        const [parentsSnapshot, transactionsSnapshot] = await Promise.all([
            getDocs(parentsQuery),
            getDocs(collection(db, 'referral_transactions'))
        ]);

        const referralDataMap = {};

        // 2. Process Parents (Initialization)
        parentsSnapshot.forEach(doc => {
            const data = doc.data();
            referralDataMap[doc.id] = {
                uid: doc.id,
                name: capitalize(data.name || 'N/A'),
                email: data.email || 'N/A',
                referralCode: data.referralCode || 'N/A',
                referralEarnings: data.referralEarnings || 0,
                // New parent fields
                bankName: data.bankName || 'N/A',
                accountNumber: data.accountNumber || 'N/A',
                // Transaction aggregation fields
                totalReferrals: 0,
                pendingReferrals: 0,
                approvedReferrals: 0,
                paidReferrals: 0,
                transactions: []
            };
        });

        // 3. Process Transactions (Aggregation)
        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            const ownerUid = data.ownerUid;
            if (referralDataMap[ownerUid]) {
                const parentData = referralDataMap[ownerUid];
                parentData.totalReferrals++;
                parentData.transactions.push({
                    id: doc.id,
                    ...data,
                    // Convert Firebase Timestamp to a readable format
                    refereeJoinDate: data.refereeJoinDate ? data.refereeJoinDate.toDate().toLocaleDateString() : 'N/A'
                });

                const status = data.status || 'pending';
                if (status === 'pending') parentData.pendingReferrals++;
                else if (status === 'approved') parentData.approvedReferrals++;
                else if (status === 'paid') parentData.paidReferrals++;
            }
        });

        // Store in cache for quick modal access
        saveToLocalStorage('referralDataMap', referralDataMap);

        // 4. Render HTML
        let tableRows = '';
        const sortedParents = Object.values(referralDataMap).sort((a, b) => b.referralEarnings - a.referralEarnings);

        if (sortedParents.length === 0) {
            tableRows = `<tr><td colspan="6" class="text-center py-4 text-gray-500">No parents in the referral system yet.</td></tr>`;
        } else {
            sortedParents.forEach(parent => {
                tableRows += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="px-6 py-4 font-medium text-gray-900">${parent.name}</td>
                        <td class="px-6 py-4">${parent.referralCode}</td>
                        <td class="px-6 py-4 text-center">${parent.totalReferrals}</td>
                        <td class="px-6 py-4 text-center text-yellow-600 font-semibold">${parent.pendingReferrals}</td>
                        <td class="px-6 py-4 font-bold text-green-600">${formatNaira(parent.referralEarnings)}</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="showReferralDetailsModal('${parent.uid}')" class="text-indigo-600 hover:text-indigo-900 font-semibold">View Details</button>
                        </td>
                    </tr>
                `;
            });
        }

        container.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-3xl font-extrabold text-gray-900 mb-6">Parent Referral Management</h2>
                <p class="text-gray-600 mb-6">Track referral activity and manage payouts for parent-led referrals.</p>

                <div class="bg-white shadow overflow-hidden sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Name</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Referrals</th>
                                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Approvals</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earnings</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <p class="text-sm text-gray-500 mt-4">Note: Earnings reflect rewards for approved (non-paid) and paid transactions.</p>
            </div>
        `;

        // Attach global functions to the window object so they can be called from onclick attributes
        window.showReferralDetailsModal = showReferralDetailsModal;
    } catch (error) {
        console.error("Error loading referral data: ", error);
        container.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading referral data: ${error.message}</p>`;
    }
}

/**
 * Displays a modal with detailed transaction history for a specific parent.
 * @param {string} parentUid The UID of the parent user.
 */
function showReferralDetailsModal(parentUid) {
    const parentData = sessionCache.referralDataMap[parentUid];
    if (!parentData) {
        alert("Referral details not found in cache.");
        return;
    }
    
    // Sort transactions: pending first, then approved, then paid
    const sortedTransactions = parentData.transactions.sort((a, b) => {
        const statusOrder = { 'pending': 1, 'approved': 2, 'paid': 3 };
        return statusOrder[a.status] - statusOrder[b.status];
    });

    let transactionsHtml = sortedTransactions.map(t => {
        const badgeClass = t.status === 'approved' ? 'bg-green-100 text-green-800' :
                           t.status === 'paid' ? 'bg-indigo-100 text-indigo-800' :
                           'bg-yellow-100 text-yellow-800';
        
        const actionButton = (t.status === 'pending' || t.status === 'approved') ?
            `<button onclick="updateReferralStatus('${parentData.uid}', '${t.id}', 'approved')" class="text-green-600 hover:text-green-900 font-semibold mr-2 text-sm">${t.status === 'pending' ? 'Approve' : 'Re-Approve'}</button>` :
            '';

        return `
            <tr class="border-b">
                <td class="px-4 py-3">${capitalize(t.refereeName)} (Grade: ${t.refereeGrade})</td>
                <td class="px-4 py-3">${formatNaira(t.amount)}</td>
                <td class="px-4 py-3 text-xs">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${badgeClass}">
                        ${capitalize(t.status)}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">${t.refereeJoinDate}</td>
                <td class="px-4 py-3 text-right">
                    ${actionButton}
                </td>
            </tr>
        `;
    }).join('');

    const modalHtml = `
        <div id="referralDetailsModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-2xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('referralDetailsModal')">&times;</button>
                <h3 class="text-2xl font-bold mb-4 text-indigo-600">Referral Details for ${parentData.name}</h3>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
                    <div class="bg-gray-50 p-3 rounded-lg"><p class="font-medium text-gray-500">Code:</p><p class="font-bold text-lg text-indigo-800">${parentData.referralCode}</p></div>
                    <div class="bg-gray-50 p-3 rounded-lg"><p class="font-medium text-gray-500">Total Earnings:</p><p class="font-bold text-lg text-green-700">${formatNaira(parentData.referralEarnings)}</p></div>
                    <div class="bg-gray-50 p-3 rounded-lg"><p class="font-medium text-gray-500">Unpaid Approved:</p><p class="font-bold text-lg text-yellow-600">${parentData.approvedReferrals - parentData.paidReferrals}</p></div>
                    <div class="col-span-3">
                        <p class="font-medium text-gray-500 mb-1">Payout Details:</p>
                        <p class="text-gray-700">Bank: ${parentData.bankName} | Account: ${parentData.accountNumber}</p>
                    </div>
                </div>

                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xl font-semibold text-gray-700">Transaction History (${parentData.totalReferrals} Total)</h4>
                    <button onclick="resetParentBalance('${parentData.uid}', ${parentData.referralEarnings})" 
                            class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
                            ${parentData.referralEarnings === 0 ? 'disabled' : ''}>
                        Mark All Approved as PAID
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referee Details</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
                                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-100">
                            ${transactionsHtml}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach global functions to the window object
    window.updateReferralStatus = updateReferralStatus;
    window.resetParentBalance = resetParentBalance;
}

/**
 * Updates the status of a specific referral transaction.
 * @param {string} parentUid The UID of the parent.
 * @param {string} transactionId The ID of the referral transaction document.
 * @param {string} newStatus The new status to set ('approved' or 'paid').
 */
async function updateReferralStatus(parentUid, transactionId, newStatus) {
    if (!confirm(`Are you sure you want to set this transaction status to '${newStatus}'?`)) {
        return;
    }

    try {
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'referral_transactions', transactionId);
        const parentRef = doc(db, 'parent_users', parentUid);

        // Fetch the transaction to check its current state and amount
        const transactionDoc = await getDoc(transactionRef);
        if (!transactionDoc.exists()) {
            alert('Transaction not found!');
            return;
        }
        const oldStatus = transactionDoc.data().status;
        const amount = transactionDoc.data().amount || 0;

        // 1. Update the transaction status
        batch.update(transactionRef, {
            status: newStatus,
            lastUpdated: Timestamp.now()
        });

        // 2. Adjust parent's referralEarnings if needed
        let earningsChange = 0;
        // If moving from 'pending' to 'approved', increase earnings
        if (oldStatus === 'pending' && newStatus === 'approved') {
            earningsChange = amount;
        }
        // If re-approving (e.g., approved -> approved), no change to earnings
        // If paying (approved -> paid), earnings are cleared in the resetParentBalance function, not here.

        if (earningsChange !== 0) {
            // Note: Firebase server-side increment would be safer here, but for simplicity, we use an update
            const currentEarnings = sessionCache.referralDataMap[parentUid].referralEarnings;
            batch.update(parentRef, {
                referralEarnings: currentEarnings + earningsChange
            });
        }

        await batch.commit();

        alert(`Transaction status updated to ${capitalize(newStatus)}. Parent earnings adjusted.`);
        
        // Refresh the whole view
        invalidateCache('referralDataMap');
        closeManagementModal('referralDetailsModal');
        await renderReferralsAdminPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error updating referral status: ", error);
        alert("Failed to update status. Check console for details.");
    }
}


/**
 * Clears the parent's referralEarnings and marks all 'approved' transactions as 'paid'.
 * @param {string} parentUid The UID of the parent.
 * @param {number} currentEarnings The parent's current referral earnings.
 */
async function resetParentBalance(parentUid, currentEarnings) {
    if (currentEarnings === 0) {
        alert("This parent has zero approved earnings to pay out.");
        return;
    }

    if (!confirm(`Are you sure you want to mark ALL ${formatNaira(currentEarnings)} approved earnings as PAID? This will reset the parent's available earnings to ₦0.`)) {
        return;
    }

    try {
        const batch = writeBatch(db);
        const parentRef = doc(db, 'parent_users', parentUid);

        // 1. Mark all 'approved' transactions for this parent as 'paid'
        const approvedQuery = query(
            collection(db, 'referral_transactions'),
            where('ownerUid', '==', parentUid),
            where('status', '==', 'approved')
        );

        const approvedSnapshot = await getDocs(approvedQuery);

        approvedSnapshot.forEach(doc => {
            const transactionRef = doc(db, 'referral_transactions', doc.id);
            batch.update(transactionRef, {
                status: 'paid',
                paidDate: Timestamp.now(),
                lastUpdated: Timestamp.now()
            });
        });

        // 2. Reset the parent's earnings
        batch.update(parentRef, {
            referralEarnings: 0
        });

        await batch.commit();

        alert(`Payout complete. ${approvedSnapshot.size} transactions marked as PAID. Parent earnings reset to ₦0.`);
        
        // Refresh the whole view
        invalidateCache('referralDataMap');
        closeManagementModal('referralDetailsModal');
        await renderReferralsAdminPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error processing payout and reset: ", error);
        alert("Failed to process payout. Check console for details.");
    }
}

// ##################################
// # ENROLLMENT MANAGEMENT PANEL - NEW
// ##################################

async function renderEnrollmentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Enrollment Management</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="enrollments-search" placeholder="Search enrollments..." class="p-2 border rounded-md w-64">
                    <button id="refresh-enrollments-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Total Enrollments</h4>
                    <p id="total-enrollments" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Draft Applications</h4>
                    <p id="draft-enrollments" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-blue-800 text-sm">Pending Review</h4>
                    <p id="pending-enrollments" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-purple-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-purple-800 text-sm">Completed</h4>
                    <p id="completed-enrollments" class="text-2xl font-extrabold">0</p>
                </div>
            </div>

            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <div class="flex space-x-4">
                    <select id="status-filter" class="p-2 border rounded-md">
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="payment_received">Payment Received</option>
                    </select>
                    <input type="date" id="date-from" class="p-2 border rounded-md" placeholder="From Date">
                    <input type="date" id="date-to" class="p-2 border rounded-md" placeholder="To Date">
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Application ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referral Code</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="enrollments-list" class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td colspan="8" class="px-6 py-4 text-center text-gray-500">Loading enrollments...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Event Listeners
    document.getElementById('refresh-enrollments-btn').addEventListener('click', () => fetchAndRenderEnrollments(true));
    document.getElementById('enrollments-search').addEventListener('input', (e) => filterEnrollments(e.target.value));
    document.getElementById('status-filter').addEventListener('change', applyEnrollmentFilters);
    document.getElementById('date-from').addEventListener('change', applyEnrollmentFilters);
    document.getElementById('date-to').addEventListener('change', applyEnrollmentFilters);

    // Load initial data
    fetchAndRenderEnrollments();
}

async function fetchAndRenderEnrollments(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('enrollments');
    }

    const enrollmentsList = document.getElementById('enrollments-list');
    if (!enrollmentsList) return;

    try {
        if (!sessionCache.enrollments || forceRefresh) {
            enrollmentsList.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Fetching enrollments...</td></tr>`;
            
            const snapshot = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt", "desc")));
            const enrollmentsData = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            saveToLocalStorage('enrollments', enrollmentsData);
        }
        
        renderEnrollmentsFromCache();
    } catch (error) {
        console.error("Error fetching enrollments:", error);
        enrollmentsList.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-red-500">Failed to load enrollments: ${error.message}</td></tr>`;
    }
}

function renderEnrollmentsFromCache(searchTerm = '') {
    const enrollments = sessionCache.enrollments || [];
    const enrollmentsList = document.getElementById('enrollments-list');
    if (!enrollmentsList) return;

    // Apply filters
    const statusFilter = document.getElementById('status-filter')?.value || '';
    const dateFrom = document.getElementById('date-from')?.value;
    const dateTo = document.getElementById('date-to')?.value;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    let filteredEnrollments = enrollments.filter(enrollment => {
        // Search filter
        if (searchTerm) {
            const matchesSearch = 
                (enrollment.id && enrollment.id.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.name && enrollment.parent.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.email && enrollment.parent.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.phone && enrollment.parent.phone.toLowerCase().includes(lowerCaseSearchTerm)) ||
                enrollment.students?.some(student => 
                    student.name && student.name.toLowerCase().includes(lowerCaseSearchTerm)
                );
            
            if (!matchesSearch) return false;
        }
        
        // Status filter
        if (statusFilter && enrollment.status !== statusFilter) return false;
        
        // Date filter
        if (dateFrom) {
            const createdDate = new Date(enrollment.createdAt || enrollment.timestamp);
            const fromDate = new Date(dateFrom);
            if (createdDate < fromDate) return false;
        }
        
        if (dateTo) {
            const createdDate = new Date(enrollment.createdAt || enrollment.timestamp);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (createdDate > toDate) return false;
        }
        
        return true;
    });

    // Update statistics
    const total = enrollments.length;
    const draft = enrollments.filter(e => e.status === 'draft').length;
    const pending = enrollments.filter(e => e.status === 'pending').length;
    const completed = enrollments.filter(e => e.status === 'completed' || e.status === 'payment_received').length;
    
    document.getElementById('total-enrollments').textContent = total;
    document.getElementById('draft-enrollments').textContent = draft;
    document.getElementById('pending-enrollments').textContent = pending;
    document.getElementById('completed-enrollments').textContent = completed;

    if (filteredEnrollments.length === 0) {
        enrollmentsList.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                    No enrollments found${searchTerm ? ` for "${searchTerm}"` : ''}.
                </td>
            </tr>
        `;
        return;
    }

    // Helper function to parse fee values consistently
    function parseFeeValue(feeValue) {
        if (!feeValue && feeValue !== 0) return 0;
        
        if (typeof feeValue === 'number') {
            return Math.round(feeValue);
        }
        
        if (typeof feeValue === 'string') {
            // Remove all non-numeric characters except decimal point and minus sign
            const cleaned = feeValue
                .replace(/[^0-9.-]/g, '')
                .trim();
            
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : Math.round(parsed);
        }
        
        return 0;
    }

    // Render enrollments table
    const tableRows = filteredEnrollments.map(enrollment => {
        const createdAt = enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString() : 
                        enrollment.timestamp ? new Date(enrollment.timestamp).toLocaleDateString() : 'N/A';
        
        const studentCount = enrollment.students?.length || 0;
        const studentNames = enrollment.students?.map(s => s.name).join(', ') || 'No students';
        
        // Status badge
        let statusBadge = '';
        switch(enrollment.status) {
            case 'draft':
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Draft</span>`;
                break;
            case 'pending':
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>`;
                break;
            case 'completed':
            case 'payment_received':
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>`;
                break;
            default:
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">${enrollment.status || 'Unknown'}</span>`;
        }
        
        // Total fee - Use consistent parsing
        const totalFeeAmount = parseFeeValue(enrollment.summary?.totalFee);
        const formattedFee = totalFeeAmount > 0 ? `₦${totalFeeAmount.toLocaleString()}` : '₦0';
        
        // Referral code
        const referralCode = enrollment.referral?.code || 'None';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${enrollment.id.substring(0, 12)}...</div>
                    <div class="text-xs text-gray-500">${enrollment.id}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${enrollment.parent?.name || 'N/A'}</div>
                    <div class="text-xs text-gray-500">${enrollment.parent?.email || ''}</div>
                    <div class="text-xs text-gray-500">${enrollment.parent?.phone || ''}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${studentCount} student(s)</div>
                    <div class="text-xs text-gray-500 truncate max-w-xs">${studentNames}</div>
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-green-600">${formattedFee}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded">${referralCode}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${createdAt}</td>
                <td class="px-6 py-4 text-sm font-medium">
                    <button onclick="showEnrollmentDetails('${enrollment.id}')" 
                            class="text-indigo-600 hover:text-indigo-900 mr-3">
                        View
                    </button>
                    <button onclick="updateEnrollmentStatus('${enrollment.id}', 'completed')" 
                            class="text-green-600 hover:text-green-900">
                        Approve
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    enrollmentsList.innerHTML = tableRows;
}

function filterEnrollments(searchTerm) {
    renderEnrollmentsFromCache(searchTerm);
}

function applyEnrollmentFilters() {
    renderEnrollmentsFromCache(document.getElementById('enrollments-search').value);
}

// Global function to show enrollment details modal
window.showEnrollmentDetails = async function(enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
        
        // Format date
        const createdAt = enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleString() : 
                         enrollment.timestamp ? new Date(enrollment.timestamp).toLocaleString() : 'N/A';
        
        // Build students details HTML
        let studentsHTML = '';
        if (enrollment.students && enrollment.students.length > 0) {
            studentsHTML = enrollment.students.map(student => {
                let subjectsHTML = '';
                if (student.selectedSubjects && student.selectedSubjects.length > 0) {
                    subjectsHTML = `<p class="text-sm"><strong>Subjects:</strong> ${student.selectedSubjects.join(', ')}</p>`;
                }
                
                let extracurricularHTML = '';
                if (student.extracurriculars && student.extracurriculars.length > 0) {
                    extracurricularHTML = `<p class="text-sm"><strong>Extracurricular:</strong> ${student.extracurriculars.map(e => `${e.name} (${e.frequency})`).join(', ')}</p>`;
                }
                
                let testPrepHTML = '';
                if (student.testPrep && student.testPrep.length > 0) {
                    testPrepHTML = `<p class="text-sm"><strong>Test Prep:</strong> ${student.testPrep.map(t => `${t.name} (${t.hours} hrs)`).join(', ')}</p>`;
                }
                
                return `
                    <div class="border rounded-lg p-4 mb-3 bg-gray-50">
                        <h4 class="font-bold text-lg mb-2">${student.name || 'Unnamed Student'}</h4>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <p><strong>Grade:</strong> ${student.grade || 'N/A'}</p>
                            <p><strong>DOB:</strong> ${student.dob || 'N/A'}</p>
                            <p><strong>Start Date:</strong> ${student.startDate || 'N/A'}</p>
                        </div>
                        ${subjectsHTML}
                        ${extracurricularHTML}
                        ${testPrepHTML}
                    </div>
                `;
            }).join('');
        }

        // Helper function to parse fee values consistently
        function parseFeeValue(feeValue) {
            if (!feeValue && feeValue !== 0) return 0;
            
            if (typeof feeValue === 'number') {
                return Math.round(feeValue);
            }
            
            if (typeof feeValue === 'string') {
                // Remove all non-numeric characters except decimal point and minus sign
                const cleaned = feeValue
                    .replace(/[^0-9.-]/g, '')
                    .trim();
                
                const parsed = parseFloat(cleaned);
                return isNaN(parsed) ? 0 : Math.round(parsed);
            }
            
            return 0;
        }

        // Build fee breakdown HTML
        let feeBreakdownHTML = '';
        if (enrollment.summary) {
            const summary = enrollment.summary;
            
            // Parse all fee values consistently
            const academicFee = parseFeeValue(summary.academicFee);
            const extracurricularFee = parseFeeValue(summary.extracurricularFee);
            const testPrepFee = parseFeeValue(summary.testPrepFee);
            const discountAmount = parseFeeValue(summary.discountAmount);
            const totalFee = parseFeeValue(summary.totalFee);
            
            feeBreakdownHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-green-50 p-3 rounded">
                        <p class="text-sm"><strong>Academic Fees:</strong></p>
                        <p class="text-lg font-bold">₦${academicFee.toLocaleString()}</p>
                    </div>
                    <div class="bg-blue-50 p-3 rounded">
                        <p class="text-sm"><strong>Extracurricular:</strong></p>
                        <p class="text-lg font-bold">₦${extracurricularFee.toLocaleString()}</p>
                    </div>
                    <div class="bg-yellow-50 p-3 rounded">
                        <p class="text-sm"><strong>Test Prep:</strong></p>
                        <p class="text-lg font-bold">₦${testPrepFee.toLocaleString()}</p>
                    </div>
                    <div class="bg-red-50 p-3 rounded">
                        <p class="text-sm"><strong>Discount:</strong></p>
                        <p class="text-lg font-bold">-₦${discountAmount.toLocaleString()}</p>
                    </div>
                </div>
                <div class="mt-4 p-4 bg-gray-100 rounded">
                    <p class="text-xl font-bold text-green-700">Total: ₦${totalFee.toLocaleString()}</p>
                </div>
            `;
        }

        // Build referral info HTML
        let referralHTML = '';
        if (enrollment.referral && enrollment.referral.code) {
            referralHTML = `
                <div class="border-l-4 border-green-500 pl-4 bg-green-50 p-3 rounded">
                    <h4 class="font-bold text-green-700">Referral Information</h4>
                    <p><strong>Code:</strong> <span class="font-mono">${enrollment.referral.code}</span></p>
                    ${enrollment.referral.bankName ? `<p><strong>Bank:</strong> ${enrollment.referral.bankName}</p>` : ''}
                    ${enrollment.referral.accountNumber ? `<p><strong>Account:</strong> ${enrollment.referral.accountNumber}</p>` : ''}
                    ${enrollment.referral.accountName ? `<p><strong>Account Name:</strong> ${enrollment.referral.accountName}</p>` : ''}
                </div>
            `;
        }

        const modalHtml = `
            <div id="enrollmentDetailsModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-2xl">
                    <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('enrollmentDetailsModal')">&times;</button>
                    <h3 class="text-2xl font-bold mb-4 text-green-700">Enrollment Details</h3>
                    
                    <div class="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <h4 class="font-bold text-lg mb-2">Application Information</h4>
                            <p><strong>ID:</strong> ${enrollment.id}</p>
                            <p><strong>Status:</strong> <span class="px-2 py-1 text-xs rounded-full ${enrollment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${enrollment.status || 'Unknown'}</span></p>
                            <p><strong>Created:</strong> ${createdAt}</p>
                            ${enrollment.lastSaved ? `<p><strong>Last Saved:</strong> ${new Date(enrollment.lastSaved).toLocaleString()}</p>` : ''}
                        </div>
                        
                        <div>
                            <h4 class="font-bold text-lg mb-2">Parent Information</h4>
                            <p><strong>Name:</strong> ${enrollment.parent?.name || 'N/A'}</p>
                            <p><strong>Email:</strong> ${enrollment.parent?.email || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${enrollment.parent?.phone || 'N/A'}</p>
                            <p><strong>Address:</strong> ${enrollment.parent?.address || 'N/A'}</p>
                        </div>
                    </div>
                    
                    ${referralHTML}
                    
                    <div class="mt-6">
                        <h4 class="font-bold text-lg mb-2">Student Information (${enrollment.students?.length || 0} students)</h4>
                        ${studentsHTML || '<p class="text-gray-500">No student information available.</p>'}
                    </div>
                    
                    <div class="mt-6">
                        <h4 class="font-bold text-lg mb-2">Fee Breakdown</h4>
                        ${feeBreakdownHTML || '<p class="text-gray-500">No fee breakdown available.</p>'}
                    </div>
                    
                    <div class="flex justify-end space-x-3 mt-6 pt-6 border-t">
                        <button onclick="closeManagementModal('enrollmentDetailsModal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Close</button>
                        <button onclick="updateEnrollmentStatus('${enrollment.id}', 'completed')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Mark as Completed</button>
                        <button onclick="updateEnrollmentStatus('${enrollment.id}', 'payment_received')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Mark Payment Received</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error("Error showing enrollment details:", error);
        alert("Failed to load enrollment details. Please try again.");
    }
};

// Global function to update enrollment status
window.updateEnrollmentStatus = async function(enrollmentId, newStatus) {
    if (!confirm(`Are you sure you want to update this enrollment status to '${newStatus}'?`)) {
        return;
    }

    try {
        await updateDoc(doc(db, "enrollments", enrollmentId), {
            status: newStatus,
            lastUpdated: Timestamp.now()
        });

        alert(`Enrollment status updated to ${newStatus}.`);
        
        // Refresh the enrollments list
        invalidateCache('enrollments');
        closeManagementModal('enrollmentDetailsModal');
        await fetchAndRenderEnrollments();
        
    } catch (error) {
        console.error("Error updating enrollment status:", error);
        alert("Failed to update enrollment status. Please try again.");
    }
};

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
                    <button id="reassign-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Reassign Student</button>
                    <button id="refresh-directory-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Refresh</button>
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
    document.getElementById('reassign-student-btn').addEventListener('click', showReassignStudentModal);
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

    const canEditStudents = window.userData?.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData?.permissions?.actions?.canDeleteStudents === true;
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

// --- Updated Pay Advice Panel ---
async function renderPayAdvicePanel(container) {
    const canExport = window.userData?.permissions?.actions?.canExportPayAdvice === true;
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
                    ${canExport ? `<button id="export-pay-xls-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Download 4 XLS Files</button>` : ''}
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
            <div id="pay-advice-total" class="mt-4 p-4 bg-gray-100 rounded-lg hidden">
                <h3 class="text-lg font-bold text-gray-800">Grand Total: ₦<span id="grand-total-amount">0</span></h3>
            </div>
        </div>
    `;
    
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            // Don't reset gifts - FIXED: Keep existing gifts
            currentPayData = []; // Reset data
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);

    const exportBtn = document.getElementById('export-pay-xls-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (currentPayData.length === 0) {
                alert("No pay data available to export. Please select a date range first.");
                return;
            }
            exportPayAdviceAsXLS();
        };
    }
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading pay data...</td></tr>`;

    endDate.setHours(23, 59, 59, 999);
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
    
    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        
        if (reportsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No reports found in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            currentPayData = [];
            document.getElementById('pay-advice-total').classList.add('hidden');
            return;
        }

        const tutorStudentPairs = {};
        const activeTutorEmails = new Set();
        const tutorBankDetails = {};

        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const tutorEmail = data.tutorEmail;
            const studentName = data.studentName;
            
            activeTutorEmails.add(tutorEmail);
            
            if (!tutorStudentPairs[tutorEmail]) {
                tutorStudentPairs[tutorEmail] = new Set();
            }
            tutorStudentPairs[tutorEmail].add(studentName);
            
            if (data.beneficiaryBank && data.beneficiaryAccount) {
                tutorBankDetails[tutorEmail] = {
                    beneficiaryBank: data.beneficiaryBank,
                    beneficiaryAccount: data.beneficiaryAccount,
                    beneficiaryName: data.beneficiaryName || 'N/A',
                };
            }
        });

        const activeTutorEmailsArray = Array.from(activeTutorEmails);

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
            return querySnapshots.flatMap(snapshot => snapshot.docs);
        };

        const [tutorDocs, studentsSnapshot] = await Promise.all([
            fetchTutorsInChunks(activeTutorEmailsArray),
            getDocs(collection(db, "students"))
        ]);

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];
        
        tutorDocs.forEach(doc => {
            const tutor = doc.data();
            const tutorEmail = tutor.email;
            
            const reportedStudentNames = tutorStudentPairs[tutorEmail] || new Set();
            
            const reportedStudents = allStudents.filter(s => 
                s.tutorEmail === tutorEmail && 
                reportedStudentNames.has(s.studentName) &&
                s.summerBreak !== true
            );
            
            const totalStudentFees = reportedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += reportedStudents.length;
            const bankDetails = tutorBankDetails[tutorEmail] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: reportedStudents.length,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee,
                tinNumber: tutor.tinNumber || '', // Added TIN number
                ...bankDetails
            });
        });
        
        currentPayData = payData;
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
    
    let grandTotal = 0;
    
    tableBody.innerHTML = currentPayData.map(d => {
        const giftAmount = payAdviceGifts[d.tutorEmail] || 0;
        const finalPay = d.totalPay + giftAmount;
        grandTotal += finalPay;
        
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
    
    // Show grand total
    const totalElement = document.getElementById('pay-advice-total');
    const totalAmountElement = document.getElementById('grand-total-amount');
    totalAmountElement.textContent = grandTotal.toLocaleString();
    totalElement.classList.remove('hidden');
    
    document.querySelectorAll('.add-gift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const currentGift = payAdviceGifts[tutorEmail] || 0;
            const giftInput = prompt(`Enter gift amount for this tutor:`, currentGift);
            if (giftInput !== null) {
                const giftAmount = parseFloat(giftInput);
                if (!isNaN(giftAmount) && giftAmount >= 0) {
                    payAdviceGifts[tutorEmail] = giftAmount;
                    renderPayAdviceTable(); // Re-render with updated gift
                } else {
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}

// NEW: Export Pay Advice as 4 XLS Files
async function exportPayAdviceAsXLS() {
    try {
        const currentDate = new Date();
        const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Calculate the splits for each tutor
        const processedData = currentPayData.map(tutor => {
            const giftAmount = payAdviceGifts[tutor.tutorEmail] || 0;
            const finalPay = tutor.totalPay + giftAmount;
            
            const firstHalf = finalPay / 2;
            const tenPercentDeduction = firstHalf * 0.1;
            const mainPayment = firstHalf - tenPercentDeduction;
            const dataZoomPayment = firstHalf; // Full 50%
            const tinRemittance = tenPercentDeduction;
            
            return {
                ...tutor,
                finalPay: finalPay,
                giftAmount: giftAmount,
                mainPayment: mainPayment,
                dataZoomPayment: dataZoomPayment,
                tinRemittance: tinRemittance
            };
        });

        // FILE 1: Main Payment (First Half MINUS 10%)
        const mainPaymentData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.beneficiaryBank,
            '', // Beneficiary branch (blank)
            tutor.beneficiaryAccount,
            '', // Transaction Unique Reference (blank)
            'NIP',
            tutor.mainPayment,
            'NGN',
            `${monthYear} Tutor Payment`
        ]);

        // FILE 2: DataZoom Allocation (Second Half - Full 50%)
        const dataZoomData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.beneficiaryBank,
            '', // Beneficiary branch (blank)
            tutor.beneficiaryAccount,
            '', // Transaction Unique Reference (blank)
            'NIP',
            tutor.dataZoomPayment,
            'NGN',
            'DATAZOOMALLOCT'
        ]);

        // FILE 3: TIN Remittance (The 10% Deducted)
        const tinRemittanceData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.tinNumber || '', // TIN number (blank if not available)
            tutor.tinRemittance,
            'NGN',
            monthYear
        ]);

        // FILE 4: Full Pay Advice Report (Original)
        const fullPayAdviceData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.studentCount,
            tutor.totalStudentFees,
            tutor.managementFee,
            tutor.totalPay,
            tutor.giftAmount,
            tutor.finalPay,
            tutor.beneficiaryBank,
            tutor.beneficiaryAccount,
            tutor.tutorName
        ]);

        // Create and download all 4 files
        await downloadMultipleXLSFiles([
            {
                filename: `Main_Payment_${monthYear.replace(' ', '_')}.xls`,
                data: mainPaymentData,
                headers: ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
            },
            {
                filename: `DataZoom_Allocation_${monthYear.replace(' ', '_')}.xls`,
                data: dataZoomData,
                headers: ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
            },
            {
                filename: `TIN_Remittance_${monthYear.replace(' ', '_')}.xls`,
                data: tinRemittanceData,
                headers: ['Tutor Name', 'TIN Number', 'Amount', 'Currency', 'Month']
            },
            {
                filename: `Full_PayAdvice_${monthYear.replace(' ', '_')}.xls`,
                data: fullPayAdviceData,
                headers: ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)', 'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name']
            }
        ]);

        alert('All 4 XLS files downloaded successfully!');

    } catch (error) {
        console.error("Error exporting XLS files:", error);
        alert("Failed to export XLS files. Please try again.");
    }
}

// NEW: Function to download multiple XLS files
async function downloadMultipleXLSFiles(files) {
    for (const file of files) {
        await downloadAsXLS(file.data, file.headers, file.filename);
        // Small delay between downloads to prevent browser issues
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// NEW: Function to convert data to XLS format
function downloadAsXLS(data, headers, filename) {
    return new Promise((resolve) => {
        // Create HTML table for XLS format
        let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
        html += '<table border="1">';
        
        // Add headers
        html += '<tr>';
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr>';
        
        // Add data rows
        data.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</table></body></html>';
        
        // Create and trigger download
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        resolve();
    });
}

// --- Tutor Reports Panel --- (SIMPLIFIED RELIABLE VERSION)
async function renderTutorReportsPanel(container) {
    const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
    const canExport = window.userData?.permissions?.actions?.canExportPayAdvice === true;
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            
            <!-- Filters and Controls -->
            <div class="bg-green-50 p-4 rounded-lg mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                    <div>
                        <label for="reports-start-date" class="block text-sm font-medium">Start Date</label>
                        <input type="date" id="reports-start-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="reports-end-date" class="block text-sm font-medium">End Date</label>
                        <input type="date" id="reports-end-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="reports-tutor-filter" class="block text-sm font-medium">Filter by Tutor</label>
                        <select id="reports-tutor-filter" class="mt-1 block w-full p-2 border rounded-md">
                            <option value="">All Tutors</option>
                        </select>
                    </div>
                    <div>
                        <label for="reports-student-filter" class="block text-sm font-medium">Filter by Student</label>
                        <select id="reports-student-filter" class="mt-1 block w-full p-2 border rounded-md">
                            <option value="">All Students</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-4">
                        <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                            <h4 class="font-bold text-green-800 text-sm">Tutors Submitted</h4>
                            <p id="report-tutor-count" class="text-2xl font-extrabold">0</p>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                            <h4 class="font-bold text-yellow-800 text-sm">Total Reports</h4>
                            <p id="report-total-count" class="text-2xl font-extrabold">0</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Refresh
                        </button>
                        ${canExport ? `<button id="export-reports-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Export CSV
                        </button>` : ''}
                    </div>
                </div>
            </div>

            <!-- Search Box -->
            <div class="mb-6">
                <input type="search" id="reports-search" placeholder="Search reports by student, tutor, or content..." 
                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
            </div>

            <!-- Progress Modal -->
            <div id="pdf-progress-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center hidden">
                <div class="relative p-8 bg-white w-96 rounded-lg shadow-xl">
                    <h3 class="text-xl font-bold mb-4">Generating PDF</h3>
                    <p id="pdf-progress-message" class="mb-4">Initializing...</p>
                    <div class="w-full bg-gray-200 rounded-full h-4 mb-4">
                        <div id="pdf-progress-bar" class="bg-green-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="pdf-progress-text" class="text-center text-sm text-gray-600">0%</p>
                </div>
            </div>

            <!-- Reports List -->
            <div id="tutor-reports-list" class="space-y-4">
                <div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading reports...</p>
                </div>
            </div>
        </div>
    `;

    // Set default dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('reports-start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reports-end-date').value = lastDay.toISOString().split('T')[0];

    let allReports = [];
    let filteredReports = [];

    // Date change handler
    const handleDateChange = () => {
        fetchAndRenderTutorReports();
    };

    // Event listeners
    document.getElementById('reports-start-date').addEventListener('change', handleDateChange);
    document.getElementById('reports-end-date').addEventListener('change', handleDateChange);
    document.getElementById('refresh-reports-btn').addEventListener('click', handleDateChange);
    
    // Search functionality
    document.getElementById('reports-search').addEventListener('input', (e) => {
        filterReports(e.target.value);
    });

    // Filter functionality
    document.getElementById('reports-tutor-filter').addEventListener('change', () => {
        applyFilters();
    });
    
    document.getElementById('reports-student-filter').addEventListener('change', () => {
        applyFilters();
    });

    // Export CSV
    const exportBtn = document.getElementById('export-reports-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReportsToCSV);
    }

    // Load initial data
    handleDateChange();

    // Helper functions for the reports panel
    function filterReports(searchTerm) {
        const lowerCaseTerm = searchTerm.toLowerCase();
        filteredReports = allReports.filter(report => 
            report.studentName?.toLowerCase().includes(lowerCaseTerm) ||
            report.tutorName?.toLowerCase().includes(lowerCaseTerm) ||
            report.tutorEmail?.toLowerCase().includes(lowerCaseTerm) ||
            report.introduction?.toLowerCase().includes(lowerCaseTerm) ||
            report.topics?.toLowerCase().includes(lowerCaseTerm) ||
            report.progress?.toLowerCase().includes(lowerCaseTerm)
        );
        renderTutorReportsFromCache();
    }

    function applyFilters() {
        const tutorFilter = document.getElementById('reports-tutor-filter').value;
        const studentFilter = document.getElementById('reports-student-filter').value;
        
        filteredReports = allReports.filter(report => {
            const tutorMatch = !tutorFilter || report.tutorEmail === tutorFilter;
            const studentMatch = !studentFilter || report.studentName === studentFilter;
            return tutorMatch && studentMatch;
        });
        
        renderTutorReportsFromCache();
    }

    async function exportReportsToCSV() {
        try {
            const csvData = convertReportsToCSV(filteredReports);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const startDate = document.getElementById('reports-start-date').value;
            const endDate = document.getElementById('reports-end-date').value;
            link.href = URL.createObjectURL(blob);
            link.download = `Tutor_Reports_${startDate}_to_${endDate}.csv`;
            link.click();
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Failed to export CSV. Please try again.');
        }
    }

    function convertReportsToCSV(reports) {
        const headers = [
            'Tutor Name', 'Tutor Email', 'Student Name', 'Parent Name', 'Grade',
            'Submission Date', 'Topics Covered', 'Progress', 'Strengths & Weaknesses',
            'Recommendations'
        ];

        const rows = reports.map(report => {
            const submissionDate = report.submittedAt ? 
                new Date(report.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A';
            
            return [
                `"${report.tutorName || 'N/A'}"`,
                `"${report.tutorEmail || 'N/A'}"`,
                `"${report.studentName || 'N/A'}"`,
                `"${report.parentName || 'N/A'}"`,
                `"${report.grade || 'N/A'}"`,
                `"${submissionDate}"`,
                `"${(report.topics || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.progress || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.strengthsWeaknesses || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.recommendations || 'N/A').replace(/"/g, '""')}"`
            ];
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    // Fixed function to fetch and render reports
    async function fetchAndRenderTutorReports() {
        const reportsListContainer = document.getElementById('tutor-reports-list');
        if (!reportsListContainer) return;

        reportsListContainer.innerHTML = `
            <div class="text-center py-10">
                <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                <p class="text-green-600 font-semibold mt-4">Loading reports for selected period...</p>
            </div>
        `;

        try {
            const startDateInput = document.getElementById('reports-start-date');
            const endDateInput = document.getElementById('reports-end-date');
            
            const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
            const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
            
            if (!startDate || !endDate) {
                throw new Error('Please select both start and end dates.');
            }

            endDate.setHours(23, 59, 59, 999);

            // Convert dates to Firestore timestamps
            const startTimestamp = Timestamp.fromDate(startDate);
            const endTimestamp = Timestamp.fromDate(endDate);

            // Query reports within date range
            const reportsQuery = query(
                collection(db, "tutor_submissions"), 
                where("submittedAt", ">=", startTimestamp),
                where("submittedAt", "<=", endTimestamp),
                orderBy("submittedAt", "desc")
            );

            const snapshot = await getDocs(reportsQuery);
            
            if (snapshot.empty) {
                allReports = [];
                filteredReports = [];
                renderTutorReportsFromCache();
                return;
            }

            allReports = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));

            filteredReports = [...allReports];

            // Update filter dropdowns
            updateFilterDropdowns();

            // Save to cache and render
            saveToLocalStorage('reports', allReports);
            renderTutorReportsFromCache();

        } catch (error) {
            console.error("Error fetching reports:", error);
            reportsListContainer.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <p class="font-semibold">Failed to load reports</p>
                    <p class="text-sm mt-2">${error.message}</p>
                    <button onclick="fetchAndRenderTutorReports()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    function updateFilterDropdowns() {
        const tutorFilter = document.getElementById('reports-tutor-filter');
        const studentFilter = document.getElementById('reports-student-filter');
        
        // Get unique tutors and students
        const tutors = [...new Set(allReports.map(r => r.tutorEmail))].filter(Boolean);
        const students = [...new Set(allReports.map(r => r.studentName))].filter(Boolean);
        
        // Update tutor filter
        tutorFilter.innerHTML = '<option value="">All Tutors</option>' + 
            tutors.map(tutor => `<option value="${tutor}">${tutor}</option>`).join('');
        
        // Update student filter
        studentFilter.innerHTML = '<option value="">All Students</option>' + 
            students.map(student => `<option value="${student}">${student}</option>`).join('');
    }

    function renderTutorReportsFromCache() {
        const reportsListContainer = document.getElementById('tutor-reports-list');
        if (!reportsListContainer) return;

        if (filteredReports.length === 0) {
            reportsListContainer.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-gray-500">No reports found for the selected period and filters.</p>
                    <p class="text-sm text-gray-400 mt-2">Try adjusting your date range or search terms.</p>
                </div>`;
            
            document.getElementById('report-tutor-count').textContent = '0';
            document.getElementById('report-total-count').textContent = '0';
            return;
        }

        // Group reports by tutor
        const reportsByTutor = {};
        filteredReports.forEach(report => {
            if (!reportsByTutor[report.tutorEmail]) {
                reportsByTutor[report.tutorEmail] = { 
                    name: report.tutorName || report.tutorEmail, 
                    reports: [] 
                };
            }
            reportsByTutor[report.tutorEmail].reports.push(report);
        });

        // Update statistics
        const uniqueTutors = Object.keys(reportsByTutor).length;
        document.getElementById('report-tutor-count').textContent = uniqueTutors;
        document.getElementById('report-total-count').textContent = filteredReports.length;

        const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
        
        // Render the reports in tutor → student hierarchy
        let html = '';
        
        Object.values(reportsByTutor).forEach(tutorData => {
            // Group reports by student for this tutor
            const reportsByStudent = {};
            tutorData.reports.forEach(report => {
                if (!reportsByStudent[report.studentName]) {
                    reportsByStudent[report.studentName] = [];
                }
                reportsByStudent[report.studentName].push(report);
            });

            const studentReportsHTML = Object.entries(reportsByStudent).map(([studentName, studentReports]) => {
                const reportLinks = studentReports.map(report => {
                    const reportDate = report.submittedAt ? 
                        new Date(report.submittedAt.seconds * 1000).toLocaleDateString() : 
                        'Unknown date';
                        
                    return `
                        <li class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                            <div>
                                <span class="font-medium">${reportDate}</span>
                                <span class="text-sm text-gray-500 ml-3">Grade: ${report.grade || 'N/A'}</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="previewReport('${report.id}')" 
                                        class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600">
                                    👁️ Preview
                                </button>
                                ${canDownload ? `
                                    <button onclick="downloadSingleReport('${report.id}', event)" 
                                            class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                                        📥 Download
                                    </button>
                                ` : ''}
                            </div>
                        </li>
                    `;
                }).join('');

                return `
                    <div class="ml-4 mt-2">
                        <h4 class="font-semibold text-gray-700 mb-2">📚 ${studentName}</h4>
                        <ul class="space-y-2">
                            ${reportLinks}
                        </ul>
                    </div>
                `;
            }).join('');

            const zipButtonHTML = canDownload ? `
                <div class="p-4 border-t bg-blue-50">
                    <button onclick="zipAndDownloadTutorReports(${JSON.stringify(tutorData.reports).replace(/"/g, '&quot;')}, '${tutorData.name.replace(/'/g, "\\'")}', this)" 
                            class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                        📦 ZIP & DOWNLOAD ALL REPORTS FOR ${tutorData.name.toUpperCase()}
                    </button>
                </div>
            ` : '';

            html += `
                <div class="border rounded-lg shadow-sm bg-white">
                    <details open>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg bg-green-50 hover:bg-green-100 rounded-t-lg">
                            <span>👨‍🏫 ${tutorData.name}</span>
                            <span class="text-sm font-normal text-gray-500 bg-green-200 px-2 py-1 rounded-full">
                                ${tutorData.reports.length} report${tutorData.reports.length !== 1 ? 's' : ''}
                            </span>
                        </summary>
                        <div class="border-t">
                            <div class="space-y-4 p-4">
                                ${studentReportsHTML}
                            </div>
                            ${zipButtonHTML}
                        </div>
                    </details>
                </div>
            `;
        });

        reportsListContainer.innerHTML = html;
    }
}

// SIMPLIFIED & RELIABLE PDF DOWNLOAD FUNCTIONS

// FIXED Global functions for event handlers
window.previewReport = async function(reportId) {
    try {
        const { html } = await generateReportHTML(reportId);
        const newWindow = window.open();
        newWindow.document.write(html);
        newWindow.document.close();
    } catch (error) {
        console.error("Error previewing report:", error);
        alert(`Error: ${error.message}`);
    }
};

// SIMPLIFIED: Download using the same HTML as preview
window.downloadSingleReport = async function(reportId, event) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        // Show loading state
        button.innerHTML = '<div class="loading-spinner mx-auto" style="width: 16px; height: 16px;"></div>';
        button.disabled = true;
        
        // Show progress modal
        const progressModal = document.getElementById('pdf-progress-modal');
        const progressBar = document.getElementById('pdf-progress-bar');
        const progressText = document.getElementById('pdf-progress-text');
        const progressMessage = document.getElementById('pdf-progress-message');
        
        progressModal.classList.remove('hidden');
        progressMessage.textContent = 'Generating PDF...';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        // Use the SAME HTML generation as preview (proven to work)
        const { html, reportData } = await generateReportHTML(reportId);
        
        // Update progress
        progressBar.style.width = '50%';
        progressText.textContent = '50%';
        progressMessage.textContent = 'Converting to PDF...';

        // Simple PDF conversion with optimized settings
        const options = {
            margin: 0.5,
            filename: `${reportData.studentName}_Report_${new Date().getTime()}.pdf`,
            image: { 
                type: 'jpeg', 
                quality: 0.98 
            },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#FFFFFF'
            },
            jsPDF: { 
                unit: 'in', 
                format: 'a4', 
                orientation: 'portrait'
            }
        };

        // Generate and download PDF
        await html2pdf().set(options).from(html).save();
        
        // Update progress
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        progressMessage.textContent = 'Download complete!';
        
        // Close modal after delay
        setTimeout(() => {
            progressModal.classList.add('hidden');
        }, 1000);
        
    } catch (error) {
        console.error("Error downloading report:", error);
        alert(`Error downloading report: ${error.message}`);
        document.getElementById('pdf-progress-modal').classList.add('hidden');
    } finally {
        // Restore button
        button.innerHTML = originalText;
        button.disabled = false;
    }
};

// SIMPLIFIED: Bulk download using same reliable method
window.zipAndDownloadTutorReports = async function(reports, tutorName, button) {
    const originalButtonText = button.innerHTML;
    
    try {
        // Show progress modal
        const progressModal = document.getElementById('pdf-progress-modal');
        const progressBar = document.getElementById('pdf-progress-bar');
        const progressText = document.getElementById('pdf-progress-text');
        const progressMessage = document.getElementById('pdf-progress-message');
        
        progressModal.classList.remove('hidden');
        progressMessage.textContent = `Preparing ${reports.length} reports for ${tutorName}...`;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        const zip = new JSZip();
        let processedCount = 0;

        // Process reports one at a time for reliability
        for (const report of reports) {
            try {
                // Update progress
                const progress = Math.round((processedCount / reports.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                progressMessage.textContent = `Processing report ${processedCount + 1} of ${reports.length}...`;
                button.innerHTML = `📦 Processing ${processedCount + 1}/${reports.length}`;

                // Use the SAME reliable HTML generation as preview
                const { html, reportData } = await generateReportHTML(report.id);
                
                // Convert to PDF blob
                const options = {
                    margin: 0.5,
                    image: { 
                        type: 'jpeg', 
                        quality: 0.98 
                    },
                    html2canvas: { 
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#FFFFFF'
                    },
                    jsPDF: { 
                        unit: 'in', 
                        format: 'a4', 
                        orientation: 'portrait'
                    }
                };

                const pdfBlob = await html2pdf().set(options).from(html).output('blob');
                
                // Create safe filename
                const safeStudentName = (reportData.studentName || 'Unknown_Student').replace(/[^a-z0-9]/gi, '_');
                const reportDate = reportData.submittedAt ? 
                    new Date(reportData.submittedAt.seconds * 1000).toISOString().split('T')[0] : 
                    'unknown_date';
                const filename = `${safeStudentName}_${reportDate}.pdf`;
                
                zip.file(filename, pdfBlob);
                
            } catch (error) {
                console.error(`Error processing report ${report.id}:`, error);
                // Continue with next report even if one fails
            }
            
            processedCount++;
            
            // Small delay to prevent overwhelming the browser
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Generate zip file
        progressMessage.textContent = 'Creating ZIP file...';
        progressBar.style.width = '95%';
        progressText.textContent = '95%';
        
        const zipBlob = await zip.generateAsync({ 
            type: "blob",
            compression: "DEFLATE"
        });

        // Download zip
        progressMessage.textContent = 'Download starting...';
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        saveAs(zipBlob, `${tutorName}_Reports_${new Date().toISOString().split('T')[0]}.zip`);
        
        // Close modal after short delay
        setTimeout(() => {
            progressModal.classList.add('hidden');
        }, 2000);
        
    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. Please try again.");
        document.getElementById('pdf-progress-modal').classList.add('hidden');
    } finally {
        // Restore button
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
};

// Add CSS for loading spinner
const additionalStyles = `
<style>
.loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
#pdf-progress-modal {
    backdrop-filter: blur(5px);
}
</style>
`;
// Only add styles if not already added
if (!document.querySelector('style[data-reports-panel]')) {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-reports-panel', 'true');
    styleEl.innerHTML = additionalStyles;
    document.head.appendChild(styleEl);
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

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) invalidateCache('pendingStudents');
    const listContainer = document.getElementById('pending-approvals-list');
    
    try {
        if (!sessionCache.pendingStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching pending students...</p>`;
            const snapshot = await getDocs(query(collection(db, "pending_students")));
            saveToLocalStorage('pendingStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderPendingApprovalsFromCache();
    } catch(error) {
        console.error("Error fetching pending students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (pendingStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
        return;
    }

    listContainer.innerHTML = pendingStudents.map(student => `
        <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
                <p><strong>Student:</strong> ${student.studentName}</p>
                <p><strong>Fee:</strong> ₦${(student.studentFee || 0).toFixed(2)}</p>
                <p><strong>Submitted by Tutor:</strong> ${student.tutorEmail || 'N/A'}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Edit</button>
                <button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Approve</button>
                <button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Reject</button>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.edit-pending-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));
}

// --- Summer Break Panel ---
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            <div id="break-students-list" class="space-y-4">
                <p class="text-center">Loading...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) invalidateCache('breakStudents');
    const listContainer = document.getElementById('break-students-list');

    try {
        if (!sessionCache.breakStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student break status...</p>`;
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            saveToLocalStorage('breakStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderBreakStudentsFromCache();
    } catch(error) {
        console.error("Error fetching break students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const breakStudents = sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;

    const canEndBreak = window.userData?.permissions?.actions?.canEndBreak === true;
    if (breakStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are on break.</p>`;
        return;
    }
    
    listContainer.innerHTML = breakStudents.map(student => {
        const endBreakButton = canEndBreak 
            ? `<button class="end-break-btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors" data-student-id="${student.id}">End Break</button>`
            : '';
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                <div>
                    <p><strong>Student:</strong> ${student.studentName}</p>
                    <p><strong>Tutor:</strong> ${student.tutorEmail}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-yellow-600 font-semibold px-3 py-1 bg-yellow-100 rounded-full text-sm">On Break</span>
                     ${endBreakButton}
                </div>
            </div>
        `;
    }).join('');
    if (canEndBreak) {
        document.querySelectorAll('.end-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.studentId;
                if (confirm("Are you sure you want to end the summer break for this student?")) {
                    try {
                        await updateDoc(doc(db, "students", studentId), { summerBreak: false, lastBreakEnd: Timestamp.now() });
                        document.getElementById('break-status-message').textContent = `Break ended successfully.`;
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-green-600';
                        invalidateCache('breakStudents'); // Invalidate cache
                        fetchAndRenderBreakStudents(); // Re-render list
                    } catch (error) {
                        console.error("Error ending summer break:", error);
                        document.getElementById('break-status-message').textContent = "Failed to end summer break.";
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-red-600';
                    }
                }
            });
        });
    }
}

// --- Parent Feedback Panel ---
async function renderParentFeedbackPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Parent Feedback & Requests</h2>
                <button id="refresh-feedback-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Total Messages</h4>
                    <p id="feedback-total-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Unread Messages</h4>
                    <p id="feedback-unread-count" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="parent-feedback-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading feedback messages...</p>
            </div>
        </div>
    `;
    
    document.getElementById('refresh-feedback-btn').addEventListener('click', () => fetchAndRenderParentFeedback(true));
    fetchAndRenderParentFeedback();
}

async function fetchAndRenderParentFeedback(forceRefresh = false) {
    if (forceRefresh) invalidateCache('parentFeedback');
    const listContainer = document.getElementById('parent-feedback-list');
    
    try {
        if (!sessionCache.parentFeedback) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching feedback messages...</p>`;
            
            // Get all feedback messages
            const feedbackSnapshot = await getDocs(query(collection(db, "parent_feedback"), orderBy("timestamp", "desc")));
            const feedbackData = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get all tutor submissions to find parent names
            const submissionsSnapshot = await getDocs(collection(db, "tutor_submissions"));
            const submissionsData = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Create a map of student names to parent names
            const studentParentMap = {};
            submissionsData.forEach(submission => {
                if (submission.studentName && submission.parentName) {
                    studentParentMap[submission.studentName] = submission.parentName;
                }
            });
            
            // Enhance feedback data with proper timestamps and parent names
            const enhancedFeedbackData = feedbackData.map(feedback => {
                // Convert timestamp to Firestore Timestamp format for submittedAt
                let submittedAt = feedback.submittedAt;
                if (feedback.timestamp && !submittedAt) {
                    // Convert your timestamp string to Firestore Timestamp
                    const date = new Date(feedback.timestamp);
                    submittedAt = Timestamp.fromDate(date);
                }
                
                // Get parent name from tutor submissions if available
                let parentName = feedback.parentName;
                if ((!parentName || parentName === "Unknown Parent") && feedback.studentName) {
                    parentName = studentParentMap[feedback.studentName] || feedback.parentName;
                }
                
                return {
                    ...feedback,
                    submittedAt: submittedAt || Timestamp.now(),
                    parentName: parentName || 'Unknown Parent',
                    // Ensure all required fields have defaults
                    read: feedback.read || false,
                    message: feedback.message || '',
                    parentEmail: feedback.parentEmail || '',
                    parentPhone: feedback.parentPhone || '',
                    responses: feedback.responses || [] // Initialize responses array if not exists
                };
            });
            
            saveToLocalStorage('parentFeedback', enhancedFeedbackData);
        }
        renderParentFeedbackFromCache();
    } catch(error) {
        console.error("Error fetching parent feedback:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load feedback messages.</p>`;
    }
}

function renderParentFeedbackFromCache() {
    const feedbackMessages = sessionCache.parentFeedback || [];
    const listContainer = document.getElementById('parent-feedback-list');
    if (!listContainer) return;

    if (feedbackMessages.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No feedback messages found.</p>`;
        document.getElementById('feedback-total-count').textContent = '0';
        document.getElementById('feedback-unread-count').textContent = '0';
        return;
    }

    const unreadCount = feedbackMessages.filter(msg => !msg.read).length;
    
    document.getElementById('feedback-total-count').textContent = feedbackMessages.length;
    document.getElementById('feedback-unread-count').textContent = unreadCount;

    listContainer.innerHTML = feedbackMessages.map(message => {
        // Handle both timestamp formats
        let submittedDate = 'Unknown date';
        if (message.submittedAt) {
            if (message.submittedAt.toDate) {
                // It's a Firestore Timestamp
                submittedDate = message.submittedAt.toDate().toLocaleDateString();
            } else if (message.submittedAt.seconds) {
                // It's a Timestamp object
                submittedDate = new Date(message.submittedAt.seconds * 1000).toLocaleDateString();
            } else if (message.timestamp) {
                // Use the original timestamp field
                submittedDate = new Date(message.timestamp).toLocaleDateString();
            }
        } else if (message.timestamp) {
            submittedDate = new Date(message.timestamp).toLocaleDateString();
        }
        
        const readStatus = message.read ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const readText = message.read ? 'Read' : 'Unread';

        // Display existing responses
        const responsesHTML = message.responses && message.responses.length > 0 ? `
            <div class="mt-4 border-t pt-4">
                <h4 class="font-semibold text-gray-700 mb-2">Responses:</h4>
                ${message.responses.map(response => `
                    <div class="bg-blue-50 p-3 rounded-lg mb-2">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-medium text-blue-800">${response.responderName || 'Staff'}</span>
                            <span class="text-xs text-gray-500">${new Date(response.responseDate?.seconds * 1000).toLocaleDateString()}</span>
                        </div>
                        <p class="text-gray-700 text-sm">${response.responseText}</p>
                    </div>
                `).join('')}
            </div>
        ` : '';

        return `
            <div class="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow ${message.read ? '' : 'border-l-4 border-l-yellow-500'}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-lg text-gray-800">${message.parentName || 'Anonymous Parent'}</h3>
                        <p class="text-sm text-gray-600">Student: ${message.studentName || 'N/A'}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-gray-500 block">${submittedDate}</span>
                        <span class="text-xs px-2 py-1 rounded-full ${readStatus}">${readText}</span>
                    </div>
                </div>
                
                <div class="mb-3">
                    <p class="text-gray-700 whitespace-pre-wrap">${message.message || 'No message content'}</p>
                </div>
                
                ${responsesHTML}

                <div class="flex justify-between items-center text-sm text-gray-600">
                    <div>
                        ${message.parentEmail ? `<span class="mr-3">📧 ${message.parentEmail}</span>` : ''}
                        ${message.parentPhone ? `<span>📞 ${message.parentPhone}</span>` : ''}
                    </div>
                    <div class="flex space-x-2">
                        ${!message.read ? `
                            <button class="mark-read-btn bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600" data-message-id="${message.id}">
                                Mark as Read
                            </button>
                        ` : ''}
                        <button class="respond-btn bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600" data-message-id="${message.id}">
                            Respond
                        </button>
                        <button class="delete-feedback-btn bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600" data-message-id="${message.id}">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for the buttons
    document.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMarkAsRead(e.target.dataset.messageId);
        });
    });

    document.querySelectorAll('.respond-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            showResponseModal(e.target.dataset.messageId);
        });
    });

    document.querySelectorAll('.delete-feedback-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteFeedback(e.target.dataset.messageId);
        });
    });
}

// New function to show response modal
function showResponseModal(messageId) {
    const message = sessionCache.parentFeedback?.find(msg => msg.id === messageId);
    if (!message) {
        alert("Message not found!");
        return;
    }

    const modalHtml = `
        <div id="response-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('response-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Respond to Parent Feedback</h3>
                <div class="mb-4 p-4 bg-gray-50 rounded-lg">
                    <p><strong>From:</strong> ${message.parentName || 'Anonymous Parent'}</p>
                    <p><strong>Student:</strong> ${message.studentName || 'N/A'}</p>
                    <p><strong>Message:</strong> ${message.message}</p>
                </div>
                <form id="response-form">
                    <input type="hidden" id="response-message-id" value="${messageId}">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Your Response</label>
                        <textarea id="response-text" rows="6" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Type your response here..."></textarea>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="closeManagementModal('response-modal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Send Response</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('response-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSendResponse(messageId);
    });
}

// New function to handle sending responses
async function handleSendResponse(messageId) {
    const responseText = document.getElementById('response-text').value.trim();
    const modal = document.getElementById('response-modal');
    
    if (!responseText) {
        alert("Please enter a response message.");
        return;
    }

    try {
        const messageRef = doc(db, "parent_feedback", messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (!messageDoc.exists()) {
            alert("Message not found!");
            return;
        }

        const currentData = messageDoc.data();
        const currentResponses = currentData.responses || [];
        
        const newResponse = {
            responseText: responseText,
            responderName: window.userData?.name || 'Management Staff',
            responderEmail: window.userData?.email || 'management',
            responseDate: Timestamp.now()
        };

        // Update the message with the new response
        await updateDoc(messageRef, {
            responses: [...currentResponses, newResponse],
            read: true, // Mark as read when responding
            readAt: Timestamp.now()
        });

        // Update cache
        if (sessionCache.parentFeedback) {
            const messageIndex = sessionCache.parentFeedback.findIndex(msg => msg.id === messageId);
            if (messageIndex !== -1) {
                sessionCache.parentFeedback[messageIndex].responses = [...currentResponses, newResponse];
                sessionCache.parentFeedback[messageIndex].read = true;
                saveToLocalStorage('parentFeedback', sessionCache.parentFeedback);
            }
        }

        alert("Response sent successfully!");
        modal.remove();
        renderParentFeedbackFromCache(); // Refresh the display

    } catch (error) {
        console.error("Error sending response:", error);
        alert("Failed to send response. Please try again.");
    }
}

async function handleMarkAsRead(messageId) {
    try {
        await updateDoc(doc(db, "parent_feedback", messageId), {
            read: true,
            readAt: Timestamp.now()
        });
        
        // Update cache and re-render
        if (sessionCache.parentFeedback) {
            const messageIndex = sessionCache.parentFeedback.findIndex(msg => msg.id === messageId);
            if (messageIndex !== -1) {
                sessionCache.parentFeedback[messageIndex].read = true;
                saveToLocalStorage('parentFeedback', sessionCache.parentFeedback);
            }
        }
        
        renderParentFeedbackFromCache();
    } catch (error) {
        console.error("Error marking message as read:", error);
        alert("Failed to mark message as read. Please try again.");
    }
}

async function handleDeleteFeedback(messageId) {
    if (confirm("Are you sure you want to delete this feedback message? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "parent_feedback", messageId));
            
            // Update cache and re-render
            if (sessionCache.parentFeedback) {
                sessionCache.parentFeedback = sessionCache.parentFeedback.filter(msg => msg.id !== messageId);
                saveToLocalStorage('parentFeedback', sessionCache.parentFeedback);
            }
            
            renderParentFeedbackFromCache();
        } catch (error) {
            console.error("Error deleting feedback message:", error);
            alert("Failed to delete message. Please try again.");
        }
    }
}

// ##################################
// # REPORT GENERATION & ZIPPING
// ##################################

// ##### CORRECTED AND FINALIZED FUNCTION #####
async function generateReportHTML(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    const reportData = reportDoc.data();

    // Define the sections to be displayed in the report
    const reportSections = {
        "INTRODUCTION": reportData.introduction,
        "TOPICS & REMARKS": reportData.topics,
        "PROGRESS & ACHIEVEMENTS": reportData.progress,
        "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses,
        "RECOMMENDATIONS": reportData.recommendations,
        "GENERAL TUTOR'S COMMENTS": reportData.generalComments
    };

    // Generate the HTML for each section, ensuring "N/A" for empty content
    const sectionsHTML = Object.entries(reportSections).map(([title, content]) => {
        // Sanitize content to prevent HTML injection and format newlines
        const sanitizedContent = content ? String(content).replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const displayContent = (sanitizedContent && sanitizedContent.trim() !== '') ? sanitizedContent.replace(/\n/g, '<br>') : 'N/A';
        return `
            <div class="report-section">
                <h2>${title}</h2>
                <p>${displayContent}</p>
            </div>
        `;
    }).join('');

    const logoUrl = "https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg";
    const reportTemplate = `
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
                .report-container { max-width: 800px; margin: auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 40px; }
                .header img { height: 80px; }
                .header h1 { color: #166534; margin: 0; font-size: 24px; }
                .header h2 { color: #15803d; margin: 10px 0; font-size: 28px; }
                .header p { margin: 5px 0; color: #555; }
                .student-info { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 10px 20px; 
                    margin-bottom: 30px; 
                    background-color: #f9f9f9;
                    border: 1px solid #eee;
                    padding: 15px;
                    border-radius: 8px;
                }
                .student-info p { margin: 5px 0; }
                .report-section {
                    page-break-inside: avoid; /* CRITICAL: Prevents section from splitting across pages */
                    margin-bottom: 20px;
                    border: 1px solid #e5e7eb;
                    padding: 15px;
                    border-radius: 8px;
                }
                .report-section h2 { 
                    font-size: 18px; 
                    font-weight: bold; 
                    color: #16a34a; 
                    margin-top: 0; 
                    padding-bottom: 8px;
                    border-bottom: 2px solid #d1fae5;
                }
                .report-section p { line-height: 1.6; white-space: pre-wrap; margin-top: 0; }
                .footer { text-align: right; margin-top: 40px; }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Company Logo">
                    <h2>Blooming Kids House</h2>
                    <h1>MONTHLY LEARNING REPORT</h1>
                    <p>Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <div class="student-info">
                    <p><strong>Student's Name:</strong> ${reportData.studentName || 'N/A'}</p>
                    <p><strong>Parent's Name:</strong> ${reportData.parentName || 'N/A'}</p>
                    <p><strong>Parent's Phone:</strong> ${reportData.parentPhone || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${reportData.grade || 'N/A'}</p>
                    <p><strong>Tutor's Name:</strong> ${reportData.tutorName || 'N/A'}</p>
                </div>
                ${sectionsHTML}
                <div class="footer">
                    <p>Best regards,</p>
                    <p><strong>${reportData.tutorName || 'N/A'}</strong></p>
                </div>
            </div>
        </body>
        </html>
    `;
    return { html: reportTemplate, reportData: reportData };
}

async function viewReportInNewTab(reportId, shouldDownload = false) {
    try {
        const { html, reportData } = await generateReportHTML(reportId);

        if (shouldDownload) {
             const options = {
                margin:       0.5,
                filename:     `${reportData.studentName}_report.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            html2pdf().from(html).set(options).save();
        } else {
            const newWindow = window.open();
            newWindow.document.write(html);
            newWindow.document.close();
        }
    } catch (error) {
        console.error("Error viewing/downloading report:", error);
        alert(`Error: ${error.message}`);
    }
}

async function zipAndDownloadTutorReports(reports, tutorName, buttonElement) {
    const originalButtonText = buttonElement.textContent;
    buttonElement.textContent = 'Zipping... (0%)';
    buttonElement.disabled = true;

    try {
        const zip = new JSZip();
        let filesGenerated = 0;
        const reportGenerationPromises = reports.map(async (report) => {
            const { html, reportData } = await generateReportHTML(report.id);
            // Use the same improved options for consistency
            const options = {
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            const pdfBlob = await html2pdf().from(html).set(options).output('blob');
            filesGenerated++;
            buttonElement.textContent = `Zipping... (${Math.round((filesGenerated / reports.length) * 100)}%)`;
            return { name: `${reportData.studentName}_Report_${report.id.substring(0,5)}.pdf`, blob: pdfBlob };
        });
        const generatedPdfs = await Promise.all(reportGenerationPromises);
        generatedPdfs.forEach(pdf => zip.file(pdf.name, pdf.blob));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${tutorName}_All_Reports.zip`);
    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. See console for details.");
    } finally {
        buttonElement.textContent = originalButtonText;
        buttonElement.disabled = false;
    }
}

// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

// Define all navigation items
const allNavItems = {
    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement', label: 'Tutor Directory' },
    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice', label: 'Pay Advice' },
    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports', label: 'Tutor Reports' },
    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak', label: 'Summer Break' },
    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'viewPendingApprovals', label: 'Pending Approvals' },
    navParentFeedback: { fn: renderParentFeedbackPanel, perm: 'viewParentFeedback', label: 'Parent Feedback' },
    navReferralsAdmin: { fn: renderReferralsAdminPanel, perm: 'viewReferralsAdmin', label: 'Referral Management' },
    navEnrollments: { fn: renderEnrollmentsPanel, perm: 'viewEnrollments', label: 'Enrollments' } // NEW: Added enrollments tab
};

// Global modal close function
window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (user) {
        console.log("User authenticated:", user.email);
        
        try {
            const staffDocRef = doc(db, "staff", user.email);
            const staffDocSnap = await getDoc(staffDocRef);
            
            if (staffDocSnap.exists() && staffDocSnap.data().role !== 'pending') {
                const staffData = staffDocSnap.data();
                window.userData = staffData;
                
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                // Setup navigation based on permissions
                const navContainer = document.querySelector('nav');
                if (navContainer) {
                    navContainer.innerHTML = ''; // Clear existing nav
                    
                    let firstVisibleTab = null;
                    
                    Object.entries(allNavItems).forEach(([navId, navItem]) => {
    // TEMPORARY FIX: Always show referral tab for testing
    const hasPermission = navId === 'navReferralsAdmin' || 
                        !staffData.permissions || 
                        !staffData.permissions.tabs || 
                        staffData.permissions.tabs[navItem.perm] === true;
                        
                        if (hasPermission) {
                            if (!firstVisibleTab) firstVisibleTab = navId;
                            
                            const button = document.createElement('button');
                            button.id = navId;
                            button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700 px-4 py-2 rounded-lg transition-colors';
                            button.textContent = navItem.label;
                            navContainer.appendChild(button);
                            
                            button.addEventListener('click', () => {
                                // Update active state
                                document.querySelectorAll('.nav-btn').forEach(btn => {
                                    btn.classList.remove('active', 'bg-green-100', 'text-green-700');
                                });
                                button.classList.add('active', 'bg-green-100', 'text-green-700');
                                
                                // Load the panel
                                navItem.fn(mainContent);
                            });
                        }
                    });

                    // Activate and load the first visible tab
                    if (firstVisibleTab) {
                        const firstButton = document.getElementById(firstVisibleTab);
                        if (firstButton) {
                            firstButton.classList.add('active', 'bg-green-100', 'text-green-700');
                            allNavItems[firstVisibleTab].fn(mainContent);
                        }
                    } else {
                        mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600">No accessible panels available for your role.</p>`;
                    }
                }

                // Setup logout button
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', () => {
                        signOut(auth).then(() => {
                            window.location.href = "management-auth.html";
                        });
                    });
                }
            } else {
                // User not approved or doesn't exist in staff collection
                if (mainContent) {
                    mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval or not registered in staff directory.</p>`;
                }
                if (logoutBtn) logoutBtn.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error checking staff permissions:", error);
            if (mainContent) {
                mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading dashboard. Please try again.</p>`;
            }
        }
    } else {
        // No user signed in
        window.location.href = "management-auth.html";
    }
});

// [End Updated management.js File]

