import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc, limit, startAfter } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ======================================================
// SECTION 1: CACHE MANAGEMENT
// ======================================================

const CACHE_PREFIX = 'management_cache_';

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

function saveToLocalStorage(key, data) {
    if (key === 'reports' || key === 'enrollments' || key === 'tutorAssignments') {
        sessionCache[key] = data;
        return;
    }
    
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        sessionCache[key] = data;
    } catch (error) {
        console.error("Could not save to localStorage:", error);
    }
}

function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const storedData = localStorage.getItem(CACHE_PREFIX + key);
            if (storedData) {
                sessionCache[key] = JSON.parse(storedData);
            }
        } catch (error) {
            console.error(`Could not load '${key}' from localStorage:`, error);
            localStorage.removeItem(CACHE_PREFIX + key);
        }
    }
}

function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}

loadFromLocalStorage();

let payAdviceGifts = {};
let currentPayData = [];
let reportsLastVisible = null;
let reportsFirstVisible = null;
let currentReportsPage = 1;

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function formatNaira(amount) {
    return `₦${(amount || 0).toLocaleString()}`;
}

// ======================================================
// SECTION 2: DASHBOARD PANEL
// ======================================================

async function renderDashboardPanel(container) {
    // Get user permissions
    const userPermissions = window.userData?.permissions?.tabs || {};
    
    // Determine which cards to show based on permissions
    const showTutorsCard = userPermissions.viewTutorManagement === true;
    const showStudentsCard = userPermissions.viewTutorManagement === true;
    const showPendingCard = userPermissions.viewPendingApprovals === true;
    const showEnrollmentsCard = userPermissions.viewEnrollments === true;
    
    // Count how many cards we'll show (for grid layout)
    const visibleCardsCount = [showTutorsCard, showStudentsCard, showPendingCard, showEnrollmentsCard]
        .filter(Boolean).length;
    
    // Determine grid columns based on visible cards
    let gridCols = 'grid-cols-1';
    if (visibleCardsCount === 2) gridCols = 'md:grid-cols-2';
    else if (visibleCardsCount === 3) gridCols = 'md:grid-cols-3 lg:grid-cols-3';
    else if (visibleCardsCount >= 4) gridCols = 'md:grid-cols-2 lg:grid-cols-4';
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-6">Management Dashboard</h2>
            
            <div class="grid ${gridCols} gap-6 mb-8">
                <!-- Active Tutors Card (only if user has permission) -->
                ${showTutorsCard ? `
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-chalkboard-teacher text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-blue-800">Active Tutors</h3>
                            <p class="text-sm text-blue-600">Tutors with 'active' status</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-active-tutors" class="text-4xl font-bold text-blue-700 mb-2">0</p>
                    </div>
                </div>
                ` : ''}

                <!-- Active Students Card (only if user has permission) -->
                ${showStudentsCard ? `
                <div class="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-user-graduate text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-green-800">Active Students</h3>
                            <p class="text-sm text-green-600">Students with 'active' status</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-active-students" class="text-4xl font-bold text-green-700 mb-2">0</p>
                    </div>
                </div>
                ` : ''}

                <!-- Pending Approvals Card (only if user has permission) -->
                ${showPendingCard ? `
                <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-user-clock text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-yellow-800">Pending Approvals</h3>
                            <p class="text-sm text-yellow-600">Awaiting student applications</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-pending-approvals" class="text-4xl font-bold text-yellow-700 mb-2">0</p>
                    </div>
                </div>
                ` : ''}

                <!-- Total Enrollments Card (only if user has permission) -->
                ${showEnrollmentsCard ? `
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-file-signature text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-purple-800">Total Enrollments</h3>
                            <p class="text-sm text-purple-600">All enrollment applications</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-total-enrollments" class="text-4xl font-bold text-purple-700 mb-2">0</p>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Show message if no cards are visible -->
            ${visibleCardsCount === 0 ? `
                <div class="text-center py-8 bg-gray-50 rounded-lg border">
                    <i class="fas fa-chart-bar text-gray-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-600 mb-2">No Dashboard Access</h3>
                    <p class="text-gray-500">You don't have permission to view any dashboard metrics.</p>
                    <p class="text-sm text-gray-400 mt-2">Contact an administrator for access.</p>
                </div>
            ` : ''}

            <!-- Quick Actions Section (only if user has Tutor Management permission) -->
            ${showTutorsCard ? `
            <div class="mt-8 p-6 bg-gray-50 rounded-xl border">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button id="quick-action-assign" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center">
                        <i class="fas fa-user-plus mr-2"></i> Assign New Student
                    </button>
                    <button id="quick-action-archive" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg flex items-center justify-center">
                        <i class="fas fa-archive mr-2"></i> Archive Student
                    </button>
                    <button id="quick-action-inactive" class="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg flex items-center justify-center">
                        <i class="fas fa-user-slash mr-2"></i> Mark Tutor Inactive
                    </button>
                </div>
            </div>
            ` : ''}

            <!-- Last Updated Info (only if at least one card is visible) -->
            ${visibleCardsCount > 0 ? `
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Data loaded from cache.</p>
                <button onclick="refreshAllDashboardData()" class="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium">
                    <i class="fas fa-sync-alt mr-1"></i> Refresh All Data
                </button>
            </div>
            ` : ''}
        </div>
    `;

    // Add event listeners for quick actions
    if (showTutorsCard) {
        document.getElementById('quick-action-assign')?.addEventListener('click', showAssignStudentModal);
        document.getElementById('quick-action-archive')?.addEventListener('click', showArchiveStudentModal);
        document.getElementById('quick-action-inactive')?.addEventListener('click', showMarkInactiveModal);
    }

    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const userPermissions = window.userData?.permissions?.tabs || {};
        
        // Load Active Tutors count (only if user has permission)
        if (userPermissions.viewTutorManagement === true) {
            if (!sessionCache.tutors) {
                const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
                const allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const activeTutors = allTutors.filter(tutor => 
                    !tutor.status || tutor.status === 'active'
                );
                saveToLocalStorage('tutors', activeTutors);
            }
            const activeTutorsCount = (sessionCache.tutors || []).length;
            const tutorsElement = document.getElementById('dashboard-active-tutors');
            if (tutorsElement) tutorsElement.textContent = activeTutorsCount;
        }

        // Load Active Students count (only if user has permission)
        if (userPermissions.viewTutorManagement === true) {
            if (!sessionCache.students) {
                const studentsSnapshot = await getDocs(query(collection(db, "students")));
                const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const activeStudents = allStudents.filter(student => 
                    !student.status || student.status === 'active' || student.status === 'approved'
                );
                saveToLocalStorage('students', activeStudents);
            }
            const activeStudentsCount = (sessionCache.students || []).length;
            const studentsElement = document.getElementById('dashboard-active-students');
            if (studentsElement) studentsElement.textContent = activeStudentsCount;
        }

        // Load Pending Approvals count (only if user has permission)
        if (userPermissions.viewPendingApprovals === true) {
            if (!sessionCache.pendingStudents) {
                const pendingSnapshot = await getDocs(query(collection(db, "pending_students")));
                const pendingStudents = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                saveToLocalStorage('pendingStudents', pendingStudents);
            }
            const pendingApprovalsCount = (sessionCache.pendingStudents || []).length;
            const pendingElement = document.getElementById('dashboard-pending-approvals');
            if (pendingElement) pendingElement.textContent = pendingApprovalsCount;
        }

        // Load Total Enrollments count (only if user has permission)
        if (userPermissions.viewEnrollments === true) {
            if (!sessionCache.enrollments) {
                const enrollmentsSnapshot = await getDocs(query(collection(db, "enrollments")));
                const enrollmentsData = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                saveToLocalStorage('enrollments', enrollmentsData);
            }
            const totalEnrollmentsCount = (sessionCache.enrollments || []).length;
            const enrollmentsElement = document.getElementById('dashboard-total-enrollments');
            if (enrollmentsElement) enrollmentsElement.textContent = totalEnrollmentsCount;
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        
        // Set error state only for visible cards
        const tutorsElement = document.getElementById('dashboard-active-tutors');
        const studentsElement = document.getElementById('dashboard-active-students');
        const pendingElement = document.getElementById('dashboard-pending-approvals');
        const enrollmentsElement = document.getElementById('dashboard-total-enrollments');
        
        if (tutorsElement) tutorsElement.textContent = 'Error';
        if (studentsElement) studentsElement.textContent = 'Error';
        if (pendingElement) pendingElement.textContent = 'Error';
        if (enrollmentsElement) enrollmentsElement.textContent = 'Error';
    }
}

// ======================================================
// QUICK ACTION MODAL FUNCTIONS
// ======================================================

window.showAssignStudentModal = async function() {
    try {
        // Load tutors and students data
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
            const activeTutors = tutorsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(tutor => !tutor.status || tutor.status === 'active');
            sessionCache.tutors = activeTutors;
        }

        if (!sessionCache.students) {
            const studentsSnapshot = await getDocs(query(collection(db, "students")));
            const activeStudents = studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(student => !student.status || student.status === 'active' || student.status === 'approved');
            sessionCache.students = activeStudents;
        }

        const tutors = sessionCache.tutors || [];
        const students = sessionCache.students || [];

        // Create modal HTML
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-blue-700">Assign Student to Tutor</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Tutor <span class="text-red-500">*</span>
                            </label>
                            <select id="assign-tutor-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="">-- Select a Tutor --</option>
                                ${tutors.map(tutor => `
                                    <option value="${tutor.id}">
                                        ${tutor.name || tutor.email || tutor.id} ${tutor.assignedStudentsCount ? `(${tutor.assignedStudentsCount} students)` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Student <span class="text-red-500">*</span>
                            </label>
                            <select id="assign-student-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="">-- Select a Student --</option>
                                ${students.map(student => `
                                    <option value="${student.id}">
                                        ${student.name || student.email || student.id}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Assignment Notes (Optional)</label>
                            <textarea id="assignment-notes" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows="3" placeholder="Add any notes about this assignment..."></textarea>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                        <button onclick="closeModal()" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onclick="submitAssignment()" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-user-plus mr-2"></i> Assign Student
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.id = 'assign-student-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // Focus on first select
        setTimeout(() => {
            document.getElementById('assign-tutor-select')?.focus();
        }, 100);
        
    } catch (error) {
        console.error('Error showing assign student modal:', error);
        alert('Failed to load assignment data. Please try again.');
    }
};

window.showArchiveStudentModal = async function() {
    try {
        // Load active students
        if (!sessionCache.students) {
            const studentsSnapshot = await getDocs(query(collection(db, "students")));
            const activeStudents = studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(student => !student.status || student.status === 'active' || student.status === 'approved');
            sessionCache.students = activeStudents;
        }

        const students = sessionCache.students || [];

        // Create modal HTML
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-yellow-700">Archive Student</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Student to Archive <span class="text-red-500">*</span>
                            </label>
                            <select id="archive-student-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                                <option value="">-- Select a Student --</option>
                                ${students.map(student => `
                                    <option value="${student.id}">
                                        ${student.name || student.email || student.id}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Archive Reason <span class="text-red-500">*</span></label>
                            <select id="archive-reason" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                                <option value="">-- Select Reason --</option>
                                <option value="graduated">Graduated/Completed</option>
                                <option value="withdrawn">Withdrawn from Program</option>
                                <option value="transferred">Transferred to Another Tutor</option>
                                <option value="inactive">Became Inactive</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                            <textarea id="archive-notes" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" rows="3" placeholder="Add any notes about this archiving..."></textarea>
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <div class="flex items-start">
                                <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                                <div>
                                    <p class="text-yellow-800 font-medium mb-1">Important Note:</p>
                                    <p class="text-yellow-700 text-sm">Archiving a student will:</p>
                                    <ul class="text-yellow-700 text-sm list-disc pl-5 mt-1">
                                        <li>Change their status to "archived"</li>
                                        <li>Remove them from active student lists</li>
                                        <li>Preserve all their data for records</li>
                                        <li>Notify their assigned tutor (if any)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                        <button onclick="closeModal()" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onclick="submitArchiveStudent()" class="px-5 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                            <i class="fas fa-archive mr-2"></i> Archive Student
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.id = 'archive-student-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('Error showing archive student modal:', error);
        alert('Failed to load student data. Please try again.');
    }
};

window.showMarkInactiveModal = async function() {
    try {
        // Load active tutors
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
            const activeTutors = tutorsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(tutor => !tutor.status || tutor.status === 'active');
            sessionCache.tutors = activeTutors;
        }

        const tutors = sessionCache.tutors || [];

        // Create modal HTML
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-red-700">Mark Tutor as Inactive</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Tutor to Mark Inactive <span class="text-red-500">*</span>
                            </label>
                            <select id="inactive-tutor-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500">
                                <option value="">-- Select a Tutor --</option>
                                ${tutors.map(tutor => `
                                    <option value="${tutor.id}">
                                        ${tutor.name || tutor.email || tutor.id} 
                                        ${tutor.assignedStudentsCount ? `(${tutor.assignedStudentsCount} students)` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Inactive Reason <span class="text-red-500">*</span></label>
                            <select id="inactive-reason" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500">
                                <option value="">-- Select Reason --</option>
                                <option value="left">Left the Organization</option>
                                <option value="temporary">Temporary Leave</option>
                                <option value="performance">Performance Issues</option>
                                <option value="capacity">At Capacity</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                            <textarea id="inactive-notes" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" rows="3" placeholder="Add any notes about marking this tutor inactive..."></textarea>
                        </div>
                        
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div class="flex items-start">
                                <i class="fas fa-exclamation-circle text-red-500 mt-1 mr-3"></i>
                                <div>
                                    <p class="text-red-800 font-medium mb-1">Important Note:</p>
                                    <p class="text-red-700 text-sm">Marking a tutor as inactive will:</p>
                                    <ul class="text-red-700 text-sm list-disc pl-5 mt-1">
                                        <li>Change their status to "inactive"</li>
                                        <li>Remove them from active tutor lists</li>
                                        <li>Prevent new student assignments</li>
                                        <li>Notify their assigned students (if any)</li>
                                        <li>Allow reassignment of their students</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                        <button onclick="closeModal()" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onclick="submitMarkInactive()" class="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <i class="fas fa-user-slash mr-2"></i> Mark Tutor Inactive
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.id = 'mark-inactive-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('Error showing mark inactive modal:', error);
        alert('Failed to load tutor data. Please try again.');
    }
};

// ======================================================
// MODAL SUBMISSION FUNCTIONS
// ======================================================

async function submitAssignment() {
    const tutorId = document.getElementById('assign-tutor-select').value;
    const studentId = document.getElementById('assign-student-select').value;
    const notes = document.getElementById('assignment-notes').value;
    
    if (!tutorId || !studentId) {
        alert('Please select both a tutor and a student.');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.querySelector('#assign-student-modal button[onclick="submitAssignment()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Assigning...';
        submitBtn.disabled = true;
        
        // Create assignment data
        const assignmentData = {
            tutorId: tutorId,
            studentId: studentId,
            assignedBy: window.userData?.uid || 'system',
            assignedByEmail: window.userData?.email || 'system',
            assignedDate: new Date().toISOString(),
            status: 'active',
            notes: notes || '',
            lastModified: new Date().toISOString()
        };
        
        // Add assignment to Firestore
        const assignmentRef = await addDoc(collection(db, "tutorAssignments"), assignmentData);
        
        // Update tutor's assignedStudentsCount
        const tutorRef = doc(db, "tutors", tutorId);
        const tutorDoc = await getDoc(tutorRef);
        if (tutorDoc.exists()) {
            const currentCount = tutorDoc.data().assignedStudentsCount || 0;
            await updateDoc(tutorRef, {
                assignedStudentsCount: currentCount + 1,
                lastModified: new Date().toISOString()
            });
        }
        
        // Update student's tutorId
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            tutorId: tutorId,
            lastModified: new Date().toISOString()
        });
        
        // Invalidate cache
        invalidateCache('tutorAssignments');
        invalidateCache('tutors');
        invalidateCache('students');
        
        // Close modal
        closeModal();
        
        // Show success message
        alert('Student assigned successfully!');
        
        // Refresh dashboard data
        await refreshAllDashboardData();
        
    } catch (error) {
        console.error('Error assigning student:', error);
        alert('Failed to assign student. Please try again.');
        
        // Reset button
        const submitBtn = document.querySelector('#assign-student-modal button[onclick="submitAssignment()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function submitArchiveStudent() {
    const studentId = document.getElementById('archive-student-select').value;
    const reason = document.getElementById('archive-reason').value;
    const notes = document.getElementById('archive-notes').value;
    
    if (!studentId || !reason) {
        alert('Please select a student and provide a reason.');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.querySelector('#archive-student-modal button[onclick="submitArchiveStudent()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Archiving...';
        submitBtn.disabled = true;
        
        // Update student status
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            status: 'archived',
            archiveReason: reason,
            archiveNotes: notes || '',
            archivedDate: new Date().toISOString(),
            archivedBy: window.userData?.uid || 'system',
            archivedByEmail: window.userData?.email || 'system',
            lastModified: new Date().toISOString()
        });
        
        // Find and update any active assignment
        const assignmentsQuery = query(
            collection(db, "tutorAssignments"),
            where("studentId", "==", studentId),
            where("status", "==", "active")
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        if (!assignmentsSnapshot.empty) {
            const assignmentDoc = assignmentsSnapshot.docs[0];
            await updateDoc(doc(db, "tutorAssignments", assignmentDoc.id), {
                status: 'archived',
                endDate: new Date().toISOString(),
                lastModified: new Date().toISOString()
            });
            
            // Update tutor's assignedStudentsCount
            const assignmentData = assignmentDoc.data();
            const tutorRef = doc(db, "tutors", assignmentData.tutorId);
            const tutorDoc = await getDoc(tutorRef);
            if (tutorDoc.exists()) {
                const currentCount = tutorDoc.data().assignedStudentsCount || 0;
                if (currentCount > 0) {
                    await updateDoc(tutorRef, {
                        assignedStudentsCount: currentCount - 1,
                        lastModified: new Date().toISOString()
                    });
                }
            }
        }
        
        // Invalidate cache
        invalidateCache('students');
        invalidateCache('tutorAssignments');
        invalidateCache('tutors');
        
        // Close modal
        closeModal();
        
        // Show success message
        alert('Student archived successfully!');
        
        // Refresh dashboard data
        await refreshAllDashboardData();
        
    } catch (error) {
        console.error('Error archiving student:', error);
        alert('Failed to archive student. Please try again.');
        
        // Reset button
        const submitBtn = document.querySelector('#archive-student-modal button[onclick="submitArchiveStudent()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function submitMarkInactive() {
    const tutorId = document.getElementById('inactive-tutor-select').value;
    const reason = document.getElementById('inactive-reason').value;
    const notes = document.getElementById('inactive-notes').value;
    
    if (!tutorId || !reason) {
        alert('Please select a tutor and provide a reason.');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.querySelector('#mark-inactive-modal button[onclick="submitMarkInactive()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        submitBtn.disabled = true;
        
        // Update tutor status
        const tutorRef = doc(db, "tutors", tutorId);
        await updateDoc(tutorRef, {
            status: 'inactive',
            inactiveReason: reason,
            inactiveNotes: notes || '',
            inactiveDate: new Date().toISOString(),
            markedInactiveBy: window.userData?.uid || 'system',
            markedInactiveByEmail: window.userData?.email || 'system',
            lastModified: new Date().toISOString()
        });
        
        // Find and update active assignments
        const assignmentsQuery = query(
            collection(db, "tutorAssignments"),
            where("tutorId", "==", tutorId),
            where("status", "==", "active")
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        if (!assignmentsSnapshot.empty) {
            const batch = writeBatch(db);
            assignmentsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'pending_reassignment',
                    endDate: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                });
            });
            await batch.commit();
        }
        
        // Invalidate cache
        invalidateCache('tutors');
        invalidateCache('tutorAssignments');
        invalidateCache('students');
        
        // Close modal
        closeModal();
        
        // Show success message
        alert('Tutor marked as inactive successfully! Their students now need reassignment.');
        
        // Refresh dashboard data
        await refreshAllDashboardData();
        
    } catch (error) {
        console.error('Error marking tutor inactive:', error);
        alert('Failed to mark tutor as inactive. Please try again.');
        
        // Reset button
        const submitBtn = document.querySelector('#mark-inactive-modal button[onclick="submitMarkInactive()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

window.closeModal = function() {
    const modals = ['assign-student-modal', 'archive-student-modal', 'mark-inactive-modal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    });
};

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modals = ['assign-student-modal', 'archive-student-modal', 'mark-inactive-modal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            closeModal();
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Refresh All Dashboard Data function
window.refreshAllDashboardData = async function() {
    // Invalidate all cache
    invalidateCache('tutors');
    invalidateCache('students');
    invalidateCache('pendingStudents');
    invalidateCache('enrollments');
    invalidateCache('tutorAssignments');
    
    // Show loading state
    const tutorsElement = document.getElementById('dashboard-active-tutors');
    const studentsElement = document.getElementById('dashboard-active-students');
    const pendingElement = document.getElementById('dashboard-pending-approvals');
    const enrollmentsElement = document.getElementById('dashboard-total-enrollments');
    
    if (tutorsElement) tutorsElement.textContent = '...';
    if (studentsElement) studentsElement.textContent = '...';
    if (pendingElement) pendingElement.textContent = '...';
    if (enrollmentsElement) enrollmentsElement.textContent = '...';
    
    // Reload data
    await loadDashboardData();
    
    // Show success message
    alert('Dashboard data refreshed successfully!');
};

// ======================================================
// SUBSECTION 3.1: Tutor Directory Panel - UPDATED VERSION
// ======================================================

// Helper function for safe string operations
function safeToString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return '';
        }
    }
    return String(value);
}

// Helper function for safe search
function safeSearch(text, searchTerm) {
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    if (!text) return false;
    return safeToString(text).toLowerCase().includes(safeToString(searchTerm).toLowerCase());
}

// Function to search student comprehensively
function searchStudentFromFirebase(student, searchTerm, tutors = []) {
    if (!student) return false;
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    
    const searchLower = safeToString(searchTerm).toLowerCase();
    
    // Search student properties
    const studentFieldsToSearch = [
        'studentName', 'grade', 'days', 'parentName', 'parentPhone', 
        'parentEmail', 'address', 'status', 'tutorEmail', 'tutorName',
        'createdBy', 'updatedBy', 'notes', 'school', 'location'
    ];
    
    // Check all known student fields
    for (const field of studentFieldsToSearch) {
        if (student[field] && safeSearch(student[field], searchTerm)) {
            return true;
        }
    }
    
    // Search student fee
    if (student.studentFee !== undefined && student.studentFee !== null) {
        if (safeToString(student.studentFee).includes(searchLower)) return true;
    }
    
    // Search subjects (can be string or array)
    if (student.subjects) {
        if (Array.isArray(student.subjects)) {
            for (const subject of student.subjects) {
                if (safeSearch(subject, searchTerm)) return true;
            }
        } else {
            if (safeSearch(student.subjects, searchTerm)) return true;
        }
    }
    
    // Search tutor information
    if (student.tutorEmail && tutors && tutors.length > 0) {
        const tutor = tutors.find(t => t && t.email === student.tutorEmail);
        if (tutor) {
            // Search tutor properties
            const tutorFieldsToSearch = ['name', 'email', 'phone', 'qualification', 'subjects'];
            for (const field of tutorFieldsToSearch) {
                if (tutor[field] && safeSearch(tutor[field], searchTerm)) return true;
            }
        }
    }
    
    return false;
}

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents, Subjects, Grades..." class="p-2 border rounded-md w-64">
                    <button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign New Student</button>
                    <button id="reassign-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Reassign Student</button>
                    <button id="view-tutor-history-directory-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">View Tutor History</button>
                    <button id="refresh-directory-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Refresh</button>
                </div>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                    <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Active Students</h4>
                    <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-purple-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-purple-800 text-sm">Students with History</h4>
                    <p id="history-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    
    // Add event listeners - wrapped in try-catch to prevent crash if elements missing
    try {
        document.getElementById('assign-student-btn').addEventListener('click', showAssignStudentModal);
        document.getElementById('reassign-student-btn').addEventListener('click', showReassignStudentModal);
        document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
        document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
        
        document.getElementById('view-tutor-history-directory-btn').addEventListener('click', async () => {
            if (!sessionCache.tutorAssignments || Object.keys(sessionCache.tutorAssignments).length === 0) {
                alert("No tutor history available. Please refresh the directory first.");
                return;
            }
            
            const students = sessionCache.students || [];
            const activeStudents = students.filter(student => 
                student && (!student.status || student.status === 'active' || student.status === 'approved')
            );
            
            if (activeStudents.length === 0) {
                alert("No active students found.");
                return;
            }
            
            const studentOptions = activeStudents.map(student => 
                `<option value="${student.id}">${student.studentName} (${student.grade || 'No grade'})</option>`
            ).join('');
            
            const modalHtml = `
                <div id="select-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('select-student-modal')">&times;</button>
                        <h3 class="text-xl font-bold mb-4">Select Student to View Tutor History</h3>
                        <form id="select-student-form">
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Select Student</label>
                                <select id="select-student" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                                    <option value="" disabled selected>Select a student...</option>
                                    ${studentOptions}
                                </select>
                            </div>
                            <div class="flex justify-end mt-4">
                                <button type="button" onclick="closeManagementModal('select-student-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">View History</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const form = document.getElementById('select-student-form');
            if(form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const selectEl = document.getElementById('select-student');
                    if (selectEl) {
                        const studentId = selectEl.value;
                        closeManagementModal('select-student-modal');
                        if (typeof window.viewStudentTutorHistory === 'function') {
                            window.viewStudentTutorHistory(studentId);
                        }
                    }
                });
            }
        });
    } catch (e) {
        console.error("Error attaching event listeners:", e);
    }
    
    fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors');
        invalidateCache('students');
        invalidateCache('tutorAssignments');
    }

    try {
        const directoryList = document.getElementById('directory-list');
        if (directoryList) {
            directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;
        }
        
        // Fetch all data in parallel
        const [tutorsSnapshot, studentsSnapshot, tutorAssignmentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), orderBy("name"))),
            getDocs(query(collection(db, "students"), orderBy("studentName"))),
            getDocs(collection(db, "tutorAssignments"))
        ]);
        
        console.log(`Fetched ${tutorsSnapshot.size} tutors, ${studentsSnapshot.size} students, ${tutorAssignmentsSnapshot.size} tutor assignments`);
        
        // Process tutors with safe data handling
        const allTutors = tutorsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || 'Unnamed Tutor',
                email: data.email || '',
                status: data.status || 'active',
                phone: data.phone || '',
                subjects: Array.isArray(data.subjects) ? data.subjects : (data.subjects ? [data.subjects] : []),
                qualification: data.qualification || '',
                createdAt: data.createdAt || new Date().toISOString(),
                ...data
            };
        });
        
        const activeTutors = allTutors.filter(tutor => 
            tutor && (!tutor.status || tutor.status === 'active')
        );
        
        // Process students with safe data handling
        const allStudents = studentsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                studentName: data.studentName || 'Unnamed Student',
                tutorEmail: data.tutorEmail || '',
                tutorName: data.tutorName || '',
                studentFee: typeof data.studentFee === 'number' ? data.studentFee : 0,
                grade: data.grade || '',
                days: data.days || '',
                subjects: Array.isArray(data.subjects) ? data.subjects : (data.subjects ? [data.subjects] : []),
                parentName: data.parentName || '',
                parentPhone: data.parentPhone || '',
                parentEmail: data.parentEmail || '',
                address: data.address || '',
                status: data.status || 'active',
                createdAt: data.createdAt || new Date().toISOString(),
                ...data
            };
        });
        
        const activeStudents = allStudents.filter(student => 
            student && (!student.status || student.status === 'active' || student.status === 'approved')
        );
        
        // Process tutor assignments with safe data handling
        const tutorAssignments = {};
        tutorAssignmentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const studentId = data.studentId;
            
            if (studentId) {
                if (!tutorAssignments[studentId]) {
                    tutorAssignments[studentId] = [];
                }
                
                tutorAssignments[studentId].push({
                    id: doc.id,
                    studentId: studentId,
                    tutorId: data.tutorId || '',
                    tutorName: data.tutorName || '',
                    tutorEmail: data.tutorEmail || '',
                    startDate: data.startDate || '',
                    endDate: data.endDate || '',
                    reason: data.reason || '',
                    assignedBy: data.assignedBy || '',
                    assignedAt: data.assignedAt || new Date().toISOString(),
                    ...data
                });
            }
        });
        
        // Sort tutor assignments by date (most recent first)
        Object.keys(tutorAssignments).forEach(studentId => {
            tutorAssignments[studentId].sort((a, b) => 
                new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0)
            );
        });
        
        // Save to cache
        saveToLocalStorage('tutors', activeTutors);
        saveToLocalStorage('students', activeStudents);
        sessionCache.tutorAssignments = tutorAssignments;
        
        console.log("Cache updated:", {
            tutors: activeTutors.length,
            students: activeStudents.length,
            assignments: Object.keys(tutorAssignments).length
        });
        
        renderDirectoryFromCache();
        
    } catch (error) {
        console.error("Error fetching directory data:", error);
        const directoryList = document.getElementById('directory-list');
        if (directoryList) {
            directoryList.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-red-500 mb-4">Failed to load data: ${error.message}</p>
                    <button onclick="fetchAndRenderDirectory(true)" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Retry Loading Data
                    </button>
                </div>
            `;
        }
    }
}

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const tutorAssignments = sessionCache.tutorAssignments || {};
    const directoryList = document.getElementById('directory-list');
    
    if (!directoryList) return;

    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `
            <p class="text-center text-gray-500 py-10">
                No directory data found. 
                <button onclick="fetchAndRenderDirectory(true)" class="text-blue-500 hover:underline ml-1">
                    Click here to fetch from server
                </button>
            </p>
        `;
        return;
    }

    // Safe search term handling
    const searchTermLower = safeToString(searchTerm).toLowerCase();
    
    // Group students by tutor email
    const studentsByTutor = {};
    
    students.forEach(student => {
        if (!student) return;
        const tutorEmail = student.tutorEmail || '';
        if (tutorEmail) {
            if (!studentsByTutor[tutorEmail]) {
                studentsByTutor[tutorEmail] = [];
            }
            studentsByTutor[tutorEmail].push(student);
        }
    });

    // Filter tutors based on search term
    const filteredTutors = tutors.filter(tutor => {
        if (!tutor) return false;
        if (!searchTerm) return true;
        
        const assignedStudents = studentsByTutor[tutor.email] || [];
        
        // Check tutor info
        const tutorNameMatch = safeSearch(tutor.name, searchTerm);
        const tutorEmailMatch = safeSearch(tutor.email, searchTerm);
        
        // Check if any assigned student matches
        const studentMatch = assignedStudents.some(student => {
            return searchStudentFromFirebase(student, searchTerm, tutors);
        });
        
        return tutorNameMatch || tutorEmailMatch || studentMatch;
    });

    if (searchTerm && filteredTutors.length === 0) {
        directoryList.innerHTML = `
            <div class="text-center py-10">
                <p class="text-gray-500 mb-2">No results found for "${searchTerm}"</p>
                <button onclick="document.getElementById('directory-search').value = ''; renderDirectoryFromCache();" 
                        class="text-blue-500 hover:underline">
                    Clear search
                </button>
            </div>
        `;
        return;
    }

    // Update counters
    const tutorCountBadge = document.getElementById('tutor-count-badge');
    const studentCountBadge = document.getElementById('student-count-badge');
    const historyCountBadge = document.getElementById('history-count-badge');
    
    if (tutorCountBadge) tutorCountBadge.textContent = tutors.length;
    if (studentCountBadge) studentCountBadge.textContent = students.length;
    if (historyCountBadge) historyCountBadge.textContent = Object.keys(tutorAssignments).length;

    // Check permissions
    const canEditStudents = window.userData?.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData?.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = canEditStudents || canDeleteStudents;

    // Build the directory view
    directoryList.innerHTML = filteredTutors.map(tutor => {
        if (!tutor) return '';
        
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(student => {
                if (!student) return false;
                if (!searchTerm) return true;
                return searchStudentFromFirebase(student, searchTerm, tutors) || safeSearch(tutor.name, searchTerm);
            })
            .sort((a, b) => safeToString(a.studentName).localeCompare(safeToString(b.studentName)));

        const studentsTableRows = assignedStudents.map(student => {
            const subjects = Array.isArray(student.subjects) ? 
                student.subjects.join(', ') : 
                safeToString(student.subjects);
            
            const studentHistory = tutorAssignments[student.id];
            const historyButton = studentHistory ? 
                `<button class="view-history-btn bg-purple-500 text-white px-3 py-1 rounded-full text-xs ml-1 hover:bg-purple-600" data-student-id="${student.id}">History</button>` : '';
            
            const actionButtons = `
                ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-600" data-student-id="${student.id}">Edit</button>` : ''}
                ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs hover:bg-red-600" data-student-id="${student.id}">Delete</button>` : ''}
                ${historyButton}
            `;
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2 font-medium">${student.studentName || 'N/A'}</td>
                    <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                    <td class="px-4 py-2">${student.grade || 'N/A'}</td>
                    <td class="px-4 py-2">${student.days || 'N/A'}</td>
                    <td class="px-4 py-2">${subjects || 'N/A'}</td>
                    <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                    <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                    ${showActionsColumn || historyButton ? `<td class="px-4 py-2 space-x-1">${actionButtons}</td>` : ''}
                </tr>
            `;
        }).join('');

        return `
            <div class="border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <details open>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg bg-gray-50 hover:bg-gray-100">
                        <div>
                            <span class="text-green-700">${tutor.name || 'Unnamed Tutor'}</span>
                            <span class="ml-2 text-sm font-normal text-gray-500">${tutor.email || ''}</span>
                        </div>
                        <div class="flex items-center">
                            <span class="ml-2 text-sm font-normal px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                ${assignedStudents.length} student${assignedStudents.length !== 1 ? 's' : ''}
                            </span>
                            <svg class="w-5 h-5 ml-2 text-gray-500 transform transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </summary>
                    <div class="border-t">
                        ${assignedStudents.length > 0 ? `
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-sm">
                                    <thead class="bg-gray-50 text-left">
                                        <tr>
                                            <th class="px-4 py-2 font-medium">Student Name</th>
                                            <th class="px-4 py-2 font-medium">Fee</th>
                                            <th class="px-4 py-2 font-medium">Grade</th>
                                            <th class="px-4 py-2 font-medium">Days/Week</th>
                                            <th class="px-4 py-2 font-medium">Subject</th>
                                            <th class="px-4 py-2 font-medium">Parent's Name</th>
                                            <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                            ${showActionsColumn ? `<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-200">
                                        ${studentsTableRows}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="p-6 text-center text-gray-500">
                                No students assigned to this tutor${searchTerm ? ' matching your search' : ''}.
                            </div>
                        `}
                    </div>
                </details>
            </div>
        `;
    }).join('');

    // Add event listeners for action buttons
    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(button => {
            button.addEventListener('click', () => handleEditStudent(button.dataset.studentId));
        });
    }
    
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(button => {
            button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId));
        });
    }
    
    document.querySelectorAll('.view-history-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (typeof window.viewStudentTutorHistory === 'function') {
                window.viewStudentTutorHistory(button.dataset.studentId);
            } else {
                alert('View history function not available');
            }
        });
    });
}

// ======================================================
// UPDATED SHOWREASSIGNSTUDENTMODAL - WITH ROBUST FETCHING & FILTERING
// ======================================================

// Check if showReassignStudentModal already exists
if (typeof window.showReassignStudentModal === 'undefined') {
    window.showReassignStudentModal = async function() {
        try {
            // STEP 1: FORCE FETCH IF CACHE IS MISSING OR MALFORMED
            // This ensures we get data from the EXACT same source as the directory
            if (!sessionCache.students || !Array.isArray(sessionCache.students) || sessionCache.students.length === 0 || 
                !sessionCache.tutors || !Array.isArray(sessionCache.tutors) || sessionCache.tutors.length === 0) {
                console.log("Reassign Modal: Data missing, forcing fetch...");
                await fetchAndRenderDirectory(true);
            }
            
            // STEP 2: CLEAN THE DATA (Remove nulls/undefined)
            // This fixes the "Cannot read properties of undefined" error
            const students = (sessionCache.students || []).filter(s => s !== null && s !== undefined);
            const tutors = (sessionCache.tutors || []).filter(t => t !== null && t !== undefined);
            
            if (students.length === 0) {
                alert("No students found. Please add students first.");
                return;
            }
            
            if (tutors.length === 0) {
                alert("No tutors found. Please add tutors first.");
                return;
            }
            
            // Filter active students - SAFE CHECK
            const activeStudents = students.filter(student => 
                // Redundant safety check just in case
                student && (!student.status || student.status === 'active' || student.status === 'approved')
            );
            
            if (activeStudents.length === 0) {
                alert("No active students available for reassignment.");
                return;
            }
            
            // Create student options - SAFE CHECK
            const studentOptions = activeStudents.map(student => {
                if (!student) return '';
                const currentTutor = tutors.find(t => t && t.email === student.tutorEmail);
                const tutorInfo = currentTutor ? currentTutor.name : 'No tutor';
                
                // Build display text
                const displayText = [
                    student.studentName || 'Unnamed',
                    student.grade ? `Grade: ${student.grade}` : '',
                    student.parentName ? `Parent: ${student.parentName}` : '',
                    `Current: ${tutorInfo}`
                ].filter(Boolean).join(' | ');
                
                return `<option value="${student.id}">${displayText}</option>`;
            }).join('');
            
            // Create tutor options - SAFE CHECK
            const tutorOptions = tutors.map(tutor => 
                tutor ? `<option value="${tutor.email}">${tutor.name} (${tutor.email})</option>` : ''
            ).join('');
            
            const modalHtml = `
                <div id="reassign-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-xl">
                        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('reassign-student-modal')">&times;</button>
                        <h3 class="text-xl font-bold mb-4 text-blue-700">Reassign Student to Different Tutor</h3>
                        
                        <form id="reassign-student-form">
                            <div class="mb-6">
                                <input type="search" id="reassign-search" placeholder="Search students by name, grade, parent, subjects..." 
                                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label class="block text-sm font-medium mb-2">Select Student</label>
                                    <select id="reassign-student-id" required 
                                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 h-80 overflow-y-auto">
                                        <option value="" disabled selected>Select a student...</option>
                                        ${studentOptions}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-2">Assign to New Tutor</label>
                                    <select id="reassign-tutor-email" required 
                                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 h-48">
                                        <option value="" disabled selected>Select a tutor...</option>
                                        ${tutorOptions}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Reason for Reassignment (Optional)</label>
                                <textarea id="reassign-reason" 
                                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" 
                                          rows="3" 
                                          placeholder="Enter reason for reassignment..."></textarea>
                            </div>
                            
                            <div class="flex justify-end space-x-2">
                                <button type="button" onclick="closeManagementModal('reassign-student-modal')" 
                                        class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                                    Cancel
                                </button>
                                <button type="submit" id="reassign-submit-btn"
                                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                                    </svg>
                                    Reassign Student
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Add search functionality
            const searchInput = document.getElementById('reassign-search');
            const studentSelect = document.getElementById('reassign-student-id');
            
            if (searchInput && studentSelect) {
                // Store original options for filtering
                const originalOptions = Array.from(studentSelect.options);
                
                searchInput.addEventListener('input', (e) => {
                    // SAFE VALUE RETRIEVAL
                    const target = e.target;
                    const val = target ? target.value : '';
                    const searchTerm = safeToString(val).toLowerCase();
                    
                    if (!searchTerm.trim()) {
                        // Show all options when search is cleared
                        originalOptions.forEach(option => {
                            if (option.value !== "") { // Keep the placeholder
                                option.style.display = '';
                            }
                        });
                        return;
                    }
                    
                    // Filter options based on search term
                    originalOptions.forEach(option => {
                        if (option.value === "") {
                            // Keep placeholder visible
                            option.style.display = '';
                        } else {
                            // SAFE OPTION TEXT RETRIEVAL
                            const optionText = option.text ? safeToString(option.text).toLowerCase() : '';
                            option.style.display = optionText.includes(searchTerm) ? '' : 'none';
                        }
                    });
                });
            } else {
                console.error("Search input or student select element not found");
            }
            
            // Handle form submission
            const reassignForm = document.getElementById('reassign-student-form');
            if (reassignForm) {
                reassignForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const studentId = document.getElementById('reassign-student-id').value;
                    const tutorEmail = document.getElementById('reassign-tutor-email').value;
                    const reason = document.getElementById('reassign-reason').value;
                    
                    if (!studentId || !tutorEmail) {
                        alert("Please select both a student and a tutor.");
                        return;
                    }
                    
                    // SAFE LOOKUPS
                    const student = students.find(s => s && s.id === studentId);
                    const tutor = tutors.find(t => t && t.email === tutorEmail);
                    const currentTutor = tutors.find(t => t && t.email === student?.tutorEmail);
                    
                    if (!student) {
                        alert("Selected student not found.");
                        return;
                    }
                    
                    if (!tutor) {
                        alert("Selected tutor not found.");
                        return;
                    }
                    
                    if (student.tutorEmail === tutorEmail) {
                        alert(`Student "${student.studentName}" is already assigned to ${tutor.name}.`);
                        return;
                    }
                    
                    // Confirm reassignment
                    const confirmMessage = `Are you sure you want to reassign "${student.studentName}" from ${currentTutor ? currentTutor.name : 'No tutor'} to ${tutor.name}?`;
                    
                    if (!confirm(confirmMessage)) {
                        return;
                    }
                    
                    try {
                        const submitButton = document.getElementById('reassign-submit-btn');
                        const originalText = submitButton.innerHTML;
                        submitButton.innerHTML = '<span class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...</span>';
                        submitButton.disabled = true;
                        
                        const currentUser = window.userData?.name || 'Admin';
                        const currentUserEmail = window.userData?.email || 'admin@system';
                        
                        // 1. Create tutor assignment history record
                        const assignmentData = {
                            studentId: studentId,
                            studentName: student.studentName,
                            oldTutorEmail: student.tutorEmail,
                            oldTutorName: currentTutor?.name || 'Unknown',
                            newTutorEmail: tutorEmail,
                            newTutorName: tutor.name,
                            reason: reason || 'Reassignment',
                            assignedBy: currentUser,
                            assignedByEmail: currentUserEmail,
                            assignedAt: new Date().toISOString(),
                            timestamp: serverTimestamp()
                        };
                        
                        await addDoc(collection(db, "tutorAssignments"), assignmentData);
                        
                        // 2. Update student document with new tutor
                        await updateDoc(doc(db, "students", studentId), {
                            tutorEmail: tutorEmail,
                            tutorName: tutor.name,
                            updatedAt: new Date().toISOString(),
                            updatedBy: currentUser,
                            updatedByEmail: currentUserEmail
                        });
                        
                        // 3. Update cache
                        if (sessionCache.students) {
                            const studentIndex = sessionCache.students.findIndex(s => s && s.id === studentId);
                            if (studentIndex !== -1) {
                                sessionCache.students[studentIndex].tutorEmail = tutorEmail;
                                sessionCache.students[studentIndex].tutorName = tutor.name;
                                saveToLocalStorage('students', sessionCache.students);
                            }
                        }
                        
                        alert(`✅ Successfully reassigned "${student.studentName}" to ${tutor.name}!`);
                        
                        closeManagementModal('reassign-student-modal');
                        fetchAndRenderDirectory(true);
                        
                    } catch (error) {
                        console.error("Error reassigning student:", error);
                        alert(`❌ Failed to reassign student: ${error.message}`);
                        
                        const submitButton = document.getElementById('reassign-submit-btn');
                        if (submitButton) {
                            submitButton.innerHTML = originalText;
                            submitButton.disabled = false;
                        }
                    }
                });
            } else {
                console.error("Reassign form element not found in DOM");
            }
            
        } catch (error) {
            console.error("Error showing reassign modal:", error);
            alert(`Error: ${error.message}`);
        }
    };
}

// ======================================================
// CLOSE MODAL FUNCTION - ONLY IF NOT EXISTS
// ======================================================

if (typeof window.closeManagementModal === 'undefined') {
    window.closeManagementModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    };
}

// ======================================================
// SUBSECTION 3.2: Inactive Tutors Panel
// ======================================================

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
            
            const tutorsSnapshot = await getDocs(collection(db, "tutors"));
            const allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const inactiveTutors = allTutors.filter(tutor => tutor.status === 'inactive' || tutor.status === 'on_leave');
            const activeTutors = allTutors.filter(tutor => !tutor.status || tutor.status === 'active');
            
            saveToLocalStorage('inactiveTutors', inactiveTutors);
            
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
    
    document.querySelectorAll('.reactivate-btn').forEach(button => {
        button.addEventListener('click', (e) => handleReactivateTutor(e.target.dataset.tutorId));
    });
    
    document.querySelectorAll('.view-history-btn').forEach(button => {
        button.addEventListener('click', (e) => showTutorHistory(e.target.dataset.tutorId));
    });
}

function showMarkInactiveModal() {
    const allTutors = sessionCache.tutors || [];
    const inactiveTutors = sessionCache.inactiveTutors || [];
    
    const activeTutorsFiltered = allTutors.filter(tutor => 
        !tutor.status || tutor.status === 'active'
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
        const studentsSnapshot = await getDocs(query(collection(db, "students"), where("tutorEmail", "==", tutorId)));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const reportsSnapshot = await getDocs(query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorId)));
        const reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tutorDoc = await getDoc(doc(db, "tutors", tutorId));
        const tutorData = tutorDoc.data();
        
        const studentsHTML = students.map(student => {
            const statusBadge = student.status === 'archived' ? '<span class="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Archived</span>' :
                            student.status === 'graduated' ? '<span class="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Graduated</span>' :
                            student.status === 'transferred' ? '<span class="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Transferred</span>' : '';
            
            return `
                <div class="border rounded p-3 mb-2">
                    <p><strong>${student.studentName}</strong> (Grade: ${student.grade}) ${statusBadge}</p>
                    <p class="text-sm text-gray-600">Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                    ${student.tutorHistory ? `<p class="text-xs text-gray-500">Assigned: ${student.tutorHistory[0]?.assignedDate?.toDate?.().toLocaleDateString() || 'Unknown'}</p>` : ''}
                </div>
            `;
        }).join('');
        
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

// ======================================================
// SUBSECTION 3.3: Archived Students Panel
// ======================================================

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
            
            const studentsSnapshot = await getDocs(collection(db, "students"));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const archivedStudents = allStudents.filter(student => student.status === 'archived' || student.status === 'graduated' || student.status === 'transferred');
            const activeStudents = allStudents.filter(student => !student.status || student.status === 'active' || student.status === 'approved');
            
            saveToLocalStorage('archivedStudents', archivedStudents);
            
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
    
    document.querySelectorAll('.restore-student-btn').forEach(button => {
        button.addEventListener('click', (e) => handleRestoreStudent(e.target.dataset.studentId));
    });
    
    document.querySelectorAll('.view-student-history-btn').forEach(button => {
        button.addEventListener('click', (e) => window.viewStudentTutorHistory(e.target.dataset.studentId));
    });
}

