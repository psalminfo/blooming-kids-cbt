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
    // Get user permissions
    const userPermissions = window.userData?.permissions?.tabs || {};
    
    // Determine which cards to show based on permissions
    const showTutorsCard = userPermissions.viewTutorManagement === true;
    const showStudentsCard = userPermissions.viewTutorManagement === true;
    const showPendingCard = userPermissions.viewPendingApprovals === true;
    const showsCard = userPermissions.viewEnrollments === true;
    
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

export async function loadDashboardData() {
    try {
        const userPermissions = window.userData?.permissions?.tabs || {};
        
        // Load Active Tutors count (only if user has permission)
        if (userPermissions.viewTutorManagement === true) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
            const allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeTutors = allTutors.filter(tutor => !tutor.status || tutor.status === 'active');
            saveToLocalStorage('tutors', activeTutors);
            const tutorsElement = document.getElementById('dashboard-active-tutors');
            if (tutorsElement) tutorsElement.textContent = activeTutors.length;
        }

        // Load Active Students count (only if user has permission)
        if (userPermissions.viewTutorManagement === true) {
            const studentsSnapshot = await getDocs(query(collection(db, "students")));
            const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeStudents = allStudents.filter(student =>
                (student.status === 'active' || student.status === 'approved') &&
                !student.summerBreak &&
                student.status !== 'archived' &&
                student.status !== 'graduated' &&
                student.status !== 'transferred'
            );
            saveToLocalStorage('students', activeStudents);
            const studentsElement = document.getElementById('dashboard-active-students');
            if (studentsElement) studentsElement.textContent = activeStudents.length;
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