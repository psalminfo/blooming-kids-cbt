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
    referralDataMap: null,
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
async function loadReferralsAdmin(mainContent) {
    mainContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading referral tracking data...</p></div>';

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

        mainContent.innerHTML = `
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
        `;

        // Attach global functions to the window object so they can be called from onclick attributes
        window.showReferralDetailsModal = showReferralDetailsModal;
    } catch (error) {
        console.error("Error loading referral data: ", error);
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading referral data: ${error.message}</p>`;
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
        await loadReferralsAdmin(document.getElementById('main-content'));

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
        await loadReferralsAdmin(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error processing payout and reset: ", error);
        alert("Failed to process payout. Check console for details.");
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
                </div>
            </div>
            <div id="directory-content" class="mt-4">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading directory data...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('assign-student-btn').addEventListener('click', showAssignStudentModal);
    document.getElementById('directory-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterDirectory(searchTerm);
    });

    await fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false) {
    const directoryContent = document.getElementById('directory-content');
    if (!directoryContent) return;

    try {
        if (forceRefresh || !sessionCache.tutors || !sessionCache.students) {
            const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(collection(db, "tutors")),
                getDocs(collection(db, "students"))
            ]);

            sessionCache.tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sessionCache.students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('tutors', sessionCache.tutors);
            saveToLocalStorage('students', sessionCache.students);
        }

        renderDirectoryContent(sessionCache.tutors, sessionCache.students);
    } catch (error) {
        console.error("Error fetching directory data:", error);
        directoryContent.innerHTML = `<p class="text-center text-red-600">Error loading directory: ${error.message}</p>`;
    }
}

function renderDirectoryContent(tutors, students) {
    const directoryContent = document.getElementById('directory-content');
    if (!directoryContent) return;

    const tutorStudentMap = {};
    students.forEach(student => {
        if (!tutorStudentMap[student.tutorEmail]) {
            tutorStudentMap[student.tutorEmail] = [];
        }
        tutorStudentMap[student.tutorEmail].push(student);
    });

    let html = '';
    tutors.forEach(tutor => {
        const tutorStudents = tutorStudentMap[tutor.email] || [];
        const totalStudentFees = tutorStudents.reduce((sum, student) => sum + (student.studentFee || 0), 0);
        const managementFee = totalStudentFees * 0.10;
        const tutorPay = totalStudentFees - managementFee;

        html += `
            <div class="tutor-card bg-gray-50 p-4 rounded-lg mb-4 shadow-sm">
                <div class="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${tutor.name}</h3>
                        <p class="text-gray-600">${tutor.email}</p>
                        <p class="text-gray-600">${tutor.phone || 'No phone provided'}</p>
                        <p class="text-sm text-gray-500 mt-1">${tutorStudents.length} student(s)</p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-semibold text-green-700">Total Fees: ₦${totalStudentFees.toLocaleString()}</p>
                        <p class="text-sm text-gray-600">Management: ₦${managementFee.toLocaleString()}</p>
                        <p class="text-sm text-gray-600">Tutor Pay: ₦${tutorPay.toLocaleString()}</p>
                    </div>
                </div>
                ${tutorStudents.length > 0 ? `
                    <div class="mt-4">
                        <h4 class="font-semibold text-gray-700 mb-2">Students:</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full bg-white rounded-lg overflow-hidden">
                                <thead class="bg-gray-200">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Name</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Phone</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fee (₦)</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    ${tutorStudents.map(student => `
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-4 py-2">${student.studentName}</td>
                                            <td class="px-4 py-2">${student.grade}</td>
                                            <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                                            <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                                            <td class="px-4 py-2">₦${(student.studentFee || 0).toLocaleString()}</td>
                                            <td class="px-4 py-2">
                                                <button onclick="handleEditStudent('${student.id}')" class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                                                <button onclick="handleDeleteStudent('${student.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : '<p class="mt-2 text-gray-500">No students assigned.</p>'}
            </div>
        `;
    });

    directoryContent.innerHTML = html || '<p class="text-center text-gray-500">No tutors found.</p>';
}

function filterDirectory(searchTerm) {
    const tutorCards = document.querySelectorAll('.tutor-card');
    tutorCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// --- Pending Approvals Panel ---
async function renderPendingApprovalsView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-yellow-700 mb-4">Pending Student Approvals</h2>
            <div id="pending-approvals-content">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-yellow-600 font-semibold mt-4">Loading pending approvals...</p>
                </div>
            </div>
        </div>
    `;
    await fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals() {
    const content = document.getElementById('pending-approvals-content');
    if (!content) return;

    try {
        if (!sessionCache.pendingStudents) {
            const snapshot = await getDocs(collection(db, "pending_students"));
            sessionCache.pendingStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('pendingStudents', sessionCache.pendingStudents);
        }

        const pendingStudents = sessionCache.pendingStudents;
        if (pendingStudents.length === 0) {
            content.innerHTML = '<p class="text-center text-gray-500 py-8">No pending student approvals.</p>';
            return;
        }

        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Email</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Phone</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        pendingStudents.forEach(student => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">${student.studentName}</td>
                    <td class="px-4 py-2">${student.grade}</td>
                    <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                    <td class="px-4 py-2">${student.parentEmail || 'N/A'}</td>
                    <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                    <td class="px-4 py-2">
                        <button onclick="handleEditPendingStudent('${student.id}')" class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                        <button onclick="handleApproveStudent('${student.id}')" class="text-green-600 hover:text-green-900 mr-2">Approve</button>
                        <button onclick="handleRejectStudent('${student.id}')" class="text-red-600 hover:text-red-900">Reject</button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        content.innerHTML = html;
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        content.innerHTML = `<p class="text-center text-red-600">Error loading pending approvals: ${error.message}</p>`;
    }
}

// --- Pay Advice Panel ---
async function loadPayAdvice(mainContent) {
    mainContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-blue-700">Tutor Pay Advice</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <input type="search" id="pay-advice-search" placeholder="Search tutors..." class="p-2 border rounded-md w-64">
                    <button id="export-csv-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Export CSV</button>
                </div>
            </div>
            <div id="pay-advice-content">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-blue-600 font-semibold mt-4">Loading pay advice data...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('export-csv-btn').addEventListener('click', () => {
        const csvData = convertPayAdviceToCSV(currentPayData);
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pay-advice-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });

    document.getElementById('pay-advice-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterPayAdvice(searchTerm);
    });

    await fetchAndRenderPayAdvice();
}

