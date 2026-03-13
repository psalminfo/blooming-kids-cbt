// ============================================================
// panels/dashboard.js
// Dashboard stats & quick-action cards
// ============================================================

import { db, collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc, limit, startAfter, onSnapshot } from '../core/firebase.js';
import { escapeHtml, capitalize, formatNaira, buildGradeOptions, buildTimeOptions,
         formatTimeTo12h, sanitizeInput, rateLimitCheck,
         safeToString, safeSearch, formatBadgeDate, calculateYearsOfService,
         calculateTransitioningStatus, searchStudentFromFirebase,
         createSearchableSelect, initializeSearchableSelect, createDatePicker,
         logStudentEvent, getLagosDatetime, formatLagosDatetime,
         getCurrentMonthKeyLagos, getCurrentMonthLabelLagos,
         getScoreColor, getScoreBg, getScoreBar,
         getStudentTypeLabel, formatStudentSchedule } from '../core/utils.js';
import { sessionCache, saveToLocalStorage, invalidateCache, switchToTabCached } from '../core/cache.js';
import { logManagementActivity } from '../notifications/activityLog.js';

// SECTION 2: DASHBOARD PANEL
// ======================================================

export async function renderDashboardPanel(container) {
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

export async function loadDashboardData() {
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

export async function submitAssignment() {
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

export async function submitArchiveStudent() {
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

export async function submitMarkInactive() {
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
// ======================================================
