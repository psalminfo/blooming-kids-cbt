// ============================================================
// modals/groupClass.js
// Create group class modal
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

export function showCreateGroupClassModal() {
    const students = getCleanStudents();
    const tutors = getCleanTutors();
    
    if (tutors.length === 0) {
        alert("No tutors available. Please refresh.");
        return;
    }
    
    const modalHtml = `
        <div id="group-class-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white w-full max-w-4xl rounded-lg shadow-xl p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-indigo-700">Create Group Class</h3>
                    <button onclick="document.getElementById('group-class-modal').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <form id="group-class-form">
                    <div class="grid grid-cols-2 gap-6">
                        <!-- Left Column -->
                        <div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Group Name *</label>
                                <input type="text" 
                                       id="group-name" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Advanced Math Group, SAT Prep Class"
                                       required>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Tutor *</label>
                                ${createSearchableSelect(
                                    tutors.map(t => ({ 
                                        email: t.email, 
                                        name: t.name,
                                        employmentDate: t.employmentDate
                                    })), 
                                    "Select tutor...", 
                                    "group-tutor",
                                    true
                                )}
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Subject *</label>
                                <input type="text" 
                                       id="group-subject" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Mathematics, English Literature"
                                       required>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Schedule</label>
                                <input type="text" 
                                       id="group-schedule" 
                                       class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                       placeholder="E.g., Mon & Wed 4-6PM, Sat 10AM-12PM">
                            </div>
                        </div>
                        
                        <!-- Right Column -->
                        <div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Select Students *</label>
                                <div class="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                                    ${students.map(student => `
                                        <div class="flex items-center mb-2 p-2 hover:bg-gray-50 rounded">
                                            <input type="checkbox" 
                                                   id="student-${student.id}" 
                                                   value="${student.id}" 
                                                   class="mr-3 group-student-checkbox">
                                            <label for="student-${student.id}" class="flex-1 cursor-pointer">
                                                <div class="font-medium">${student.studentName}</div>
                                                <div class="text-xs text-gray-500">
                                                    Grade: ${student.grade || 'N/A'} | 
                                                    Current Tutor: ${student.tutorName || 'N/A'}
                                                    ${student.groupId ? ' <span class="text-blue-600">(Already in group)</span>' : ''}
                                                </div>
                                            </label>
                                            <input type="number" 
                                                   min="0" 
                                                   step="0.01"
                                                   placeholder="₦ Fee"
                                                   class="ml-2 w-24 p-1 border rounded text-sm hidden group-fee-input"
                                                   data-student-id="${student.id}">
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Students can belong to multiple groups</p>
                            </div>
                            
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-2 text-gray-700">Total Group Fee</label>
                                <div class="text-lg font-bold text-indigo-700" id="total-group-fee">₦0.00</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium mb-2 text-gray-700">Group Notes</label>
                        <textarea id="group-notes" 
                                  class="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                  rows="2" 
                                  placeholder="Any additional information about this group..."></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-3">
                        <button type="button" 
                                onclick="document.getElementById('group-class-modal').remove()" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="group-submit-btn" 
                                class="px-5 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                            Create Group Class
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('group-class-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        initializeSearchableSelect('group-tutor');
        
        document.querySelectorAll('.group-student-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const feeInput = document.querySelector(`.group-fee-input[data-student-id="${this.value}"]`);
                if (this.checked) {
                    feeInput.classList.remove('hidden');
                    feeInput.required = true;
                } else {
                    feeInput.classList.add('hidden');
                    feeInput.required = false;
                    feeInput.value = '';
                }
                calculateTotalGroupFee();
            });
        });
        
        document.querySelectorAll('.group-fee-input').forEach(input => {
            input.addEventListener('input', calculateTotalGroupFee);
        });
        
        document.getElementById('group-class-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const groupName = document.getElementById('group-name').value.trim();
            const tutorEmail = document.getElementById('group-tutor').value;
            const subject = document.getElementById('group-subject').value.trim();
            const schedule = document.getElementById('group-schedule').value.trim();
            const notes = document.getElementById('group-notes').value.trim();
            
            const selectedCheckboxes = document.querySelectorAll('.group-student-checkbox:checked');
            
            if (!groupName || !tutorEmail || !subject) {
                alert("Please fill all required fields");
                return;
            }
            
            if (selectedCheckboxes.length === 0) {
                alert("Please select at least one student");
                return;
            }
            
            let allFeesValid = true;
            const studentFees = [];
            
            selectedCheckboxes.forEach(cb => {
                const feeInput = document.querySelector(`.group-fee-input[data-student-id="${cb.value}"]`);
                const fee = parseFloat(feeInput.value) || 0;
                if (fee <= 0) {
                    alert(`Please enter a valid fee for selected student`);
                    allFeesValid = false;
                }
                studentFees.push({
                    studentId: cb.value,
                    fee: fee
                });
            });
            
            if (!allFeesValid) return;
            
            const tutor = tutors.find(t => t.email === tutorEmail);
            
            if (confirm(`Create group "${groupName}" with ${selectedCheckboxes.length} students under ${tutor.name}?`)) {
                await createGroupClass(groupName, tutor, subject, schedule, notes, studentFees);
            }
        });
    }, 100);
}