function showArchiveStudentModal() {
    const allStudents = sessionCache.students || [];
    const archivedStudents = sessionCache.archivedStudents || [];
    
    const activeStudentsFiltered = allStudents.filter(student => 
        !student.status || student.status === 'active' || student.status === 'approved'
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

// ======================================================
// SECTION 4: FINANCIAL PANELS
// ======================================================

// ======================================================
// SUBSECTION 4.1: Pay Advice Panel
// ======================================================

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
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-yellow-800 text-sm">Active Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
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
            currentPayData = [];
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
            
            if (tutor.status === 'inactive' || tutor.status === 'on_leave') {
                return;
            }
            
            const reportedStudentNames = tutorStudentPairs[tutorEmail] || new Set();
            
            const reportedStudents = allStudents.filter(s => 
                s.tutorEmail === tutorEmail && 
                reportedStudentNames.has(s.studentName) &&
                s.summerBreak !== true &&
                s.status !== 'archived' &&
                s.status !== 'graduated' &&
                s.status !== 'transferred'
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
                tinNumber: tutor.tinNumber || '',
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
                    renderPayAdviceTable();
                } else {
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}

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

async function exportPayAdviceAsXLS() {
    try {
        const currentDate = new Date();
        const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const processedData = currentPayData.map(tutor => {
            const giftAmount = payAdviceGifts[tutor.tutorEmail] || 0;
            const finalPay = tutor.totalPay + giftAmount;
            
            const firstHalf = finalPay / 2;
            const tenPercentDeduction = firstHalf * 0.1;
            const mainPayment = firstHalf - tenPercentDeduction;
            const dataZoomPayment = firstHalf;
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

        const mainPaymentData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.beneficiaryBank,
            '',
            tutor.beneficiaryAccount,
            '',
            'NIP',
            tutor.mainPayment,
            'NGN',
            `${monthYear} Tutor Payment`
        ]);

        const dataZoomData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.beneficiaryBank,
            '',
            tutor.beneficiaryAccount,
            '',
            'NIP',
            tutor.dataZoomPayment,
            'NGN',
            'DATAZOOMALLOCT'
        ]);

        const tinRemittanceData = processedData.map(tutor => [
            tutor.tutorName,
            tutor.tinNumber || '',
            tutor.tinRemittance,
            'NGN',
            monthYear
        ]);

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

async function downloadMultipleXLSFiles(files) {
    for (const file of files) {
        await downloadAsXLS(file.data, file.headers, file.filename);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function downloadAsXLS(data, headers, filename) {
    return new Promise((resolve) => {
        let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
        html += '<table border="1">';
        
        html += '<tr>';
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr>';
        
        data.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</table></body></html>';
        
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

// ======================================================
// SUBSECTION 4.2: Referral Management Panel
// ======================================================

async function getParentNameFromParentUsers(parentUid) {
    try {
        if (!parentUid) return 'Unknown Parent';
        
        const parentDoc = await getDoc(doc(db, 'parent_users', parentUid));
        if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            return capitalize(parentData.parentName || parentData.name || parentData.email || 'Unknown Parent');
        }
        return 'Unknown Parent';
    } catch (error) {
        console.error("Error fetching parent name:", error);
        return 'Unknown Parent';
    }
}

async function renderReferralsAdminPanel(container) {
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading referral tracking data...</p></div>';

    try {
        const parentsQuery = query(collection(db, 'parent_users'), where('referralCode', '!=', null));
        const parentsSnapshot = await getDocs(parentsQuery);

        const referralDataMap = {};

        for (const parentDoc of parentsSnapshot.docs) {
            const data = parentDoc.data();
            const parentUid = parentDoc.id;
            
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

        saveToLocalStorage('referralDataMap', referralDataMap);

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

function showReferralDetailsModal(parentUid) {
    const parentData = sessionCache.referralDataMap[parentUid];
    if (!parentData) {
        alert("Referral details not found in cache.");
        return;
    }
    
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

    window.updateReferralStatus = updateReferralStatus;
    window.resetParentBalance = resetParentBalance;
}

async function updateReferralStatus(parentUid, transactionId, newStatus) {
    if (!confirm(`Are you sure you want to set this transaction status to '${newStatus}'?`)) {
        return;
    }

    try {
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'referral_transactions', transactionId);
        const parentRef = doc(db, 'parent_users', parentUid);

        const transactionDoc = await getDoc(transactionRef);
        if (!transactionDoc.exists()) {
            alert('Transaction not found!');
            return;
        }
        const oldStatus = transactionDoc.data().status;
        const amount = transactionDoc.data().amount || 0;

        batch.update(transactionRef, {
            status: newStatus,
            lastUpdated: Timestamp.now()
        });

        let earningsChange = 0;
        if (oldStatus === 'pending' && newStatus === 'approved') {
            earningsChange = amount;
        }

        if (earningsChange !== 0) {
            const currentEarnings = sessionCache.referralDataMap[parentUid].referralEarnings;
            batch.update(parentRef, {
                referralEarnings: currentEarnings + earningsChange
            });
        }

        await batch.commit();

        alert(`Transaction status updated to ${capitalize(newStatus)}. Parent earnings adjusted.`);
        
        invalidateCache('referralDataMap');
        closeManagementModal('referralDetailsModal');
        await renderReferralsAdminPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error updating referral status: ", error);
        alert("Failed to update status. Check console for details.");
    }
}

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

        batch.update(parentRef, {
            referralEarnings: 0
        });

        await batch.commit();

        alert(`Payout complete. ${approvedSnapshot.size} transactions marked as PAID. Parent earnings reset to ₦0.`);
        
        invalidateCache('referralDataMap');
        closeManagementModal('referralDetailsModal');
        await renderReferralsAdminPanel(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error processing payout and reset: ", error);
        alert("Failed to process payout. Check console for details.");
    }
}

// ======================================================
// SUBSECTION 5.1: Tutor Reports Panel
// ======================================================

async function renderTutorReportsPanel(container) {
    const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
    const canExport = window.userData?.permissions?.actions?.canExportPayAdvice === true;
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            
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

            <div class="mb-6">
                <input type="search" id="reports-search" placeholder="Search reports by student, tutor, or content..." 
                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
            </div>

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

            <div id="tutor-reports-list" class="space-y-4">
                <div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading reports...</p>
                </div>
            </div>
        </div>
    `;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('reports-start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reports-end-date').value = lastDay.toISOString().split('T')[0];

    let allReports = [];
    let filteredReports = [];

    const handleDateChange = () => {
        fetchAndRenderTutorReports();
    };

    document.getElementById('reports-start-date').addEventListener('change', handleDateChange);
    document.getElementById('reports-end-date').addEventListener('change', handleDateChange);
    document.getElementById('refresh-reports-btn').addEventListener('click', handleDateChange);
    
    document.getElementById('reports-search').addEventListener('input', (e) => {
        filterReports(e.target.value);
    });

    document.getElementById('reports-tutor-filter').addEventListener('change', () => {
        applyFilters();
    });
    
    document.getElementById('reports-student-filter').addEventListener('change', () => {
        applyFilters();
    });

    const exportBtn = document.getElementById('export-reports-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReportsToCSV);
    }

    handleDateChange();

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

            const startTimestamp = Timestamp.fromDate(startDate);
            const endTimestamp = Timestamp.fromDate(endDate);

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

            updateFilterDropdowns();

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
        
        const tutors = [...new Set(allReports.map(r => r.tutorEmail))].filter(Boolean);
        const students = [...new Set(allReports.map(r => r.studentName))].filter(Boolean);
        
        tutorFilter.innerHTML = '<option value="">All Tutors</option>' + 
            tutors.map(tutor => `<option value="${tutor}">${tutor}</option>`).join('');
        
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

        const uniqueTutors = Object.keys(reportsByTutor).length;
        document.getElementById('report-tutor-count').textContent = uniqueTutors;
        document.getElementById('report-total-count').textContent = filteredReports.length;

        const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
        
        let html = '';
        
        Object.values(reportsByTutor).forEach(tutorData => {
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

// ======================================================
// SUBSECTION 5.2: Enrollments Panel (COMPREHENSIVE TUTOR DISPLAY)
// ======================================================

// EXTRACTED: Function to display tutor assignments under each student (Comprehensive Version)
function buildComprehensiveStudentTutorAssignmentsHTML(student, studentAssignment, enrollment) {
    let tutorHTML = '';
    
    // Academic days and time
    const academicDays = student.academicDays || enrollment.academicDays || 'Not specified';
    const academicTime = student.academicTime || enrollment.academicTime || 'Not specified';
    
    if (studentAssignment) {
        // Main Academic Tutor Section
        if (studentAssignment.tutorName || studentAssignment.tutorEmail) {
            const assignedDate = studentAssignment.assignedDate ? 
                (studentAssignment.assignedDate.seconds ? 
                    new Date(studentAssignment.assignedDate.seconds * 1000).toLocaleDateString() : 
                    new Date(studentAssignment.assignedDate).toLocaleDateString()) : 
                'Unknown date';
            
            tutorHTML += `
                <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-semibold text-green-700">✓ Academic Tutor</p>
                            <p class="text-sm"><strong>Tutor:</strong> ${studentAssignment.tutorName || 'Name not available'}</p>
                            <p class="text-xs text-gray-600">Email: ${studentAssignment.tutorEmail || 'Not available'}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs font-medium text-gray-600">Assigned Date</p>
                            <p class="text-sm">${assignedDate}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Check for extracurricular tutors - TREATING EACH EXTRACURRICULAR AS SEPARATE ASSIGNMENT
        if (student.extracurriculars && student.extracurriculars.length > 0) {
            const extracurricularList = student.extracurriculars;
            const ecTutors = studentAssignment.extracurricularTutors || [];
            
            extracurricularList.forEach(ec => {
                const ecTutor = ecTutors.find(t => t.activity === ec.name);
                
                if (ecTutor) {
                    const ecAssignedDate = ecTutor.assignedDate ? 
                        (ecTutor.assignedDate.seconds ? 
                            new Date(ecTutor.assignedDate.seconds * 1000).toLocaleDateString() : 
                            new Date(ecTutor.assignedDate).toLocaleDateString()) : 
                        'Unknown date';
                    
                    tutorHTML += `
                        <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-sm font-semibold text-blue-700">✓ Extracurricular: ${ec.name}</p>
                                    <p class="text-sm"><strong>Tutor:</strong> ${ecTutor.tutorName || 'Not assigned'}</p>
                                    <p class="text-xs text-gray-600">Email: ${ecTutor.tutorEmail || 'Not available'}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs font-medium text-gray-600">Assigned Date</p>
                                    <p class="text-sm">${ecAssignedDate}</p>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Frequency: ${ec.frequency}</p>
                        </div>
                    `;
                } else {
                    // Each extracurricular activity without a tutor gets its own unassigned section
                    tutorHTML += `
                        <div class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div class="flex items-center">
                                <svg class="w-4 h-4 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.196 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                                <div>
                                    <p class="text-sm font-semibold text-yellow-700">Extracurricular: ${ec.name}</p>
                                    <p class="text-xs text-yellow-600">No tutor assigned for this activity</p>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Frequency: ${ec.frequency}</p>
                        </div>
                    `;
                }
            });
        }
        
        // Check for subject-specific tutors
        if (studentAssignment.subjectTutors && studentAssignment.subjectTutors.length > 0) {
            studentAssignment.subjectTutors.forEach(subjectTutor => {
                const subjectAssignedDate = subjectTutor.assignedDate ? 
                    (subjectTutor.assignedDate.seconds ? 
                        new Date(subjectTutor.assignedDate.seconds * 1000).toLocaleDateString() : 
                        new Date(subjectTutor.assignedDate).toLocaleDateString()) : 
                    'Unknown date';
                
                tutorHTML += `
                    <div class="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-sm font-semibold text-purple-700">✓ Subject: ${subjectTutor.subject || 'Subject'}</p>
                                <p class="text-sm"><strong>Tutor:</strong> ${subjectTutor.tutorName || 'Not assigned'}</p>
                                <p class="text-xs text-gray-600">Email: ${subjectTutor.tutorEmail || 'Not available'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs font-medium text-gray-600">Assigned Date</p>
                                <p class="text-sm">${subjectAssignedDate}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    } else {
        // No tutor assigned at all - Comprehensive view
        tutorHTML = `
            <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center">
                    <svg class="w-4 h-4 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.196 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p class="text-sm text-yellow-700">No academic tutor assigned yet</p>
                </div>
                <p class="text-xs text-yellow-600 mt-1">This student needs an academic tutor</p>
                
                <!-- Extracurricular Activities Section - Each as separate unassigned item -->
                ${student.extracurriculars && student.extracurriculars.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-yellow-200">
                        <p class="text-sm font-medium text-yellow-700 mb-2">Extracurricular Activities:</p>
                        <div class="space-y-2">
                            ${student.extracurriculars.map((ec, ecIndex) => `
                                <div class="p-2 bg-white border border-yellow-100 rounded">
                                    <p class="text-sm font-medium">${ec.name} (${ec.frequency})</p>
                                    <p class="text-xs text-gray-600">No tutor assigned for this activity</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Subjects Section -->
                ${student.selectedSubjects && student.selectedSubjects.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-yellow-200">
                        <p class="text-sm font-medium text-yellow-700 mb-2">Subjects:</p>
                        <div class="space-y-2">
                            ${student.selectedSubjects.map((subject, subIndex) => `
                                <div class="p-2 bg-white border border-yellow-100 rounded">
                                    <p class="text-sm font-medium">${subject}</p>
                                    <p class="text-xs text-gray-600">No subject-specific tutor assigned</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    return tutorHTML;
}

// Helper function for fee parsing - MOVED TO GLOBAL SCOPE
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

async function renderEnrollmentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Enrollment Management</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="enrollments-search" placeholder="Search enrollments..." class="p-2 border rounded-md w-64">
                    <button id="refresh-enrollments-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <div class="flex gap-2">
                        <button id="export-excel-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2">
                            <i class="fas fa-file-excel"></i> Download as Excel
                        </button>
                        <button id="export-range-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2">
                            <i class="fas fa-calendar"></i> Export Range
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                <h3 class="text-lg font-bold text-gray-800 mb-3">Revenue Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white p-4 rounded-lg shadow">
                        <p class="text-sm text-gray-600">Projected Revenue</p>
                        <p id="projected-revenue" class="text-2xl font-bold text-blue-600">₦0</p>
                        <p class="text-xs text-gray-500">Total from all enrollments</p>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <p class="text-sm text-gray-600">Confirmed Revenue</p>
                        <p id="confirmed-revenue" class="text-2xl font-bold text-green-600">₦0</p>
                        <p class="text-xs text-gray-500">From approved enrollments</p>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <p class="text-sm text-gray-600">Payment Methods</p>
                        <div id="payment-methods-chart" class="mt-2">
                            <p class="text-xs text-gray-500">Loading chart...</p>
                        </div>
                    </div>
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
                    <div id="export-date-range" class="hidden flex gap-2">
                        <input type="date" id="export-date-from" class="p-2 border rounded-md" placeholder="Export From">
                        <input type="date" id="export-date-to" class="p-2 border rounded-md" placeholder="Export To">
                        <button id="cancel-export-range" class="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto" style="max-height: 500px; overflow-y: auto;">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Application ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Email</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Phone</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days/Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referral Code</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned/Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="enrollments-list" class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td colspan="12" class="px-6 py-4 text-center text-gray-500">Loading enrollments...</td>
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
    
    // Excel Export Buttons
    document.getElementById('export-excel-btn').addEventListener('click', () => exportEnrollmentsToExcel());
    document.getElementById('export-range-btn').addEventListener('click', showExportRangePicker);
    document.getElementById('cancel-export-range')?.addEventListener('click', hideExportRangePicker);

    fetchAndRenderEnrollments();
}

// Enhanced Helper: Check Tutor Assignments with extracurricular support
async function checkTutorAssignments(enrollmentId, studentNames = []) {
    try {
        const assignments = [];
        console.log(`Checking assignments for Enrollment: ${enrollmentId}`);
        
        // 1. Search in 'students' collection for enrollmentId
        const studentsQuery = query(
            collection(db, "students"), 
            where("enrollmentId", "==", enrollmentId)
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (studentsSnapshot.empty) {
            console.log(`No student documents found for enrollmentId: ${enrollmentId}`);
            // Also check in 'pending_students' collection
            const pendingQuery = query(
                collection(db, "pending_students"),
                where("enrollmentId", "==", enrollmentId)
            );
            
            const pendingSnapshot = await getDocs(pendingQuery);
            
            pendingSnapshot.forEach(doc => {
                const data = doc.data();
                
                // Extract tutor information from pending students
                let tName = data.tutorName;
                let tEmail = data.tutorEmail;
                let aDate = data.assignedDate || data.createdAt;
                
                if (tName || tEmail) {
                    assignments.push({
                        studentName: data.studentName,
                        tutorName: tName,
                        tutorEmail: tEmail,
                        assignedDate: aDate,
                        source: 'pending_students_collection'
                    });
                }
            });
            
            return assignments;
        }

        // 2. Iterate through results from students collection
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // 3. Robust Data Retrieval
            let tName = data.tutorName;
            let tEmail = data.tutorEmail;
            let aDate = data.assignedDate;

            // Check nested 'tutor' object
            if (data.tutor) {
                if (!tName) tName = data.tutor.tutorName || data.tutor.name;
                if (!tEmail) tEmail = data.tutor.tutorEmail || data.tutor.email;
                if (!aDate) aDate = data.tutor.assignedDate;
            }

            // Fallback to creation date if no assigned date
            if ((tName || tEmail) && !aDate) {
                aDate = data.createdAt;
            }

            // 4. Check for extracurricular tutors
            const extracurricularTutors = data.extracurricularTutors || [];
            const subjectTutors = data.subjectTutors || [];

            // 5. Verification - Even if no academic tutor, include for extracurricular info
            assignments.push({
                studentName: data.name,
                tutorName: tName,
                tutorEmail: tEmail,
                assignedDate: aDate,
                source: 'students_collection',
                extracurricularTutors: extracurricularTutors,
                subjectTutors: subjectTutors,
                hasAcademicTutor: !!(tName || tEmail),
                hasExtracurricularTutors: extracurricularTutors.length > 0,
                hasSubjectTutors: subjectTutors.length > 0
            });
        });
        
        return assignments;
    } catch (error) {
        console.error("Error checking tutor assignments:", error);
        return [];
    }
}

// NEW HELPER: Get comprehensive assignment status for each enrollment
function getEnrollmentAssignmentStatus(enrollment, tutorAssignments) {
    if (!enrollment.students || enrollment.students.length === 0) {
        return {
            status: 'No Students',
            date: null,
            allAssigned: false,
            assignedCount: 0,
            totalCount: 0,
            needsExtracurricularTutors: 0,
            hasExtracurricularTutors: 0,
            needsSubjectTutors: 0,
            hasSubjectTutors: 0
        };
    }
    
    const totalStudents = enrollment.students.length;
    let assignedStudents = 0;
    let needsExtracurricularTutors = 0;
    let hasExtracurricularTutors = 0;
    let needsSubjectTutors = 0;
    let hasSubjectTutors = 0;
    let earliestDate = null;
    
    // Check each student
    enrollment.students.forEach(student => {
        const studentAssignment = tutorAssignments.find(a => 
            a.studentName === student.name || 
            (student.name && a.studentName && 
             a.studentName.toLowerCase().includes(student.name.toLowerCase()))
        );
        
        // Check if student has academic tutor
        if (studentAssignment && studentAssignment.hasAcademicTutor) {
            assignedStudents++;
            
            // Check assigned date
            if (studentAssignment.assignedDate) {
                const date = studentAssignment.assignedDate.seconds ? 
                    new Date(studentAssignment.assignedDate.seconds * 1000) : 
                    new Date(studentAssignment.assignedDate);
                
                if (!earliestDate || date < earliestDate) {
                    earliestDate = date;
                }
            }
            
            // Check extracurricular activities - TREAT EACH AS SEPARATE
            if (student.extracurriculars && student.extracurriculars.length > 0) {
                needsExtracurricularTutors += student.extracurriculars.length;
                
                // Count assigned extracurricular tutors
                if (studentAssignment.extracurricularTutors) {
                    hasExtracurricularTutors += studentAssignment.extracurricularTutors.length;
                }
            }
            
            // Check subject-specific tutors
            if (student.selectedSubjects && student.selectedSubjects.length > 0) {
                // For now, assume 1 subject tutor per subject
                needsSubjectTutors += student.selectedSubjects.length;
                
                if (studentAssignment.subjectTutors) {
                    hasSubjectTutors += studentAssignment.subjectTutors.length;
                }
            }
        }
    });
    
    // Determine overall status
    let status = '';
    if (assignedStudents === 0) {
        status = 'Not Assigned';
    } else if (assignedStudents < totalStudents) {
        status = 'Partially Assigned';
    } else {
        // All students have academic tutors
        if (needsExtracurricularTutors > 0 || needsSubjectTutors > 0) {
            const allExtracurricularAssigned = needsExtracurricularTutors === 0 || 
                                            hasExtracurricularTutors === needsExtracurricularTutors;
            const allSubjectAssigned = needsSubjectTutors === 0 || 
                                     hasSubjectTutors === needsSubjectTutors;
            
            if (allExtracurricularAssigned && allSubjectAssigned) {
                status = '✓ Fully Assigned';
            } else if (hasExtracurricularTutors > 0 || hasSubjectTutors > 0) {
                status = 'Partial Specialized';
            } else {
                status = 'Needs Specialized';
            }
        } else {
            status = '✓ Fully Assigned';
        }
    }
    
    return {
        status: status,
        date: earliestDate,
        allAssigned: assignedStudents === totalStudents && 
                    (needsExtracurricularTutors === 0 || hasExtracurricularTutors === needsExtracurricularTutors) &&
                    (needsSubjectTutors === 0 || hasSubjectTutors === needsSubjectTutors),
        assignedCount: assignedStudents,
        totalCount: totalStudents,
        needsExtracurricularTutors: needsExtracurricularTutors,
        hasExtracurricularTutors: hasExtracurricularTutors,
        needsSubjectTutors: needsSubjectTutors,
        hasSubjectTutors: hasSubjectTutors
    };
}

async function fetchAndRenderEnrollments(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('enrollments');
    }

    const enrollmentsList = document.getElementById('enrollments-list');
    if (!enrollmentsList) return;

    try {
        if (!sessionCache.enrollments || forceRefresh) {
            enrollmentsList.innerHTML = `<tr><td colspan="12" class="px-6 py-4 text-center text-gray-500">Fetching enrollments...</td></tr>`;
            
            const snapshot = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt", "desc")));
            const enrollmentsData = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            // Fetch tutor assignments for all enrollments
            const enrollmentsWithAssignments = await Promise.all(enrollmentsData.map(async (enrollment) => {
                const studentNames = enrollment.students?.map(s => s.name) || [];
                const assignments = await checkTutorAssignments(enrollment.id, studentNames);
                const assignmentStatus = getEnrollmentAssignmentStatus(enrollment, assignments);
                
                return {
                    ...enrollment,
                    tutorAssignments: assignments,
                    assignmentStatus: assignmentStatus
                };
            }));
            
            saveToLocalStorage('enrollments', enrollmentsWithAssignments);
        }
        
        renderEnrollmentsFromCache();
    } catch (error) {
        console.error("Error fetching enrollments:", error);
        enrollmentsList.innerHTML = `<tr><td colspan="12" class="px-6 py-4 text-center text-red-500">Failed to load enrollments: ${error.message}</td></tr>`;
    }
}

function renderEnrollmentsFromCache(searchTerm = '') {
    const enrollments = sessionCache.enrollments || [];
    const enrollmentsList = document.getElementById('enrollments-list');
    if (!enrollmentsList) return;

    const statusFilter = document.getElementById('status-filter')?.value || '';
    const dateFrom = document.getElementById('date-from')?.value;
    const dateTo = document.getElementById('date-to')?.value;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    let filteredEnrollments = enrollments.filter(enrollment => {
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
        
        if (statusFilter && enrollment.status !== statusFilter) return false;
        
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

    // Calculate revenue metrics
    let projectedRevenue = 0;
    let confirmedRevenue = 0;
    const paymentMethods = {};
    
    enrollments.forEach(enrollment => {
        const fee = parseFeeValue(enrollment.summary?.totalFee) || 0;
        projectedRevenue += fee;
        
        if (enrollment.status === 'completed' || enrollment.status === 'payment_received') {
            confirmedRevenue += fee;
            
            // Track payment methods
            const paymentMethod = enrollment.payment?.method || 'Unknown';
            if (!paymentMethods[paymentMethod]) {
                paymentMethods[paymentMethod] = 0;
            }
            paymentMethods[paymentMethod] += fee;
        }
    });
    
    // Update revenue display
    document.getElementById('projected-revenue').textContent = `₦${projectedRevenue.toLocaleString()}`;
    document.getElementById('confirmed-revenue').textContent = `₦${confirmedRevenue.toLocaleString()}`;
    
    // Update payment methods chart
    const chartContainer = document.getElementById('payment-methods-chart');
    if (chartContainer) {
        if (Object.keys(paymentMethods).length === 0) {
            chartContainer.innerHTML = '<p class="text-xs text-gray-500">No payment data available</p>';
        } else {
            let chartHtml = '';
            Object.entries(paymentMethods).forEach(([method, amount]) => {
                const percentage = confirmedRevenue > 0 ? Math.round((amount / confirmedRevenue) * 100) : 0;
                chartHtml += `
                    <div class="mb-1">
                        <div class="flex justify-between text-xs">
                            <span>${method}</span>
                            <span>₦${amount.toLocaleString()} (${percentage}%)</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="bg-green-600 h-1.5 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            });
            chartContainer.innerHTML = chartHtml;
        }
    }

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
                <td colspan="12" class="px-6 py-4 text-center text-gray-500">
                    No enrollments found${searchTerm ? ` for "${searchTerm}"` : ''}.
                </td>
            </tr>
        `;
        return;
    }

    const tableRows = filteredEnrollments.map(enrollment => {
        const createdAt = enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString() : 
                        enrollment.timestamp ? new Date(enrollment.timestamp).toLocaleDateString() : 'N/A';
        
        const studentCount = enrollment.students?.length || 0;
        const studentNames = enrollment.students?.map(s => s.name).join(', ') || 'No students';
        
        // Extract academicDays and academicTime
        const firstStudent = enrollment.students && enrollment.students.length > 0 ? enrollment.students[0] : {};
        const academicDays = firstStudent.academicDays || enrollment.academicDays || 'Not specified';
        const academicTime = firstStudent.academicTime || enrollment.academicTime || 'Not specified';
        const daysTimeDisplay = `${academicDays} • ${academicTime}`;
        
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
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>`;
                break;
            case 'payment_received':
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Payment Received</span>`;
                break;
            default:
                statusBadge = `<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">${enrollment.status || 'Unknown'}</span>`;
        }
        
        const totalFeeAmount = parseFeeValue(enrollment.summary?.totalFee);
        const formattedFee = totalFeeAmount > 0 ? `₦${totalFeeAmount.toLocaleString()}` : '₦0';
        
        const referralCode = enrollment.referral?.code || 'None';
        
        // Assigned/Date column - UPDATED WITH COMPREHENSIVE STATUS
        let assignmentStatus = '';
        const assignmentInfo = enrollment.assignmentStatus || getEnrollmentAssignmentStatus(enrollment, enrollment.tutorAssignments || []);
        
        if (assignmentInfo.status === '✓ Fully Assigned') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            
            assignmentStatus = `
                <div class="text-sm" title="All students fully assigned">
                    <span class="text-green-600 font-medium">✓ Assigned</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                    ${assignmentInfo.needsExtracurricularTutors > 0 ? 
                        `<div class="text-xs text-green-500">+${assignmentInfo.hasExtracurricularTutors} extracurricular</div>` : ''}
                    ${assignmentInfo.needsSubjectTutors > 0 ? 
                        `<div class="text-xs text-green-500">+${assignmentInfo.hasSubjectTutors} subject</div>` : ''}
                </div>
            `;
        } else if (assignmentInfo.status === 'Not Assigned') {
            assignmentStatus = `
                <div class="text-sm text-gray-500" title="No tutors assigned">
                    Not Assigned
                </div>
            `;
        } else if (assignmentInfo.status === 'Needs Specialized') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            
            assignmentStatus = `
                <div class="text-sm" title="Academic tutors assigned, but specialized tutors needed">
                    <span class="text-yellow-600 font-medium">Needs Specialized</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                    <div class="text-xs text-yellow-500">
                        ${assignmentInfo.needsExtracurricularTutors > 0 ? 
                            `${assignmentInfo.hasExtracurricularTutors}/${assignmentInfo.needsExtracurricularTutors} extracurricular` : ''}
                        ${assignmentInfo.needsSubjectTutors > 0 ? 
                            `${assignmentInfo.hasSubjectTutors}/${assignmentInfo.needsSubjectTutors} subject` : ''}
                    </div>
                </div>
            `;
        } else if (assignmentInfo.status === 'Partial Specialized') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            
            assignmentStatus = `
                <div class="text-sm" title="Some specialized tutors assigned">
                    <span class="text-blue-600 font-medium">Partial Specialized</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                    <div class="text-xs text-blue-500">
                        ${assignmentInfo.needsExtracurricularTutors > 0 ? 
                            `${assignmentInfo.hasExtracurricularTutors}/${assignmentInfo.needsExtracurricularTutors} extracurricular` : ''}
                        ${assignmentInfo.needsSubjectTutors > 0 ? 
                            `${assignmentInfo.hasSubjectTutors}/${assignmentInfo.needsSubjectTutors} subject` : ''}
                    </div>
                </div>
            `;
        } else if (assignmentInfo.status === 'Partially Assigned') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            
            assignmentStatus = `
                <div class="text-sm" title="Only ${assignmentInfo.assignedCount} of ${assignmentInfo.totalCount} students assigned">
                    <span class="text-yellow-600 font-medium">Partial</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                </div>
            `;
        }
        
        // Determine if enrollment is already approved
        const isApproved = enrollment.status === 'completed' || enrollment.status === 'payment_received';
        
        // Actions column with conditional "Approved" text
        let actionsHTML = '';
        if (isApproved) {
            actionsHTML = `
                <span class="text-green-600 font-medium cursor-help" title="Enrollment was approved on ${createdAt}">
                    Approved
                </span>
            `;
        } else {
            actionsHTML = `
                <button onclick="approveEnrollmentModal('${enrollment.id}')" 
                        class="text-green-600 hover:text-green-900">
                    Approve
                </button>
            `;
        }
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${enrollment.id.substring(0, 12)}...</div>
                    <div class="text-xs text-gray-500">${enrollment.id}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">${enrollment.parent?.name || 'N/A'}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${enrollment.parent?.email || 'N/A'}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${enrollment.parent?.phone || 'N/A'}</td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${studentCount} student(s)</div>
                    <div class="text-xs text-gray-500 truncate max-w-xs">${studentNames}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <div class="text-xs">${daysTimeDisplay}</div>
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-green-600">${formattedFee}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded">${referralCode}</span>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${createdAt}</td>
                <td class="px-6 py-4">${assignmentStatus}</td>
                <td class="px-6 py-4 text-sm font-medium space-x-2">
                    <button onclick="showEnrollmentDetails('${enrollment.id}')" 
                            class="text-indigo-600 hover:text-indigo-900">
                        View
                    </button>
                    ${actionsHTML}
                    <button onclick="deleteEnrollment('${enrollment.id}')" 
                            class="text-red-600 hover:text-red-900">
                        Delete
                    </button>
                    ${isApproved ? `
                    <button onclick="downloadEnrollmentInvoice('${enrollment.id}')" 
                            class="text-blue-600 hover:text-blue-900">
                        Invoice
                    </button>
                    ` : ''}
                    <button onclick="exportSingleEnrollmentToExcel('${enrollment.id}')" 
                            class="text-green-600 hover:text-green-900">
                        Export
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

// Export Functions
function showExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) {
        exportRangeDiv.classList.remove('hidden');
    }
}

function hideExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) {
        exportRangeDiv.classList.add('hidden');
    }
}

async function exportEnrollmentsToExcel() {
    try {
        const exportDateFrom = document.getElementById('export-date-from')?.value;
        const exportDateTo = document.getElementById('export-date-to')?.value;
        
        let enrollmentsToExport = sessionCache.enrollments || [];
        
        // Apply date filter if export range is specified
        if (exportDateFrom || exportDateTo) {
            enrollmentsToExport = enrollmentsToExport.filter(enrollment => {
                const createdDate = new Date(enrollment.createdAt || enrollment.timestamp);
                
                if (exportDateFrom) {
                    const fromDate = new Date(exportDateFrom);
                    if (createdDate < fromDate) return false;
                }
                
                if (exportDateTo) {
                    const toDate = new Date(exportDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (createdDate > toDate) return false;
                }
                
                return true;
            });
        }
        
        if (enrollmentsToExport.length === 0) {
            alert("No enrollments found for the selected criteria.");
            return;
        }
        
        // Prepare data for Excel
        const excelData = enrollmentsToExport.map(enrollment => {
            const studentNames = enrollment.students?.map(s => s.name).join(', ') || '';
            const studentGrades = enrollment.students?.map(s => s.grade || s.actualGrade || '').join(', ') || '';
            const tutorAssignments = enrollment.tutorAssignments || [];
            
            // Collect all tutor information
            const academicTutors = [];
            const extracurricularTutors = [];
            const subjectTutors = [];
            
            tutorAssignments.forEach(assignment => {
                if (assignment.tutorName) {
                    academicTutors.push(`${assignment.studentName}: ${assignment.tutorName}`);
                }
                
                if (assignment.extracurricularTutors) {
                    assignment.extracurricularTutors.forEach(ec => {
                        extracurricularTutors.push(`${assignment.studentName}: ${ec.activity} - ${ec.tutorName}`);
                    });
                }
                
                if (assignment.subjectTutors) {
                    assignment.subjectTutors.forEach(sub => {
                        subjectTutors.push(`${assignment.studentName}: ${sub.subject} - ${sub.tutorName}`);
                    });
                }
            });
            
            return {
                'Application ID': enrollment.id,
                'Parent Name': enrollment.parent?.name || '',
                'Parent Email': enrollment.parent?.email || '',
                'Parent Phone': enrollment.parent?.phone || '',
                'Students': studentNames,
                'Student Grades': studentGrades,
                'Academic Days': enrollment.academicDays || '',
                'Academic Time': enrollment.academicTime || '',
                'Total Fee': `₦${parseFeeValue(enrollment.summary?.totalFee).toLocaleString()}`,
                'Referral Code': enrollment.referral?.code || '',
                'Status': enrollment.status || '',
                'Created Date': enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString() : '',
                'Approval Date': enrollment.approvedAt ? new Date(enrollment.approvedAt?.seconds * 1000).toLocaleDateString() : '',
                'Payment Method': enrollment.payment?.method || '',
                'Payment Reference': enrollment.payment?.reference || '',
                'Payment Amount': `₦${(enrollment.payment?.amount || 0).toLocaleString()}`,
                'Academic Tutors': academicTutors.join('; '),
                'Extracurricular Tutors': extracurricularTutors.join('; '),
                'Subject Tutors': subjectTutors.join('; '),
                'Address': enrollment.parent?.address || '',
                'Notes': enrollment.additionalNotes || ''
            };
        });
        
        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollments");
        
        // Generate Excel file
        const fileName = exportDateFrom || exportDateTo ? 
            `Enrollments_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx` :
            `All_Enrollments.xlsx`;
        
        XLSX.writeFile(workbook, fileName);
        
        // Hide export range picker after successful export
        hideExportRangePicker();
        
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        alert("Failed to export enrollments. Please try again.");
    }
}

// Export single enrollment to Excel
window.exportSingleEnrollmentToExcel = async function(enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = enrollmentDoc.data();
        const studentNames = enrollment.students?.map(s => s.name) || [];
        
        // Fetch fresh assignments using updated logic
        const tutorAssignments = await checkTutorAssignments(enrollmentId, studentNames);
        
        // Prepare detailed data
        const enrollmentData = [{
            'Application ID': enrollmentId,
            'Parent Name': enrollment.parent?.name || '',
            'Parent Email': enrollment.parent?.email || '',
            'Parent Phone': enrollment.parent?.phone || '',
            'Parent Address': enrollment.parent?.address || '',
            'Status': enrollment.status || '',
            'Created Date': enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString() : '',
            'Approval Date': enrollment.approvedAt ? new Date(enrollment.approvedAt?.seconds * 1000).toLocaleDateString() : '',
            'Academic Days': enrollment.academicDays || '',
            'Academic Time': enrollment.academicTime || '',
            'Total Fee': `₦${parseFeeValue(enrollment.summary?.totalFee).toLocaleString()}`,
            'Referral Code': enrollment.referral?.code || '',
            'Payment Method': enrollment.payment?.method || '',
            'Payment Reference': enrollment.payment?.reference || '',
            'Payment Amount': `₦${(enrollment.payment?.amount || 0).toLocaleString()}`,
            'Approved By': enrollment.payment?.approvedBy || ''
        }];

        // Prepare students data
        const studentsData = enrollment.students?.map(student => {
            const studentAssignment = tutorAssignments.find(a => 
                a.studentName === student.name || 
                (student.name && a.studentName && 
                 a.studentName.toLowerCase().includes(student.name.toLowerCase()))
            );
            
            // Extract tutor information
            let academicTutor = 'Not Assigned';
            let academicAssignmentDate = 'Not Assigned';
            let extracurricularInfo = '';
            let subjectTutorInfo = '';
            
            if (studentAssignment) {
                if (studentAssignment.tutorName) {
                    academicTutor = studentAssignment.tutorName;
                    academicAssignmentDate = studentAssignment.assignedDate ? 
                        new Date(studentAssignment.assignedDate?.seconds * 1000 || studentAssignment.assignedDate).toLocaleDateString() : 
                        'Unknown date';
                }
                
                // Extracurricular tutors
                if (studentAssignment.extracurricularTutors && studentAssignment.extracurricularTutors.length > 0) {
                    extracurricularInfo = studentAssignment.extracurricularTutors.map(ec => 
                        `${ec.activity}: ${ec.tutorName || 'Not assigned'}`
                    ).join('; ');
                }
                
                // Subject tutors
                if (studentAssignment.subjectTutors && studentAssignment.subjectTutors.length > 0) {
                    subjectTutorInfo = studentAssignment.subjectTutors.map(sub => 
                        `${sub.subject}: ${sub.tutorName || 'Not assigned'}`
                    ).join('; ');
                }
            }
            
            return {
                'Student Name': student.name || '',
                'Grade': student.grade || '',
                'Actual Grade': student.actualGrade || '',
                'DOB': student.dob || '',
                'Gender': student.gender || '',
                'Start Date': student.startDate || '',
                'Preferred Tutor': student.preferredTutor || '',
                'Academic Days': student.academicDays || '',
                'Academic Time': student.academicTime || '',
                'Subjects': student.selectedSubjects?.join(', ') || '',
                'Extracurricular': student.extracurriculars?.map(e => `${e.name} (${e.frequency})`).join(', ') || '',
                'Test Prep': student.testPrep?.map(t => `${t.name} (${t.hours} hrs)`).join(', ') || '',
                'Academic Tutor': academicTutor,
                'Academic Assignment Date': academicAssignmentDate,
                'Extracurricular Tutors': extracurricularInfo,
                'Subject Tutors': subjectTutorInfo,
                'Notes': student.additionalNotes || ''
            };
        }) || [];

        // Create workbook with multiple sheets
        const workbook = XLSX.utils.book_new();
        
        // Enrollment details sheet
        const enrollmentSheet = XLSX.utils.json_to_sheet(enrollmentData);
        XLSX.utils.book_append_sheet(workbook, enrollmentSheet, "Enrollment");
        
        // Students sheet
        if (studentsData.length > 0) {
            const studentsSheet = XLSX.utils.json_to_sheet(studentsData);
            XLSX.utils.book_append_sheet(workbook, studentsSheet, "Students");
        }
        
        // Fee breakdown sheet
        if (enrollment.summary) {
            const feeData = [{
                'Academic Fees': `₦${parseFeeValue(enrollment.summary.academicFee).toLocaleString()}`,
                'Extracurricular Fees': `₦${parseFeeValue(enrollment.summary.extracurricularFee).toLocaleString()}`,
                'Test Prep Fees': `₦${parseFeeValue(enrollment.summary.testPrepFee).toLocaleString()}`,
                'Discount': `-₦${parseFeeValue(enrollment.summary.discountAmount).toLocaleString()}`,
                'Total Fee': `₦${parseFeeValue(enrollment.summary.totalFee).toLocaleString()}`
            }];
            const feeSheet = XLSX.utils.json_to_sheet(feeData);
            XLSX.utils.book_append_sheet(workbook, feeSheet, "Fees");
        }
        
        // Tutor assignments sheet
        if (tutorAssignments.length > 0) {
            const tutorData = tutorAssignments.flatMap(assignment => {
                const rows = [];
                
                // Academic tutor row
                if (assignment.tutorName) {
                    rows.push({
                        'Student': assignment.studentName,
                        'Type': 'Academic',
                        'Subject/Activity': 'General',
                        'Tutor Name': assignment.tutorName,
                        'Tutor Email': assignment.tutorEmail || '',
                        'Assigned Date': assignment.assignedDate ? 
                            new Date(assignment.assignedDate?.seconds * 1000 || assignment.assignedDate).toLocaleDateString() : 
                            'Unknown'
                    });
                }
                
                // Extracurricular tutor rows
                if (assignment.extracurricularTutors) {
                    assignment.extracurricularTutors.forEach(ec => {
                        rows.push({
                            'Student': assignment.studentName,
                            'Type': 'Extracurricular',
                            'Subject/Activity': ec.activity || 'Unknown',
                            'Tutor Name': ec.tutorName || 'Not assigned',
                            'Tutor Email': ec.tutorEmail || '',
                            'Assigned Date': ec.assignedDate ? 
                                new Date(ec.assignedDate?.seconds * 1000 || ec.assignedDate).toLocaleDateString() : 
                                'Unknown'
                        });
                    });
                }
                
                // Subject tutor rows
                if (assignment.subjectTutors) {
                    assignment.subjectTutors.forEach(sub => {
                        rows.push({
                            'Student': assignment.studentName,
                            'Type': 'Subject',
                            'Subject/Activity': sub.subject || 'Unknown',
                            'Tutor Name': sub.tutorName || 'Not assigned',
                            'Tutor Email': sub.tutorEmail || '',
                            'Assigned Date': sub.assignedDate ? 
                                new Date(sub.assignedDate?.seconds * 1000 || sub.assignedDate).toLocaleDateString() : 
                                'Unknown'
                        });
                    });
                }
                
                return rows;
            });
            
            if (tutorData.length > 0) {
                const tutorsSheet = XLSX.utils.json_to_sheet(tutorData);
                XLSX.utils.book_append_sheet(workbook, tutorsSheet, "Tutor Assignments");
            }
        }
        
        // Generate file
        const fileName = `Enrollment_${enrollmentId.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
    } catch (error) {
        console.error("Error exporting single enrollment:", error);
        alert("Failed to export enrollment details. Please try again.");
    }
};

// UPDATED: Enrollment Details Modal with Comprehensive Tutor Assignments UNDER EACH STUDENT
window.showEnrollmentDetails = async function(enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
        
        // Check for tutor assignments using the updated checkTutorAssignments function
        const studentNames = enrollment.students?.map(s => s.name) || [];
        const tutorAssignments = await checkTutorAssignments(enrollmentId, studentNames);
        
        const createdAt = enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleString() : 
                         enrollment.timestamp ? new Date(enrollment.timestamp).toLocaleString() : 'N/A';
        
        // Build students HTML with tutor assignments integrated under each student
        let studentsHTML = '';
        if (enrollment.students && enrollment.students.length > 0) {
            studentsHTML = enrollment.students.map((student, index) => {
                // Find tutor assignment for this specific student
                const studentAssignment = tutorAssignments.find(a => 
                    a.studentName === student.name || 
                    (student.name && a.studentName && 
                     a.studentName.toLowerCase().includes(student.name.toLowerCase()))
                );
                
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
                
                // Academic days and time
                const academicDays = student.academicDays || enrollment.academicDays || 'Not specified';
                const academicTime = student.academicTime || enrollment.academicTime || 'Not specified';
                
                // Tutor assignment info - USING THE EXTRACTED COMPREHENSIVE FUNCTION
                const tutorHTML = buildComprehensiveStudentTutorAssignmentsHTML(student, studentAssignment, enrollment);
                
                // Determine overall assignment status for badge
                let assignmentStatusBadge = '';
                let assignmentStatusText = '';
                
                if (studentAssignment) {
                    // Count total assignments needed vs assigned
                    const totalNeeded = 1 + (student.extracurriculars?.length || 0) + (student.selectedSubjects?.length || 0);
                    let totalAssigned = 0;
                    
                    if (studentAssignment.hasAcademicTutor) totalAssigned++;
                    if (studentAssignment.extracurricularTutors) totalAssigned += studentAssignment.extracurricularTutors.length;
                    if (studentAssignment.subjectTutors) totalAssigned += studentAssignment.subjectTutors.length;
                    
                    if (totalAssigned === 0) {
                        assignmentStatusBadge = 'bg-red-100 text-red-800';
                        assignmentStatusText = 'Unassigned';
                    } else if (totalAssigned < totalNeeded) {
                        assignmentStatusBadge = 'bg-yellow-100 text-yellow-800';
                        assignmentStatusText = 'Partial';
                    } else {
                        assignmentStatusBadge = 'bg-green-100 text-green-800';
                        assignmentStatusText = 'Fully Assigned';
                    }
                } else {
                    assignmentStatusBadge = 'bg-red-100 text-red-800';
                    assignmentStatusText = 'Unassigned';
                }
                
                return `
                    <div class="border rounded-lg p-4 mb-4 bg-gray-50">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-bold text-lg text-gray-800">${student.name || 'Unnamed Student'}</h4>
                            <span class="px-2 py-1 text-xs rounded-full ${assignmentStatusBadge}">
                                ${assignmentStatusText}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                            <p><strong>Grade:</strong> ${student.grade || 'N/A'}</p>
                            <p><strong>DOB:</strong> ${student.dob || 'N/A'}</p>
                            <p><strong>Start Date:</strong> ${student.startDate || 'N/A'}</p>
                            <p><strong>Gender:</strong> ${student.gender || 'N/A'}</p>
                            <p><strong>Preferred Tutor:</strong> ${student.preferredTutor || 'N/A'}</p>
                            <p><strong>Actual Grade:</strong> ${student.actualGrade || 'N/A'}</p>
                            <p><strong>Academic Days:</strong> ${academicDays}</p>
                            <p><strong>Academic Time:</strong> ${academicTime}</p>
                        </div>
                        
                        <!-- Tutor Assignment Section - Integrated under each student -->
                        ${tutorHTML}
                        
                        <!-- Additional Information -->
                        <div class="mt-3">
                            ${subjectsHTML}
                            ${extracurricularHTML}
                            ${testPrepHTML}
                            ${student.additionalNotes ? `<p class="text-sm mt-2"><strong>Notes:</strong> ${student.additionalNotes}</p>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Build referral HTML
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

        // Build payment HTML
        let paymentHTML = '';
        if (enrollment.payment) {
            const paymentDate = enrollment.payment.date ? 
                new Date(enrollment.payment.date.seconds * 1000).toLocaleDateString() : 
                'N/A';
            paymentHTML = `
                <div class="border-l-4 border-blue-500 pl-4 bg-blue-50 p-3 rounded">
                    <h4 class="font-bold text-blue-700">Payment Information</h4>
                    <p><strong>Method:</strong> ${enrollment.payment.method || 'N/A'}</p>
                    ${enrollment.payment.reference ? `<p><strong>Reference:</strong> ${enrollment.payment.reference}</p>` : ''}
                    ${enrollment.payment.date ? `<p><strong>Date:</strong> ${paymentDate}</p>` : ''}
                    ${enrollment.payment.approvedBy ? `<p><strong>Approved By:</strong> ${enrollment.payment.approvedBy}</p>` : ''}
                    <p><strong>Amount:</strong> ₦${(enrollment.payment.amount || 0).toLocaleString()}</p>
                </div>
            `;
        }

        // Build fee breakdown HTML
        let feeBreakdownHTML = '';
        if (enrollment.summary) {
            const summary = enrollment.summary;
            
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

        const isApproved = enrollment.status === 'completed' || enrollment.status === 'payment_received';
        const approveButtonHTML = isApproved ? 
            '<span class="px-4 py-2 bg-green-100 text-green-800 rounded cursor-help" title="This enrollment has already been approved">Approved</span>' : 
            `<button onclick="approveEnrollmentModal('${enrollment.id}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>`;

        const modalHtml = `
            <div id="enrollmentDetailsModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
                    <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('enrollmentDetailsModal')">&times;</button>
                    <h3 class="text-2xl font-bold mb-4 text-green-700">Enrollment Details</h3>
                    
                    <div class="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <h4 class="font-bold text-lg mb-2">Application Information</h4>
                            <p><strong>ID:</strong> ${enrollment.id}</p>
                            <p><strong>Status:</strong> <span class="px-2 py-1 text-xs rounded-full ${enrollment.status === 'completed' || enrollment.status === 'payment_received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${enrollment.status || 'Unknown'}</span></p>
                            <p><strong>Created:</strong> ${createdAt}</p>
                            ${enrollment.lastSaved ? `<p><strong>Last Saved:</strong> ${new Date(enrollment.lastSaved).toLocaleString()}</p>` : ''}
                            ${enrollment.approvedAt ? `<p><strong>Approved:</strong> ${new Date(enrollment.approvedAt?.seconds * 1000).toLocaleDateString()}</p>` : ''}
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
                    ${paymentHTML}
                    
                    <div class="mt-6">
                        <h4 class="font-bold text-lg mb-2">Student Information (${enrollment.students?.length || 0} students)</h4>
                        <p class="text-sm text-gray-600 mb-3">Tutor assignments are shown under each student</p>
                        ${studentsHTML || '<p class="text-gray-500">No student information available.</p>'}
                    </div>
                    
                    <div class="mt-6">
                        <h4 class="font-bold text-lg mb-2">Fee Breakdown</h4>
                        ${feeBreakdownHTML || '<p class="text-gray-500">No fee breakdown available.</p>'}
                    </div>
                    
                    <div class="flex justify-end space-x-3 mt-6 pt-6 border-t">
                        <button onclick="closeManagementModal('enrollmentDetailsModal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Close</button>
                        ${approveButtonHTML}
                        <button onclick="downloadEnrollmentInvoice('${enrollment.id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Download Invoice</button>
                        <button onclick="exportSingleEnrollmentToExcel('${enrollment.id}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Export Details</button>
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

// ENHANCED: Enrollment Approval Modal with support for academic, extracurricular, and subject tutors
window.approveEnrollmentModal = async function(enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = enrollmentDoc.data();
        
        // Get tutors for assignment from tutor directory
        let tutors = sessionCache.tutors || [];
        if (tutors.length === 0) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), where("status", "==", "active")));
            tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToLocalStorage('tutors', tutors);
        }
        
        if (tutors.length === 0) {
            alert("No active tutors available. Please add tutors first.");
            return;
        }
        
        // Get academic days and time from enrollment
        const firstStudent = enrollment.students && enrollment.students.length > 0 ? enrollment.students[0] : {};
        const academicDays = firstStudent.academicDays || enrollment.academicDays || '';
        const academicTime = firstStudent.academicTime || enrollment.academicTime || '';
        
        // Generate student assignment sections
        let studentAssignmentHTML = '';
        if (enrollment.students && enrollment.students.length > 0) {
            studentAssignmentHTML = enrollment.students.map((student, studentIndex) => {
                // Get extracurricular activities for this student
                const extracurricularActivities = student.extracurriculars || [];
                const subjects = student.selectedSubjects || [];
                
                let extracurricularHTML = '';
                if (extracurricularActivities.length > 0) {
                    extracurricularHTML = extracurricularActivities.map((activity, ecIndex) => `
                        <div class="mb-3 p-3 border rounded bg-blue-50">
                            <div class="flex justify-between items-center mb-2">
                                <p class="font-medium">${activity.name}</p>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${activity.frequency}</span>
                            </div>
                            <div class="relative">
                                <input type="text" 
                                       id="ec-tutor-search-${studentIndex}-${ecIndex}" 
                                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm"
                                       placeholder="Search tutor for ${activity.name}..."
                                       autocomplete="off">
                                <div id="ec-tutor-results-${studentIndex}-${ecIndex}" class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto hidden"></div>
                                <input type="hidden" name="ec-tutor-assignment-${studentIndex}-${ecIndex}" id="selected-ec-tutor-${studentIndex}-${ecIndex}" value="">
                            </div>
                        </div>
                    `).join('');
                }
                
                let subjectsHTML = '';
                if (subjects.length > 0) {
                    subjectsHTML = subjects.map((subject, subIndex) => `
                        <div class="mb-3 p-3 border rounded bg-purple-50">
                            <div class="flex justify-between items-center mb-2">
                                <p class="font-medium">${subject}</p>
                                <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Subject</span>
                            </div>
                            <div class="relative">
                                <input type="text" 
                                       id="sub-tutor-search-${studentIndex}-${subIndex}" 
                                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm"
                                       placeholder="Search tutor for ${subject}..."
                                       autocomplete="off">
                                <div id="sub-tutor-results-${studentIndex}-${subIndex}" class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto hidden"></div>
                                <input type="hidden" name="sub-tutor-assignment-${studentIndex}-${subIndex}" id="selected-sub-tutor-${studentIndex}-${subIndex}" value="">
                            </div>
                        </div>
                    `).join('');
                }
                
                return `
                    <div class="mb-6 p-4 border rounded-lg bg-gray-50">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-bold text-lg">${student.name || 'Student ' + (studentIndex + 1)}</h4>
                            <span class="text-sm text-gray-600">Grade: ${student.grade || 'N/A'}</span>
                        </div>
                        
                        <!-- Academic Tutor Section -->
                        <div class="mb-4">
                            <p class="font-medium mb-2 text-green-700">Academic Tutor</p>
                            <div class="relative">
                                <input type="text" 
                                       id="tutor-search-${studentIndex}" 
                                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                                       placeholder="Search academic tutor..."
                                       autocomplete="off">
                                <div id="tutor-results-${studentIndex}" class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto hidden"></div>
                                <input type="hidden" name="tutor-assignment-${studentIndex}" id="selected-tutor-${studentIndex}" value="">
                            </div>
                        </div>
                        
                        <!-- Extracurricular Tutors Section -->
                        ${extracurricularActivities.length > 0 ? `
                            <div class="mb-4">
                                <p class="font-medium mb-2 text-blue-700">Extracurricular Tutors</p>
                                ${extracurricularHTML}
                            </div>
                        ` : ''}
                        
                        <!-- Subject Tutors Section -->
                        ${subjects.length > 0 ? `
                            <div class="mb-4">
                                <p class="font-medium mb-2 text-purple-700">Subject-Specific Tutors</p>
                                ${subjectsHTML}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        const modalHtml = `
            <div id="approveEnrollmentModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div class="relative p-8 bg-white w-full max-w-4xl mx-auto my-8 rounded-lg shadow-xl" style="max-height: 90vh; overflow-y: auto;">
                    <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('approveEnrollmentModal')">&times;</button>
                    <h3 class="text-2xl font-bold mb-6">Approve Enrollment - ${enrollmentId.substring(0, 8)}</h3>
                    <form id="approve-enrollment-form">
                        <input type="hidden" id="approve-enrollment-id" value="${enrollmentId}">
                        
                        <!-- Enrollment Information -->
                        <div class="mb-6 grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Payment Method *</label>
                                <select id="payment-method" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                                    <option value="">Select payment method</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="debit_card">Debit Card</option>
                                    <option value="cash">Cash</option>
                                    <option value="online_payment">Online Payment</option>
                                    <option value="pos">POS</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Payment Date</label>
                                <input type="date" id="payment-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Payment Reference (Optional)</label>
                                <input type="text" id="payment-reference" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="e.g., transaction ID">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Final Fee (₦) *</label>
                                <input type="number" id="final-fee" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" 
                                       value="${enrollment.summary?.totalFee || 0}" min="0" step="1000">
                            </div>
                        </div>
                        
                        <!-- Schedule Information -->
                        <div class="mb-6 grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Academic Days *</label>
                                <input type="text" id="academic-days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" 
                                       value="${academicDays}" placeholder="e.g., Monday, Wednesday, Friday" required>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Academic Time *</label>
                                <input type="text" id="academic-time" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" 
                                       value="${academicTime}" placeholder="e.g., 3:00 PM - 5:00 PM" required>
                            </div>
                        </div>
                        
                        <!-- Status -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium mb-2">Status *</label>
                            <select id="enrollment-status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                                <option value="completed">Completed</option>
                                <option value="payment_received">Payment Received</option>
                            </select>
                        </div>
                        
                        <!-- Student Tutor Assignments -->
                        <div class="mb-6">
                            <h4 class="text-lg font-bold mb-4">Tutor Assignments</h4>
                            <p class="text-sm text-gray-600 mb-4">Assign tutors for each student below. Academic tutors are required. Each extracurricular activity requires its own tutor.</p>
                            ${studentAssignmentHTML}
                        </div>
                        
                        <div class="flex justify-end space-x-3 mt-6 pt-6 border-t">
                            <button type="button" onclick="closeManagementModal('approveEnrollmentModal')" 
                                    class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                Approve Enrollment
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Initialize tutor search for all fields
        if (enrollment.students) {
            enrollment.students.forEach((student, studentIndex) => {
                // Academic tutor
                initializeTutorSearch(
                    `tutor-search-${studentIndex}`,
                    `tutor-results-${studentIndex}`,
                    `selected-tutor-${studentIndex}`,
                    tutors
                );
                
                // Extracurricular tutors - EACH ACTIVITY GETS ITS OWN FIELD
                if (student.extracurriculars) {
                    student.extracurriculars.forEach((activity, ecIndex) => {
                        initializeTutorSearch(
                            `ec-tutor-search-${studentIndex}-${ecIndex}`,
                            `ec-tutor-results-${studentIndex}-${ecIndex}`,
                            `selected-ec-tutor-${studentIndex}-${ecIndex}`,
                            tutors
                        );
                    });
                }
                
                // Subject tutors
                if (student.selectedSubjects) {
                    student.selectedSubjects.forEach((subject, subIndex) => {
                        initializeTutorSearch(
                            `sub-tutor-search-${studentIndex}-${subIndex}`,
                            `sub-tutor-results-${studentIndex}-${subIndex}`,
                            `selected-sub-tutor-${studentIndex}-${subIndex}`,
                            tutors
                        );
                    });
                }
            });
        }
        
        // Form submission
        document.getElementById('approve-enrollment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await approveEnrollmentWithDetails(enrollmentId);
        });
        
    } catch (error) {
        console.error("Error showing approve modal:", error);
        alert("Failed to load approval form. Please try again.");
    }
};

// Helper function to initialize tutor search fields
function initializeTutorSearch(searchInputId, resultsContainerId, hiddenInputId, tutors) {
    const searchInput = document.getElementById(searchInputId);
    const resultsContainer = document.getElementById(resultsContainerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    
    if (!searchInput || !resultsContainer || !hiddenInput) return;
    
    // Add focus event to show all tutors initially
    searchInput.addEventListener('focus', function() {
        displayTutorResults(this.value, tutors, resultsContainer, hiddenInput, searchInput);
    });
    
    // Add input event for searching
    searchInput.addEventListener('input', function() {
        displayTutorResults(this.value, tutors, resultsContainer, hiddenInput, searchInput);
    });
    
    // Close results when clicking outside
    document.addEventListener('click', function(event) {
        if (!searchInput.contains(event.target) && !resultsContainer.contains(event.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
}

function displayTutorResults(searchTerm, tutors, resultsContainer, hiddenInput, searchInput) {
    const term = searchTerm.toLowerCase().trim();
    let filteredTutors = tutors;
    
    if (term) {
        filteredTutors = tutors.filter(tutor => 
            (tutor.name && tutor.name.toLowerCase().includes(term)) || 
            (tutor.email && tutor.email.toLowerCase().includes(term)) ||
            (tutor.subjects && Array.isArray(tutor.subjects) && 
                tutor.subjects.some(subject => subject.toLowerCase().includes(term))) ||
            (tutor.specializations && Array.isArray(tutor.specializations) && 
                tutor.specializations.some(spec => spec.toLowerCase().includes(term)))
        );
    }
    
    if (filteredTutors.length === 0) {
        resultsContainer.innerHTML = '<div class="p-2 text-sm text-gray-500">No tutors found</div>';
        resultsContainer.classList.remove('hidden');
        return;
    }
    
    const resultsHTML = filteredTutors.map(tutor => `
        <div class="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 tutor-option" 
             data-tutor-email="${tutor.email}"
             data-tutor-name="${tutor.name}"
             data-tutor-id="${tutor.id}">
            <div class="font-medium">${tutor.name}</div>
            <div class="text-xs text-gray-500">${tutor.email}</div>
            <div class="text-xs text-green-600 mt-1">
                ${tutor.subjects && tutor.subjects.length > 0 ? `Subjects: ${tutor.subjects.join(', ')}` : ''}
                ${tutor.specializations && tutor.specializations.length > 0 ? ` | Specializations: ${tutor.specializations.join(', ')}` : ''}
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = resultsHTML;
    resultsContainer.classList.remove('hidden');
    
    // Add click event to tutor options
    resultsContainer.querySelectorAll('.tutor-option').forEach(option => {
        option.addEventListener('click', function() {
            const tutorEmail = this.getAttribute('data-tutor-email');
            const tutorName = this.getAttribute('data-tutor-name');
            const tutorId = this.getAttribute('data-tutor-id');
            
            hiddenInput.value = tutorId || tutorEmail;
            searchInput.value = tutorName;
            resultsContainer.classList.add('hidden');
        });
    });
}

// ENHANCED: Approve enrollment with academic, extracurricular, and subject tutors
async function approveEnrollmentWithDetails(enrollmentId) {
    const form = document.getElementById('approve-enrollment-form');
    if (!form) return;
    
    // Collect form data
    const paymentMethod = form.elements['payment-method'].value;
    const paymentReference = form.elements['payment-reference'].value;
    const paymentDate = form.elements['payment-date'].value;
    const finalFee = parseFloat(form.elements['final-fee'].value);
    const academicDays = form.elements['academic-days'].value;
    const academicTime = form.elements['academic-time'].value;
    const enrollmentStatus = form.elements['enrollment-status'].value;
    
    // Validation
    if (!paymentMethod) {
        alert("Please select a payment method.");
        return;
    }
    
    if (isNaN(finalFee) || finalFee < 0) {
        alert("Please enter a valid fee amount.");
        return;
    }
    
    if (!academicDays || !academicTime) {
        alert("Please enter academic days and time.");
        return;
    }
    
    try {
        // Get enrollment data
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        const enrollmentData = enrollmentDoc.data();
        
        // Collect tutor assignments
        const studentAssignments = [];
        const errors = [];
        
        // Process each student
        enrollmentData.students.forEach((student, studentIndex) => {
            // Check academic tutor
            const academicTutorId = document.getElementById(`selected-tutor-${studentIndex}`)?.value;
            if (!academicTutorId) {
                errors.push(`Please select an academic tutor for student: ${student.name}`);
                return;
            }
            
            // Get tutor info
            const tutors = sessionCache.tutors || [];
            const academicTutor = tutors.find(t => t.id === academicTutorId || t.email === academicTutorId);
            if (!academicTutor) {
                errors.push(`Invalid tutor selected for student: ${student.name}`);
                return;
            }
            
            // Collect extracurricular tutor assignments - EACH ACTIVITY SEPARATELY
            const extracurricularTutors = [];
            if (student.extracurriculars) {
                student.extracurriculars.forEach((activity, ecIndex) => {
                    const ecTutorId = document.getElementById(`selected-ec-tutor-${studentIndex}-${ecIndex}`)?.value;
                    if (ecTutorId) {
                        const ecTutor = tutors.find(t => t.id === ecTutorId || t.email === ecTutorId);
                        if (ecTutor) {
                            extracurricularTutors.push({
                                activity: activity.name,
                                tutorId: ecTutor.id,
                                tutorName: ecTutor.name,
                                tutorEmail: ecTutor.email,
                                assignedDate: Timestamp.now(),
                                frequency: activity.frequency
                            });
                        } else {
                            // Note: Extracurricular tutors are optional but can be assigned
                            extracurricularTutors.push({
                                activity: activity.name,
                                tutorId: null,
                                tutorName: null,
                                tutorEmail: null,
                                assignedDate: null,
                                frequency: activity.frequency
                            });
                        }
                    } else {
                        // No tutor selected for this extracurricular activity
                        extracurricularTutors.push({
                            activity: activity.name,
                            tutorId: null,
                            tutorName: null,
                            tutorEmail: null,
                            assignedDate: null,
                            frequency: activity.frequency
                        });
                    }
                });
            }
            
            // Collect subject tutor assignments
            const subjectTutors = [];
            if (student.selectedSubjects) {
                student.selectedSubjects.forEach((subject, subIndex) => {
                    const subTutorId = document.getElementById(`selected-sub-tutor-${studentIndex}-${subIndex}`)?.value;
                    if (subTutorId) {
                        const subTutor = tutors.find(t => t.id === subTutorId || t.email === subTutorId);
                        if (subTutor) {
                            subjectTutors.push({
                                subject: subject,
                                tutorId: subTutor.id,
                                tutorName: subTutor.name,
                                tutorEmail: subTutor.email,
                                assignedDate: Timestamp.now()
                            });
                        }
                    }
                });
            }
            
            studentAssignments.push({
                studentName: student.name,
                studentId: `student_${enrollmentId}_${studentIndex}_${Date.now()}`,
                academicTutor: {
                    tutorId: academicTutor.id,
                    tutorName: academicTutor.name,
                    tutorEmail: academicTutor.email
                },
                extracurricularTutors: extracurricularTutors,
                subjectTutors: subjectTutors,
                grade: student.grade,
                subjects: student.selectedSubjects || [],
                extracurriculars: student.extracurriculars || [],
                academicDays: academicDays,
                academicTime: academicTime,
                studentFee: Math.round(finalFee / enrollmentData.students.length),
                enrollmentId: enrollmentId
            });
        });
        
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }
        
        if (studentAssignments.length === 0) {
            alert("Please assign tutors to all students.");
            return;
        }
        
        // Create batch for all operations
        const batch = writeBatch(db);
        
        // Update enrollment status
        batch.update(doc(db, "enrollments", enrollmentId), {
            status: enrollmentStatus,
            payment: {
                method: paymentMethod,
                reference: paymentReference || '',
                date: Timestamp.fromDate(new Date(paymentDate)),
                amount: finalFee,
                approvedBy: window.userData?.name || window.userData?.email || 'Management',
                approvedAt: Timestamp.now()
            },
            finalFee: finalFee,
            academicDays: academicDays,
            academicTime: academicTime,
            approvedAt: Timestamp.now(),
            approvedBy: window.userData?.email || 'management',
            lastUpdated: Timestamp.now()
        });
        
        // Create student entries with comprehensive tutor assignments
        studentAssignments.forEach(student => {
            const studentRef = doc(collection(db, "students"));
            
            // Prepare student data
            const studentData = {
                name: student.studentName,
                enrollmentId: enrollmentId,
                parentName: enrollmentData.parent?.name,
                parentPhone: enrollmentData.parent?.phone,
                parentEmail: enrollmentData.parent?.email,
                parentAddress: enrollmentData.parent?.address,
                grade: student.grade,
                academicDays: student.academicDays,
                academicTime: student.academicTime,
                subjects: student.subjects,
                extracurriculars: student.extracurriculars,
                testPrep: enrollmentData.students?.find(s => s.name === student.studentName)?.testPrep || [],
                preferredTutor: enrollmentData.students?.find(s => s.name === student.studentName)?.preferredTutor || '',
                additionalNotes: enrollmentData.students?.find(s => s.name === student.studentName)?.additionalNotes || '',
                
                // Tutor assignments
                tutorId: student.academicTutor.tutorId,
                tutorName: student.academicTutor.tutorName,
                tutorEmail: student.academicTutor.tutorEmail,
                assignedDate: Timestamp.now(),
                
                // Specialized tutors
                extracurricularTutors: student.extracurricularTutors,
                subjectTutors: student.subjectTutors,
                
                // Status and timestamps
                status: 'active',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                
                // Academic information
                startDate: enrollmentData.students?.find(s => s.name === student.studentName)?.startDate || '',
                actualGrade: enrollmentData.students?.find(s => s.name === student.studentName)?.actualGrade || '',
                dob: enrollmentData.students?.find(s => s.name === student.studentName)?.dob || '',
                gender: enrollmentData.students?.find(s => s.name === student.studentName)?.gender || '',
                
                // Fee information
                studentFee: student.studentFee,
                paymentStatus: 'pending'
            };
            
            batch.set(studentRef, studentData);
            
            // Also create pending student entry for notifications
            const pendingRef = doc(collection(db, "pending_students"));
            batch.set(pendingRef, {
                studentName: student.studentName,
                tutorName: student.academicTutor.tutorName,
                tutorEmail: student.academicTutor.tutorEmail,
                grade: student.grade,
                subjects: student.subjects,
                academicDays: student.academicDays,
                academicTime: student.academicTime,
                parentName: enrollmentData.parent?.name,
                parentPhone: enrollmentData.parent?.phone,
                parentEmail: enrollmentData.parent?.email,
                enrollmentId: enrollmentId,
                status: 'pending',
                createdAt: Timestamp.now(),
                source: 'enrollment_approval',
                note: 'Enrollment approved and tutor assigned'
            });
        });
        
        // Commit all changes
        await batch.commit();
        
        alert("Enrollment approved successfully! Students and tutor assignments have been created.");
        
        closeManagementModal('approveEnrollmentModal');
        invalidateCache('enrollments');
        invalidateCache('pendingStudents');
        invalidateCache('students');
        
        // Refresh the view
        const currentNavId = document.querySelector('.nav-item.active')?.dataset.navId;
        const mainContent = document.getElementById('main-content');
        if (currentNavId && allNavItems[currentNavId] && mainContent) {
            allNavItems[currentNavId].fn(mainContent);
        }
        
    } catch (error) {
        console.error("Error approving enrollment:", error);
        alert("Failed to approve enrollment. Please try again.");
    }
}

window.deleteEnrollment = async function(enrollmentId) {
    if (!confirm("Are you sure you want to delete this enrollment? This action cannot be undone.")) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "enrollments", enrollmentId));
        alert("Enrollment deleted successfully!");
        
        invalidateCache('enrollments');
        renderEnrollmentsFromCache(document.getElementById('enrollments-search')?.value || '');
        
    } catch (error) {
        console.error("Error deleting enrollment:", error);
        alert("Failed to delete enrollment. Please try again.");
    }
};

window.downloadEnrollmentInvoice = async function(enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }
        
        const enrollment = enrollmentDoc.data();
        
        // Create invoice HTML
        const invoiceDate = new Date(enrollment.approvedAt || enrollment.createdAt || Date.now());
        const invoiceNumber = `INV-${enrollmentId.substring(0, 8).toUpperCase()}`;
        
        // Get academic days and time
        const firstStudent = enrollment.students && enrollment.students.length > 0 ? enrollment.students[0] : {};
        const academicDays = firstStudent.academicDays || enrollment.academicDays || 'Not specified';
        const academicTime = firstStudent.academicTime || enrollment.academicTime || 'Not specified';
        
        // Get tutor information
        const studentNames = enrollment.students?.map(s => s.name) || [];
        const tutorAssignments = await checkTutorAssignments(enrollmentId, studentNames);
        
        // Prepare tutor information for invoice
        let tutorInfoHTML = '';
        if (tutorAssignments.length > 0) {
            tutorInfoHTML = tutorAssignments.map(assignment => {
                let tutorDetails = '';
                if (assignment.tutorName) {
                    tutorDetails += `<p><strong>${assignment.studentName}:</strong> ${assignment.tutorName}`;
                    
                    // Add extracurricular tutors if any
                    if (assignment.extracurricularTutors && assignment.extracurricularTutors.length > 0) {
                        tutorDetails += ` (Extracurricular: ${assignment.extracurricularTutors.map(ec => `${ec.activity}: ${ec.tutorName}`).join(', ')})`;
                    }
                    
                    // Add subject tutors if any
                    if (assignment.subjectTutors && assignment.subjectTutors.length > 0) {
                        tutorDetails += ` (Subjects: ${assignment.subjectTutors.map(sub => `${sub.subject}: ${sub.tutorName}`).join(', ')})`;
                    }
                    
                    tutorDetails += `</p>`;
                }
                return tutorDetails;
            }).join('');
        }
        
        const invoiceHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Invoice ${invoiceNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; }
                    .company-name { font-size: 28px; font-weight: bold; color: #4CAF50; margin-bottom: 5px; }
                    .invoice-title { font-size: 24px; margin: 10px 0; }
                    .invoice-info { display: flex; justify-content: space-between; margin: 20px 0; }
                    .section { margin: 20px 0; }
                    .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .total-row { font-weight: bold; background-color: #f9f9f9; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
                    .tutor-info { background-color: #f0f8ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="header">
                        <div class="company-name">Blooming Kids House</div>
                        <div class="invoice-title">INVOICE</div>
                        <div>Invoice #: ${invoiceNumber}</div>
                        <div>Date: ${invoiceDate.toLocaleDateString()}</div>
                    </div>
                    
                    <div class="invoice-info">
                        <div>
                            <strong>Bill To:</strong><br>
                            ${enrollment.parent?.name || ''}<br>
                            ${enrollment.parent?.email || ''}<br>
                            ${enrollment.parent?.phone || ''}
                        </div>
                        <div>
                            <strong>Invoice Details:</strong><br>
                            Status: ${enrollment.status || 'Completed'}<br>
                            Approved By: ${enrollment.payment?.approvedBy || window.userData?.name || 'Management'}<br>
                            Payment Method: ${enrollment.payment?.method || 'Not specified'}<br>
                            Schedule: ${academicDays} • ${academicTime}
                        </div>
                    </div>
                    
                    <!-- Tutor Information Section -->
                    ${tutorInfoHTML ? `
                    <div class="section">
                        <div class="section-title">Assigned Tutors</div>
                        <div class="tutor-info">
                            ${tutorInfoHTML}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="section">
                        <div class="section-title">Student Details</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Actual Grade</th>
                                    <th>Subjects</th>
                                    <th>Extracurricular</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${enrollment.students ? enrollment.students.map(student => `
                                    <tr>
                                        <td>${student.name || ''}</td>
                                        <td>${student.actualGrade || ''}</td>
                                        <td>${student.selectedSubjects ? student.selectedSubjects.join(', ') : ''}</td>
                                        <td>${student.extracurriculars ? student.extracurriculars.map(e => `${e.name} (${e.frequency})`).join(', ') : ''}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4">No student information</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Fee Breakdown</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Amount (₦)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Academic Fees</td>
                                    <td>${(enrollment.summary?.academicFee || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td>Extracurricular Activities</td>
                                    <td>${(enrollment.summary?.extracurricularFee || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td>Test Preparation</td>
                                    <td>${(enrollment.summary?.testPrepFee || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td>Discount</td>
                                    <td>-${(enrollment.summary?.discountAmount || 0).toLocaleString()}</td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>TOTAL</strong></td>
                                    <td><strong>₦${(enrollment.summary?.totalFee || 0).toLocaleString()}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Payment Information</div>
                        <p>Payment Status: <strong>${enrollment.status === 'payment_received' ? 'PAID' : 'PENDING'}</strong></p>
                        ${enrollment.payment?.reference ? `<p>Reference: ${enrollment.payment.reference}</p>` : ''}
                        ${enrollment.payment?.date ? `<p>Payment Date: ${new Date(enrollment.payment.date.seconds * 1000).toLocaleDateString()}</p>` : ''}
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for choosing Blooming Kids House!</p>
                        <p>For inquiries, contact: info@bloomingkidshouse.com | 0707 896 1070 | 0902 914 7024</p>
                        <p>This is a computer-generated invoice. No signature required.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Create a temporary iframe to render the HTML
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '800px';
        iframe.style.height = '1200px';
        document.body.appendChild(iframe);
        
        iframe.contentDocument.open();
        iframe.contentDocument.write(invoiceHTML);
        iframe.contentDocument.close();
        
        // Wait for the iframe to load
        setTimeout(() => {
            html2canvas(iframe.contentDocument.body).then(canvas => {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `Invoice_${invoiceNumber}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                document.body.removeChild(iframe);
            }).catch(error => {
                console.error("Error generating invoice image:", error);
                alert("Failed to generate invoice image. Please try again.");
                document.body.removeChild(iframe);
            });
        }, 1000);
        
    } catch (error) {
        console.error("Error downloading invoice:", error);
        alert("Failed to download invoice. Please try again.");
    }
};


// ======================================================
// SUBSECTION 5.3: Pending Approvals Panel (UPDATED)
// ======================================================

async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="pending-search" placeholder="Search by student, parent, or tutor..." class="p-2 border rounded-md w-64">
                    <button id="refresh-pending-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    document.getElementById('pending-search').addEventListener('input', (e) => filterPendingApprovals(e.target.value));
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) invalidateCache('pendingStudents');
    const listContainer = document.getElementById('pending-approvals-list');
    
    try {
        if (!sessionCache.pendingStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching pending students...</p>`;
            const snapshot = await getDocs(query(collection(db, "pending_students")));
            const pendingStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Also fetch enrollment data for those pending students that came from enrollments
            const enrollmentPendingStudents = pendingStudents.filter(student => student.enrollmentId);
            
            for (const student of enrollmentPendingStudents) {
                if (student.enrollmentId) {
                    try {
                        const enrollmentDoc = await getDoc(doc(db, "enrollments", student.enrollmentId));
                        if (enrollmentDoc.exists()) {
                            student.enrollmentData = enrollmentDoc.data();
                        }
                    } catch (error) {
                        console.error("Error fetching enrollment data:", error);
                    }
                }
            }
            
            saveToLocalStorage('pendingStudents', pendingStudents);
        }
        renderPendingApprovalsFromCache();
    } catch(error) {
        console.error("Error fetching pending students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function filterPendingApprovals(searchTerm = '') {
    const pendingStudents = sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (searchTerm) {
        const lowerCaseTerm = searchTerm.toLowerCase();
        const filtered = pendingStudents.filter(student =>
            student.studentName?.toLowerCase().includes(lowerCaseTerm) ||
            student.parentName?.toLowerCase().includes(lowerCaseTerm) ||
            student.tutorEmail?.toLowerCase().includes(lowerCaseTerm) ||
            student.parentEmail?.toLowerCase().includes(lowerCaseTerm) ||
            student.parentPhone?.toLowerCase().includes(lowerCaseTerm)
        );
        renderPendingApprovalsFromCache(filtered);
    } else {
        renderPendingApprovalsFromCache(pendingStudents);
    }
}

function renderPendingApprovalsFromCache(studentsToRender = null) {
    const pendingStudents = studentsToRender || sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (pendingStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
        return;
    }

    listContainer.innerHTML = pendingStudents.map(student => {
        // Get tutor name if available from tutors cache
        let tutorName = student.tutorEmail;
        if (sessionCache.tutors) {
            const tutor = sessionCache.tutors.find(t => t.email === student.tutorEmail);
            if (tutor) {
                tutorName = tutor.name;
            }
        }
        
        // Check if this came from an enrollment
        const fromEnrollment = student.enrollmentId ? ' (From Enrollment)' : '';
        
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-lg text-gray-800">${student.studentName}${fromEnrollment}</h3>
                        ${student.enrollmentId ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Enrollment ID: ${student.enrollmentId.substring(0, 8)}</span>` : ''}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                        <div>
                            <p><i class="fas fa-user-friends mr-2"></i>Parent: ${student.parentName || 'N/A'}</p>
                            <p><i class="fas fa-phone mr-2"></i>Phone: ${student.parentPhone || 'N/A'}</p>
                            <p><i class="fas fa-envelope mr-2"></i>Email: ${student.parentEmail || 'N/A'}</p>
                        </div>
                        <div>
                            <p><i class="fas fa-chalkboard-teacher mr-2"></i>Tutor: ${tutorName || student.tutorEmail}</p>
                            <p><i class="fas fa-graduation-cap mr-2"></i>Grade: ${student.grade || 'N/A'}</p>
                            <p><i class="fas fa-money-bill-wave mr-2"></i>Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p><i class="fas fa-book mr-2"></i>Subjects: ${Array.isArray(student.subjects) ? student.subjects.join(', ') : student.subjects || 'N/A'}</p>
                            <p><i class="fas fa-calendar mr-2"></i>Days/Week: ${student.days || 'To be determined'}</p>
                            ${student.enrollmentData ? `<p class="text-xs text-blue-600"><i class="fas fa-file-invoice mr-1"></i>Enrollment Fee: ₦${(student.enrollmentData.summary?.totalFee || 0).toLocaleString()}</p>` : ''}
                        </div>
                    </div>
                    ${student.source === 'enrollment_approval' ? `<p class="text-xs text-green-600 mt-2"><i class="fas fa-check-circle mr-1"></i>This student was approved from an enrollment application.</p>` : ''}
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 text-sm rounded-full hover:bg-blue-600 transition-colors" data-student-id="${student.id}">Edit</button>
                    <button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full hover:bg-green-700 transition-colors" data-student-id="${student.id}">Approve</button>
                    <button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full hover:bg-red-700 transition-colors" data-student-id="${student.id}">Reject</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Reattach event listeners
    document.querySelectorAll('.edit-pending-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));
}

// ======================================================
// SUBSECTION 5.4: Summer Break Panel
// ======================================================

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <input type="search" id="break-search" placeholder="Search students by name, tutor, or parent..." 
                           class="p-2 border rounded-md w-64 focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                        <i class="fas fa-sync-alt mr-2"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Students on Break</h4>
                    <p id="break-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                    <p id="break-tutor-count" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            
            <div id="break-students-list" class="space-y-4">
                <div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading summer break students...</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    document.getElementById('break-search').addEventListener('input', (e) => handleBreakSearch(e.target.value));
    
    // Initialize the cache if it doesn't exist
    if (!sessionCache.breakStudents) {
        sessionCache.breakStudents = [];
    }
    
    fetchAndRenderBreakStudents();
}

// Helper function to handle search
function handleBreakSearch(searchTerm) {
    // Check if data is available in cache
    if (!sessionCache.breakStudents || sessionCache.breakStudents.length === 0) {
        // If no data in cache, show message and fetch data
        const listContainer = document.getElementById('break-students-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading data for search...</p>
                </div>
            `;
        }
        // Fetch data first, then search
        fetchAndRenderBreakStudents();
        return;
    }
    
    // If data exists, perform search
    renderBreakStudentsFromCache(searchTerm);
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) invalidateCache('breakStudents');
    const listContainer = document.getElementById('break-students-list');

    try {
        // Check if we need to fetch fresh data
        if (forceRefresh || !sessionCache.breakStudents || sessionCache.breakStudents.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `<div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Fetching student break status...</p>
                </div>`;
            }
            
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            const allBreakStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter for active/approved students only
            const activeBreakStudents = allBreakStudents.filter(student => 
                !student.status || student.status === 'active' || student.status === 'approved'
            );
            
            // Update both session cache and localStorage
            sessionCache.breakStudents = activeBreakStudents;
            saveToLocalStorage('breakStudents', activeBreakStudents);
        }
        
        // Get current search term and render
        const searchInput = document.getElementById('break-search');
        const currentSearchTerm = searchInput ? searchInput.value : '';
        renderBreakStudentsFromCache(currentSearchTerm);
        
    } catch(error) {
        console.error("Error fetching break students:", error);
        const listContainer = document.getElementById('break-students-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <p class="font-semibold">Failed to load summer break data</p>
                    <p class="text-sm mt-2">${error.message}</p>
                    <button onclick="fetchAndRenderBreakStudents(true)" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

function renderBreakStudentsFromCache(searchTerm = '') {
    const breakStudents = sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;
    
    // Update counts with ALL break students (not filtered ones)
    const uniqueTutors = [...new Set(breakStudents.map(s => s.tutorEmail))].filter(Boolean);
    document.getElementById('break-count-badge').textContent = breakStudents.length;
    document.getElementById('break-tutor-count').textContent = uniqueTutors.length;
    
    // Filter students if search term exists
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    let filteredStudents = breakStudents;
    
    if (searchTerm) {
        filteredStudents = breakStudents.filter(student => {
            // Check all searchable fields
            const searchFields = [
                student.studentName,
                student.tutorEmail,
                student.tutorName,
                student.parentName,
                student.parentPhone,
                student.grade,
                student.days
            ];
            
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
    }
    
    // Handle empty results
    if (filteredStudents.length === 0) {
        if (searchTerm) {
            listContainer.innerHTML = `
                <div class="text-center py-10">
                    <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-600">No students found matching "${searchTerm}"</p>
                    <p class="text-sm text-gray-400 mt-2">Try a different search term</p>
                    <button onclick="document.getElementById('break-search').value = ''; renderBreakStudentsFromCache('')" 
                            class="mt-4 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">
                        Clear Search
                    </button>
                </div>
            `;
        } else {
            listContainer.innerHTML = `
                <div class="text-center py-10">
                    <i class="fas fa-umbrella-beach text-green-400 text-4xl mb-4"></i>
                    <p class="text-gray-600">No active students are currently on summer break</p>
                    <p class="text-sm text-gray-400 mt-2">All students are active</p>
                </div>
            `;
        }
        return;
    }
    
    // Group students by tutor
    const studentsByTutor = {};
    filteredStudents.forEach(student => {
        const tutorKey = student.tutorEmail || 'No Tutor Assigned';
        if (!studentsByTutor[tutorKey]) {
            studentsByTutor[tutorKey] = {
                tutorName: student.tutorName || student.tutorEmail || 'Unknown Tutor',
                tutorEmail: student.tutorEmail,
                students: []
            };
        }
        studentsByTutor[tutorKey].students.push(student);
    });
    
    let html = '';
    
    Object.values(studentsByTutor).forEach(tutorGroup => {
        const studentItems = tutorGroup.students.map(student => {
            const breakInfo = student.lastBreakStart ? 
                `Break started: ${new Date(student.lastBreakStart.seconds * 1000).toLocaleDateString()}` : 
                'No break start date recorded';
            
            return `
                <div class="border-l-4 border-l-yellow-500 bg-gray-50 p-4 rounded-r-lg flex justify-between items-center hover:bg-gray-100 transition-colors">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                            <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">On Summer Break</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                            <div>
                                <p><i class="fas fa-graduation-cap mr-2 text-gray-400"></i>Grade: ${student.grade || 'N/A'}</p>
                                <p><i class="fas fa-calendar mr-2 text-gray-400"></i>Days/Week: ${student.days || 'N/A'}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-user-friends mr-2 text-gray-400"></i>Parent: ${student.parentName || 'N/A'}</p>
                                <p><i class="fas fa-phone mr-2 text-gray-400"></i>Phone: ${student.parentPhone || 'N/A'}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-money-bill-wave mr-2 text-gray-400"></i>Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                                <p><i class="fas fa-calendar-alt mr-2 text-gray-400"></i>${breakInfo}</p>
                            </div>
                        </div>
                        <div class="mt-3 text-xs text-gray-500">
                            <p><i class="fas fa-chalkboard-teacher mr-1"></i>Assigned to: ${student.tutorName || student.tutorEmail || 'No tutor assigned'}</p>
                        </div>
                    </div>
                    <div class="ml-4">
                        <button class="end-break-btn bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-student-id="${student.id}"
                                data-student-name="${student.studentName}"
                                data-tutor-name="${student.tutorName || student.tutorEmail || 'Unknown Tutor'}">
                            <i class="fas fa-flag mr-2"></i> End Break
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        html += `
            <div class="border rounded-lg shadow-sm mb-6">
                <div class="p-4 bg-yellow-50 border-b rounded-t-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg text-gray-800">${tutorGroup.tutorName}</h3>
                            <p class="text-sm text-gray-600">${tutorGroup.tutorEmail || 'No email'}</p>
                        </div>
                        <span class="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${tutorGroup.students.length} student${tutorGroup.students.length !== 1 ? 's' : ''} on break
                        </span>
                    </div>
                </div>
                <div class="space-y-3 p-4">
                    ${studentItems}
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    
    // Add event listeners to End Break buttons
    document.querySelectorAll('.end-break-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const studentId = e.currentTarget.dataset.studentId;
            const studentName = e.currentTarget.dataset.studentName;
            const tutorName = e.currentTarget.dataset.tutorName;
            
            const confirmation = confirm(`Are you sure you want to take ${studentName} off summer break and return them to ${tutorName}?`);
            
            if (!confirmation) {
                return;
            }
            
            try {
                const originalText = e.currentTarget.innerHTML;
                e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Ending Break...';
                e.currentTarget.disabled = true;
                
                await updateDoc(doc(db, "students", studentId), { 
                    summerBreak: false, 
                    lastBreakEnd: Timestamp.now(),
                    lastUpdated: Timestamp.now()
                });
                
                // Show success message
                const statusMessage = document.getElementById('break-status-message');
                statusMessage.textContent = `✅ Summer break ended for ${studentName}. Student is now active with ${tutorName}.`;
                statusMessage.className = 'text-center font-semibold mb-4 text-green-600 p-3 bg-green-50 rounded-lg';
                statusMessage.classList.remove('hidden');
                
                setTimeout(() => {
                    statusMessage.classList.add('hidden');
                }, 4000);
                
                // Invalidate caches and refresh data
                invalidateCache('breakStudents');
                invalidateCache('students');
                invalidateCache('tutorAssignments');
                
                // Get current search term before refreshing
                const searchInput = document.getElementById('break-search');
                const currentSearchTerm = searchInput ? searchInput.value : '';
                
                // Force refresh and then re-apply search if needed
                await fetchAndRenderBreakStudents(true);
                
                if (searchInput && currentSearchTerm) {
                    searchInput.value = currentSearchTerm;
                    renderBreakStudentsFromCache(currentSearchTerm);
                }
                
            } catch (error) {
                console.error("Error ending summer break:", error);
                
                // Show error message
                const statusMessage = document.getElementById('break-status-message');
                statusMessage.textContent = `❌ Failed to End Break for ${studentName}. Error: ${error.message}`;
                statusMessage.className = 'text-center font-semibold mb-4 text-red-600 p-3 bg-red-50 rounded-lg';
                statusMessage.classList.remove('hidden');
                
                setTimeout(() => {
                    statusMessage.classList.add('hidden');
                }, 5000);
                
                // Reset button
                e.currentTarget.innerHTML = originalText;
                e.currentTarget.disabled = false;
            }
        });
    });
}

// ======================================================
// SECTION 6: COMMUNICATION PANELS
// ======================================================

// ======================================================
// SUBSECTION 6.1: Parent Feedback Panel
// ======================================================

function formatFeedbackDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    
    try {
        let date = null;
        
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
        else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
        }
        else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        }
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        
        if (date && !isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        return 'Unknown date';
    } catch (error) {
        console.error("Error formatting date:", error, timestamp);
        return 'Invalid date';
    }
}

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
            
            const feedbackSnapshot = await getDocs(query(collection(db, "parent_feedback"), orderBy("timestamp", "desc")));
            const feedbackData = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const enhancedFeedbackData = feedbackData.map(feedback => {
                let submittedDate = null;
                
                if (feedback.timestamp) {
                    if (typeof feedback.timestamp.toDate === 'function') {
                        submittedDate = feedback.timestamp;
                    }
                    else if (feedback.timestamp.seconds) {
                        submittedDate = {
                            toDate: () => new Date(feedback.timestamp.seconds * 1000)
                        };
                    }
                    else if (typeof feedback.timestamp === 'string') {
                        const date = new Date(feedback.timestamp);
                        if (!isNaN(date.getTime())) {
                            submittedDate = {
                                toDate: () => date
                            };
                        }
                    }
                }
                
                if (!submittedDate) {
                    submittedDate = {
                        toDate: () => new Date()
                    };
                }
                
                return {
                    ...feedback,
                    submittedAt: submittedDate,
                    parentName: feedback.parentName || 'Unknown Parent',
                    read: feedback.read || false,
                    message: feedback.message || '',
                    parentEmail: feedback.parentEmail || '',
                    parentPhone: feedback.parentPhone || '',
                    responses: feedback.responses || []
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
        const submittedDate = formatFeedbackDate(message.submittedAt || message.timestamp);
        
        const readStatus = message.read ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const readText = message.read ? 'Read' : 'Unread';

        const responsesHTML = message.responses && message.responses.length > 0 ? `
            <div class="mt-4 border-t pt-4">
                <h4 class="font-semibold text-gray-700 mb-2">Responses:</h4>
                ${message.responses.map(response => `
                    <div class="bg-blue-50 p-3 rounded-lg mb-2">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-medium text-blue-800">${response.responderName || 'Staff'}</span>
                            <span class="text-xs text-gray-500">${formatFeedbackDate(response.responseDate)}</span>
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

        await updateDoc(messageRef, {
            responses: [...currentResponses, newResponse],
            read: true,
            readAt: Timestamp.now()
        });

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
        renderParentFeedbackFromCache();

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

// ======================================================
// SECTION 7: ACTION HANDLERS & MODALS
// ======================================================

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
            
            if (collectionName === 'students') {
                invalidateCache('students');
                invalidateCache('tutorAssignments');
            }
            if (collectionName === 'pending_students') invalidateCache('pendingStudents');
            
            const currentNavId = document.querySelector('.nav-item.active')?.dataset.navId;
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
    const activeTutors = tutors.filter(tutor => 
        !tutor.status || tutor.status === 'active'
    );
    
    if (activeTutors.length === 0) {
        alert("No active tutors available. Please refresh the directory and try again.");
        return;
    }

    const tutorOptions = activeTutors
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

function showReassignStudentModal() {
    const tutors = sessionCache.tutors || [];
    const activeTutors = tutors.filter(tutor => 
        !tutor.status || tutor.status === 'active'
    );
    
    if (activeTutors.length === 0) {
        alert("No active tutors available. Please refresh the directory and try again.");
        return;
    }

    const tutorOptions = activeTutors
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

    document.getElementById('search-student-btn').addEventListener('click', async () => {
        const searchTerm = document.getElementById('reassign-student-search').value.trim();
        if (!searchTerm) {
            alert("Please enter a student name to search.");
            return;
        }

        try {
            const studentsSnapshot = await getDocs(collection(db, "students"));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeStudents = allStudents.filter(student => 
                !student.status || student.status === 'active' || student.status === 'approved'
            );
            
            const searchResults = activeStudents.filter(student => 
                student.studentName.toLowerCase().includes(searchTerm.toLowerCase())
            );

            const resultsContainer = document.getElementById('student-search-results');
            resultsContainer.classList.remove('hidden');
            
            if (searchResults.length === 0) {
                resultsContainer.innerHTML = '<p class="text-sm text-gray-500">No active students found matching your search.</p>';
                return;
            }

            resultsContainer.innerHTML = searchResults.map(student => `
                <div class="p-2 border-b cursor-pointer hover:bg-gray-50 student-result" data-student-id="${student.id}" data-student-name="${student.studentName}" data-current-tutor="${student.tutorEmail}">
                    <p class="font-medium">${student.studentName}</p>
                    <p class="text-xs text-gray-500">Current Tutor: ${student.tutorEmail} | Grade: ${student.grade}</p>
                </div>
            `).join('');

            document.querySelectorAll('.student-result').forEach(result => {
                result.addEventListener('click', () => {
                    const studentId = result.dataset.studentId;
                    const studentName = result.dataset.studentName;
                    const currentTutor = result.dataset.currentTutor;
                    
                    document.getElementById('selected-student-id').value = studentId;
                    document.getElementById('reassign-student-search').value = studentName;
                    
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

            const existingHistory = studentData.tutorHistory || [];
            
            const updatedHistory = existingHistory.map(entry => ({
                ...entry,
                isCurrent: false
            }));
            
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

// ======================================================
// SECTION 8: UTILITY FUNCTIONS
// ======================================================

async function fetchTutorAssignmentHistory() {
    try {
        const studentsSnapshot = await getDocs(query(collection(db, "students")));
        const tutorAssignments = {};
        
        studentsSnapshot.docs.forEach(doc => {
            const studentData = doc.data();
            const studentId = doc.id;
            
            if (studentData.status === 'archived' || studentData.status === 'graduated' || studentData.status === 'transferred') {
                return;
            }
            
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

async function generateReportHTML(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    const reportData = reportDoc.data();

    const reportSections = {
        "INTRODUCTION": reportData.introduction,
        "TOPICS & REMARKS": reportData.topics,
        "PROGRESS & ACHIEVEMENTS": reportData.progress,
        "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses,
        "RECOMMENDATIONS": reportData.recommendations,
        "GENERAL TUTOR'S COMMENTS": reportData.generalComments
    };

    const sectionsHTML = Object.entries(reportSections).map(([title, content]) => {
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
                    page-break-inside: avoid;
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

window.downloadSingleReport = async function(reportId, event) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        button.innerHTML = '<div class="loading-spinner mx-auto" style="width: 16px; height: 16px;"></div>';
        button.disabled = true;
        
        const progressModal = document.getElementById('pdf-progress-modal');
        const progressBar = document.getElementById('pdf-progress-bar');
        const progressText = document.getElementById('pdf-progress-text');
        const progressMessage = document.getElementById('pdf-progress-message');
        
        progressModal.classList.remove('hidden');
        progressMessage.textContent = 'Generating PDF...';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        const { html, reportData } = await generateReportHTML(reportId);
        
        progressBar.style.width = '50%';
        progressText.textContent = '50%';
        progressMessage.textContent = 'Converting to PDF...';

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

        await html2pdf().set(options).from(html).save();
        
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        progressMessage.textContent = 'Download complete!';
        
        setTimeout(() => {
            progressModal.classList.add('hidden');
        }, 1000);
        
    } catch (error) {
        console.error("Error downloading report:", error);
        alert(`Error downloading report: ${error.message}`);
        document.getElementById('pdf-progress-modal').classList.add('hidden');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
};

window.zipAndDownloadTutorReports = async function(reports, tutorName, button) {
    const originalButtonText = button.innerHTML;
    
    try {
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

        for (const report of reports) {
            try {
                const progress = Math.round((processedCount / reports.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                progressMessage.textContent = `Processing report ${processedCount + 1} of ${reports.length}...`;
                button.innerHTML = `📦 Processing ${processedCount + 1}/${reports.length}`;

                const { html, reportData } = await generateReportHTML(report.id);
                
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
                
                const safeStudentName = (reportData.studentName || 'Unknown_Student').replace(/[^a-z0-9]/gi, '_');
                const reportDate = reportData.submittedAt ? 
                    new Date(reportData.submittedAt.seconds * 1000).toISOString().split('T')[0] : 
                    'unknown_date';
                const filename = `${safeStudentName}_${reportDate}.pdf`;
                
                zip.file(filename, pdfBlob);
                
            } catch (error) {
                console.error(`Error processing report ${report.id}:`, error);
            }
            
            processedCount++;
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        progressMessage.textContent = 'Creating ZIP file...';
        progressBar.style.width = '95%';
        progressText.textContent = '95%';
        
        const zipBlob = await zip.generateAsync({ 
            type: "blob",
            compression: "DEFLATE"
        });

        progressMessage.textContent = 'Download starting...';
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        saveAs(zipBlob, `${tutorName}_Reports_${new Date().toISOString().split('T')[0]}.zip`);
        
        setTimeout(() => {
            progressModal.classList.add('hidden');
        }, 2000);
        
    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. Please try again.");
        document.getElementById('pdf-progress-modal').classList.add('hidden');
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
};

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
if (!document.querySelector('style[data-reports-panel]')) {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-reports-panel', 'true');
    styleEl.innerHTML = additionalStyles;
    document.head.appendChild(styleEl);
}

// ======================================================
// SECTION 9: NAVIGATION & AUTHENTICATION
// ======================================================

const navigationGroups = {
    "dashboard": {
        icon: "fas fa-tachometer-alt",
        label: "Dashboard",
        fn: renderDashboardPanel
    },
    "tutorManagement": {
        icon: "fas fa-user-friends",
        label: "Tutor Management",
        items: [
            { id: "navTutorManagement", label: "Tutor Directory", icon: "fas fa-users", fn: renderManagementTutorView },
            { id: "navInactiveTutors", label: "Inactive Tutors", icon: "fas fa-user-slash", fn: renderInactiveTutorsPanel },
            { id: "navArchivedStudents", label: "Archived Students", icon: "fas fa-archive", fn: renderArchivedStudentsPanel }
        ]
    },
    "financial": {
        icon: "fas fa-money-bill-wave",
        label: "Financial",
        items: [
            { id: "navPayAdvice", label: "Pay Advice", icon: "fas fa-file-invoice-dollar", fn: renderPayAdvicePanel },
            { id: "navReferralsAdmin", label: "Referral Management", icon: "fas fa-handshake", fn: renderReferralsAdminPanel }
        ]
    },
    "academics": {
        icon: "fas fa-graduation-cap",
        label: "Academics",
        items: [
            { id: "navTutorReports", label: "Tutor Reports", icon: "fas fa-file-alt", fn: renderTutorReportsPanel },
            { id: "navEnrollments", label: "Enrollments", icon: "fas fa-user-plus", fn: renderEnrollmentsPanel },
            { id: "navPendingApprovals", label: "Pending Approvals", icon: "fas fa-user-check", fn: renderPendingApprovalsPanel },
            { id: "navSummerBreak", label: "Summer Break", icon: "fas fa-umbrella-beach", fn: renderSummerBreakPanel }
        ]
    },
    "communication": {
        icon: "fas fa-comments",
        label: "Communication",
        items: [
            { id: "navParentFeedback", label: "Parent Feedback", icon: "fas fa-comment-dots", fn: renderParentFeedbackPanel }
        ]
    }
};

function initializeSidebarNavigation(staffData) {
    const navContainer = document.getElementById('navContainer');
    const searchInput = document.getElementById('navSearch');
    
    if (!navContainer) return;
    
    navContainer.innerHTML = '';
    
    let allNavItems = {};
    let hasVisibleItems = false;
    
    Object.entries(navigationGroups).forEach(([groupKey, group]) => {
        const visibleItems = group.items ? group.items.filter(item => {
            const hasPermission = item.id === 'navReferralsAdmin' || 
                                !staffData.permissions || 
                                !staffData.permissions.tabs || 
                                staffData.permissions.tabs[getPermissionKey(item.id)] === true;
            return hasPermission;
        }) : [];
        
        if (visibleItems.length === 0 && groupKey !== 'dashboard') return;
        
        const groupElement = document.createElement('div');
        groupElement.className = 'nav-group';
        
        if (groupKey === 'dashboard') {
            const dashboardItem = document.createElement('div');
            dashboardItem.className = 'nav-item';
            dashboardItem.innerHTML = `
                <div class="nav-icon"><i class="${group.icon}"></i></div>
                <span class="nav-text">${group.label}</span>
            `;
            dashboardItem.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                dashboardItem.classList.add('active');
                
                document.getElementById('pageTitle').textContent = group.label;
                
                if (group.fn) {
                    group.fn(document.getElementById('main-content'));
                }
            });
            navContainer.appendChild(dashboardItem);
            
            setTimeout(() => dashboardItem.click(), 100);
            
        } else {
            groupElement.innerHTML = `
                <div class="nav-group-header">
                    <div class="group-title">
                        <i class="${group.icon}"></i>
                        <span>${group.label}</span>
                    </div>
                    <i class="fas fa-chevron-down group-arrow"></i>
                </div>
                <div class="nav-items" style="max-height: ${visibleItems.length * 48}px">
                    ${visibleItems.map(item => {
                        allNavItems[item.id] = { fn: item.fn, perm: getPermissionKey(item.id) };
                        return `
                            <div class="nav-item" data-nav-id="${item.id}">
                                <div class="nav-icon"><i class="${item.icon}"></i></div>
                                <span class="nav-text">${item.label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            const header = groupElement.querySelector('.nav-group-header');
            header.addEventListener('click', () => {
                groupElement.classList.toggle('collapsed');
            });
            
            navContainer.appendChild(groupElement);
            hasVisibleItems = true;
            
            groupElement.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const navId = item.dataset.navId;
                    
                    document.querySelectorAll('.nav-item').forEach(navItem => navItem.classList.remove('active'));
                    
                    item.classList.add('active');
                    
                    const itemLabel = item.querySelector('.nav-text').textContent;
                    document.getElementById('pageTitle').textContent = itemLabel;
                    
                    if (navId && allNavItems[navId]) {
                        allNavItems[navId].fn(document.getElementById('main-content'));
                    }
                });
            });
        }
    });
    
    if (!hasVisibleItems && !document.querySelector('.nav-item[data-nav-id]')) {
        navContainer.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-lock text-gray-400 text-4xl mb-4"></i>
                <p class="text-gray-600">No accessible panels available for your role.</p>
            </div>
        `;
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const navItems = document.querySelectorAll('.nav-item');
            
            navItems.forEach(item => {
                const text = item.querySelector('.nav-text').textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    item.style.display = 'flex';
                    let parentGroup = item.closest('.nav-group');
                    if (parentGroup) {
                        parentGroup.style.display = 'block';
                        parentGroup.classList.remove('collapsed');
                    }
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    return allNavItems;
}

function getPermissionKey(navId) {
    return 'view' + navId.replace('nav', '').replace(/([A-Z])/g, (match, p1) => p1.charAt(0).toUpperCase() + p1.slice(1));
}

function updatePageTitle(title) {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = title;
    }
}

const allNavItems = {
    navDashboard: { fn: renderDashboardPanel, perm: 'viewDashboard', label: 'Dashboard' },
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

window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const body = document.body;
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            const icon = toggleBtn.querySelector('i');
            if (body.classList.contains('sidebar-collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-left';
            }
        });
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('mobile-open');
        });
    }
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.classList.remove('hidden');
    }
    
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
                
                const navItems = initializeSidebarNavigation(staffData);
                
                setupSidebarToggle();
                
                if (sidebarLogoutBtn) {
                    sidebarLogoutBtn.addEventListener('click', () => {
                        signOut(auth).then(() => {
                            window.location.href = "management-auth.html";
                        });
                    });
                }
                
                const defaultNavId = 'navDashboard';
                if (defaultNavId && navItems[defaultNavId]) {
                    updatePageTitle('Dashboard');
                    navItems[defaultNavId].fn(mainContent);
                }
                
            } else {
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="bg-white p-8 rounded-lg shadow-md text-center">
                            <i class="fas fa-user-clock text-yellow-500 text-5xl mb-4"></i>
                            <h2 class="text-2xl font-bold text-yellow-600 mb-2">Account Pending Approval</h2>
                            <p class="text-gray-600 mb-6">Your account is awaiting approval from an administrator.</p>
                            <button onclick="window.location.href='management-auth.html'" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                                Return to Login
                            </button>
                        </div>
                    `;
                }
                if (sidebarLogoutBtn) sidebarLogoutBtn.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error checking staff permissions:", error);
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="bg-white p-8 rounded-lg shadow-md text-center">
                        <i class="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
                        <h2 class="text-2xl font-bold text-red-600 mb-2">Error Loading Dashboard</h2>
                        <p class="text-gray-600 mb-4">There was an error loading your dashboard. Please try again.</p>
                        <p class="text-sm text-gray-500 mb-6">Error: ${error.message}</p>
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    } else {
        window.location.href = "management-auth.html";
    }
});

















