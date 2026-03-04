// ============================================================
// panels/studentManagement.js
// Archived students + edit/delete/approve handlers
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

// SUBSECTION 3.3: Archived Students Panel
// ======================================================

// Add debounce function for search
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modal management functions
export function closeManagementModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

export async function renderArchivedStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-700">Archived Students Management</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="archived-search" placeholder="Search archived students by name..." class="p-2 border rounded-md w-64">
                    <button id="refresh-archived-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="archive-student-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Archive Student</button>
                    <button id="bulk-archive-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Bulk Archive</button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-gray-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-gray-800 text-sm">Total Archived</h4>
                    <p id="archived-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Active Students</h4>
                    <p id="active-students-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Graduated</h4>
                    <p id="graduated-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-blue-800 text-sm">Transferred</h4>
                    <p id="transferred-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>

            <div id="archived-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading archived students...</p>
            </div>
        </div>
    `;
    
    // Clear any existing listeners
    const refreshBtn = document.getElementById('refresh-archived-btn');
    const searchInput = document.getElementById('archived-search');
    const archiveBtn = document.getElementById('archive-student-btn');
    const bulkArchiveBtn = document.getElementById('bulk-archive-btn');
    
    refreshBtn.replaceWith(refreshBtn.cloneNode(true));
    searchInput.replaceWith(searchInput.cloneNode(true));
    archiveBtn.replaceWith(archiveBtn.cloneNode(true));
    bulkArchiveBtn.replaceWith(bulkArchiveBtn.cloneNode(true));
    
    // Add new event listeners
    document.getElementById('refresh-archived-btn').addEventListener('click', () => fetchAndRenderArchivedStudents(true));
    document.getElementById('archived-search').addEventListener('input', debounce((e) => {
        renderArchivedStudentsFromCache(e.target.value);
    }, 300));
    document.getElementById('archive-student-btn').addEventListener('click', () => showArchiveStudentModal('single'));
    document.getElementById('bulk-archive-btn').addEventListener('click', () => showArchiveStudentModal('bulk'));
    
    fetchAndRenderArchivedStudents();
}

export async function fetchAndRenderArchivedStudents(forceRefresh = false) {
    if (forceRefresh && typeof invalidateCache === 'function') {
        invalidateCache('archivedStudents');
    }
    
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    try {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student data...</p>`;
        
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const allStudents = studentsSnapshot.docs.map(doc => { 
            const data = doc.data();
            return {
                id: doc.id, 
                studentName: data.studentName || 'Unnamed Student',
                parentName: data.parentName || 'N/A',
                grade: data.grade || 'N/A',
                studentFee: data.studentFee || 0,
                status: data.status || 'active',
                archivedDate: data.archivedDate,
                archivedReason: data.archivedReason || '',
                archivedBy: data.archivedBy || '',
                tutorEmail: data.tutorEmail || '',
                tutorName: data.tutorName || '',
                tutorHistory: data.tutorHistory || [],
                restoredDate: data.restoredDate,
                restoredBy: data.restoredBy
            };
        });
        
        // Cache the full student list
        if (typeof sessionCache !== 'undefined') {
            sessionCache.allStudents = allStudents;
        }
        
        const archivedStudents = allStudents.filter(student => 
            student.status === 'archived' || 
            student.status === 'graduated' || 
            student.status === 'transferred'
        );
        
        const activeStudents = allStudents.filter(student => 
            student.status === 'active' || 
            student.status === 'approved'
        );
        
        // Cache archived students
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage('archivedStudents', archivedStudents);
        }
        if (typeof sessionCache !== 'undefined') {
            sessionCache.archivedStudents = archivedStudents;
        }
        
        // Update badges
        const archivedCount = archivedStudents.filter(s => s.status === 'archived').length;
        const graduatedCount = archivedStudents.filter(s => s.status === 'graduated').length;
        const transferredCount = archivedStudents.filter(s => s.status === 'transferred').length;
        
        document.getElementById('archived-count-badge').textContent = archivedCount;
        document.getElementById('active-students-badge').textContent = activeStudents.length;
        document.getElementById('graduated-count-badge').textContent = graduatedCount;
        document.getElementById('transferred-count-badge').textContent = transferredCount;
        
        renderArchivedStudentsFromCache();
    } catch (error) {
        console.error("Error fetching archived students:", error);
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <p class="text-red-500">Failed to load data. Please try again.</p>
                <button onclick="fetchAndRenderArchivedStudents(true)" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        `;
    }
}

export function renderArchivedStudentsFromCache(searchTerm = '') {
    const archivedStudents = (typeof sessionCache !== 'undefined' && sessionCache.archivedStudents) || [];
    const listContainer = document.getElementById('archived-students-list');
    if (!listContainer) return;
    
    if (archivedStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No archived students found.</p>`;
        return;
    }
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    let filteredStudents = archivedStudents;
    
    if (lowerCaseSearchTerm) {
        filteredStudents = archivedStudents.filter(student => {
            const searchFields = [
                student.studentName || '',
                student.parentName || '',
                student.tutorEmail || '',
                student.tutorName || '',
                student.grade || '',
                student.status || '',
                student.archivedReason || ''
            ];
            
            return searchFields.some(field => 
                field.toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
    }
    
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <p class="text-gray-500">No matching archived students found for "${searchTerm}"</p>
                <button onclick="document.getElementById('archived-search').value = ''; renderArchivedStudentsFromCache();" 
                        class="mt-2 text-blue-600 hover:text-blue-800 underline">
                    Clear search
                </button>
            </div>
        `;
        return;
    }
    
    // Sort by archived date (most recent first)
    filteredStudents.sort((a, b) => {
        const dateA = a.archivedDate?.seconds || (a.archivedDate?.toDate ? a.archivedDate.toDate().getTime() : 0);
        const dateB = b.archivedDate?.seconds || (b.archivedDate?.toDate ? b.archivedDate.toDate().getTime() : 0);
        return dateB - dateA;
    });
    
    listContainer.innerHTML = filteredStudents.map(student => {
        let statusBadge = '';
        let statusColor = '';
        
        switch(student.status) {
            case 'archived':
                statusBadge = 'Archived';
                statusColor = 'bg-gray-100 text-gray-800';
                break;
            case 'graduated':
                statusBadge = 'Graduated';
                statusColor = 'bg-green-100 text-green-800';
                break;
            case 'transferred':
                statusBadge = 'Transferred';
                statusColor = 'bg-blue-100 text-blue-800';
                break;
            default:
                statusBadge = 'Archived';
                statusColor = 'bg-gray-100 text-gray-800';
        }
        
        let archivedDate = 'Unknown';
        if (student.archivedDate) {
            try {
                if (student.archivedDate.toDate) {
                    archivedDate = student.archivedDate.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (student.archivedDate.seconds) {
                    archivedDate = new Date(student.archivedDate.seconds * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (student.archivedDate instanceof Date) {
                    archivedDate = student.archivedDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
            } catch (error) {
                console.error("Error parsing date:", error);
                archivedDate = 'Invalid date';
            }
        }
        
        // Get tutor name properly
        let tutorName = 'Unknown';
        if (student.tutorName) {
            tutorName = student.tutorName;
        } else if (student.tutorHistory && student.tutorHistory.length > 0) {
            const lastTutor = student.tutorHistory[student.tutorHistory.length - 1];
            tutorName = lastTutor.tutorName || lastTutor.tutorEmail || 'Unknown';
        } else if (student.tutorEmail) {
            tutorName = student.tutorEmail.split('@')[0]; // Use email username if no name
        }
        
        return `
            <div class="border p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <div class="flex-1 mb-4 md:mb-0">
                    <div class="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                        <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                        <span class="px-3 py-1 text-sm rounded-full ${statusColor} inline-block w-fit">${statusBadge}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Parent:</span> ${student.parentName}</p>
                            <p class="text-gray-600"><span class="font-medium">Tutor:</span> ${tutorName}</p>
                        </div>
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Grade:</span> ${student.grade}</p>
                            <p class="text-gray-600"><span class="font-medium">Monthly Fee:</span> ₦${(student.studentFee || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p class="text-gray-600"><span class="font-medium">Archived:</span> ${archivedDate}</p>
                            <p class="text-gray-600"><span class="font-medium">By:</span> ${student.archivedBy || 'System'}</p>
                        </div>
                    </div>
                    ${student.archivedReason ? `
                        <div class="mt-3 p-3 bg-gray-200 rounded-lg">
                            <p class="text-sm text-gray-700"><span class="font-medium">Reason:</span> ${student.archivedReason}</p>
                        </div>
                    ` : ''}
                </div>
                <div class="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <button class="restore-student-btn bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors w-full md:w-32" 
                            data-student-id="${student.id}">
                        Restore
                    </button>
                    <button class="view-student-history-btn bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors w-full md:w-32" 
                            data-student-id="${student.id}">
                        View History
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    document.querySelectorAll('.restore-student-btn').forEach(button => {
        const originalText = button.textContent;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRestoreStudent(e.target.dataset.studentId, originalText);
        });
    });
    
    document.querySelectorAll('.view-student-history-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.viewStudentTutorHistory === 'function') {
                window.viewStudentTutorHistory(e.target.dataset.studentId);
            } else {
                alert('Student history feature is not available.');
            }
        });
    });
}

