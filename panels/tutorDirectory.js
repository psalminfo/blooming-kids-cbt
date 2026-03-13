// ============================================================
// panels/tutorDirectory.js
// Tutor directory — search, filter, tutor cards, modals
// ============================================================

import { db } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy,
         Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc,
         limit, startAfter, onSnapshot } from '../core/firebase.js';
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

// SUBSECTION 3.1: Tutor Directory Panel - ENHANCED (COMPLETE & ERROR-FIXED)
// ======================================================

// --- HELPER FUNCTIONS (Updated) ---




// Calculate years of service from employmentDate (for tutor display)



// --- ENHANCED SELECT WITH SEARCH FUNCTIONALITY (includes employment years) ---



// --- DATE PICKER UTILITY ---


// --- Student Event Logger (Comprehensive History) ---

// ======================================================
// MAIN VIEW RENDERER (Updated with visible orange button)
// ======================================================

export async function renderManagementTutorView(container) {
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
        
        let _searchDebounceTimer = null;
        document.getElementById('directory-search').addEventListener('input', (e) => {
            const val = e.target.value;
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => renderDirectoryFromCache(val), 250);
        });
        
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

export function showTransitionStudentModal() {
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
                            <option value="custom">Custom Date...</option>
                        </select>
                    </div>
                    
                    <!-- End Date: auto-calculated or custom date picker -->
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2 text-gray-700" id="transition-end-date-label">End Date (auto-calculated)</label>
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
            const durationVal = document.getElementById('transition-duration').value;
            const endDateInput = document.getElementById('transition-end-date-display');
            const endDateLabel = document.getElementById('transition-end-date-label');

            if (durationVal === 'custom') {
                // Switch to an editable date picker
                endDateLabel.textContent = 'End Date (select date)';
                endDateInput.readOnly = false;
                endDateInput.type = 'date';
                endDateInput.classList.remove('bg-gray-100');
                endDateInput.classList.add('bg-white', 'focus:ring-2', 'focus:ring-orange-500', 'focus:border-orange-500');
                endDateInput.min = new Date().toISOString().split('T')[0];
                if (!endDateInput.value) {
                    // Default to 2 weeks from today
                    const def = new Date();
                    def.setDate(def.getDate() + 14);
                    endDateInput.value = def.toISOString().split('T')[0];
                }
            } else {
                // Auto-calculate end date
                endDateLabel.textContent = 'End Date (auto-calculated)';
                endDateInput.readOnly = true;
                endDateInput.type = 'text';
                endDateInput.classList.add('bg-gray-100');
                endDateInput.classList.remove('bg-white', 'focus:ring-2', 'focus:ring-orange-500', 'focus:border-orange-500');
                const startDateStr = document.getElementById('transition-start-date').value;
                if (!startDateStr) return;
                const startDate = new Date(startDateStr);
                const durationDays = parseInt(durationVal, 10);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + durationDays);
                endDateInput.value = endDate.toISOString().split('T')[0];
            }
        }
        
        // Use hidden start date field
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
            const durationRaw = document.getElementById('transition-duration').value;
            // If custom date selected, calculate durationDays from start→end date diff
            const durationDays = durationRaw === 'custom'
                ? Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
                : parseInt(durationRaw, 10);
            const reason = document.getElementById('transition-reason').value.trim();
            const allowReporting = document.getElementById('allow-reporting').checked;
            
            if (!studentId || !tutorEmail || !startDate || !endDate) {
                alert("Please fill all required fields");
                return;
            }
            
            if (durationDays <= 0 || isNaN(durationDays)) {
                alert("End date must be after the start date.");
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

export async function performTransition(student, newTutor, startDate, endDate, reason, allowReporting, durationDays) {
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

export function showCreateGroupClassModal() {
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

export function calculateTotalGroupFee() {
    let total = 0;
    document.querySelectorAll('.group-fee-input').forEach(input => {
        if (!input.classList.contains('hidden')) {
            total += parseFloat(input.value) || 0;
        }
    });
    document.getElementById('total-group-fee').textContent = `₦${total.toFixed(2)}`;
}

export async function createGroupClass(groupName, tutor, subject, schedule, notes, studentFees) {
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

export function showEnhancedReassignStudentModal() {
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
                                <option value="custom">Custom Date...</option>
                            </select>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2 text-gray-700" id="transition-end-date-reassign-label">End Date (auto-calculated)</label>
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
            const durationVal = document.getElementById('transition-duration-reassign').value;
            const endDateInput = document.getElementById('transition-end-date-reassign-display');
            const endDateLabel = document.getElementById('transition-end-date-reassign-label');

            if (durationVal === 'custom') {
                endDateLabel.textContent = 'End Date (select date)';
                endDateInput.readOnly = false;
                endDateInput.type = 'date';
                endDateInput.classList.remove('bg-gray-100');
                endDateInput.classList.add('bg-white', 'focus:ring-2', 'focus:ring-orange-500', 'focus:border-orange-500');
                endDateInput.min = new Date().toISOString().split('T')[0];
                if (!endDateInput.value) {
                    const def = new Date();
                    def.setDate(def.getDate() + 14);
                    endDateInput.value = def.toISOString().split('T')[0];
                }
            } else {
                endDateLabel.textContent = 'End Date (auto-calculated)';
                endDateInput.readOnly = true;
                endDateInput.type = 'text';
                endDateInput.classList.add('bg-gray-100');
                endDateInput.classList.remove('bg-white', 'focus:ring-2', 'focus:ring-orange-500', 'focus:border-orange-500');
                const startDateStr = document.getElementById('transition-start-date-reassign').value;
                if (!startDateStr) return;
                const startDate = new Date(startDateStr);
                const durationDays = parseInt(durationVal, 10);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + durationDays);
                endDateInput.value = endDate.toISOString().split('T')[0];
            }
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
                const durationRaw = document.getElementById('transition-duration-reassign').value;
                // If custom date selected, calculate durationDays from start→end date diff
                const durationDays = durationRaw === 'custom'
                    ? Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
                    : parseInt(durationRaw, 10);
                const allowReporting = document.getElementById('allow-reporting-reassign').checked;
                const startDate = document.getElementById('transition-start-date-reassign').value;
                
                if (!studentId || !tutorEmail || !reason) {
                    alert("Please select student, tutor and provide a reason");
                    return;
                }
                
                if (durationDays <= 0 || isNaN(durationDays)) {
                    alert("End date must be after the start date.");
                    return;
                }
                
                const student = students.find(s => s.id === studentId);
                const newTutor = tutors.find(t => t.email === tutorEmail);
                
                if (student.tutorEmail === tutorEmail) {
                    alert("Student is already assigned to this tutor");
                    return;
                }
                
                if (confirm(`Temporarily transition ${student.studentName} to ${newTutor.name} until ${endDate} (${durationDays} days)?`)) {
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

export async function performReassignment(student, newTutor, reason, currentTutor) {
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

export function showManageTransitionModal(studentId) {
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

export async function fetchAndRenderDirectory(forceRefresh = false) {
    // ── Cache freshness guard: skip Firestore if data is less than 5 min old ──
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const cacheAge = Date.now() - (sessionCache._lastUpdate || 0);
    const cacheIsValid = !forceRefresh
        && cacheAge < CACHE_TTL_MS
        && sessionCache.tutors?.length > 0
        && sessionCache.students?.length > 0;

    if (cacheIsValid) {
        renderDirectoryFromCache();
        return;
    }

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
            getDocs(query(collection(db, "tutorAssignments"), orderBy("assignedAt", "desc"), limit(300))),
            getDocs(query(collection(db, "tutorTransitions"), orderBy("createdAt", "desc"), limit(200))),
            getDocs(collection(db, "groupClasses"))
        ]);
        
        
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
        
        window.__allStudents = allStudents; // cache for handleEditStudent
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
        sessionCache.tutors = activeTutors;
        sessionCache.students = nonArchivedStudents;
        sessionCache.tutorAssignments = tutorAssignments;
        sessionCache.tutorTransitions = activeTransitions;
        sessionCache._lastUpdate = Date.now();
        window.__allStudents = nonArchivedStudents;
        
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

export function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const tutorAssignments = sessionCache.tutorAssignments || {};
    const directoryList = document.getElementById('directory-list');
    
    if (!directoryList) return;
    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No data found.</p>`; 
        return;
    }

    // Skip re-render if the same search + same data snapshot is already displayed
    const _renderKey = searchTerm + '|' + (sessionCache._lastUpdate || '');
    if (renderDirectoryFromCache._lastKey === _renderKey) return;
    renderDirectoryFromCache._lastKey = _renderKey;

    const studentsByTutor = {};
    students.forEach(s => {
        if (s.tutorEmail) {
            if (!studentsByTutor[s.tutorEmail]) studentsByTutor[s.tutorEmail] = [];
            // Pre-compute search match once per student (avoids calling it twice below)
            s._searchMatch = !searchTerm || searchStudentFromFirebase(s, searchTerm, tutors);
            studentsByTutor[s.tutorEmail].push(s);
        }
    });

    const filteredTutors = tutors.filter(tutor => {
        if (!tutor) return false;
        if (!searchTerm) return true;
        
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const tutorMatch = safeSearch(tutor.name, searchTerm) || safeSearch(tutor.email, searchTerm);
        const studentMatch = assignedStudents.some(s => s._searchMatch);
        
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
            .filter(student => !searchTerm || student._searchMatch)
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

        const isMobile = window.innerWidth < 768;
        return `
            <div class="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <details ${isMobile ? '' : 'open'}>
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

export function getCleanStudents() { 
    return (sessionCache.students || [])
        .filter(s => !s.status || !s.status.toLowerCase().includes('archived')); 
}

export function getCleanTutors() { 
    return (sessionCache.tutors || [])
        .filter(t => !t.status || t.status === 'active'); 
}

export function validateReassignData(students, tutors) {
    if (!students.length || !tutors.length) { 
        alert("Missing student or tutor data. Please refresh."); 
        return false; 
    }
    return true;
}

// ======================================================
// UPDATED ASSIGN STUDENT MODAL (with parent email and createdBy)
// ======================================================

export function showAssignStudentModal() {
    const tutors = sessionCache.tutors || [];
    const activeTutors = tutors
        .filter(tutor => !tutor.status || tutor.status === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (activeTutors.length === 0) {
        alert("No active tutors available. Please refresh the directory and try again.");
        return;
    }

    // ── Helper: build a searchable tutor‑row HTML block ──────────────────────
    function buildTutorRowHTML(rowId, labelText, colorClass, badgeText) {
        const opts = activeTutors.map(t =>
            `<div class="am-tutor-opt px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
                 data-email="${escapeHtml(t.email)}" data-name="${escapeHtml(t.name || t.email)}"
                 data-label="${escapeHtml((t.name || t.email).toLowerCase())} ${escapeHtml(t.email.toLowerCase())}">
                <span class="font-medium text-gray-800">${escapeHtml(t.name || t.email)}</span>
                <span class="text-gray-400 text-xs ml-2">${escapeHtml(t.email)}</span>
             </div>`
        ).join('');
        return `
        <div class="am-tutor-row p-3 bg-${colorClass}-50 border border-${colorClass}-200 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-semibold text-${colorClass}-700">${labelText}</span>
                <span class="text-xs bg-${colorClass}-100 text-${colorClass}-700 px-2 py-0.5 rounded">${badgeText}</span>
            </div>
            <div class="relative">
                <input type="text" id="${rowId}-search" autocomplete="off"
                       placeholder="Type tutor name or email..."
                       class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
                <input type="hidden" id="${rowId}-email" value="">
                <input type="hidden" id="${rowId}-name"  value="">
                <div id="${rowId}-dropdown"
                     class="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto hidden top-full left-0">
                    ${opts}
                </div>
            </div>
            <p id="${rowId}-label" class="text-xs text-green-700 mt-1 hidden"></p>
            <div class="mt-2">
                <label class="block text-xs font-medium text-gray-600 mb-1">Subject / Activity *</label>
                <input type="text" id="${rowId}-subject" placeholder="e.g. Mathematics / Piano / SAT"
                       class="w-full rounded-md border border-gray-300 shadow-sm p-1.5 text-sm">
            </div>
            <div class="mt-2">
                <label class="block text-xs font-medium text-gray-600 mb-1">Tutor Fee (₦) *</label>
                <input type="number" id="${rowId}-fee" placeholder="e.g. 50000" min="0" value="0"
                       class="w-full rounded-md border border-gray-300 shadow-sm p-1.5 text-sm">
            </div>
        </div>`;
    }

    // ── Modal HTML ────────────────────────────────────────────────────────────
    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[9999] p-4">
            <div class="relative bg-white w-full max-w-xl rounded-lg shadow-xl" style="max-height:92vh;overflow-y:auto;">
                <div class="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
                    <h3 class="text-xl font-bold text-gray-800">Assign New Student</h3>
                    <button class="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none" onclick="closeManagementModal('assign-modal')">&times;</button>
                </div>

                <!-- ── Class Type Toggle ── -->
                <div class="px-5 pt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Class Type <span class="text-red-500">*</span></label>
                    <div class="flex gap-2">
                        <button type="button" id="am-type-single"
                            class="flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-green-600 text-white border-green-600 transition-colors">
                            <i class="fas fa-user mr-1"></i> Single Student
                        </button>
                        <button type="button" id="am-type-group"
                            class="flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors">
                            <i class="fas fa-users mr-1"></i> Group Class
                        </button>
                    </div>
                </div>

                <form id="assign-student-form" class="p-5 space-y-3">

                    <!-- ══ SINGLE STUDENT FIELDS ══ -->
                    <div id="am-single-fields">

                        <!-- Student Name -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Student Name <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-studentName" placeholder="Full name"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Grade -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Student Grade <span class="text-red-500">*</span></label>
                            <select id="assign-grade" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                ${buildGradeOptions()}
                            </select>
                        </div>

                        <!-- Days/Week -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Days/Week <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-days" placeholder="e.g. Monday, Wednesday, Friday"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Start & End Time -->
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Start Time <span class="text-red-500">*</span></label>
                                <select id="assign-start-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildTimeOptions()}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">End Time <span class="text-red-500">*</span></label>
                                <select id="assign-end-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildTimeOptions()}
                                </select>
                            </div>
                        </div>

                        <!-- Subjects (Academic) -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Academic Subjects <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-subjects" placeholder="e.g. Math, English, Science"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Parent Name -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Parent Name <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-parentName"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Parent Phone -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Parent Phone <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-parentPhone"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Parent Email — now REQUIRED -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Parent Email <span class="text-red-500">*</span></label>
                            <input type="email" id="assign-parentEmail" placeholder="parent@example.com"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Fee -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tutor Fee (₦) <span class="text-red-500">*</span></label>
                            <input type="number" id="assign-studentFee" value="0" min="0"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- ── Tutor Assignments ─────────────────────────────────────────── -->
                        <div class="mb-2">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tutor Assignments <span class="text-red-500">*</span></label>

                            <!-- Academic Tutor (always shown) -->
                            <div id="am-academic-section">
                                ${buildTutorRowHTML('am-tutor-academic', 'Academic Tutor', 'green', 'Required')}
                            </div>

                            <!-- Extra-Curricular Tutor (shown when academic is selected) -->
                            <div id="am-ec-section" class="mt-2 hidden">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-xs font-semibold text-blue-700">Extra-Curricular Tutor</span>
                                    <button type="button" id="am-remove-ec"
                                        class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                </div>
                                ${buildTutorRowHTML('am-tutor-ec', 'Extra-Curricular Tutor', 'blue', 'Optional')}
                            </div>

                            <!-- Test Prep Tutor (shown when academic is selected) -->
                            <div id="am-tp-section" class="mt-2 hidden">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-xs font-semibold text-purple-700">Test Prep Tutor</span>
                                    <button type="button" id="am-remove-tp"
                                        class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                </div>
                                ${buildTutorRowHTML('am-tutor-tp', 'Test Prep Tutor', 'purple', 'Optional')}
                            </div>

                            <!-- Add More Buttons — only visible after academic tutor is picked -->
                            <div id="am-add-more-btns" class="mt-3 flex gap-2 hidden">
                                <button type="button" id="am-add-ec-btn"
                                    class="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100">
                                    <i class="fas fa-plus mr-1"></i>Add Extra-Curricular Tutor
                                </button>
                                <button type="button" id="am-add-tp-btn"
                                    class="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-100">
                                    <i class="fas fa-plus mr-1"></i>Add Test Prep Tutor
                                </button>
                            </div>
                        </div>
                    </div><!-- /am-single-fields -->

                    <!-- ══ GROUP CLASS FIELDS ══ -->
                    <div id="am-group-fields" class="hidden">

                        <!-- How many students -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                How many students? <span class="text-red-500">*</span>
                            </label>
                            <div class="flex gap-2">
                                <input type="number" id="am-group-count" min="2" max="30" value="2"
                                    class="w-24 rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                <button type="button" id="am-group-generate-btn"
                                    class="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                                    Generate Fields
                                </button>
                            </div>
                        </div>

                        <!-- Dynamically generated student rows -->
                        <div id="am-group-student-rows" class="space-y-3"></div>

                        <!-- Shared schedule / grade -->
                        <div class="mb-3 mt-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Grade (shared) <span class="text-red-500">*</span></label>
                            <select id="assign-grade-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                ${buildGradeOptions()}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Days/Week <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-days-group" placeholder="e.g. Monday, Wednesday"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Start Time <span class="text-red-500">*</span></label>
                                <select id="assign-start-time-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildTimeOptions()}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">End Time <span class="text-red-500">*</span></label>
                                <select id="assign-end-time-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildTimeOptions()}
                                </select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Academic Subjects <span class="text-red-500">*</span></label>
                            <input type="text" id="assign-subjects-group" placeholder="e.g. Math, English"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>

                        <!-- Group Academic Tutor -->
                        <div class="mb-3">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Group Academic Tutor <span class="text-red-500">*</span></label>
                            ${buildTutorRowHTML('am-tutor-group-academic', 'Academic Tutor', 'green', 'Required')}
                        </div>

                        <!-- Group EC tutor -->
                        <div id="am-group-ec-section" class="mb-2 hidden">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-semibold text-blue-700">Extra-Curricular Tutor</span>
                                <button type="button" id="am-group-remove-ec" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                            </div>
                            ${buildTutorRowHTML('am-tutor-group-ec', 'Extra-Curricular Tutor', 'blue', 'Optional')}
                        </div>

                        <!-- Group TP tutor -->
                        <div id="am-group-tp-section" class="mb-2 hidden">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-semibold text-purple-700">Test Prep Tutor</span>
                                <button type="button" id="am-group-remove-tp" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                            </div>
                            ${buildTutorRowHTML('am-tutor-group-tp', 'Test Prep Tutor', 'purple', 'Optional')}
                        </div>

                        <!-- Group Add More Buttons -->
                        <div id="am-group-add-more-btns" class="mt-2 flex gap-2">
                            <button type="button" id="am-group-add-ec-btn"
                                class="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100">
                                <i class="fas fa-plus mr-1"></i>Add Extra-Curricular Tutor
                            </button>
                            <button type="button" id="am-group-add-tp-btn"
                                class="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-100">
                                <i class="fas fa-plus mr-1"></i>Add Test Prep Tutor
                            </button>
                        </div>

                        <!-- Per-student fee note -->
                        <p class="text-xs text-gray-500 mt-2">Each student will receive a unique ID. Fees are set per student below.</p>
                    </div><!-- /am-group-fields -->

                    <div class="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onclick="closeManagementModal('assign-modal')"
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                        <button type="submit"
                            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                            Assign Student
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ── Wire up tutor dropdowns ───────────────────────────────────────────────
    function wireDropdown(rowId) {
        const searchEl  = document.getElementById(`${rowId}-search`);
        const emailEl   = document.getElementById(`${rowId}-email`);
        const nameEl    = document.getElementById(`${rowId}-name`);
        const dropdown  = document.getElementById(`${rowId}-dropdown`);
        const labelEl   = document.getElementById(`${rowId}-label`);
        if (!searchEl || !dropdown) return;

        searchEl.addEventListener('focus', () => dropdown.classList.remove('hidden'));
        searchEl.addEventListener('input', () => {
            const term = searchEl.value.toLowerCase();
            dropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
                opt.style.display = (opt.dataset.label || '').includes(term) ? '' : 'none';
            });
            dropdown.classList.remove('hidden');
            if (emailEl) emailEl.value = '';
            if (nameEl)  nameEl.value  = '';
            if (labelEl) labelEl.classList.add('hidden');
            // Hide add-more buttons if academic was cleared
            if (rowId === 'am-tutor-academic') {
                document.getElementById('am-add-more-btns')?.classList.add('hidden');
            }
        });
        dropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchEl.value = opt.dataset.name;
                if (emailEl) emailEl.value = opt.dataset.email;
                if (nameEl)  nameEl.value  = opt.dataset.name;
                if (labelEl) {
                    labelEl.textContent = `✓ ${opt.dataset.name} (${opt.dataset.email})`;
                    labelEl.classList.remove('hidden');
                }
                dropdown.classList.add('hidden');
                // Show add-more buttons when academic tutor is selected
                if (rowId === 'am-tutor-academic' && opt.dataset.email) {
                    document.getElementById('am-add-more-btns')?.classList.remove('hidden');
                }
            });
        });
        document.addEventListener('click', (e) => {
            if (searchEl && !searchEl.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // Wire all tutor rows
    ['am-tutor-academic','am-tutor-ec','am-tutor-tp',
     'am-tutor-group-academic','am-tutor-group-ec','am-tutor-group-tp'].forEach(wireDropdown);

    // ── Class Type Toggle ─────────────────────────────────────────────────────
    const singleBtn     = document.getElementById('am-type-single');
    const groupBtn      = document.getElementById('am-type-group');
    const singleFields  = document.getElementById('am-single-fields');
    const groupFields   = document.getElementById('am-group-fields');
    const submitBtn     = document.querySelector('#assign-student-form button[type="submit"]');
    let isGroup = false;

    function setClassType(grp) {
        isGroup = grp;
        if (grp) {
            groupBtn.className  = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-indigo-600 text-white border-indigo-600 transition-colors';
            singleBtn.className = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors';
            singleFields.classList.add('hidden');
            groupFields.classList.remove('hidden');
            submitBtn.textContent = 'Create Group & Assign';
        } else {
            singleBtn.className = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-green-600 text-white border-green-600 transition-colors';
            groupBtn.className  = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors';
            groupFields.classList.add('hidden');
            singleFields.classList.remove('hidden');
            submitBtn.textContent = 'Assign Student';
        }
    }
    singleBtn.addEventListener('click', () => setClassType(false));
    groupBtn.addEventListener('click',  () => setClassType(true));

    // ── Add/Remove EC & TP sections (single mode) ────────────────────────────
    document.getElementById('am-add-ec-btn')?.addEventListener('click', () => {
        document.getElementById('am-ec-section').classList.remove('hidden');
        document.getElementById('am-add-ec-btn').classList.add('hidden');
    });
    document.getElementById('am-add-tp-btn')?.addEventListener('click', () => {
        document.getElementById('am-tp-section').classList.remove('hidden');
        document.getElementById('am-add-tp-btn').classList.add('hidden');
    });
    document.getElementById('am-remove-ec')?.addEventListener('click', () => {
        document.getElementById('am-ec-section').classList.add('hidden');
        document.getElementById('am-add-ec-btn').classList.remove('hidden');
        document.getElementById('am-tutor-ec-email').value = '';
        document.getElementById('am-tutor-ec-name').value  = '';
        document.getElementById('am-tutor-ec-search').value = '';
        document.getElementById('am-tutor-ec-subject').value = '';
    });
    document.getElementById('am-remove-tp')?.addEventListener('click', () => {
        document.getElementById('am-tp-section').classList.add('hidden');
        document.getElementById('am-add-tp-btn').classList.remove('hidden');
        document.getElementById('am-tutor-tp-email').value = '';
        document.getElementById('am-tutor-tp-name').value  = '';
        document.getElementById('am-tutor-tp-search').value = '';
        document.getElementById('am-tutor-tp-subject').value = '';
    });

    // ── Add/Remove EC & TP (group mode) ──────────────────────────────────────
    document.getElementById('am-group-add-ec-btn')?.addEventListener('click', () => {
        document.getElementById('am-group-ec-section').classList.remove('hidden');
        document.getElementById('am-group-add-ec-btn').classList.add('hidden');
    });
    document.getElementById('am-group-add-tp-btn')?.addEventListener('click', () => {
        document.getElementById('am-group-tp-section').classList.remove('hidden');
        document.getElementById('am-group-add-tp-btn').classList.add('hidden');
    });
    document.getElementById('am-group-remove-ec')?.addEventListener('click', () => {
        document.getElementById('am-group-ec-section').classList.add('hidden');
        document.getElementById('am-group-add-ec-btn').classList.remove('hidden');
        document.getElementById('am-tutor-group-ec-email').value = '';
        document.getElementById('am-tutor-group-ec-name').value  = '';
        document.getElementById('am-tutor-group-ec-search').value = '';
        document.getElementById('am-tutor-group-ec-subject').value = '';
    });
    document.getElementById('am-group-remove-tp')?.addEventListener('click', () => {
        document.getElementById('am-group-tp-section').classList.add('hidden');
        document.getElementById('am-group-add-tp-btn').classList.remove('hidden');
        document.getElementById('am-tutor-group-tp-email').value = '';
        document.getElementById('am-tutor-group-tp-name').value  = '';
        document.getElementById('am-tutor-group-tp-search').value = '';
        document.getElementById('am-tutor-group-tp-subject').value = '';
    });

    // ── Generate group student name/email/fee rows ────────────────────────────
    document.getElementById('am-group-generate-btn')?.addEventListener('click', () => {
        const count = parseInt(document.getElementById('am-group-count').value, 10) || 2;
        const container = document.getElementById('am-group-student-rows');
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            container.insertAdjacentHTML('beforeend', `
                <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p class="text-xs font-semibold text-gray-600 mb-2">Student ${i + 1}</p>
                    <div class="grid grid-cols-1 gap-2">
                        <input type="text" id="am-group-name-${i}" placeholder="Full name *"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm am-group-name">
                        <input type="text" id="am-group-parent-name-${i}" placeholder="Parent name *"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        <input type="text" id="am-group-parent-phone-${i}" placeholder="Parent phone *"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        <input type="email" id="am-group-parent-email-${i}" placeholder="Parent email *"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        <input type="number" id="am-group-fee-${i}" placeholder="Fee (₦) *" min="0" value="0"
                            class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                    </div>
                </div>
            `);
        }
    });
    // Auto-generate 2 rows on open
    document.getElementById('am-group-generate-btn').click();

    // ── Form Submit ───────────────────────────────────────────────────────────
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            if (isGroup) {
                await submitGroupAssignment();
            } else {
                await submitSingleAssignment();
            }
        } catch (err) {
            console.error('Assign modal submit error:', err);
            alert('Failed to save. Please try again.\n' + err.message);
            btn.disabled = false;
            btn.textContent = isGroup ? 'Create Group & Assign' : 'Assign Student';
        }
    });

    // ── SINGLE submission ─────────────────────────────────────────────────────
    async function submitSingleAssignment() {
        const studentName = document.getElementById('assign-studentName').value.trim();
        const grade       = document.getElementById('assign-grade').value;
        const days        = document.getElementById('assign-days').value.trim();
        const startTime   = document.getElementById('assign-start-time').value;
        const endTime     = document.getElementById('assign-end-time').value;
        const subjectsRaw = document.getElementById('assign-subjects').value.trim();
        const parentName  = document.getElementById('assign-parentName').value.trim();
        const parentPhone = document.getElementById('assign-parentPhone').value.trim();
        const parentEmail = document.getElementById('assign-parentEmail').value.trim();
        const studentFee  = Number(document.getElementById('assign-studentFee').value) || 0;

        // Academic tutor
        const academicEmail = document.getElementById('am-tutor-academic-email').value;
        const academicName  = document.getElementById('am-tutor-academic-name').value;
        const academicSubj  = document.getElementById('am-tutor-academic-subject').value.trim();
        const academicFee   = Number(document.getElementById('am-tutor-academic-fee')?.value) || 0;

        if (!studentName || !grade || !days || !startTime || !endTime || !subjectsRaw) {
            alert('Please fill in all required student fields.'); return;
        }
        if (!parentName || !parentPhone) {
            alert('Please fill in parent name and phone.'); return;
        }
        if (!parentEmail) {
            alert('Parent email is required.'); return;
        }
        if (!academicEmail) {
            alert('Please select an Academic Tutor.'); return;
        }

        const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;
        const subjects = subjectsRaw.split(',').map(s => s.trim()).filter(Boolean);

        // Build subjectAssignments array
        const subjectAssignments = [{
            category: 'Academic',
            tutorEmail: academicEmail,
            tutorName: academicName,
            subject: academicSubj || subjects.join(', '),
            tutorFee: academicFee,
            assignedDate: new Date().toISOString()
        }];

        // Extra-Curricular
        const ecEmail   = document.getElementById('am-tutor-ec-email')?.value;
        const ecName    = document.getElementById('am-tutor-ec-name')?.value;
        const ecSubject = document.getElementById('am-tutor-ec-subject')?.value.trim();
        const ecFee     = Number(document.getElementById('am-tutor-ec-fee')?.value) || 0;
        const ecVisible = !document.getElementById('am-ec-section')?.classList.contains('hidden');
        if (ecVisible && ecEmail) {
            subjectAssignments.push({
                category: 'Extra-Curricular',
                tutorEmail: ecEmail,
                tutorName: ecName,
                subject: ecSubject || 'Extra-Curricular',
                tutorFee: ecFee,
                assignedDate: new Date().toISOString()
            });
        }

        // Test Prep
        const tpEmail   = document.getElementById('am-tutor-tp-email')?.value;
        const tpName    = document.getElementById('am-tutor-tp-name')?.value;
        const tpSubject = document.getElementById('am-tutor-tp-subject')?.value.trim();
        const tpFee     = Number(document.getElementById('am-tutor-tp-fee')?.value) || 0;
        const tpVisible = !document.getElementById('am-tp-section')?.classList.contains('hidden');
        if (tpVisible && tpEmail) {
            subjectAssignments.push({
                category: 'Test Prep',
                tutorEmail: tpEmail,
                tutorName: tpName,
                subject: tpSubject || 'Test Prep',
                tutorFee: tpFee,
                assignedDate: new Date().toISOString()
            });
        }

        const newStudentData = {
            studentName,
            grade,
            days,
            academicDays: days,
            academicTime,
            subjects,
            parentName,
            parentPhone,
            parentEmail,
            studentFee,
            tutorFee: academicFee,
            // Primary academic tutor (legacy fields kept for backward compat)
            tutorEmail: academicEmail,
            tutorName: academicName,
            // Full multi-tutor map
            subjectAssignments,
            status: 'approved',
            summerBreak: false,
            createdAt: Timestamp.now(),
            createdBy: window.userData?.name || window.userData?.email || 'management',
            tutorHistory: [{
                tutorEmail: academicEmail,
                tutorName: academicName,
                assignedDate: Timestamp.now(),
                assignedBy: window.userData?.email || 'management',
                isCurrent: true
            }],
            gradeHistory: [{
                grade,
                changedDate: Timestamp.now(),
                changedBy: window.userData?.email || 'management'
            }]
        };

        const studentRef = await addDoc(collection(db, 'students'), newStudentData);

        // Schedule
        if (days && startTime && endTime) {
            const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const daysList = days.split(/,|\band\b/i).map(d => d.trim()).filter(d => DAYS_LIST.includes(d));
            const scheduleEntries = daysList.length > 0
                ? daysList.map(day => ({ day, start: startTime, end: endTime }))
                : [{ day: days, start: startTime, end: endTime }];
            await setDoc(doc(db, 'schedules', `sched_${studentRef.id}`), {
                studentId: studentRef.id,
                studentName,
                tutorEmail: academicEmail,
                schedule: scheduleEntries,
                academicDays: days,
                academicTime,
                source: 'management_assign',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });
            await updateDoc(studentRef, { schedule: scheduleEntries });
        }

        // Notifications for every assigned tutor
        for (const sa of subjectAssignments) {
            await addDoc(collection(db, 'tutor_notifications'), {
                tutorEmail: sa.tutorEmail,
                type: 'new_student',
                title: `New Student Assigned — ${sa.category}`,
                message: `${studentName} (${grade}) has been assigned to you for ${sa.subject}. Schedule: ${days} at ${academicTime}.`,
                studentName,
                grade,
                subjects,
                category: sa.category,
                subject: sa.subject,
                parentName,
                parentPhone,
                parentEmail,
                studentFee,
                academicDays: days,
                academicTime,
                senderDisplay: 'Management',
                read: false,
                createdAt: Timestamp.now()
            });
        }

        alert(`Student "${studentName}" assigned successfully!`);
        closeManagementModal('assign-modal');
        invalidateCache('students');
        sessionCache._lastUpdate = 0; // force next render to re-fetch
        renderManagementTutorView(document.getElementById('main-content'));
    }

    // ── GROUP submission ──────────────────────────────────────────────────────
    async function submitGroupAssignment() {
        const count         = document.querySelectorAll('.am-group-name').length;
        const grade         = document.getElementById('assign-grade-group').value;
        const days          = document.getElementById('assign-days-group').value.trim();
        const startTime     = document.getElementById('assign-start-time-group').value;
        const endTime       = document.getElementById('assign-end-time-group').value;
        const subjectsRaw   = document.getElementById('assign-subjects-group').value.trim();
        const academicEmail = document.getElementById('am-tutor-group-academic-email').value;
        const academicName  = document.getElementById('am-tutor-group-academic-name').value;
        const academicSubj  = document.getElementById('am-tutor-group-academic-subject').value.trim();

        if (!grade || !days || !startTime || !endTime || !subjectsRaw) {
            alert('Please fill in all shared schedule fields.'); return;
        }
        if (!academicEmail) {
            alert('Please select a Group Academic Tutor.'); return;
        }
        if (count < 2) {
            alert('Please generate student fields first.'); return;
        }

        // Validate all student rows
        const students = [];
        for (let i = 0; i < count; i++) {
            const name        = document.getElementById(`am-group-name-${i}`)?.value.trim();
            const parentName  = document.getElementById(`am-group-parent-name-${i}`)?.value.trim();
            const parentPhone = document.getElementById(`am-group-parent-phone-${i}`)?.value.trim();
            const parentEmail = document.getElementById(`am-group-parent-email-${i}`)?.value.trim();
            const fee         = Number(document.getElementById(`am-group-fee-${i}`)?.value) || 0;
            if (!name || !parentName || !parentPhone || !parentEmail) {
                alert(`Please fill in all fields for Student ${i + 1}.`); return;
            }
            students.push({ name, parentName, parentPhone, parentEmail, fee });
        }

        const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;
        const subjects = subjectsRaw.split(',').map(s => s.trim()).filter(Boolean);

        // Build shared subjectAssignments
        const sharedAssignments = [{
            category: 'Academic',
            tutorEmail: academicEmail,
            tutorName: academicName,
            subject: academicSubj || subjects.join(', '),
            assignedDate: new Date().toISOString()
        }];
        const ecEmail   = document.getElementById('am-tutor-group-ec-email')?.value;
        const ecName    = document.getElementById('am-tutor-group-ec-name')?.value;
        const ecSubject = document.getElementById('am-tutor-group-ec-subject')?.value.trim();
        const ecVisible = !document.getElementById('am-group-ec-section')?.classList.contains('hidden');
        if (ecVisible && ecEmail) {
            sharedAssignments.push({ category: 'Extra-Curricular', tutorEmail: ecEmail, tutorName: ecName, subject: ecSubject || 'Extra-Curricular', assignedDate: new Date().toISOString() });
        }
        const tpEmail   = document.getElementById('am-tutor-group-tp-email')?.value;
        const tpName    = document.getElementById('am-tutor-group-tp-name')?.value;
        const tpSubject = document.getElementById('am-tutor-group-tp-subject')?.value.trim();
        const tpVisible = !document.getElementById('am-group-tp-section')?.classList.contains('hidden');
        if (tpVisible && tpEmail) {
            sharedAssignments.push({ category: 'Test Prep', tutorEmail: tpEmail, tutorName: tpName, subject: tpSubject || 'Test Prep', assignedDate: new Date().toISOString() });
        }

        // Create a group ID
        const groupId   = `grp_${Date.now()}`;
        const groupName = `Group Class – ${academicName} (${new Date().toLocaleDateString('en-GB')})`;
        const createdBy = window.userData?.name || window.userData?.email || 'management';

        const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        const daysList  = days.split(/,|\band\b/i).map(d => d.trim()).filter(d => DAYS_LIST.includes(d));
        const scheduleEntries = daysList.length > 0
            ? daysList.map(day => ({ day, start: startTime, end: endTime }))
            : [{ day: days, start: startTime, end: endTime }];

        const createdIds = [];
        for (const st of students) {
            const studentData = {
                studentName: st.name,
                grade,
                days,
                academicDays: days,
                academicTime,
                subjects,
                parentName: st.parentName,
                parentPhone: st.parentPhone,
                parentEmail: st.parentEmail,
                studentFee: st.fee,
                tutorEmail: academicEmail,
                tutorName: academicName,
                subjectAssignments: sharedAssignments,
                groupId,
                groupName,
                status: 'approved',
                summerBreak: false,
                schedule: scheduleEntries,
                createdAt: Timestamp.now(),
                createdBy,
                tutorHistory: [{
                    tutorEmail: academicEmail,
                    tutorName: academicName,
                    assignedDate: Timestamp.now(),
                    assignedBy: window.userData?.email || 'management',
                    isCurrent: true
                }],
                gradeHistory: [{ grade, changedDate: Timestamp.now(), changedBy: window.userData?.email || 'management' }]
            };

            const ref = await addDoc(collection(db, 'students'), studentData);
            createdIds.push({ id: ref.id, name: st.name });

            await setDoc(doc(db, 'schedules', `sched_${ref.id}`), {
                studentId: ref.id,
                studentName: st.name,
                tutorEmail: academicEmail,
                schedule: scheduleEntries,
                academicDays: days,
                academicTime,
                source: 'management_assign_group',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });

            // Notifications
            for (const sa of sharedAssignments) {
                await addDoc(collection(db, 'tutor_notifications'), {
                    tutorEmail: sa.tutorEmail,
                    type: 'new_student',
                    title: `New Group Student — ${sa.category}`,
                    message: `${st.name} (${grade}) has been added to a group class under you for ${sa.subject}. Schedule: ${days} at ${academicTime}.`,
                    studentName: st.name,
                    grade,
                    subjects,
                    category: sa.category,
                    groupId,
                    groupName,
                    parentName: st.parentName,
                    parentPhone: st.parentPhone,
                    parentEmail: st.parentEmail,
                    studentFee: st.fee,
                    senderDisplay: 'Management',
                    read: false,
                    createdAt: Timestamp.now()
                });
            }
        }

        // Create groupClasses record
        await addDoc(collection(db, 'groupClasses'), {
            groupId,
            groupName,
            tutorEmail: academicEmail,
            tutorName: academicName,
            subject: subjects.join(', '),
            schedule: scheduleEntries,
            academicDays: days,
            academicTime,
            studentIds: createdIds.map(s => s.id),
            studentNames: createdIds.map(s => s.name),
            studentCount: createdIds.length,
            subjectAssignments: sharedAssignments,
            status: 'active',
            createdAt: Timestamp.now(),
            createdBy
        });

        alert(`Group class created with ${students.length} students, each with a unique ID!`);
        closeManagementModal('assign-modal');
        invalidateCache('students');
        invalidateCache('tutorAssignments');
        renderManagementTutorView(document.getElementById('main-content'));
    }
}


// ======================================================
// GLOBAL EXPORTS
// ======================================================

window.showTransitionStudentModal = showTransitionStudentModal;
window.showCreateGroupClassModal = showCreateGroupClassModal;
window.showEnhancedReassignStudentModal = showEnhancedReassignStudentModal;
window.showManageTransitionModal = showManageTransitionModal;

function handleEditStudent(studentId) {
    const student = window.__allStudents?.find(s => s.id === studentId);
    if (!student) { alert('Student not found. Please refresh.'); return; }
    const existing = document.getElementById('edit-student-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', `
        <div id="edit-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[9999] p-4">
            <div class="bg-white w-full max-w-lg rounded-lg shadow-xl" style="max-height:90vh;overflow-y:auto;">
                <div class="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
                    <h3 class="text-xl font-bold text-gray-800">Edit Student</h3>
                    <button onclick="document.getElementById('edit-student-modal').remove()" class="text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
                </div>
                <form id="edit-student-form" class="p-5 space-y-3">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Student Name <span class="text-red-500">*</span></label>
                        <input type="text" id="edit-studentName" value="${escapeHtml(student.studentName || '')}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                        <select id="edit-grade" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">${buildGradeOptions(student.grade)}</select></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Days/Week</label>
                        <input type="text" id="edit-days" value="${escapeHtml(student.days || '')}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                            <select id="edit-start-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">${buildTimeOptions(student.schedule?.[0]?.start)}</select></div>
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <select id="edit-end-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">${buildTimeOptions(student.schedule?.[0]?.end)}</select></div>
                    </div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Academic Subjects</label>
                        <input type="text" id="edit-subjects" value="${escapeHtml((student.subjects || []).join(', '))}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                        <input type="text" id="edit-parentName" value="${escapeHtml(student.parentName || '')}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                        <input type="text" id="edit-parentPhone" value="${escapeHtml(student.parentPhone || '')}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Email</label>
                        <input type="email" id="edit-parentEmail" value="${escapeHtml(student.parentEmail || '')}" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Tutor Fee (₦)</label>
                        <input type="number" id="edit-tutorFee" value="${student.tutorFee ?? student.studentFee ?? 0}" min="0" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"></div>
                    <div class="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onclick="document.getElementById('edit-student-modal').remove()" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `);
    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            const updates = {
                studentName: document.getElementById('edit-studentName').value.trim(),
                grade:       document.getElementById('edit-grade').value,
                days:        document.getElementById('edit-days').value.trim(),
                subjects:    document.getElementById('edit-subjects').value.split(',').map(s => s.trim()).filter(Boolean),
                parentName:  document.getElementById('edit-parentName').value.trim(),
                parentPhone: document.getElementById('edit-parentPhone').value.trim(),
                parentEmail: document.getElementById('edit-parentEmail').value.trim(),
                tutorFee:    Number(document.getElementById('edit-tutorFee').value) || 0,
                studentFee:  Number(document.getElementById('edit-tutorFee').value) || 0,
                updatedAt:   new Date().toISOString(),
                updatedBy:   window.userData?.name || window.userData?.email || 'management'
            };
            const startTime = document.getElementById('edit-start-time').value;
            const endTime   = document.getElementById('edit-end-time').value;
            if (startTime && endTime) {
                updates.academicTime = formatTimeTo12h(startTime) + ' - ' + formatTimeTo12h(endTime);
                updates.schedule = [{ start: startTime, end: endTime }];
            }
            if (!updates.studentName) { alert('Student name is required.'); btn.disabled=false; btn.textContent='Save Changes'; return; }
            await updateDoc(doc(db, 'students', studentId), updates);
            alert('"' + updates.studentName + '" updated successfully!');
            document.getElementById('edit-student-modal').remove();
            invalidateCache('students');
            sessionCache._lastUpdate = 0;
            fetchAndRenderDirectory(true);
        } catch(err) {
            console.error('Edit student error:', err);
            alert('Failed to save: ' + err.message);
            btn.disabled = false; btn.textContent = 'Save Changes';
        }
    });
}

function handleDeleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student? This cannot be undone.')) return;
    deleteDoc(doc(db, 'students', studentId))
        .then(() => { alert('Student deleted.'); fetchAndRenderDirectory(true); })
        .catch(err => alert('Error deleting student: ' + err.message));
}

window.handleEditStudent = handleEditStudent;
window.handleDeleteStudent = handleDeleteStudent;

// ======================================================