async function fetchAndRenderPayAdvice() {
    const content = document.getElementById('pay-advice-content');
    if (!content) return;

    try {
        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(collection(db, "tutors")),
            getDocs(collection(db, "students"))
        ]);

        const tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const tutorStudentMap = {};
        students.forEach(student => {
            if (!tutorStudentMap[student.tutorEmail]) {
                tutorStudentMap[student.tutorEmail] = [];
            }
            tutorStudentMap[student.tutorEmail].push(student);
        });

        currentPayData = tutors.map(tutor => {
            const tutorStudents = tutorStudentMap[tutor.email] || [];
            const totalStudentFees = tutorStudents.reduce((sum, student) => sum + (student.studentFee || 0), 0);
            const managementFee = totalStudentFees * 0.10;
            const totalPay = totalStudentFees - managementFee;
            const giftAmount = payAdviceGifts[tutor.email] || 0;
            const finalPay = totalPay + giftAmount;

            return {
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: tutorStudents.length,
                totalStudentFees,
                managementFee,
                totalPay,
                giftAmount,
                finalPay,
                beneficiaryBank: tutor.beneficiaryBank || 'N/A',
                beneficiaryAccount: tutor.beneficiaryAccount || 'N/A',
                beneficiaryName: tutor.beneficiaryName || 'N/A'
            };
        });

        renderPayAdviceContent(currentPayData);
    } catch (error) {
        console.error("Error fetching pay advice data:", error);
        content.innerHTML = `<p class="text-center text-red-600">Error loading pay advice: ${error.message}</p>`;
    }
}