export function calculateTotalGroupFee() {
    let total = 0;
    document.querySelectorAll('.group-fee-input').forEach(input => {
        if (!input.classList.contains('hidden')) {
            total += parseFloat(input.value) || 0;
        }
    });
    document.getElementById('total-group-fee').textContent = `₦${total.toFixed(2)}`;
}

export async function createGroupClass(groupName, tutor, subject, schedule, notes, studentFees) {
    const btn = document.getElementById('group-submit-btn');
    btn.textContent = "Creating...";
    btn.disabled = true;
    
    try {
        const user = window.userData?.name || 'Admin';
        const timestamp = new Date().toISOString();
        
        // Collect parent details for each student
        const parentDetails = [];
        const studentIds = [];
        const studentNames = [];
        
        for (const sf of studentFees) {
            const studentDoc = await getDoc(doc(db, "students", sf.studentId));
            if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                studentIds.push(sf.studentId);
                studentNames.push(studentData.studentName);
                parentDetails.push({
                    studentId: sf.studentId,
                    studentName: studentData.studentName,
                    parentName: studentData.parentName || 'N/A',
                    parentEmail: studentData.parentEmail || 'N/A',
                    parentPhone: studentData.parentPhone || 'N/A'
                });
            }
        }
        
        const groupRef = await addDoc(collection(db, "groupClasses"), {
            groupName: groupName,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            subject: subject,
            schedule: schedule,
            notes: notes,
            studentCount: studentFees.length,
            totalFee: studentFees.reduce((sum, sf) => sum + sf.fee, 0),
            createdAt: timestamp,
            createdBy: user,
            status: 'active',
            studentIds: studentIds,
            studentNames: studentNames,
            parentDetails: parentDetails  // Store all parent info
        });
        
        
        const updatePromises = studentFees.map(async (sf) => {
            const studentDoc = await getDoc(doc(db, "students", sf.studentId));
            if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                const currentGroups = studentData.groups || [];
                
                await updateDoc(doc(db, "students", sf.studentId), {
                    groups: [...currentGroups, {
                        groupId: groupRef.id,
                        groupName: groupName,
                        tutorEmail: tutor.email,
                        tutorName: tutor.name,
                        subject: subject,
                        schedule: schedule,
                        groupFee: sf.fee,
                        joinedAt: timestamp
                    }],
                    groupId: groupRef.id,
                    groupName: groupName,
                    updatedAt: timestamp,
                    updatedBy: user
                });
                
                await addDoc(collection(db, "groupStudentFees"), {
                    groupId: groupRef.id,
                    groupName: groupName,
                    studentId: sf.studentId,
                    studentName: studentData.studentName,
                    fee: sf.fee,
                    createdAt: timestamp,
                    createdBy: user
                });
                
                // Log group addition event for each student
                await logStudentEvent(
                    sf.studentId,
                    'GROUP_ADD',
                    { groupId: groupRef.id, groupName, fee: sf.fee },
                    `Added to group "${groupName}" with fee ₦${sf.fee}`,
                    { groupId: groupRef.id, tutor: tutor.email, subject, schedule }
                );
            }
        });
        
        await Promise.all(updatePromises);
        
        alert(`✅ Group "${groupName}" created successfully with ${studentFees.length} students!`);
        
        setTimeout(() => {
            document.getElementById('group-class-modal').remove();
            fetchAndRenderDirectory(true);
        }, 1000);
        
    } catch (error) {
        console.error("Group creation error:", error);
        alert(`Error: ${error.message}`);
        btn.textContent = "Create Group Class";
        btn.disabled = false;
    }
}

// ======================================================
// ENHANCED REASSIGN STUDENT MODAL (with flexible duration + visible button + reason)
// ======================================================
