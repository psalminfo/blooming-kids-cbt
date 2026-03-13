// ============================================================
// panels/tutorHistory.js
// Tutor assignment history modal
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

// SECTION 8: UTILITY FUNCTIONS
// ======================================================

export async function fetchTutorAssignmentHistory() {
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

export function showTutorHistoryModal(studentId, studentData, tutorAssignments, activityLogEntries = []) {
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

// ======================================================
// jsPDF DIRECT-DRAW PDF ENGINE (No canvas, no screenshots)
// Requires: jspdf 2.5.x + jspdf-autotable 3.8.x
// ======================================================

// --- Cached logo (fetched once, reused forever) ---
let _reportLogoBase64 = null;

export async function fetchReportLogo() {
    if (_reportLogoBase64) return _reportLogoBase64;
    try {
        // Use Cloudinary's format transform to get PNG (jsPDF can't render SVG natively)
        const pngUrl = 'https://res.cloudinary.com/dy2hxcyaf/image/upload/f_png,h_160/v1757700806/newbhlogo_umwqzy';
        const response = await fetch(pngUrl, { mode: 'cors' });
        const blob = await response.blob();
        _reportLogoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return _reportLogoBase64;
    } catch (e) {
        console.error('Logo fetch failed, PDF will generate without logo:', e);
        return null;
    }
}

// --- Fetch report data from Firestore ---
export async function getReportData(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    return reportDoc.data();
}

// --- Core: Build a jsPDF document from report data ---
export function buildReportPDF(reportData, logoBase64) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();   // 297
    const marginL = 18;
    const marginR = 18;
    const contentW = pageW - marginL - marginR;        // 174
    const bottomMargin = 25;
    let y = 20; // current Y cursor

    // Colors
    const green700 = [21, 128, 61];    // #15803d
    const green800 = [22, 101, 52];    // #166534
    const green500 = [22, 163, 74];    // #16a34a
    const greenLight = [209, 250, 229]; // #d1fae5
    const gray100 = [243, 244, 246];
    const gray500 = [107, 114, 128];
    const black = [51, 51, 51];

    // Helper: check page space, add new page if needed
    function ensureSpace(needed) {
        if (y + needed > pageH - bottomMargin) {
            pdf.addPage();
            y = 20;
        }
    }

    // ===== HEADER =====
    // Logo (centered)
    if (logoBase64) {
        try {
            const logoH = 18;
            const logoW = 18; // square-ish, auto scales
            const logoX = (pageW - logoW) / 2;
            pdf.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH);
            y += logoH + 3;
        } catch (e) {
            // Skip logo silently if it fails
        }
    }

    // Company name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...green700);
    pdf.text('Blooming Kids House', pageW / 2, y, { align: 'center' });
    y += 9;

    // Report title
    pdf.setFontSize(16);
    pdf.setTextColor(...green800);
    pdf.text('MONTHLY LEARNING REPORT', pageW / 2, y, { align: 'center' });
    y += 7;

    // Date
    const reportDate = reportData.submittedAt
        ? new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()
        : 'N/A';
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...gray500);
    pdf.text(`Date: ${reportDate}`, pageW / 2, y, { align: 'center' });
    y += 10;

    // ===== STUDENT INFO TABLE =====
    pdf.autoTable({
        startY: y,
        margin: { left: marginL, right: marginR },
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
            textColor: black,
            lineColor: [229, 231, 235],
            lineWidth: 0.2,
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        body: [
            [
                { content: `Student's Name:  ${reportData.studentName || 'N/A'}`, styles: { fontStyle: 'bold' } },
                { content: `Parent's Name:  ${reportData.parentName || 'N/A'}`, styles: { fontStyle: 'bold' } }
            ],
            [
                { content: `Parent's Phone:  ${reportData.parentPhone || 'N/A'}`, styles: { fontStyle: 'bold' } },
                { content: `Grade:  ${reportData.grade || 'N/A'}`, styles: { fontStyle: 'bold' } }
            ],
            [
                { content: `Tutor's Name:  ${reportData.tutorName || 'N/A'}`, styles: { fontStyle: 'bold' } },
                ''
            ]
        ],
        columnStyles: {
            0: { cellWidth: contentW / 2 },
            1: { cellWidth: contentW / 2 }
        },
        tableLineColor: [229, 231, 235],
        tableLineWidth: 0.3,
    });

    y = pdf.lastAutoTable.finalY + 10;

    // ===== REPORT SECTIONS =====
    const sections = [
        { title: 'INTRODUCTION', content: reportData.introduction },
        { title: 'TOPICS & REMARKS', content: reportData.topics },
        { title: 'PROGRESS & ACHIEVEMENTS', content: reportData.progress },
        { title: 'STRENGTHS AND WEAKNESSES', content: reportData.strengthsWeaknesses },
        { title: 'RECOMMENDATIONS', content: reportData.recommendations },
        { title: "GENERAL TUTOR'S COMMENTS", content: reportData.generalComments },
    ];

    sections.forEach(section => {
        const text = (section.content && String(section.content).trim()) ? String(section.content).trim() : 'N/A';

        // Wrap text to measure height
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const wrappedLines = pdf.splitTextToSize(text, contentW - 10);
        const textBlockH = wrappedLines.length * 5; // ~5mm per line at font 10
        const sectionH = 12 + textBlockH + 8; // header(12) + text + padding(8)

        ensureSpace(Math.min(sectionH, 80)); // at least try to keep header + some text together

        // Section box border
        const boxY = y;
        const boxH = 12 + textBlockH + 8;
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(marginL, boxY, contentW, boxH, 2, 2, 'S');

        // Section title
        y += 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(...green500);
        pdf.text(section.title, marginL + 5, y);
        y += 2;

        // Green underline
        pdf.setDrawColor(...greenLight);
        pdf.setLineWidth(0.6);
        pdf.line(marginL + 5, y, marginL + contentW - 5, y);
        y += 5;

        // Section body text
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(...black);

        // Print wrapped lines, handling page breaks mid-text
        wrappedLines.forEach(line => {
            if (y > pageH - bottomMargin) {
                pdf.addPage();
                y = 20;
            }
            pdf.text(line, marginL + 5, y);
            y += 5;
        });

        y += 6; // spacing between sections
    });

    // ===== FOOTER / SIGNATURE =====
    ensureSpace(25);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...black);
    pdf.text('Best regards,', pageW - marginR, y, { align: 'right' });
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text(reportData.tutorName || 'N/A', pageW - marginR, y, { align: 'right' });

    return pdf;
}

