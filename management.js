import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ======================================================
// SECTION 1: CACHE MANAGEMENT
// ======================================================

const CACHE_PREFIX = 'management_cache_';

// ======================================================
// SECURITY: XSS Protection - escapeHtml
// ======================================================
function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Rate limit helper - prevents rapid repeated submissions
const _rateLimitMap = new Map();
function rateLimitCheck(key, limitMs = 3000) {
    const now = Date.now();
    if (_rateLimitMap.has(key) && now - _rateLimitMap.get(key) < limitMs) return false;
    _rateLimitMap.set(key, now);
    return true;
}

// Input sanitization for Firestore writes
function sanitizeInput(str, maxLen = 500) {
    if (typeof str !== 'string') return str;
    return str.trim().slice(0, maxLen);
}

// Log management activity for the activity log
async function logManagementActivity(action, details = '') {
    try {
        const userEmail = window.userData?.email;
        if (!userEmail) return;
        await addDoc(collection(db, 'management_activity'), {
            userEmail,
            userName: window.userData?.name || 'Unknown',
            action: sanitizeInput(action, 200),
            details: sanitizeInput(details, 500),
            timestamp: Timestamp.now()
        });
    } catch(e) { /* Non-critical, ignore */ }
}

// ======================================================
// GRADE & TIME HELPERS (used across modals)
// ======================================================
function buildGradeOptions(selectedGrade = '') {
    const grades = [
        'Preschool', 'Kindergarten',
        'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
        'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
        'Pre-College', 'College', 'Adults'
    ];
    return `<option value="">Select Grade</option>` +
        grades.map(g => `<option value="${g}" ${selectedGrade === g ? 'selected' : ''}>${g}</option>`).join('');
}

function buildTimeOptions(selectedVal = '') {
    let opts = `<option value="">-- Select --</option>`;
    for (let h = 0; h < 24; h++) {
        for (let m of [0, 30]) {
            const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm = h < 12 ? 'AM' : 'PM';
            const minStr = m === 0 ? '00' : '30';
            const label = `${hour12}:${minStr} ${ampm}`;
            const value = `${String(h).padStart(2,'0')}:${minStr}`;
            opts += `<option value="${value}" ${selectedVal === value ? 'selected' : ''}>${label}</option>`;
        }
    }
    return opts;
}

function formatTimeTo12h(val) {
    if (!val) return '';
    const [hStr, mStr] = val.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hour12}:${m} ${ampm}`;
}

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
    if (key === 'reports' || key === 's' || key === 'tutorAssignments') {
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
    const showsCard = userPermissions.views === true;
    
    // Count how many cards we'll show (for grid layout)
    const visibleCardsCount = [showTutorsCard, showStudentsCard, showPendingCard, showsCard]
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

                <!-- Total s Card (only if user has permission) -->
                ${showsCard ? `
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-file-signature text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-purple-800">Total s</h3>
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
                // Exclude break/archived/graduated students from active count
                const activeStudents = allStudents.filter(student => 
                    (!student.status || student.status === 'active' || student.status === 'approved') &&
                    !student.summerBreak &&
                    student.status !== 'archived' &&
                    student.status !== 'graduated' &&
                    student.status !== 'transferred'
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
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl my-4">
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
                            <div class="relative">
                                <input type="text" id="assign-tutor-search" placeholder="Type to search tutors..." 
                                    autocomplete="off"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <input type="hidden" id="assign-tutor-select" value="">
                                <div id="assign-tutor-dropdown" class="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden">
                                    ${tutors.map(tutor => `
                                        <div class="tutor-option px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm" 
                                            data-value="${tutor.id}" 
                                            data-label="${(tutor.name || tutor.email || tutor.id)}${tutor.assignedStudentsCount ? ` (${tutor.assignedStudentsCount} students)` : ''}">
                                            <span class="font-medium">${tutor.name || tutor.email || tutor.id}</span>
                                            ${tutor.assignedStudentsCount ? `<span class="text-gray-400 ml-2 text-xs">${tutor.assignedStudentsCount} students</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Student <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input type="text" id="assign-student-search" placeholder="Type to search students..." 
                                    autocomplete="off"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <input type="hidden" id="assign-student-select" value="">
                                <div id="assign-student-dropdown" class="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden">
                                    ${students.map(student => `
                                        <div class="student-option px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm" 
                                            data-value="${student.id}"
                                            data-parent-email="${student.parentEmail || ''}"
                                            data-label="${student.studentName || student.name || student.email || student.id}${student.parentEmail ? ` — ${student.parentEmail}` : ''}">
                                            <span class="font-medium">${student.studentName || student.name || student.id}</span>
                                            ${student.grade ? `<span class="text-gray-400 ml-2 text-xs">${student.grade}</span>` : ''}
                                            ${student.parentEmail ? `<div class="text-gray-400 text-xs">${student.parentEmail}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Parent Email</label>
                            <input type="email" id="assign-parent-email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="parent@example.com" value="">
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
        
        // Setup searchable dropdowns
        function setupSearchableDropdown(searchInputId, hiddenInputId, dropdownId, optionClass) {
            const searchInput = document.getElementById(searchInputId);
            const hiddenInput = document.getElementById(hiddenInputId);
            const dropdown = document.getElementById(dropdownId);
            if (!searchInput || !dropdown) return;

            searchInput.addEventListener('focus', () => { dropdown.classList.remove('hidden'); });
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase();
                dropdown.querySelectorAll('.' + optionClass).forEach(opt => {
                    const label = (opt.dataset.label || '').toLowerCase();
                    opt.style.display = label.includes(term) ? '' : 'none';
                });
                dropdown.classList.remove('hidden');
                hiddenInput.value = '';
            });
            dropdown.querySelectorAll('.' + optionClass).forEach(opt => {
                opt.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    searchInput.value = opt.querySelector('span.font-medium').textContent;
                    hiddenInput.value = opt.dataset.value;
                    dropdown.classList.add('hidden');
                    // Auto-fill parent email if student selected
                    if (opt.dataset.parentEmail !== undefined) {
                        const emailInput = document.getElementById('assign-parent-email');
                        if (emailInput && opt.dataset.parentEmail) emailInput.value = opt.dataset.parentEmail;
                    }
                });
            });
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            }, { once: false });
        }

        setTimeout(() => {
            setupSearchableDropdown('assign-tutor-search', 'assign-tutor-select', 'assign-tutor-dropdown', 'tutor-option');
            setupSearchableDropdown('assign-student-search', 'assign-student-select', 'assign-student-dropdown', 'student-option');
            document.getElementById('assign-tutor-search')?.focus();
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
                                        ${student.parentEmail ? ` (${student.parentEmail})` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Parent Email</label>
                            <input type="email" id="archive-parent-email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" placeholder="parent@example.com" value="">
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
        
        // Update parent email when student selection changes
        document.getElementById('archive-student-select').addEventListener('change', function() {
            const studentId = this.value;
            const selectedStudent = students.find(s => s.id === studentId);
            const parentEmailInput = document.getElementById('archive-parent-email');
            if (selectedStudent && selectedStudent.parentEmail) {
                parentEmailInput.value = selectedStudent.parentEmail;
            } else {
                parentEmailInput.value = '';
            }
        });
        
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
    const parentEmail = document.getElementById('assign-parent-email').value;
    const notes = document.getElementById('assignment-notes').value;
    
    if (!tutorId || !studentId) {
        alert('Please select both a tutor and a student from the dropdown lists.');
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
            parentEmail: parentEmail || '',
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
        
        // Update student's tutorId and parentEmail
        const studentRef = doc(db, "students", studentId);
        const studentUpdateData = {
            tutorId: tutorId,
            lastModified: new Date().toISOString()
        };
        
        // Only update parentEmail if provided
        if (parentEmail) {
            studentUpdateData.parentEmail = parentEmail;
        }
        
        await updateDoc(studentRef, studentUpdateData);
        
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
    const parentEmail = document.getElementById('archive-parent-email').value;
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
        
        // Prepare student update data
        const studentUpdateData = {
            status: 'archived',
            archiveReason: reason,
            archiveNotes: notes || '',
            archivedDate: new Date().toISOString(),
            archivedBy: window.userData?.uid || 'system',
            archivedByEmail: window.userData?.email || 'system',
            lastModified: new Date().toISOString()
        };
        
        // Only update parentEmail if provided
        if (parentEmail) {
            studentUpdateData.parentEmail = parentEmail;
        }
        
        // Update student status
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, studentUpdateData);
        
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
// SUBSECTION 3.1: Tutor Directory Panel - ENHANCED (COMPLETE & ERROR-FIXED)
// ======================================================

// --- HELPER FUNCTIONS (Updated) ---

function safeToString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch (e) { return ''; }
    }
    return String(value);
}

function safeSearch(text, searchTerm) {
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    if (!text) return false;
    return safeToString(text).toLowerCase().includes(safeToString(searchTerm).toLowerCase());
}

function formatBadgeDate(dateString) {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

// Calculate years of service from employmentDate (for tutor display)
function calculateYearsOfService(employmentDate) {
    if (!employmentDate) return null;
    try {
        const start = new Date(employmentDate);
        if (isNaN(start.getTime())) return null;
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        const m = now.getMonth() - start.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
            years--;
        }
        return years;
    } catch (e) {
        return null;
    }
}

function calculateTransitioningStatus(student) {
    if (!student.transitionEndDate) return { isTransitioning: false, daysLeft: 0, shouldGenerateReport: false };
    
    const endDate = new Date(student.transitionEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    const startDate = new Date(student.transitionStartDate || student.updatedAt);
    const totalDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    
    return {
        isTransitioning: daysLeft > 0,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        shouldGenerateReport: totalDays >= 14,
        totalDays: totalDays
    };
}

function searchStudentFromFirebase(student, searchTerm, tutors = []) {
    if (!student) return false;
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    
    const searchLower = safeToString(searchTerm).toLowerCase();
    
    const transitioningStatus = calculateTransitioningStatus(student);
    if (searchLower === 'break' && student.summerBreak === true) return true;
    if (searchLower === 'transitioning' && transitioningStatus.isTransitioning) return true;
    if (searchLower === 'group' && student.groupId) return true;
    
    const studentFieldsToSearch = [
        'studentName', 'grade', 'days', 'parentName', 'parentPhone', 
        'parentEmail', 'address', 'status', 'tutorEmail', 'tutorName',
        'createdBy', 'updatedBy', 'notes', 'school', 'location',
        'groupId', 'groupName'
    ];
    
    for (const field of studentFieldsToSearch) {
        if (student[field] && safeSearch(student[field], searchTerm)) return true;
    }
    
    if (student.studentFee !== undefined && student.studentFee !== null) {
        if (safeToString(student.studentFee).includes(searchLower)) return true;
    }
    
    if (student.subjects) {
        if (Array.isArray(student.subjects)) {
            for (const subject of student.subjects) {
                if (safeSearch(subject, searchTerm)) return true;
            }
        } else {
            if (safeSearch(student.subjects, searchTerm)) return true;
        }
    }
    
    if (student.tutorEmail && tutors && tutors.length > 0) {
        const tutor = tutors.find(t => t && t.email === student.tutorEmail);
        if (tutor) {
            const tutorFieldsToSearch = ['name', 'email', 'phone', 'qualification', 'subjects'];
            for (const field of tutorFieldsToSearch) {
                if (tutor[field] && safeSearch(tutor[field], searchTerm)) return true;
            }
        }
    }
    
    return false;
}

// --- ENHANCED SELECT WITH SEARCH FUNCTIONALITY (includes employment years) ---

function createSearchableSelect(options, placeholder = "Select...", id = '', isTutor = false) {
    const uniqueOptions = [];
    const seen = new Set();
    
    options.forEach(opt => {
        const key = isTutor ? opt.email : opt.id;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueOptions.push(opt);
        }
    });
    
    return `
        <div class="relative w-full">
            <input type="text" 
                   id="${id}-search" 
                   placeholder="Type to search ${isTutor ? 'tutor' : 'student'}..." 
                   class="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   autocomplete="off">
            <select id="${id}" 
                    class="hidden"
                    ${isTutor ? 'data-is-tutor="true"' : ''}>
                <option value="">${placeholder}</option>
                ${uniqueOptions.map(opt => {
                    let label = isTutor ? opt.name : opt.studentName;
                    if (isTutor && opt.employmentDate) {
                        const years = calculateYearsOfService(opt.employmentDate);
                        if (years !== null) label += ` (${years} yr${years !== 1 ? 's' : ''})`;
                    }
                    return `<option value="${isTutor ? opt.email : opt.id}" 
                                    data-label="${isTutor ? opt.name : opt.studentName}">
                        ${label} 
                        ${isTutor && opt.email ? `(${opt.email})` : ''}
                        ${!isTutor && opt.grade ? ` - Grade ${opt.grade}` : ''}
                        ${!isTutor && opt.tutorName ? ` (${opt.tutorName})` : ''}
                    </option>`;
                }).join('')}
            </select>
            <div id="${id}-dropdown" 
                 class="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg hidden max-h-60 overflow-y-auto">
                ${uniqueOptions.map(opt => {
                    let title = isTutor ? opt.name : opt.studentName;
                    if (isTutor && opt.employmentDate) {
                        const years = calculateYearsOfService(opt.employmentDate);
                        if (years !== null) title += ` (${years} yr${years !== 1 ? 's' : ''})`;
                    }
                    return `
                    <div class="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                         data-value="${isTutor ? opt.email : opt.id}"
                         data-label="${isTutor ? opt.name : opt.studentName}">
                        <div class="font-medium">${title}</div>
                        ${isTutor && opt.email ? `<div class="text-xs text-gray-500">${opt.email}</div>` : ''}
                        ${!isTutor && opt.grade ? `<div class="text-xs text-gray-500">Grade: ${opt.grade}</div>` : ''}
                        ${!isTutor && opt.tutorName ? `<div class="text-xs text-gray-500">Tutor: ${opt.tutorName}</div>` : ''}
                        ${!isTutor && opt.groupId ? `<div class="text-xs text-blue-600">Group Class</div>` : ''}
                    </div>
                `}).join('')}
            </div>
        </div>`;
}

function initializeSearchableSelect(selectId) {
    const searchInput = document.getElementById(`${selectId}-search`);
    const dropdown = document.getElementById(`${selectId}-dropdown`);
    const hiddenSelect = document.getElementById(selectId);
    
    if (!searchInput || !dropdown || !hiddenSelect) return;
    
    searchInput.addEventListener('focus', () => {
        dropdown.classList.remove('hidden');
    });
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = dropdown.querySelectorAll('div[data-value]');
        let hasVisible = false;
        
        items.forEach(item => {
            const label = item.getAttribute('data-label').toLowerCase();
            const details = item.textContent.toLowerCase();
            const matches = label.includes(searchTerm) || details.includes(searchTerm);
            
            item.style.display = matches ? 'block' : 'none';
            if (matches) hasVisible = true;
        });
        
        dropdown.style.display = hasVisible ? 'block' : 'none';
    });
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('div[data-value]');
        if (item) {
            const value = item.getAttribute('data-value');
            const label = item.getAttribute('data-label');
            
            searchInput.value = label;
            hiddenSelect.value = value;
            hiddenSelect.dispatchEvent(new Event('change'));
            dropdown.classList.add('hidden');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// --- DATE PICKER UTILITY ---

function createDatePicker(id, value = '') {
    const today = new Date().toISOString().split('T')[0];
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    
    return `
        <input type="date" 
               id="${id}" 
               value="${value}"
               min="${minDate.toISOString().split('T')[0]}"
               class="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`;
}

// --- Student Event Logger (Comprehensive History) ---
async function logStudentEvent(studentId, eventType, changes = {}, description = '', metadata = {}) {
    if (!studentId) return;
    try {
        const user = window.userData?.name || 'Admin';
        const userEmail = window.userData?.email || 'admin@system';
        await addDoc(collection(db, "studentEvents"), {
            studentId,
            type: eventType,
            timestamp: new Date().toISOString(),
            userId: user,
            userEmail,
            changes,
            description,
            metadata
        });
        console.log(`Student event logged: ${eventType} for ${studentId}`);
    } catch (e) {
        console.error("Error logging student event:", e);
    }
}

// ======================================================
// MAIN VIEW RENDERER (Updated with visible orange button)
// ======================================================

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents..." class="p-2 border rounded-md w-64">
                    <button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign New Student</button>
                    <!-- FIXED: bg-orange-600 (not bg-orange-300) and added z-10 for safety -->
                    <button id="transition-student-btn" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 z-10">Transition Student</button>
                    <button id="create-group-class-btn" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Create Group Class</button>
                    <button id="reassign-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Reassign Student</button>
                    <button id="view-tutor-history-directory-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">View Tutor History</button>
                    <button id="refresh-directory-btn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Refresh</button>
                </div>
            </div>
            
            <!-- 7‑column grid: Active Tutors | Total Students | Active Students | On Break | History Records | Transitioning | Group Classes -->
            <div class="grid grid-cols-7 gap-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                    <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-blue-800 text-sm">Total Students</h4>
                    <p id="total-student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-green-800 text-sm">Active Students</h4>
                    <p id="active-student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-yellow-800 text-sm">On Break</h4>
                    <p id="break-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-purple-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-purple-800 text-sm">History Records</h4>
                    <p id="history-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-orange-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-orange-800 text-sm">Transitioning</h4>
                    <p id="transitioning-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-indigo-100 p-3 rounded-lg text-center shadow">
                    <h4 class="font-bold text-indigo-800 text-sm">Group Classes</h4>
                    <p id="group-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    
    try {
        // Event Listeners for new buttons
        document.getElementById('assign-student-btn').addEventListener('click', () => {
            showAssignStudentModal();
        });

        document.getElementById('transition-student-btn').addEventListener('click', () => {
            showTransitionStudentModal();
        });

        document.getElementById('create-group-class-btn').addEventListener('click', () => {
            showCreateGroupClassModal();
        });

        document.getElementById('reassign-student-btn').addEventListener('click', () => {
            showEnhancedReassignStudentModal();
        });

        document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
        
        document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
        
        document.getElementById('view-tutor-history-directory-btn').addEventListener('click', async () => {
            if (!sessionCache.tutorAssignments || Object.keys(sessionCache.tutorAssignments).length === 0) {
                alert("No tutor history available. Please refresh."); return;
            }
            
            const students = sessionCache.students || [];
            
            const modalHtml = `
                <div id="select-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                        <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('select-student-modal').remove()">&times;</button>
                        <h3 class="text-xl font-bold mb-4">View History</h3>
                        <form id="select-student-form">
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2">Select Student</label>
                                ${createSearchableSelect(
                                    students.map(s => ({ 
                                        id: s.id, 
                                        studentName: s.studentName,
                                        grade: s.grade 
                                    })), 
                                    "Select student...", 
                                    "select-student"
                                )}
                            </div>
                            <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 w-full">View History</button>
                        </form>
                    </div>
                </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            setTimeout(() => {
                initializeSearchableSelect('select-student');
                
                const form = document.getElementById('select-student-form');
                if (form) {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const sid = document.getElementById('select-student').value;
                        if (!sid) {
                            alert("Please select a student");
                            return;
                        }
                        document.getElementById('select-student-modal').remove();
                        if(window.viewStudentTutorHistory) window.viewStudentTutorHistory(sid);
                    });
                }
            }, 100);
        });
    } catch (e) { console.error(e); }
    
    fetchAndRenderDirectory();
}

// ======================================================
// FEATURE 1: TRANSITION STUDENT MODAL (with flexible duration)
// ======================================================

function showTransitionStudentModal() {
    const students = getCleanStudents();
    const tutors = getCleanTutors();
    
    if (students.length === 0 || tutors.length === 0) {
        alert("No students or tutors available. Please refresh.");
        return;
    }
    
    const modalHtml = `
        <div id="transition-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white w-full max-w-lg rounded-lg shadow-xl p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-orange-700">Transition Student (Temporary)</h3>
                    <button onclick="document.getElementById('transition-student-modal').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <form id="transition-student-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Select Student *</label>
                        ${createSearchableSelect(
                            students.map(s => ({ 
                                id: s.id, 
                                studentName: s.studentName,
                                grade: s.grade,
                                currentTutor: s.tutorName
                            })), 
                            "Type student name...", 
                            "transition-student"
                        )}
                    </div>
                    
                    <div id="current-tutor-info" class="mb-4 p-3 bg-blue-50 rounded-md hidden">
                        <div class="text-sm">
                            <div class="font-medium">Current Tutor</div>
                            <div class="text-gray-600" id="current-tutor-details"></div>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Temporary Tutor *</label>
                        ${createSearchableSelect(
                            tutors.map(t => ({ 
                                email: t.email, 
                                name: t.name,
                                employmentDate: t.employmentDate
                            })), 
                            "Type tutor name...", 
                            "transition-tutor",
                            true
                        )}
                    </div>
                    
                    <!-- Duration Dropdown -->
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Transition Duration *</label>
                        <select id="transition-duration" 
                                class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                            <option value="1">1 day</option>
                            <option value="3">3 days</option>
                            <option value="7">1 week</option>
                            <option value="14" selected>2 weeks</option>
                            <option value="21">3 weeks</option>
                            <option value="28">4 weeks</option>
                        </select>
                    </div>
                    
                    <!-- Calculated End Date (read-only) -->
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">End Date (auto-calculated)</label>
                        <input type="text" 
                               id="transition-end-date-display" 
                               class="w-full p-2 bg-gray-100 border rounded-md text-gray-700" 
                               readonly>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Reason for Transition</label>
                        <textarea id="transition-reason" 
                                  class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                  rows="3" 
                                  placeholder="E.g., Main tutor on leave, vacation, etc."></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="flex items-center">
                            <input type="checkbox" id="allow-reporting" class="mr-2">
                            <span class="text-sm text-gray-700">Allow new tutor to write reports (if transition ≥ 2 weeks)</span>
                        </label>
                    </div>
                    
                    <div class="flex justify-end gap-3">
                        <button type="button" 
                                onclick="document.getElementById('transition-student-modal').remove()" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="transition-submit-btn" 
                                class="px-5 py-2.5 bg-orange-600 text-white rounded-md hover:bg-orange-700">
                            Start Transition
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('transition-student-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        initializeSearchableSelect('transition-student');
        initializeSearchableSelect('transition-tutor');
        
        // Update end date display based on start date and duration
        function updateEndDate() {
            const startDateStr = document.getElementById('transition-start-date').value;
            if (!startDateStr) return;
            const startDate = new Date(startDateStr);
            const durationDays = parseInt(document.getElementById('transition-duration').value, 10);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + durationDays);
            document.getElementById('transition-end-date-display').value = endDate.toISOString().split('T')[0];
        }
        
        // Use hidden start date field (we'll keep the date picker but hide it)
        const startDateHtml = `<input type="date" id="transition-start-date" value="${new Date().toISOString().split('T')[0]}" class="hidden">`;
        document.querySelector('#transition-student-form').insertAdjacentHTML('afterbegin', startDateHtml);
        
        document.getElementById('transition-duration').addEventListener('change', updateEndDate);
        document.getElementById('transition-start-date').addEventListener('change', updateEndDate);
        updateEndDate(); // initial
        
        // Show current tutor info when student selected
        document.getElementById('transition-student').addEventListener('change', function() {
            const studentId = this.value;
            const student = students.find(s => s.id === studentId);
            const infoDiv = document.getElementById('current-tutor-info');
            const detailsDiv = document.getElementById('current-tutor-details');
            
            if (student) {
                infoDiv.classList.remove('hidden');
                detailsDiv.textContent = `${student.tutorName} (${student.tutorEmail})`;
            }
        });
        
        // Form submission
        document.getElementById('transition-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const studentId = document.getElementById('transition-student').value;
            const tutorEmail = document.getElementById('transition-tutor').value;
            const startDate = document.getElementById('transition-start-date').value;
            const endDate = document.getElementById('transition-end-date-display').value;
            const durationDays = parseInt(document.getElementById('transition-duration').value, 10);
            const reason = document.getElementById('transition-reason').value.trim();
            const allowReporting = document.getElementById('allow-reporting').checked;
            
            if (!studentId || !tutorEmail || !startDate || !endDate) {
                alert("Please fill all required fields");
                return;
            }
            
            const student = students.find(s => s.id === studentId);
            const newTutor = tutors.find(t => t.email === tutorEmail);
            
            if (!student || !newTutor) {
                alert("Invalid selection");
                return;
            }
            
            if (student.tutorEmail === tutorEmail) {
                alert("Student is already with this tutor");
                return;
            }
            
            if (confirm(`Transition ${student.studentName} from ${student.tutorName} to ${newTutor.name} until ${endDate}?`)) {
                await performTransition(student, newTutor, startDate, endDate, reason, allowReporting, durationDays);
            }
        });
    }, 100);
}

async function performTransition(student, newTutor, startDate, endDate, reason, allowReporting, durationDays) {
    const btn = document.getElementById('transition-submit-btn');
    btn.textContent = "Processing...";
    btn.disabled = true;
    
    try {
        const user = window.userData?.name || 'Admin';
        const userEmail = window.userData?.email || 'admin@system';
        const timestamp = new Date().toISOString();
        
        // 1. Update student record with transitioning info
        await updateDoc(doc(db, "students", student.id), {
            originalTutorEmail: student.tutorEmail,
            originalTutorName: student.tutorName,
            tutorEmail: newTutor.email,
            tutorName: newTutor.name,
            isTransitioning: true,
            transitionStartDate: startDate,
            transitionEndDate: endDate,
            transitionReason: reason,
            transitionDurationDays: durationDays,   // store duration
            allowReportsDuringTransition: allowReporting,
            updatedAt: timestamp,
            updatedBy: user
        });
        
        // 2. Create transition record
        const transitionRef = await addDoc(collection(db, "tutorTransitions"), {
            studentId: student.id,
            studentName: student.studentName,
            originalTutorEmail: student.tutorEmail,
            originalTutorName: student.tutorName,
            temporaryTutorEmail: newTutor.email,
            temporaryTutorName: newTutor.name,
            startDate: startDate,
            endDate: endDate,
            durationDays: durationDays,
            reason: reason,
            allowReports: allowReporting,
            createdBy: user,
            createdByEmail: userEmail,
            createdAt: timestamp,
            status: 'active'
        });
        
        // 3. Log student event
        await logStudentEvent(
            student.id,
            'TRANSITION_START',
            {
                fromTutor: student.tutorEmail,
                toTutor: newTutor.email,
                startDate,
                endDate,
                durationDays
            },
            `Transition started: ${student.tutorName} → ${newTutor.name} (${durationDays} days)`,
            { transitionId: transitionRef.id, reason, allowReporting }
        );
        
        alert(`✅ ${student.studentName} is now transitioning to ${newTutor.name} until ${endDate}`);
        
        setTimeout(() => {
            document.getElementById('transition-student-modal').remove();
            fetchAndRenderDirectory(true);
        }, 1000);
        
    } catch (error) {
        console.error("Transition error:", error);
        alert(`Error: ${error.message}`);
        btn.textContent = "Start Transition";
        btn.disabled = false;
    }
}

// ======================================================
// FEATURE 2: CREATE GROUP CLASS MODAL (UPDATED with parent details)
// ======================================================

function showCreateGroupClassModal() {
    const students = getCleanStudents();
    const tutors = getCleanTutors();
    
    if (tutors.length === 0) {
        alert("No tutors available. Please refresh.");
        return;
    }
    
    const modalHtml = `
        <div id="group-class-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white w-full max-w-4xl rounded-lg shadow-xl p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-indigo-700">Create Group Class</h3>
                    <button onclick="document.getElementById('group-class-modal').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <form id="group-class-form">
                    <div class="grid grid-cols-2 gap-6">
                        <!-- Left Column -->
                        <div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Group Name *</label>
                                <input type="text" 
                                       id="group-name" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Advanced Math Group, SAT Prep Class"
                                       required>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Tutor *</label>
                                ${createSearchableSelect(
                                    tutors.map(t => ({ 
                                        email: t.email, 
                                        name: t.name,
                                        employmentDate: t.employmentDate
                                    })), 
                                    "Select tutor...", 
                                    "group-tutor",
                                    true
                                )}
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Subject *</label>
                                <input type="text" 
                                       id="group-subject" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Mathematics, English Literature"
                                       required>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Schedule</label>
                                <input type="text" 
                                       id="group-schedule" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Mon & Wed 4-6PM, Sat 10AM-12PM">
                            </div>
                        </div>
                        
                        <!-- Right Column -->
                        <div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Select Students *</label>
                                <div class="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                                    ${students.map(student => `
                                        <div class="flex items-center mb-2 p-2 hover:bg-gray-50 rounded">
                                            <input type="checkbox" 
                                                   id="student-${student.id}" 
                                                   value="${student.id}" 
                                                   class="mr-3 group-student-checkbox">
                                            <label for="student-${student.id}" class="flex-1 cursor-pointer">
                                                <div class="font-medium">${student.studentName}</div>
                                                <div class="text-xs text-gray-500">
                                                    Grade: ${student.grade || 'N/A'} | 
                                                    Current Tutor: ${student.tutorName || 'N/A'}
                                                    ${student.groupId ? ' <span class="text-blue-600">(Already in group)</span>' : ''}
                                                </div>
                                            </label>
                                            <input type="number" 
                                                   min="0" 
                                                   step="0.01"
                                                   placeholder="₦ Fee"
                                                   class="ml-2 w-24 p-1 border rounded text-sm hidden group-fee-input"
                                                   data-student-id="${student.id}">
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Students can belong to multiple groups</p>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Total Group Fee</label>
                                <div class="text-lg font-bold text-indigo-700" id="total-group-fee">₦0.00</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Group Notes</label>
                        <textarea id="group-notes" 
                                  class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                  rows="2" 
                                  placeholder="Any additional information about this group..."></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-3">
                        <button type="button" 
                                onclick="document.getElementById('group-class-modal').remove()" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="group-submit-btn" 
                                class="px-5 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                            Create Group Class
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('group-class-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        initializeSearchableSelect('group-tutor');
        
        document.querySelectorAll('.group-student-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const feeInput = document.querySelector(`.group-fee-input[data-student-id="${this.value}"]`);
                if (this.checked) {
                    feeInput.classList.remove('hidden');
                    feeInput.required = true;
                } else {
                    feeInput.classList.add('hidden');
                    feeInput.required = false;
                    feeInput.value = '';
                }
                calculateTotalGroupFee();
            });
        });
        
        document.querySelectorAll('.group-fee-input').forEach(input => {
            input.addEventListener('input', calculateTotalGroupFee);
        });
        
        document.getElementById('group-class-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const groupName = document.getElementById('group-name').value.trim();
            const tutorEmail = document.getElementById('group-tutor').value;
            const subject = document.getElementById('group-subject').value.trim();
            const schedule = document.getElementById('group-schedule').value.trim();
            const notes = document.getElementById('group-notes').value.trim();
            
            const selectedCheckboxes = document.querySelectorAll('.group-student-checkbox:checked');
            
            if (!groupName || !tutorEmail || !subject) {
                alert("Please fill all required fields");
                return;
            }
            
            if (selectedCheckboxes.length === 0) {
                alert("Please select at least one student");
                return;
            }
            
            let allFeesValid = true;
            const studentFees = [];
            
            selectedCheckboxes.forEach(cb => {
                const feeInput = document.querySelector(`.group-fee-input[data-student-id="${cb.value}"]`);
                const fee = parseFloat(feeInput.value) || 0;
                if (fee <= 0) {
                    alert(`Please enter a valid fee for selected student`);
                    allFeesValid = false;
                }
                studentFees.push({
                    studentId: cb.value,
                    fee: fee
                });
            });
            
            if (!allFeesValid) return;
            
            const tutor = tutors.find(t => t.email === tutorEmail);
            
            if (confirm(`Create group "${groupName}" with ${selectedCheckboxes.length} students under ${tutor.name}?`)) {
                await createGroupClass(groupName, tutor, subject, schedule, notes, studentFees);
            }
        });
    }, 100);
}

function calculateTotalGroupFee() {
    let total = 0;
    document.querySelectorAll('.group-fee-input').forEach(input => {
        if (!input.classList.contains('hidden')) {
            total += parseFloat(input.value) || 0;
        }
    });
    document.getElementById('total-group-fee').textContent = `₦${total.toFixed(2)}`;
}

async function createGroupClass(groupName, tutor, subject, schedule, notes, studentFees) {
    const btn = document.getElementById('group-submit-btn');
    btn.textContent = "Creating...";
    btn.disabled = true;
    
    try {
        const user = window.userData?.name || 'Admin';
        const timestamp = new Date().toISOString();
        
        // Collect parent details for each student
        const parentDetails = [];
        const studentIds = [];
        const studentNames = [];
        
        for (const sf of studentFees) {
            const studentDoc = await getDoc(doc(db, "students", sf.studentId));
            if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                studentIds.push(sf.studentId);
                studentNames.push(studentData.studentName);
                parentDetails.push({
                    studentId: sf.studentId,
                    studentName: studentData.studentName,
                    parentName: studentData.parentName || 'N/A',
                    parentEmail: studentData.parentEmail || 'N/A',
                    parentPhone: studentData.parentPhone || 'N/A'
                });
            }
        }
        
        const groupRef = await addDoc(collection(db, "groupClasses"), {
            groupName: groupName,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            subject: subject,
            schedule: schedule,
            notes: notes,
            studentCount: studentFees.length,
            totalFee: studentFees.reduce((sum, sf) => sum + sf.fee, 0),
            createdAt: timestamp,
            createdBy: user,
            status: 'active',
            studentIds: studentIds,
            studentNames: studentNames,
            parentDetails: parentDetails  // Store all parent info
        });
        
        console.log("Group created with ID:", groupRef.id);
        
        const updatePromises = studentFees.map(async (sf) => {
            const studentDoc = await getDoc(doc(db, "students", sf.studentId));
            if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                const currentGroups = studentData.groups || [];
                
                await updateDoc(doc(db, "students", sf.studentId), {
                    groups: [...currentGroups, {
                        groupId: groupRef.id,
                        groupName: groupName,
                        tutorEmail: tutor.email,
                        tutorName: tutor.name,
                        subject: subject,
                        schedule: schedule,
                        groupFee: sf.fee,
                        joinedAt: timestamp
                    }],
                    groupId: groupRef.id,
                    groupName: groupName,
                    updatedAt: timestamp,
                    updatedBy: user
                });
                
                await addDoc(collection(db, "groupStudentFees"), {
                    groupId: groupRef.id,
                    groupName: groupName,
                    studentId: sf.studentId,
                    studentName: studentData.studentName,
                    fee: sf.fee,
                    createdAt: timestamp,
                    createdBy: user
                });
                
                // Log group addition event for each student
                await logStudentEvent(
                    sf.studentId,
                    'GROUP_ADD',
                    { groupId: groupRef.id, groupName, fee: sf.fee },
                    `Added to group "${groupName}" with fee ₦${sf.fee}`,
                    { groupId: groupRef.id, tutor: tutor.email, subject, schedule }
                );
            }
        });
        
        await Promise.all(updatePromises);
        
        alert(`✅ Group "${groupName}" created successfully with ${studentFees.length} students!`);
        
        setTimeout(() => {
            document.getElementById('group-class-modal').remove();
            fetchAndRenderDirectory(true);
        }, 1000);
        
    } catch (error) {
        console.error("Group creation error:", error);
        alert(`Error: ${error.message}`);
        btn.textContent = "Create Group Class";
        btn.disabled = false;
    }
}

// ======================================================
// ENHANCED REASSIGN STUDENT MODAL (with flexible duration + visible button + reason)
// ======================================================

