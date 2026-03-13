// ============================================================
// modals/quickActions.js
// Archive student and mark inactive modals
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

window.showArchiveStudentModal = async function() {
    try {
        // Load active students
        if (!sessionCache.students) {
            const studentsSnapshot = await getDocs(query(collection(db, "students")));
            const activeStudents = studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(student => !student.status || student.status === 'active' || student.status === 'approved');
            sessionCache.students = activeStudents;
        }

        const students = sessionCache.students || [];

        // Create modal HTML
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-yellow-700">Archive Student</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Student to Archive <span class="text-red-500">*</span>
                            </label>
                            <select id="archive-student-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                                <option value="">-- Select a Student --</option>
                                ${students.map(student => `
                                    <option value="${student.id}">
                                        ${student.name || student.email || student.id}
                                        ${student.parentEmail ? ` (${student.parentEmail})` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Parent Email</label>
                            <input type="email" id="archive-parent-email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" placeholder="parent@example.com" value="">
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Archive Reason <span class="text-red-500">*</span></label>
                            <select id="archive-reason" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                                <option value="">-- Select Reason --</option>
                                <option value="graduated">Graduated/Completed</option>
                                <option value="withdrawn">Withdrawn from Program</option>
                                <option value="transferred">Transferred to Another Tutor</option>
                                <option value="inactive">Became Inactive</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                            <textarea id="archive-notes" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" rows="3" placeholder="Add any notes about this archiving..."></textarea>
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <div class="flex items-start">
                                <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                                <div>
                                    <p class="text-yellow-800 font-medium mb-1">Important Note:</p>
                                    <p class="text-yellow-700 text-sm">Archiving a student will:</p>
                                    <ul class="text-yellow-700 text-sm list-disc pl-5 mt-1">
                                        <li>Change their status to "archived"</li>
                                        <li>Remove them from active student lists</li>
                                        <li>Preserve all their data for records</li>
                                        <li>Notify their assigned tutor (if any)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                        <button onclick="closeModal()" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onclick="submitArchiveStudent()" class="px-5 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                            <i class="fas fa-archive mr-2"></i> Archive Student
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.id = 'archive-student-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // Update parent email when student selection changes
        document.getElementById('archive-student-select').addEventListener('change', function() {
            const studentId = this.value;
            const selectedStudent = students.find(s => s.id === studentId);
            const parentEmailInput = document.getElementById('archive-parent-email');
            if (selectedStudent && selectedStudent.parentEmail) {
                parentEmailInput.value = selectedStudent.parentEmail;
            } else {
                parentEmailInput.value = '';
            }
        });
        
    } catch (error) {
        console.error('Error showing archive student modal:', error);
        alert('Failed to load student data. Please try again.');
    }
};

window.showMarkInactiveModal = async function() {
    try {
        // Load active tutors
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
            const activeTutors = tutorsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(tutor => !tutor.status || tutor.status === 'active');
            sessionCache.tutors = activeTutors;
        }

        const tutors = sessionCache.tutors || [];

        // Create modal HTML
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-red-700">Mark Tutor as Inactive</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Tutor to Mark Inactive <span class="text-red-500">*</span>
                            </label>
                            <select id="inactive-tutor-select" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500">
                                <option value="">-- Select a Tutor --</option>
                                ${tutors.map(tutor => `
                                    <option value="${tutor.id}">
                                        ${tutor.name || tutor.email || tutor.id} 
                                        ${tutor.assignedStudentsCount ? `(${tutor.assignedStudentsCount} students)` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Inactive Reason <span class="text-red-500">*</span></label>
                            <select id="inactive-reason" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500">
                                <option value="">-- Select Reason --</option>
                                <option value="left">Left the Organization</option>
                                <option value="temporary">Temporary Leave</option>
                                <option value="performance">Performance Issues</option>
                                <option value="capacity">At Capacity</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
                            <textarea id="inactive-notes" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" rows="3" placeholder="Add any notes about marking this tutor inactive..."></textarea>
                        </div>
                        
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div class="flex items-start">
                                <i class="fas fa-exclamation-circle text-red-500 mt-1 mr-3"></i>
                                <div>
                                    <p class="text-red-800 font-medium mb-1">Important Note:</p>
                                    <p class="text-red-700 text-sm">Marking a tutor as inactive will:</p>
                                    <ul class="text-red-700 text-sm list-disc pl-5 mt-1">
                                        <li>Change their status to "inactive"</li>
                                        <li>Remove them from active tutor lists</li>
                                        <li>Prevent new student assignments</li>
                                        <li>Notify their assigned students (if any)</li>
                                        <li>Allow reassignment of their students</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                        <button onclick="closeModal()" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onclick="submitMarkInactive()" class="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <i class="fas fa-user-slash mr-2"></i> Mark Tutor Inactive
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.id = 'mark-inactive-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('Error showing mark inactive modal:', error);
        alert('Failed to load tutor data. Please try again.');
    }
};

// ======================================================
// MODAL SUBMISSION FUNCTIONS
// ======================================================
