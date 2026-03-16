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

// ── Shared helper: render a searchable multi-select checklist ──────────────
function buildMultiSelect(containerId, items, labelFn, subLabelFn = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="border border-gray-300 rounded-lg overflow-hidden">
            <div class="p-2 border-b border-gray-200 bg-gray-50">
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input
                        type="text"
                        placeholder="Type to search…"
                        class="multi-select-search w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                </div>
                <div class="flex items-center justify-between mt-1.5 px-0.5">
                    <span class="multi-select-count text-xs text-gray-400">0 selected</span>
                    <button type="button" class="multi-select-clear text-xs text-red-400 hover:text-red-600 hidden">Clear all</button>
                </div>
            </div>
            <ul class="multi-select-list max-h-48 overflow-y-auto divide-y divide-gray-50">
                ${items.map(item => `
                    <li class="multi-select-item flex items-center gap-3 px-3 py-2 hover:bg-yellow-50 cursor-pointer transition-colors"
                        data-id="${escapeHtml(item.id)}"
                        data-label="${escapeHtml(labelFn(item).toLowerCase())}">
                        <input type="checkbox" class="multi-select-checkbox accent-yellow-500 w-4 h-4 cursor-pointer flex-shrink-0" value="${escapeHtml(item.id)}" />
                        <div class="min-w-0">
                            <div class="text-sm font-medium text-gray-800 truncate">${escapeHtml(labelFn(item))}</div>
                            ${subLabelFn ? `<div class="text-xs text-gray-400 truncate">${escapeHtml(subLabelFn(item))}</div>` : ''}
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    const search   = container.querySelector('.multi-select-search');
    const list     = container.querySelector('.multi-select-list');
    const countEl  = container.querySelector('.multi-select-count');
    const clearBtn = container.querySelector('.multi-select-clear');

    function updateCount() {
        const checked = container.querySelectorAll('.multi-select-checkbox:checked').length;
        countEl.textContent = checked === 0 ? '0 selected' : `${checked} selected`;
        clearBtn.classList.toggle('hidden', checked === 0);
    }

    // Click anywhere on the row toggles the checkbox
    list.addEventListener('click', e => {
        const li = e.target.closest('.multi-select-item');
        if (!li) return;
        const cb = li.querySelector('.multi-select-checkbox');
        if (e.target !== cb) cb.checked = !cb.checked;
        updateCount();
    });

    // Search filter
    search.addEventListener('input', () => {
        const term = search.value.toLowerCase().trim();
        list.querySelectorAll('.multi-select-item').forEach(li => {
            li.style.display = !term || li.dataset.label.includes(term) ? '' : 'none';
        });
    });

    // Clear all
    clearBtn.addEventListener('click', () => {
        container.querySelectorAll('.multi-select-checkbox').forEach(cb => cb.checked = false);
        updateCount();
    });
}

// Returns array of selected IDs from a multi-select container
function getMultiSelectValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return [...container.querySelectorAll('.multi-select-checkbox:checked')].map(cb => cb.value);
}

window.showArchiveStudentModal = async function() {
    try {
        // Load active students
        if (!sessionCache.students) {
            const studentsSnapshot = await getDocs(query(collection(db, "students")));
            const activeStudents = studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(s => (s.status === 'active' || s.status === 'approved') && !s.summerBreak && !s.onBreak);
            sessionCache.students = activeStudents;
        }

        const students = sessionCache.students || [];

        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-yellow-700">Archive Student</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6 max-h-[70vh] overflow-y-auto">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Student(s) to Archive <span class="text-red-500">*</span>
                            </label>
                            <div id="archive-student-multiselect"></div>
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

        const modalContainer = document.createElement('div');
        modalContainer.id = 'archive-student-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        buildMultiSelect(
            'archive-student-multiselect',
            students,
            s => s.studentName || s.email || s.id,
            s => s.parentEmail || ''
        );
        
    } catch (error) {
        console.error('Error showing archive student modal:', error);
        alert('Failed to load student data. Please try again.');
    }
};

window.showMarkInactiveModal = async function() {
    try {
        // Load active tutors (explicit allowlist only)
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
            const activeTutors = tutorsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(tutor => tutor.status === 'active');
            sessionCache.tutors = activeTutors;
        }

        const tutors = sessionCache.tutors || [];

        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-bold text-red-700">Mark Tutor as Inactive</h3>
                        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-6 max-h-[70vh] overflow-y-auto">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Select Tutor(s) to Mark Inactive <span class="text-red-500">*</span>
                            </label>
                            <div id="inactive-tutor-multiselect"></div>
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

        const modalContainer = document.createElement('div');
        modalContainer.id = 'mark-inactive-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        // Use red accent for tutor multi-select
        buildMultiSelect(
            'inactive-tutor-multiselect',
            tutors,
            t => t.name || t.email || t.id,
            t => t.assignedStudentsCount ? `${t.assignedStudentsCount} student${t.assignedStudentsCount !== 1 ? 's' : ''}` : ''
        );

        // Re-tint checkboxes to red after render
        document.querySelectorAll('#inactive-tutor-multiselect .multi-select-checkbox')
            .forEach(cb => cb.classList.replace('accent-yellow-500', 'accent-red-500'));
        document.querySelectorAll('#inactive-tutor-multiselect .multi-select-search')
            .forEach(el => el.classList.replace('focus:ring-yellow-400', 'focus:ring-red-400'));

    } catch (error) {
        console.error('Error showing mark inactive modal:', error);
        alert('Failed to load tutor data. Please try again.');
    }
};

// ======================================================
// MODAL SUBMISSION FUNCTIONS
// ======================================================