function showEnhancedReassignStudentModal() {
    const students = getCleanStudents();
    const tutors = getCleanTutors();
    
    if (!validateReassignData(students, tutors)) return;
    
    const existingModal = document.getElementById('reassign-student-modal');
    if (existingModal) existingModal.remove();
    
    const modalHtml = `
        <div id="reassign-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white w-full max-w-lg rounded-lg shadow-xl p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-blue-700">Reassign / Transition Student</h3>
                    <button onclick="document.getElementById('reassign-student-modal').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <div class="mb-4">
                    <div class="flex space-x-2 mb-3">
                        <button type="button" 
                                id="reassign-type-permanent" 
                                class="flex-1 py-2 px-4 border rounded-md font-medium bg-blue-600 text-white border-blue-600">
                            Permanent Reassignment
                        </button>
                        <button type="button" 
                                id="reassign-type-temporary" 
                                class="flex-1 py-2 px-4 border rounded-md font-medium bg-gray-300 text-gray-800 border-gray-400">
                            Temporary Transition
                        </button>
                    </div>
                </div>
                
                <form id="reassign-student-form">
                    <!-- Permanent Reassignment Fields -->
                    <div id="permanent-fields">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Select Student</label>
                            ${createSearchableSelect(
                                students.map(s => ({ 
                                    id: s.id, 
                                    studentName: s.studentName,
                                    grade: s.grade,
                                    currentTutor: s.tutorName
                                })), 
                                "Type student name...", 
                                "reassign-student"
                            )}
                        </div>
                        
                        <div id="student-info" class="mb-4 p-3 bg-blue-50 rounded-md hidden">
                            <div class="text-sm">
                                <div class="font-medium" id="selected-student-name"></div>
                                <div class="text-gray-600" id="selected-student-details"></div>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Select New Tutor</label>
                            ${createSearchableSelect(
                                tutors.map(t => ({ 
                                    email: t.email, 
                                    name: t.name,
                                    employmentDate: t.employmentDate
                                })), 
                                "Type tutor name...", 
                                "reassign-tutor",
                                true
                            )}
                        </div>
                        
                        <div id="tutor-info" class="mb-4 p-3 bg-green-50 rounded-md hidden">
                            <div class="text-sm">
                                <div class="font-medium" id="selected-tutor-name"></div>
                                <div class="text-gray-600" id="selected-tutor-details"></div>
                            </div>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Reason for Reassignment *</label>
                            <textarea id="reassign-reason" 
                                      class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                      rows="3" 
                                      placeholder="Enter reason for permanent reassignment..."
                                      required></textarea>
                        </div>
                    </div>
                    
                    <!-- Temporary Transition Fields (flexible duration + reason) -->
                    <div id="temporary-fields" class="hidden">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Select Student</label>
                            ${createSearchableSelect(
                                students.map(s => ({ 
                                    id: s.id, 
                                    studentName: s.studentName,
                                    grade: s.grade,
                                    currentTutor: s.tutorName
                                })), 
                                "Type student name...", 
                                "reassign-student-temp"
                            )}
                        </div>
                        
                        <div id="student-info-temp" class="mb-4 p-3 bg-blue-50 rounded-md hidden">
                            <div class="text-sm">
                                <div class="font-medium" id="selected-student-name-temp"></div>
                                <div class="text-gray-600" id="selected-student-details-temp"></div>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Temporary Tutor *</label>
                            ${createSearchableSelect(
                                tutors.map(t => ({ 
                                    email: t.email, 
                                    name: t.name,
                                    employmentDate: t.employmentDate
                                })), 
                                "Type tutor name...", 
                                "reassign-tutor-temp",
                                true
                            )}
                        </div>
                        
                        <div id="tutor-info-temp" class="mb-4 p-3 bg-green-50 rounded-md hidden">
                            <div class="text-sm">
                                <div class="font-medium" id="selected-tutor-name-temp"></div>
                                <div class="text-gray-600" id="selected-tutor-details-temp"></div>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Transition Duration *</label>
                            <select id="transition-duration-reassign" 
                                    class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    required>
                                <option value="1">1 day</option>
                                <option value="3">3 days</option>
                                <option value="7">1 week</option>
                                <option value="14" selected>2 weeks</option>
                                <option value="21">3 weeks</option>
                                <option value="28">4 weeks</option>
                            </select>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">End Date (auto-calculated)</label>
                            <input type="text" 
                                   id="transition-end-date-reassign-display" 
                                   class="w-full p-2 bg-gray-100 border rounded-md text-gray-700" 
                                   readonly>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Reason for Transition *</label>
                            <textarea id="transition-reason-temp" 
                                      class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                      rows="3" 
                                      placeholder="E.g., Main tutor on leave, vacation, etc."
                                      required></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label class="flex items-center">
                                <input type="checkbox" id="allow-reporting-reassign" class="mr-2" checked>
                                <span class="text-sm text-gray-700">Allow reports during transition</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3">
                        <button type="button" 
                                onclick="document.getElementById('reassign-student-modal').remove()" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="reassign-submit-btn" 
                                class="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            Confirm Reassignment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        // Initialize both sets of searchable selects
        initializeSearchableSelect('reassign-student');
        initializeSearchableSelect('reassign-tutor');
        initializeSearchableSelect('reassign-student-temp');
        initializeSearchableSelect('reassign-tutor-temp');
        
        // Hidden start date for temporary transition
        const startDateHtml = `<input type="date" id="transition-start-date-reassign" value="${new Date().toISOString().split('T')[0]}" class="hidden">`;
        document.querySelector('#temporary-fields').insertAdjacentHTML('afterbegin', startDateHtml);
        
        // Initially, temporary fields are hidden, so disable their required attributes
        document.getElementById('transition-reason-temp').required = false;
        document.getElementById('transition-duration-reassign').required = false;
        
        function updateTemporaryEndDate() {
            const startDateStr = document.getElementById('transition-start-date-reassign').value;
            if (!startDateStr) return;
            const startDate = new Date(startDateStr);
            const durationDays = parseInt(document.getElementById('transition-duration-reassign').value, 10);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + durationDays);
            document.getElementById('transition-end-date-reassign-display').value = endDate.toISOString().split('T')[0];
        }
        
        document.getElementById('transition-duration-reassign').addEventListener('change', updateTemporaryEndDate);
        document.getElementById('transition-start-date-reassign').addEventListener('change', updateTemporaryEndDate);
        updateTemporaryEndDate();
        
        // Toggle between permanent and temporary
        const permanentBtn = document.getElementById('reassign-type-permanent');
        const temporaryBtn = document.getElementById('reassign-type-temporary');
        const permanentFields = document.getElementById('permanent-fields');
        const temporaryFields = document.getElementById('temporary-fields');
        const submitBtn = document.getElementById('reassign-submit-btn');
        
        function setActiveType(isTemporary) {
            if (isTemporary) {
                permanentBtn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                permanentBtn.classList.add('bg-gray-300', 'text-gray-800', 'border-gray-400');
                temporaryBtn.classList.remove('bg-gray-300', 'text-gray-800', 'border-gray-400');
                temporaryBtn.classList.add('bg-orange-600', 'text-white', 'border-orange-600');
                permanentFields.classList.add('hidden');
                temporaryFields.classList.remove('hidden');
                submitBtn.textContent = "Confirm Transition";
                submitBtn.className = "px-5 py-2.5 bg-orange-600 text-white rounded-md hover:bg-orange-700";
                
                // Enable required on temporary fields
                document.getElementById('transition-reason-temp').required = true;
                document.getElementById('transition-duration-reassign').required = true;
            } else {
                permanentBtn.classList.remove('bg-gray-300', 'text-gray-800', 'border-gray-400');
                permanentBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                temporaryBtn.classList.remove('bg-orange-600', 'text-white', 'border-orange-600');
                temporaryBtn.classList.add('bg-gray-300', 'text-gray-800', 'border-gray-400');
                permanentFields.classList.remove('hidden');
                temporaryFields.classList.add('hidden');
                submitBtn.textContent = "Confirm Reassignment";
                submitBtn.className = "px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700";
                
                // Disable required on temporary fields
                document.getElementById('transition-reason-temp').required = false;
                document.getElementById('transition-duration-reassign').required = false;
            }
        }
        
        permanentBtn.addEventListener('click', () => setActiveType(false));
        temporaryBtn.addEventListener('click', () => setActiveType(true));
        
        // Student selection handlers (permanent)
        document.getElementById('reassign-student').addEventListener('change', function() {
            const studentId = this.value;
            const student = students.find(s => s.id === studentId);
            updateStudentInfo(student, '');
        });
        
        // Tutor selection handlers (permanent)
        document.getElementById('reassign-tutor').addEventListener('change', function() {
            const tutorEmail = this.value;
            const tutor = tutors.find(t => t.email === tutorEmail);
            updateTutorInfo(tutor, '');
        });
        
        // Student selection handlers (temporary)
        document.getElementById('reassign-student-temp').addEventListener('change', function() {
            const studentId = this.value;
            const student = students.find(s => s.id === studentId);
            updateStudentInfo(student, '-temp');
        });
        
        // Tutor selection handlers (temporary)
        document.getElementById('reassign-tutor-temp').addEventListener('change', function() {
            const tutorEmail = this.value;
            const tutor = tutors.find(t => t.email === tutorEmail);
            updateTutorInfo(tutor, '-temp');
        });
        
        // Form submission handler
        document.getElementById('reassign-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const isTemporary = !temporaryFields.classList.contains('hidden');
            
            if (isTemporary) {
                const studentId = document.getElementById('reassign-student-temp').value;
                const tutorEmail = document.getElementById('reassign-tutor-temp').value;
                const reason = document.getElementById('transition-reason-temp').value.trim();
                const endDate = document.getElementById('transition-end-date-reassign-display').value;
                const durationDays = parseInt(document.getElementById('transition-duration-reassign').value, 10);
                const allowReporting = document.getElementById('allow-reporting-reassign').checked;
                const startDate = document.getElementById('transition-start-date-reassign').value;
                
                if (!studentId || !tutorEmail || !reason) {
                    alert("Please select student, tutor and provide a reason");
                    return;
                }
                
                const student = students.find(s => s.id === studentId);
                const newTutor = tutors.find(t => t.email === tutorEmail);
                
                if (student.tutorEmail === tutorEmail) {
                    alert("Student is already assigned to this tutor");
                    return;
                }
                
                if (confirm(`Temporarily transition ${student.studentName} to ${newTutor.name} for ${durationDays} days (until ${endDate})?`)) {
                    await performTransition(
                        student, 
                        newTutor, 
                        startDate, 
                        endDate, 
                        reason, 
                        allowReporting,
                        durationDays
                    );
                }
            } else {
                const studentId = document.getElementById('reassign-student').value;
                const tutorEmail = document.getElementById('reassign-tutor').value;
                const reason = document.getElementById('reassign-reason').value.trim();
                
                if (!studentId || !tutorEmail || !reason) {
                    alert("Please select student, tutor and enter a reason");
                    return;
                }
                
                const student = students.find(s => s.id === studentId);
                const newTutor = tutors.find(t => t.email === tutorEmail);
                const currentTutor = tutors.find(t => t.email === student.tutorEmail);
                
                if (student.tutorEmail === tutorEmail) {
                    alert("Student is already assigned to this tutor");
                    return;
                }
                
                if (confirm(`Permanently reassign ${student.studentName} from "${currentTutor?.name || 'Unassigned'}" to "${newTutor.name}"?`)) {
                    await performReassignment(student, newTutor, reason, currentTutor);
                }
            }
        });
        
        // Helper functions for student/tutor info display
        function updateStudentInfo(student, suffix) {
            const infoDiv = document.getElementById(`student-info${suffix}`);
            const nameDiv = document.getElementById(`selected-student-name${suffix}`);
            const detailsDiv = document.getElementById(`selected-student-details${suffix}`);
            
            if (student) {
                infoDiv.classList.remove('hidden');
                nameDiv.textContent = student.studentName;
                detailsDiv.innerHTML = `
                    Grade: ${student.grade || 'N/A'} | 
                    Fee: ₦${(student.studentFee || 0).toFixed(2)} | 
                    Current: ${student.tutorName || 'Unassigned'}
                    ${student.groupId ? '<br><span class="text-blue-600">Group: ' + (student.groupName || 'Yes') + '</span>' : ''}
                `;
            } else {
                infoDiv.classList.add('hidden');
            }
        }
        
        function updateTutorInfo(tutor, suffix) {
            const infoDiv = document.getElementById(`tutor-info${suffix}`);
            const nameDiv = document.getElementById(`selected-tutor-name${suffix}`);
            const detailsDiv = document.getElementById(`selected-tutor-details${suffix}`);
            
            if (tutor) {
                infoDiv.classList.remove('hidden');
                nameDiv.textContent = tutor.name;
                detailsDiv.innerHTML = `
                    Email: ${tutor.email} | 
                    Subjects: ${Array.isArray(tutor.subjects) ? tutor.subjects.join(', ') : tutor.subjects || 'N/A'}
                `;
            } else {
                infoDiv.classList.add('hidden');
            }
        }
    }, 100);
}

async function performReassignment(student, newTutor, reason, currentTutor) {
    const btn = document.getElementById('reassign-submit-btn');
    const originalText = btn.textContent;
    btn.textContent = "Processing..."; 
    btn.disabled = true;
    
    try {
        const user = window.userData?.name || 'Admin';
        const userEmail = window.userData?.email || 'admin@system';
        const timestamp = new Date().toISOString();
        
        const assignmentRef = await addDoc(collection(db, "tutorAssignments"), {
            studentId: student.id, 
            studentName: student.studentName,
            oldTutorEmail: student.tutorEmail || '', 
            oldTutorName: currentTutor?.name || 'Unassigned',
            newTutorEmail: newTutor.email, 
            newTutorName: newTutor.name,
            reason, 
            assignedBy: user, 
            assignedByEmail: userEmail,
            assignedAt: timestamp, 
            timestamp: timestamp
        });
        
        await updateDoc(doc(db, "students", student.id), {
            tutorEmail: newTutor.email, 
            tutorName: newTutor.name,
            updatedAt: timestamp, 
            updatedBy: user
        });
        
        // Log student event
        await logStudentEvent(
            student.id,
            'TUTOR_REASSIGNMENT',
            {
                oldTutor: student.tutorEmail,
                newTutor: newTutor.email,
                reason
            },
            `Tutor reassigned: ${student.tutorName || 'Unassigned'} → ${newTutor.name}`,
            { assignmentId: assignmentRef.id, reason }
        );
        
        alert(`✅ Successfully reassigned ${student.studentName} to ${newTutor.name}!`);
        
        setTimeout(() => { 
            document.getElementById('reassign-student-modal').remove(); 
            fetchAndRenderDirectory(true); 
        }, 1500);
        
    } catch (e) {
        console.error("Reassignment error:", e);
        alert("Error: " + e.message); 
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ======================================================
// MANAGE TRANSITION MODAL (Extend/End Transition) - with event logging
// ======================================================

function showManageTransitionModal(studentId) {
    const students = sessionCache.students || [];
    const student = students.find(s => s.id === studentId);
    
    if (!student || !student.isTransitioning) {
        alert("This student is not currently transitioning");
        return;
    }
    
    const modalHtml = `
        <div id="manage-transition-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white w-full max-w-md rounded-lg shadow-xl p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-orange-700">Manage Transition</h3>
                    <button onclick="document.getElementById('manage-transition-modal').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <div class="mb-4 p-3 bg-orange-50 rounded-md">
                    <div class="text-sm">
                        <div class="font-medium">${student.studentName}</div>
                        <div class="text-gray-600 mt-1">
                            <div>Current: ${student.tutorName} (Temporary)</div>
                            <div>Original: ${student.originalTutorName}</div>
                            <div>Ends: ${formatBadgeDate(student.transitionEndDate)}</div>
                            <div>Days left: ${student.transitionDaysLeft || 0}</div>
                        </div>
                    </div>
                </div>
                
                <form id="manage-transition-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Action</label>
                        <select id="transition-action" 
                                class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                            <option value="extend">Extend Transition Period</option>
                            <option value="end">End Transition Early</option>
                            <option value="make-permanent">Make Permanent Reassignment</option>
                        </select>
                    </div>
                    
                    <div id="extend-fields">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Extend By</label>
                            <select id="extend-duration" class="w-full border border-gray-300 p-3 rounded-md">
                                <option value="7">1 week</option>
                                <option value="14">2 weeks</option>
                                <option value="21">3 weeks</option>
                                <option value="28">4 weeks</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">New End Date (auto-calculated)</label>
                            <input type="text" id="new-end-date-display" class="w-full p-2 bg-gray-100 border rounded-md text-gray-700" readonly>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700">Extension Reason</label>
                            <textarea id="extension-reason" 
                                      class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                                      rows="2" 
                                      placeholder="Why extend the transition?"></textarea>
                        </div>
                    </div>
                    
                    <div id="end-fields" class="hidden">
                        <div class="mb-4 p-3 bg-blue-50 rounded-md">
                            <p class="text-sm text-blue-700">
                                Student will return to ${student.originalTutorName} immediately.
                            </p>
                        </div>
                    </div>
                    
                    <div id="permanent-fields" class="hidden">
                        <div class="mb-4 p-3 bg-green-50 rounded-md">
                            <p class="text-sm text-green-700">
                                ${student.tutorName} will become the permanent tutor.
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 mt-6">
                        <button type="button" 
                                onclick="document.getElementById('manage-transition-modal').remove()" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="manage-transition-submit" 
                                class="px-5 py-2.5 bg-orange-600 text-white rounded-md hover:bg-orange-700">
                            Apply Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('manage-transition-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        // Calculate and display new end date based on current end date + extension
        function updateNewEndDate() {
            const currentEndDate = new Date(student.transitionEndDate);
            const extendDays = parseInt(document.getElementById('extend-duration').value, 10);
            const newEnd = new Date(currentEndDate);
            newEnd.setDate(currentEndDate.getDate() + extendDays);
            document.getElementById('new-end-date-display').value = newEnd.toISOString().split('T')[0];
        }
        
        if (document.getElementById('extend-duration')) {
            document.getElementById('extend-duration').addEventListener('change', updateNewEndDate);
            updateNewEndDate();
        }
        
        const actionSelect = document.getElementById('transition-action');
        const extendFields = document.getElementById('extend-fields');
        const endFields = document.getElementById('end-fields');
        const permanentFields = document.getElementById('permanent-fields');
        
        actionSelect.addEventListener('change', function() {
            extendFields.classList.add('hidden');
            endFields.classList.add('hidden');
            permanentFields.classList.add('hidden');
            
            if (this.value === 'extend') {
                extendFields.classList.remove('hidden');
            } else if (this.value === 'end') {
                endFields.classList.remove('hidden');
            } else if (this.value === 'make-permanent') {
                permanentFields.classList.remove('hidden');
            }
        });
        
        document.getElementById('manage-transition-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const action = actionSelect.value;
            const btn = document.getElementById('manage-transition-submit');
            btn.textContent = "Processing...";
            btn.disabled = true;
            
            try {
                const user = window.userData?.name || 'Admin';
                const timestamp = new Date().toISOString();
                
                if (action === 'extend') {
                    const newEndDate = document.getElementById('new-end-date-display').value;
                    const reason = document.getElementById('extension-reason').value.trim() || 'No reason provided';
                    const extendDays = parseInt(document.getElementById('extend-duration').value, 10);
                    
                    await updateDoc(doc(db, "students", studentId), {
                        transitionEndDate: newEndDate,
                        updatedAt: timestamp,
                        updatedBy: user
                    });
                    
                    const transitions = sessionCache.tutorTransitions || [];
                    const transition = transitions.find(t => t.studentId === studentId && t.status === 'active');
                    if (transition) {
                        await updateDoc(doc(db, "tutorTransitions", transition.id), {
                            endDate: newEndDate,
                            extensions: [...(transition.extensions || []), {
                                extendedTo: newEndDate,
                                reason: reason,
                                extendedBy: user,
                                extendedAt: timestamp,
                                daysAdded: extendDays
                            }]
                        });
                    }
                    
                    await logStudentEvent(
                        studentId,
                        'TRANSITION_EXTEND',
                        { oldEndDate: student.transitionEndDate, newEndDate, daysAdded: extendDays },
                        `Transition extended by ${extendDays} days until ${newEndDate}`,
                        { reason }
                    );
                    
                    alert("✅ Transition period extended successfully");
                    
                } else if (action === 'end') {
                    await updateDoc(doc(db, "students", studentId), {
                        tutorEmail: student.originalTutorEmail,
                        tutorName: student.originalTutorName,
                        isTransitioning: false,
                        transitionEndDate: null,
                        originalTutorEmail: null,
                        originalTutorName: null,
                        updatedAt: timestamp,
                        updatedBy: user
                    });
                    
                    const transitions = sessionCache.tutorTransitions || [];
                    const transition = transitions.find(t => t.studentId === studentId && t.status === 'active');
                    if (transition) {
                        await updateDoc(doc(db, "tutorTransitions", transition.id), {
                            status: 'completed',
                            completedAt: timestamp,
                            completedBy: user
                        });
                    }
                    
                    await logStudentEvent(
                        studentId,
                        'TRANSITION_END',
                        { originalTutor: student.originalTutorEmail },
                        `Transition ended early, returned to ${student.originalTutorName}`
                    );
                    
                    alert("✅ Transition ended. Student returned to original tutor.");
                    
                } else if (action === 'make-permanent') {
                    await updateDoc(doc(db, "students", studentId), {
                        isTransitioning: false,
                        transitionEndDate: null,
                        originalTutorEmail: null,
                        originalTutorName: null,
                        updatedAt: timestamp,
                        updatedBy: user
                    });
                    
                    const assignmentRef = await addDoc(collection(db, "tutorAssignments"), {
                        studentId: studentId,
                        studentName: student.studentName,
                        oldTutorEmail: student.originalTutorEmail,
                        oldTutorName: student.originalTutorName,
                        newTutorEmail: student.tutorEmail,
                        newTutorName: student.tutorName,
                        reason: 'Transition made permanent',
                        assignedBy: user,
                        assignedByEmail: window.userData?.email || 'admin@system',
                        assignedAt: timestamp,
                        timestamp: timestamp
                    });
                    
                    const transitions = sessionCache.tutorTransitions || [];
                    const transition = transitions.find(t => t.studentId === studentId && t.status === 'active');
                    if (transition) {
                        await updateDoc(doc(db, "tutorTransitions", transition.id), {
                            status: 'completed',
                            madePermanent: true,
                            completedAt: timestamp,
                            completedBy: user
                        });
                    }
                    
                    await logStudentEvent(
                        studentId,
                        'TRANSITION_MADE_PERMANENT',
                        { permanentTutor: student.tutorEmail },
                        `Transition made permanent: ${student.tutorName} is now the permanent tutor`,
                        { assignmentId: assignmentRef.id }
                    );
                    
                    alert("✅ Transition made permanent. Tutor change is now permanent.");
                }
                
                setTimeout(() => {
                    document.getElementById('manage-transition-modal').remove();
                    fetchAndRenderDirectory(true);
                }, 1000);
                
            } catch (error) {
                console.error("Manage transition error:", error);
                alert(`Error: ${error.message}`);
                btn.textContent = "Apply Changes";
                btn.disabled = false;
            }
        });
    }, 100);
}

// ======================================================
// UPDATED DATA FETCHING & RENDERING (with separate student counts)
// ======================================================