// --- Generate HTML for preview (screen only, not PDF) ---
export function generateReportPreviewHTML(reportData) {
    const reportDate = reportData.submittedAt
        ? new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()
        : 'N/A';
    const logoUrl = 'https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg';
    const sectionKeys = {
        'INTRODUCTION': reportData.introduction,
        'TOPICS & REMARKS': reportData.topics,
        'PROGRESS & ACHIEVEMENTS': reportData.progress,
        'STRENGTHS AND WEAKNESSES': reportData.strengthsWeaknesses,
        'RECOMMENDATIONS': reportData.recommendations,
        "GENERAL TUTOR'S COMMENTS": reportData.generalComments,
    };
    const sectionsHTML = Object.entries(sectionKeys).map(([title, content]) => {
        const safe = content ? String(content).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : 'N/A';
        return `<div style="margin-bottom:20px;border:1px solid #e5e7eb;padding:15px;border-radius:8px;">
            <h2 style="font-size:18px;font-weight:bold;color:#16a34a;margin:0 0 8px 0;padding-bottom:8px;border-bottom:2px solid #d1fae5;">${title}</h2>
            <p style="line-height:1.6;white-space:pre-wrap;margin:0;color:#333;">${safe}</p>
        </div>`;
    }).join('');

    return `<html><head><style>body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;background:#f3f4f6;margin:0;padding:20px;}</style></head><body>
        <div style="max-width:800px;margin:auto;padding:20px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <div style="text-align:center;margin-bottom:30px;">
                <img src="${logoUrl}" style="height:70px;margin-bottom:8px;" alt="Logo">
                <h2 style="color:#15803d;margin:8px 0;font-size:24px;">Blooming Kids House</h2>
                <h1 style="color:#166534;margin:0;font-size:20px;">MONTHLY LEARNING REPORT</h1>
                <p style="color:#555;margin:5px 0;">Date: ${reportDate}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:25px;background:#f9fafb;border:1px solid #eee;border-radius:8px;">
                <tr><td style="padding:8px 12px;"><strong>Student:</strong> ${reportData.studentName || 'N/A'}</td><td style="padding:8px 12px;"><strong>Parent:</strong> ${reportData.parentName || 'N/A'}</td></tr>
                <tr><td style="padding:8px 12px;"><strong>Phone:</strong> ${reportData.parentPhone || 'N/A'}</td><td style="padding:8px 12px;"><strong>Grade:</strong> ${reportData.grade || 'N/A'}</td></tr>
                <tr><td style="padding:8px 12px;"><strong>Tutor:</strong> ${reportData.tutorName || 'N/A'}</td><td></td></tr>
            </table>
            ${sectionsHTML}
            <div style="text-align:right;margin-top:30px;">
                <p>Best regards,</p>
                <p><strong>${reportData.tutorName || 'N/A'}</strong></p>
            </div>
        </div>
    </body></html>`;
}

