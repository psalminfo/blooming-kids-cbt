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
    enrollments: null,
    tutorAssignments: null,
    inactiveTutors: null,
    archivedStudents: null
};

/**
 * Saves a specific piece of data to localStorage.
 * @param {string} key The key for the cache (e.g., 'tutors').
 * @param {any} data The data to store.
 */
function saveToLocalStorage(key, data) {
    // Don't cache reports to avoid quota issues
    if (key === 'reports' || key === 'enrollments' || key === 'tutorAssignments') {
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
// # NEW: DASHBOARD HOME PANEL
// ##################################

/**
 * Dashboard Home Panel (REVISED)
 * Removes revenue, adds enrollments, ensures actions work.
 */
async function renderDashboardHome(container) {
    // Check permissions for Enrollments card
    const canViewEnrollments = !window.userData?.permissions?.tabs || 
                             window.userData.permissions.tabs['viewEnrollments'] === true;

    // Enrollment Card HTML (Conditional)
    const enrollmentCardHTML = canViewEnrollments ? `
        <div class="stat-card bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div class="stat-header flex justify-between items-center mb-2">
                <h3 class="stat-title text-gray-500 text-sm font-medium">Total Enrollments</h3>
                <div class="stat-icon bg-purple-100 text-purple-600 p-2 rounded-full">
                    <i class="fas fa-file-signature"></i>
                </div>
            </div>
            <p class="stat-value text-2xl font-bold text-gray-800" id="dashboard-enrollment-count">0</p>
            <p class="stat-trend trend-up text-xs text-green-600 mt-1 flex items-center">
                <i class="fas fa-check-circle mr-1"></i>
                Applications
            </p>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="content-card">
            <div class="card-header flex justify-between items-center mb-6">
                <h2 class="card-title text-2xl font-bold text-gray-800">Dashboard Overview</h2>
                <div class="card-actions">
                    <button class="btn btn-secondary bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition" onclick="window.refreshAllData()">
                        <i class="fas fa-sync-alt mr-1"></i>
                        Refresh All
                    </button>
                </div>
            </div>
            
            <div class="stats-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="stat-card bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                    <div class="stat-header flex justify-between items-center mb-2">
                        <h3 class="stat-title text-gray-500 text-sm font-medium">Active Tutors</h3>
                        <div class="stat-icon bg-green-100 text-green-600 p-2 rounded-full">
                            <i class="fas fa-chalkboard-teacher"></i>
                        </div>
                    </div>
                    <p class="stat-value text-2xl font-bold text-gray-800" id="dashboard-tutor-count">0</p>
                    <p class="stat-trend trend-up text-xs text-green-600 mt-1 flex items-center">
                        <i class="fas fa-user-check mr-1"></i>
                        Active staff
                    </p>
                </div>
                
                <div class="stat-card bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div class="stat-header flex justify-between items-center mb-2">
                        <h3 class="stat-title text-gray-500 text-sm font-medium">Active Students</h3>
                        <div class="stat-icon bg-blue-100 text-blue-600 p-2 rounded-full">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                    </div>
                    <p class="stat-value text-2xl font-bold text-gray-800" id="dashboard-student-count">0</p>
                    <p class="stat-trend trend-up text-xs text-green-600 mt-1 flex items-center">
                        <i class="fas fa-book-reader mr-1"></i>
                        Currently learning
                    </p>
                </div>
                
                <div class="stat-card bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
                    <div class="stat-header flex justify-between items-center mb-2">
                        <h3 class="stat-title text-gray-500 text-sm font-medium">Pending Approvals</h3>
                        <div class="stat-icon bg-yellow-100 text-yellow-600 p-2 rounded-full">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <p class="stat-value text-2xl font-bold text-gray-800" id="dashboard-pending-count">0</p>
                    <p class="stat-trend trend-down text-xs text-yellow-600 mt-1 flex items-center">
                        <i class="fas fa-exclamation-circle mr-1"></i>
                        Awaiting review
                    </p>
                </div>

                ${enrollmentCardHTML}
            </div>
            
            <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="content-card bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-bold mb-4 text-gray-800">Quick Actions</h3>
                    <div class="space-y-3">
                        <button class="btn btn-primary w-full flex items-center justify-start bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 transition" onclick="window.showAssignStudentModal()">
                            <i class="fas fa-user-plus mr-3"></i>
                            Assign New Student
                        </button>
                        <button class="btn btn-secondary w-full flex items-center justify-start bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600 transition" onclick="window.showReassignStudentModal()">
                            <i class="fas fa-exchange-alt mr-3"></i>
                            Reassign Student
                        </button>
                        <button class="btn btn-secondary w-full flex items-center justify-start bg-gray-500 text-white px-4 py-3 rounded hover:bg-gray-600 transition" onclick="window.fetchAndRenderDirectory(true)">
                            <i class="fas fa-sync-alt mr-3"></i>
                            Refresh Directory
                        </button>
                    </div>
                </div>
                
                <div class="content-card bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-bold mb-4 text-gray-800">Recent Reports</h3>
                    <div class="space-y-3" id="recent-activity">
                        <p class="text-gray-500 text-sm">Loading recent activity...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load dashboard data
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        // 1. Active Tutors (exclude inactive/on_leave)
        const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), where("status", "not-in", ["inactive", "on_leave"])));
        const tutorCountEl = document.getElementById('dashboard-tutor-count');
        if (tutorCountEl) tutorCountEl.textContent = tutorsSnapshot.size;
        
        // 2. Active Students (exclude archived/graduated/transferred)
        const studentsSnapshot = await getDocs(query(collection(db, "students"), where("status", "not-in", ["archived", "graduated", "transferred"])));
        const studentCountEl = document.getElementById('dashboard-student-count');
        if (studentCountEl) studentCountEl.textContent = studentsSnapshot.size;
        
        // 3. Pending Approvals
        const pendingSnapshot = await getDocs(collection(db, "pending_students"));
        const pendingCountEl = document.getElementById('dashboard-pending-count');
        if (pendingCountEl) pendingCountEl.textContent = pendingSnapshot.size;

        // 4. Enrollments (Only if element exists/permission granted)
        const enrollmentCountEl = document.getElementById('dashboard-enrollment-count');
        if (enrollmentCountEl) {
            const enrollmentsSnapshot = await getDocs(collection(db, "enrollments"));
            enrollmentCountEl.textContent = enrollmentsSnapshot.size;
        }
        
        // 5. Recent Activity (Reports)
        const recentReports = await getDocs(query(
            collection(db, "tutor_submissions"), 
            orderBy("submittedAt", "desc"), 
            limit(5)
        ));
        
        const activityContainer = document.getElementById('recent-activity');
        if (activityContainer) {
            if (recentReports.empty) {
                activityContainer.innerHTML = '<p class="text-gray-500 text-sm">No recent activity</p>';
            } else {
                activityContainer.innerHTML = recentReports.docs.map(doc => {
                    const report = doc.data();
                    const date = report.submittedAt ? 
                        new Date(report.submittedAt.seconds * 1000).toLocaleDateString() : 
                        'Unknown date';
                    return `
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                                <p class="text-sm font-medium text-gray-800">${report.studentName || 'Unknown'}</p>
                                <p class="text-xs text-gray-500">Report submitted by ${report.tutorName || 'Tutor'}</p>
                            </div>
                            <span class="text-xs text-gray-500">${date}</span>
                        </div>
                    `;
                }).join('');
            }
        }
        
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        // Fallback for UI
        ['dashboard-tutor-count', 'dashboard-student-count', 'dashboard-pending-count', 'dashboard-enrollment-count'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
    }
}

function refreshAllData() {
    // Invalidate all caches
    for (const key in sessionCache) {
        invalidateCache(key);
    }
    // Reload dashboard
    loadDashboardData();
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
            if (collectionName === 'students') {
                invalidateCache('students');
                invalidateCache('tutorAssignments');
            }
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
            createdAt: Timestamp.now(),
            tutorHistory: [{
                tutorEmail: selectedTutorData.email,
                tutorName: selectedTutorData.name,
                assignedDate: Timestamp.now(),
                assignedBy: window.userData?.email || 'management',
                isCurrent: true
            }],
            gradeHistory: [{
                grade: form.elements['assign-grade'].value,
                changedDate: Timestamp.now(),
                changedBy: window.userData?.email || 'management'
            }]
        };

        try {
            await addDoc(collection(db, "students"), newStudentData);
            alert(`Student "${newStudentData.studentName}" assigned successfully to ${newStudentData.tutorName}!`);
            closeManagementModal('assign-modal');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
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

            // Get existing tutor history
            const existingHistory = studentData.tutorHistory || [];
            
            // Mark current tutor as not current
            const updatedHistory = existingHistory.map(entry => ({
                ...entry,
                isCurrent: false
            }));
            
            // Add new tutor assignment to history
            updatedHistory.push({
                tutorEmail: newTutor,
                tutorName: selectedTutorData.name,
                assignedDate: Timestamp.now(),
                assignedBy: window.userData?.email || 'management',
                isCurrent: true,
                previousTutor: oldTutor
            });

            await updateDoc(studentRef, {
                tutorEmail: newTutor,
                tutorName: selectedTutorData.name,
                lastUpdated: Timestamp.now(),
                tutorHistory: updatedHistory
            });

            alert(`Student "${studentData.studentName}" reassigned from ${oldTutor} to ${selectedTutorData.name} successfully!`);
            closeManagementModal('reassign-modal');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
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
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            renderManagementTutorView(document.getElementById('main-content'));
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
            
            // Prepare student data with tutor history
            const studentWithHistory = {
                ...studentData,
                status: 'approved',
                tutorHistory: [{
                    tutorEmail: studentData.tutorEmail,
                    tutorName: studentData.tutorName || studentData.tutorEmail,
                    assignedDate: Timestamp.now(),
                    assignedBy: window.userData?.email || 'management',
                    isCurrent: true
                }],
                gradeHistory: [{
                    grade: studentData.grade || 'Unknown',
                    changedDate: Timestamp.now(),
                    changedBy: window.userData?.email || 'management'
                }]
            };
            
            batch.set(newStudentRef, studentWithHistory);
            batch.delete(studentRef);
            await batch.commit();
            alert("Student approved successfully!");
            invalidateCache('pendingStudents');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            renderPendingApprovalsPanel(document.getElementById('main-content'));
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
            invalidateCache('pendingStudents');
            renderPendingApprovalsPanel(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// ##################################
// # REFERRAL MANAGEMENT FUNCTIONS - FIXED
// ##################################

/**
 * Utility function to format amount to Nigerian Naira.
 */
function formatNaira(amount) {
    return `₦${(amount || 0).toLocaleString()}`;
}

/**
 * FIXED: Simple function to get parent name from parent_users collection
 */
async function getParentNameFromParentUsers(parentUid) {
    try {
        if (!parentUid) return 'Unknown Parent';
        
        const parentDoc = await getDoc(doc(db, 'parent_users', parentUid));
        if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            // Try parentName first, then name, then fallback to email
            return capitalize(parentData.parentName || parentData.name || parentData.email || 'Unknown Parent');
        }
        return 'Unknown Parent';
    } catch (error) {
        console.error("Error fetching parent name:", error);
        return 'Unknown Parent';
    }
}

/**
 * FIXED: Loads the Referral Tracking dashboard with proper parent names
 */
async function renderReferralsAdminPanel(container) {
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading referral tracking data...</p></div>';

    try {
        // 1. Fetch all parents with referral codes
        const parentsQuery = query(collection(db, 'parent_users'), where('referralCode', '!=', null));
        const parentsSnapshot = await getDocs(parentsQuery);

        const referralDataMap = {};

        // 2. Process Parents - use parentName directly from parent_users
        for (const parentDoc of parentsSnapshot.docs) {
            const data = parentDoc.data();
            const parentUid = parentDoc.id;
            
            // Get parent name from parent_users collection directly
            const parentName = capitalize(data.parentName || data.name || data.email || 'Unknown Parent');
            
            referralDataMap[parentUid] = {
                uid: parentUid,
                name: parentName,
                email: data.email || 'N/A',
                referralCode: data.referralCode || 'N/A',
                referralEarnings: data.referralEarnings || 0,
                bankName: data.bankName || 'N/A',
                accountNumber: data.accountNumber || 'N/A',
                totalReferrals: 0,
                pendingReferrals: 0,
                approvedReferrals: 0,
                paidReferrals: 0,
                transactions: []
            };
        }

        // 3. Fetch transactions to count referrals
        const transactionsSnapshot = await getDocs(collection(db, 'referral_transactions'));
        
        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            const ownerUid = data.ownerUid;
            if (referralDataMap[ownerUid]) {
                const parentData = referralDataMap[ownerUid];
                parentData.totalReferrals++;
                parentData.transactions.push({
                    id: doc.id,
                    ...data,
                    refereeJoinDate: data.refereeJoinDate ? data.refereeJoinDate.toDate().toLocaleDateString() : 'N/A'
                });

                const status = data.status || 'pending';
                if (status === 'pending') parentData.pendingReferrals++;
                else if (status === 'approved') parentData.approvedReferrals++;
                else if (status === 'paid') parentData.paidReferrals++;
            }
        });

        // Store in cache
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
                        <td class="px-6 py-4">
                            <span class="font-mono bg-gray-100 px-2 py-1 rounded">${parent.referralCode}</span>
                        </td>
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
// # ENROLLMENT MANAGEMENT PANEL
// ##################################

// Function to fetch tutor assignment history for students
async function fetchTutorAssignmentHistory() {
    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const tutorAssignments = {};
        
        studentsSnapshot.docs.forEach(doc => {
            const studentData = doc.data();
            const studentId = doc.id;
            
            if (studentData.tutorHistory && Array.isArray(studentData.tutorHistory)) {
                tutorAssignments[studentId] = {
                    studentName: studentData.studentName,
                    currentTutor: studentData.tutorEmail,
                    currentTutorName: studentData.tutorName,
                    tutorHistory: studentData.tutorHistory.sort((a, b) => {
                        const dateA = a.assignedDate?.toDate?.() || new Date(0);
                        const dateB = b.assignedDate?.toDate?.() || new Date(0);
                        return dateB - dateA;
                    }),
                    gradeHistory: studentData.gradeHistory || []
                };
            } else if (studentData.tutorEmail) {
                // Legacy data: create history from current tutor
                tutorAssignments[studentId] = {
                    studentName: studentData.studentName,
                    currentTutor: studentData.tutorEmail,
                    currentTutorName: studentData.tutorName,
                    tutorHistory: [{
                        tutorEmail: studentData.tutorEmail,
                        tutorName: studentData.tutorName || studentData.tutorEmail,
                        assignedDate: studentData.createdAt || Timestamp.now(),
                        assignedBy: 'system',
                        isCurrent: true
                    }],
                    gradeHistory: studentData.gradeHistory || [{
                        grade: studentData.grade || 'Unknown',
                        changedDate: studentData.createdAt || Timestamp.now(),
                        changedBy: 'system'
                    }]
                };
            }
        });
        
        saveToLocalStorage('tutorAssignments', tutorAssignments);
        return tutorAssignments;
    } catch (error) {
        console.error("Error fetching tutor assignment history:", error);
        return {};
    }
}

// Function to display tutor history for a student
function showTutorHistoryModal(studentId, studentData, tutorAssignments) {
    const studentHistory = tutorAssignments[studentId];
    if (!studentHistory) {
        alert("No tutor history found for this student.");
        return;
    }

    const tutorHistoryHTML = studentHistory.tutorHistory.map((assignment, index) => {
        const assignedDate = assignment.assignedDate?.toDate?.() || new Date();
        const isCurrent = assignment.isCurrent ? '<span class="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Current</span>' : '';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">${index + 1}</td>
                <td class="px-4 py-3 font-medium">${assignment.tutorName || assignment.tutorEmail}</td>
                <td class="px-4 py-3">${assignment.tutorEmail}</td>
                <td class="px-4 py-3">${assignedDate.toLocaleDateString()}</td>
                <td class="px-4 py-3">${assignment.assignedBy || 'System'}</td>
                <td class="px-4 py-3">${isCurrent}</td>
            </tr>
        `;
    }).join('');

    const gradeHistoryHTML = studentHistory.gradeHistory.map((gradeChange, index) => {
        const changedDate = gradeChange.changedDate?.toDate?.() || new Date();
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">${index + 1}</td>
                <td class="px-4 py-3 font-medium">${gradeChange.grade}</td>
                <td class="px-4 py-3">${changedDate.toLocaleDateString()}</td>
                <td class="px-4 py-3">${gradeChange.changedBy || 'System'}</td>
            </tr>
        `;
    }).join('');

    const modalHtml = `
        <div id="tutorHistoryModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-6xl rounded-lg shadow-2xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('tutorHistoryModal')">&times;</button>
                <h3 class="text-2xl font-bold mb-4 text-blue-700">Tutor & Grade History for ${studentData.studentName}</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-bold text-lg mb-2 text-blue-800">Current Information</h4>
                        <p><strong>Tutor:</strong> ${studentData.tutorName || studentData.tutorEmail}</p>
                        <p><strong>Grade:</strong> ${studentData.grade || 'N/A'}</p>
                        <p><strong>Subjects:</strong> ${Array.isArray(studentData.subjects) ? studentData.subjects.join(', ') : studentData.subjects || 'N/A'}</p>
                        <p><strong>Days/Week:</strong> ${studentData.days || 'N/A'}</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h4 class="font-bold text-lg mb-2 text-green-800">Parent Information</h4>
                        <p><strong>Parent:</strong> ${studentData.parentName || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${studentData.parentPhone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${studentData.parentEmail || 'N/A'}</p>
                        <p><strong>Fee:</strong> ₦${(studentData.studentFee || 0).toLocaleString()}</p>
                    </div>
                </div>
                
                <div class="mb-8">
                    <h4 class="text-xl font-bold mb-4 text-gray-800">Tutor Assignment History</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor Name</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor Email</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned By</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${tutorHistoryHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div>
                    <h4 class="text-xl font-bold mb-4 text-gray-800">Grade Progression History</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Changed Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Changed By</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${gradeHistoryHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="flex justify-end mt-6 pt-6 border-t">
                    <button onclick="closeManagementModal('tutorHistoryModal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Enrollment panel
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
        
        // Total fee
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

// Global function to view tutor history for a specific student
window.viewStudentTutorHistory = function(studentId) {
    const tutorAssignments = sessionCache.tutorAssignments || {};
    const students = sessionCache.students || [];
    
    const student = students.find(s => s.id === studentId);
    if (!student) {
        alert("Student not found!");
        return;
    }
    
    showTutorHistoryModal(studentId, student, tutorAssignments);
};

// ##################################
// # NEW: INACTIVE TUTORS PANEL
// ##################################

async function renderInactiveTutorsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-700">Inactive Tutors</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="inactive-search" placeholder="Search inactive tutors..." class="p-2 border rounded-md w-64">
                    <button id="refresh-inactive-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="mark-inactive-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Mark Tutor as Inactive</button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-gray-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-gray-800 text-sm">Total Inactive Tutors</h4>
                    <p id="inactive-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Active Tutors</h4>
                    <p id="active-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">On Leave</h4>
                    <p id="leave-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>

            <div id="inactive-tutors-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading inactive tutors...</p>
            </div>
        </div>
    `;
    
    document.getElementById('refresh-inactive-btn').addEventListener('click', () => fetchAndRenderInactiveTutors(true));
    document.getElementById('inactive-search').addEventListener('input', (e) => renderInactiveTutorsFromCache(e.target.value));
    document.getElementById('mark-inactive-btn').addEventListener('click', showMarkInactiveModal);
    
    fetchAndRenderInactiveTutors();
}

async function fetchAndRenderInactiveTutors(forceRefresh = false) {
    if (forceRefresh) invalidateCache('inactiveTutors');
    
    const listContainer = document.getElementById('inactive-tutors-list');
    if (!listContainer) return;
    
    try {
        if (!sessionCache.inactiveTutors) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching tutor data...</p>`;
            
            // Fetch all tutors
            const tutorsSnapshot = await getDocs(collection(db, "tutors"));
            const allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Categorize tutors by status
            const inactiveTutors = allTutors.filter(tutor => tutor.status === 'inactive' || tutor.status === 'on_leave');
            const activeTutors = allTutors.filter(tutor => !tutor.status || tutor.status === 'active');
            
            saveToLocalStorage('inactiveTutors', inactiveTutors);
            
            // Update counts
            document.getElementById('inactive-count-badge').textContent = inactiveTutors.filter(t => t.status === 'inactive').length;
            document.getElementById('active-count-badge').textContent = activeTutors.length;
            document.getElementById('leave-count-badge').textContent = inactiveTutors.filter(t => t.status === 'on_leave').length;
        }
        
        renderInactiveTutorsFromCache();
    } catch (error) {
        console.error("Error fetching inactive tutors:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderInactiveTutorsFromCache(searchTerm = '') {
    const inactiveTutors = sessionCache.inactiveTutors || [];
    const listContainer = document.getElementById('inactive-tutors-list');
    if (!listContainer) return;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredTutors = inactiveTutors.filter(tutor => 
        tutor.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        tutor.email.toLowerCase().includes(lowerCaseSearchTerm)
    );
    
    if (filteredTutors.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">${searchTerm ? 'No matching inactive tutors found.' : 'No inactive tutors found.'}</p>`;
        return;
    }
    
    listContainer.innerHTML = filteredTutors.map(tutor => {
        const statusBadge = tutor.status === 'inactive' 
            ? '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Inactive</span>'
            : '<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">On Leave</span>';
        
        const inactiveDate = tutor.inactiveDate ? new Date(tutor.inactiveDate.seconds * 1000).toLocaleDateString() : 'Unknown';
        
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                <div class="flex-1">
                    <h3 class="font-bold text-lg text-gray-800">${tutor.name}</h3>
                    <p class="text-gray-600">${tutor.email}</p>
                    <div class="mt-2 flex items-center space-x-4 text-sm">
                        <span>${statusBadge}</span>
                        <span class="text-gray-500">Inactive since: ${inactiveDate}</span>
                        ${tutor.inactiveReason ? `<span class="text-gray-500">Reason: ${tutor.inactiveReason}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="reactivate-btn bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600" data-tutor-id="${tutor.id}">Reactivate</button>
                    <button class="view-history-btn bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">View History</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    document.querySelectorAll('.reactivate-btn').forEach(button => {
        button.addEventListener('click', (e) => handleReactivateTutor(e.target.dataset.tutorId));
    });
    
    document.querySelectorAll('.view-history-btn').forEach(button => {
        button.addEventListener('click', (e) => showTutorHistory(e.target.dataset.tutorId));
    });
}

function showMarkInactiveModal() {
    const activeTutors = sessionCache.tutors || [];
    const inactiveTutors = sessionCache.inactiveTutors || [];
    const activeTutorsFiltered = activeTutors.filter(tutor => 
        !inactiveTutors.find(inactive => inactive.id === tutor.id)
    );
    
    if (activeTutorsFiltered.length === 0) {
        alert("No active tutors available to mark as inactive.");
        return;
    }
    
    const tutorOptions = activeTutorsFiltered
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => `<option value="${tutor.id}">${tutor.name} (${tutor.email})</option>`)
        .join('');
    
    const modalHtml = `
        <div id="mark-inactive-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('mark-inactive-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Mark Tutor as Inactive</h3>
                <form id="mark-inactive-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Select Tutor</label>
                        <select id="inactive-tutor-select" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="" disabled selected>Select a tutor...</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Status</label>
                        <select id="inactive-status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="inactive">Inactive (no longer working)</option>
                            <option value="on_leave">On Leave (temporary)</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Reason (optional)</label>
                        <textarea id="inactive-reason" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="Reason for inactivity..."></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Effective Date</label>
                        <input type="date" id="inactive-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('mark-inactive-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Mark as Inactive</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('mark-inactive-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const tutorId = form.elements['inactive-tutor-select'].value;
        const status = form.elements['inactive-status'].value;
        const reason = form.elements['inactive-reason'].value;
        const date = form.elements['inactive-date'].value;
        
        try {
            await updateDoc(doc(db, "tutors", tutorId), {
                status: status,
                inactiveReason: reason || '',
                inactiveDate: Timestamp.fromDate(new Date(date)),
                lastUpdated: Timestamp.now()
            });
            
            alert("Tutor marked as inactive successfully!");
            closeManagementModal('mark-inactive-modal');
            invalidateCache('inactiveTutors');
            invalidateCache('tutors');
            fetchAndRenderInactiveTutors(true);
            
        } catch (error) {
            console.error("Error marking tutor as inactive:", error);
            alert("Failed to mark tutor as inactive. Please try again.");
        }
    });
}

async function handleReactivateTutor(tutorId) {
    if (confirm("Are you sure you want to reactivate this tutor?")) {
        try {
            await updateDoc(doc(db, "tutors", tutorId), {
                status: 'active',
                reactivatedDate: Timestamp.now(),
                lastUpdated: Timestamp.now()
            });
            
            alert("Tutor reactivated successfully!");
            invalidateCache('inactiveTutors');
            invalidateCache('tutors');
            fetchAndRenderInactiveTutors(true);
            
        } catch (error) {
            console.error("Error reactivating tutor:", error);
            alert("Failed to reactivate tutor. Please try again.");
        }
    }
}

async function showTutorHistory(tutorId) {
    try {
        // Fetch tutor's students
        const studentsSnapshot = await getDocs(query(collection(db, "students"), where("tutorEmail", "==", tutorId)));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch tutor's reports
        const reportsSnapshot = await getDocs(query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorId)));
        const reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tutorDoc = await getDoc(doc(db, "tutors", tutorId));
        const tutorData = tutorDoc.data();
        
        const studentsHTML = students.map(student => `
            <div class="border rounded p-3 mb-2">
                <p><strong>${student.studentName}</strong> (Grade: ${student.grade})</p>
                <p class="text-sm text-gray-600">Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                ${student.tutorHistory ? `<p class="text-xs text-gray-500">Assigned: ${student.tutorHistory[0]?.assignedDate?.toDate?.().toLocaleDateString() || 'Unknown'}</p>` : ''}
            </div>
        `).join('');
        
        const reportsHTML = reports.slice(0, 10).map(report => `
            <div class="border rounded p-2 mb-2">
                <p class="text-sm"><strong>${report.studentName}</strong> - ${report.submittedAt?.toDate?.().toLocaleDateString() || 'Unknown date'}</p>
                <p class="text-xs text-gray-600 truncate">${(report.topics || '').substring(0, 100)}...</p>
            </div>
        `).join('');
        
        const modalHtml = `
            <div id="tutor-history-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-2xl">
                    <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('tutor-history-modal')">&times;</button>
                    <h3 class="text-2xl font-bold mb-4">Tutor History: ${tutorData.name}</h3>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <h4 class="font-bold text-lg mb-3">Assigned Students (${students.length})</h4>
                            ${studentsHTML || '<p class="text-gray-500">No students assigned.</p>'}
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-3">Recent Reports (${reports.length})</h4>
                            ${reportsHTML || '<p class="text-gray-500">No reports submitted.</p>'}
                        </div>
                    </div>
                    
                    <div class="mt-6 pt-6 border-t">
                        <div class="grid grid-cols-3 gap-4">
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Total Students</p>
                                <p class="text-2xl font-bold">${students.length}</p>
                            </div>
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Total Reports</p>
                                <p class="text-2xl font-bold">${reports.length}</p>
                            </div>
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Status</p>
                                <p class="text-lg font-bold ${tutorData.status === 'inactive' ? 'text-red-600' : 'text-yellow-600'}">${capitalize(tutorData.status || 'active')}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end mt-6">
                        <button onclick="closeManagementModal('tutor-history-modal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error("Error showing tutor history:", error);
        alert("Failed to load tutor history. Please try again.");
    }
}

// ##################################
// # NEW: ARCHIVED STUDENTS PANEL
// ##################################

async function renderArchivedStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-700">Archived Students</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="archived-search" placeholder="Search archived students..." class="p-2 border rounded-md w-64">
                    <button id="refresh-archived-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="archive-student-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Archive Student</button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-gray-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-gray-800 text-sm">Total Archived</h4>
                    <p id="archived-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Active Students</h4>
                    <p id="active-students-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Graduated</h4>
                    <p id="graduated-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-blue-800 text-sm">Transferred</h4>
                    <p id="transferred-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>

            <div id="archived-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading archived students...</p>
            </div>
        </div>
    `;
    
    document.getElementById('refresh-archived-btn').addEventListener('click', () => fetchAndRenderArchivedStudents(true));
    document.getElementById('archived-search').addEventListener('input', (e) => renderArchivedStudentsFromCache(e.target.value));
    document.getElementById('archive-student-btn').addEventListener('click', showArchiveStudentModal);
    
    fetchAndRenderArchivedStudents();
}

async function fetchAndRenderArchivedStudents(forceRefresh = false) {
    if (forceRefresh) invalidateCache('archivedStudents');
    
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    try {
        if (!sessionCache.archivedStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student data...</p>`;
            
            // Fetch all students
            const studentsSnapshot = await getDocs(collection(db, "students"));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Categorize students by status
            const archivedStudents = allStudents.filter(student => student.status === 'archived' || student.status === 'graduated' || student.status === 'transferred');
            const activeStudents = allStudents.filter(student => !student.status || student.status === 'active');
            
            saveToLocalStorage('archivedStudents', archivedStudents);
            
            // Update counts
            const archivedCount = archivedStudents.filter(s => s.status === 'archived').length;
            const graduatedCount = archivedStudents.filter(s => s.status === 'graduated').length;
            const transferredCount = archivedStudents.filter(s => s.status === 'transferred').length;
            
            document.getElementById('archived-count-badge').textContent = archivedCount;
            document.getElementById('active-students-badge').textContent = activeStudents.length;
            document.getElementById('graduated-count-badge').textContent = graduatedCount;
            document.getElementById('transferred-count-badge').textContent = transferredCount;
        }
        
        renderArchivedStudentsFromCache();
    } catch (error) {
        console.error("Error fetching archived students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderArchivedStudentsFromCache(searchTerm = '') {
    const archivedStudents = sessionCache.archivedStudents || [];
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredStudents = archivedStudents.filter(student => 
        student.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
        student.parentName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        student.tutorEmail?.toLowerCase().includes(lowerCaseSearchTerm)
    );
    
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">${searchTerm ? 'No matching archived students found.' : 'No archived students found.'}</p>`;
        return;
    }
    
    listContainer.innerHTML = filteredStudents.map(student => {
        let statusBadge = '';
        let statusColor = '';
        
        switch(student.status) {
            case 'archived':
                statusBadge = 'Archived';
                statusColor = 'bg-gray-100 text-gray-800';
                break;
            case 'graduated':
                statusBadge = 'Graduated';
                statusColor = 'bg-green-100 text-green-800';
                break;
            case 'transferred':
                statusBadge = 'Transferred';
                statusColor = 'bg-blue-100 text-blue-800';
                break;
            default:
                statusBadge = 'Archived';
                statusColor = 'bg-gray-100 text-gray-800';
        }
        
        const archivedDate = student.archivedDate ? new Date(student.archivedDate.seconds * 1000).toLocaleDateString() : 'Unknown';
        const lastTutor = student.tutorHistory?.[student.tutorHistory.length - 1]?.tutorName || student.tutorName || 'Unknown';
        
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                <div class="flex-1">
                    <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                    <div class="grid grid-cols-3 gap-4 mt-2 text-sm">
                        <div>
                            <p class="text-gray-600">Parent: ${student.parentName || 'N/A'}</p>
                            <p class="text-gray-600">Last Tutor: ${lastTutor}</p>
                        </div>
                        <div>
                            <p class="text-gray-600">Grade: ${student.grade || 'N/A'}</p>
                            <p class="text-gray-600">Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p class="text-gray-600">Archived: ${archivedDate}</p>
                            <p><span class="px-2 py-1 text-xs rounded-full ${statusColor}">${statusBadge}</span></p>
                        </div>
                    </div>
                    ${student.archivedReason ? `<p class="text-sm text-gray-500 mt-2">Reason: ${student.archivedReason}</p>` : ''}
                </div>
                <div class="flex items-center space-x-2">
                    <button class="restore-student-btn bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600" data-student-id="${student.id}">Restore</button>
                    <button class="view-student-history-btn bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600" data-student-id="${student.id}">View History</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    document.querySelectorAll('.restore-student-btn').forEach(button => {
        button.addEventListener('click', (e) => handleRestoreStudent(e.target.dataset.studentId));
    });
    
    document.querySelectorAll('.view-student-history-btn').forEach(button => {
        button.addEventListener('click', (e) => window.viewStudentTutorHistory(e.target.dataset.studentId));
    });
}

function showArchiveStudentModal() {
    const activeStudents = sessionCache.students || [];
    const archivedStudents = sessionCache.archivedStudents || [];
    const activeStudentsFiltered = activeStudents.filter(student => 
        !archivedStudents.find(archived => archived.id === student.id)
    );
    
    if (activeStudentsFiltered.length === 0) {
        alert("No active students available to archive.");
        return;
    }
    
    const studentOptions = activeStudentsFiltered
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
        .map(student => `<option value="${student.id}">${student.studentName} (${student.grade || 'No grade'}) - Tutor: ${student.tutorName || student.tutorEmail}</option>`)
        .join('');
    
    const modalHtml = `
        <div id="archive-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('archive-student-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Archive Student</h3>
                <form id="archive-student-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Select Student</label>
                        <select id="archive-student-select" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="" disabled selected>Select a student...</option>
                            ${studentOptions}
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Archive Status</label>
                        <select id="archive-status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="archived">Archived (no longer with company)</option>
                            <option value="graduated">Graduated (completed program)</option>
                            <option value="transferred">Transferred (moved to another tutor/company)</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Reason (optional)</label>
                        <textarea id="archive-reason" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="Reason for archiving..."></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Effective Date</label>
                        <input type="date" id="archive-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('archive-student-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Archive Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('archive-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const studentId = form.elements['archive-student-select'].value;
        const status = form.elements['archive-status'].value;
        const reason = form.elements['archive-reason'].value;
        const date = form.elements['archive-date'].value;
        
        try {
            await updateDoc(doc(db, "students", studentId), {
                status: status,
                archivedReason: reason || '',
                archivedDate: Timestamp.fromDate(new Date(date)),
                archivedBy: window.userData?.email || 'management',
                lastUpdated: Timestamp.now()
            });
            
            alert("Student archived successfully!");
            closeManagementModal('archive-student-modal');
            invalidateCache('archivedStudents');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            fetchAndRenderArchivedStudents(true);
            
        } catch (error) {
            console.error("Error archiving student:", error);
            alert("Failed to archive student. Please try again.");
        }
    });
}

async function handleRestoreStudent(studentId) {
    if (confirm("Are you sure you want to restore this student to active status?")) {
        try {
            await updateDoc(doc(db, "students", studentId), {
                status: 'active',
                restoredDate: Timestamp.now(),
                restoredBy: window.userData?.email || 'management',
                lastUpdated: Timestamp.now()
            });
            
            alert("Student restored successfully!");
            invalidateCache('archivedStudents');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            fetchAndRenderArchivedStudents(true);
            
        } catch (error) {
            console.error("Error restoring student:", error);
            alert("Failed to restore student. Please try again.");
        }
    }
}

// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

// Define all navigation items
const allNavItems = {
    navDashboard: { fn: renderDashboardHome, perm: 'viewDashboard', label: 'Dashboard Home' },
    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement', label: 'Tutor Directory' },
    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice', label: 'Pay Advice' },
    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports', label: 'Tutor Reports' },
    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak', label: 'Summer Break' },
    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'viewPendingApprovals', label: 'Pending Approvals' },
    navParentFeedback: { fn: renderParentFeedbackPanel, perm: 'viewParentFeedback', label: 'Parent Feedback' },
    navReferralsAdmin: { fn: renderReferralsAdminPanel, perm: 'viewReferralsAdmin', label: 'Referral Management' },
    navEnrollments: { fn: renderEnrollmentsPanel, perm: 'viewEnrollments', label: 'Enrollments' },
    navInactiveTutors: { fn: renderInactiveTutorsPanel, perm: 'viewInactiveTutors', label: 'Inactive Tutors' },
    navArchivedStudents: { fn: renderArchivedStudentsPanel, perm: 'viewArchivedStudents', label: 'Archived Students' }
};

// Global modal close function
window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

// EXPOSE FUNCTIONS TO WINDOW FOR DASHBOARD
window.refreshAllData = refreshAllData;
window.showAssignStudentModal = showAssignStudentModal;
window.showReassignStudentModal = showReassignStudentModal;
window.fetchAndRenderDirectory = fetchAndRenderDirectory;
window.renderDashboardHome = renderDashboardHome;

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
                    navContainer.innerHTML = '';
                    
                    let firstVisibleTab = null;
                    
                    Object.entries(allNavItems).forEach(([navId, navItem]) => {
                        // Dashboard is always viewable if not explicitly denied, other permissions checked as normal
                        const hasPermission = navId === 'navDashboard' || 
                                            navId === 'navReferralsAdmin' || 
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