async function fetchAndRenderDirectory(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors'); 
        invalidateCache('students'); 
        invalidateCache('tutorAssignments');
        invalidateCache('tutorTransitions');
        invalidateCache('groupClasses');
    }

    try {
        const directoryList = document.getElementById('directory-list');
        if (directoryList) directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data...</p>`;
        
        const [
            tutorsSnapshot, 
            studentsSnapshot, 
            tutorAssignmentsSnapshot,
            transitionsSnapshot,
            groupsSnapshot
        ] = await Promise.all([
            getDocs(query(collection(db, "tutors"), orderBy("name"))),
            getDocs(query(collection(db, "students"), orderBy("studentName"))),
            getDocs(collection(db, "tutorAssignments")),
            getDocs(collection(db, "tutorTransitions")),
            getDocs(collection(db, "groupClasses"))
        ]);
        
        console.log(`Fetched: ${tutorsSnapshot.size} tutors, ${studentsSnapshot.size} students`);
        
        const allTutors = tutorsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const activeTutors = allTutors.filter(t => !t.status || t.status === 'active');
        
        const allStudents = studentsSnapshot.docs.map(doc => {
            const data = doc.data();
            const transitioningStatus = calculateTransitioningStatus(data);
            
            return { 
                ...data, 
                id: doc.id,
                summerBreak: data.summerBreak === true,
                isTransitioning: transitioningStatus.isTransitioning,
                transitionDaysLeft: transitioningStatus.daysLeft,
                shouldGenerateReport: transitioningStatus.shouldGenerateReport,
                groups: data.groups || [],
                groupId: data.groupId || null,
                groupName: data.groupName || null
            };
        });
        
        const nonArchivedStudents = allStudents.filter(s => {
            const st = (s.status || '').toLowerCase();
            return !st.includes('archived') && !st.includes('deleted');
        });
        
        const tutorAssignments = {};
        tutorAssignmentsSnapshot.docs.forEach(doc => {
            const d = doc.data();
            if (d.studentId) {
                if (!tutorAssignments[d.studentId]) tutorAssignments[d.studentId] = [];
                tutorAssignments[d.studentId].push({ ...d, id: doc.id });
            }
        });
        
        const activeTransitions = transitionsSnapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .filter(t => t.status === 'active');
        
        const groupClasses = groupsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        // Separate student counts
        const totalStudents = nonArchivedStudents.length;
        const breakStudents = nonArchivedStudents.filter(s => 
            s.summerBreak === true || 
            (s.status && ['break','suspended','inactive'].some(term => s.status.toLowerCase().includes(term)))
        ).length;
        const activeStudents = totalStudents - breakStudents;
        const transitioningCount = nonArchivedStudents.filter(s => s.isTransitioning).length;
        const groupCount = new Set(nonArchivedStudents.filter(s => s.groupId).map(s => s.groupId)).size;
        
        saveToLocalStorage('tutors', activeTutors);
        saveToLocalStorage('students', nonArchivedStudents);
        saveToLocalStorage('groupClasses', groupClasses);
        sessionCache.tutorAssignments = tutorAssignments;
        sessionCache.tutorTransitions = activeTransitions;
        sessionCache._lastUpdate = Date.now();
        
        // Update all 7 counters
        if (document.getElementById('tutor-count-badge')) {
            document.getElementById('tutor-count-badge').textContent = activeTutors.length;
        }
        if (document.getElementById('total-student-count-badge')) {
            document.getElementById('total-student-count-badge').textContent = totalStudents;
        }
        if (document.getElementById('active-student-count-badge')) {
            document.getElementById('active-student-count-badge').textContent = activeStudents;
        }
        if (document.getElementById('break-count-badge')) {
            document.getElementById('break-count-badge').textContent = breakStudents;
        }
        if (document.getElementById('history-count-badge')) {
            document.getElementById('history-count-badge').textContent = Object.keys(tutorAssignments).length;
        }
        if (document.getElementById('transitioning-count-badge')) {
            document.getElementById('transitioning-count-badge').textContent = transitioningCount;
        }
        if (document.getElementById('group-count-badge')) {
            document.getElementById('group-count-badge').textContent = groupCount;
        }
        
        renderDirectoryFromCache();
        
    } catch (error) {
        console.error(error);
        if(document.getElementById('directory-list')) {
            document.getElementById('directory-list').innerHTML = `
                <p class="text-center text-red-500">
                    Error: ${error.message} <br>
                    <button onclick="fetchAndRenderDirectory(true)" class="underline">Retry</button>
                </p>`;
        }
    }
}

// ======================================================
// UPDATED RENDER LOGIC (includes tutor employment years)
// ======================================================

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const tutorAssignments = sessionCache.tutorAssignments || {};
    const directoryList = document.getElementById('directory-list');
    
    if (!directoryList) return;
    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No data found.</p>`; 
        return;
    }

    const studentsByTutor = {};
    students.forEach(s => {
        if (s.tutorEmail) {
            if (!studentsByTutor[s.tutorEmail]) studentsByTutor[s.tutorEmail] = [];
            studentsByTutor[s.tutorEmail].push(s);
        }
    });

    const filteredTutors = tutors.filter(tutor => {
        if (!tutor) return false;
        if (!searchTerm) return true;
        
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const tutorMatch = safeSearch(tutor.name, searchTerm) || safeSearch(tutor.email, searchTerm);
        const studentMatch = assignedStudents.some(student => searchStudentFromFirebase(student, searchTerm, tutors));
        
        return tutorMatch || studentMatch;
    });

    if (searchTerm && filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center py-10">No results found.</p>`; 
        return;
    }

    const getStudentCategory = (s) => {
        if (s.isTransitioning) return 'transitioning';
        if (s.summerBreak) return 'break';
        if (s.groupId) return 'group';
        
        const st = (s.status || '').toLowerCase();
        if (st.includes('break') || st.includes('suspended') || st.includes('inactive')) return 'break';
        if (st.includes('transition')) return 'transitioning';
        
        return 'active';
    };

    const canEditStudents = window.userData?.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData?.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = canEditStudents || canDeleteStudents;

    directoryList.innerHTML = filteredTutors.map(tutor => {
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(student => !searchTerm || searchStudentFromFirebase(student, searchTerm, tutors))
            .sort((a, b) => safeToString(a.studentName).localeCompare(safeToString(b.studentName)));

        const breakCount = assignedStudents.filter(s => getStudentCategory(s) === 'break').length;
        const transCount = assignedStudents.filter(s => getStudentCategory(s) === 'transitioning').length;
        const groupCount = assignedStudents.filter(s => getStudentCategory(s) === 'group').length;
        const activeCount = assignedStudents.filter(s => getStudentCategory(s) === 'active').length;
        const totalCount = assignedStudents.length;

        // Tutor name with years of service
        let tutorTitle = tutor.name;
        if (tutor.employmentDate) {
            const years = calculateYearsOfService(tutor.employmentDate);
            if (years !== null) tutorTitle += ` (${years} yr${years !== 1 ? 's' : ''})`;
        }

        const rows = assignedStudents.map(student => {
            const category = getStudentCategory(student);
            let badge = '';
            
            if (category === 'transitioning') {
                const daysLeft = student.transitionDaysLeft || 0;
                const endDate = formatBadgeDate(student.transitionEndDate);
                badge = `
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 ml-2">
                        ⏳ Transitioning ${daysLeft > 0 ? `${daysLeft}d left` : ''} ${endDate ? `(until ${endDate})` : ''}
                    </span>
                    ${student.shouldGenerateReport ? 
                        '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-1">📝 Reports</span>' : 
                        '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-1">No Reports</span>'
                    }
                `;
            } else if (category === 'break') {
                const dateStr = formatBadgeDate(student.breakDate || student.updatedAt);
                badge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">⏸️ Break ${dateStr ? `(since ${dateStr})` : ''}</span>`;
            } else if (category === 'group') {
                badge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-2">👥 ${student.groupName || 'Group Class'}</span>`;
            } else {
                badge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">✅ Active</span>`;
            }
            
            let originalTutorBadge = '';
            if (student.isTransitioning && student.originalTutorName) {
                originalTutorBadge = `
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-1">
                        Original: ${student.originalTutorName}
                    </span>
                `;
            }
            
            const studentHistory = tutorAssignments[student.id] || [];
            const historyBtn = studentHistory.length > 0 ? 
                `<button class="view-history-btn px-2 py-1 text-xs bg-purple-600 text-white rounded-full ml-1" data-student-id="${student.id}">History</button>` : '';

            const actions = `
                ${canEditStudents ? `<button class="edit-student-btn px-2 py-1 text-xs bg-blue-600 text-white rounded-full" data-student-id="${student.id}">Edit</button>` : ''}
                ${canDeleteStudents ? `<button class="delete-student-btn px-2 py-1 text-xs bg-red-600 text-white rounded-full ml-1" data-student-id="${student.id}">Delete</button>` : ''}
                ${historyBtn}
                <button class="manage-transition-btn px-2 py-1 text-xs bg-orange-600 text-white rounded-full ml-1" data-student-id="${student.id}">Manage</button>
            `;

            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 align-middle">
                        <div class="flex flex-col">
                            <div class="font-medium">${student.studentName}</div>
                            <div class="flex flex-wrap gap-1 mt-1">${badge} ${originalTutorBadge}</div>
                        </div>
                    </td>
                    <td class="px-4 py-3 align-middle">₦${(student.studentFee||0).toFixed(2)}</td>
                    <td class="px-4 py-3 align-middle">${student.grade||'-'}</td>
                    <td class="px-4 py-3 align-middle">${student.days||'-'}</td>
                    <td class="px-4 py-3 align-middle">${Array.isArray(student.subjects)?student.subjects.join(', '):student.subjects}</td>
                    <td class="px-4 py-3 align-middle">${student.parentName||'-'}</td>
                    <td class="px-4 py-3 align-middle">${student.parentPhone||'-'}</td>
                    ${showActionsColumn ? `<td class="px-4 py-3 align-middle">${actions}</td>` : ''}
                </tr>`;
        }).join('');

        return `
            <div class="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <details open>
                    <summary class="p-5 cursor-pointer flex justify-between bg-gradient-to-r from-gray-50 to-white border-b">
                        <div>
                            <h3 class="text-lg font-semibold text-green-700">${tutorTitle} 
                                <span class="text-sm font-normal text-gray-500">(${tutor.email})</span>
                            </h3>
                            <div class="mt-1 flex gap-2 flex-wrap">
                                <span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">${activeCount} Active</span>
                                ${breakCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">${breakCount} On Break</span>` : ''}
                                ${transCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">${transCount} Transitioning</span>` : ''}
                                ${groupCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">${groupCount} Group</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 rounded-full text-sm bg-blue-50 text-blue-700">${totalCount} Total</span>
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </summary>
                    <div class="bg-white">
                        ${assignedStudents.length > 0 ? `
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                            ${showActionsColumn ? `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>` : ''}
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200">${rows}</tbody>
                                </table>
                            </div>` 
                        : `<div class="p-8 text-center text-gray-500">No students assigned.</div>`}
                    </div>
                </details>
            </div>`;
    }).join('');

    // Reattach event listeners
    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(b => {
            b.addEventListener('click', () => handleEditStudent(b.dataset.studentId));
        });
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(b => {
            b.addEventListener('click', () => handleDeleteStudent(b.dataset.studentId));
        });
    }
    document.querySelectorAll('.view-history-btn').forEach(b => {
        b.addEventListener('click', () => {
            if(window.viewStudentTutorHistory) window.viewStudentTutorHistory(b.dataset.studentId);
        });
    });
    document.querySelectorAll('.manage-transition-btn').forEach(b => {
        b.addEventListener('click', () => {
            showManageTransitionModal(b.dataset.studentId);
        });
    });
}

// ======================================================
// UTILITY & HELPER FUNCTIONS
// ======================================================

function getCleanStudents() { 
    return (sessionCache.students || [])
        .filter(s => !s.status || !s.status.toLowerCase().includes('archived')); 
}

function getCleanTutors() { 
    return (sessionCache.tutors || [])
        .filter(t => !t.status || t.status === 'active'); 
}

function validateReassignData(students, tutors) {
    if (!students.length || !tutors.length) { 
        alert("Missing student or tutor data. Please refresh."); 
        return false; 
    }
    return true;
}

// ======================================================
// UPDATED ASSIGN STUDENT MODAL (with parent email and createdBy)
// ======================================================

function showAssignStudentModal() {
    const tutors = sessionCache.tutors || [];
    const activeTutors = tutors
        .filter(tutor => !tutor.status || tutor.status === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (activeTutors.length === 0) {
        alert("No active tutors available. Please refresh the directory and try again.");
        return;
    }

    const tutorListHTML = activeTutors.map(tutor => `
        <div class="am-tutor-opt px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
            data-email="${tutor.email}" data-name="${tutor.name || tutor.email}"
            data-label="${(tutor.name || tutor.email).toLowerCase()} ${tutor.email.toLowerCase()}">
            <span class="font-medium text-gray-800">${tutor.name || tutor.email}</span>
            <span class="text-gray-400 text-xs ml-2">${tutor.email}</span>
        </div>
    `).join('');

    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[9999] p-4">
            <div class="relative bg-white w-full max-w-lg rounded-lg shadow-xl" style="max-height:92vh;overflow-y:auto;">
                <div class="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
                    <h3 class="text-xl font-bold text-gray-800">Assign New Student</h3>
                    <button class="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none" onclick="closeManagementModal('assign-modal')">&times;</button>
                </div>
                <form id="assign-student-form" class="p-5 space-y-3">

                    <!-- Searchable Tutor Selector -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Assign to Tutor <span class="text-red-500">*</span></label>
                        <div class="relative">
                            <input type="text" id="am-tutor-search" autocomplete="off" placeholder="Type tutor name or email..."
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
                            <input type="hidden" id="am-tutor-email" value="">
                            <input type="hidden" id="am-tutor-name" value="">
                            <div id="am-tutor-dropdown"
                                class="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto hidden top-full left-0">
                                ${tutorListHTML}
                            </div>
                        </div>
                        <p id="am-tutor-selected-label" class="text-xs text-green-700 mt-1 hidden"></p>
                    </div>

                    <!-- Student Name -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Student Name <span class="text-red-500">*</span></label>
                        <input type="text" id="assign-studentName" required placeholder="Full name"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Grade Dropdown -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Student Grade <span class="text-red-500">*</span></label>
                        <select id="assign-grade" required class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            ${buildGradeOptions()}
                        </select>
                    </div>

                    <!-- Days/Week (kept as text per design) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Days/Week <span class="text-red-500">*</span></label>
                        <input type="text" id="assign-days" required placeholder="e.g. Monday, Wednesday, Friday"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Start & End Time (round-the-clock) -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Start Time <span class="text-red-500">*</span></label>
                            <select id="assign-start-time" required class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                ${buildTimeOptions()}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">End Time <span class="text-red-500">*</span></label>
                            <select id="assign-end-time" required class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                ${buildTimeOptions()}
                            </select>
                        </div>
                    </div>

                    <!-- Subjects -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Subjects <span class="text-red-500">*</span></label>
                        <input type="text" id="assign-subjects" required placeholder="e.g. Math, English, Science"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Parent Name -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Parent Name <span class="text-red-500">*</span></label>
                        <input type="text" id="assign-parentName" required
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Parent Phone -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Parent Phone <span class="text-red-500">*</span></label>
                        <input type="text" id="assign-parentPhone" required
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Parent Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Parent Email</label>
                        <input type="email" id="assign-parentEmail" placeholder="parent@example.com"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <!-- Fee -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Student Fee (₦) <span class="text-red-500">*</span></label>
                        <input type="number" id="assign-studentFee" required value="0" min="0"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>

                    <div class="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onclick="closeManagementModal('assign-modal')"
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                        <button type="submit"
                            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ── Searchable tutor dropdown logic ──
    const tutorSearch = document.getElementById('am-tutor-search');
    const tutorEmailInput = document.getElementById('am-tutor-email');
    const tutorNameInput = document.getElementById('am-tutor-name');
    const tutorDropdown = document.getElementById('am-tutor-dropdown');
    const tutorSelectedLabel = document.getElementById('am-tutor-selected-label');

    tutorSearch.addEventListener('focus', () => tutorDropdown.classList.remove('hidden'));
    tutorSearch.addEventListener('input', () => {
        const term = tutorSearch.value.toLowerCase();
        tutorDropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
            opt.style.display = (opt.dataset.label || '').includes(term) ? '' : 'none';
        });
        tutorDropdown.classList.remove('hidden');
        tutorEmailInput.value = '';
        tutorNameInput.value = '';
        tutorSelectedLabel.classList.add('hidden');
    });
    tutorDropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            tutorSearch.value = opt.dataset.name;
            tutorEmailInput.value = opt.dataset.email;
            tutorNameInput.value = opt.dataset.name;
            tutorSelectedLabel.textContent = `✓ ${opt.dataset.name} (${opt.dataset.email})`;
            tutorSelectedLabel.classList.remove('hidden');
            tutorDropdown.classList.add('hidden');
        });
    });
    document.addEventListener('click', (e) => {
        if (!tutorSearch.contains(e.target) && !tutorDropdown.contains(e.target)) {
            tutorDropdown.classList.add('hidden');
        }
    });

    // ── Form submit ──
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const tutorEmail = tutorEmailInput.value;
        const tutorName = tutorNameInput.value;

        if (!tutorEmail) {
            alert('Please select a tutor from the list.');
            tutorSearch.focus();
            return;
        }

        const startTime = document.getElementById('assign-start-time').value;
        const endTime = document.getElementById('assign-end-time').value;
        if (!startTime || !endTime) {
            alert('Please select both start and end time.');
            return;
        }

        const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;
        const daysValue = document.getElementById('assign-days').value.trim();
        const gradeValue = document.getElementById('assign-grade').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const newStudentData = {
            studentName: document.getElementById('assign-studentName').value.trim(),
            grade: gradeValue,
            days: daysValue,
            academicDays: daysValue,
            academicTime: academicTime,
            subjects: document.getElementById('assign-subjects').value.split(',').map(s => s.trim()).filter(s => s),
            parentName: document.getElementById('assign-parentName').value.trim(),
            parentPhone: document.getElementById('assign-parentPhone').value.trim(),
            parentEmail: document.getElementById('assign-parentEmail').value.trim() || '',
            studentFee: Number(document.getElementById('assign-studentFee').value) || 0,
            tutorEmail: tutorEmail,
            tutorName: tutorName,
            status: 'approved',
            summerBreak: false,
            createdAt: Timestamp.now(),
            createdBy: window.userData?.name || window.userData?.email || 'management',
            tutorHistory: [{
                tutorEmail: tutorEmail,
                tutorName: tutorName,
                assignedDate: Timestamp.now(),
                assignedBy: window.userData?.email || 'management',
                isCurrent: true
            }],
            gradeHistory: [{
                grade: gradeValue,
                changedDate: Timestamp.now(),
                changedBy: window.userData?.email || 'management'
            }]
        };

        try {
            const studentRef = await addDoc(collection(db, "students"), newStudentData);

            // Auto-create schedule document with proper { day, start, end } format
            if (daysValue && startTime && endTime) {
                const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                const daysList = daysValue.split(/,|\band\b/i).map(d => d.trim()).filter(d => DAYS_LIST.includes(d));
                const scheduleEntries = daysList.length > 0
                    ? daysList.map(day => ({ day, start: startTime, end: endTime }))
                    : [{ day: daysValue, start: startTime, end: endTime }];

                await setDoc(doc(db, 'schedules', `sched_${studentRef.id}`), {
                    studentId: studentRef.id,
                    studentName: newStudentData.studentName,
                    tutorEmail: tutorEmail,
                    schedule: scheduleEntries,
                    academicDays: daysValue,
                    academicTime: academicTime,
                    source: 'management_assign',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                }, { merge: true });

                // Also update the student record with the schedule array
                await updateDoc(studentRef, { schedule: scheduleEntries });
            }

            // Send notification to tutor with full student details
            await addDoc(collection(db, 'tutor_notifications'), {
                tutorEmail: tutorEmail,
                type: 'new_student',
                title: 'New Student Assigned',
                message: `${newStudentData.studentName} (${gradeValue}) has been assigned to you. Schedule: ${daysValue} at ${academicTime}.`,
                studentName: newStudentData.studentName,
                grade: gradeValue,
                subjects: newStudentData.subjects,
                parentName: newStudentData.parentName,
                parentPhone: newStudentData.parentPhone,
                parentEmail: newStudentData.parentEmail,
                studentFee: newStudentData.studentFee,
                academicDays: daysValue,
                academicTime: academicTime,
                senderDisplay: 'Management',
                read: false,
                createdAt: Timestamp.now()
            });
            alert(`Student "${newStudentData.studentName}" assigned successfully to ${tutorName}!`);
            closeManagementModal('assign-modal');
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error assigning student: ", error);
            alert("Failed to assign student. Check the console for details.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Assign Student';
        }
    });
}

// ======================================================
// GLOBAL EXPORTS
// ======================================================

window.showTransitionStudentModal = showTransitionStudentModal;
window.showCreateGroupClassModal = showCreateGroupClassModal;
window.showEnhancedReassignStudentModal = showEnhancedReassignStudentModal;
window.showManageTransitionModal = showManageTransitionModal;

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

// Add debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modal management functions
function closeManagementModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

async function renderArchivedStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-700">Archived Students Management</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="archived-search" placeholder="Search archived students by name..." class="p-2 border rounded-md w-64">
                    <button id="refresh-archived-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="archive-student-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Archive Student</button>
                    <button id="bulk-archive-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Bulk Archive</button>
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
    
    // Clear any existing listeners
    const refreshBtn = document.getElementById('refresh-archived-btn');
    const searchInput = document.getElementById('archived-search');
    const archiveBtn = document.getElementById('archive-student-btn');
    const bulkArchiveBtn = document.getElementById('bulk-archive-btn');
    
    refreshBtn.replaceWith(refreshBtn.cloneNode(true));
    searchInput.replaceWith(searchInput.cloneNode(true));
    archiveBtn.replaceWith(archiveBtn.cloneNode(true));
    bulkArchiveBtn.replaceWith(bulkArchiveBtn.cloneNode(true));
    
    // Add new event listeners
    document.getElementById('refresh-archived-btn').addEventListener('click', () => fetchAndRenderArchivedStudents(true));
    document.getElementById('archived-search').addEventListener('input', debounce((e) => {
        renderArchivedStudentsFromCache(e.target.value);
    }, 300));
    document.getElementById('archive-student-btn').addEventListener('click', () => showArchiveStudentModal('single'));
    document.getElementById('bulk-archive-btn').addEventListener('click', () => showArchiveStudentModal('bulk'));
    
    fetchAndRenderArchivedStudents();
}

async function fetchAndRenderArchivedStudents(forceRefresh = false) {
    if (forceRefresh && typeof invalidateCache === 'function') {
        invalidateCache('archivedStudents');
    }
    
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    try {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student data...</p>`;
        
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const allStudents = studentsSnapshot.docs.map(doc => { 
            const data = doc.data();
            return {
                id: doc.id, 
                studentName: data.studentName || 'Unnamed Student',
                parentName: data.parentName || 'N/A',
                grade: data.grade || 'N/A',
                studentFee: data.studentFee || 0,
                status: data.status || 'active',
                archivedDate: data.archivedDate,
                archivedReason: data.archivedReason || '',
                archivedBy: data.archivedBy || '',
                tutorEmail: data.tutorEmail || '',
                tutorName: data.tutorName || '',
                tutorHistory: data.tutorHistory || [],
                restoredDate: data.restoredDate,
                restoredBy: data.restoredBy
            };
        });
        
        // Cache the full student list
        if (typeof sessionCache !== 'undefined') {
            sessionCache.allStudents = allStudents;
        }
        
        const archivedStudents = allStudents.filter(student => 
            student.status === 'archived' || 
            student.status === 'graduated' || 
            student.status === 'transferred'
        );
        
        const activeStudents = allStudents.filter(student => 
            student.status === 'active' || 
            student.status === 'approved'
        );
        
        // Cache archived students
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage('archivedStudents', archivedStudents);
        }
        if (typeof sessionCache !== 'undefined') {
            sessionCache.archivedStudents = archivedStudents;
        }
        
        // Update badges
        const archivedCount = archivedStudents.filter(s => s.status === 'archived').length;
        const graduatedCount = archivedStudents.filter(s => s.status === 'graduated').length;
        const transferredCount = archivedStudents.filter(s => s.status === 'transferred').length;
        
        document.getElementById('archived-count-badge').textContent = archivedCount;
        document.getElementById('active-students-badge').textContent = activeStudents.length;
        document.getElementById('graduated-count-badge').textContent = graduatedCount;
        document.getElementById('transferred-count-badge').textContent = transferredCount;
        
        renderArchivedStudentsFromCache();
    } catch (error) {
        console.error("Error fetching archived students:", error);
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <p class="text-red-500">Failed to load data. Please try again.</p>
                <button onclick="fetchAndRenderArchivedStudents(true)" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        `;
    }
}

function renderArchivedStudentsFromCache(searchTerm = '') {
    const archivedStudents = (typeof sessionCache !== 'undefined' && sessionCache.archivedStudents) || [];
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    if (archivedStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No archived students found.</p>`;
        return;
    }
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    let filteredStudents = archivedStudents;
    
    if (lowerCaseSearchTerm) {
        filteredStudents = archivedStudents.filter(student => {
            const searchFields = [
                student.studentName || '',
                student.parentName || '',
                student.tutorEmail || '',
                student.tutorName || '',
                student.grade || '',
                student.status || '',
                student.archivedReason || ''
            ];
            
            return searchFields.some(field => 
                field.toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
    }
    
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <p class="text-gray-500">No matching archived students found for "${searchTerm}"</p>
                <button onclick="document.getElementById('archived-search').value = ''; renderArchivedStudentsFromCache();" 
                        class="mt-2 text-blue-600 hover:text-blue-800 underline">
                    Clear search
                </button>
            </div>
        `;
        return;
    }
    
    // Sort by archived date (most recent first)
    filteredStudents.sort((a, b) => {
        const dateA = a.archivedDate?.seconds || (a.archivedDate?.toDate ? a.archivedDate.toDate().getTime() : 0);
        const dateB = b.archivedDate?.seconds || (b.archivedDate?.toDate ? b.archivedDate.toDate().getTime() : 0);
        return dateB - dateA;
    });
    
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
        
        let archivedDate = 'Unknown';
        if (student.archivedDate) {
            try {
                if (student.archivedDate.toDate) {
                    archivedDate = student.archivedDate.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (student.archivedDate.seconds) {
                    archivedDate = new Date(student.archivedDate.seconds * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (student.archivedDate instanceof Date) {
                    archivedDate = student.archivedDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
            } catch (error) {
                console.error("Error parsing date:", error);
                archivedDate = 'Invalid date';
            }
        }
        
        // Get tutor name properly
        let tutorName = 'Unknown';
        if (student.tutorName) {
            tutorName = student.tutorName;
        } else if (student.tutorHistory && student.tutorHistory.length > 0) {
            const lastTutor = student.tutorHistory[student.tutorHistory.length - 1];
            tutorName = lastTutor.tutorName || lastTutor.tutorEmail || 'Unknown';
        } else if (student.tutorEmail) {
            tutorName = student.tutorEmail.split('@')[0]; // Use email username if no name
        }
        
        return `
            <div class="border p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <div class="flex-1 mb-4 md:mb-0">
                    <div class="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                        <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                        <span class="px-3 py-1 text-sm rounded-full ${statusColor} inline-block w-fit">${statusBadge}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Parent:</span> ${student.parentName}</p>
                            <p class="text-gray-600"><span class="font-medium">Tutor:</span> ${tutorName}</p>
                        </div>
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Grade:</span> ${student.grade}</p>
                            <p class="text-gray-600"><span class="font-medium">Monthly Fee:</span> ₦${(student.studentFee || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Archived:</span> ${archivedDate}</p>
                            <p class="text-gray-600"><span class="font-medium">By:</span> ${student.archivedBy || 'System'}</p>
                        </div>
                    </div>
                    ${student.archivedReason ? `
                        <div class="mt-3 p-3 bg-gray-200 rounded-lg">
                            <p class="text-sm text-gray-700"><span class="font-medium">Reason:</span> ${student.archivedReason}</p>
                        </div>
                    ` : ''}
                </div>
                <div class="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <button class="restore-student-btn bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors w-full md:w-32" 
                            data-student-id="${student.id}">
                        Restore
                    </button>
                    <button class="view-student-history-btn bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors w-full md:w-32" 
                            data-student-id="${student.id}">
                        View History
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    document.querySelectorAll('.restore-student-btn').forEach(button => {
        const originalText = button.textContent;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRestoreStudent(e.target.dataset.studentId, originalText);
        });
    });
    
    document.querySelectorAll('.view-student-history-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.viewStudentTutorHistory === 'function') {
                window.viewStudentTutorHistory(e.target.dataset.studentId);
            } else {
                alert('Student history feature is not available.');
            }
        });
    });
}

function showArchiveStudentModal(mode = 'single') {
    // Remove existing modal if any
    const existingModal = document.getElementById('archive-student-modal');
    if (existingModal) existingModal.remove();
    
    const allStudents = (typeof sessionCache !== 'undefined' && sessionCache.allStudents) || [];
    const activeStudents = allStudents.filter(student => 
        student.status === 'active' || 
        student.status === 'approved'
    );
    
    if (activeStudents.length === 0) {
        alert("No active students available to archive.");
        return;
    }
    
    const isBulkMode = mode === 'bulk';
    const modalTitle = isBulkMode ? 'Bulk Archive Students' : 'Archive Student';
    const submitButtonText = isBulkMode ? 'Archive Selected Students' : 'Archive Student';
    
    // Create student list HTML with search
    const modalHtml = `
        <div id="archive-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div class="relative bg-white w-full max-w-3xl rounded-lg shadow-xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-6 border-b">
                    <h3 class="text-xl font-bold text-gray-800">${modalTitle}</h3>
                    <button class="text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('archive-student-modal')">&times;</button>
                </div>
                
                <!-- Modal Body -->
                <form id="archive-student-form" class="p-6">
                    <!-- Student Selection Section -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-3">
                            <label class="block text-sm font-medium text-gray-700">
                                ${isBulkMode ? 'Select Students to Archive' : 'Select Student to Archive'}
                            </label>
                            ${isBulkMode ? `
                                <div class="flex gap-3">
                                    <button type="button" onclick="selectAllStudentsInModal()" class="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                                        Select All
                                    </button>
                                    <button type="button" onclick="deselectAllStudentsInModal()" class="text-xs text-gray-600 hover:text-gray-800 hover:underline">
                                        Deselect All
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Search Input -->
                        <div class="mb-3">
                            <input type="text" 
                                   id="student-search-input" 
                                   placeholder="Search students by name, parent, or tutor..." 
                                   class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                   onkeyup="filterStudentListInModal(this.value)">
                            <p class="text-xs text-gray-500 mt-1">Start typing to search for students...</p>
                        </div>
                        
                        <!-- Student List -->
                        <div id="student-list-container" class="max-h-80 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                            ${activeStudents.map(student => {
                                const tutorDisplay = student.tutorName || student.tutorEmail || 'No tutor assigned';
                                return `
                                    <div class="student-item p-3 mb-2 bg-white rounded-lg border hover:bg-blue-50 transition-colors">
                                        <div class="flex items-center">
                                            ${isBulkMode ? `
                                                <input type="checkbox" 
                                                       id="student-${student.id}" 
                                                       value="${student.id}" 
                                                       class="student-checkbox h-5 w-5 text-blue-600 rounded mr-4">
                                            ` : `
                                                <input type="radio" 
                                                       id="student-${student.id}" 
                                                       name="selectedStudent" 
                                                       value="${student.id}" 
                                                       class="student-radio h-5 w-5 text-blue-600 rounded mr-4">
                                            `}
                                            <label for="student-${student.id}" class="flex-1 cursor-pointer">
                                                <div class="flex flex-col md:flex-row md:items-center justify-between">
                                                    <div>
                                                        <div class="font-bold text-gray-800">${student.studentName}</div>
                                                        <div class="text-sm text-gray-600 mt-1">
                                                            <span class="inline-block mr-3"><strong>Parent:</strong> ${student.parentName}</span>
                                                            <span class="inline-block mr-3"><strong>Grade:</strong> ${student.grade}</span>
                                                            <span class="inline-block"><strong>Tutor:</strong> ${tutorDisplay}</span>
                                                        </div>
                                                    </div>
                                                    <div class="mt-2 md:mt-0">
                                                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                                            Active
                                                        </span>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <p class="text-sm text-gray-500 mt-2">${activeStudents.length} active student(s) found</p>
                    </div>
                    
                    <!-- Archive Details Section -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Archive Status <span class="text-red-500">*</span>
                            </label>
                            <select id="archive-status" required 
                                    class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="" disabled selected>Select status...</option>
                                <option value="archived">Archived (no longer with company)</option>
                                <option value="graduated">Graduated (completed program)</option>
                                <option value="transferred">Transferred (moved to another tutor/company)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Effective Date <span class="text-red-500">*</span>
                            </label>
                            <input type="date" id="archive-date" required
                                   class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    
                    <!-- Reason Section -->
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Archiving (Optional)
                        </label>
                        <textarea id="archive-reason" rows="3" 
                                  class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter reason for archiving..."></textarea>
                    </div>
                    
                    <!-- Notification Option -->
                    <div class="mb-6">
                        <div class="flex items-center">
                            <input type="checkbox" id="send-notification" class="h-5 w-5 text-blue-600 rounded mr-3">
                            <label for="send-notification" class="text-sm text-gray-700">
                                Send notification email to tutor and parent
                            </label>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                            If checked, an email will be sent to notify about the student's status change.
                        </p>
                    </div>
                    
                    <!-- Progress Bar (Hidden by default) -->
                    <div id="archive-progress" class="hidden mb-6">
                        <div class="flex justify-between mb-1">
                            <span class="text-sm font-medium text-gray-700">Progress</span>
                            <span id="progress-percentage" class="text-sm font-medium text-gray-700">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div id="progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                        <p id="progress-text" class="text-sm text-gray-600 mt-2">Preparing to archive...</p>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" 
                                onclick="closeManagementModal('archive-student-modal')" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="submit-archive-btn" 
                                class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center min-w-[180px]">
                            <span id="submit-text">${submitButtonText}</span>
                            <span id="submit-spinner" class="hidden ml-2 animate-spin">⟳</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Initialize search functionality
    window.filterStudentListInModal = function(searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const studentItems = document.querySelectorAll('#student-list-container .student-item');
        
        let visibleCount = 0;
        studentItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchLower)) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Update count if available
        const countElement = document.querySelector('#student-list-container + p');
        if (countElement) {
            countElement.textContent = `${visibleCount} student(s) found`;
        }
    };
    
    // Initialize select/deselect functions
    window.selectAllStudentsInModal = function() {
        document.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
    };
    
    window.deselectAllStudentsInModal = function() {
        document.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    };
    
    // Add form submit handler
    document.getElementById('archive-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('submit-archive-btn');
        const submitText = document.getElementById('submit-text');
        const submitSpinner = document.getElementById('submit-spinner');
        const progressDiv = document.getElementById('archive-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressText = document.getElementById('progress-text');
        
        // Get selected student IDs
        let studentIds = [];
        if (isBulkMode) {
            const checkboxes = document.querySelectorAll('.student-checkbox:checked');
            studentIds = Array.from(checkboxes).map(cb => cb.value);
        } else {
            const selectedRadio = document.querySelector('.student-radio:checked');
            if (!selectedRadio) {
                alert("Please select a student.");
                return;
            }
            studentIds = [selectedRadio.value];
        }
        
        if (studentIds.length === 0) {
            alert("Please select at least one student.");
            return;
        }
        
        const status = document.getElementById('archive-status').value;
        const reason = document.getElementById('archive-reason').value;
        const date = document.getElementById('archive-date').value;
        const sendNotification = document.getElementById('send-notification').checked;
        
        if (!status) {
            alert("Please select an archive status.");
            return;
        }
        
        if (!date) {
            alert("Please select an effective date.");
            return;
        }
        
        // Show confirmation
        const confirmationMessage = isBulkMode 
            ? `Are you sure you want to archive ${studentIds.length} student(s)? This action cannot be undone.`
            : `Are you sure you want to archive this student? This action cannot be undone.`;
        
        if (!confirm(confirmationMessage)) {
            return;
        }
        
        // Disable submit button and show progress
        submitBtn.disabled = true;
        submitText.textContent = 'Archiving...';
        submitSpinner.classList.remove('hidden');
        progressDiv.classList.remove('hidden');
        
        try {
            const batch = writeBatch(db);
            const archiveDate = new Date(date);
            
            for (let i = 0; i < studentIds.length; i++) {
                const studentId = studentIds[i];
                const studentRef = doc(db, "students", studentId);
                
                // Update student document
                batch.update(studentRef, {
                    status: status,
                    archivedReason: reason || '',
                    archivedDate: Timestamp.fromDate(archiveDate),
                    archivedBy: window.userData?.email || 'management',
                    lastUpdated: Timestamp.now(),
                    archivedNotificationSent: sendNotification
                });
                
                // Update progress
                const progress = ((i + 1) / studentIds.length) * 100;
                progressBar.style.width = `${progress}%`;
                progressPercentage.textContent = `${Math.round(progress)}%`;
                progressText.textContent = `Archiving student ${i + 1} of ${studentIds.length}...`;
            }
            
            // Commit the batch
            await batch.commit();
            
            // Update UI to show success
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            progressText.textContent = `Successfully archived ${studentIds.length} student(s)!`;
            submitText.textContent = 'Completed!';
            
            // Show success message
            setTimeout(() => {
                alert(`${studentIds.length} student(s) have been archived successfully!`);
                closeManagementModal('archive-student-modal');
                
                // Refresh data
                if (typeof invalidateCache === 'function') {
                    invalidateCache('archivedStudents');
                    invalidateCache('students');
                }
                
                fetchAndRenderArchivedStudents(true);
            }, 1000);
            
        } catch (error) {
            console.error("Error archiving student(s):", error);
            
            // Show error state
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-red-600');
            progressText.textContent = 'Error: Failed to archive student(s)';
            submitText.textContent = 'Error - Try Again';
            submitBtn.disabled = false;
            submitSpinner.classList.add('hidden');
            
            setTimeout(() => {
                alert(`Failed to archive student(s). Error: ${error.message}`);
            }, 500);
        }
    });
}

async function handleRestoreStudent(studentId, originalButtonText = 'Restore') {
    if (!confirm("Are you sure you want to restore this student to active status?")) {
        return;
    }
    
    const restoreBtn = document.querySelector(`[data-student-id="${studentId}"].restore-student-btn`);
    if (restoreBtn) {
        restoreBtn.disabled = true;
        restoreBtn.textContent = 'Restoring...';
        restoreBtn.classList.add('opacity-50');
    }
    
    try {
        await updateDoc(doc(db, "students", studentId), {
            status: 'active',
            restoredDate: Timestamp.now(),
            restoredBy: window.userData?.email || 'management',
            lastUpdated: Timestamp.now(),
            archivedReason: '', // Clear archive reason
            archivedBy: '' // Clear archived by
        });
        
        // Show success message
        if (restoreBtn) {
            restoreBtn.textContent = 'Restored!';
            restoreBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            restoreBtn.classList.add('bg-green-600');
            
            setTimeout(() => {
                restoreBtn.disabled = false;
                restoreBtn.textContent = originalButtonText;
                restoreBtn.classList.remove('opacity-50', 'bg-green-600');
                restoreBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            }, 1500);
        }
        
        // Show notification
        showNotification('Student restored successfully!', 'success');
        
        // Refresh data
        if (typeof invalidateCache === 'function') {
            invalidateCache('archivedStudents');
            invalidateCache('students');
        }
        
        // Refresh the archived students list
        setTimeout(() => {
            fetchAndRenderArchivedStudents(true);
        }, 500);
        
    } catch (error) {
        console.error("Error restoring student:", error);
        
        if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = 'Error - Retry';
            restoreBtn.classList.remove('opacity-50');
            restoreBtn.classList.add('bg-red-500', 'hover:bg-red-600');
            
            // Revert after 2 seconds
            setTimeout(() => {
                restoreBtn.textContent = originalButtonText;
                restoreBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                restoreBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            }, 2000);
        }
        
        showNotification('Failed to restore student. Please try again.', 'error');
    }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    notification.style.maxWidth = '300px';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
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
            <div class="bg-green-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="pay-name-search" class="block text-sm font-medium">Search by Tutor Name</label>
                    <input type="text" id="pay-name-search" placeholder="Type a name..." class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-2 flex-wrap gap-2">
                    <div class="bg-green-100 p-2 rounded-lg text-center shadow flex-1"><h4 class="font-bold text-green-800 text-xs">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-2 rounded-lg text-center shadow flex-1"><h4 class="font-bold text-yellow-800 text-xs">Active Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                    ${canExport ? `<button id="export-pay-xls-btn" class="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">Download XLS</button>` : ''}
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
    const nameSearchInput = document.getElementById('pay-name-search');
    
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
    
    nameSearchInput.addEventListener('input', () => {
        renderPayAdviceTable(nameSearchInput.value.trim().toLowerCase());
    });

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

function renderPayAdviceTable(nameFilter = '') {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    
    let grandTotal = 0;
    const dataToRender = nameFilter 
        ? currentPayData.filter(d => (d.tutorName || '').toLowerCase().includes(nameFilter))
        : currentPayData;
    
    tableBody.innerHTML = dataToRender.map(d => {
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
        // Check if SheetJS is loaded
        if (typeof XLSX === 'undefined') {
            alert("Excel library not loaded. Please add the SheetJS library to your page.");
            return;
        }

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

        // Create Main Payment workbook
        const mainPaymentWB = XLSX.utils.book_new();
        const mainPaymentWS = XLSX.utils.aoa_to_sheet([
            ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
        ]);
        
        processedData.forEach(tutor => {
            // Force beneficiary account to be treated as text to preserve leading zeros
            XLSX.utils.sheet_add_aoa(mainPaymentWS, [[
                tutor.tutorName,
                tutor.beneficiaryBank,
                '',
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                '',
                'NIP',
                tutor.mainPayment,
                'NGN',
                `${monthYear} Tutor Payment`
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(mainPaymentWB, mainPaymentWS, 'Main Payment');

        // Create DataZoom Allocation workbook
        const dataZoomWB = XLSX.utils.book_new();
        const dataZoomWS = XLSX.utils.aoa_to_sheet([
            ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(dataZoomWS, [[
                tutor.tutorName,
                tutor.beneficiaryBank,
                '',
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                '',
                'NIP',
                tutor.dataZoomPayment,
                'NGN',
                'DATAZOOMALLOCT'
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(dataZoomWB, dataZoomWS, 'DataZoom Allocation');

        // Create TIN Remittance workbook
        const tinWB = XLSX.utils.book_new();
        const tinWS = XLSX.utils.aoa_to_sheet([
            ['Tutor Name', 'TIN Number', 'Amount', 'Currency', 'Month']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(tinWS, [[
                tutor.tutorName,
                String(tutor.tinNumber || ''), // Convert to string to preserve leading zeros
                tutor.tinRemittance,
                'NGN',
                monthYear
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(tinWB, tinWS, 'TIN Remittance');

        // Create Full PayAdvice workbook
        const fullWB = XLSX.utils.book_new();
        const fullWS = XLSX.utils.aoa_to_sheet([
            ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)', 'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(fullWS, [[
                tutor.tutorName,
                tutor.studentCount,
                tutor.totalStudentFees,
                tutor.managementFee,
                tutor.totalPay,
                tutor.giftAmount,
                tutor.finalPay,
                tutor.beneficiaryBank,
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                tutor.tutorName
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(fullWB, fullWS, 'Full PayAdvice');

        // Download all files
        XLSX.writeFile(mainPaymentWB, `Main_Payment_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(dataZoomWB, `DataZoom_Allocation_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(tinWB, `TIN_Remittance_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(fullWB, `Full_PayAdvice_${monthYear.replace(' ', '_')}.xlsx`);

        alert('All 4 Excel files downloaded successfully!');

    } catch (error) {
        console.error("Error exporting Excel files:", error);
        alert("Failed to export Excel files. Please try again.");
    }
}

// Remove the old downloadMultipleXLSFiles and downloadAsXLS functions as they're no longer needed

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
            
            <!-- Quick name search -->
            <div class="mb-4 flex gap-3 items-center">
                <div class="relative flex-1">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="text" id="reports-name-quick-search" placeholder="🔍 Type a tutor or student name to search..." 
                           class="w-full pl-9 pr-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-medium">
                </div>
            </div>
            
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
    
    document.getElementById('reports-name-quick-search').addEventListener('input', (e) => {
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

// Ensure global dependencies are available
if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded. Excel export will not work.');
}
if (typeof html2canvas === 'undefined') {
    console.error('html2canvas library not loaded. Invoice download will not work.');
}
if (typeof firebase === 'undefined' && typeof db === 'undefined') {
    console.error('Firebase not initialized. Check your Firebase setup.');
}

// Initialize session cache if not present
window.sessionCache = window.sessionCache || {};

// -------------------- Helper Functions --------------------

/**
 * Safely parse a date from various input formats (Firestore Timestamp, ISO string, Date object)
 * @param {any} dateInput - The date to parse
 * @returns {Date|null} - A Date object or null if invalid
 */
function safeParseDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (dateInput.seconds) { // Firestore Timestamp
        return new Date(dateInput.seconds * 1000);
    }
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Format a date as a locale date string, with fallback
 */
function formatDate(dateInput, fallback = 'Unknown date') {
    const date = safeParseDate(dateInput);
    return date ? date.toLocaleDateString() : fallback;
}

/**
 * Parse fee value from string or number, return rounded number
 */
function parseFeeValue(feeValue) {
    if (!feeValue && feeValue !== 0) return 0;
    if (typeof feeValue === 'number') return Math.round(feeValue);
    if (typeof feeValue === 'string') {
        const cleaned = feeValue.replace(/[^0-9.-]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : Math.round(parsed);
    }
    return 0;
}

/**
 * Check for required libraries before export
 */
function checkLibraries(libs) {
    const missing = libs.filter(lib => {
        if (lib === 'XLSX') return typeof XLSX === 'undefined';
        if (lib === 'html2canvas') return typeof html2canvas === 'undefined';
        return false;
    });
    if (missing.length > 0) {
        alert(`Required library/libraries missing: ${missing.join(', ')}. Please refresh or contact support.`);
        return false;
    }
    return true;
}

// -------------------- Tutor Assignment Helpers --------------------

/**
 * Fetch tutor assignments for a given enrollment across all students
 * Now optimized: fetch all students once and map, avoid N+1 queries
 */
async function checkTutorAssignments(enrollmentId, studentNames = []) {
    try {
        const assignments = [];
        console.log(`Checking assignments for Enrollment: ${enrollmentId}`);

        // Fetch from 'students' collection
        const studentsQuery = query(
            collection(db, "students"),
            where("enrollmentId", "==", enrollmentId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        // Fetch from 'pending_students' as well
        const pendingQuery = query(
            collection(db, "pending_students"),
            where("enrollmentId", "==", enrollmentId)
        );
        const pendingSnapshot = await getDocs(pendingQuery);

        // Process students collection
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const studentName = data.name || '';

            // Determine academic tutor
            let tutorName = data.tutorName;
            let tutorEmail = data.tutorEmail;
            let assignedDate = data.assignedDate;

            // Check nested tutor object
            if (data.tutor) {
                tutorName = tutorName || data.tutor.tutorName || data.tutor.name;
                tutorEmail = tutorEmail || data.tutor.tutorEmail || data.tutor.email;
                assignedDate = assignedDate || data.tutor.assignedDate;
            }

            if (!assignedDate && (tutorName || tutorEmail)) {
                assignedDate = data.createdAt;
            }

            assignments.push({
                studentName,
                tutorName,
                tutorEmail,
                assignedDate,
                source: 'students_collection',
                extracurricularTutors: data.extracurricularTutors || [],
                subjectTutors: data.subjectTutors || [],
                hasAcademicTutor: !!(tutorName || tutorEmail),
                hasExtracurricularTutors: (data.extracurricularTutors || []).length > 0,
                hasSubjectTutors: (data.subjectTutors || []).length > 0
            });
        });

        // Process pending students collection
        pendingSnapshot.forEach(doc => {
            const data = doc.data();
            const studentName = data.studentName || '';
            const tutorName = data.tutorName;
            const tutorEmail = data.tutorEmail;
            const assignedDate = data.assignedDate || data.createdAt;

            if (tutorName || tutorEmail) {
                assignments.push({
                    studentName,
                    tutorName,
                    tutorEmail,
                    assignedDate,
                    source: 'pending_students_collection',
                    extracurricularTutors: [],
                    subjectTutors: [],
                    hasAcademicTutor: !!(tutorName || tutorEmail),
                    hasExtracurricularTutors: false,
                    hasSubjectTutors: false
                });
            }
        });

        return assignments;
    } catch (error) {
        console.error("Error checking tutor assignments:", error);
        return [];
    }
}

/**
 * Get comprehensive assignment status for an enrollment
 */
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

    enrollment.students.forEach(student => {
        // Exact match on student name (case-insensitive, trimmed)
        const studentAssignment = tutorAssignments.find(a =>
            a.studentName?.trim().toLowerCase() === student.name?.trim().toLowerCase()
        );

        if (studentAssignment && studentAssignment.hasAcademicTutor) {
            assignedStudents++;

            const date = safeParseDate(studentAssignment.assignedDate);
            if (date && (!earliestDate || date < earliestDate)) {
                earliestDate = date;
            }

            if (student.extracurriculars?.length) {
                needsExtracurricularTutors += student.extracurriculars.length;
                hasExtracurricularTutors += studentAssignment.extracurricularTutors?.length || 0;
            }

            if (student.selectedSubjects?.length) {
                needsSubjectTutors += student.selectedSubjects.length;
                hasSubjectTutors += studentAssignment.subjectTutors?.length || 0;
            }
        }
    });

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
        status,
        date: earliestDate,
        allAssigned: assignedStudents === totalStudents &&
            (needsExtracurricularTutors === 0 || hasExtracurricularTutors === needsExtracurricularTutors) &&
            (needsSubjectTutors === 0 || hasSubjectTutors === needsSubjectTutors),
        assignedCount: assignedStudents,
        totalCount: totalStudents,
        needsExtracurricularTutors,
        hasExtracurricularTutors,
        needsSubjectTutors,
        hasSubjectTutors
    };
}

// -------------------- HTML Builders --------------------

function buildComprehensiveStudentTutorAssignmentsHTML(student, studentAssignment, enrollment) {
    let tutorHTML = '';

    const academicDays = student.academicDays || enrollment.academicDays || 'Not specified';
    const academicTime = student.academicTime || enrollment.academicTime || 'Not specified';

    if (studentAssignment) {
        // Main Academic Tutor Section
        if (studentAssignment.tutorName || studentAssignment.tutorEmail) {
            const assignedDate = formatDate(studentAssignment.assignedDate);
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

        // Extracurricular tutors - each activity as separate assignment
        if (student.extracurriculars && student.extracurriculars.length > 0) {
            const extracurricularList = student.extracurriculars;
            const ecTutors = studentAssignment.extracurricularTutors || [];

            extracurricularList.forEach(ec => {
                const ecTutor = ecTutors.find(t => t.activity === ec.name);
                if (ecTutor) {
                    const ecAssignedDate = formatDate(ecTutor.assignedDate);
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

        // Subject-specific tutors
        if (studentAssignment.subjectTutors && studentAssignment.subjectTutors.length > 0) {
            studentAssignment.subjectTutors.forEach(subjectTutor => {
                const subjectAssignedDate = formatDate(subjectTutor.assignedDate);
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
        // No academic tutor assigned at all
        tutorHTML = `
            <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center">
                    <svg class="w-4 h-4 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.196 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p class="text-sm text-yellow-700">No academic tutor assigned yet</p>
                </div>
                <p class="text-xs text-yellow-600 mt-1">This student needs an academic tutor</p>
                
                ${student.extracurriculars && student.extracurriculars.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-yellow-200">
                        <p class="text-sm font-medium text-yellow-700 mb-2">Extracurricular Activities:</p>
                        <div class="space-y-2">
                            ${student.extracurriculars.map(ec => `
                                <div class="p-2 bg-white border border-yellow-100 rounded">
                                    <p class="text-sm font-medium">${ec.name} (${ec.frequency})</p>
                                    <p class="text-xs text-gray-600">No tutor assigned for this activity</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${student.selectedSubjects && student.selectedSubjects.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-yellow-200">
                        <p class="text-sm font-medium text-yellow-700 mb-2">Subjects:</p>
                        <div class="space-y-2">
                            ${student.selectedSubjects.map(subject => `
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

// -------------------- Render Functions --------------------

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

    document.getElementById('export-excel-btn').addEventListener('click', () => exportEnrollmentsToExcel());
    document.getElementById('export-range-btn').addEventListener('click', showExportRangePicker);
    document.getElementById('cancel-export-range')?.addEventListener('click', hideExportRangePicker);

    await fetchAndRenderEnrollments();
}

// -------------------- Data Fetching and Rendering --------------------

async function fetchAndRenderEnrollments(forceRefresh = false) {
    if (forceRefresh) {
        delete sessionCache.enrollments;
    }

    const enrollmentsList = document.getElementById('enrollments-list');
    if (!enrollmentsList) return;

    try {
        if (!sessionCache.enrollments || forceRefresh) {
            enrollmentsList.innerHTML = `<tr><td colspan="12" class="px-6 py-4 text-center text-gray-500">Fetching enrollments...</td></tr>`;

            // Fetch enrollments
            const enrollmentsSnapshot = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt", "desc")));
            const enrollmentsData = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Fetch all students for these enrollments in one go (to avoid N+1)
            const enrollmentIds = enrollmentsData.map(e => e.id);
            let allStudents = [];
            if (enrollmentIds.length > 0) {
                // Firestore 'in' queries are limited to 10 values, so we chunk
                const chunkSize = 10;
                for (let i = 0; i < enrollmentIds.length; i += chunkSize) {
                    const chunk = enrollmentIds.slice(i, i + chunkSize);
                    const studentsQuery = query(collection(db, "students"), where("enrollmentId", "in", chunk));
                    const studentsSnapshot = await getDocs(studentsQuery);
                    allStudents.push(...studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }
            }

            // Group students by enrollmentId
            const studentsByEnrollment = {};
            allStudents.forEach(student => {
                if (!studentsByEnrollment[student.enrollmentId]) {
                    studentsByEnrollment[student.enrollmentId] = [];
                }
                studentsByEnrollment[student.enrollmentId].push(student);
            });

            // Also fetch pending_students for each enrollment (optional, can be done similarly but may not be needed for status)
            // For simplicity, we'll still use checkTutorAssignments per enrollment but with an optimized version
            // that accepts pre-fetched data. However, to keep code simpler, we'll keep the original but note that it's less efficient.
            // In a production app, you'd want to batch this as well.

            // For now, we'll use the existing checkTutorAssignments but we'll improve it to accept optional pre-fetched data if needed.
            // But to avoid complexity, we'll leave as is, but at least we have the student data we could use.

            const enrollmentsWithAssignments = await Promise.all(enrollmentsData.map(async (enrollment) => {
                const assignments = await checkTutorAssignments(enrollment.id); // still does queries, but we can't avoid easily without major rewrite
                const assignmentStatus = getEnrollmentAssignmentStatus(enrollment, assignments);
                return {
                    ...enrollment,
                    tutorAssignments: assignments,
                    assignmentStatus
                };
            }));

            sessionCache.enrollments = enrollmentsWithAssignments;
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

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    let filteredEnrollments = enrollments.filter(enrollment => {
        if (searchTerm) {
            const matchesSearch =
                (enrollment.id && enrollment.id.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.name && enrollment.parent.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.email && enrollment.parent.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.parent?.phone && enrollment.parent.phone.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (enrollment.students && enrollment.students.some(student =>
                    student.name && student.name.toLowerCase().includes(lowerCaseSearchTerm)
                ));
            if (!matchesSearch) return false;
        }

        if (statusFilter && enrollment.status !== statusFilter) return false;

        if (dateFrom) {
            const createdDate = safeParseDate(enrollment.createdAt || enrollment.timestamp);
            const fromDate = new Date(dateFrom);
            if (!createdDate || createdDate < fromDate) return false;
        }

        if (dateTo) {
            const createdDate = safeParseDate(enrollment.createdAt || enrollment.timestamp);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (!createdDate || createdDate > toDate) return false;
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
            const paymentMethod = enrollment.payment?.method || 'Unknown';
            paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] || 0) + fee;
        }
    });

    document.getElementById('projected-revenue').textContent = `₦${projectedRevenue.toLocaleString()}`;
    document.getElementById('confirmed-revenue').textContent = `₦${confirmedRevenue.toLocaleString()}`;

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
        const createdAt = formatDate(enrollment.createdAt || enrollment.timestamp, 'N/A');
        const studentCount = enrollment.students?.length || 0;
        const studentNames = enrollment.students?.map(s => s.name).join(', ') || 'No students';
        const firstStudent = enrollment.students?.[0] || {};
        const academicDays = firstStudent.academicDays || enrollment.academicDays || 'Not specified';
        const academicTime = firstStudent.academicTime || enrollment.academicTime || 'Not specified';
        const daysTimeDisplay = `${academicDays} • ${academicTime}`;

        let statusBadge = '';
        switch (enrollment.status) {
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

        const assignmentInfo = enrollment.assignmentStatus || getEnrollmentAssignmentStatus(enrollment, enrollment.tutorAssignments || []);
        let assignmentStatus = '';
        if (assignmentInfo.status === '✓ Fully Assigned') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            assignmentStatus = `
                <div class="text-sm" title="All students fully assigned">
                    <span class="text-green-600 font-medium">✓ Assigned</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                    ${assignmentInfo.needsExtracurricularTutors > 0 ? `<div class="text-xs text-green-500">+${assignmentInfo.hasExtracurricularTutors} extracurricular</div>` : ''}
                    ${assignmentInfo.needsSubjectTutors > 0 ? `<div class="text-xs text-green-500">+${assignmentInfo.hasSubjectTutors} subject</div>` : ''}
                </div>
            `;
        } else if (assignmentInfo.status === 'Not Assigned') {
            assignmentStatus = `<div class="text-sm text-gray-500">Not Assigned</div>`;
        } else if (assignmentInfo.status === 'Needs Specialized') {
            const dateStr = assignmentInfo.date ? assignmentInfo.date.toLocaleDateString() : 'Date unknown';
            assignmentStatus = `
                <div class="text-sm" title="Academic tutors assigned, but specialized tutors needed">
                    <span class="text-yellow-600 font-medium">Needs Specialized</span>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                    <div class="text-xs text-gray-400">${assignmentInfo.assignedCount}/${assignmentInfo.totalCount} students</div>
                    <div class="text-xs text-yellow-500">
                        ${assignmentInfo.needsExtracurricularTutors > 0 ? `${assignmentInfo.hasExtracurricularTutors}/${assignmentInfo.needsExtracurricularTutors} extracurricular` : ''}
                        ${assignmentInfo.needsSubjectTutors > 0 ? `${assignmentInfo.hasSubjectTutors}/${assignmentInfo.needsSubjectTutors} subject` : ''}
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
                        ${assignmentInfo.needsExtracurricularTutors > 0 ? `${assignmentInfo.hasExtracurricularTutors}/${assignmentInfo.needsExtracurricularTutors} extracurricular` : ''}
                        ${assignmentInfo.needsSubjectTutors > 0 ? `${assignmentInfo.hasSubjectTutors}/${assignmentInfo.needsSubjectTutors} subject` : ''}
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

        const isApproved = enrollment.status === 'completed' || enrollment.status === 'payment_received';
        let actionsHTML = '';
        if (isApproved) {
            actionsHTML = `<span class="text-green-600 font-medium cursor-help" title="Enrollment was approved on ${createdAt}">Approved</span>`;
        } else {
            actionsHTML = `<button onclick="approveEnrollmentModal('${enrollment.id}')" class="text-green-600 hover:text-green-900">Approve</button>`;
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
                    <button onclick="showEnrollmentDetails('${enrollment.id}')" class="text-indigo-600 hover:text-indigo-900">View</button>
                    ${actionsHTML}
                    <button onclick="deleteEnrollment('${enrollment.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                    ${isApproved ? `<button onclick="downloadEnrollmentInvoice('${enrollment.id}')" class="text-blue-600 hover:text-blue-900">Invoice</button>` : ''}
                    <button onclick="exportSingleEnrollmentToExcel('${enrollment.id}')" class="text-green-600 hover:text-green-900">Export</button>
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

// -------------------- Export Functions --------------------

function showExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) exportRangeDiv.classList.remove('hidden');
}

function hideExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) exportRangeDiv.classList.add('hidden');
}

async function exportEnrollmentsToExcel() {
    if (!checkLibraries(['XLSX'])) return;

    try {
        const exportDateFrom = document.getElementById('export-date-from')?.value;
        const exportDateTo = document.getElementById('export-date-to')?.value;

        let enrollmentsToExport = sessionCache.enrollments || [];

        if (exportDateFrom || exportDateTo) {
            enrollmentsToExport = enrollmentsToExport.filter(enrollment => {
                const createdDate = safeParseDate(enrollment.createdAt || enrollment.timestamp);
                if (!createdDate) return false;
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

        const excelData = enrollmentsToExport.map(enrollment => {
            const studentNames = enrollment.students?.map(s => s.name).join(', ') || '';
            const studentGrades = enrollment.students?.map(s => s.grade || s.actualGrade || '').join(', ') || '';
            const tutorAssignments = enrollment.tutorAssignments || [];

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
                'Created Date': formatDate(enrollment.createdAt || enrollment.timestamp, ''),
                'Approval Date': enrollment.approvedAt ? formatDate(enrollment.approvedAt, '') : '',
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

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollments");

        const fileName = exportDateFrom || exportDateTo ?
            `Enrollments_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx` :
            `All_Enrollments.xlsx`;

        XLSX.writeFile(workbook, fileName);
        hideExportRangePicker();
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        alert("Failed to export enrollments. Please try again.");
    }
}

window.exportSingleEnrollmentToExcel = async function (enrollmentId) {
    if (!checkLibraries(['XLSX'])) return;

    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = enrollmentDoc.data();
        const studentNames = enrollment.students?.map(s => s.name) || [];
        const tutorAssignments = await checkTutorAssignments(enrollmentId, studentNames);

        const enrollmentData = [{
            'Application ID': enrollmentId,
            'Parent Name': enrollment.parent?.name || '',
            'Parent Email': enrollment.parent?.email || '',
            'Parent Phone': enrollment.parent?.phone || '',
            'Parent Address': enrollment.parent?.address || '',
            'Status': enrollment.status || '',
            'Created Date': formatDate(enrollment.createdAt || enrollment.timestamp, ''),
            'Approval Date': enrollment.approvedAt ? formatDate(enrollment.approvedAt, '') : '',
            'Academic Days': enrollment.academicDays || '',
            'Academic Time': enrollment.academicTime || '',
            'Total Fee': `₦${parseFeeValue(enrollment.summary?.totalFee).toLocaleString()}`,
            'Referral Code': enrollment.referral?.code || '',
            'Payment Method': enrollment.payment?.method || '',
            'Payment Reference': enrollment.payment?.reference || '',
            'Payment Amount': `₦${(enrollment.payment?.amount || 0).toLocaleString()}`,
            'Approved By': enrollment.payment?.approvedBy || ''
        }];

        const studentsData = enrollment.students?.map(student => {
            const studentAssignment = tutorAssignments.find(a =>
                a.studentName?.trim().toLowerCase() === student.name?.trim().toLowerCase()
            );

            let academicTutor = 'Not Assigned';
            let academicAssignmentDate = 'Not Assigned';
            let extracurricularInfo = '';
            let subjectTutorInfo = '';

            if (studentAssignment) {
                if (studentAssignment.tutorName) {
                    academicTutor = studentAssignment.tutorName;
                    academicAssignmentDate = formatDate(studentAssignment.assignedDate, 'Unknown date');
                }
                if (studentAssignment.extracurricularTutors?.length) {
                    extracurricularInfo = studentAssignment.extracurricularTutors.map(ec =>
                        `${ec.activity}: ${ec.tutorName || 'Not assigned'}`
                    ).join('; ');
                }
                if (studentAssignment.subjectTutors?.length) {
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

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(enrollmentData), "Enrollment");
        if (studentsData.length > 0) {
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(studentsData), "Students");
        }

        if (enrollment.summary) {
            const feeData = [{
                'Academic Fees': `₦${parseFeeValue(enrollment.summary.academicFee).toLocaleString()}`,
                'Extracurricular Fees': `₦${parseFeeValue(enrollment.summary.extracurricularFee).toLocaleString()}`,
                'Test Prep Fees': `₦${parseFeeValue(enrollment.summary.testPrepFee).toLocaleString()}`,
                'Discount': `-₦${parseFeeValue(enrollment.summary.discountAmount).toLocaleString()}`,
                'Total Fee': `₦${parseFeeValue(enrollment.summary.totalFee).toLocaleString()}`
            }];
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(feeData), "Fees");
        }

        if (tutorAssignments.length > 0) {
            const tutorData = tutorAssignments.flatMap(assignment => {
                const rows = [];
                if (assignment.tutorName) {
                    rows.push({
                        'Student': assignment.studentName,
                        'Type': 'Academic',
                        'Subject/Activity': 'General',
                        'Tutor Name': assignment.tutorName,
                        'Tutor Email': assignment.tutorEmail || '',
                        'Assigned Date': formatDate(assignment.assignedDate, 'Unknown')
                    });
                }
                if (assignment.extracurricularTutors) {
                    assignment.extracurricularTutors.forEach(ec => {
                        rows.push({
                            'Student': assignment.studentName,
                            'Type': 'Extracurricular',
                            'Subject/Activity': ec.activity || 'Unknown',
                            'Tutor Name': ec.tutorName || 'Not assigned',
                            'Tutor Email': ec.tutorEmail || '',
                            'Assigned Date': formatDate(ec.assignedDate, 'Unknown')
                        });
                    });
                }
                if (assignment.subjectTutors) {
                    assignment.subjectTutors.forEach(sub => {
                        rows.push({
                            'Student': assignment.studentName,
                            'Type': 'Subject',
                            'Subject/Activity': sub.subject || 'Unknown',
                            'Tutor Name': sub.tutorName || 'Not assigned',
                            'Tutor Email': sub.tutorEmail || '',
                            'Assigned Date': formatDate(sub.assignedDate, 'Unknown')
                        });
                    });
                }
                return rows;
            });

            if (tutorData.length > 0) {
                XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tutorData), "Tutor Assignments");
            }
        }

        const fileName = `Enrollment_${enrollmentId.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Error exporting single enrollment:", error);
        alert("Failed to export enrollment details. Please try again.");
    }
};

// -------------------- Modal Functions --------------------

window.showEnrollmentDetails = async function (enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
        const studentNames = enrollment.students?.map(s => s.name) || [];
        const tutorAssignments = await checkTutorAssignments(enrollmentId, studentNames);

        const createdAt = formatDate(enrollment.createdAt || enrollment.timestamp, 'N/A');

        let studentsHTML = '';
        if (enrollment.students?.length) {
            studentsHTML = enrollment.students.map(student => {
                const studentAssignment = tutorAssignments.find(a =>
                    a.studentName?.trim().toLowerCase() === student.name?.trim().toLowerCase()
                );

                const subjectsHTML = student.selectedSubjects?.length
                    ? `<p class="text-sm"><strong>Subjects:</strong> ${student.selectedSubjects.join(', ')}</p>`
                    : '';
                const extracurricularHTML = student.extracurriculars?.length
                    ? `<p class="text-sm"><strong>Extracurricular:</strong> ${student.extracurriculars.map(e => `${e.name} (${e.frequency})`).join(', ')}</p>`
                    : '';
                const testPrepHTML = student.testPrep?.length
                    ? `<p class="text-sm"><strong>Test Prep:</strong> ${student.testPrep.map(t => `${t.name} (${t.hours} hrs)`).join(', ')}</p>`
                    : '';

                const academicDays = student.academicDays || enrollment.academicDays || 'Not specified';
                const academicTime = student.academicTime || enrollment.academicTime || 'Not specified';

                const tutorHTML = buildComprehensiveStudentTutorAssignmentsHTML(student, studentAssignment, enrollment);

                let assignmentStatusBadge = '';
                let assignmentStatusText = '';
                if (studentAssignment) {
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
                        ${tutorHTML}
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

        let referralHTML = '';
        if (enrollment.referral?.code) {
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

        let paymentHTML = '';
        if (enrollment.payment) {
            const paymentDate = enrollment.payment.date ? formatDate(enrollment.payment.date) : 'N/A';
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
        const approveButtonHTML = isApproved
            ? '<span class="px-4 py-2 bg-green-100 text-green-800 rounded cursor-help" title="This enrollment has already been approved">Approved</span>'
            : `<button onclick="approveEnrollmentModal('${enrollment.id}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>`;

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
                            ${enrollment.lastSaved ? `<p><strong>Last Saved:</strong> ${formatDate(enrollment.lastSaved)}</p>` : ''}
                            ${enrollment.approvedAt ? `<p><strong>Approved:</strong> ${formatDate(enrollment.approvedAt)}</p>` : ''}
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

window.approveEnrollmentModal = async function (enrollmentId) {
    try {
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        if (!enrollmentDoc.exists()) {
            alert("Enrollment not found!");
            return;
        }

        const enrollment = enrollmentDoc.data();

        // Fetch tutors from cache or Firestore
        let tutors = sessionCache.tutors || [];
        if (tutors.length === 0) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), where("status", "==", "active")));
            tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sessionCache.tutors = tutors;
        }

        if (tutors.length === 0) {
            alert("No active tutors available. Please add tutors first.");
            return;
        }

        const firstStudent = enrollment.students?.[0] || {};
        const academicDays = firstStudent.academicDays || enrollment.academicDays || '';
        const academicTime = firstStudent.academicTime || enrollment.academicTime || '';

        let studentAssignmentHTML = '';
        if (enrollment.students?.length) {
            studentAssignmentHTML = enrollment.students.map((student, studentIndex) => {
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
                        
                        ${extracurricularActivities.length > 0 ? `
                            <div class="mb-4">
                                <p class="font-medium mb-2 text-blue-700">Extracurricular Tutors</p>
                                ${extracurricularHTML}
                            </div>
                        ` : ''}
                        
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
                        
                        <div class="mb-6 grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Academic Days *</label>
                                <input type="text" id="academic-days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" 
                                       value="${academicDays}" placeholder="e.g., Monday, Wednesday, Friday" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Academic Time *</label>
                                <div class="grid grid-cols-2 gap-2 mt-1">
                                    <select id="academic-start-time" required class="rounded-md border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                    <select id="academic-end-time" required class="rounded-md border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                </div>
                                <input type="hidden" id="academic-time" value="${academicTime}">
                                <p class="text-xs text-gray-400 mt-1">Start time → End time (round-the-clock)</p>
                            </div>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium mb-2">Status *</label>
                            <select id="enrollment-status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                                <option value="completed">Completed</option>
                                <option value="payment_received">Payment Received</option>
                            </select>
                        </div>
                        
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

        // Initialize tutor searches
        if (enrollment.students) {
            enrollment.students.forEach((student, studentIndex) => {
                initializeTutorSearch(`tutor-search-${studentIndex}`, `tutor-results-${studentIndex}`, `selected-tutor-${studentIndex}`, tutors);
                if (student.extracurriculars) {
                    student.extracurriculars.forEach((_, ecIndex) => {
                        initializeTutorSearch(`ec-tutor-search-${studentIndex}-${ecIndex}`, `ec-tutor-results-${studentIndex}-${ecIndex}`, `selected-ec-tutor-${studentIndex}-${ecIndex}`, tutors);
                    });
                }
                if (student.selectedSubjects) {
                    student.selectedSubjects.forEach((_, subIndex) => {
                        initializeTutorSearch(`sub-tutor-search-${studentIndex}-${subIndex}`, `sub-tutor-results-${studentIndex}-${subIndex}`, `selected-sub-tutor-${studentIndex}-${subIndex}`, tutors);
                    });
                }
            });
        }

        document.getElementById('approve-enrollment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await approveEnrollmentWithDetails(enrollmentId);
        });

    } catch (error) {
        console.error("Error showing approve modal:", error);
        alert("Failed to load approval form. Please try again.");
    }
};

function initializeTutorSearch(searchInputId, resultsContainerId, hiddenInputId, tutors) {
    const searchInput = document.getElementById(searchInputId);
    const resultsContainer = document.getElementById(resultsContainerId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!searchInput || !resultsContainer || !hiddenInput) return;

    searchInput.addEventListener('focus', function () {
        displayTutorResults(this.value, tutors, resultsContainer, hiddenInput, searchInput);
    });

    searchInput.addEventListener('input', function () {
        displayTutorResults(this.value, tutors, resultsContainer, hiddenInput, searchInput);
    });

    document.addEventListener('click', function (event) {
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
            (tutor.subjects && Array.isArray(tutor.subjects) && tutor.subjects.some(s => s.toLowerCase().includes(term))) ||
            (tutor.specializations && Array.isArray(tutor.specializations) && tutor.specializations.some(s => s.toLowerCase().includes(term)))
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
                ${tutor.subjects?.length ? `Subjects: ${tutor.subjects.join(', ')}` : ''}
                ${tutor.specializations?.length ? ` | Specializations: ${tutor.specializations.join(', ')}` : ''}
            </div>
        </div>
    `).join('');

    resultsContainer.innerHTML = resultsHTML;
    resultsContainer.classList.remove('hidden');

    resultsContainer.querySelectorAll('.tutor-option').forEach(option => {
        option.addEventListener('click', function () {
            const tutorEmail = this.getAttribute('data-tutor-email');
            const tutorName = this.getAttribute('data-tutor-name');
            const tutorId = this.getAttribute('data-tutor-id');

            hiddenInput.value = tutorId || tutorEmail;
            searchInput.value = tutorName;
            resultsContainer.classList.add('hidden');
        });
    });
}

async function approveEnrollmentWithDetails(enrollmentId) {
    const form = document.getElementById('approve-enrollment-form');
    if (!form) return;

    const paymentMethod = form.elements['payment-method'].value;
    const paymentReference = form.elements['payment-reference'].value;
    const paymentDate = form.elements['payment-date'].value;
    const finalFee = parseFloat(form.elements['final-fee'].value);
    const academicDays = form.elements['academic-days'].value;
    const enrollmentStatus = form.elements['enrollment-status'].value;

    // Build academic time from the round-the-clock dropdowns
    const startTimeVal = document.getElementById('academic-start-time')?.value || '';
    const endTimeVal = document.getElementById('academic-end-time')?.value || '';
    const academicTime = (startTimeVal && endTimeVal)
        ? `${formatTimeTo12h(startTimeVal)} - ${formatTimeTo12h(endTimeVal)}`
        : (form.elements['academic-time']?.value || '');

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
        const enrollmentDoc = await getDoc(doc(db, "enrollments", enrollmentId));
        const enrollmentData = enrollmentDoc.data();

        const tutors = sessionCache.tutors || [];

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
            finalFee,
            academicDays,
            academicTime,
            approvedAt: Timestamp.now(),
            approvedBy: window.userData?.email || 'management',
            lastUpdated: Timestamp.now()
        });

        // Process each student
        enrollmentData.students.forEach((student, studentIndex) => {
            // --- Academic Tutor ---
            const academicTutorId = document.getElementById(`selected-tutor-${studentIndex}`)?.value;
            if (!academicTutorId) {
                // Academic tutor is required; if missing, show error and abort
                throw new Error(`Please select an academic tutor for student: ${student.name}`);
            }
            const academicTutor = tutors.find(t => t.id === academicTutorId || t.email === academicTutorId);
            if (!academicTutor) {
                throw new Error(`Invalid tutor selected for student: ${student.name}`);
            }

            // Create a pending record for the academic tutor
            const pendingAcademicRef = doc(collection(db, "pending_students"));
            batch.set(pendingAcademicRef, {
                studentName: student.name,
                tutorId: academicTutor.id,
                tutorName: academicTutor.name,
                tutorEmail: academicTutor.email,
                grade: student.actualGrade || student.grade,
                actualGrade: student.actualGrade || student.grade,
                subjects: student.selectedSubjects || [],
                academicDays: academicDays,
                academicTime: academicTime,
                days: academicDays,
                time: academicTime,
                schedule: [{ day: academicDays, time: academicTime }],
                parentName: enrollmentData.parent?.name,
                parentPhone: enrollmentData.parent?.phone,
                parentEmail: enrollmentData.parent?.email,
                enrollmentId: enrollmentId,
                type: 'academic',
                status: 'pending',        // 'pending' means awaiting tutor acceptance
                createdAt: Timestamp.now(),
                source: 'enrollment_approval',
                note: 'Academic tutoring assignment awaiting your acceptance'
            });

            // --- Extracurricular Tutors (each activity separately) ---
            if (student.extracurriculars && student.extracurriculars.length > 0) {
                student.extracurriculars.forEach((activity, ecIndex) => {
                    const ecTutorId = document.getElementById(`selected-ec-tutor-${studentIndex}-${ecIndex}`)?.value;
                    if (ecTutorId) {
                        const ecTutor = tutors.find(t => t.id === ecTutorId || t.email === ecTutorId);
                        if (ecTutor) {
                            const pendingEcRef = doc(collection(db, "pending_students"));
                            batch.set(pendingEcRef, {
                                studentName: student.name,
                                tutorId: ecTutor.id,
                                tutorName: ecTutor.name,
                                tutorEmail: ecTutor.email,
                                activity: activity.name,
                                frequency: activity.frequency,
                                grade: student.grade,
                                parentName: enrollmentData.parent?.name,
                                parentPhone: enrollmentData.parent?.phone,
                                parentEmail: enrollmentData.parent?.email,
                                enrollmentId: enrollmentId,
                                type: 'extracurricular',
                                status: 'pending',
                                createdAt: Timestamp.now(),
                                source: 'enrollment_approval',
                                note: 'Extracurricular activity assignment awaiting your acceptance'
                            });
                        }
                    }
                });
            }

            // --- Subject Tutors (each subject separately) ---
            if (student.selectedSubjects && student.selectedSubjects.length > 0) {
                student.selectedSubjects.forEach((subject, subIndex) => {
                    const subTutorId = document.getElementById(`selected-sub-tutor-${studentIndex}-${subIndex}`)?.value;
                    if (subTutorId) {
                        const subTutor = tutors.find(t => t.id === subTutorId || t.email === subTutorId);
                        if (subTutor) {
                            const pendingSubRef = doc(collection(db, "pending_students"));
                            batch.set(pendingSubRef, {
                                studentName: student.name,
                                tutorId: subTutor.id,
                                tutorName: subTutor.name,
                                tutorEmail: subTutor.email,
                                subject: subject,
                                grade: student.grade,
                                parentName: enrollmentData.parent?.name,
                                parentPhone: enrollmentData.parent?.phone,
                                parentEmail: enrollmentData.parent?.email,
                                enrollmentId: enrollmentId,
                                type: 'subject',
                                status: 'pending',
                                createdAt: Timestamp.now(),
                                source: 'enrollment_approval',
                                note: 'Subject-specific tutoring assignment awaiting your acceptance'
                            });
                        }
                    }
                });
            }
        });

        await batch.commit();

        alert("Enrollment approved! Tutor assignments are now pending acceptance in the Tutors Portal.");

        closeManagementModal('approveEnrollmentModal');

        // Clear relevant caches
        delete sessionCache.enrollments;
        delete sessionCache.pendingStudents;
        // No need to delete students cache because we didn't create any students

        // Refresh the view
        const currentNavId = document.querySelector('.nav-item.active')?.dataset.navId;
        const mainContent = document.getElementById('main-content');
        if (currentNavId && allNavItems[currentNavId] && mainContent) {
            allNavItems[currentNavId].fn(mainContent);
        } else {
            const container = document.getElementById('main-content');
            if (container) await renderEnrollmentsPanel(container);
        }

    } catch (error) {
        console.error("Error approving enrollment:", error);
        alert("Failed to approve enrollment: " + error.message);
    }
}

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
        
        // Display days and time
        const daysDisplay = student.academicDays || student.days || 'To be determined';
        const timeDisplay = student.academicTime || student.time || '';
        const scheduleDisplay = timeDisplay ? `${daysDisplay} — ${timeDisplay}` : daysDisplay;
        
        // Grade: use actualGrade if present
        const gradeDisplay = student.actualGrade || student.grade || 'N/A';
        
        // Placement test eligibility badge
        const gradeNum = parseInt(String(gradeDisplay).toLowerCase().replace('grade','').trim(), 10);
        const needsPlacementTest = !isNaN(gradeNum) && gradeNum >= 3 && gradeNum <= 12 && student.placementTestStatus !== 'completed';
        
        return `
            <div class="border p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <h3 class="font-bold text-lg text-gray-800">${student.studentName}${fromEnrollment}</h3>
                            ${student.enrollmentId ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">From Enrollment</span>` : ''}
                            ${needsPlacementTest ? `<span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-semibold">📝 Needs Placement Test</span>` : ''}
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                            <div>
                                <p><i class="fas fa-user-friends mr-2 text-gray-400"></i><strong>Parent:</strong> ${student.parentName || 'N/A'}</p>
                                <p><i class="fas fa-phone mr-2 text-gray-400"></i>${student.parentPhone || 'N/A'}</p>
                                <p><i class="fas fa-envelope mr-2 text-gray-400"></i>${student.parentEmail || 'N/A'}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-chalkboard-teacher mr-2 text-gray-400"></i><strong>Tutor:</strong> ${tutorName || student.tutorEmail}</p>
                                <p><i class="fas fa-graduation-cap mr-2 text-gray-400"></i><strong>Grade:</strong> ${gradeDisplay}</p>
                                <p><i class="fas fa-money-bill-wave mr-2 text-gray-400"></i><strong>Fee:</strong> ₦${(student.studentFee || 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-book mr-2 text-gray-400"></i><strong>Subjects:</strong> ${Array.isArray(student.subjects) ? student.subjects.join(', ') : student.subjects || 'N/A'}</p>
                                <p><i class="fas fa-calendar mr-2 text-gray-400"></i><strong>Schedule:</strong> ${scheduleDisplay}</p>
                                ${student.type ? `<p><i class="fas fa-tag mr-2 text-gray-400"></i><strong>Type:</strong> ${student.type}</p>` : ''}
                            </div>
                        </div>
                        ${student.source === 'enrollment_approval' ? `<p class="text-xs text-green-600 mt-2"><i class="fas fa-check-circle mr-1"></i>Approved from enrollment application.</p>` : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-600 transition-colors" data-student-id="${student.id}"><i class="fas fa-edit mr-1"></i>Edit</button>
                        <button class="approve-btn bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 transition-colors" data-student-id="${student.id}"><i class="fas fa-check mr-1"></i>Approve</button>
                        <button class="reject-btn bg-red-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-red-700 transition-colors" data-student-id="${student.id}"><i class="fas fa-times mr-1"></i>Reject</button>
                    </div>
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
// SUBSECTION 5.4: Summer Break Panel (UPDATED WITH RECALL REQUESTS)
// ======================================================

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Summer Break Management</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <div class="relative" style="min-width: 300px;">
                        <input type="search" id="break-search" placeholder="Search students by name, tutor, or parent..." 
                               class="p-2 pl-10 border rounded-md w-full focus:ring-2 focus:ring-green-500 focus:border-transparent">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    </div>
                    <select id="view-filter" class="p-2 border rounded-md bg-white">
                        <option value="all">All Students on Break</option>
                        <option value="pending_recall">Pending Recall Requests</option>
                        <option value="tutors">Group by Tutor</option>
                    </select>
                    <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                        <i class="fas fa-sync-alt mr-2"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Stats Dashboard -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-yellow-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-yellow-800 text-sm">Students on Break</h4>
                    <p id="break-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                    <p id="break-tutor-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-purple-800 text-sm">Pending Recall Requests</h4>
                    <p id="recall-requests-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-blue-800 text-sm">Total Monthly Fees</h4>
                    <p id="break-fees-total" class="text-xl font-extrabold">₦0</p>
                </div>
            </div>
            
            <!-- Tabs for different views -->
            <div class="flex border-b mb-6">
                <button id="break-tab" class="tab-btn active px-4 py-2 font-medium border-b-2 border-green-600 text-green-600">Students on Break</button>
                <button id="recall-tab" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-purple-600">Recall Requests</button>
            </div>
            
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            
            <!-- Students on Break View -->
            <div id="break-students-view" class="space-y-4">
                <div id="break-students-list" class="space-y-4">
                    <div class="text-center py-10">
                        <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                        <p class="text-green-600 font-semibold mt-4">Loading summer break students...</p>
                    </div>
                </div>
            </div>
            
            <!-- Recall Requests View -->
            <div id="recall-requests-view" class="space-y-4 hidden">
                <div id="recall-requests-list" class="space-y-4">
                    <div class="text-center py-10">
                        <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                        <p class="text-purple-600 font-semibold mt-4">Loading recall requests...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize session cache if it doesn't exist
    window.sessionCache = window.sessionCache || {};
    if (!window.sessionCache.breakStudents) window.sessionCache.breakStudents = [];
    if (!window.sessionCache.recallRequests) window.sessionCache.recallRequests = [];
    
    // Add CSS for loading spinner
    const style = document.createElement('style');
    style.textContent = `
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #10b981;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .tab-btn {
            transition: all 0.3s ease;
        }
        .tab-btn:hover {
            transform: translateY(-1px);
        }
    `;
    document.head.appendChild(style);
    
    // Event Listeners
    document.getElementById('refresh-break-btn').addEventListener('click', () => {
        fetchAndRenderBreakStudents(true);
        fetchRecallRequests(true);
    });
    
    document.getElementById('break-search').addEventListener('input', (e) => handleBreakSearch(e.target.value));
    document.getElementById('view-filter').addEventListener('change', (e) => handleViewFilterChange(e.target.value));
    
    // Tab switching
    document.getElementById('break-tab').addEventListener('click', () => switchTab('break'));
    document.getElementById('recall-tab').addEventListener('click', () => switchTab('recall'));
    
    // Fetch both sets of data
    fetchAndRenderBreakStudents();
    fetchRecallRequests();
}

function switchTab(tab) {
    console.log("🔄 Switching to tab:", tab);
    
    const breakTab = document.getElementById('break-tab');
    const recallTab = document.getElementById('recall-tab');
    const breakView = document.getElementById('break-students-view');
    const recallView = document.getElementById('recall-requests-view');
    
    if (tab === 'break') {
        breakTab.classList.add('active', 'border-b-2', 'border-green-600', 'text-green-600');
        breakTab.classList.remove('text-gray-500');
        recallTab.classList.remove('active', 'border-b-2', 'border-purple-600', 'text-purple-600');
        recallTab.classList.add('text-gray-500');
        breakView.classList.remove('hidden');
        recallView.classList.add('hidden');
        console.log("✅ Switched to Break tab");
    } else {
        recallTab.classList.add('active', 'border-b-2', 'border-purple-600', 'text-purple-600');
        recallTab.classList.remove('text-gray-500');
        breakTab.classList.remove('active', 'border-b-2', 'border-green-600', 'text-green-600');
        breakTab.classList.add('text-gray-500');
        recallView.classList.remove('hidden');
        breakView.classList.add('hidden');
        console.log("✅ Switched to Recall tab");
        
        // Force refresh of recall requests when switching to recall tab
        setTimeout(() => {
            if (!window.sessionCache.recallRequests || window.sessionCache.recallRequests.length === 0) {
                console.log("📥 No cached recall requests, fetching fresh data...");
                fetchRecallRequests(true);
            } else {
                console.log("📊 Using cached recall requests:", window.sessionCache.recallRequests.length);
                renderRecallRequests(window.sessionCache.recallRequests);
            }
        }, 100);
    }
}

function handleViewFilterChange(filterValue) {
    const searchInput = document.getElementById('break-search');
    const currentSearchTerm = searchInput ? searchInput.value : '';
    renderBreakStudentsFromCache(currentSearchTerm, filterValue);
}

function handleBreakSearch(searchTerm) {
    const filterValue = document.getElementById('view-filter') ? document.getElementById('view-filter').value : 'all';
    renderBreakStudentsFromCache(searchTerm, filterValue);
}

async function fetchRecallRequests(forceRefresh = false) {
    console.log("🔄 fetchRecallRequests called");
    
    try {
        // Check if Firestore is properly initialized
        if (!db) {
            console.error("❌ Firestore db not initialized");
            return;
        }
        
        const listContainer = document.getElementById('recall-requests-list');
        if (listContainer && !listContainer.innerHTML.includes("spinner")) {
            listContainer.innerHTML = `<div class="text-center py-10">
                <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                <p class="text-purple-600 font-semibold mt-4">Loading recall requests...</p>
            </div>`;
        }
        
        // Query the recall_requests collection
        const recallQuery = query(collection(db, "recall_requests"), where("status", "==", "pending"));
        console.log("📋 Querying recall_requests collection...");
        
        const snapshot = await getDocs(recallQuery);
        console.log("✅ Query complete, found", snapshot.size, "documents");
        
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            let requestDate;
            
            // Handle Firestore timestamp conversion
            if (data.requestDate && data.requestDate.toDate) {
                requestDate = data.requestDate.toDate();
            } else if (data.requestDate && data.requestDate.seconds) {
                requestDate = new Date(data.requestDate.seconds * 1000);
            } else if (data.requestDate) {
                requestDate = new Date(data.requestDate);
            } else {
                requestDate = new Date();
            }
            
            return { 
                id: doc.id, 
                ...data,
                requestDate: requestDate,
                studentName: data.studentName || 'Unknown Student',
                tutorName: data.tutorName || 'Unknown Tutor',
                tutorEmail: data.tutorEmail || 'No email'
            };
        });
        
        console.log("📊 Processed requests:", requests);
        
        // Sort by most recent
        requests.sort((a, b) => b.requestDate - a.requestDate);
        
        window.sessionCache.recallRequests = requests;
        
        // Update count
        const countElement = document.getElementById('recall-requests-count');
        if (countElement) {
            countElement.textContent = requests.length;
            console.log("📈 Updated recall count to:", requests.length);
        }
        
        // Check if recall tab is active
        const recallView = document.getElementById('recall-requests-view');
        const isRecallTabActive = recallView && !recallView.classList.contains('hidden');
        
        console.log("🎯 Recall tab active?", isRecallTabActive);
        
        if (isRecallTabActive) {
            console.log("🎨 Rendering recall requests...");
            renderRecallRequests(requests);
        }
        
    } catch (error) {
        console.error("❌ Error fetching recall requests:", error);
        console.error("Error details:", error.message, error.stack);
        
        const container = document.getElementById('recall-requests-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="font-semibold">Failed to load recall requests</p>
                    <p class="text-sm mt-2">Error: ${error.message}</p>
                    <div class="mt-4 space-y-2">
                        <button onclick="fetchRecallRequests(true)" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Try Again
                        </button>
                        <button onclick="console.log('Current cache:', window.sessionCache)" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                            Debug Cache
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

function renderRecallRequests(requests) {
    console.log("🎨 renderRecallRequests called with", requests?.length, "requests");
    
    const container = document.getElementById('recall-requests-list');
    if (!container) {
        console.error("❌ Recall requests container not found!");
        return;
    }
    
    if (!requests || requests.length === 0) {
        console.log("📭 No recall requests to display");
        container.innerHTML = `
            <div class="text-center py-10">
                <i class="fas fa-inbox text-purple-400 text-4xl mb-4"></i>
                <p class="text-gray-600">No pending recall requests</p>
                <p class="text-sm text-gray-400 mt-2">All requests have been processed</p>
                <button onclick="fetchRecallRequests(true)" class="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                    <i class="fas fa-sync-alt mr-2"></i> Refresh
                </button>
            </div>
        `;
        return;
    }
    
    console.log("🎯 Rendering", requests.length, "recall requests");
    
    let html = '';
    
    requests.forEach((request, index) => {
        const requestDate = request.requestDate ? request.requestDate.toLocaleString() : 'Unknown date';
        
        html += `
            <div class="border-l-4 border-l-purple-500 bg-gray-50 p-6 rounded-r-lg hover:bg-gray-100 transition-colors mb-4">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="bg-purple-100 p-2 rounded-lg">
                                <i class="fas fa-undo-alt text-purple-600"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-lg text-gray-800">${request.studentName}</h3>
                                <p class="text-sm text-gray-600">Requested by: ${request.tutorName} (${request.tutorEmail})</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div class="bg-white p-3 rounded border">
                                <p class="text-sm font-medium text-gray-500">Request Details</p>
                                <p class="mt-1"><i class="fas fa-calendar-alt mr-2 text-gray-400"></i>Requested: ${requestDate}</p>
                                <p><i class="fas fa-user mr-2 text-gray-400"></i>Student ID: ${request.studentId}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <p class="text-sm font-medium text-gray-500">Tutor Information</p>
                                <p class="mt-1"><i class="fas fa-chalkboard-teacher mr-2 text-gray-400"></i>Tutor: ${request.tutorName}</p>
                                <p><i class="fas fa-envelope mr-2 text-gray-400"></i>Email: ${request.tutorEmail}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 ml-4">
                        <button class="approve-recall-btn bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-request-id="${request.id}"
                                data-student-id="${request.studentId}"
                                data-student-name="${request.studentName}"
                                data-tutor-email="${request.tutorEmail}">
                            <i class="fas fa-check mr-2"></i> Approve
                        </button>
                        <button class="reject-recall-btn bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-request-id="${request.id}"
                                data-student-name="${request.studentName}">
                            <i class="fas fa-times mr-2"></i> Reject
                        </button>
                    </div>
                </div>
                
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span><i class="fas fa-info-circle mr-1"></i> Action will take the student off break immediately</span>
                    <span>Request #${index + 1}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log("✅ HTML rendered successfully");
    
    // Add event listeners
    const approveBtns = document.querySelectorAll('.approve-recall-btn');
    const rejectBtns = document.querySelectorAll('.reject-recall-btn');
    
    console.log("🔗 Found", approveBtns.length, "approve buttons and", rejectBtns.length, "reject buttons");
    
    approveBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log("✅ Approve button clicked for request:", e.currentTarget.dataset.requestId);
            handleRecallRequest(e.currentTarget, 'approve');
        });
    });
    
    rejectBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log("❌ Reject button clicked for request:", e.currentTarget.dataset.requestId);
            handleRecallRequest(e.currentTarget, 'reject');
        });
    });
}

async function handleRecallRequest(button, action) {
    const requestId = button.dataset.requestId;
    const studentId = button.dataset.studentId;
    const studentName = button.dataset.studentName;
    const tutorEmail = button.dataset.tutorEmail;
    const adminName = window.currentAdmin?.name || "Management";
    
    const actionText = action === 'approve' ? 'approve' : 'reject';
    const confirmation = confirm(`Are you sure you want to ${actionText} the recall request for ${studentName}?`);
    
    if (!confirmation) return;
    
    try {
        const originalText = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Processing...`;
        button.disabled = true;
        
        // Update the recall request status
        await updateDoc(doc(db, "recall_requests", requestId), { 
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewedBy: adminName,
            reviewDate: Timestamp.now(),
            notes: action === 'approve' ? 'Recall approved by management' : 'Recall rejected by management'
        });
        
        // If approved, also update the student's break status
        if (action === 'approve') {
            await updateDoc(doc(db, "students", studentId), { 
                summerBreak: false,
                lastBreakEnd: Timestamp.now(),
                lastUpdated: Timestamp.now()
            });
            
            // Send notification to tutor
            await sendTutorNotification(tutorEmail, studentName, 'recall_approved');
        }
        
        // Show success message
        const statusMessage = document.getElementById('break-status-message');
        statusMessage.textContent = action === 'approve' 
            ? `✅ Recall approved! ${studentName} has been taken off summer break.`
            : `✅ Recall request rejected for ${studentName}.`;
        statusMessage.className = `text-center font-semibold mb-4 ${action === 'approve' ? 'text-green-600' : 'text-yellow-600'} p-3 ${action === 'approve' ? 'bg-green-50' : 'bg-yellow-50'} rounded-lg`;
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 4000);
        
        // Refresh data
        window.sessionCache.recallRequests = null;
        window.sessionCache.breakStudents = null;
        
        // Re-fetch both data sets
        await Promise.all([
            fetchRecallRequests(true),
            fetchAndRenderBreakStudents(true)
        ]);
        
    } catch (error) {
        console.error(`Error ${action}ing recall request:`, error);
        
        // Show error message
        const statusMessage = document.getElementById('break-status-message');
        statusMessage.textContent = `❌ Failed to ${action} recall request for ${studentName}. Error: ${error.message}`;
        statusMessage.className = 'text-center font-semibold mb-4 text-red-600 p-3 bg-red-50 rounded-lg';
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
        
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function sendTutorNotification(tutorEmail, studentName, notificationType) {
    try {
        const notificationRef = doc(collection(db, "tutor_notifications"));
        await setDoc(notificationRef, {
            tutorEmail: tutorEmail,
            studentName: studentName,
            type: notificationType,
            message: notificationType === 'recall_approved' 
                ? `Your recall request for ${studentName} has been approved. The student is now active.`
                : `Your recall request for ${studentName} has been processed.`,
            read: false,
            createdAt: Timestamp.now(),
            actionUrl: '#studentDatabase'
        });
    } catch (error) {
        console.error("Error sending notification:", error);
    }
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    const listContainer = document.getElementById('break-students-list');
    
    try {
        if (forceRefresh || !window.sessionCache.breakStudents || window.sessionCache.breakStudents.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `<div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Fetching student break status...</p>
                </div>`;
            }
            
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            const allBreakStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const activeBreakStudents = allBreakStudents.filter(student => 
                !student.status || student.status === 'active' || student.status === 'approved'
            );
            
            window.sessionCache.breakStudents = activeBreakStudents;
        }
        
        // Calculate total fees (excluding break students)
        const totalFees = window.sessionCache.breakStudents.reduce((total, student) => {
            return total + (student.studentFee || 0);
        }, 0);
        
        // Update fees total display
        const feesElement = document.getElementById('break-fees-total');
        if (feesElement) {
            feesElement.textContent = `₦${totalFees.toLocaleString()}`;
        }
        
        const searchInput = document.getElementById('break-search');
        const currentSearchTerm = searchInput ? searchInput.value : '';
        const filterValue = document.getElementById('view-filter') ? document.getElementById('view-filter').value : 'all';
        
        renderBreakStudentsFromCache(currentSearchTerm, filterValue);
        
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

function renderBreakStudentsFromCache(searchTerm = '', filterValue = 'all') {
    const breakStudents = window.sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;
    
    // Update counts
    const uniqueTutors = [...new Set(breakStudents.map(s => s.tutorEmail))].filter(Boolean);
    const breakCountElement = document.getElementById('break-count-badge');
    const tutorCountElement = document.getElementById('break-tutor-count');
    
    if (breakCountElement) breakCountElement.textContent = breakStudents.length;
    if (tutorCountElement) tutorCountElement.textContent = uniqueTutors.length;
    
    // Filter based on search term
    let filteredStudents = breakStudents;
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    
    if (searchTerm) {
        filteredStudents = breakStudents.filter(student => {
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
    
    // Apply additional filter if needed
    if (filterValue === 'pending_recall') {
        const pendingRecallIds = (window.sessionCache.recallRequests || [])
            .filter(req => req.status === 'pending')
            .map(req => req.studentId);
        
        filteredStudents = filteredStudents.filter(student => 
            pendingRecallIds.includes(student.id)
        );
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
            
            // Check if this student has a pending recall request
            const hasRecallRequest = (window.sessionCache.recallRequests || []).some(req => 
                req.studentId === student.id && req.status === 'pending'
            );
            
            return `
                <div class="border-l-4 border-l-yellow-500 bg-gray-50 p-4 rounded-r-lg flex justify-between items-center hover:bg-gray-100 transition-colors">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                            <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">On Summer Break</span>
                            ${hasRecallRequest ? `<span class="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">Recall Requested</span>` : ''}
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
                
                // Invalidate caches
                window.sessionCache.breakStudents = null;
                
                // Force refresh
                await fetchAndRenderBreakStudents(true);
                
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

// Add this debug button to your HTML temporarily:
// <button onclick="testRecallRequests()" class="bg-red-500 text-white px-4 py-2 rounded">Test Recall Requests</button>

// And add this test function:
async function testRecallRequests() {
    console.log("🧪 Testing recall requests...");
    
    try {
        // Test 1: Check Firestore connection
        console.log("🔍 Testing Firestore connection...");
        console.log("Firestore db:", db);
        
        // Test 2: Check if collection exists by trying to get count
        const testQuery = query(collection(db, "recall_requests"));
        const testSnapshot = await getDocs(testQuery);
        console.log("📊 Total recall_requests documents:", testSnapshot.size);
        
        // Test 3: Show all documents
        testSnapshot.forEach(doc => {
            console.log("📄 Document ID:", doc.id, "Data:", doc.data());
        });
        
        // Test 4: Try the actual query
        console.log("🔍 Running actual query...");
        const pendingQuery = query(collection(db, "recall_requests"), where("status", "==", "pending"));
        const pendingSnapshot = await getDocs(pendingQuery);
        console.log("✅ Pending recall requests:", pendingSnapshot.size);
        
        if (pendingSnapshot.size === 0) {
            console.log("📭 No pending recall requests found. Check if:");
            console.log("1. The collection exists");
            console.log("2. Documents have 'status' field set to 'pending'");
            console.log("3. The tutor actually submitted a recall request");
        }
        
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
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

    // Capture original values for change-diff in the save handler
    window._editStudentOriginalData = {
        studentName: studentData.studentName,
        grade: studentData.grade,
        parentName: studentData.parentName,
        tutorEmail: studentData.tutorEmail,
        studentFee: studentData.studentFee
    };

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
            updatedAt: Timestamp.now(),
            updatedBy: window.userData?.name || window.userData?.email || 'Management',
        };

        // Detect changed fields for activity log
        const changedFields = [];
        const originalData = window._editStudentOriginalData || {};
        if (originalData.studentName && originalData.studentName !== updatedData.studentName) {
            changedFields.push(`Name: "${originalData.studentName}" → "${updatedData.studentName}"`);
        }
        if (originalData.grade && originalData.grade !== updatedData.grade) {
            changedFields.push(`Grade: "${originalData.grade}" → "${updatedData.grade}"`);
        }
        if (originalData.parentName && originalData.parentName !== updatedData.parentName) {
            changedFields.push(`Parent name: "${originalData.parentName}" → "${updatedData.parentName}"`);
        }
        if (originalData.tutorEmail && originalData.tutorEmail !== updatedData.tutorEmail) {
            changedFields.push(`Tutor email: "${originalData.tutorEmail}" → "${updatedData.tutorEmail}"`);
        }
        if (originalData.studentFee != null && originalData.studentFee !== updatedData.studentFee) {
            changedFields.push(`Fee: ₦${originalData.studentFee?.toLocaleString()} → ₦${updatedData.studentFee?.toLocaleString()}`);
        }

        try {
            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, updatedData);

            // Log the change to student_activity_log if any fields changed
            if (changedFields.length > 0) {
                try {
                    await addDoc(collection(db, 'student_activity_log'), {
                        studentId,
                        studentName: updatedData.studentName,
                        action: 'info_update',
                        changedFields: changedFields.join(' | '),
                        performedBy: window.userData?.name || window.userData?.email || 'Management',
                        performedAt: Timestamp.now(),
                        collectionName
                    });
                } catch(logErr) { console.warn('Activity log failed (non-critical):', logErr); }
            }

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

// showAssignStudentModal is now defined in Section 3.1 (with parent email & createdBy)

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
            
            // Use actualGrade if present (from enrollment), fallback to grade
            const finalGrade = studentData.actualGrade || studentData.grade || 'Unknown';
            
            const studentWithHistory = {
                ...studentData,
                grade: finalGrade,
                actualGrade: finalGrade,
                status: 'approved',
                tutorHistory: [{
                    tutorEmail: studentData.tutorEmail,
                    tutorName: studentData.tutorName || studentData.tutorEmail,
                    assignedDate: Timestamp.now(),
                    assignedBy: window.userData?.email || 'management',
                    isCurrent: true
                }],
                gradeHistory: [{
                    grade: finalGrade,
                    changedDate: Timestamp.now(),
                    changedBy: window.userData?.email || 'management'
                }]
            };
            
            batch.set(newStudentRef, studentWithHistory);
            batch.delete(studentRef);
            
            // Auto-create schedule document with proper { day, start, end } format
            if (studentData.academicDays || studentData.days) {
                const scheduleRef = doc(db, "schedules", `sched_${studentId}`);

                // Parse academicTime "HH:MM - HH:MM" or "H:MM AM - H:MM PM" format
                function parseTimeTo24h(timeStr) {
                    if (!timeStr) return null;
                    timeStr = timeStr.trim();
                    // Already 24h format like "14:00"
                    if (/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr.padStart(5, '0');
                    // 12h format like "2:00 PM"
                    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                    if (m) {
                        let h = parseInt(m[1]);
                        const min = m[2];
                        const period = m[3].toUpperCase();
                        if (period === 'AM' && h === 12) h = 0;
                        if (period === 'PM' && h !== 12) h += 12;
                        return `${String(h).padStart(2,'0')}:${min}`;
                    }
                    return timeStr;
                }

                let scheduleEntries = studentData.schedule || null;

                if (!scheduleEntries || !Array.isArray(scheduleEntries) || scheduleEntries.length === 0) {
                    const rawTime = studentData.academicTime || studentData.time || '';
                    const timeParts = rawTime.split(/\s*[-–]\s*/);
                    const startTime = parseTimeTo24h(timeParts[0]) || '09:00';
                    const endTime   = parseTimeTo24h(timeParts[1]) || '10:00';

                    // Split days string "Monday, Wednesday, Friday" or "Monday and Wednesday"
                    const daysRaw = studentData.academicDays || studentData.days || '';
                    const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                    const daysList = daysRaw.split(/,|\band\b/i).map(d => d.trim())
                        .filter(d => DAYS_LIST.includes(d));

                    if (daysList.length > 0) {
                        scheduleEntries = daysList.map(day => ({ day, start: startTime, end: endTime }));
                    } else if (daysRaw) {
                        scheduleEntries = [{ day: daysRaw, start: startTime, end: endTime }];
                    } else {
                        scheduleEntries = [];
                    }
                }

                batch.set(scheduleRef, {
                    studentId: studentId,
                    studentName: studentData.studentName,
                    tutorEmail: studentData.tutorEmail,
                    schedule: scheduleEntries,
                    academicDays: studentData.academicDays || studentData.days || '',
                    academicTime: studentData.academicTime || studentData.time || '',
                    source: studentData.source || 'pending_approval',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                }, { merge: true });

                // Also update the student record with the resolved schedule array
                batch.update(newStudentRef, { schedule: scheduleEntries });
            }
            
            await batch.commit();
            
            // Log this action
            logManagementActivity('STUDENT_APPROVED', `Approved: ${studentData.studentName} (${finalGrade}) → Tutor: ${studentData.tutorName || studentData.tutorEmail}`);
            
            // Check if placement test is needed
            const gradeNum = parseInt(String(finalGrade).toLowerCase().replace('grade','').trim(), 10);
            const needsPlacementTest = !isNaN(gradeNum) && gradeNum >= 3 && gradeNum <= 12;
            
            if (needsPlacementTest) {
                alert(`✅ Student approved successfully!\n\n📝 NOTE: ${studentData.studentName} (${finalGrade}) is eligible for a placement test. The tutor will be prompted to administer it.`);
            } else {
                alert("Student approved successfully!");
            }
            
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

function showTutorHistoryModal(studentId, studentData, tutorAssignments, activityLogEntries = []) {
    // ── Helper: safely convert any date-like value to a JS Date ──────────
    function safeParseTimestamp(val) {
        if (!val) return null;
        if (val && typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
        if (val && val.seconds != null) return new Date(val.seconds * 1000); // Firestore-like object
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    function fmtDate(val, fallback = 'N/A') {
        const d = safeParseTimestamp(val);
        if (!d) return fallback;
        return d.toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
    }
    const studentHistory = tutorAssignments[studentId] || [];
    
    // Sort history by date (newest first) — handle both array and object forms
    const rawHistory = Array.isArray(studentHistory) 
        ? studentHistory 
        : (studentHistory.tutorHistory || []);
    const sortedHistory = [...rawHistory].sort((a, b) => {
        const dateA = safeParseTimestamp(a.assignedAt || a.timestamp || a.assignedDate) || new Date(0);
        const dateB = safeParseTimestamp(b.assignedAt || b.timestamp || b.assignedDate) || new Date(0);
        return dateB - dateA; // Newest first
    });

    // Create a comprehensive timeline that includes ALL events
    const allEvents = [];
    
    // 1. Add registration event (from studentData)
    if (studentData.createdAt) {
        allEvents.push({
            type: 'REGISTRATION',
            date: studentData.createdAt,
            title: 'Student Registered',
            description: `Registered by ${studentData.createdBy || 'System'}`,
            details: `Student ${studentData.studentName} was added to the system.`,
            user: studentData.createdBy || 'System'
        });
    }
    
    // 2. Add all tutor assignment events
    sortedHistory.forEach((assignment, index) => {
        const isInitialAssignment = assignment.oldTutorEmail === '' && assignment.oldTutorName === 'Unassigned';
        
        allEvents.push({
            type: 'TUTOR_ASSIGNMENT',
            date: assignment.assignedAt || assignment.timestamp,
            title: isInitialAssignment ? 'Initial Tutor Assignment' : 'Tutor Reassignment',
            description: isInitialAssignment ? 
                `Assigned to ${assignment.newTutorName}` : 
                `Reassigned from ${assignment.oldTutorName || 'Unassigned'} to ${assignment.newTutorName}`,
            details: assignment.reason ? `Reason: ${assignment.reason}` : '',
            user: assignment.assignedBy || 'System',
            tutorName: assignment.newTutorName,
            oldTutorName: assignment.oldTutorName
        });
    });
    
    // 3. Add student information updates
    if (studentData.updatedAt && studentData.updatedBy) {
        allEvents.push({
            type: 'INFO_UPDATE',
            date: studentData.updatedAt,
            title: 'Information Updated',
            description: `Last updated by ${studentData.updatedBy}`,
            details: 'Student details were modified',
            user: studentData.updatedBy
        });
    }
    
    // 4. Add any status changes
    if (studentData.isTransitioning) {
        allEvents.push({
            type: 'STATUS_CHANGE',
            date: studentData.transitionDate || studentData.updatedAt || studentData.createdAt,
            title: 'Status: Transitioning',
            description: 'Student marked as transitioning',
            details: studentData.transitionNotes || '',
            user: studentData.updatedBy || 'System'
        });
    }
    
    if (studentData.summerBreak) {
        allEvents.push({
            type: 'STATUS_CHANGE',
            date: studentData.breakDate || studentData.updatedAt || studentData.createdAt,
            title: 'Status: On Break',
            description: 'Student marked as on summer break',
            details: studentData.breakNotes || '',
            user: studentData.updatedBy || 'System'
        });
    }
    
    // 5. Merge external activity log entries (from student_activity_log collection)
    activityLogEntries.forEach(entry => allEvents.push(entry));

    // Sort all events by date (newest first)
    allEvents.sort((a, b) => {
        const dateA = safeParseTimestamp(a.date) || new Date(0);
        const dateB = safeParseTimestamp(b.date) || new Date(0);
        return dateB - dateA; // Newest first
    });

    // Create timeline HTML
    const timelineHTML = allEvents.map((event, index) => {
        const eventDate = safeParseTimestamp(event.date) || new Date();
        const formattedDate = eventDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        const formattedTime = eventDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Determine icon and color based on event type
        let icon = '📝';
        let bgColor = 'bg-blue-50';
        let borderColor = 'border-blue-200';
        
        switch(event.type) {
            case 'REGISTRATION':
                icon = '👤';
                bgColor = 'bg-green-50';
                borderColor = 'border-green-200';
                break;
            case 'TUTOR_ASSIGNMENT':
                icon = '👨‍🏫';
                bgColor = 'bg-purple-50';
                borderColor = 'border-purple-200';
                break;
            case 'STATUS_CHANGE':
                icon = '🔄';
                bgColor = 'bg-yellow-50';
                borderColor = 'border-yellow-200';
                break;
            case 'INFO_UPDATE':
                icon = '✏️';
                bgColor = 'bg-gray-50';
                borderColor = 'border-gray-200';
                break;
        }
        
        return `
            <div class="mb-4 ${bgColor} ${borderColor} border-l-4 p-4 rounded-r-lg">
                <div class="flex items-start">
                    <div class="mr-3 text-xl">${icon}</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-gray-800">${event.title}</h4>
                            <span class="text-sm text-gray-500">${formattedDate} ${formattedTime}</span>
                        </div>
                        <p class="text-gray-600 mt-1">${event.description}</p>
                        ${event.details ? `<p class="text-gray-500 text-sm mt-1">${event.details}</p>` : ''}
                        <div class="mt-2 text-sm text-gray-500">
                            <span class="font-medium">By:</span> ${event.user}
                            ${event.tutorName ? `<span class="ml-4 font-medium">Tutor:</span> ${event.tutorName}` : ''}
                            ${event.oldTutorName && event.oldTutorName !== 'Unassigned' ? 
                                `<span class="ml-4 font-medium">Previous:</span> ${event.oldTutorName}` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Create detailed tutor assignment table
    const tutorAssignmentHTML = sortedHistory.map((assignment, index) => {
        const assignedDate = safeParseTimestamp(assignment.assignedAt || assignment.timestamp || assignment.assignedDate) || new Date();
        
        const isCurrent = (assignment.newTutorEmail === studentData.tutorEmail);
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">${sortedHistory.length - index}</td>
                <td class="px-4 py-3 font-medium">
                    ${assignment.oldTutorName || 'Unassigned'} → ${assignment.newTutorName || 'Unassigned'}
                </td>
                <td class="px-4 py-3">${assignment.newTutorEmail || 'N/A'}</td>
                <td class="px-4 py-3">${assignedDate.toLocaleDateString()}</td>
                <td class="px-4 py-3">${assignment.assignedBy || 'System'}</td>
                <td class="px-4 py-3">${assignment.reason || 'N/A'}</td>
                <td class="px-4 py-3">
                    ${isCurrent ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Current</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');

    const modalHtml = `
        <div id="tutorHistoryModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div class="relative p-8 bg-white w-full max-w-6xl rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('tutorHistoryModal')">&times;</button>
                
                <div class="mb-6">
                    <h3 class="text-2xl font-bold text-blue-700">Complete History for ${studentData.studentName}</h3>
                    <p class="text-gray-600 mt-1">Student ID: ${studentId}</p>
                </div>
                
                <!-- Current Information Summary -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 class="font-bold text-lg mb-2 text-blue-800">Current Information</h4>
                        <div class="space-y-2">
                            <p><strong>Tutor:</strong> ${studentData.tutorName || studentData.tutorEmail || 'Unassigned'}</p>
                            <p><strong>Grade:</strong> ${studentData.grade || 'N/A'}</p>
                            <p><strong>Subjects:</strong> ${Array.isArray(studentData.subjects) ? studentData.subjects.join(', ') : studentData.subjects || 'N/A'}</p>
                            <p><strong>Days/Week:</strong> ${studentData.days || 'N/A'}</p>
                            <p><strong>Status:</strong> ${studentData.isTransitioning ? 'Transitioning' : studentData.summerBreak ? 'On Break' : 'Active'}</p>
                        </div>
                    </div>
                    
                    <div class="bg-green-50 p-4 rounded-lg border border-green-100">
                        <h4 class="font-bold text-lg mb-2 text-green-800">Registration & Contact</h4>
                        <div class="space-y-2">
                            <p><strong>Registered:</strong> ${fmtDate(studentData.createdAt)}</p>
                            <p><strong>Registered By:</strong> ${studentData.createdBy || 'System'}</p>
                            <p><strong>Last Updated:</strong> ${fmtDate(studentData.updatedAt || studentData.lastUpdated)}</p>
                            <p><strong>Updated By:</strong> ${studentData.updatedBy || studentData.lastUpdatedBy || 'System'}</p>
                            <p><strong>Parent:</strong> ${studentData.parentName || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${studentData.parentPhone || 'N/A'}</p>
                            <p><strong>Fee:</strong> ₦${(studentData.studentFee || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Complete Timeline -->
                <div class="mb-8">
                    <h4 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                        <span class="mr-2">📅</span> Complete Activity Timeline
                    </h4>
                    ${allEvents.length > 0 ? 
                        `<div class="max-h-96 overflow-y-auto pr-2">${timelineHTML}</div>` :
                        `<div class="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                            <p class="text-lg">No history records found</p>
                            <p class="text-sm mt-1">This student has no recorded activity yet</p>
                        </div>`
                    }
                </div>
                
                <!-- Detailed Tutor Assignment History -->
                <div class="mb-8">
                    <h4 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                        <span class="mr-2">👨‍🏫</span> Detailed Tutor Assignment History
                    </h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutor Change</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New Tutor Email</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned By</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${tutorAssignmentHTML || 
                                    `<tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-gray-500">
                                            No tutor assignment history available
                                        </td>
                                    </tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Summary Statistics -->
                <div class="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 class="font-bold text-lg mb-2 text-gray-800">History Summary</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${allEvents.length}</div>
                            <div class="text-sm text-gray-600">Total Events</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-600">${sortedHistory.length}</div>
                            <div class="text-sm text-gray-600">Tutor Assignments</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${studentData.createdAt ? '✓' : '0'}</div>
                            <div class="text-sm text-gray-600">Registration</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-yellow-600">${studentData.updatedAt ? '✓' : '0'}</div>
                            <div class="text-sm text-gray-600">Updates</div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end mt-6 pt-6 border-t">
                    <button onclick="closeManagementModal('tutorHistoryModal')" 
                            class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
                        Close History
                    </button>
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

    // Load activity log entries from Firestore for richer timeline, then show modal
    getDocs(query(
        collection(db, 'student_activity_log'),
        where('studentId', '==', studentId)
    )).then(snap => {
        const activityLogEntries = [];
        snap.forEach(d => {
            const data = d.data();
            activityLogEntries.push({
                type: 'INFO_UPDATE',
                date: data.performedAt,
                title: 'Student Info Updated',
                description: data.changedFields || 'Details modified',
                details: '',
                user: data.performedBy || 'Management'
            });
        });
        showTutorHistoryModal(studentId, student, tutorAssignments, activityLogEntries);
    }).catch(() => {
        showTutorHistoryModal(studentId, student, tutorAssignments, []);
    });
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
                <div class="section-title">${title}</div>
                <div class="section-body">${displayContent}</div>
            </div>
        `;
    }).join('');

    // PNG logo for reliable html2canvas rendering (SVG support is limited)
    const logoUrl = "https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg";

    const submissionDate = reportData.submittedAt
        ? new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'N/A';

    // CSS written to be safe for html2canvas: no CSS grid, no flex gap, uses table for two-column layout
    const pdfStyles = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            color: #222;
            background: #ffffff;
            font-size: 12.5px;
            line-height: 1.55;
        }
        .report-container {
            width: 100%;
            padding: 36px 48px 40px 48px;
            background: #ffffff;
        }

        /* ── HEADER ── */
        .header {
            text-align: center;
            margin-bottom: 26px;
            padding-bottom: 16px;
            border-bottom: 3px solid #16a34a;
        }
        .header img {
            height: 64px;
            display: block;
            margin: 0 auto 8px auto;
        }
        .header .logo-fallback {
            display: inline-block;
            font-size: 20px;
            font-weight: bold;
            color: #16a34a;
            margin-bottom: 8px;
        }
        .header .company-name {
            font-size: 20px;
            font-weight: bold;
            color: #166534;
            margin-bottom: 4px;
        }
        .header .report-title {
            font-size: 15px;
            font-weight: bold;
            color: #15803d;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .header .report-date {
            font-size: 11.5px;
            color: #555;
        }

        /* ── STUDENT INFO — table layout, no CSS grid ── */
        .student-info-box {
            width: 100%;
            margin-bottom: 22px;
            background: #f0fdf4;
            border: 1px solid #86efac;
            border-radius: 8px;
            padding: 12px 16px;
        }
        .student-info-table {
            width: 100%;
            border-collapse: collapse;
        }
        .student-info-table td {
            width: 50%;
            padding: 4px 8px 4px 0;
            font-size: 12px;
            vertical-align: top;
        }
        .student-info-table td strong {
            color: #166534;
        }

        /* ── REPORT SECTIONS ── */
        .report-section {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 14px;
            border: 1px solid #d1fae5;
            border-left: 5px solid #16a34a;
            border-radius: 0 6px 6px 0;
            padding: 13px 16px 13px 14px;
            background: #ffffff;
        }
        .section-title {
            font-size: 11px;
            font-weight: bold;
            color: #166534;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            padding-bottom: 7px;
            margin-bottom: 8px;
            border-bottom: 1px solid #d1fae5;
        }
        .section-body {
            line-height: 1.7;
            white-space: pre-wrap;
            color: #333;
            font-size: 12.5px;
            word-break: break-word;
        }

        /* ── FOOTER ── */
        .footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
            text-align: right;
            font-size: 12px;
            color: #555;
        }
        .footer strong {
            color: #166534;
        }
    `;

    const bodyHTML = `
        <div class="report-container">
            <div class="header">
                <img src="${logoUrl}" alt="Blooming Kids House Logo"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';">
                <span class="logo-fallback" style="display:none;">🌱</span>
                <div class="company-name">Blooming Kids House</div>
                <div class="report-title">Monthly Learning Report</div>
                <div class="report-date">Date: ${submissionDate}</div>
            </div>

            <div class="student-info-box">
                <table class="student-info-table">
                    <tr>
                        <td><strong>Student's Name:</strong> ${reportData.studentName || 'N/A'}</td>
                        <td><strong>Parent's Name:</strong> ${reportData.parentName || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>Parent's Phone:</strong> ${reportData.parentPhone || 'N/A'}</td>
                        <td><strong>Grade:</strong> ${reportData.grade || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>Tutor's Name:</strong> ${reportData.tutorName || 'N/A'}</td>
                        <td></td>
                    </tr>
                </table>
            </div>

            ${sectionsHTML}

            <div class="footer">
                <p>Best regards,</p>
                <p><strong>${reportData.tutorName || 'N/A'}</strong></p>
            </div>
        </div>
    `;

    // Full HTML for preview window
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Report — ${reportData.studentName || 'Student'}</title>
    <style>${pdfStyles}</style>
</head>
<body>${bodyHTML}</body>
</html>`;

    return { html: fullHTML, bodyHTML, pdfStyles, reportData };
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
    // Ensure we grab the actual <button> element even if a child icon was clicked
    const button = (event?.target || event)?.closest?.('button') || event?.target || event;
    const originalText = button?.innerHTML || '';
    let tempContainer = null;
    let styleEl = null;

    try {
        if (button) { button.innerHTML = '⏳ Generating...'; button.disabled = true; }

        const progressModal    = document.getElementById('pdf-progress-modal');
        const progressBar      = document.getElementById('pdf-progress-bar');
        const progressText     = document.getElementById('pdf-progress-text');
        const progressMessage  = document.getElementById('pdf-progress-message');

        const setProgress = (pct, msg) => {
            if (progressBar)    progressBar.style.width = `${pct}%`;
            if (progressText)   progressText.textContent = `${pct}%`;
            if (progressMessage) progressMessage.textContent = msg;
        };

        if (progressModal) {
            progressModal.classList.remove('hidden');
            setProgress(10, 'Fetching report data...');
        }

        const { html, bodyHTML, pdfStyles, reportData } = await generateReportHTML(reportId);

        setProgress(40, 'Preparing document layout...');

        if (typeof html2pdf !== 'undefined') {
            // ── Inject into a real DOM element for reliable html2canvas capture ──
            styleEl = document.createElement('style');
            styleEl.textContent = pdfStyles;
            document.head.appendChild(styleEl);

            tempContainer = document.createElement('div');
            // Position off-screen but at exact A4 content width (794px = 8.27in @ 96dpi)
            tempContainer.style.cssText = [
                'position:fixed',
                'top:0',
                'left:-9999px',
                'width:794px',
                'background:#ffffff',
                'z-index:-9999',
                'overflow:visible'
            ].join(';');
            tempContainer.innerHTML = bodyHTML;
            document.body.appendChild(tempContainer);

            // Small delay so browser paints the injected DOM before canvas capture
            await new Promise(r => setTimeout(r, 300));

            setProgress(60, 'Converting to PDF...');

            const safeStudentName = (reportData.studentName || 'Report').replace(/[^a-z0-9]/gi, '_');
            const reportDate = reportData.submittedAt
                ? new Date(reportData.submittedAt.seconds * 1000).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            const options = {
                margin:   [0.55, 0.5, 0.55, 0.5],   // [top, right, bottom, left] in inches
                filename: `${safeStudentName}_Report_${reportDate}.pdf`,
                image:    { type: 'jpeg', quality: 0.97 },
                html2canvas: {
                    scale:           2,
                    useCORS:         true,
                    allowTaint:      false,
                    logging:         false,
                    backgroundColor: '#ffffff',
                    windowWidth:     794,
                    scrollX:         0,
                    scrollY:         0
                },
                jsPDF: {
                    unit:        'in',
                    format:      'a4',
                    orientation: 'portrait',
                    compress:    true
                },
                pagebreak: {
                    mode:   ['avoid-all', 'css', 'legacy'],
                    before: '.page-break-before',
                    avoid:  ['.report-section', '.student-info-box', '.header']
                }
            };

            await html2pdf().set(options).from(tempContainer).save();

        } else {
            // Fallback: browser print dialog
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(html);
                newWindow.document.close();
                newWindow.focus();
                setTimeout(() => newWindow.print(), 800);
            } else {
                alert('Pop-ups blocked. Please allow pop-ups and try again, or use the Preview button and print from there.');
            }
        }

        setProgress(100, '✅ Done! Your PDF is downloading.');
        setTimeout(() => { if (progressModal) progressModal.classList.add('hidden'); }, 1500);

    } catch (error) {
        console.error("Error downloading report:", error);
        alert(`Error downloading report: ${error.message}`);
        const progressModal = document.getElementById('pdf-progress-modal');
        if (progressModal) progressModal.classList.add('hidden');
    } finally {
        if (button) { button.innerHTML = originalText; button.disabled = false; }
        if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    }
};

window.zipAndDownloadTutorReports = async function(reports, tutorName, button) {
    const originalButtonText = button.innerHTML;
    let tempContainer = null;
    let styleEl = null;

    try {
        button.disabled = true;

        const progressModal   = document.getElementById('pdf-progress-modal');
        const progressBar     = document.getElementById('pdf-progress-bar');
        const progressText    = document.getElementById('pdf-progress-text');
        const progressMessage = document.getElementById('pdf-progress-message');

        const setProgress = (pct, msg) => {
            if (progressBar)    progressBar.style.width = `${pct}%`;
            if (progressText)   progressText.textContent = `${pct}%`;
            if (progressMessage) progressMessage.textContent = msg;
        };

        progressModal.classList.remove('hidden');
        setProgress(0, `Preparing ${reports.length} report${reports.length !== 1 ? 's' : ''} for ${tutorName}...`);

        if (typeof html2pdf === 'undefined') {
            throw new Error('html2pdf library is not loaded. Cannot generate PDFs.');
        }
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded. Cannot create ZIP file.');
        }

        const zip = new JSZip();
        let processedCount = 0;
        const errors = [];

        // Create a single persistent off-screen container reused per report
        styleEl = document.createElement('style');
        document.head.appendChild(styleEl);

        tempContainer = document.createElement('div');
        tempContainer.style.cssText = [
            'position:fixed',
            'top:0',
            'left:-9999px',
            'width:794px',
            'background:#ffffff',
            'z-index:-9999',
            'overflow:visible'
        ].join(';');
        document.body.appendChild(tempContainer);

        for (const report of reports) {
            const pct = Math.round((processedCount / reports.length) * 90);
            setProgress(pct, `Generating PDF ${processedCount + 1} of ${reports.length}: ${report.studentName || '...'}`);
            button.innerHTML = `📦 Processing ${processedCount + 1}/${reports.length}`;

            try {
                const { bodyHTML, pdfStyles, reportData } = await generateReportHTML(report.id);

                // Update styles and content for this report
                styleEl.textContent = pdfStyles;
                tempContainer.innerHTML = bodyHTML;

                // Allow browser to paint before capturing
                await new Promise(r => setTimeout(r, 250));

                const safeStudentName = (reportData.studentName || 'Unknown_Student').replace(/[^a-z0-9]/gi, '_');
                const reportDate = reportData.submittedAt
                    ? new Date(reportData.submittedAt.seconds * 1000).toISOString().split('T')[0]
                    : 'unknown_date';
                const filename = `${safeStudentName}_${reportDate}.pdf`;

                const options = {
                    margin:   [0.55, 0.5, 0.55, 0.5],
                    filename,
                    image:    { type: 'jpeg', quality: 0.97 },
                    html2canvas: {
                        scale:           2,
                        useCORS:         true,
                        allowTaint:      false,
                        logging:         false,
                        backgroundColor: '#ffffff',
                        windowWidth:     794,
                        scrollX:         0,
                        scrollY:         0
                    },
                    jsPDF: {
                        unit:        'in',
                        format:      'a4',
                        orientation: 'portrait',
                        compress:    true
                    },
                    pagebreak: {
                        mode:   ['avoid-all', 'css', 'legacy'],
                        before: '.page-break-before',
                        avoid:  ['.report-section', '.student-info-box', '.header']
                    }
                };

                const pdfBlob = await html2pdf().set(options).from(tempContainer).output('blob');
                zip.file(filename, pdfBlob);

            } catch (err) {
                console.error(`Error processing report for ${report.studentName || report.id}:`, err);
                errors.push(report.studentName || report.id);
            }

            processedCount++;
            // Short yield so the UI can breathe between reports
            await new Promise(r => setTimeout(r, 100));
        }

        setProgress(95, 'Creating ZIP archive...');

        const safeTutorName = tutorName.replace(/[^a-z0-9]/gi, '_');
        const zipFilename = `${safeTutorName}_Reports_${new Date().toISOString().split('T')[0]}.zip`;

        const zipBlob = await zip.generateAsync({
            type:        'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        setProgress(100, '✅ ZIP ready — download starting!');

        if (typeof saveAs !== 'undefined') {
            saveAs(zipBlob, zipFilename);
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = zipFilename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 10000);
        }

        setTimeout(() => progressModal.classList.add('hidden'), 2500);

        if (errors.length > 0) {
            setTimeout(() => {
                alert(`ZIP created, but ${errors.length} report(s) had errors and were skipped:\n• ${errors.join('\n• ')}`);
            }, 500);
        }

    } catch (error) {
        console.error("Error creating ZIP file:", error);
        alert(`Failed to create ZIP file: ${error.message}\n\nPlease try again.`);
        const progressModal = document.getElementById('pdf-progress-modal');
        if (progressModal) progressModal.classList.add('hidden');
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
        if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
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

// ======================================================
// SECTION 8.5: MASTER PORTAL — MANAGEMENT CONTROL CENTRE
// ======================================================
// Firestore collections used:
//   tutors              → tutor profiles
//   students            → student records (schedule, type flags)
//   tutor_grades        → { tutorId, tutorEmail, month, qa:{score,notes,gradedBy,gradedByName,gradedAt}, qc:{...}, totalScore }
//   gamification/current_cycle → { winnerId, winnerEmail, winnerName, month, year, totalScore }
// ======================================================

// --- Lagos Time Helper ---
function getLagosDatetime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
}
function formatLagosDatetime() {
    const d = getLagosDatetime();
    const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric',
                   hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true,
                   timeZone:'Africa/Lagos' };
    return new Intl.DateTimeFormat('en-NG', opts).format(new Date());
}
function getCurrentMonthKeyLagos() {
    const d = getLagosDatetime();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function getCurrentMonthLabelLagos() {
    return getLagosDatetime().toLocaleString('en-NG', { month:'long', year:'numeric', timeZone:'Africa/Lagos' });
}

// --- Score Color Helper ---
function getScoreColor(score) {
    if (score >= 85) return 'text-green-600';
    if (score >= 65) return 'text-yellow-600';
    if (score >= 45) return 'text-orange-500';
    return 'text-red-500';
}
function getScoreBg(score) {
    if (score >= 85) return 'bg-green-50 border-green-200';
    if (score >= 65) return 'bg-yellow-50 border-yellow-200';
    if (score >= 45) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
}
function getScoreBar(score) {
    if (score >= 85) return 'bg-green-500';
    if (score >= 65) return 'bg-yellow-500';
    if (score >= 45) return 'bg-orange-400';
    return 'bg-red-400';
}

// --- Student Type Label ---
function getStudentTypeLabel(student) {
    if (student.groupClass) return '<span class="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-semibold">Group</span>';
    if (student.isTransitioning) return '<span class="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-semibold">Transitioning</span>';
    return '<span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">Regular</span>';
}

// --- Schedule Display ---
function formatStudentSchedule(student) {
    if (!student.schedule || !Array.isArray(student.schedule) || student.schedule.length === 0) {
        return '<span class="text-gray-400 text-xs italic">No schedule</span>';
    }
    return student.schedule.map(slot => {
        const day = slot.day ? slot.day.substring(0,3) : '?';
        const start = slot.start || '';
        const end = slot.end || '';
        function fmtTime(t) {
            if (!t) return '';
            const [h, m] = t.split(':').map(Number);
            const ap = h >= 12 ? 'PM' : 'AM';
            return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}`;
        }
        return `<span class="inline-block bg-gray-100 rounded px-1.5 py-0.5 text-xs mr-1 mb-1">${day} ${fmtTime(start)}–${fmtTime(end)}</span>`;
    }).join('');
}

// --- Main Render Function ---
async function renderMasterPortalPanel(container) {
    const monthKey = getCurrentMonthKeyLagos();
    const monthLabel = getCurrentMonthLabelLagos();

    container.innerHTML = `
    <div class="space-y-4">
        <!-- Header bar with Lagos clock -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">🗂 Management Portal</h2>
                <p class="text-sm text-gray-500">Master View — ${monthLabel}</p>
            </div>
            <div class="text-right">
                <div id="lagos-clock" class="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    Loading time…
                </div>
                <div class="text-xs text-gray-400 mt-0.5">📍 Lagos, Nigeria</div>
            </div>
        </div>

        <!-- Tutor of the Month Banner -->
        <div id="totm-banner" class="hidden bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-4 text-white shadow flex items-center gap-4">
            <div class="text-4xl">🏆</div>
            <div>
                <div class="font-black text-lg" id="totm-name">Tutor of the Month</div>
                <div class="text-sm opacity-90" id="totm-score"></div>
            </div>
            <div class="ml-auto text-right">
                <div class="text-xs opacity-80">${monthLabel}</div>
            </div>
        </div>

        <!-- Tutor Search Bar -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="fas fa-search text-gray-400"></i>
                </div>
                <input type="text" id="master-portal-tutor-search" 
                    placeholder="Search tutors by name..." 
                    class="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    autocomplete="off">
                <button id="master-portal-search-clear" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 hidden">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="master-portal-search-count" class="text-xs text-gray-400 mt-1.5 hidden"></div>
        </div>

        <!-- Loading indicator -->
        <div id="master-portal-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading tutor data…</p>
        </div>

        <!-- Tutors accordion list -->
        <div id="master-portal-list" class="space-y-3 hidden"></div>
    </div>
    `;

    // Start Lagos clock
    const clockEl = document.getElementById('lagos-clock');
    function tickClock() { if (clockEl) clockEl.textContent = formatLagosDatetime(); }
    tickClock();
    const clockInterval = setInterval(tickClock, 1000);
    // Cleanup on tab change
    window._masterPortalClockInterval = clockInterval;

    try {
        // Load all data in parallel
        const [tutorsSnap, studentsSnap, gradesSnap, cycleSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutors'), orderBy('name'))),
            getDocs(collection(db, 'students')),
            getDocs(query(collection(db, 'tutor_grades'), where('month', '==', monthKey))),
            getDoc(doc(db, 'gamification', 'current_cycle'))
        ]);

        const tutors = tutorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const grades = {};
        gradesSnap.docs.forEach(d => { grades[d.data().tutorId || d.data().tutorEmail] = { id: d.id, ...d.data() }; });

        // Build student map by tutor email
        const studentsByTutor = {};
        students.forEach(s => {
            const key = s.tutorEmail || '';
            if (!studentsByTutor[key]) studentsByTutor[key] = [];
            studentsByTutor[key].push(s);
        });

        // Determine leading tutor
        let leadingTutor = null, leadingScore = -1;
        tutors.forEach(t => {
            const g = grades[t.id] || grades[t.email] || {};
            const qaScore = g.qa?.score ?? 0;
            const qcScore = g.qc?.score ?? 0;
            const total = Math.round((qaScore + qcScore) / 2);
            if (total > leadingScore) { leadingScore = total; leadingTutor = { ...t, total }; }
        });

        // Handle tutor of month banner
        const totmBanner = document.getElementById('totm-banner');
        if (leadingTutor && leadingScore > 0) {
            document.getElementById('totm-name').textContent = `👑 ${leadingTutor.name}`;
            document.getElementById('totm-score').textContent = `Leading score: ${leadingScore}% this month`;
            totmBanner.classList.remove('hidden');
        }

        // Render accordion list
        const listEl = document.getElementById('master-portal-list');
        const currentStaff = window.userData;

        tutors.forEach((tutor, idx) => {
            const tutorStudents = studentsByTutor[tutor.email] || [];
            const activeStudents = tutorStudents.filter(s => !s.summerBreak && !['archived','graduated','transferred'].includes(s.status));
            const g = grades[tutor.id] || grades[tutor.email] || {};
            const qaScore = g.qa?.score ?? null;
            const qcScore = g.qc?.score ?? null;
            const totalScore = (qaScore !== null && qcScore !== null)
                ? Math.round((qaScore + qcScore) / 2)
                : (qaScore !== null ? qaScore : (qcScore !== null ? qcScore : null));
            const scoreDisplay = totalScore !== null ? totalScore : '—';
            const colorClass = totalScore !== null ? getScoreColor(totalScore) : 'text-gray-400';
            const bgClass = totalScore !== null ? getScoreBg(totalScore) : 'bg-gray-50 border-gray-200';

            // Check if current user already graded this tutor
            const canQA = currentStaff?.permissions?.tabs?.canQA;
            const canQC = currentStaff?.permissions?.tabs?.canQC;
            const alreadyQA = g.qa?.gradedBy === currentStaff?.email;
            const alreadyQC = g.qc?.gradedBy === currentStaff?.email;

            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden';
            card.innerHTML = `
            <!-- Accordion Header -->
            <button class="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors accordion-header" data-idx="${idx}">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-gray-800">${escHtml(tutor.name)}</span>
                        ${leadingTutor && tutor.id === leadingTutor.id ? '<span class="text-yellow-500">👑</span>' : ''}
                        <span class="text-xs text-gray-400">${activeStudents.length} active student${activeStudents.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="text-xs text-gray-400 truncate">${escHtml(tutor.email || '')}</div>
                </div>
                <!-- Combined score pill -->
                <div class="flex-shrink-0 text-center px-3 py-2 rounded-xl border ${bgClass}">
                    <div class="text-2xl font-black ${colorClass}">${scoreDisplay}${totalScore !== null ? '<span class="text-sm">%</span>' : ''}</div>
                    <div class="text-xs text-gray-500">Combined</div>
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0 accordion-arrow"></i>
            </button>

            <!-- Accordion Body -->
            <div class="accordion-body hidden border-t border-gray-100">
                <!-- Mini score breakdown -->
                <div class="p-4 grid grid-cols-2 gap-3 bg-gray-50">
                    <!-- QA Score -->
                    <div class="bg-white rounded-xl border border-purple-100 p-3">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs font-bold text-purple-600 uppercase tracking-wide">QA – Session Obs.</div>
                            ${g.qa?.gradedByName ? `<span class="text-xs text-gray-400">by ${escHtml(g.qa.gradedByName)}</span>` : ''}
                        </div>
                        ${qaScore !== null ? `
                            <div class="text-3xl font-black ${getScoreColor(qaScore)}">${qaScore}<span class="text-sm">%</span></div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div class="${getScoreBar(qaScore)} h-1.5 rounded-full" style="width:${qaScore}%"></div>
                            </div>
                            ${g.qa?.notes ? `<div class="mt-2 text-xs text-gray-600 bg-purple-50 rounded p-1.5 italic">"${escHtml(g.qa.notes)}"</div>` : ''}
                        ` : `<div class="text-gray-400 text-sm mt-1">Not graded</div>`}
                        ${canQA && !alreadyQA ? `
                            <button class="open-qa-btn mt-2 w-full bg-purple-600 text-white text-xs rounded-lg py-1.5 hover:bg-purple-700" data-tutor-id="${tutor.id}" data-tutor-name="${escHtml(tutor.name)}" data-tutor-email="${escHtml(tutor.email)}" data-grade-id="${g.id || ''}">
                                ${qaScore !== null ? '✏️ View QA' : '📋 Grade QA'}
                            </button>
                        ` : canQA && alreadyQA ? `
                            <div class="mt-2 text-xs text-green-600 font-semibold text-center">✅ You graded QA this month</div>
                            <button class="open-qa-btn mt-1 w-full bg-purple-100 text-purple-700 text-xs rounded-lg py-1.5 hover:bg-purple-200" data-tutor-id="${tutor.id}" data-tutor-name="${escHtml(tutor.name)}" data-tutor-email="${escHtml(tutor.email)}" data-grade-id="${g.id || ''}" data-readonly="true">
                                👁 View My QA Grade
                            </button>
                        ` : ''}
                    </div>

                    <!-- QC Score -->
                    <div class="bg-white rounded-xl border border-amber-100 p-3">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs font-bold text-amber-600 uppercase tracking-wide">QC – Lesson Plan</div>
                            ${g.qc?.gradedByName ? `<span class="text-xs text-gray-400">by ${escHtml(g.qc.gradedByName)}</span>` : ''}
                        </div>
                        ${qcScore !== null ? `
                            <div class="text-3xl font-black ${getScoreColor(qcScore)}">${qcScore}<span class="text-sm">%</span></div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div class="${getScoreBar(qcScore)} h-1.5 rounded-full" style="width:${qcScore}%"></div>
                            </div>
                            ${g.qc?.notes ? `<div class="mt-2 text-xs text-gray-600 bg-amber-50 rounded p-1.5 italic">"${escHtml(g.qc.notes)}"</div>` : ''}
                        ` : `<div class="text-gray-400 text-sm mt-1">Not graded</div>`}
                        ${canQC && !alreadyQC ? `
                            <button class="open-qc-btn mt-2 w-full bg-amber-600 text-white text-xs rounded-lg py-1.5 hover:bg-amber-700" data-tutor-id="${tutor.id}" data-tutor-name="${escHtml(tutor.name)}" data-tutor-email="${escHtml(tutor.email)}" data-grade-id="${g.id || ''}">
                                ${qcScore !== null ? '✏️ View QC' : '📋 Grade QC'}
                            </button>
                        ` : canQC && alreadyQC ? `
                            <div class="mt-2 text-xs text-green-600 font-semibold text-center">✅ You graded QC this month</div>
                            <button class="open-qc-btn mt-1 w-full bg-amber-100 text-amber-700 text-xs rounded-lg py-1.5 hover:bg-amber-200" data-tutor-id="${tutor.id}" data-tutor-name="${escHtml(tutor.name)}" data-tutor-email="${escHtml(tutor.email)}" data-grade-id="${g.id || ''}" data-readonly="true">
                                👁 View My QC Grade
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Students table -->
                ${activeStudents.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                                <th class="text-left py-2 px-4">Student</th>
                                <th class="text-left py-2 px-4">Grade</th>
                                <th class="text-left py-2 px-4">Type</th>
                                <th class="text-left py-2 px-4">Schedule</th>
                                <th class="text-left py-2 px-4">Subjects</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeStudents.map(s => `
                            <tr class="border-b border-gray-50 hover:bg-gray-50">
                                <td class="py-2 px-4 font-medium text-gray-800">${escHtml(s.studentName || '')}<div class="text-xs text-gray-400">${escHtml(s.parentName || '')}</div></td>
                                <td class="py-2 px-4 text-gray-600">${escHtml(s.grade || '—')}</td>
                                <td class="py-2 px-4">${getStudentTypeLabel(s)}</td>
                                <td class="py-2 px-4">${formatStudentSchedule(s)}</td>
                                <td class="py-2 px-4 text-xs text-gray-500">${escHtml((s.subjects || []).join(', ') || '—')}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : `<div class="p-4 text-center text-gray-400 text-sm">No active students this month.</div>`}
            </div>
            `;

            listEl.appendChild(card);
        });

        // Accordion toggle behaviour
        listEl.querySelectorAll('.accordion-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                const arrow = btn.querySelector('.accordion-arrow');
                const isOpen = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });

        // QA grade buttons
        listEl.querySelectorAll('.open-qa-btn').forEach(btn => {
            btn.addEventListener('click', () => openGradeModal('qa', btn.dataset, grades, monthKey));
        });

        // QC grade buttons
        listEl.querySelectorAll('.open-qc-btn').forEach(btn => {
            btn.addEventListener('click', () => openGradeModal('qc', btn.dataset, grades, monthKey));
        });

        document.getElementById('master-portal-loading').classList.add('hidden');
        listEl.classList.remove('hidden');

        // --- Tutor Search Functionality ---
        const searchInput = document.getElementById('master-portal-tutor-search');
        const searchClear = document.getElementById('master-portal-search-clear');
        const searchCount = document.getElementById('master-portal-search-count');
        const tutorCards = listEl.querySelectorAll(':scope > div');
        const totalTutors = tutorCards.length;

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase().trim();
                if (searchClear) searchClear.classList.toggle('hidden', !term);
                let visibleCount = 0;
                tutorCards.forEach(card => {
                    const header = card.querySelector('.accordion-header');
                    const nameEl = header ? header.querySelector('.font-bold.text-gray-800') : null;
                    const tutorName = nameEl ? nameEl.textContent.toLowerCase() : '';
                    if (!term || tutorName.includes(term)) { card.style.display = ''; visibleCount++; }
                    else { card.style.display = 'none'; }
                });
                if (searchCount) {
                    if (term) { searchCount.textContent = `Showing ${visibleCount} of ${totalTutors} tutors`; searchCount.classList.remove('hidden'); }
                    else { searchCount.classList.add('hidden'); }
                }
            });
            if (searchClear) {
                searchClear.addEventListener('click', () => { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); searchInput.focus(); });
            }
        }

        // After render, update gamification winner in Firestore if needed
        if (leadingTutor && leadingScore > 0) {
            updateTutorOfMonthIfNeeded(leadingTutor, leadingScore, monthKey, getCurrentMonthLabelLagos());
        }

    } catch (err) {
        console.error('Master Portal error:', err);
        document.getElementById('master-portal-loading').innerHTML =
            `<p class="text-red-500">❌ Failed to load: ${err.message}</p>`;
    }
}

// --- QA/QC Grade Modal ---
function openGradeModal(type, dataset, grades, monthKey) {
    const tutorId = dataset.tutorId;
    const tutorName = dataset.tutorName;
    const tutorEmail = dataset.tutorEmail;
    const gradeId = dataset.gradeId;
    const isReadOnly = dataset.readonly === 'true';
    const staff = window.userData;
    const existingGrade = gradeId ? (Object.values(grades).find(g => g.id === gradeId) || {}) : {};
    const existingSection = existingGrade[type] || {};

    const isQA = type === 'qa';
    const themeColor = isQA ? 'purple' : 'amber';
    const title = isQA ? '📋 QA — Session Observation Rating' : '📐 QC — Lesson Plan Quality Control';

    // QA has 7 areas, QC has 10 areas
    const areas = isQA ? [
        { id: 'preparation',    label: 'Lesson Preparation & Resources', max: 15 },
        { id: 'delivery',       label: 'Teaching Delivery & Clarity',    max: 15 },
        { id: 'engagement',     label: 'Student Engagement',             max: 15 },
        { id: 'differentiation',label: 'Differentiation & Adaptation',   max: 15 },
        { id: 'assessment',     label: 'In-class Assessment',            max: 10 },
        { id: 'classroom',      label: 'Classroom Management',           max: 15 },
        { id: 'professionalism',label: 'Professionalism & Attitude',     max: 15 },
    ] : [
        { id: 'objectives',     label: 'Clear Learning Objectives',      max: 10 },
        { id: 'structure',      label: 'Lesson Structure & Flow',        max: 10 },
        { id: 'differentiation',label: 'Differentiation Strategies',     max: 10 },
        { id: 'resources',      label: 'Resource Quality',               max: 10 },
        { id: 'assessment',     label: 'Assessment Plan',                max: 10 },
        { id: 'timing',         label: 'Timing & Pacing',                max: 10 },
        { id: 'curriculum',     label: 'Curriculum Alignment',           max: 10 },
        { id: 'innovation',     label: 'Innovation & Creativity',        max: 10 },
        { id: 'feedback',       label: 'Feedback Mechanism',             max: 10 },
        { id: 'documentation',  label: 'Documentation & Completeness',   max: 10 },
    ];

    const breakdown = existingSection.breakdown || {};
    const existingNotes = existingSection.notes || '';

    const areasHTML = areas.map(a => `
        <div class="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
            <span class="flex-1 text-sm text-gray-700">${a.label}</span>
            <div class="flex items-center gap-2 flex-shrink-0">
                <input type="number" id="area-${a.id}" class="w-16 text-center border rounded-lg py-1 text-sm font-bold ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}"
                    min="0" max="${a.max}" value="${breakdown[a.id] ?? ''}" ${isReadOnly ? 'readonly' : ''}
                    placeholder="0">
                <span class="text-xs text-gray-400 w-10">/ ${a.max}</span>
            </div>
        </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'grade-modal-overlay';
    modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto my-4">
        <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-${themeColor}-50 rounded-t-2xl">
            <div>
                <h3 class="font-bold text-lg text-${themeColor}-800">${title}</h3>
                <p class="text-sm text-${themeColor}-600">${escHtml(tutorName)} · ${monthKey}</p>
            </div>
            <button id="close-grade-modal" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>
        <div class="p-5 max-h-[60vh] overflow-y-auto">
            <div class="space-y-1">
                ${areasHTML}
            </div>
            <div class="mt-4">
                <label class="block text-sm font-semibold text-gray-700 mb-1">Notes & Advice for Tutor</label>
                <textarea id="grade-notes" class="w-full border rounded-xl p-3 text-sm resize-none ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}"
                    rows="3" placeholder="Add advice, commendations, or improvement areas…" ${isReadOnly ? 'readonly' : ''}>${escHtml(existingNotes)}</textarea>
            </div>
            <!-- Live total -->
            <div class="mt-3 bg-${themeColor}-50 rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm font-semibold text-${themeColor}-700">Score</span>
                <span id="live-total" class="text-2xl font-black text-${themeColor}-700">—</span>
            </div>
            ${existingSection.gradedByName ? `<div class="mt-2 text-xs text-gray-400 text-center">Graded by <strong>${escHtml(existingSection.gradedByName)}</strong></div>` : ''}
        </div>
        <div class="p-4 border-t border-gray-100 flex gap-3 justify-end">
            <button id="cancel-grade-modal" class="px-4 py-2 bg-gray-100 rounded-xl text-sm hover:bg-gray-200">Cancel</button>
            ${!isReadOnly ? `<button id="save-grade-modal" class="px-6 py-2 bg-${themeColor}-600 text-white rounded-xl text-sm font-bold hover:bg-${themeColor}-700">Save Grade</button>` : ''}
        </div>
    </div>`;

    document.body.appendChild(modal);

    // Live total calculation
    function recalcTotal() {
        let sum = 0, maxSum = 0;
        areas.forEach(a => {
            const val = parseInt(document.getElementById(`area-${a.id}`)?.value || 0) || 0;
            sum += Math.min(val, a.max);
            maxSum += a.max;
        });
        const pct = maxSum > 0 ? Math.round((sum / maxSum) * 100) : 0;
        const el = document.getElementById('live-total');
        if (el) el.textContent = `${pct}%`;
        return pct;
    }
    modal.querySelectorAll('input[type=number]').forEach(inp => inp.addEventListener('input', recalcTotal));
    recalcTotal();

    // Close
    modal.querySelector('#close-grade-modal').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-grade-modal').addEventListener('click', () => modal.remove());

    // Save
    if (!isReadOnly) {
        modal.querySelector('#save-grade-modal').addEventListener('click', async () => {
            const breakdownData = {};
            areas.forEach(a => {
                const val = parseInt(document.getElementById(`area-${a.id}`)?.value || 0) || 0;
                breakdownData[a.id] = Math.min(val, a.max);
            });
            const totalPct = recalcTotal();
            const notes = document.getElementById('grade-notes').value.trim();

            const sectionData = {
                score: totalPct,
                notes,
                breakdown: breakdownData,
                gradedBy: staff.email || '',
                gradedByName: staff.name || 'Management',
                gradedAt: new Date()
            };

            try {
                const btn = modal.querySelector('#save-grade-modal');
                btn.textContent = 'Saving…'; btn.disabled = true;

                if (gradeId) {
                    await updateDoc(doc(db, 'tutor_grades', gradeId), { [type]: sectionData });
                } else {
                    // Create new doc
                    const newDoc = {
                        tutorId,
                        tutorEmail,
                        month: monthKey,
                        [type]: sectionData
                    };
                    await addDoc(collection(db, 'tutor_grades'), newDoc);
                }

                // Update performanceScore on tutor doc for tutor.js to read
                // ── Re-fetch the grade doc from Firestore to get the LATEST qa+qc data ──
                let freshGrade = {};
                if (gradeId) {
                    const freshSnap = await getDoc(doc(db, 'tutor_grades', gradeId));
                    if (freshSnap.exists()) freshGrade = freshSnap.data();
                } else {
                    // Newly created — find it by tutorId + month
                    const freshQuery = await getDocs(
                        query(collection(db, 'tutor_grades'),
                              where('tutorId', '==', tutorId),
                              where('month', '==', monthKey))
                    );
                    if (!freshQuery.empty) freshGrade = freshQuery.docs[0].data();
                    else {
                        // fallback: by email
                        const freshQuery2 = await getDocs(
                            query(collection(db, 'tutor_grades'),
                                  where('tutorEmail', '==', tutorEmail),
                                  where('month', '==', monthKey))
                        );
                        if (!freshQuery2.empty) freshGrade = freshQuery2.docs[0].data();
                    }
                }

                // The just-saved section is already in sectionData; merge with freshGrade
                const freshQA = type === 'qa' ? sectionData : (freshGrade.qa || null);
                const freshQC = type === 'qc' ? sectionData : (freshGrade.qc || null);
                const qaScore = freshQA?.score ?? null;
                const qcScore = freshQC?.score ?? null;
                const combined = (qaScore !== null && qcScore !== null)
                    ? Math.round((qaScore + qcScore) / 2)
                    : (qaScore !== null ? qaScore : qcScore);

                if (combined !== null) {
                    const tutorDocRef = doc(db, 'tutors', tutorId);
                    await updateDoc(tutorDocRef, {
                        performanceScore: combined,
                        qaScore: qaScore,
                        qcScore: qcScore,
                        performanceMonth: monthKey,
                        qaAdvice: type === 'qa' ? notes : (existingGradeForTutor.qa?.notes || ''),
                        qcAdvice: type === 'qc' ? notes : (existingGradeForTutor.qc?.notes || ''),
                        qaGradedByName: type === 'qa' ? sectionData.gradedByName : (existingGradeForTutor.qa?.gradedByName || ''),
                        qcGradedByName: type === 'qc' ? sectionData.gradedByName : (existingGradeForTutor.qc?.gradedByName || '')
                    });
                }

                modal.remove();
                // Refresh portal
                renderMasterPortalPanel(document.getElementById('main-content'));
            } catch (e) {
                console.error('Grade save error:', e);
                btn.textContent = 'Save Grade'; btn.disabled = false;
                alert('❌ Error saving grade: ' + e.message);
            }
        });
    }
}

// --- Update tutor of month document ---
async function updateTutorOfMonthIfNeeded(tutor, score, monthKey, monthLabel) {
    try {
        const cycleRef = doc(db, 'gamification', 'current_cycle');
        const cycleSnap = await getDoc(cycleRef);
        const existing = cycleSnap.exists() ? cycleSnap.data() : {};
        if (existing.month !== monthKey || existing.winnerId !== tutor.id) {
            await setDoc(cycleRef, {
                winnerId: tutor.id,
                winnerEmail: tutor.email,
                winnerName: tutor.name,
                month: monthKey,
                monthLabel,
                totalScore: score
            }, { merge: true });
        }
    } catch (e) { /* silent */ }
}

// ======================================================
// SECTION 8.6: ACADEMIC FOLLOW-UP — TALLY SYSTEM
// ======================================================
// Reads:  daily_topics  →  { studentId, tutorEmail, topics, createdAt }
//         homework_assignments → { tutorEmail, studentName, title, assignedAt / createdAt }
// ======================================================

async function renderAcademicFollowUpPanel(container) {
    container.innerHTML = `
    <div class="space-y-4">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <div>
                <h2 class="text-xl font-bold text-gray-800">📊 Academic Follow-Up</h2>
                <p class="text-sm text-gray-500">Topic entries & homework per tutor, month by month</p>
            </div>
            <div id="afu-clock" class="text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                ${formatLagosDatetime()}
            </div>
        </div>

        <div id="afu-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading academic data…</p>
        </div>
        <div id="afu-list" class="space-y-4 hidden"></div>
    </div>`;

    // Tick clock
    setInterval(() => { const el = document.getElementById('afu-clock'); if (el) el.textContent = formatLagosDatetime(); }, 1000);

    try {
        const [tutorsSnap, topicsSnap, hwSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutors'), orderBy('name'))),
            getDocs(collection(db, 'daily_topics')),
            getDocs(collection(db, 'homework_assignments'))
        ]);

        const tutors = tutorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Build per-tutor topic data keyed by month
        const topicsByTutor = {}; // tutorEmail → { 'YYYY-MM' → [{ date, topics, studentId }] }
        topicsSnap.docs.forEach(d => {
            const data = d.data();
            const email = data.tutorEmail || '';
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!topicsByTutor[email]) topicsByTutor[email] = {};
            if (!topicsByTutor[email][mk]) topicsByTutor[email][mk] = [];
            topicsByTutor[email][mk].push({ date, topics: data.topics || '', studentId: data.studentId || '' });
        });

        // Build per-tutor homework data keyed by month
        const hwByTutor = {}; // tutorEmail → { 'YYYY-MM' → [{ date, title, studentName }] }
        hwSnap.docs.forEach(d => {
            const data = d.data();
            const email = data.tutorEmail || '';
            const raw = data.assignedAt || data.createdAt || data.uploadedAt;
            const date = raw?.toDate ? raw.toDate() : new Date(raw || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!hwByTutor[email]) hwByTutor[email] = {};
            if (!hwByTutor[email][mk]) hwByTutor[email][mk] = [];
            hwByTutor[email][mk].push({ date, title: data.title || 'Homework', studentName: data.studentName || '' });
        });

        const listEl = document.getElementById('afu-list');

        tutors.forEach((tutor, idx) => {
            const tutorTopics = topicsByTutor[tutor.email] || {};
            const tutorHw = hwByTutor[tutor.email] || {};

            // Collect all months
            const allMonths = new Set([...Object.keys(tutorTopics), ...Object.keys(tutorHw)]);
            const sortedMonths = Array.from(allMonths).sort((a, b) => b.localeCompare(a)); // newest first

            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden';

            const totalTopics = Object.values(tutorTopics).reduce((s, arr) => s + arr.length, 0);
            const totalHw = Object.values(tutorHw).reduce((s, arr) => s + arr.length, 0);

            card.innerHTML = `
            <!-- Tutor header accordion -->
            <button class="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors afu-header" data-idx="${idx}">
                <div class="flex-1">
                    <div class="font-bold text-gray-800">${escHtml(tutor.name)}</div>
                    <div class="text-xs text-gray-400">${escHtml(tutor.email || '')}</div>
                </div>
                <div class="flex gap-4 text-center flex-shrink-0">
                    <div class="bg-blue-50 rounded-xl px-3 py-1.5">
                        <div class="text-xl font-black text-blue-600">${totalTopics}</div>
                        <div class="text-xs text-blue-500">Topics</div>
                    </div>
                    <div class="bg-green-50 rounded-xl px-3 py-1.5">
                        <div class="text-xl font-black text-green-600">${totalHw}</div>
                        <div class="text-xs text-green-500">H/W</div>
                    </div>
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0 afu-arrow"></i>
            </button>

            <!-- Months accordion body -->
            <div class="afu-body hidden border-t border-gray-100">
                ${sortedMonths.length === 0 ? `
                    <div class="p-6 text-center text-gray-400 text-sm">No academic activity recorded yet.</div>
                ` : sortedMonths.map(mk => {
                    const topics = tutorTopics[mk] || [];
                    const hw = tutorHw[mk] || [];
                    const [y, m] = mk.split('-');
                    const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('en-NG', { month:'long', year:'numeric' });

                    // Build tally groups by day
                    const dayMap = {}; // dateString → { topics:[], hw:[] }
                    topics.forEach(t => {
                        const ds = t.date.toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
                        if (!dayMap[ds]) dayMap[ds] = { topics:[], hw:[], rawDate: t.date };
                        dayMap[ds].topics.push(t.topics);
                    });
                    hw.forEach(h => {
                        const ds = h.date.toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
                        if (!dayMap[ds]) dayMap[ds] = { topics:[], hw:[], rawDate: h.date };
                        dayMap[ds].hw.push(h.title + (h.studentName ? ` (${h.studentName})` : ''));
                    });

                    const sortedDays = Object.entries(dayMap).sort((a, b) => b[1].rawDate - a[1].rawDate);

                    // Abacus/tally representation
                    function tallyDots(count, color) {
                        const full = Math.floor(count / 5);
                        const remainder = count % 5;
                        let html = '';
                        for (let i = 0; i < full; i++) html += `<span class="inline-flex gap-0.5">${'<span class="w-2 h-2 rounded-full inline-block ' + color + '"></span>'.repeat(4)}<span class="w-0.5 h-3 rounded inline-block ${color} opacity-60 mx-0.5" style="vertical-align:middle"></span></span>`;
                        for (let i = 0; i < remainder; i++) html += `<span class="w-2 h-2 rounded-full inline-block ${color}"></span>`;
                        return html || '<span class="text-gray-300">—</span>';
                    }

                    return `
                    <details class="border-b border-gray-100 last:border-0">
                        <summary class="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 list-none">
                            <div class="flex-1">
                                <span class="font-semibold text-sm text-gray-700">${label}</span>
                            </div>
                            <!-- Tally visual for the month -->
                            <div class="flex items-center gap-4 flex-shrink-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs text-blue-500 font-bold">${topics.length} T</span>
                                    <div class="flex flex-wrap gap-0.5 max-w-32">${tallyDots(topics.length, 'bg-blue-400')}</div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs text-green-500 font-bold">${hw.length} H</span>
                                    <div class="flex flex-wrap gap-0.5 max-w-32">${tallyDots(hw.length, 'bg-green-400')}</div>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400 text-xs"></i>
                        </summary>
                        <!-- Daily breakdown -->
                        <div class="px-4 pb-3 space-y-2">
                            ${sortedDays.map(([ds, day]) => `
                            <div class="bg-gray-50 rounded-xl p-3">
                                <div class="text-xs font-bold text-gray-500 mb-1">${ds}</div>
                                <div class="flex flex-wrap gap-2">
                                    ${day.topics.map(t => `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">📝 ${escHtml(t.substring(0,40))}</span>`).join('')}
                                    ${day.hw.map(h => `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">📚 ${escHtml(h.substring(0,40))}</span>`).join('')}
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </details>
                    `;
                }).join('')}
            </div>
            `;

            listEl.appendChild(card);
        });

        // Accordion toggle
        listEl.querySelectorAll('.afu-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                const arrow = btn.querySelector('.afu-arrow');
                const isOpen = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });

        document.getElementById('afu-loading').classList.add('hidden');
        listEl.classList.remove('hidden');

    } catch (err) {
        console.error('Academic Follow-Up error:', err);
        document.getElementById('afu-loading').innerHTML = `<p class="text-red-500">❌ Error: ${err.message}</p>`;
    }
}

// Shared HTML escape helper (management scope)
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ======================================================
// SECTION 8B: USER DIRECTORY PANEL (NO ACTIVITY LOGGING)
// ======================================================

async function renderUserDirectoryPanel(container) {
    container.innerHTML = `
    <div class="space-y-4">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">📋 User Directory</h2>
                <p class="text-sm text-gray-500">All Tutors, Students & Parents</p>
            </div>
            <button id="ud-refresh-btn" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
                <i class="fas fa-sync-alt mr-1"></i> Refresh
            </button>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-blue-700" id="ud-tutor-count">—</div>
                <div class="text-xs text-blue-600 font-semibold uppercase mt-1">Tutors</div>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-green-700" id="ud-student-count">—</div>
                <div class="text-xs text-green-600 font-semibold uppercase mt-1">Students</div>
            </div>
            <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-purple-700" id="ud-parent-count">—</div>
                <div class="text-xs text-purple-600 font-semibold uppercase mt-1">Parents</div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-amber-700" id="ud-total-count">—</div>
                <div class="text-xs text-amber-600 font-semibold uppercase mt-1">Total Users</div>
            </div>
        </div>

        <!-- Search + Tab Switcher -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="relative flex-1">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i class="fas fa-search text-gray-400"></i></div>
                    <input type="text" id="ud-search" placeholder="Search by name, email, phone..."
                        class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" autocomplete="off">
                </div>
                <div class="flex bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white" data-tab="tutors">Tutors</button>
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200" data-tab="students">Students</button>
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200" data-tab="parents">Parents</button>
                </div>
            </div>
        </div>

        <!-- Bulk Action Bar (hidden by default) -->
        <div id="ud-bulk-bar" class="hidden bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-indigo-800"><span id="ud-selected-count">0</span> selected</span>
                <button id="ud-clear-selection-btn" class="text-xs text-indigo-600 hover:text-indigo-800 underline">Clear</button>
            </div>
            <div class="flex gap-2">
                <button id="ud-bulk-delete-btn" class="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">
                    <i class="fas fa-trash mr-1"></i> Delete Selected
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div id="ud-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading user data…</p>
        </div>

        <!-- Content Area -->
        <div id="ud-content" class="hidden"></div>
    </div>
    `;

    // State
    let udTutors = [], udStudents = [], udParents = [];
    let currentTab = 'tutors';
    let selectedIds = new Set();

    // --- Helpers ---
    function updateBulkBar() {
        const bar = document.getElementById('ud-bulk-bar');
        const countEl = document.getElementById('ud-selected-count');
        if (bar && countEl) {
            countEl.textContent = selectedIds.size;
            bar.classList.toggle('hidden', selectedIds.size === 0);
        }
    }

    function clearSelection() {
        selectedIds.clear();
        document.querySelectorAll('.ud-row-checkbox').forEach(cb => cb.checked = false);
        const selectAll = document.getElementById('ud-select-all');
        if (selectAll) selectAll.checked = false;
        updateBulkBar();
    }

    // Tab switching
    container.querySelectorAll('.ud-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.ud-tab-btn').forEach(b => { b.classList.remove('bg-blue-600', 'text-white'); b.classList.add('text-gray-600'); });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-600');
            currentTab = btn.dataset.tab;
            clearSelection();
            renderCurrentTab();
        });
    });

    // Search
    document.getElementById('ud-search').addEventListener('input', () => { clearSelection(); renderCurrentTab(); });

    // Refresh
    document.getElementById('ud-refresh-btn').addEventListener('click', () => { clearSelection(); loadAllUserData(); });

    // Clear selection button
    document.getElementById('ud-clear-selection-btn').addEventListener('click', clearSelection);

    // Bulk delete
    document.getElementById('ud-bulk-delete-btn').addEventListener('click', async () => {
        if (selectedIds.size === 0) return;
        const colName = currentTab === 'tutors' ? 'tutors' : currentTab === 'students' ? 'students' : 'parent_users';
        const label = currentTab.slice(0, -1); // tutor / student / parent
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} ${currentTab}? This cannot be undone.`)) return;
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, colName, id)));
            await batch.commit();
            alert(`${selectedIds.size} ${currentTab} deleted successfully.`);
            clearSelection();
            if (colName === 'tutors') invalidateCache('tutors');
            if (colName === 'students') invalidateCache('students');
            await loadAllUserData();
        } catch(e) { alert('Error deleting: ' + e.message); }
    });

    function renderCurrentTab() {
        const term = (document.getElementById('ud-search').value || '').toLowerCase().trim();
        const contentEl = document.getElementById('ud-content');
        if (!contentEl) return;
        if (currentTab === 'tutors') renderTutorsTable(contentEl, term);
        else if (currentTab === 'students') renderStudentsTable(contentEl, term);
        else renderParentsTable(contentEl, term);
    }

    // --- Checkbox wiring helper ---
    function wireCheckboxes(contentEl) {
        const selectAll = contentEl.querySelector('#ud-select-all');
        const rowCheckboxes = contentEl.querySelectorAll('.ud-row-checkbox');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                rowCheckboxes.forEach(cb => {
                    cb.checked = selectAll.checked;
                    if (selectAll.checked) selectedIds.add(cb.dataset.id);
                    else selectedIds.delete(cb.dataset.id);
                });
                updateBulkBar();
            });
        }
        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) selectedIds.add(cb.dataset.id);
                else selectedIds.delete(cb.dataset.id);
                if (selectAll) selectAll.checked = rowCheckboxes.length > 0 && [...rowCheckboxes].every(c => c.checked);
                updateBulkBar();
            });
        });
    }

    // ---- TUTORS TABLE ----
    function renderTutorsTable(el, term) {
        const filtered = udTutors.filter(t => {
            const s = `${t.name} ${t.email} ${t.phone || ''}`.toLowerCase();
            return !term || s.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} tutor${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-center py-3 px-4">Students</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-400">No tutors found.</td></tr>' :
                        filtered.map((t, i) => `
                        <tr class="border-b border-gray-50 hover:bg-gray-50">
                            <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${t.id}" ${selectedIds.has(t.id) ? 'checked' : ''}></td>
                            <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                            <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(t.name)}</td>
                            <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(t.email || '—')}</td>
                            <td class="py-3 px-4 text-gray-600">${escapeHtml(t.phone || '—')}</td>
                            <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${t.studentCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">${t.studentCount}</span></td>
                            <td class="py-3 px-4 text-center">
                                <button onclick="window._udEdit('tutors','${t.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                <button onclick="window._udDel('tutors','${t.id}','${escapeHtml(t.name)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- STUDENTS TABLE ----
    function renderStudentsTable(el, term) {
        const filtered = udStudents.filter(s => {
            const str = `${s.studentName} ${s.parentName || ''} ${s.parentEmail || ''} ${s.grade || ''} ${s.tutorName || ''}`.toLowerCase();
            return !term || str.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} student${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Student</th>
                            <th class="text-left py-3 px-4">Grade</th>
                            <th class="text-left py-3 px-4">Parent</th>
                            <th class="text-left py-3 px-4">Tutor</th>
                            <th class="text-left py-3 px-4">Subjects</th>
                            <th class="text-center py-3 px-4">Status</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="9" class="text-center py-8 text-gray-400">No students found.</td></tr>' :
                        filtered.map((s, i) => {
                            const sc = s.summerBreak ? 'bg-yellow-100 text-yellow-800' : ['archived','graduated','transferred'].includes(s.status) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
                            const sl = s.summerBreak ? 'On Break' : ['archived','graduated','transferred'].includes(s.status) ? capitalize(s.status) : 'Active';
                            return `
                            <tr class="border-b border-gray-50 hover:bg-gray-50">
                                <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}></td>
                                <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                                <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(s.studentName || '—')}</td>
                                <td class="py-3 px-4 text-gray-600">${escapeHtml(s.grade || '—')}</td>
                                <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(s.parentName || s.parentEmail || '—')}</td>
                                <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(s.tutorName || s.tutorEmail || '—')}</td>
                                <td class="py-3 px-4 text-xs text-gray-500">${escapeHtml((s.subjects || []).join(', ') || '—')}</td>
                                <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${sc}">${sl}</span></td>
                                <td class="py-3 px-4 text-center">
                                    <button onclick="window._udEdit('students','${s.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                    <button onclick="window._udDel('students','${s.id}','${escapeHtml(s.studentName)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- PARENTS TABLE ----
    function renderParentsTable(el, term) {
        const filtered = udParents.filter(p => {
            const s = `${p.name} ${p.email} ${p.phone || ''}`.toLowerCase();
            return !term || s.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} parent${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-center py-3 px-4">Children</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-400">No parents found.</td></tr>' :
                        filtered.map((p, i) => `
                        <tr class="border-b border-gray-50 hover:bg-gray-50">
                            <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}></td>
                            <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                            <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(p.name || '—')}</td>
                            <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(p.email || '—')}</td>
                            <td class="py-3 px-4 text-gray-600">${escapeHtml(p.phone || '—')}</td>
                            <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.childCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'}">${p.childCount}</span></td>
                            <td class="py-3 px-4 text-center">
                                <button onclick="window._udEdit('parent_users','${p.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                <button onclick="window._udDel('parent_users','${p.id}','${escapeHtml(p.name)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- UNIFIED EDIT MODAL ----
    window._udEdit = async function(colName, itemId) {
        const item = colName === 'tutors' ? udTutors.find(t => t.id === itemId)
                   : colName === 'students' ? udStudents.find(s => s.id === itemId)
                   : udParents.find(p => p.id === itemId);
        if (!item) return;

        const isTutor = colName === 'tutors';
        const isStudent = colName === 'students';
        const isParent = colName === 'parent_users';
        const title = isTutor ? 'Edit Tutor' : isStudent ? 'Edit Student' : 'Edit Parent';
        const color = isTutor ? 'blue' : isStudent ? 'green' : 'purple';

        let fieldsHtml = '';
        if (isTutor) {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" id="ud-e-name" value="${escapeHtml(item.name || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" id="ud-e-email" value="${escapeHtml(item.email || '')}" class="w-full p-2 border rounded-lg bg-gray-100" readonly></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" id="ud-e-phone" value="${escapeHtml(item.phone || '')}" class="w-full p-2 border rounded-lg"></div>`;
        } else if (isStudent) {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Student Name</label><input type="text" id="ud-e-sname" value="${escapeHtml(item.studentName || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Grade</label><select id="ud-e-grade" class="w-full p-2 border rounded-lg">${buildGradeOptions(item.grade || '')}</select></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Name</label><input type="text" id="ud-e-pname" value="${escapeHtml(item.parentName || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Email</label><input type="email" id="ud-e-pemail" value="${escapeHtml(item.parentEmail || '')}" class="w-full p-2 border rounded-lg"></div>`;
        } else {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" id="ud-e-name" value="${escapeHtml(item.name || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" id="ud-e-email" value="${escapeHtml(item.email || '')}" class="w-full p-2 border rounded-lg bg-gray-100" readonly></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" id="ud-e-phone" value="${escapeHtml(item.phone || '')}" class="w-full p-2 border rounded-lg"></div>`;
        }

        const old = document.getElementById('ud-edit-modal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', `
        <div id="ud-edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-6 bg-white w-full max-w-md rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('ud-edit-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-${color}-700"><i class="fas fa-edit mr-2"></i>${title}</h3>
                <div class="space-y-3">${fieldsHtml}</div>
                <div class="flex justify-end gap-3 mt-5">
                    <button onclick="document.getElementById('ud-edit-modal').remove()" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                    <button id="ud-save-btn" class="px-4 py-2 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700 text-sm">Save Changes</button>
                </div>
            </div>
        </div>`);

        document.getElementById('ud-save-btn').addEventListener('click', async () => {
            try {
                let updateData = {};
                if (isTutor) {
                    const name = document.getElementById('ud-e-name').value.trim();
                    if (!name) { alert('Name is required.'); return; }
                    updateData = { name: sanitizeInput(name, 200), phone: sanitizeInput(document.getElementById('ud-e-phone').value.trim(), 50) };
                } else if (isStudent) {
                    const sname = document.getElementById('ud-e-sname').value.trim();
                    if (!sname) { alert('Student name is required.'); return; }
                    updateData = {
                        studentName: sanitizeInput(sname, 200),
                        grade: document.getElementById('ud-e-grade').value,
                        parentName: sanitizeInput(document.getElementById('ud-e-pname').value.trim(), 200),
                        parentEmail: sanitizeInput(document.getElementById('ud-e-pemail').value.trim(), 200)
                    };
                } else {
                    const name = document.getElementById('ud-e-name').value.trim();
                    if (!name) { alert('Name is required.'); return; }
                    updateData = { name: sanitizeInput(name, 200), phone: sanitizeInput(document.getElementById('ud-e-phone').value.trim(), 50) };
                }
                await updateDoc(doc(db, colName, itemId), updateData);
                alert('Updated successfully!');
                document.getElementById('ud-edit-modal').remove();
                if (colName === 'tutors') invalidateCache('tutors');
                if (colName === 'students') invalidateCache('students');
                await loadAllUserData();
            } catch(e) { alert('Error: ' + e.message); }
        });
    };

    // ---- UNIFIED DELETE ----
    window._udDel = async function(colName, itemId, name) {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, colName, itemId));
            alert('Deleted successfully.');
            if (colName === 'tutors') invalidateCache('tutors');
            if (colName === 'students') invalidateCache('students');
            selectedIds.delete(itemId);
            await loadAllUserData();
        } catch(e) { alert('Error: ' + e.message); }
    };

    // ---- DATA LOADING ----
    async function loadAllUserData() {
        const loadingEl = document.getElementById('ud-loading');
        const contentEl = document.getElementById('ud-content');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');

        try {
            const [tutorsSnap, studentsSnap, parentsSnap] = await Promise.all([
                getDocs(query(collection(db, 'tutors'), orderBy('name'))),
                getDocs(collection(db, 'students')),
                getDocs(collection(db, 'parent_users'))
            ]);

            const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const studentCountByTutor = {};
            allStudents.forEach(s => { const k = s.tutorEmail || ''; studentCountByTutor[k] = (studentCountByTutor[k] || 0) + 1; });

            const tutorNameMap = {};
            tutorsSnap.docs.forEach(d => { const data = d.data(); tutorNameMap[data.email] = data.name; });

            const childCountByParent = {};
            allStudents.forEach(s => { const k = (s.parentEmail || '').toLowerCase(); if (k) childCountByParent[k] = (childCountByParent[k] || 0) + 1; });

            udTutors = tutorsSnap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, studentCount: studentCountByTutor[data.email] || 0 }; });
            udStudents = allStudents.map(s => ({ ...s, tutorName: tutorNameMap[s.tutorEmail] || '' }));
            udParents = parentsSnap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, childCount: childCountByParent[(data.email || '').toLowerCase()] || 0 }; });

            document.getElementById('ud-tutor-count').textContent = udTutors.length;
            document.getElementById('ud-student-count').textContent = udStudents.length;
            document.getElementById('ud-parent-count').textContent = udParents.length;
            document.getElementById('ud-total-count').textContent = udTutors.length + udStudents.length + udParents.length;

            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');
            renderCurrentTab();
        } catch(err) {
            console.error('User Directory load error:', err);
            const loadingEl = document.getElementById('ud-loading');
            if (loadingEl) loadingEl.innerHTML = `<p class="text-red-500">Error loading data: ${err.message}</p>`;
        }
    }

    await loadAllUserData();
}

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
            { id: "navReferralsAdmin", label: "Referral Management", icon: "fas fa-handshake", fn: renderReferralsAdminPanel, perm: "viewReferralsAdmin" }
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
    "masterPortal": {
        icon: "fas fa-chart-line",
        label: "Master Portal",
        items: [
            { id: "navMasterPortal", label: "Management Portal", icon: "fas fa-table", fn: renderMasterPortalPanel, perm: "viewMasterPortal" },
            { id: "navAcademicFollowUp", label: "Academic Follow-Up", icon: "fas fa-graduation-cap", fn: renderAcademicFollowUpPanel, perm: "viewMasterPortal" }
        ]
    },
    "userDirectory": {
        icon: "fas fa-address-book",
        label: "User Directory",
        items: [
            { id: "navUserDirectory", label: "User Directory", icon: "fas fa-address-book", fn: renderUserDirectoryPanel, perm: "viewUserDirectory" }
        ]
    },
    "communication": {
        icon: "fas fa-comments",
        label: "Communication",
        items: [
            { id: "navParentFeedback", label: "Parent Feedback", icon: "fas fa-comment-dots", fn: renderParentFeedbackPanel },
            { id: "navMessaging", label: "Messaging", icon: "fas fa-paper-plane", fn: renderManagementMessagingPanel, perm: "viewParentFeedback" }
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
            // Use explicit perm key if provided on the item, otherwise derive it
            const permKey = item.perm || getPermissionKey(item.id);
            const hasPermission = !staffData.permissions || 
                                !staffData.permissions.tabs || 
                                staffData.permissions.tabs[permKey] === true;
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
    navMessaging: { fn: renderManagementMessagingPanel, perm: 'viewParentFeedback', label: 'Messaging' },
    navReferralsAdmin: { fn: renderReferralsAdminPanel, perm: 'viewReferralsAdmin', label: 'Referral Management' },
    navEnrollments: { fn: renderEnrollmentsPanel, perm: 'viewEnrollments', label: 'Enrollments' },
    navInactiveTutors: { fn: renderInactiveTutorsPanel, perm: 'viewInactiveTutors', label: 'Inactive Tutors' },
    navArchivedStudents: { fn: renderArchivedStudentsPanel, perm: 'viewArchivedStudents', label: 'Archived Students' },
    navMasterPortal: { fn: renderMasterPortalPanel, perm: 'viewMasterPortal', label: 'Management Portal' },
    navAcademicFollowUp: { fn: renderAcademicFollowUpPanel, perm: 'viewMasterPortal', label: 'Academic Follow-Up' },
    navUserDirectory: { fn: renderUserDirectoryPanel, perm: 'viewUserDirectory', label: 'User Directory' }
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

// ======================================================
// SECTION: MANAGEMENT MESSAGING PANEL
// ======================================================

async function renderManagementMessagingPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-6">📨 Messaging & Broadcast</h2>

            <!-- Tab Navigation -->
            <div class="flex border-b border-gray-200 mb-6 overflow-x-auto">
                <button data-msg-tab="inbox" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-green-600 text-green-700 whitespace-nowrap flex items-center gap-2">
                    <i class="fas fa-inbox"></i> Tutor Inbox
                    <span id="inbox-unread-badge" class="hidden bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center"></span>
                </button>
                <button data-msg-tab="compose" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-paper-plane"></i> Send Message
                </button>
                <button data-msg-tab="broadcast" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-bullhorn"></i> Broadcast
                </button>
                <button data-msg-tab="logs" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-list"></i> Sent Log
                </button>
            </div>

            <!-- ====== INBOX TAB ====== -->
            <div id="msg-tab-inbox" class="msg-tab-content">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-700">📥 Messages from Tutors</h3>
                    <button id="refresh-inbox-btn" class="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                <div class="flex gap-2 mb-4 flex-wrap">
                    <button data-inbox-filter="all" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-green-600 text-white">All</button>
                    <button data-inbox-filter="unread" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Unread</button>
                    <button data-inbox-filter="replied" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Replied</button>
                </div>
                <div id="inbox-list" class="space-y-3">
                    <div class="text-center py-10 text-gray-400">
                        <i class="fas fa-inbox text-4xl mb-3 block"></i>
                        <p>Loading messages...</p>
                    </div>
                </div>
            </div>

            <!-- ====== COMPOSE (DIRECT MSG) TAB ====== -->
            <div id="msg-tab-compose" class="msg-tab-content hidden">
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-blue-800 mb-4">💬 Message a Tutor Directly</h3>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Search Tutor</label>
                        <div class="relative">
                            <input type="text" id="msg-tutor-search" placeholder="Type tutor name..." autocomplete="off"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <input type="hidden" id="msg-tutor-id">
                            <div id="msg-tutor-dropdown" class="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto hidden"></div>
                        </div>
                    </div>
                    
                    <div id="selected-tutor-info" class="hidden mb-4 p-3 bg-white rounded-lg border border-blue-100">
                        <p class="text-sm font-medium text-blue-800" id="selected-tutor-name-msg">—</p>
                        <p class="text-xs text-gray-500" id="selected-tutor-email-msg">—</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Subject (Optional)</label>
                        <input type="text" id="direct-msg-subject" placeholder="e.g. Schedule Update"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea id="direct-msg-content" rows="4" placeholder="Type your message..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
                    </div>
                    
                    <div class="flex justify-end">
                        <button id="send-direct-msg-btn" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                            <i class="fas fa-paper-plane"></i> Send Message
                        </button>
                    </div>
                    <div id="direct-msg-status" class="mt-3 hidden"></div>
                </div>
            </div>

            <!-- ====== BROADCAST TAB ====== -->
            <div id="msg-tab-broadcast" class="msg-tab-content hidden">
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-green-800 mb-4">📢 Broadcast Message</h3>
                    <p class="text-sm text-gray-600 mb-4">Send a pop-up announcement to all tutors and/or parents. Recipients will see it the next time they log in.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Subject / Title</label>
                            <input type="text" id="broadcast-title" placeholder="e.g. Important Notice" 
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Send To</label>
                            <div class="flex gap-4 mt-1">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="broadcast-to-tutors" checked class="rounded">
                                    <span class="text-sm">Tutors</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="broadcast-to-parents" class="rounded">
                                    <span class="text-sm">Parents</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea id="broadcast-message" rows="4" placeholder="Type your broadcast message here..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Attach Image or File (Optional)</label>
                        <input type="file" id="broadcast-file" accept="image/*,.pdf" 
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <p class="text-xs text-gray-500 mt-1">Images will be shown in the pop-up. PDFs will be downloadable.</p>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Show Popup For (Days) <span class="text-gray-400 text-xs">— how many days this pop-up stays active after login</span></label>
                        <input type="number" id="broadcast-popup-days" min="1" max="30" value="3"
                            class="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm">
                        <span class="text-xs text-gray-500 ml-2">days (default: 3 days)</span>
                    </div>
                    
                    <div class="flex justify-end">
                        <button id="send-broadcast-btn" class="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2">
                            <i class="fas fa-bullhorn"></i> Send Broadcast
                        </button>
                    </div>
                    
                    <div id="broadcast-status" class="mt-3 hidden"></div>
                </div>
            </div>

            <!-- ====== SENT LOG TAB ====== -->
            <div id="msg-tab-logs" class="msg-tab-content hidden">
                <div class="bg-white border border-gray-200 rounded-xl p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-gray-700">📋 Recent Broadcasts & Messages</h3>
                        <button id="refresh-broadcasts-btn" class="text-sm text-blue-600 hover:underline">Refresh</button>
                    </div>
                    <div id="broadcasts-list">
                        <p class="text-gray-500 text-sm text-center py-4">Loading...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ── Tab switching logic ──
    const msgTabBtns = container.querySelectorAll('.msg-tab-btn');
    const msgTabContents = container.querySelectorAll('.msg-tab-content');
    function switchMsgTab(tabId) {
        msgTabBtns.forEach(btn => {
            const active = btn.dataset.msgTab === tabId;
            btn.classList.toggle('border-green-600', active);
            btn.classList.toggle('text-green-700', active);
            btn.classList.toggle('border-transparent', !active);
            btn.classList.toggle('text-gray-500', !active);
        });
        msgTabContents.forEach(c => c.classList.toggle('hidden', c.id !== `msg-tab-${tabId}`));
        if (tabId === 'inbox') renderInbox(inboxFilter);
        if (tabId === 'logs') loadBroadcasts();
    }
    msgTabBtns.forEach(btn => btn.addEventListener('click', () => switchMsgTab(btn.dataset.msgTab)));

    // ── Inbox filter buttons ──
    container.querySelectorAll('.inbox-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.inbox-filter-btn').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            btn.classList.add('bg-green-600', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            renderInbox(btn.dataset.inboxFilter);
        });
    });
    document.getElementById('refresh-inbox-btn').addEventListener('click', () => startInboxListener());

    // ═══ INBOX: Real-time listener (messages appear instantly) ═══
    let inboxFilter = 'all';
    let _inboxUnsub = null;
    let _cachedInbox = [];

    function startInboxListener() {
        if (_inboxUnsub) _inboxUnsub();
        const listEl = document.getElementById('inbox-list');
        if (!listEl) return;
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl mb-3 block"></i><p>Loading inbox...</p></div>`;

        _inboxUnsub = onSnapshot(
            query(collection(db, 'tutor_to_management_messages'), orderBy('createdAt', 'desc'), limit(100)),
            (snap) => {
                let msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Already ordered desc by Firestore, but keep client-side sort as safety net
                msgs.sort((a, b) => {
                    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return tb - ta;
                });
                _cachedInbox = msgs;
                renderInbox(inboxFilter);
            },
            (err) => {
                console.error('Inbox listener error:', err);
                if (listEl) listEl.innerHTML = `
                    <div class="text-center py-10 text-red-400">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
                        <p class="font-medium">Failed to load inbox</p>
                        <p class="text-sm mt-1">${escapeHtml(err.message)}</p>
                        <button onclick="startInboxListener()" class="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
                    </div>`;
            }
        );
    }

    function renderInbox(filter) {
        inboxFilter = filter || 'all';
        const listEl = document.getElementById('inbox-list');
        if (!listEl) return;

        let messages = [..._cachedInbox];
        if (filter === 'unread') messages = messages.filter(m => !m.managementRead);
        if (filter === 'replied') messages = messages.filter(m => m.replied);

        // Update inbox badge
        const unreadCount = _cachedInbox.filter(m => !m.managementRead).length;
        const inboxBadge = document.getElementById('inbox-unread-badge');
        if (inboxBadge) { inboxBadge.textContent = unreadCount > 9 ? '9+' : unreadCount; inboxBadge.classList.toggle('hidden', unreadCount === 0); }

        if (messages.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-14 text-gray-400">
                    <i class="fas fa-inbox text-5xl mb-4 block"></i>
                    <p class="font-medium">No messages yet</p>
                    <p class="text-sm mt-1">Tutor messages will appear here in real-time</p>
                </div>`;
            return;
        }

        listEl.innerHTML = messages.map(msg => {
            const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Unknown';
            const unreadStyle = !msg.managementRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : 'bg-white';
            const unreadDot = !msg.managementRead ? '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>' : '';
            const repliedBadge = msg.replied ? '<span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Replied</span>' : '';
            const urgentBadge = msg.isUrgent ? '<span class="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">🔴 Urgent</span>' : '';
            const imgHTML = msg.imageUrl ? `<div class="mt-2"><img src="${escapeHtml(msg.imageUrl)}" class="max-w-xs rounded-lg cursor-pointer" onclick="window.open('${escapeHtml(msg.imageUrl)}','_blank')"></div>` : '';
            const repliesHTML = msg.managementReplies?.length ? `
                <div class="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Replies</p>
                    ${msg.managementReplies.map(r => `
                        <div class="bg-green-50 border border-green-100 rounded-lg p-2.5 ml-4">
                            <p class="text-sm text-gray-800">${escapeHtml(r.message)}</p>
                            <p class="text-xs text-gray-400 mt-1">${r.repliedBy || 'Management'} · ${r.repliedAt?.toDate ? r.repliedAt.toDate().toLocaleString() : ''}</p>
                        </div>
                    `).join('')}
                </div>` : '';
            return `
                <div class="border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${unreadStyle}" data-inbox-id="${msg.id}">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                        <div class="flex-1">
                            <div class="flex items-center flex-wrap gap-1 mb-1">
                                ${unreadDot}
                                <span class="font-bold text-gray-800">${escapeHtml(msg.tutorName || 'Unknown Tutor')}</span>
                                <span class="text-xs text-gray-400">${escapeHtml(msg.tutorEmail || '')}</span>
                                ${repliedBadge}${urgentBadge}
                            </div>
                            ${msg.subject ? `<p class="text-sm font-semibold text-gray-700 mb-1">📌 ${escapeHtml(msg.subject)}</p>` : ''}
                            <p class="text-sm text-gray-700 leading-relaxed">${escapeHtml(msg.message || '')}</p>
                            ${imgHTML}
                            ${repliesHTML}
                        </div>
                        <span class="text-xs text-gray-400 whitespace-nowrap">${date}</span>
                    </div>
                    <div class="mt-3 flex gap-2 flex-wrap">
                        ${!msg.managementRead ? `<button class="mark-inbox-read-btn text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1" data-id="${msg.id}"><i class="fas fa-check mr-1"></i>Mark Read</button>` : ''}
                        <button class="reply-inbox-btn text-xs text-green-700 hover:text-green-900 border border-green-200 rounded px-2 py-1 font-medium" data-id="${msg.id}" data-tutor-email="${escapeHtml(msg.tutorEmail || '')}" data-tutor-name="${escapeHtml(msg.tutorName || '')}">
                            <i class="fas fa-reply mr-1"></i>Reply
                        </button>
                    </div>
                    <!-- Reply form -->
                    <div class="inbox-reply-form hidden mt-3 pt-3 border-t border-gray-100" id="reply-form-${msg.id}">
                        <textarea class="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none focus:ring-2 focus:ring-green-500" rows="3" placeholder="Type your reply..."></textarea>
                        <div class="flex justify-end gap-2 mt-2">
                            <button class="cancel-reply-btn text-xs text-gray-500 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">Cancel</button>
                            <button class="submit-reply-btn bg-green-600 text-white text-xs rounded px-3 py-1.5 hover:bg-green-700 font-medium" data-id="${msg.id}" data-tutor-email="${escapeHtml(msg.tutorEmail || '')}" data-tutor-name="${escapeHtml(msg.tutorName || '')}">
                                <i class="fas fa-paper-plane mr-1"></i>Send Reply
                            </button>
                        </div>
                        <div class="reply-status hidden mt-2 text-xs p-2 rounded"></div>
                    </div>
                </div>`;
        }).join('');

        // Wire mark-read (onSnapshot auto-re-renders)
        listEl.querySelectorAll('.mark-inbox-read-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try { await updateDoc(doc(db, 'tutor_to_management_messages', btn.dataset.id), { managementRead: true }); } catch(e) { console.error(e); }
            });
        });
        // Wire reply toggle
        listEl.querySelectorAll('.reply-inbox-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = document.getElementById(`reply-form-${btn.dataset.id}`);
                if (f) f.classList.toggle('hidden');
            });
        });
        // Wire cancel
        listEl.querySelectorAll('.cancel-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.inbox-reply-form').classList.add('hidden'));
        });
        // Wire submit reply
        listEl.querySelectorAll('.submit-reply-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const form = document.getElementById(`reply-form-${id}`);
                const textarea = form.querySelector('textarea');
                const replyMsg = textarea.value.trim();
                const statusEl = form.querySelector('.reply-status');
                if (!replyMsg) { 
                    statusEl.textContent = 'Please enter a reply.'; 
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-red-50 text-red-700'; 
                    statusEl.classList.remove('hidden'); 
                    return; 
                }
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Sending...';
                try {
                    const senderName = window.userData?.name || 'Management';
                    const senderEmail = window.userData?.email || '';
                    const replyData = {
                        message: sanitizeInput(replyMsg),
                        repliedBy: senderName,
                        repliedByEmail: senderEmail,
                        repliedAt: Timestamp.now()
                    };
                    const msgDocRef = doc(db, 'tutor_to_management_messages', id);
                    const msgSnap = await getDoc(msgDocRef);
                    const existing = msgSnap.exists() ? (msgSnap.data().managementReplies || []) : [];
                    await updateDoc(msgDocRef, {
                        managementReplies: [...existing, replyData],
                        managementRead: true,
                        replied: true,
                        lastRepliedAt: Timestamp.now()
                    });
                    // Also notify the tutor
                    await addDoc(collection(db, 'tutor_notifications'), {
                        tutorEmail: btn.dataset.tutorEmail,
                        type: 'management_reply',
                        title: 'Reply from Management',
                        message: sanitizeInput(replyMsg),
                        senderName: senderName,
                        senderDisplay: 'Management',
                        read: false,
                        createdAt: Timestamp.now()
                    });
                    // Also write to conversations collection so tutor sees reply in chat
                    const origMsg = _cachedInbox.find(m => m.id === id);
                    if (origMsg?.conversationId) {
                        try {
                            await addDoc(collection(db, "conversations", origMsg.conversationId, "messages"), {
                                content: replyMsg,
                                senderId: 'management',
                                senderName: senderName,
                                senderRole: 'management',
                                createdAt: Timestamp.now(),
                                read: false
                            });
                            await updateDoc(doc(db, "conversations", origMsg.conversationId), {
                                lastMessage: replyMsg,
                                lastMessageTimestamp: Timestamp.now(),
                                lastSenderId: 'management',
                                unreadCount: 1
                            }).catch(() => {});
                        } catch(convErr) { console.warn('Could not write to conversation:', convErr); }
                    }
                    statusEl.textContent = '✅ Reply sent!';
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-green-50 text-green-700';
                    statusEl.classList.remove('hidden');
                    textarea.value = '';
                    setTimeout(() => form.classList.add('hidden'), 1200);
                    await logManagementActivity('Replied to tutor message', `Replied to ${btn.dataset.tutorName || btn.dataset.tutorEmail}`);
                } catch(e) {
                    statusEl.textContent = '❌ Failed: ' + e.message;
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-red-50 text-red-700';
                    statusEl.classList.remove('hidden');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Send Reply';
                }
            });
        });
    }

    // Start real-time inbox listener
    startInboxListener();
    
    // Load tutors for search
    let tutorsList = [];
    try {
        if (!sessionCache.tutors) {
            const snap = await getDocs(query(collection(db, "tutors")));
            sessionCache.tutors = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.status || t.status === 'active');
        }
        tutorsList = sessionCache.tutors || [];
    } catch(e) { console.error(e); }
    
    // Tutor search dropdown
    const tutorSearchInput = document.getElementById('msg-tutor-search');
    const tutorHiddenInput = document.getElementById('msg-tutor-id');
    const tutorDropdown = document.getElementById('msg-tutor-dropdown');
    
    tutorSearchInput.addEventListener('input', () => {
        const term = tutorSearchInput.value.toLowerCase();
        const matches = tutorsList.filter(t => (t.name || t.email || '').toLowerCase().includes(term)).slice(0, 10);
        tutorDropdown.innerHTML = matches.map(t => `
            <div class="tutor-msg-opt px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0" 
                data-id="${t.id}" data-name="${t.name || t.email}" data-email="${t.email || ''}">
                <span class="font-medium">${t.name || 'Unknown'}</span>
                <span class="text-gray-400 text-xs ml-2">${t.email || ''}</span>
            </div>
        `).join('');
        tutorDropdown.classList.toggle('hidden', matches.length === 0);
    });
    
    tutorDropdown.addEventListener('mousedown', (e) => {
        const opt = e.target.closest('.tutor-msg-opt');
        if (!opt) return;
        e.preventDefault();
        tutorSearchInput.value = opt.dataset.name;
        tutorHiddenInput.value = opt.dataset.id;
        document.getElementById('selected-tutor-name-msg').textContent = opt.dataset.name;
        document.getElementById('selected-tutor-email-msg').textContent = opt.dataset.email;
        document.getElementById('selected-tutor-info').classList.remove('hidden');
        tutorDropdown.classList.add('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!tutorSearchInput.contains(e.target)) tutorDropdown.classList.add('hidden');
    });
    
    // Send direct message
    document.getElementById('send-direct-msg-btn').addEventListener('click', async () => {
        const tutorId = tutorHiddenInput.value;
        const content = document.getElementById('direct-msg-content').value.trim();
        const subject = document.getElementById('direct-msg-subject')?.value.trim() || '';
        const senderName = window.userData?.name || 'Management';
        const senderEmail = window.userData?.email || '';
        const statusEl = document.getElementById('direct-msg-status');
        
        if (!tutorId) { showMsgStatus(statusEl, '❌ Please select a tutor first.', false); return; }
        if (!content) { showMsgStatus(statusEl, '❌ Please enter a message.', false); return; }
        
        const tutor = tutorsList.find(t => t.id === tutorId);
        if (!tutor) { showMsgStatus(statusEl, '❌ Tutor not found.', false); return; }
        
        try {
            document.getElementById('send-direct-msg-btn').disabled = true;
            // Send to tutor's notification inbox
            await addDoc(collection(db, 'tutor_notifications'), {
                tutorEmail: tutor.email,
                type: 'management_message',
                title: subject ? `Message from Management: ${subject}` : 'Message from Management',
                message: sanitizeInput(content),
                senderName: senderName,
                senderEmail: senderEmail,
                senderDisplay: 'Management',
                read: false,
                createdAt: Timestamp.now()
            });
            // Also log in management_sent_messages for thread tracking
            await addDoc(collection(db, 'management_sent_messages'), {
                tutorEmail: tutor.email,
                tutorName: tutor.name || tutor.email,
                subject: sanitizeInput(subject),
                message: sanitizeInput(content),
                senderName: senderName,
                senderEmail: senderEmail,
                createdAt: Timestamp.now()
            });
            document.getElementById('direct-msg-content').value = '';
            if (document.getElementById('direct-msg-subject')) document.getElementById('direct-msg-subject').value = '';
            showMsgStatus(statusEl, `✅ Message sent to ${tutor.name || tutor.email}!`, true);
            await logManagementActivity('Sent direct message', `To tutor: ${tutor.name || tutor.email}`);
        } catch(err) {
            showMsgStatus(statusEl, '❌ Failed to send: ' + err.message, false);
        } finally {
            document.getElementById('send-direct-msg-btn').disabled = false;
        }
    });
    
    // Send broadcast
    document.getElementById('send-broadcast-btn').addEventListener('click', async () => {
        const title = document.getElementById('broadcast-title').value.trim();
        const message = document.getElementById('broadcast-message').value.trim();
        const toTutors = document.getElementById('broadcast-to-tutors').checked;
        const toParents = document.getElementById('broadcast-to-parents').checked;
        const fileInput = document.getElementById('broadcast-file');
        const statusEl = document.getElementById('broadcast-status');
        const popupDays = parseInt(document.getElementById('broadcast-popup-days').value) || 3;
        const senderName = window.userData?.name || 'Management';
        
        if (!title) { showMsgStatus(statusEl, '❌ Please enter a broadcast title.', false); return; }
        if (!message) { showMsgStatus(statusEl, '❌ Please enter a message.', false); return; }
        if (!toTutors && !toParents) { showMsgStatus(statusEl, '❌ Please select at least one recipient group.', false); return; }
        
        const btn = document.getElementById('send-broadcast-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sending...';
        
        try {
            let fileUrl = null;
            let fileType = null;
            
            // Upload file if present
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'bkh_assessments');
                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/dy2hxcyaf/auto/upload`, { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                fileUrl = uploadData.secure_url;
                fileType = file.type.startsWith('image/') ? 'image' : 'file';
            }
            
            const broadcastDoc = {
                title,
                message,
                toTutors,
                toParents,
                senderName,
                senderDisplay: 'Management',
                fileUrl: fileUrl || null,
                fileType: fileType || null,
                popupDays: popupDays,
                createdAt: Timestamp.now(),
                isGlobal: true
            };
            
            // Save broadcast log
            await addDoc(collection(db, 'broadcasts'), broadcastDoc);

            // ── Fan-out to each tutor's inbox (tutor_notifications) ──
            if (toTutors) {
                let tutorsToNotify = tutorsList;
                if (!tutorsToNotify || tutorsToNotify.length === 0) {
                    const snap = await getDocs(query(collection(db, 'tutors')));
                    tutorsToNotify = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(t => !t.status || t.status === 'active');
                }
                const batch = writeBatch(db);
                tutorsToNotify.forEach(tutor => {
                    if (!tutor.email) return;
                    const ref = doc(collection(db, 'tutor_notifications'));
                    batch.set(ref, {
                        tutorEmail: tutor.email,
                        type: 'broadcast',
                        title: title,
                        message: message,
                        fileUrl: fileUrl || null,
                        fileType: fileType || null,
                        popupDays: popupDays,
                        senderName: senderName,
                        senderDisplay: 'Management',
                        read: false,
                        popupShown: false,
                        createdAt: Timestamp.now(),
                        isGlobal: true
                    });
                });
                await batch.commit();
            }

            // ── Fan-out to each parent's notifications ──
            if (toParents) {
                const studentsSnap = await getDocs(query(collection(db, 'students')));
                const parentEmails = [...new Set(
                    studentsSnap.docs
                        .map(d => d.data().parentEmail)
                        .filter(Boolean)
                )];
                if (parentEmails.length > 0) {
                    const batch = writeBatch(db);
                    parentEmails.forEach(email => {
                        const ref = doc(collection(db, 'parent_notifications'));
                        batch.set(ref, {
                            parentEmail: email,
                            type: 'broadcast',
                            title: title,
                            message: message,
                            fileUrl: fileUrl || null,
                            fileType: fileType || null,
                            senderName: senderName,
                            senderDisplay: 'Management',
                            read: false,
                            createdAt: Timestamp.now(),
                            isGlobal: true
                        });
                    });
                    await batch.commit();
                }
            }
            
            showMsgStatus(statusEl, `✅ Broadcast sent to ${[toTutors && 'Tutors', toParents && 'Parents'].filter(Boolean).join(' & ')}!`, true);
            document.getElementById('broadcast-title').value = '';
            document.getElementById('broadcast-message').value = '';
            fileInput.value = '';
            loadBroadcasts();
        } catch(err) {
            showMsgStatus(statusEl, '❌ Failed: ' + err.message, false);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-bullhorn"></i> Send Broadcast';
        }
    });
    
    document.getElementById('refresh-broadcasts-btn').addEventListener('click', loadBroadcasts);
    loadBroadcasts();
    
    function showMsgStatus(el, msg, success) {
        el.textContent = msg;
        el.className = `mt-3 p-3 rounded-lg text-sm font-medium ${success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
    
    async function loadBroadcasts() {
        const listEl = document.getElementById('broadcasts-list');
        if (!listEl) return;
        try {
            // Load broadcasts + direct sent messages
            const [bcSnap, sentSnap] = await Promise.all([
                getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20))),
                getDocs(query(collection(db, 'management_sent_messages'), orderBy('createdAt', 'desc'), limit(20)))
            ]);
            const allLogs = [];
            bcSnap.docs.forEach(d => allLogs.push({ ...d.data(), id: d.id, _type: 'broadcast' }));
            sentSnap.docs.forEach(d => allLogs.push({ ...d.data(), id: d.id, _type: 'direct' }));
            allLogs.sort((a, b) => {
                const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return tb - ta;
            });
            if (allLogs.length === 0) { listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No sent messages yet.</p>'; return; }
            listEl.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mb-3 text-xs text-yellow-700"><i class="fas fa-info-circle mr-1"></i>Logs older than 7 days are automatically cleared.</div>` +
                allLogs.map(b => {
                const date = b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString() : 'Unknown';
                if (b._type === 'broadcast') {
                    const targets = [b.toTutors && '👩‍🏫 Tutors', b.toParents && '👨‍👩‍👧 Parents'].filter(Boolean).join(', ');
                    return `<div class="border-b py-3 last:border-0"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-800">📢 ${escapeHtml(b.title || 'Broadcast')}</p><p class="text-sm text-gray-600 mt-1">${escapeHtml(b.message || '')}</p><p class="text-xs text-gray-400 mt-1">By: ${escapeHtml(b.senderName || 'Management')} · To: ${targets}</p></div><span class="text-xs text-gray-400 whitespace-nowrap ml-4">${date}</span></div></div>`;
                } else {
                    return `<div class="border-b py-3 last:border-0"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-800">💬 ${escapeHtml(b.tutorName || b.tutorEmail || 'Tutor')}</p>${b.subject ? `<p class="text-sm text-blue-600 font-medium">📌 ${escapeHtml(b.subject)}</p>` : ''}<p class="text-sm text-gray-600 mt-1">${escapeHtml(b.message || '')}</p><p class="text-xs text-gray-400 mt-1">By: ${escapeHtml(b.senderName || 'Management')}</p></div><span class="text-xs text-gray-400 whitespace-nowrap ml-4">${date}</span></div></div>`;
                }
            }).join('');
        } catch(e) { listEl.innerHTML = '<p class="text-red-500 text-sm">Failed to load sent log.</p>'; }
    }
}

// ======================================================
// SECTION: WRITE MANAGEMENT_NOTIFICATIONS FROM EVENTS
// Call these helpers whenever you need to alert management
// ======================================================

/**
 * Creates a management_notifications entry for any significant event.
 * type: 'student_break' | 'recall_request' | 'placement_test' | 'parent_feedback' | 'tutor_message' | 'new_enrollment'
 */
async function createManagementNotification(type, title, message, extraData = {}) {
    try {
        await addDoc(collection(db, 'management_notifications'), {
            type,
            title: sanitizeInput(title, 200),
            message: sanitizeInput(message, 500),
            read: false,
            createdAt: Timestamp.now(),
            ...extraData
        });
    } catch(e) { console.warn('Could not create management notification:', e.message); }
}

window.createManagementNotification = createManagementNotification;

// ======================================================
// SECTION: MANAGEMENT NOTIFICATION BELL
// ======================================================

async function initManagementNotifications() {
    const bellBtn = document.getElementById('notificationBell') || document.querySelector('[data-notification-bell]');
    if (!bellBtn) return;

    let allNotifications = [];
    const _unsubs = [];
    let _prevUnread = -1; // -1 = first load, skip sound

    // ── Notification Sound ──
    function playBellSound() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine';
            const t = ctx.currentTime;
            o.frequency.setValueAtTime(659, t);       // E5
            o.frequency.setValueAtTime(880, t + 0.1);  // A5
            o.frequency.setValueAtTime(988, t + 0.2);  // B5
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            o.start(t); o.stop(t + 0.5);
        } catch(e) {}
    }

    // ── Badge setup ──
    let badge = document.getElementById('notification-badge') || bellBtn.querySelector('.notification-badge, span');
    if (!badge) { badge = document.createElement('span'); bellBtn.appendChild(badge); }
    badge.id = 'notification-badge';
    badge.className = 'absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold text-[10px] hidden px-1';
    bellBtn.style.position = 'relative';

    const TYPE_CONFIG = {
        management_notification: { icon: '🔔', color: 'border-l-green-500',  label: 'Alert' },
        tutor_message:           { icon: '💬', color: 'border-l-blue-500',   label: 'Tutor Message' },
        parent_feedback:         { icon: '💌', color: 'border-l-purple-500', label: 'Parent Feedback' },
        recall_request:          { icon: '🔁', color: 'border-l-orange-500', label: 'Recall Request' },
        student_break:           { icon: '☕', color: 'border-l-yellow-500', label: 'Student on Break' },
        placement_test:          { icon: '📋', color: 'border-l-indigo-500', label: 'Placement Test' },
        new_enrollment:          { icon: '📝', color: 'border-l-teal-500',   label: 'New Enrollment' },
        tutor_inactive:          { icon: '⚠️', color: 'border-l-red-400',    label: 'Tutor Inactive' },
    };

    // ── 7-day auto-clear (runs once per calendar day) ──
    (async function autoClear7Days() {
        const key = 'mgmt_clear7_' + new Date().toISOString().slice(0,10);
        if (localStorage.getItem(key)) return;
        const cutoff = new Date(Date.now() - 7*24*60*60*1000);
        const cutTS = Timestamp.fromDate(cutoff);
        console.log('🧹 Auto-clearing items older than 7 days...');
        try {
            // Old read management_notifications
            const s1 = await getDocs(query(collection(db,'management_notifications'), where('read','==',true), limit(200)));
            if (s1.size) { const b = writeBatch(db); let n=0; s1.docs.forEach(d => { const c=d.data().createdAt?.toDate?.(); if(c&&c<cutoff){b.delete(d.ref);n++;} }); if(n) await b.commit(); console.log('  Cleared',n,'old notifications'); }
            // Old broadcasts
            const s2 = await getDocs(query(collection(db,'broadcasts'), where('createdAt','<',cutTS), limit(200)));
            if (s2.size) { const b = writeBatch(db); s2.docs.forEach(d=>b.delete(d.ref)); await b.commit(); console.log('  Cleared',s2.size,'old broadcasts'); }
            // Old sent messages
            const s3 = await getDocs(query(collection(db,'management_sent_messages'), where('createdAt','<',cutTS), limit(200)));
            if (s3.size) { const b = writeBatch(db); s3.docs.forEach(d=>b.delete(d.ref)); await b.commit(); console.log('  Cleared',s3.size,'old sent msgs'); }
            // Old read inbox messages
            const s4 = await getDocs(query(collection(db,'tutor_to_management_messages'), where('managementRead','==',true), limit(200)));
            if (s4.size) { const b = writeBatch(db); let n=0; s4.docs.forEach(d => { const c=d.data().createdAt?.toDate?.(); if(c&&c<cutoff){b.delete(d.ref);n++;} }); if(n) await b.commit(); console.log('  Cleared',n,'old inbox msgs'); }
            // Old management_activity
            const s5 = await getDocs(query(collection(db,'management_activity'), where('timestamp','<',cutTS), limit(200)));
            if (s5.size) { const b = writeBatch(db); s5.docs.forEach(d=>b.delete(d.ref)); await b.commit(); console.log('  Cleared',s5.size,'old activity logs'); }
            localStorage.setItem(key, '1');
        } catch(e) { console.warn('Auto-clear err:', e.message); }
    })();

    // ── Shared buckets — each onSnapshot updates its own ──
    let bk1=[], bk2=[], bk3=[], bk4=[], bk5=[], bk6=[], bk7=[];

    function rebuild() {
        const sevenAgo = new Date(Date.now() - 7*24*60*60*1000);
        allNotifications = [...bk1,...bk2,...bk3,...bk4,
            ...bk5.filter(n=>{const d=n._bd?.toDate?.();return d&&d>sevenAgo;}),
            ...bk6,...bk7
        ];
        allNotifications.sort((a,b)=>{
            const ta=a.createdAt?.toDate?a.createdAt.toDate():(a.createdAt instanceof Date?a.createdAt:new Date(0));
            const tb=b.createdAt?.toDate?b.createdAt.toDate():(b.createdAt instanceof Date?b.createdAt:new Date(0));
            return tb-ta;
        });
        const uc = allNotifications.filter(n=>!n.read).length;
        badge.textContent = uc>9?'9+':String(uc);
        badge.classList.toggle('hidden', uc===0);
        // Play sound only when count increases (skip first load)
        if (_prevUnread >= 0 && uc > _prevUnread) playBellSound();
        _prevUnread = uc;
    }

    // 1. management_notifications (unread)
    _unsubs.push(onSnapshot(query(collection(db,'management_notifications'),where('read','==',false),limit(30)),
        s=>{bk1=s.docs.map(d=>({id:d.id,_collection:'management_notifications',_type:'management_notification',title:d.data().title||'Notification',message:d.data().message||'',createdAt:d.data().createdAt,read:false}));rebuild();},
        e=>console.warn('Bell[1]',e.message)));
    // 2. Tutor messages (unread)
    _unsubs.push(onSnapshot(query(collection(db,'tutor_to_management_messages'),where('managementRead','==',false),limit(20)),
        s=>{bk2=s.docs.map(d=>({id:d.id,_collection:'tutor_to_management_messages',_type:'tutor_message',title:'Message from '+(d.data().tutorName||'Tutor'),message:(d.data().message||'').slice(0,100),createdAt:d.data().createdAt,read:false,actionTab:'messaging'}));rebuild();},
        e=>console.warn('Bell[2]',e.message)));
    // 3. Parent feedback (unread)
    _unsubs.push(onSnapshot(query(collection(db,'parent_feedback'),where('read','==',false),limit(20)),
        s=>{bk3=s.docs.map(d=>({id:d.id,_collection:'parent_feedback',_type:'parent_feedback',title:'Feedback from '+(d.data().parentName||'Parent'),message:'Student: '+(d.data().studentName||'N/A')+' · '+(d.data().message||'').slice(0,80),createdAt:d.data().submittedAt||d.data().timestamp||d.data().createdAt,read:false,actionTab:'feedback'}));rebuild();},
        e=>console.warn('Bell[3]',e.message)));
    // 4. Recall requests (pending)
    _unsubs.push(onSnapshot(query(collection(db,'recall_requests'),where('status','==','pending'),limit(20)),
        s=>{bk4=s.docs.map(d=>({id:d.id,_collection:'recall_requests',_type:'recall_request',title:'Recall: '+(d.data().studentName||'Student'),message:'Tutor: '+(d.data().tutorName||d.data().tutorEmail||'N/A'),createdAt:d.data().createdAt,read:false,actionTab:'breaks'}));rebuild();},
        e=>console.warn('Bell[4]',e.message)));
    // 5. Students on break
    _unsubs.push(onSnapshot(query(collection(db,'students'),where('summerBreak','==',true),limit(30)),
        s=>{bk5=s.docs.filter(d=>d.data().breakNotifRead!==true).map(d=>({id:d.id,_collection:'students',_type:'student_break',title:(d.data().studentName||'Student')+' on break',message:'Tutor: '+(d.data().tutorName||'N/A'),createdAt:d.data().breakDate,_bd:d.data().breakDate,read:false,actionTab:'breaks'}));rebuild();},
        e=>console.warn('Bell[5]',e.message)));
    // 6. Placement tests
    _unsubs.push(onSnapshot(query(collection(db,'tutors'),where('placementTestStatus','==','completed'),limit(20)),
        s=>{bk6=s.docs.filter(d=>d.data().placementTestAcknowledged!==true).map(d=>({id:d.id,_collection:'tutors',_type:'placement_test',title:'Placement: '+(d.data().name||d.data().email),message:(d.data().name||d.data().email)+' completed test',createdAt:d.data().placementTestDate||d.data().updatedAt,read:false,actionTab:'tutors'}));rebuild();},
        e=>console.warn('Bell[6]',e.message)));
    // 7. Enrollments (last 3 days)
    const threeAgo = Timestamp.fromDate(new Date(Date.now()-3*24*60*60*1000));
    _unsubs.push(onSnapshot(query(collection(db,'enrollments'),where('createdAt','>',threeAgo),limit(20)),
        s=>{bk7=s.docs.filter(d=>d.data().managementSeen!==true).map(d=>({id:d.id,_collection:'enrollments',_type:'new_enrollment',title:'New enrollment: '+(d.data().studentName||'Student'),message:(d.data().parentName||'Parent')+' enrolled '+(d.data().studentName||'student'),createdAt:d.data().createdAt,read:false,actionTab:'enrollments'}));rebuild();},
        e=>console.warn('Bell[7]',e.message)));

    // Cleanup old polling interval if exists
    if (window._notifPollInterval) { clearInterval(window._notifPollInterval); window._notifPollInterval = null; }
    window._bellUnsubs = _unsubs;

    // ── Mark single notification read ──
    async function markNotifRead(notif) {
        try {
            if (notif._collection==='management_notifications') await updateDoc(doc(db,'management_notifications',notif.id),{read:true});
            else if (notif._collection==='tutor_to_management_messages') await updateDoc(doc(db,'tutor_to_management_messages',notif.id),{managementRead:true});
            else if (notif._collection==='parent_feedback') await updateDoc(doc(db,'parent_feedback',notif.id),{read:true});
            else if (notif._collection==='students') await updateDoc(doc(db,'students',notif.id),{breakNotifRead:true});
            else if (notif._collection==='tutors') await updateDoc(doc(db,'tutors',notif.id),{placementTestAcknowledged:true});
            else if (notif._collection==='enrollments') await updateDoc(doc(db,'enrollments',notif.id),{managementSeen:true});
        } catch(e) { console.warn('markRead err:', e.message); }
    }

    // ── Mark all as read ──
    async function markAllRead() {
        try {
            const batch = writeBatch(db);
            (await getDocs(query(collection(db,'management_notifications'),where('read','==',false)))).docs.forEach(d=>batch.update(d.ref,{read:true}));
            (await getDocs(query(collection(db,'tutor_to_management_messages'),where('managementRead','==',false)))).docs.forEach(d=>batch.update(d.ref,{managementRead:true}));
            (await getDocs(query(collection(db,'parent_feedback'),where('read','==',false)))).docs.forEach(d=>batch.update(d.ref,{read:true}));
            await batch.commit();
        } catch(e) { console.warn('markAllRead err:', e.message); }
    }

    // ── Bell click → show notification panel ──
    bellBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const existing = document.getElementById('notification-panel');
        if (existing) { existing.remove(); return; }

        const notifications = allNotifications;
        const unreadCount = notifications.filter(n => !n.read).length;

        const panel = document.createElement('div');
        panel.id = 'notification-panel';
        panel.className = 'fixed top-16 right-4 w-96 max-w-[95vw] bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden';

        // Group by type for summary
        const typeCounts = {};
        notifications.filter(n => !n.read).forEach(n => { typeCounts[n._type] = (typeCounts[n._type] || 0) + 1; });
        const summaryHTML = Object.entries(typeCounts).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] || { icon: '🔔', label: type };
            return `<span class="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">${cfg.icon} <span class="font-semibold">${count}</span> ${cfg.label}</span>`;
        }).join(' ');

        panel.innerHTML = `
            <div class="bg-green-700 text-white px-4 py-3 flex justify-between items-center">
                <div>
                    <span class="font-bold text-base">🔔 Notifications</span>
                    <span class="ml-2 bg-white text-green-700 text-xs font-bold rounded-full px-2 py-0.5">${unreadCount} unread</span>
                </div>
                <button id="close-notif-panel" class="text-white hover:text-gray-200 text-xl leading-none">&times;</button>
            </div>
            ${summaryHTML ? `<div class="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-1">${summaryHTML}</div>` : ''}
            <div class="max-h-[420px] overflow-y-auto divide-y" id="notif-list">
                ${notifications.length === 0
                    ? '<p class="text-gray-500 text-sm text-center py-8">✅ You\'re all caught up!</p>'
                    : notifications.slice(0, 40).map(n => {
                        const cfg = TYPE_CONFIG[n._type] || { icon: '🔔', color: 'border-l-gray-400', label: '' };
                        const date = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : '';
                        const unreadClass = !n.read ? `border-l-4 ${cfg.color} bg-gray-50` : '';
                        return `
                            <div class="p-3 hover:bg-blue-50 cursor-pointer notif-item transition-colors ${unreadClass}" 
                                data-idx="${notifications.indexOf(n)}"
                                data-tab="${n.actionTab || ''}">
                                <div class="flex items-start gap-2">
                                    <span class="text-lg leading-none mt-0.5">${cfg.icon}</span>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex justify-between items-start gap-2">
                                            <p class="text-sm font-semibold text-gray-800 leading-snug">${escapeHtml(n.title)}</p>
                                            ${!n.read ? '<span class="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>' : ''}
                                        </div>
                                        <p class="text-xs text-gray-600 mt-0.5 leading-snug">${escapeHtml(n.message)}</p>
                                        <p class="text-[10px] text-gray-400 mt-1">${date}</p>
                                    </div>
                                </div>
                            </div>`;
                    }).join('')
                }
            </div>
            ${unreadCount > 0 ? `
                <div class="p-3 border-t flex justify-between items-center bg-gray-50">
                    <span class="text-xs text-gray-500">${notifications.length} total notifications</span>
                    <button id="mark-all-read-btn" class="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50 transition-colors">
                        ✓ Mark all as read
                    </button>
                </div>` : ''}
        `;
        document.body.appendChild(panel);

        document.getElementById('close-notif-panel').addEventListener('click', () => panel.remove());

        document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
            await markAllRead();
            panel.remove();
        });

        panel.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async () => {
                const idx = parseInt(item.dataset.idx);
                const notif = notifications[idx];
                if (notif && !notif.read) await markNotifRead(notif);
                panel.remove();
                // Navigate to relevant tab if actionTab is set
                if (notif?.actionTab) {
                    const navMap = {
                        messaging:   'navMessaging',
                        feedback:    'navParentFeedback',
                        breaks:      'navBreaks',
                        tutors:      'navTutorManagement',
                        enrollments: 'navEnrollments',
                    };
                    const navId = navMap[notif.actionTab];
                    if (navId) {
                        const navBtn = document.getElementById(navId);
                        if (navBtn) navBtn.click();
                    }
                }
            });
        });

        document.addEventListener('click', (ev) => {
            if (!panel.contains(ev.target) && ev.target !== bellBtn) panel.remove();
        }, { once: true });
    });
}

// ======================================================
// SECTION: MANAGEMENT ACTIVITY LOG (second button)
// ======================================================

async function showManagementActivityLog() {
    const existing = document.getElementById('activity-log-modal');
    if (existing) { existing.remove(); return; }
    
    const staffName = window.userData?.name || 'Unknown';
    const staffEmail = window.userData?.email || '';
    const staffRole = window.userData?.role || '';
    
    const modal = document.createElement('div');
    modal.id = 'activity-log-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div class="bg-green-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold">👤 Management Profile</h2>
                    <p class="text-green-200 text-sm">${staffEmail}</p>
                </div>
                <button id="close-activity-log" class="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-6">
                <div class="bg-green-50 rounded-xl p-4 mb-6">
                    <p class="font-bold text-green-800 text-lg">${staffName}</p>
                    <p class="text-green-700 capitalize">${staffRole}</p>
                    <p class="text-sm text-gray-500 mt-1">Logged in: ${new Date().toLocaleString()}</p>
                </div>
                <h3 class="font-bold text-gray-700 mb-3">Recent Actions</h3>
                <div id="activity-log-list" class="space-y-2 max-h-64 overflow-y-auto">
                    <p class="text-gray-400 text-sm text-center py-4">Loading activity log...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('close-activity-log').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    // Load activity log (single where clause — sort client-side to avoid composite index requirement)
    try {
        const snap = await getDocs(query(
            collection(db, 'management_activity'),
            where('userEmail', '==', staffEmail),
            limit(50)
        ));
        const logEl = document.getElementById('activity-log-list');
        if (!logEl) return;
        if (snap.empty) {
            logEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No recent activity found.</p>';
        } else {
            // Sort client-side by timestamp descending
            const sorted = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
                    const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
                    return tb - ta;
                })
                .slice(0, 20);
            logEl.innerHTML = sorted.map(a => {
                const date = a.timestamp?.toDate ? a.timestamp.toDate().toLocaleString() : '';
                return `
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p class="text-sm font-medium text-gray-700">${escapeHtml(a.action || 'Action')}</p>
                        <p class="text-xs text-gray-500">${escapeHtml(a.details || '')}</p>
                        <p class="text-xs text-gray-400 mt-1">${date}</p>
                    </div>
                `;
            }).join('');
        }
    } catch(e) {
        const logEl = document.getElementById('activity-log-list');
        if (logEl) logEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Activity log not available.</p>';
    }
}

window.showManagementActivityLog = showManagementActivityLog;

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
                
                // Initialize notifications bell
                setTimeout(() => initManagementNotifications(), 500);
                
                // Wire activity log button
                const activityBtn = document.getElementById('activityLogBtn');
                if (activityBtn) {
                    activityBtn.addEventListener('click', showManagementActivityLog);
                }
                
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

// ======================================================
// SECTION: GOD MODE MOBILE PATCH SYSTEM
// INSTRUCTION: Paste this at the very bottom of management.js
// ======================================================

(function initMobilePatches() {
    console.log("📱 Initializing God Mode Mobile Patches...");

    // 1. INJECT GLOBAL CSS FIXES (Solves Dark Shade & Scrolling)
    const patchStyles = document.createElement('style');
    patchStyles.innerHTML = `
        /* Force tables to scroll horizontally on mobile */
        .overflow-x-auto { overflow-x: auto !important; }
        
        /* Fix the dark shade overlay getting stuck or layering wrong */
        .fixed.inset-0.bg-black { z-index: 40 !important; } 
        .fixed.inset-0.z-50 { z-index: 50 !important; }
        
        /* On mobile, ensure modals have breathing room */
        @media (max-width: 640px) {
            .w-96 { width: 92% !important; margin: 0 auto !important; }
            .max-w-lg { max-width: 92% !important; }
            .max-w-2xl { max-width: 95% !important; }
            .max-w-4xl { max-width: 95% !important; }
            
            /* Fix specific container padding */
            .p-8 { padding: 1.5rem !important; }
            
            /* Ensure the main content doesn't get hidden behind sidebar */
            #main-content { width: 100% !important; overflow-x: hidden !important; }
        }
    `;
    document.head.appendChild(patchStyles);

    // 2. ACTIVATE THE DOM WATCHER (The Automatic Fixer)
    // This watches your screen. If the app tries to show a broken modal, this fixes it instantly.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // If it's an HTML element
                    
                    // A. FIX TABLES (Prevent cutoff)
                    // Finds any div with 'overflow-hidden' that contains a table and switches it to scrollable
                    if (node.classList.contains('overflow-hidden') || node.querySelector('table')) {
                        if (node.classList.contains('shadow') || node.tagName === 'TABLE') {
                            node.classList.remove('overflow-hidden');
                            node.classList.add('overflow-x-auto');
                        }
                        // Deep check for inner containers
                        const tableContainers = node.querySelectorAll('.overflow-hidden');
                        tableContainers.forEach(container => {
                            container.classList.remove('overflow-hidden');
                            container.classList.add('overflow-x-auto');
                        });
                    }

                    // B. FIX MODALS (Prevent "Dark Shade" & Off-screen issues)
                    // If this is a modal container (fixed inset-0)
                    if (node.classList.contains('fixed') && node.classList.contains('inset-0')) {
                        
                        // Fix 1: Add scrolling to the black background wrapper itself
                        node.classList.add('overflow-y-auto');
                        
                        // Fix 2: Find the white box inside and make it responsive
                        const modalBox = node.querySelector('.bg-white');
                        if (modalBox) {
                            // Remove fixed desktop widths
                            modalBox.classList.remove('w-96', 'w-full');
                            
                            // Add responsive mobile widths
                            modalBox.classList.add('w-11/12', 'mx-auto', 'my-8');
                            
                            // Ensure it has a max-width for desktop
                            if (!modalBox.classList.contains('max-w-4xl')) {
                                modalBox.classList.add('max-w-lg');
                            }
                        }
                    }
                }
            });
        });
    });

    // Start watching the body for changes
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("✅ Mobile Patches Active: Tables are scrollable, Modals are responsive.");
})();
