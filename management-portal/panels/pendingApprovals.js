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

// ============================================================
// HELPERS
// ============================================================

/**
 * Resolve the best available grade for a student.
 * Priority: enrollmentData.actualGrade → actualGrade → enrollmentData.grade → grade
 */
function resolveGrade(student) {
    return student.enrollmentData?.actualGrade
        || student.actualGrade
        || student.enrollmentData?.grade
        || student.grade
        || 'N/A';
}

/**
 * Returns true when the student is grade 3–12 and hasn't completed a placement test.
 * Centralised so every caller (render + approve) stays in sync.
 */
function computeNeedsPlacementTest(student) {
    const grade = resolveGrade(student);
    const gradeNum = parseInt(String(grade).toLowerCase().replace('grade', '').trim(), 10);
    return !isNaN(gradeNum) && gradeNum >= 3 && gradeNum <= 12
        && student.placementTestStatus !== 'completed';
}

/**
 * getLagosDatetime() returns a formatted string, NOT a Date object.
 * Timestamp.fromDate() requires a real Date — this wrapper ensures that.
 */
function getNowDate() {
    return new Date();
}

/**
 * Ensures sessionCache.tutors is populated before any modal that needs it.
 */
async function ensureTutorsLoaded() {
    if (sessionCache.tutors && sessionCache.tutors.length > 0) return sessionCache.tutors;
    try {
        const snapshot = await getDocs(collection(db, 'tutors'));
        sessionCache.tutors = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error loading tutors:', err);
        sessionCache.tutors = [];
    }
    return sessionCache.tutors;
}

// ============================================================
// SUBSECTION 5.3: Pending Approvals Panel
// ============================================================

export async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="pending-search"
                        placeholder="Search by student, parent, or tutor..."
                        class="p-2 border rounded-md w-64">
                    <button id="refresh-pending-btn"
                        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn')
        .addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    document.getElementById('pending-search')
        .addEventListener('input', (e) => filterPendingApprovals(e.target.value));
    fetchAndRenderPendingApprovals();
}

// ============================================================
// FETCH
// ============================================================

