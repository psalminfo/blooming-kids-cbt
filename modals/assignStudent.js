// ============================================================
// modals/assignStudent.js
// Assign new student — single and group class
// ============================================================

import { db } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy,
         Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc,
         limit, startAfter } from '../core/firebase.js';
import { escapeHtml, capitalize, formatNaira, buildGradeOptions, buildTimeOptions,
         formatTimeTo12h, sanitizeInput, rateLimitCheck,
         safeToString, createSearchableSelect, initializeSearchableSelect,
         createDatePicker, logStudentEvent } from '../core/utils.js';
import { sessionCache, saveToLocalStorage, invalidateCache } from '../core/cache.js';
import { logManagementActivity } from '../notifications/activityLog.js';

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
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tutor Fee (₦)</label>
                            <input type="number" id="assign-tutor-fee" min="0" value="0"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. 50000">
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

window.closeModal = function() {
    const modal = document.getElementById('assign-student-modal');
    if (modal) modal.remove();
};

window.submitAssignment = async function() {
    const tutorId    = document.getElementById('assign-tutor-select')?.value;
    const studentId  = document.getElementById('assign-student-select')?.value;
    const parentEmail = document.getElementById('assign-parent-email')?.value.trim();
    const tutorFee   = Number(document.getElementById('assign-tutor-fee')?.value) || 0;
    const notes      = document.getElementById('assignment-notes')?.value.trim();

    if (!tutorId) { alert('Please select a tutor.'); return; }
    if (!studentId) { alert('Please select a student.'); return; }

    const btn = document.querySelector('#assign-student-modal button[onclick="submitAssignment()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...'; }

    try {
        const tutor   = (sessionCache.tutors || []).find(t => t.id === tutorId);
        const student = (sessionCache.students || []).find(s => s.id === studentId);

        if (!tutor || !student) throw new Error('Tutor or student data not found. Please refresh.');

        const timestamp = new Date().toISOString();
        const assignedBy = window.userData?.email || 'management';

        // Update student document with tutor assignment and fee
        await updateDoc(doc(db, 'students', studentId), {
            tutorId:    tutorId,
            tutorEmail: tutor.email || null,
            tutorName:  tutor.name  || tutor.email || null,
            tutorFee:   tutorFee,
            parentEmail: parentEmail || student.parentEmail || null,
            assignmentNotes: notes || null,
            updatedAt:  timestamp,
            updatedBy:  assignedBy
        });

        // Notify tutor
        await addDoc(collection(db, 'tutor_notifications'), {
            tutorEmail: tutor.email,
            type: 'new_student',
            title: 'New Student Assigned',
            message: `${student.studentName || student.name || studentId} has been assigned to you.${notes ? ' Note: ' + notes : ''}`,
            studentName: student.studentName || student.name || studentId,
            tutorFee,
            read: false,
            createdAt: Timestamp.now()
        });

        // Log activity
        if (window.logManagementActivity) {
            await logManagementActivity('STUDENT_ASSIGNED', {
                studentId,
                studentName: student.studentName || student.name,
                tutorId,
                tutorName: tutor.name || tutor.email,
                tutorFee,
                assignedBy
            });
        }

        alert(`"${student.studentName || student.name}" assigned to "${tutor.name || tutor.email}" successfully!`);
        window.closeModal();

        // Refresh directory if available
        if (window.fetchAndRenderDirectory) window.fetchAndRenderDirectory(true);
        if (window.invalidateCache) { window.invalidateCache('students'); window.invalidateCache('tutorAssignments'); }

    } catch (err) {
        console.error('Assignment error:', err);
        alert('Failed to assign student: ' + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus mr-2"></i> Assign Student'; }
    }
};
