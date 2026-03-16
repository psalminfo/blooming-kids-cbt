// ============================================================
// panels/dashboard.js
// Dashboard stats & quick-action cards
// ============================================================

import { db } from '../core/firebase.js';
import {
         Timestamp, addDoc, collection, deleteDoc,
         doc, getDoc, getDocs, limit,
         onSnapshot, orderBy, query, setDoc,
         startAfter, updateDoc, where, writeBatch
    } from '../core/firebase.js';
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
    const userPermissions = window.userData?.permissions?.tabs || {};

    const showTutorsCard   = userPermissions.viewTutorManagement === true;
    const showStudentsCard  = userPermissions.viewTutorManagement === true;
    const showPendingCard   = userPermissions.viewPendingApprovals === true;
    const showsCard         = userPermissions.views === true;

    const visibleCardsCount = [showTutorsCard, showStudentsCard, showPendingCard, showsCard]
        .filter(Boolean).length;

    let gridCols = 'grid-cols-1';
    if (visibleCardsCount === 2)      gridCols = 'md:grid-cols-2';
    else if (visibleCardsCount === 3) gridCols = 'md:grid-cols-3 lg:grid-cols-3';
    else if (visibleCardsCount >= 4)  gridCols = 'md:grid-cols-2 lg:grid-cols-4';

    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-6">Management Dashboard</h2>

            <div class="grid ${gridCols} gap-6 mb-8">

                <!-- Tutors Card -->
                ${showTutorsCard ? `
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-chalkboard-teacher text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-blue-800">Tutors</h3>
                            <p class="text-sm text-blue-600">Active & Inactive</p>
                        </div>
                    </div>
                    <!-- Tab buttons -->
                    <div class="flex gap-2 mb-3">
                        <button id="tutor-tab-active"
                            onclick="switchTutorTab('active')"
                            class="flex-1 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white transition-colors">
                            Active
                        </button>
                        <button id="tutor-tab-inactive"
                            onclick="switchTutorTab('inactive')"
                            class="flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-blue-600 border border-blue-300 transition-colors">
                            Inactive
                        </button>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-active-tutors" class="text-4xl font-bold text-blue-700 mb-1">0</p>
                        <p id="tutor-tab-label" class="text-xs text-blue-500">Active tutors</p>
                    </div>
                </div>
                ` : ''}

                <!-- Students Card -->
                ${showStudentsCard ? `
                <div class="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-user-graduate text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-green-800">Students</h3>
                            <p class="text-sm text-green-600">Active & Archived</p>
                        </div>
                    </div>
                    <!-- Tab buttons -->
                    <div class="flex gap-2 mb-3">
                        <button id="student-tab-active"
                            onclick="switchStudentTab('active')"
                            class="flex-1 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white transition-colors">
                            Active
                        </button>
                        <button id="student-tab-archived"
                            onclick="switchStudentTab('archived')"
                            class="flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-green-600 border border-green-300 transition-colors">
                            Archived
                        </button>
                    </div>
                    <div class="text-center">
                        <p id="dashboard-active-students" class="text-4xl font-bold text-green-700 mb-1">0</p>
                        <p id="student-tab-label" class="text-xs text-green-500">Active students</p>
                    </div>
                </div>
                ` : ''}

                <!-- Pending Approvals Card -->
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

                <!-- Total Enrollments Card -->
                ${showsCard ? `
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

            ${visibleCardsCount === 0 ? `
                <div class="text-center py-8 bg-gray-50 rounded-lg border">
                    <i class="fas fa-chart-bar text-gray-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-600 mb-2">No Dashboard Access</h3>
                    <p class="text-gray-500">You don't have permission to view any dashboard metrics.</p>
                    <p class="text-sm text-gray-400 mt-2">Contact an administrator for access.</p>
                </div>
            ` : ''}

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

    if (showTutorsCard) {
        document.getElementById('quick-action-assign')?.addEventListener('click', showAssignStudentModal);
        document.getElementById('quick-action-archive')?.addEventListener('click', showArchiveStudentModal);
        document.getElementById('quick-action-inactive')?.addEventListener('click', showMarkInactiveModal);
    }

    loadDashboardData();
}

// ── Tab switchers ────────────────────────────────────────────

window.switchTutorTab = function(tab) {
    const countEl = document.getElementById('dashboard-active-tutors');
    const labelEl = document.getElementById('tutor-tab-label');
    const btnActive   = document.getElementById('tutor-tab-active');
    const btnInactive = document.getElementById('tutor-tab-inactive');

    if (tab === 'active') {
        if (countEl) countEl.textContent = window._dashTutorActive ?? '0';
        if (labelEl) labelEl.textContent = 'Active tutors';
        btnActive?.classList.replace('bg-white', 'bg-blue-600');
        btnActive?.classList.replace('text-blue-600', 'text-white');
        btnInactive?.classList.replace('bg-blue-600', 'bg-white');
        btnInactive?.classList.replace('text-white', 'text-blue-600');
    } else {
        if (countEl) countEl.textContent = window._dashTutorInactive ?? '0';
        if (labelEl) labelEl.textContent = 'Inactive tutors';
        btnInactive?.classList.replace('bg-white', 'bg-blue-600');
        btnInactive?.classList.replace('text-blue-600', 'text-white');
        btnActive?.classList.replace('bg-blue-600', 'bg-white');
        btnActive?.classList.replace('text-white', 'text-blue-600');
    }
};

window.switchStudentTab = function(tab) {
    const countEl  = document.getElementById('dashboard-active-students');
    const labelEl  = document.getElementById('student-tab-label');
    const btnActive   = document.getElementById('student-tab-active');
    const btnArchived = document.getElementById('student-tab-archived');

    if (tab === 'active') {
        if (countEl) countEl.textContent = window._dashStudentActive ?? '0';
        if (labelEl) labelEl.textContent = 'Active students';
        btnActive?.classList.replace('bg-white', 'bg-green-600');
        btnActive?.classList.replace('text-green-600', 'text-white');
        btnArchived?.classList.replace('bg-green-600', 'bg-white');
        btnArchived?.classList.replace('text-white', 'text-green-600');
    } else {
        if (countEl) countEl.textContent = window._dashStudentArchived ?? '0';
        if (labelEl) labelEl.textContent = 'Archived students';
        btnArchived?.classList.replace('bg-white', 'bg-green-600');
        btnArchived?.classList.replace('text-green-600', 'text-white');
        btnActive?.classList.replace('bg-green-600', 'bg-white');
        btnActive?.classList.replace('text-white', 'text-green-600');
    }
};

// ── Data loader ──────────────────────────────────────────────

export async function loadDashboardData() {
    try {
        const userPermissions = window.userData?.permissions?.tabs || {};

        if (userPermissions.viewTutorManagement === true) {

            // ── Tutors ──────────────────────────────────────────────
            if (!sessionCache.allTutors) {
                const snap = await getDocs(query(collection(db, 'tutors')));
                const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                sessionCache.allTutors = all;
            }
            const allTutors = sessionCache.allTutors || [];
            const activeTutors   = allTutors.filter(t => !t.status || t.status === 'active');
            const inactiveTutors = allTutors.filter(t => t.status === 'inactive' || t.status === 'on_leave');

            // Store for tab switching
            window._dashTutorActive   = activeTutors.length;
            window._dashTutorInactive = inactiveTutors.length;

            // Default view = active
            const tutorsEl = document.getElementById('dashboard-active-tutors');
            if (tutorsEl) tutorsEl.textContent = activeTutors.length;

            // Also keep legacy cache key for other panels
            saveToLocalStorage('tutors', activeTutors);

            // ── Students ────────────────────────────────────────────
            if (!sessionCache.allStudents) {
                const snap = await getDocs(query(collection(db, 'students')));
                const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                sessionCache.allStudents = all;
            }
            const allStudents = sessionCache.allStudents || [];
            const activeStudents = allStudents.filter(s =>
                (!s.status || s.status === 'active' || s.status === 'approved') &&
                !s.summerBreak &&
                s.status !== 'archived' &&
                s.status !== 'graduated' &&
                s.status !== 'transferred'
            );
            const archivedStudents = allStudents.filter(s =>
                s.status === 'archived' ||
                s.status === 'graduated' ||
                s.status === 'transferred'
            );

            window._dashStudentActive   = activeStudents.length;
            window._dashStudentArchived = archivedStudents.length;

            const studentsEl = document.getElementById('dashboard-active-students');
            if (studentsEl) studentsEl.textContent = activeStudents.length;

            saveToLocalStorage('students', activeStudents);
        }

        // ── Pending Approvals ───────────────────────────────────────
        if (userPermissions.viewPendingApprovals === true) {
            if (!sessionCache.pendingStudents) {
                const snap = await getDocs(query(collection(db, 'pending_students')));
                saveToLocalStorage('pendingStudents', snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
            const pendingEl = document.getElementById('dashboard-pending-approvals');
            if (pendingEl) pendingEl.textContent = (sessionCache.pendingStudents || []).length;
        }

        // ── Enrollments ─────────────────────────────────────────────
        if (userPermissions.viewEnrollments === true) {
            if (!sessionCache.enrollments) {
                const snap = await getDocs(query(collection(db, 'enrollments')));
                saveToLocalStorage('enrollments', snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
            const enrollmentsEl = document.getElementById('dashboard-total-enrollments');
            if (enrollmentsEl) enrollmentsEl.textContent = (sessionCache.enrollments || []).length;
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        ['dashboard-active-tutors','dashboard-active-students',
         'dashboard-pending-approvals','dashboard-total-enrollments'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error';
        });
    }
}

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
        const submitBtn = document.querySelector('#assign-student-modal button[onclick="submitAssignment()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Assigning...';
        submitBtn.disabled = true;

        const assignmentData = {
            tutorId, studentId,
            parentEmail: parentEmail || '',
            assignedBy: window.userData?.uid || 'system',
            assignedByEmail: window.userData?.email || 'system',
            assignedDate: new Date().toISOString(),
            status: 'active',
            notes: notes || '',
            lastModified: new Date().toISOString()
        };

        await addDoc(collection(db, 'tutorAssignments'), assignmentData);

        const tutorRef = doc(db, 'tutors', tutorId);
        const tutorDoc = await getDoc(tutorRef);
        if (tutorDoc.exists()) {
            const currentCount = tutorDoc.data().assignedStudentsCount || 0;
            await updateDoc(tutorRef, { assignedStudentsCount: currentCount + 1, lastModified: new Date().toISOString() });
        }

        const studentUpdateData = { tutorId, lastModified: new Date().toISOString() };
        if (parentEmail) studentUpdateData.parentEmail = parentEmail;
        await updateDoc(doc(db, 'students', studentId), studentUpdateData);

        invalidateCache('tutorAssignments');
        invalidateCache('tutors');
        invalidateCache('students');
        closeModal();
        alert('Student assigned successfully!');
        await refreshAllDashboardData();

    } catch (error) {
        console.error('Error assigning student:', error);
        alert('Failed to assign student. Please try again.');
        const submitBtn = document.querySelector('#assign-student-modal button[onclick="submitAssignment()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

export async function submitArchiveStudent() {
    const studentId   = document.getElementById('archive-student-select').value;
    const parentEmail = document.getElementById('archive-parent-email').value;
    const reason      = document.getElementById('archive-reason').value;
    const notes       = document.getElementById('archive-notes').value;

    if (!studentId || !reason) {
        alert('Please select a student and provide a reason.');
        return;
    }

    try {
        const submitBtn = document.querySelector('#archive-student-modal button[onclick="submitArchiveStudent()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Archiving...';
        submitBtn.disabled = true;

        const studentUpdateData = {
            status: 'archived',
            archiveReason: reason,
            archiveNotes: notes || '',
            archivedDate: new Date().toISOString(),
            archivedBy: window.userData?.uid || 'system',
            archivedByEmail: window.userData?.email || 'system',
            lastModified: new Date().toISOString()
        };
        if (parentEmail) studentUpdateData.parentEmail = parentEmail;
        await updateDoc(doc(db, 'students', studentId), studentUpdateData);

        const assignmentsSnapshot = await getDocs(query(
            collection(db, 'tutorAssignments'),
            where('studentId', '==', studentId),
            where('status', '==', 'active')
        ));

        if (!assignmentsSnapshot.empty) {
            const assignmentDoc = assignmentsSnapshot.docs[0];
            await updateDoc(doc(db, 'tutorAssignments', assignmentDoc.id), {
                status: 'archived', endDate: new Date().toISOString(), lastModified: new Date().toISOString()
            });
            const tutorRef = doc(db, 'tutors', assignmentDoc.data().tutorId);
            const tutorDoc = await getDoc(tutorRef);
            if (tutorDoc.exists()) {
                const currentCount = tutorDoc.data().assignedStudentsCount || 0;
                if (currentCount > 0) await updateDoc(tutorRef, { assignedStudentsCount: currentCount - 1, lastModified: new Date().toISOString() });
            }
        }

        invalidateCache('students');
        invalidateCache('tutorAssignments');
        invalidateCache('tutors');
        closeModal();
        alert('Student archived successfully!');
        await refreshAllDashboardData();

    } catch (error) {
        console.error('Error archiving student:', error);
        alert('Failed to archive student. Please try again.');
        const submitBtn = document.querySelector('#archive-student-modal button[onclick="submitArchiveStudent()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

export async function submitMarkInactive() {
    const tutorId = document.getElementById('inactive-tutor-select').value;
    const reason  = document.getElementById('inactive-reason').value;
    const notes   = document.getElementById('inactive-notes').value;

    if (!tutorId || !reason) {
        alert('Please select a tutor and provide a reason.');
        return;
    }

    try {
        const submitBtn = document.querySelector('#mark-inactive-modal button[onclick="submitMarkInactive()"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        submitBtn.disabled = true;

        await updateDoc(doc(db, 'tutors', tutorId), {
            status: 'inactive',
            inactiveReason: reason,
            inactiveNotes: notes || '',
            inactiveDate: new Date().toISOString(),
            markedInactiveBy: window.userData?.uid || 'system',
            markedInactiveByEmail: window.userData?.email || 'system',
            lastModified: new Date().toISOString()
        });

        const assignmentsSnapshot = await getDocs(query(
            collection(db, 'tutorAssignments'),
            where('tutorId', '==', tutorId),
            where('status', '==', 'active')
        ));

        if (!assignmentsSnapshot.empty) {
            const batch = writeBatch(db);
            assignmentsSnapshot.docs.forEach(d => {
                batch.update(d.ref, { status: 'pending_reassignment', endDate: new Date().toISOString(), lastModified: new Date().toISOString() });
            });
            await batch.commit();
        }

        invalidateCache('tutors');
        invalidateCache('tutorAssignments');
        invalidateCache('students');
        closeModal();
        alert('Tutor marked as inactive successfully! Their students now need reassignment.');
        await refreshAllDashboardData();

    } catch (error) {
        console.error('Error marking tutor inactive:', error);
        alert('Failed to mark tutor as inactive. Please try again.');
        const submitBtn = document.querySelector('#mark-inactive-modal button[onclick="submitMarkInactive()"]');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

window.closeModal = function() {
    ['assign-student-modal', 'archive-student-modal', 'mark-inactive-modal'].forEach(id => {
        document.getElementById(id)?.remove();
    });
};

document.addEventListener('click', function(event) {
    ['assign-student-modal', 'archive-student-modal', 'mark-inactive-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && event.target === modal) closeModal();
    });
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeModal();
});

window.refreshAllDashboardData = async function() {
    invalidateCache('tutors');
    invalidateCache('students');
    invalidateCache('pendingStudents');
    invalidateCache('enrollments');
    invalidateCache('tutorAssignments');
    // Clear extended caches too
    delete sessionCache.allTutors;
    delete sessionCache.allStudents;

    ['dashboard-active-tutors','dashboard-active-students',
     'dashboard-pending-approvals','dashboard-total-enrollments'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });

    await loadDashboardData();
    alert('Dashboard data refreshed successfully!');
};

// ======================================================