export function showArchiveStudentModal(mode = 'single') {
    // Remove existing modal if any
    const existingModal = document.getElementById('archive-student-modal');
    if (existingModal) existingModal.remove();
    
    const allStudents = (typeof sessionCache !== 'undefined' && sessionCache.allStudents) || [];
    const activeStudents = allStudents.filter(student => 
        student.status === 'active' || 
        student.status === 'approved'
    );
    
    if (activeStudents.length === 0) {
        alert("No active students available to archive.");
        return;
    }
    
    const isBulkMode = mode === 'bulk';
    const modalTitle = isBulkMode ? 'Bulk Archive Students' : 'Archive Student';
    const submitButtonText = isBulkMode ? 'Archive Selected Students' : 'Archive Student';
    
    // Create student list HTML with search
    const modalHtml = `
        <div id="archive-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div class="relative bg-white w-full max-w-3xl rounded-lg shadow-xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-6 border-b">
                    <h3 class="text-xl font-bold text-gray-800">${modalTitle}</h3>
                    <button class="text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('archive-student-modal')">&times;</button>
                </div>
                
                <!-- Modal Body -->
                <form id="archive-student-form" class="p-6">
                    <!-- Student Selection Section -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-3">
                            <label class="block text-sm font-medium text-gray-700">
                                ${isBulkMode ? 'Select Students to Archive' : 'Select Student to Archive'}
                            </label>
                            ${isBulkMode ? `
                                <div class="flex gap-3">
                                    <button type="button" onclick="selectAllStudentsInModal()" class="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                                        Select All
                                    </button>
                                    <button type="button" onclick="deselectAllStudentsInModal()" class="text-xs text-gray-600 hover:text-gray-800 hover:underline">
                                        Deselect All
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Search Input -->
                        <div class="mb-3">
                            <input type="text" 
                                   id="student-search-input" 
                                   placeholder="Search students by name, parent, or tutor..." 
                                   class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                   onkeyup="filterStudentListInModal(this.value)">
                            <p class="text-xs text-gray-500 mt-1">Start typing to search for students...</p>
                        </div>
                        
                        <!-- Student List -->
                        <div id="student-list-container" class="max-h-80 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                            ${activeStudents.map(student => {
                                const tutorDisplay = student.tutorName || student.tutorEmail || 'No tutor assigned';
                                return `
                                    <div class="student-item p-3 mb-2 bg-white rounded-lg border hover:bg-blue-50 transition-colors">
                                        <div class="flex items-center">
                                            ${isBulkMode ? `
                                                <input type="checkbox" 
                                                       id="student-${student.id}" 
                                                       value="${student.id}" 
                                                       class="student-checkbox h-5 w-5 text-blue-600 rounded mr-4">
                                            ` : `
                                                <input type="radio" 
                                                       id="student-${student.id}" 
                                                       name="selectedStudent" 
                                                       value="${student.id}" 
                                                       class="student-radio h-5 w-5 text-blue-600 rounded mr-4">
                                            `}
                                            <label for="student-${student.id}" class="flex-1 cursor-pointer">
                                                <div class="flex flex-col md:flex-row md:items-center justify-between">
                                                    <div>
                                                        <div class="font-bold text-gray-800">${student.studentName}</div>
                                                        <div class="text-sm text-gray-600 mt-1">
                                                            <span class="inline-block mr-3"><strong>Parent:</strong> ${student.parentName}</span>
                                                            <span class="inline-block mr-3"><strong>Grade:</strong> ${student.grade}</span>
                                                            <span class="inline-block"><strong>Tutor:</strong> ${tutorDisplay}</span>
                                                        </div>
                                                    </div>
                                                    <div class="mt-2 md:mt-0">
                                                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                                            Active
                                                        </span>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <p class="text-sm text-gray-500 mt-2">${activeStudents.length} active student(s) found</p>
                    </div>
                    
                    <!-- Archive Details Section -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Archive Status <span class="text-red-500">*</span>
                            </label>
                            <select id="archive-status" required 
                                    class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="" disabled selected>Select status...</option>
                                <option value="archived">Archived (no longer with company)</option>
                                <option value="graduated">Graduated (completed program)</option>
                                <option value="transferred">Transferred (moved to another tutor/company)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Effective Date <span class="text-red-500">*</span>
                            </label>
                            <input type="date" id="archive-date" required
                                   class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    
                    <!-- Reason Section -->
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Archiving (Optional)
                        </label>
                        <textarea id="archive-reason" rows="3" 
                                  class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter reason for archiving..."></textarea>
                    </div>
                    
                    <!-- Notification Option -->
                    <div class="mb-6">
                        <div class="flex items-center">
                            <input type="checkbox" id="send-notification" class="h-5 w-5 text-blue-600 rounded mr-3">
                            <label for="send-notification" class="text-sm text-gray-700">
                                Send notification email to tutor and parent
                            </label>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                            If checked, an email will be sent to notify about the student's status change.
                        </p>
                    </div>
                    
                    <!-- Progress Bar (Hidden by default) -->
                    <div id="archive-progress" class="hidden mb-6">
                        <div class="flex justify-between mb-1">
                            <span class="text-sm font-medium text-gray-700">Progress</span>
                            <span id="progress-percentage" class="text-sm font-medium text-gray-700">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div id="progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                        <p id="progress-text" class="text-sm text-gray-600 mt-2">Preparing to archive...</p>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" 
                                onclick="closeManagementModal('archive-student-modal')" 
                                class="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" 
                                id="submit-archive-btn" 
                                class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center min-w-[180px]">
                            <span id="submit-text">${submitButtonText}</span>
                            <span id="submit-spinner" class="hidden ml-2 animate-spin">⟳</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Initialize search functionality
    window.filterStudentListInModal = function(searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const studentItems = document.querySelectorAll('#student-list-container .student-item');
        
        let visibleCount = 0;
        studentItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchLower)) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Update count if available
        const countElement = document.querySelector('#student-list-container + p');
        if (countElement) {
            countElement.textContent = `${visibleCount} student(s) found`;
        }
    };
    
    // Initialize select/deselect functions
    window.selectAllStudentsInModal = function() {
        document.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
    };
    
    window.deselectAllStudentsInModal = function() {
        document.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    };
    
    // Add form submit handler
    document.getElementById('archive-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('submit-archive-btn');
        const submitText = document.getElementById('submit-text');
        const submitSpinner = document.getElementById('submit-spinner');
        const progressDiv = document.getElementById('archive-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressText = document.getElementById('progress-text');
        
        // Get selected student IDs
        let studentIds = [];
        if (isBulkMode) {
            const checkboxes = document.querySelectorAll('.student-checkbox:checked');
            studentIds = Array.from(checkboxes).map(cb => cb.value);
        } else {
            const selectedRadio = document.querySelector('.student-radio:checked');
            if (!selectedRadio) {
                alert("Please select a student.");
                return;
            }
            studentIds = [selectedRadio.value];
        }
        
        if (studentIds.length === 0) {
            alert("Please select at least one student.");
            return;
        }
        
        const status = document.getElementById('archive-status').value;
        const reason = document.getElementById('archive-reason').value;
        const date = document.getElementById('archive-date').value;
        const sendNotification = document.getElementById('send-notification').checked;
        
        if (!status) {
            alert("Please select an archive status.");
            return;
        }
        
        if (!date) {
            alert("Please select an effective date.");
            return;
        }
        
        // Show confirmation
        const confirmationMessage = isBulkMode 
            ? `Are you sure you want to archive ${studentIds.length} student(s)? This action cannot be undone.`
            : `Are you sure you want to archive this student? This action cannot be undone.`;
        
        if (!confirm(confirmationMessage)) {
            return;
        }
        
        // Disable submit button and show progress
        submitBtn.disabled = true;
        submitText.textContent = 'Archiving...';
        submitSpinner.classList.remove('hidden');
        progressDiv.classList.remove('hidden');
        
        try {
            const batch = writeBatch(db);
            const archiveDate = new Date(date);
            
            for (let i = 0; i < studentIds.length; i++) {
                const studentId = studentIds[i];
                const studentRef = doc(db, "students", studentId);
                
                // Update student document
                batch.update(studentRef, {
                    status: status,
                    archivedReason: reason || '',
                    archivedDate: Timestamp.fromDate(archiveDate),
                    archivedBy: window.userData?.email || 'management',
                    lastUpdated: Timestamp.now(),
                    archivedNotificationSent: sendNotification
                });
                
                // Update progress
                const progress = ((i + 1) / studentIds.length) * 100;
                progressBar.style.width = `${progress}%`;
                progressPercentage.textContent = `${Math.round(progress)}%`;
                progressText.textContent = `Archiving student ${i + 1} of ${studentIds.length}...`;
            }
            
            // Commit the batch
            await batch.commit();
            
            // Update UI to show success
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            progressText.textContent = `Successfully archived ${studentIds.length} student(s)!`;
            submitText.textContent = 'Completed!';
            
            // Show success message
            setTimeout(() => {
                alert(`${studentIds.length} student(s) have been archived successfully!`);
                closeManagementModal('archive-student-modal');
                
                // Refresh data
                if (typeof invalidateCache === 'function') {
                    invalidateCache('archivedStudents');
                    invalidateCache('students');
                }
                
                fetchAndRenderArchivedStudents(true);
            }, 1000);
            
        } catch (error) {
            console.error("Error archiving student(s):", error);
            
            // Show error state
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-red-600');
            progressText.textContent = 'Error: Failed to archive student(s)';
            submitText.textContent = 'Error - Try Again';
            submitBtn.disabled = false;
            submitSpinner.classList.add('hidden');
            
            setTimeout(() => {
                alert(`Failed to archive student(s). Error: ${error.message}`);
            }, 500);
        }
    });
}

export async function handleRestoreStudent(studentId, originalButtonText = 'Restore') {
    if (!confirm("Are you sure you want to restore this student to active status?")) {
        return;
    }
    
    const restoreBtn = document.querySelector(`[data-student-id="${studentId}"].restore-student-btn`);
    if (restoreBtn) {
        restoreBtn.disabled = true;
        restoreBtn.textContent = 'Restoring...';
        restoreBtn.classList.add('opacity-50');
    }
    
    try {
        await updateDoc(doc(db, "students", studentId), {
            status: 'active',
            restoredDate: Timestamp.now(),
            restoredBy: window.userData?.email || 'management',
            lastUpdated: Timestamp.now(),
            archivedReason: '', // Clear archive reason
            archivedBy: '' // Clear archived by
        });
        
        // Show success message
        if (restoreBtn) {
            restoreBtn.textContent = 'Restored!';
            restoreBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            restoreBtn.classList.add('bg-green-600');
            
            setTimeout(() => {
                restoreBtn.disabled = false;
                restoreBtn.textContent = originalButtonText;
                restoreBtn.classList.remove('opacity-50', 'bg-green-600');
                restoreBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            }, 1500);
        }
        
        // Show notification
        showNotification('Student restored successfully!', 'success');
        
        // Refresh data
        if (typeof invalidateCache === 'function') {
            invalidateCache('archivedStudents');
            invalidateCache('students');
        }
        
        // Refresh the archived students list
        setTimeout(() => {
            fetchAndRenderArchivedStudents(true);
        }, 500);
        
    } catch (error) {
        console.error("Error restoring student:", error);
        
        if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = 'Error - Retry';
            restoreBtn.classList.remove('opacity-50');
            restoreBtn.classList.add('bg-red-500', 'hover:bg-red-600');
            
            // Revert after 2 seconds
            setTimeout(() => {
                restoreBtn.textContent = originalButtonText;
                restoreBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                restoreBtn.classList.add('bg-green-500', 'hover:bg-green-600');
            }, 2000);
        }
        
        showNotification('Failed to restore student. Please try again.', 'error');
    }
}

// Helper function to show notifications
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    notification.style.maxWidth = '300px';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ======================================================
