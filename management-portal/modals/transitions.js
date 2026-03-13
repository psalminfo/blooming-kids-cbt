// ============================================================
// modals/transitions.js
// Tutor transition modal and performTransition
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
                                tutorName: s.tutorName,
                                tutorEmail: s.tutorEmail,
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
            originalTutorEmail: student.tutorEmail || '',
            originalTutorName: student.tutorName || student.currentTutor || 'Unassigned',
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
            originalTutorEmail: student.tutorEmail || '',
            originalTutorName: student.tutorName || student.currentTutor || 'Unassigned',
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