// ===== PUBLIC API =====

window.previewReport = async function(reportId) {
    try {
        const reportData = await getReportData(reportId);
        const html = generateReportPreviewHTML(reportData);
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(html);
            newWindow.document.close();
        } else {
            alert('Pop-ups blocked. Please allow pop-ups to preview.');
        }
    } catch (error) {
        console.error("Error previewing report:", error);
        alert(`Error: ${error.message}`);
    }
};

window.downloadSingleReport = async function(reportId, event) {
    const button = event?.target || event;
    const originalText = button?.innerHTML || '';

    try {
        if (button?.innerHTML) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.disabled = true;
        }

        const progressModal = document.getElementById('pdf-progress-modal');
        const progressBar = document.getElementById('pdf-progress-bar');
        const progressText = document.getElementById('pdf-progress-text');
        const progressMessage = document.getElementById('pdf-progress-message');

        if (progressModal) {
            progressModal.classList.remove('hidden');
            if (progressMessage) progressMessage.textContent = 'Fetching report data...';
            if (progressBar) progressBar.style.width = '15%';
            if (progressText) progressText.textContent = '15%';
        }

        // Fetch logo + data in parallel
        const [logoBase64, reportData] = await Promise.all([
            fetchReportLogo(),
            getReportData(reportId)
        ]);

        if (progressBar) progressBar.style.width = '50%';
        if (progressText) progressText.textContent = '50%';
        if (progressMessage) progressMessage.textContent = 'Building PDF...';

        const pdf = buildReportPDF(reportData, logoBase64);

        if (progressBar) progressBar.style.width = '90%';
        if (progressText) progressText.textContent = '90%';
        if (progressMessage) progressMessage.textContent = 'Saving file...';

        const safeStudentName = (reportData.studentName || 'Student').replace(/[^a-z0-9]/gi, '_');
        pdf.save(`${safeStudentName}_Report_${Date.now()}.pdf`);

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        if (progressMessage) progressMessage.textContent = 'Done!';
        setTimeout(() => progressModal?.classList.add('hidden'), 1000);

    } catch (error) {
        console.error("Error downloading report:", error);
        alert(`Error downloading report: ${error.message}`);
        document.getElementById('pdf-progress-modal')?.classList.add('hidden');
    } finally {
        if (button && originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
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

        // Pre-fetch logo once for all reports
        const logoBase64 = await fetchReportLogo();

        const zip = new JSZip();
        let processedCount = 0;

        for (const report of reports) {
            try {
                const progress = Math.round((processedCount / reports.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                progressMessage.textContent = `Processing report ${processedCount + 1} of ${reports.length}...`;
                button.innerHTML = `📦 Processing ${processedCount + 1}/${reports.length}`;

                const reportData = await getReportData(report.id);
                const pdf = buildReportPDF(reportData, logoBase64);

                const safeStudentName = (reportData.studentName || 'Unknown_Student').replace(/[^a-z0-9]/gi, '_');
                const reportDate = reportData.submittedAt
                    ? new Date(reportData.submittedAt.seconds * 1000).toISOString().split('T')[0]
                    : 'unknown_date';
                const filename = `${safeStudentName}_${reportDate}.pdf`;

                const pdfBlob = pdf.output('blob');
                zip.file(filename, pdfBlob);

            } catch (error) {
                console.error(`Error processing report ${report.id}:`, error);
            }
            processedCount++;
        }

        progressMessage.textContent = 'Creating ZIP file...';
        progressBar.style.width = '95%';
        progressText.textContent = '95%';

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

        progressMessage.textContent = 'Download starting...';
        progressBar.style.width = '100%';
        progressText.textContent = '100%';

        saveAs(zipBlob, `${tutorName}_Reports_${new Date().toISOString().split('T')[0]}.zip`);
        setTimeout(() => progressModal.classList.add('hidden'), 2000);

    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. Please try again.");
        document.getElementById('pdf-progress-modal')?.classList.add('hidden');
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

// ======================================================
