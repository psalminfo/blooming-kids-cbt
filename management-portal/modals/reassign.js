// ============================================================
// modals/reassign.js
// Enhanced student reassignment modal
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