export async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) invalidateCache('pendingStudents');
    const listContainer = document.getElementById('pending-approvals-list');

    try {
        if (!sessionCache.pendingStudents) {
            listContainer.innerHTML =
                `<p class="text-center text-gray-500 py-10">Fetching pending students...</p>`;

            const snapshot = await getDocs(query(collection(db, 'pending_students')));
            const pendingStudents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fetch enrollment data to get actualGrade and other enrollment fields
            for (const student of pendingStudents.filter(s => s.enrollmentId)) {
                try {
                    const enrollmentDoc = await getDoc(doc(db, 'enrollments', student.enrollmentId));
                    if (enrollmentDoc.exists()) student.enrollmentData = enrollmentDoc.data();
                } catch (err) {
                    console.error('Error fetching enrollment data:', err);
                }
            }

            // FIX: explicitly set sessionCache AND persist — previously only localStorage was set
            // which meant sessionCache.pendingStudents stayed null and the list always rendered blank
            sessionCache.pendingStudents = pendingStudents;
            saveToLocalStorage('pendingStudents', pendingStudents);
        }
        renderPendingApprovalsFromCache();
    } catch (error) {
        console.error('Error fetching pending students:', error);
        listContainer.innerHTML =
            `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

// ============================================================
// FILTER
// ============================================================

export function filterPendingApprovals(searchTerm = '') {
    const pendingStudents = sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const filtered = pendingStudents.filter(s =>
            s.studentName?.toLowerCase().includes(term) ||
            s.parentName?.toLowerCase().includes(term) ||
            s.tutorEmail?.toLowerCase().includes(term) ||
            s.parentEmail?.toLowerCase().includes(term) ||
            s.parentPhone?.toLowerCase().includes(term)
        );
        renderPendingApprovalsFromCache(filtered);
    } else {
        renderPendingApprovalsFromCache(pendingStudents);
    }
}

// ============================================================
// RENDER
// ============================================================

export function renderPendingApprovalsFromCache(studentsToRender = null) {
    const pendingStudents = studentsToRender || sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (pendingStudents.length === 0) {
        listContainer.innerHTML =
            `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
        return;
    }

    listContainer.innerHTML = pendingStudents.map(student => {
        // Resolve tutor display name
        let tutorName = student.tutorEmail || 'Not assigned';
        if (sessionCache.tutors) {
            const tutor = sessionCache.tutors.find(t => t.email === student.tutorEmail);
            if (tutor) tutorName = tutor.name;
        }

        const daysDisplay     = student.academicDays || student.days || 'To be determined';
        const timeDisplay     = student.academicTime || student.time || '';
        const scheduleDisplay = timeDisplay ? `${daysDisplay} \u2014 ${timeDisplay}` : daysDisplay;

        // FIX: Grade pulled from enrollment feed first (actualGrade), then fallbacks
        const gradeDisplay   = resolveGrade(student);
        const needsPlacement = computeNeedsPlacementTest(student);

        // Placement status badge (informational only for management)
        let placementBadge = '';
        if (student.placementTestStatus === 'completed') {
            const scoreStr = student.placementTestScore != null
                ? ` \u2014 Score: ${student.placementTestScore}%` : '';
            placementBadge = `<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                \u2705 Placement Done${escapeHtml(scoreStr)}</span>`;
        } else if (student.placementTestStatus === 'requested') {
            placementBadge = `<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                \u23F3 Awaiting Tutor Placement Test</span>`;
        } else if (needsPlacement) {
            placementBadge = `<span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-semibold">
                \uD83D\uDCDD Needs Placement Test</span>`;
        }

        // "Request Placement Test" button — for grades 3-12 that haven't been requested yet.
        // Clicking this sets placementTestStatus = 'requested' in Firestore which triggers
        // the placement test button to appear in the assigned tutor's dashboard.
        const gradeNum = parseInt(String(gradeDisplay).toLowerCase().replace('grade', '').trim(), 10);
        const isEligibleGrade = !isNaN(gradeNum) && gradeNum >= 3 && gradeNum <= 12;
        const alreadyRequested = student.placementTestStatus === 'requested' || student.placementTestStatus === 'completed';
        const placementBtn = isEligibleGrade && !alreadyRequested
            ? `<button class="request-placement-btn bg-indigo-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-indigo-600 transition-colors" data-student-id="${student.id}" title="Notify tutor to conduct placement test">
                   <i class="fas fa-paper-plane mr-1"></i>Request Placement Test
               </button>` : '';

        const approveTitle = needsPlacement
            ? 'Placement test not yet completed \u2014 you can still approve'
            : 'Approve student';
        const approveDim = needsPlacement ? 'opacity-60' : '';

        const subjectsDisplay = Array.isArray(student.subjects)
            ? student.subjects.join(', ')
            : (student.enrollmentData?.subjects
                ? (Array.isArray(student.enrollmentData.subjects)
                    ? student.enrollmentData.subjects.join(', ')
                    : student.enrollmentData.subjects)
                : student.subjects || 'N/A');

        return `
            <div class="border p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <h3 class="font-bold text-lg text-gray-800">${escapeHtml(student.studentName || 'Unknown')}</h3>
                            ${student.enrollmentId ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">From Enrollment</span>` : ''}
                            ${placementBadge}
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                            <div>
                                <p><i class="fas fa-user-friends mr-2 text-gray-400"></i><strong>Parent:</strong> ${escapeHtml(student.parentName || 'N/A')}</p>
                                <p><i class="fas fa-phone mr-2 text-gray-400"></i>${escapeHtml(student.parentPhone || 'N/A')}</p>
                                <p><i class="fas fa-envelope mr-2 text-gray-400"></i>${escapeHtml(student.parentEmail || 'N/A')}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-chalkboard-teacher mr-2 text-gray-400"></i><strong>Tutor:</strong> ${escapeHtml(tutorName)}</p>
                                <p><i class="fas fa-graduation-cap mr-2 text-gray-400"></i><strong>Grade:</strong> ${escapeHtml(gradeDisplay)}</p>
                                <p><i class="fas fa-money-bill-wave mr-2 text-gray-400"></i><strong>Fee:</strong> &#x20A6;${(student.studentFee || 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-book mr-2 text-gray-400"></i><strong>Subjects:</strong> ${escapeHtml(subjectsDisplay)}</p>
                                <p><i class="fas fa-calendar mr-2 text-gray-400"></i><strong>Schedule:</strong> ${escapeHtml(scheduleDisplay)}</p>
                                ${student.type ? `<p><i class="fas fa-tag mr-2 text-gray-400"></i><strong>Type:</strong> ${escapeHtml(student.type)}</p>` : ''}
                            </div>
                        </div>
                        ${student.source === 'enrollment_approval' ? `<p class="text-xs text-green-600 mt-2"><i class="fas fa-check-circle mr-1"></i>Approved from enrollment application.</p>` : ''}
                        ${student.placementTestNotes ? `<p class="text-xs text-indigo-700 mt-1 italic"><i class="fas fa-sticky-note mr-1"></i>${escapeHtml(student.placementTestNotes)}</p>` : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-600 transition-colors" data-student-id="${student.id}">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        ${placementBtn}
                        <button class="approve-btn bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 transition-colors ${approveDim}" data-student-id="${student.id}" title="${approveTitle}">
                            <i class="fas fa-check mr-1"></i>Approve
                        </button>
                        <button class="reject-btn bg-red-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-red-700 transition-colors" data-student-id="${student.id}">
                            <i class="fas fa-times mr-1"></i>Reject
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listContainer.querySelectorAll('.edit-pending-btn').forEach(btn =>
        btn.addEventListener('click', () => handleEditPendingStudent(btn.dataset.studentId)));
    listContainer.querySelectorAll('.request-placement-btn').forEach(btn =>
        btn.addEventListener('click', () => handleRequestPlacementTest(btn.dataset.studentId)));
    listContainer.querySelectorAll('.approve-btn').forEach(btn =>
        btn.addEventListener('click', () => handleApproveStudent(btn.dataset.studentId)));
    listContainer.querySelectorAll('.reject-btn').forEach(btn =>
        btn.addEventListener('click', () => handleRejectStudent(btn.dataset.studentId)));
}

// ============================================================
// HANDLER: Request Placement Test (notifies tutor dashboard)
// Sets placementTestStatus = 'requested' in Firestore.
// The tutor's dashboard reads this field and shows the
// placement test button next to the student's name.
// ============================================================

export async function handleRequestPlacementTest(studentId) {
    const student = (sessionCache.pendingStudents || []).find(s => s.id === studentId);
    if (!student) { alert('Student not found.'); return; }

    if (!student.tutorEmail) {
        alert('No tutor is assigned to this student yet.\nPlease assign a tutor before requesting a placement test.');
        return;
    }

    const confirmed = window.confirm(
        `Send a placement test request for "${student.studentName}" to tutor: ${student.tutorEmail}?\n\n` +
        `A placement test button will appear in the tutor's dashboard for this student.`
    );
    if (!confirmed) return;

    try {
        const updates = {
            placementTestStatus: 'requested',
            placementTestRequestedAt: Timestamp.fromDate(getNowDate()),
            placementTestRequestedBy: 'management',
        };
        await updateDoc(doc(db, 'pending_students', studentId), updates);

        const idx = (sessionCache.pendingStudents || []).findIndex(s => s.id === studentId);
        if (idx !== -1) {
            sessionCache.pendingStudents[idx] = { ...sessionCache.pendingStudents[idx], ...updates };
            saveToLocalStorage('pendingStudents', sessionCache.pendingStudents);
        }

        await logManagementActivity('placement_test_requested', {
            studentId,
            studentName: student.studentName,
            tutorEmail: student.tutorEmail,
        });

        renderPendingApprovalsFromCache();
        alert(`\u2705 Placement test requested. The assigned tutor will see it in their dashboard.`);
    } catch (err) {
        console.error('Error requesting placement test:', err);
        alert('Failed to send request. Please try again.');
    }
}

// ============================================================
// HANDLER: Edit a pending student
// ============================================================

export async function handleEditPendingStudent(studentId) {
    const student = (sessionCache.pendingStudents || []).find(s => s.id === studentId);
    if (!student) { alert('Student not found.'); return; }

    // Always ensure tutors are loaded before opening modal
    const tutors = await ensureTutorsLoaded();
    const tutorOptions = tutors.map(t =>
        `<option value="${escapeHtml(t.email)}" ${student.tutorEmail === t.email ? 'selected' : ''}>
            ${escapeHtml(t.name)} (${escapeHtml(t.email)})
        </option>`
    ).join('');

    // Grade: resolved from enrollment feed first
    const gradeValue = resolveGrade(student) === 'N/A' ? '' : resolveGrade(student);
    const gradeField = typeof buildGradeOptions === 'function' && buildGradeOptions(gradeValue)
        ? `<select id="edit-grade" class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">${buildGradeOptions(gradeValue)}</select>`
        : `<input id="edit-grade" type="text" value="${escapeHtml(gradeValue)}" class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">`;

    // Subjects: pull from enrollment data if not directly on student
    const subjectsValue = Array.isArray(student.subjects)
        ? student.subjects.join(', ')
        : student.subjects
            || (Array.isArray(student.enrollmentData?.subjects)
                ? student.enrollmentData.subjects.join(', ')
                : student.enrollmentData?.subjects || '');

    const modal = document.createElement('div');
    modal.id = 'edit-pending-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center p-5 border-b">
                <h3 class="text-lg font-bold text-gray-800">Edit Pending Student</h3>
                <button id="close-edit-pending-modal" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                    <input id="edit-student-name" type="text" value="${escapeHtml(student.studentName || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                    <input id="edit-parent-name" type="text" value="${escapeHtml(student.parentName || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                    <input id="edit-parent-phone" type="text" value="${escapeHtml(student.parentPhone || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Parent Email</label>
                    <input id="edit-parent-email" type="email" value="${escapeHtml(student.parentEmail || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Assigned Tutor <span class="text-red-500">*</span>
                        ${tutors.length === 0 ? '<span class="text-orange-500 text-xs ml-1">(No tutors loaded)</span>' : ''}
                    </label>
                    <select id="edit-tutor-email" class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                        <option value="">&#8212; Select tutor &#8212;</option>
                        ${tutorOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                    ${gradeField}
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
                    <input id="edit-subjects" type="text" value="${escapeHtml(subjectsValue)}"
                        placeholder="e.g. Maths, English, Science"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                    <p class="text-xs text-gray-400 mt-1">Separate multiple subjects with commas</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Fee (&#x20A6;)</label>
                    <input id="edit-student-fee" type="number" min="0" value="${student.studentFee || 0}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Schedule (Days)</label>
                    <input id="edit-academic-days" type="text" value="${escapeHtml(student.academicDays || student.days || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Schedule (Time)</label>
                    <input id="edit-academic-time" type="text" value="${escapeHtml(student.academicTime || student.time || '')}"
                        class="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                </div>
                <div id="edit-pending-error" class="hidden text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2"></div>
            </div>
            <div class="flex justify-end gap-3 p-5 border-t">
                <button id="cancel-edit-pending-btn" class="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button id="save-edit-pending-btn" class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    document.getElementById('close-edit-pending-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-pending-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.getElementById('save-edit-pending-btn').addEventListener('click', async () => {
        const errorDiv = document.getElementById('edit-pending-error');
        errorDiv.classList.add('hidden');

        const tutorEmail = document.getElementById('edit-tutor-email').value.trim();
        if (!tutorEmail) {
            errorDiv.textContent = 'Please select an assigned tutor.';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Parse subjects into a clean array
        const subjectsRaw = document.getElementById('edit-subjects').value.trim();
        const subjectsArray = subjectsRaw
            ? subjectsRaw.split(',').map(s => sanitizeInput(s.trim())).filter(Boolean)
            : [];

        const updates = {
            studentName:  sanitizeInput(document.getElementById('edit-student-name').value.trim()),
            parentName:   sanitizeInput(document.getElementById('edit-parent-name').value.trim()),
            parentPhone:  sanitizeInput(document.getElementById('edit-parent-phone').value.trim()),
            parentEmail:  sanitizeInput(document.getElementById('edit-parent-email').value.trim()),
            tutorEmail,
            actualGrade:  sanitizeInput(document.getElementById('edit-grade').value.trim()),
            subjects:     subjectsArray,
            studentFee:   parseFloat(document.getElementById('edit-student-fee').value) || 0,
            academicDays: sanitizeInput(document.getElementById('edit-academic-days').value.trim()),
            academicTime: sanitizeInput(document.getElementById('edit-academic-time').value.trim()),
        };

        const saveBtn = document.getElementById('save-edit-pending-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving\u2026';

        try {
            await updateDoc(doc(db, 'pending_students', studentId), updates);

            const idx = (sessionCache.pendingStudents || []).findIndex(s => s.id === studentId);
            if (idx !== -1) {
                sessionCache.pendingStudents[idx] = { ...sessionCache.pendingStudents[idx], ...updates };
                saveToLocalStorage('pendingStudents', sessionCache.pendingStudents);
            }

            await logManagementActivity('edit_pending_student', { studentId, studentName: updates.studentName });
            closeModal();
            renderPendingApprovalsFromCache();
        } catch (err) {
            console.error('Error saving pending student edits:', err);
            errorDiv.textContent = 'Failed to save changes. Please try again.';
            errorDiv.classList.remove('hidden');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
}

// ============================================================
// HANDLER: Approve a pending student
// ============================================================

export async function handleApproveStudent(studentId) {
    const student = (sessionCache.pendingStudents || []).find(s => s.id === studentId);
    if (!student) { alert('Student not found.'); return; }

    if (!student.tutorEmail) {
        alert('This student has no assigned tutor.\nPlease edit the record and assign a tutor before approving.');
        return;
    }

    // Warn if placement test not done — management can still override
    if (computeNeedsPlacementTest(student)) {
        const bypass = window.confirm(
            '\u26A0\uFE0F "' + student.studentName + '" has not completed their placement test yet.\n\n' +
            'Press OK to approve anyway, or Cancel to request the placement test first.'
        );
        if (!bypass) return;
    }

    const confirmed = window.confirm(
        'Approve "' + student.studentName + '" and move them to active students?\n\n' +
        'Tutor: ' + student.tutorEmail + '\n' +
        'Grade: ' + resolveGrade(student)
    );
    if (!confirmed) return;

    try {
        const now   = getNowDate();
        const batch = writeBatch(db);

        const resolvedGrade = resolveGrade(student);

        const studentData = {
            ...student,
            status:             'active',
            // Normalise grade from enrollment feed so isPlacementTestEligible()
            // in tutor.js always has a valid value to parse.
            grade:              resolvedGrade,
            actualGrade:        resolvedGrade,
            // Flag that this student came through pending approvals.
            // tutor.js reads this to bypass the Feb-26-2026 date cutoff and
            // always show the placement test button for eligible grades.
            fromPendingApproval: true,
            // Preserve placementTestStatus if management already requested it,
            // otherwise leave it as-is (could be undefined / 'pending').
            placementTestStatus: student.placementTestStatus || null,
            approvedAt:         Timestamp.fromDate(now),
            approvedMonth:      getCurrentMonthKeyLagos ? getCurrentMonthKeyLagos() : null,
        };
        delete studentData.id;
        delete studentData.enrollmentData; // don't copy the nested fetch artifact

        const newStudentRef = doc(collection(db, 'students'));
        batch.set(newStudentRef, studentData);
        batch.delete(doc(db, 'pending_students', studentId));
        await batch.commit();

        if (sessionCache.pendingStudents) {
            sessionCache.pendingStudents = sessionCache.pendingStudents.filter(s => s.id !== studentId);
            saveToLocalStorage('pendingStudents', sessionCache.pendingStudents);
        }
        invalidateCache('students');

        await logStudentEvent(newStudentRef.id, 'approved', {
            approvedBy: 'admin', studentName: student.studentName });
        await logManagementActivity('approve_student', {
            studentId, newStudentId: newStudentRef.id, studentName: student.studentName });

        renderPendingApprovalsFromCache();
        alert('\u2705 "' + student.studentName + '" has been approved and added to active students.');
    } catch (err) {
        console.error('Error approving student:', err);
        alert('Failed to approve student. Please try again.');
    }
}

// ============================================================
// HANDLER: Reject / delete a pending student
// ============================================================

export async function handleRejectStudent(studentId) {
    const student = (sessionCache.pendingStudents || []).find(s => s.id === studentId);
    if (!student) { alert('Student not found.'); return; }

    const reason = window.prompt(
        'Reject "' + student.studentName + '"?\n\nOptionally provide a reason (leave blank to skip):',
        ''
    );
    if (reason === null) return; // user cancelled

    try {
        await deleteDoc(doc(db, 'pending_students', studentId));

        if (sessionCache.pendingStudents) {
            sessionCache.pendingStudents = sessionCache.pendingStudents.filter(s => s.id !== studentId);
            saveToLocalStorage('pendingStudents', sessionCache.pendingStudents);
        }

        await logManagementActivity('reject_pending_student', {
            studentId,
            studentName: student.studentName,
            reason: reason || 'No reason provided',
        });

        renderPendingApprovalsFromCache();
        alert('\u274C "' + student.studentName + '" has been rejected and removed from the pending list.');
    } catch (err) {
        console.error('Error rejecting student:', err);
        alert('Failed to reject student. Please try again.');
    }
}
