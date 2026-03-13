// ============================================================
// panels/actionHandlers.js
// Student edit/delete/approve/reject handlers
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

// SECTION 7: ACTION HANDLERS & MODALS
// ======================================================

export async function handleEditStudent(studentId) {
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

export async function handleEditPendingStudent(studentId) {
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

export function showEditStudentModal(studentId, studentData, collectionName) {
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
            if (currentNavId) invalidateTabCache(currentNavId);
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

export function showReassignStudentModal() {
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

export async function handleDeleteStudent(studentId) {
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

export async function handleApproveStudent(studentId) {
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

export async function handleRejectStudent(studentId) {
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