function renderPayAdviceContent(payData) {
    const content = document.getElementById('pay-advice-content');
    if (!content) return;

    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white rounded-lg overflow-hidden">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor Name</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Fees (₦)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Management Fee (₦)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Pay (₦)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gift (₦)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Final Pay (₦)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank Details</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;

    payData.forEach(item => {
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">${item.tutorName}</td>
                <td class="px-4 py-2">${item.studentCount}</td>
                <td class="px-4 py-2">₦${item.totalStudentFees.toLocaleString()}</td>
                <td class="px-4 py-2">₦${item.managementFee.toLocaleString()}</td>
                <td class="px-4 py-2">₦${item.totalPay.toLocaleString()}</td>
                <td class="px-4 py-2">
                    <input type="number" 
                           value="${payAdviceGifts[item.tutorEmail] || 0}" 
                           onchange="updateGiftAmount('${item.tutorEmail}', this.value)" 
                           class="w-20 p-1 border rounded text-sm">
                </td>
                <td class="px-4 py-2 font-bold">₦${item.finalPay.toLocaleString()}</td>
                <td class="px-4 py-2 text-sm">
                    ${item.beneficiaryBank}<br>
                    ${item.beneficiaryAccount}<br>
                    ${item.beneficiaryName}
                </td>
                <td class="px-4 py-2">
                    <button onclick="editTutorDetails('${item.tutorEmail}')" class="text-blue-600 hover:text-blue-900 text-sm">Edit Bank</button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;
    content.innerHTML = html;
}

function filterPayAdvice(searchTerm) {
    const rows = document.querySelectorAll('#pay-advice-content tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function updateGiftAmount(tutorEmail, amount) {
    payAdviceGifts[tutorEmail] = Number(amount) || 0;
    // Re-render to update final pay
    renderPayAdviceContent(currentPayData);
}

async function editTutorDetails(tutorEmail) {
    const tutors = sessionCache.tutors || [];
    const tutor = tutors.find(t => t.email === tutorEmail);
    if (!tutor) {
        alert("Tutor not found!");
        return;
    }

    const modalHtml = `
        <div id="edit-tutor-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('edit-tutor-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Edit Tutor Bank Details</h3>
                <form id="edit-tutor-form">
                    <input type="hidden" id="edit-tutor-id" value="${tutor.id}">
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Beneficiary Bank</label>
                        <input type="text" id="edit-beneficiary-bank" value="${tutor.beneficiaryBank || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Beneficiary Account</label>
                        <input type="text" id="edit-beneficiary-account" value="${tutor.beneficiaryAccount || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Beneficiary Name</label>
                        <input type="text" id="edit-beneficiary-name" value="${tutor.beneficiaryName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('edit-tutor-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('edit-tutor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const saveBtn = form.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const updatedData = {
            beneficiaryBank: form.querySelector('#edit-beneficiary-bank').value,
            beneficiaryAccount: form.querySelector('#edit-beneficiary-account').value,
            beneficiaryName: form.querySelector('#edit-beneficiary-name').value,
            lastUpdated: Timestamp.now(),
        };

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, updatedData);
            alert("Tutor bank details updated successfully!");
            closeManagementModal('edit-tutor-modal');
            invalidateCache('tutors');
            await fetchAndRenderPayAdvice();
        } catch (error) {
            console.error("Error updating tutor details: ", error);
            alert("Failed to update tutor details. Check console for details.");
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
}

// --- Tutor Reports Panel ---
async function loadTutorReports(mainContent) {
    mainContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-purple-700 mb-4">Tutor Reports</h2>
            <div id="tutor-reports-content">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-purple-600 font-semibold mt-4">Loading tutor reports...</p>
                </div>
            </div>
        </div>
    `;
    await fetchAndRenderTutorReports();
}

async function fetchAndRenderTutorReports() {
    const content = document.getElementById('tutor-reports-content');
    if (!content) return;

    try {
        if (!sessionCache.reports) {
            const snapshot = await getDocs(collection(db, "tutor_reports"));
            sessionCache.reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('reports', sessionCache.reports);
        }

        const reports = sessionCache.reports;
        if (reports.length === 0) {
            content.innerHTML = '<p class="text-center text-gray-500 py-8">No tutor reports submitted yet.</p>';
            return;
        }

        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Homework</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Behavior</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        reports.forEach(report => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">${report.tutorName}</td>
                    <td class="px-4 py-2">${report.studentName}</td>
                    <td class="px-4 py-2">${report.date ? report.date.toDate().toLocaleDateString() : 'N/A'}</td>
                    <td class="px-4 py-2">${report.progress || 'N/A'}</td>
                    <td class="px-4 py-2">${report.homework || 'N/A'}</td>
                    <td class="px-4 py-2">${report.behavior || 'N/A'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        content.innerHTML = html;
    } catch (error) {
        console.error("Error fetching tutor reports:", error);
        content.innerHTML = `<p class="text-center text-red-600">Error loading tutor reports: ${error.message}</p>`;
    }
}

// --- Break Management Panel ---
async function loadBreakManagement(mainContent) {
    mainContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-orange-700 mb-4">Summer Break Management</h2>
            <div id="break-management-content">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-orange-600 font-semibold mt-4">Loading break management data...</p>
                </div>
            </div>
        </div>
    `;
    await fetchAndRenderBreakManagement();
}

async function fetchAndRenderBreakManagement() {
    const content = document.getElementById('break-management-content');
    if (!content) return;

    try {
        if (!sessionCache.breakStudents) {
            const snapshot = await getDocs(collection(db, "students"));
            sessionCache.breakStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('breakStudents', sessionCache.breakStudents);
        }

        const students = sessionCache.breakStudents;
        let html = `
            <div class="mb-4">
                <button id="bulk-break-btn" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 mr-2">Bulk Mark for Break</button>
                <button id="bulk-resume-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Bulk Mark as Resuming</button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                <input type="checkbox" id="select-all-break">
                            </th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Name</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Break Status</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        students.forEach(student => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">
                        <input type="checkbox" class="student-checkbox" value="${student.id}">
                    </td>
                    <td class="px-4 py-2">${student.studentName}</td>
                    <td class="px-4 py-2">${student.tutorName}</td>
                    <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                    <td class="px-4 py-2">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${student.summerBreak ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">
                            ${student.summerBreak ? 'On Break' : 'Active'}
                        </span>
                    </td>
                    <td class="px-4 py-2">
                        <button onclick="toggleBreakStatus('${student.id}', ${!student.summerBreak})" class="text-blue-600 hover:text-blue-900 text-sm">
                            ${student.summerBreak ? 'Mark as Resuming' : 'Mark for Break'}
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        content.innerHTML = html;

        // Add bulk action handlers
        document.getElementById('select-all-break').addEventListener('change', function(e) {
            const checkboxes = document.querySelectorAll('.student-checkbox');
            checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
        });

        document.getElementById('bulk-break-btn').addEventListener('click', () => {
            const selectedStudents = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
            if (selectedStudents.length === 0) {
                alert("Please select at least one student.");
                return;
            }
            bulkUpdateBreakStatus(selectedStudents, true);
        });

        document.getElementById('bulk-resume-btn').addEventListener('click', () => {
            const selectedStudents = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
            if (selectedStudents.length === 0) {
                alert("Please select at least one student.");
                return;
            }
            bulkUpdateBreakStatus(selectedStudents, false);
        });
    } catch (error) {
        console.error("Error fetching break management data:", error);
        content.innerHTML = `<p class="text-center text-red-600">Error loading break management: ${error.message}</p>`;
    }
}

async function toggleBreakStatus(studentId, breakStatus) {
    try {
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            summerBreak: breakStatus,
            lastUpdated: Timestamp.now()
        });
        alert(`Student ${breakStatus ? 'marked for break' : 'marked as resuming'} successfully!`);
        invalidateCache('breakStudents');
        await fetchAndRenderBreakManagement();
    } catch (error) {
        console.error("Error updating break status:", error);
        alert("Failed to update break status. Check console for details.");
    }
}

async function bulkUpdateBreakStatus(studentIds, breakStatus) {
    try {
        const batch = writeBatch(db);
        studentIds.forEach(studentId => {
            const studentRef = doc(db, "students", studentId);
            batch.update(studentRef, {
                summerBreak: breakStatus,
                lastUpdated: Timestamp.now()
            });
        });
        await batch.commit();
        alert(`${studentIds.length} student(s) ${breakStatus ? 'marked for break' : 'marked as resuming'} successfully!`);
        invalidateCache('breakStudents');
        await fetchAndRenderBreakManagement();
    } catch (error) {
        console.error("Error bulk updating break status:", error);
        alert("Failed to update break status. Check console for details.");
    }
}

// --- Parent Feedback Panel ---
async function loadParentFeedback(mainContent) {
    mainContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-indigo-700 mb-4">Parent Feedback</h2>
            <div id="parent-feedback-content">
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-indigo-600 font-semibold mt-4">Loading parent feedback...</p>
                </div>
            </div>
        </div>
    `;
    await fetchAndRenderParentFeedback();
}

async function fetchAndRenderParentFeedback() {
    const content = document.getElementById('parent-feedback-content');
    if (!content) return;

    try {
        if (!sessionCache.parentFeedback) {
            const snapshot = await getDocs(collection(db, "parent_feedback"));
            sessionCache.parentFeedback = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('parentFeedback', sessionCache.parentFeedback);
        }

        const feedbacks = sessionCache.parentFeedback;
        if (feedbacks.length === 0) {
            content.innerHTML = '<p class="text-center text-gray-500 py-8">No parent feedback submitted yet.</p>';
            return;
        }

        let html = '';
        feedbacks.forEach(feedback => {
            html += `
                <div class="bg-gray-50 p-4 rounded-lg mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold text-gray-800">${feedback.parentName || 'Anonymous Parent'}</h3>
                        <span class="text-sm text-gray-500">${feedback.timestamp ? feedback.timestamp.toDate().toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <p class="text-gray-600 mb-2">Student: ${feedback.studentName}</p>
                    <p class="text-gray-700">${feedback.feedback}</p>
                    ${feedback.rating ? `<div class="mt-2">
                        <span class="text-yellow-600 font-semibold">Rating: ${feedback.rating}/5</span>
                    </div>` : ''}
                </div>
            `;
        });

        content.innerHTML = html;
    } catch (error) {
        console.error("Error fetching parent feedback:", error);
        content.innerHTML = `<p class="text-center text-red-600">Error loading parent feedback: ${error.message}</p>`;
    }
}

// ##################################
// # NAVIGATION & UI MANAGEMENT
// ##################################

const allNavItems = {
    'nav-tutor-directory': { label: 'Tutor Directory', fn: renderManagementTutorView },
    'nav-pending-approvals': { label: 'Pending Approvals', fn: renderPendingApprovalsView },
    'nav-pay-advice': { label: 'Pay Advice', fn: loadPayAdvice },
    'nav-tutor-reports': { label: 'Tutor Reports', fn: loadTutorReports },
    'nav-break-management': { label: 'Break Management', fn: loadBreakManagement },
    'nav-parent-feedback': { label: 'Parent Feedback', fn: loadParentFeedback },
    'nav-referrals-admin': { label: 'Referral Management', fn: loadReferralsAdmin }
};

function setupManagementNavigation() {
    const navContainer = document.getElementById('management-nav');
    if (!navContainer) return;

    let navHtml = '';
    Object.keys(allNavItems).forEach(navId => {
        navHtml += `
            <button id="${navId}" class="nav-btn bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                ${allNavItems[navId].label}
            </button>
        `;
    });

    navContainer.innerHTML = navHtml;

    // Add click handlers
    Object.keys(allNavItems).forEach(navId => {
        document.getElementById(navId).addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-green-700');
                btn.classList.add('bg-green-600');
            });
            document.getElementById(navId).classList.add('active', 'bg-green-700');
            
            // Load the corresponding view
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                allNavItems[navId].fn(mainContent);
            }
        });
    });

    // Set the first nav item as active by default and load its view
    const firstNavId = Object.keys(allNavItems)[0];
    if (firstNavId) {
        document.getElementById(firstNavId).classList.add('active', 'bg-green-700');
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            allNavItems[firstNavId].fn(mainContent);
        }
    }
}

function closeManagementModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

function initManagementDashboard() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Check if user is admin (you might want to add proper admin verification)
    console.log("Management dashboard initialized for user:", user.email);
    
    setupManagementNavigation();
    
    // Set up logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Logout error:", error);
            }
        });
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        initManagementDashboard();
    } else {
        window.location.href = 'login.html';
    }
});

// [End Updated management.js File]
