// ============================================================
// panels/enrollments.js
// Enrollment review and tutor assignment approval
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
import { sessionCache, saveToLocalStorage, invalidateCache, switchToTabCached, invalidateTabCache } from '../core/cache.js';
import { logManagementActivity } from '../notifications/activityLog.js';

// SUBSECTION 5.2: Enrollments Panel (COMPREHENSIVE TUTOR DISPLAY)
// ======================================================

// Ensure global dependencies are available
if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded. Excel export will not work.');
}
if (typeof window.jspdf === 'undefined') {
    console.error('jsPDF library not loaded. PDF download will not work.');
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
export function safeParseDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (dateInput && typeof dateInput === 'object' && dateInput.seconds) { // Firestore Timestamp
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
export function formatDate(dateInput, fallback = 'Unknown date') {
    const date = safeParseDate(dateInput);
    return date ? date.toLocaleDateString() : fallback;
}

/**
 * Parse fee value from string or number, return rounded number
 */
export function parseFeeValue(feeValue) {
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
export function checkLibraries(libs) {
    const missing = libs.filter(lib => {
        if (lib === 'XLSX') return typeof XLSX === 'undefined';
        if (lib === 'jspdf') return typeof window.jspdf === 'undefined';
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
export async function checkTutorAssignments(enrollmentId, studentNames = []) {
    try {
        const assignments = [];

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
            const studentName = data.studentName || data.name || '';

            // Determine academic tutor
            let tutorName = data.tutorName;
            let tutorEmail = data.tutorEmail;
            let assignedDate = data.assignedDate || data.createdAt;

            // Check nested tutor object
            if (data.tutor) {
                tutorName = tutorName || data.tutor.tutorName || data.tutor.name;
                tutorEmail = tutorEmail || data.tutor.tutorEmail || data.tutor.email;
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
export function getEnrollmentAssignmentStatus(enrollment, tutorAssignments) {
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

export function buildComprehensiveStudentTutorAssignmentsHTML(student, studentAssignment, enrollment) {
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

export async function renderEnrollmentsPanel(container) {
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

export async function fetchAndRenderEnrollments(forceRefresh = false) {
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

            const enrollmentsWithAssignments = await Promise.all(enrollmentsData.map(async (enrollment) => {
                const assignments = await checkTutorAssignments(enrollment.id);
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

export function renderEnrollmentsFromCache(searchTerm = '') {
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

// -------------------- FIXED: Delete Enrollment Function --------------------

/**
 * Delete an enrollment and all related data
 */
window.deleteEnrollment = async function(enrollmentId) {
    if (!confirm('Are you sure you want to delete this enrollment? This action cannot be undone and will remove all associated student records.')) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        
        // Delete all students associated with this enrollment
        const studentsQuery = query(collection(db, "students"), where("enrollmentId", "==", enrollmentId));
        const studentsSnapshot = await getDocs(studentsQuery);
        studentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete all pending students associated with this enrollment
        const pendingQuery = query(collection(db, "pending_students"), where("enrollmentId", "==", enrollmentId));
        const pendingSnapshot = await getDocs(pendingQuery);
        pendingSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete schedules associated with these students (optional - can be handled by cascade)
        
        // Delete the enrollment document itself
        batch.delete(doc(db, "enrollments", enrollmentId));
        
        // Commit the batch
        await batch.commit();
        
        alert('Enrollment deleted successfully');
        
        // Clear cache and refresh
        delete sessionCache.enrollments;
        await fetchAndRenderEnrollments(true);
        
    } catch (error) {
        console.error('Error deleting enrollment:', error);
        alert('Failed to delete enrollment: ' + error.message);
    }
};

export function filterEnrollments(searchTerm) {
    renderEnrollmentsFromCache(searchTerm);
}

export function applyEnrollmentFilters() {
    renderEnrollmentsFromCache(document.getElementById('enrollments-search').value);
}

// -------------------- Export Functions --------------------

export function showExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) exportRangeDiv.classList.remove('hidden');
}

export function hideExportRangePicker() {
    const exportRangeDiv = document.getElementById('export-date-range');
    if (exportRangeDiv) exportRangeDiv.classList.add('hidden');
}

export async function exportEnrollmentsToExcel() {
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

// Placeholder for downloadEnrollmentInvoice function (you'll need to implement this)
window.downloadEnrollmentInvoice = async function(enrollmentId) {
    alert('Invoice download functionality will be implemented soon.');
};

// Placeholder for closeManagementModal function
window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
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

export function initializeTutorSearch(searchInputId, resultsContainerId, hiddenInputId, tutors) {
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

export function displayTutorResults(searchTerm, tutors, resultsContainer, hiddenInput, searchInput) {
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

export async function approveEnrollmentWithDetails(enrollmentId) {
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

            // Build subjectAssignments for this student (written to student doc post-batch)
            const _sa = [{
                category: 'Academic',
                tutorEmail: academicTutor.email,
                tutorName: academicTutor.name,
                subject: (student.selectedSubjects || []).join(', ') || 'Academic',
                assignedDate: new Date().toISOString()
            }];

            // --- Extracurricular Tutors ---
            if (student.extracurriculars && student.extracurriculars.length > 0) {
                student.extracurriculars.forEach((activity, ecIndex) => {
                    const ecTutorId = document.getElementById(`selected-ec-tutor-${studentIndex}-${ecIndex}`)?.value;
                    if (ecTutorId) {
                        const ecTutor = tutors.find(t => t.id === ecTutorId || t.email === ecTutorId);
                        if (ecTutor) {
                            _sa.push({ category: 'Extra-Curricular', tutorEmail: ecTutor.email, tutorName: ecTutor.name, subject: activity.name, activity: activity.name, frequency: activity.frequency, assignedDate: new Date().toISOString() });
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

            // --- Subject / Test Prep Tutors ---
            if (student.selectedSubjects && student.selectedSubjects.length > 0) {
                student.selectedSubjects.forEach((subject, subIndex) => {
                    const subTutorId = document.getElementById(`selected-sub-tutor-${studentIndex}-${subIndex}`)?.value;
                    if (subTutorId) {
                        const subTutor = tutors.find(t => t.id === subTutorId || t.email === subTutorId);
                        if (subTutor) {
                            const isTP = /\b(sat|act|gmat|gre|ielts|toefl|test.?prep|exam.?prep)\b/i.test(subject);
                            _sa.push({ category: isTP ? 'Test Prep' : 'Academic', tutorEmail: subTutor.email, tutorName: subTutor.name, subject, assignedDate: new Date().toISOString() });
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
                                type: isTP ? 'test_prep' : 'subject',
                                status: 'pending',
                                createdAt: Timestamp.now(),
                                source: 'enrollment_approval',
                                note: 'Subject-specific tutoring assignment awaiting your acceptance'
                            });
                        }
                    }
                });
            }

            // Store per-student subjectAssignments for post-batch update
            if (!window._pendingSA) window._pendingSA = {};
            window._pendingSA[enrollmentId + '||' + student.name] = { sa: _sa, tutorEmail: academicTutor.email, tutorName: academicTutor.name };
        });

        await batch.commit();

        // Post-commit: write subjectAssignments onto each student's Firestore doc
        if (window._pendingSA) {
            for (const [key, val] of Object.entries(window._pendingSA)) {
                try {
                    const sepIdx = key.indexOf('||');
                    const eid = key.slice(0, sepIdx);
                    const sname = key.slice(sepIdx + 2);
                    const sq = query(collection(db, 'students'), where('enrollmentId', '==', eid));
                    const snap = await getDocs(sq);
                    for (const sdoc of snap.docs) {
                        const d = sdoc.data();
                        const n = (d.studentName || d.name || '').trim().toLowerCase();
                        if (n === sname.trim().toLowerCase()) {
                            await updateDoc(sdoc.ref, { subjectAssignments: val.sa, tutorEmail: val.tutorEmail, tutorName: val.tutorName, lastUpdated: Timestamp.now() });
                        }
                    }
                } catch(_e) { /* non-critical */ }
            }
            delete window._pendingSA;
        }

        alert("Enrollment approved! Tutor assignments are now pending acceptance in the Tutors Portal.");

        closeManagementModal('approveEnrollmentModal');

        // Clear relevant caches
        delete sessionCache.enrollments;
        delete sessionCache.pendingStudents;

        // Refresh the view
        await fetchAndRenderEnrollments(true);

    } catch (error) {
        console.error("Error approving enrollment:", error);
        alert("Failed to approve enrollment: " + error.message);
    }
}

// ======================================================
