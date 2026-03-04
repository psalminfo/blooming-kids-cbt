// ============================================================
// panels/pendingApprovals.js
// Pending student approvals list
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

// SUBSECTION 5.3: Pending Approvals Panel (UPDATED)
// ======================================================

export async function renderPendingApprovalsPanel(container) {
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

export async function fetchAndRenderPendingApprovals(forceRefresh = false) {
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

export function filterPendingApprovals(searchTerm = '') {
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

export function renderPendingApprovalsFromCache(studentsToRender = null) {
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
