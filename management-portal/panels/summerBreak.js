// ============================================================
// panels/summerBreak.js
// Summer break students and recall requests
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

// SUBSECTION 5.4: Summer Break Panel (UPDATED WITH RECALL REQUESTS)
// ======================================================

export async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Summer Break Management</h2>
                <div class="flex items-center gap-4 flex-wrap">
                    <div class="relative" style="min-width: 300px;">
                        <input type="search" id="break-search" placeholder="Search students by name, tutor, or parent..." 
                               class="p-2 pl-10 border rounded-md w-full focus:ring-2 focus:ring-green-500 focus:border-transparent">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    </div>
                    <select id="view-filter" class="p-2 border rounded-md bg-white">
                        <option value="all">All Students on Break</option>
                        <option value="pending_recall">Pending Recall Requests</option>
                        <option value="tutors">Group by Tutor</option>
                    </select>
                    <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                        <i class="fas fa-sync-alt mr-2"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Stats Dashboard -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-yellow-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-yellow-800 text-sm">Students on Break</h4>
                    <p id="break-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                    <p id="break-tutor-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-purple-800 text-sm">Pending Recall Requests</h4>
                    <p id="recall-requests-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-blue-100 p-4 rounded-lg text-center shadow">
                    <h4 class="font-bold text-blue-800 text-sm">Total Monthly Fees</h4>
                    <p id="break-fees-total" class="text-xl font-extrabold">₦0</p>
                </div>
            </div>
            
            <!-- Tabs for different views -->
            <div class="flex border-b mb-6">
                <button id="break-tab" class="tab-btn active px-4 py-2 font-medium border-b-2 border-green-600 text-green-600">Students on Break</button>
                <button id="recall-tab" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-purple-600">Recall Requests</button>
            </div>
            
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            
            <!-- Students on Break View -->
            <div id="break-students-view" class="space-y-4">
                <div id="break-students-list" class="space-y-4">
                    <div class="text-center py-10">
                        <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                        <p class="text-green-600 font-semibold mt-4">Loading summer break students...</p>
                    </div>
                </div>
            </div>
            
            <!-- Recall Requests View -->
            <div id="recall-requests-view" class="space-y-4 hidden">
                <div id="recall-requests-list" class="space-y-4">
                    <div class="text-center py-10">
                        <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                        <p class="text-purple-600 font-semibold mt-4">Loading recall requests...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize session cache if it doesn't exist
    window.sessionCache = window.sessionCache || {};
    if (!window.sessionCache.breakStudents) window.sessionCache.breakStudents = [];
    if (!window.sessionCache.recallRequests) window.sessionCache.recallRequests = [];
    
    // Add CSS for loading spinner
    const style = document.createElement('style');
    style.textContent = `
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #10b981;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .tab-btn {
            transition: all 0.3s ease;
        }
        .tab-btn:hover {
            transform: translateY(-1px);
        }
    `;
    document.head.appendChild(style);
    
    // Event Listeners
    document.getElementById('refresh-break-btn').addEventListener('click', () => {
        fetchAndRenderBreakStudents(true);
        fetchRecallRequests(true);
    });
    
    document.getElementById('break-search').addEventListener('input', (e) => handleBreakSearch(e.target.value));
    document.getElementById('view-filter').addEventListener('change', (e) => handleViewFilterChange(e.target.value));
    
    // Tab switching
    document.getElementById('break-tab').addEventListener('click', () => switchTab('break'));
    document.getElementById('recall-tab').addEventListener('click', () => switchTab('recall'));
    
    // Fetch both sets of data
    fetchAndRenderBreakStudents();
    fetchRecallRequests();
}

export function switchTab(tab) {
    
    const breakTab = document.getElementById('break-tab');
    const recallTab = document.getElementById('recall-tab');
    const breakView = document.getElementById('break-students-view');
    const recallView = document.getElementById('recall-requests-view');
    
    if (tab === 'break') {
        breakTab.classList.add('active', 'border-b-2', 'border-green-600', 'text-green-600');
        breakTab.classList.remove('text-gray-500');
        recallTab.classList.remove('active', 'border-b-2', 'border-purple-600', 'text-purple-600');
        recallTab.classList.add('text-gray-500');
        breakView.classList.remove('hidden');
        recallView.classList.add('hidden');
    } else {
        recallTab.classList.add('active', 'border-b-2', 'border-purple-600', 'text-purple-600');
        recallTab.classList.remove('text-gray-500');
        breakTab.classList.remove('active', 'border-b-2', 'border-green-600', 'text-green-600');
        breakTab.classList.add('text-gray-500');
        recallView.classList.remove('hidden');
        breakView.classList.add('hidden');
        
        // Force refresh of recall requests when switching to recall tab
        setTimeout(() => {
            if (!window.sessionCache.recallRequests || window.sessionCache.recallRequests.length === 0) {
                fetchRecallRequests(true);
            } else {
                renderRecallRequests(window.sessionCache.recallRequests);
            }
        }, 100);
    }
}

export function handleViewFilterChange(filterValue) {
    const searchInput = document.getElementById('break-search');
    const currentSearchTerm = searchInput ? searchInput.value : '';
    renderBreakStudentsFromCache(currentSearchTerm, filterValue);
}

export function handleBreakSearch(searchTerm) {
    const filterValue = document.getElementById('view-filter') ? document.getElementById('view-filter').value : 'all';
    renderBreakStudentsFromCache(searchTerm, filterValue);
}

export async function fetchRecallRequests(forceRefresh = false) {
    
    try {
        // Check if Firestore is properly initialized
        if (!db) {
            console.error("❌ Firestore db not initialized");
            return;
        }
        
        const listContainer = document.getElementById('recall-requests-list');
        if (listContainer && !listContainer.innerHTML.includes("spinner")) {
            listContainer.innerHTML = `<div class="text-center py-10">
                <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                <p class="text-purple-600 font-semibold mt-4">Loading recall requests...</p>
            </div>`;
        }
        
        // Query the recall_requests collection
        const recallQuery = query(collection(db, "recall_requests"), where("status", "==", "pending"));
        
        const snapshot = await getDocs(recallQuery);
        
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            let requestDate;
            
            // Handle Firestore timestamp conversion
            if (data.requestDate && data.requestDate.toDate) {
                requestDate = data.requestDate.toDate();
            } else if (data.requestDate && data.requestDate.seconds) {
                requestDate = new Date(data.requestDate.seconds * 1000);
            } else if (data.requestDate) {
                requestDate = new Date(data.requestDate);
            } else {
                requestDate = new Date();
            }
            
            return { 
                id: doc.id, 
                ...data,
                requestDate: requestDate,
                studentName: data.studentName || 'Unknown Student',
                tutorName: data.tutorName || 'Unknown Tutor',
                tutorEmail: data.tutorEmail || 'No email'
            };
        });
        
        
        // Sort by most recent
        requests.sort((a, b) => b.requestDate - a.requestDate);
        
        window.sessionCache.recallRequests = requests;
        
        // Update count
        const countElement = document.getElementById('recall-requests-count');
        if (countElement) {
            countElement.textContent = requests.length;
        }
        
        // Check if recall tab is active
        const recallView = document.getElementById('recall-requests-view');
        const isRecallTabActive = recallView && !recallView.classList.contains('hidden');
        
        
        if (isRecallTabActive) {
            renderRecallRequests(requests);
        }
        
    } catch (error) {
        console.error("❌ Error fetching recall requests:", error);
        console.error("Error details:", error.message, error.stack);
        
        const container = document.getElementById('recall-requests-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="font-semibold">Failed to load recall requests</p>
                    <p class="text-sm mt-2">Error: ${error.message}</p>
                    <div class="mt-4 space-y-2">
                        <button onclick="fetchRecallRequests(true)" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Try Again
                        </button>
                        <button onclick="void(0)" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700" style="display:none;">
                            Debug Cache
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

export function renderRecallRequests(requests) {
    
    const container = document.getElementById('recall-requests-list');
    if (!container) {
        console.error("❌ Recall requests container not found!");
        return;
    }
    
    if (!requests || requests.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10">
                <i class="fas fa-inbox text-purple-400 text-4xl mb-4"></i>
                <p class="text-gray-600">No pending recall requests</p>
                <p class="text-sm text-gray-400 mt-2">All requests have been processed</p>
                <button onclick="fetchRecallRequests(true)" class="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                    <i class="fas fa-sync-alt mr-2"></i> Refresh
                </button>
            </div>
        `;
        return;
    }
    
    
    let html = '';
    
    requests.forEach((request, index) => {
        const requestDate = request.requestDate ? request.requestDate.toLocaleString() : 'Unknown date';
        
        html += `
            <div class="border-l-4 border-l-purple-500 bg-gray-50 p-6 rounded-r-lg hover:bg-gray-100 transition-colors mb-4">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="bg-purple-100 p-2 rounded-lg">
                                <i class="fas fa-undo-alt text-purple-600"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-lg text-gray-800">${request.studentName}</h3>
                                <p class="text-sm text-gray-600">Requested by: ${request.tutorName} (${request.tutorEmail})</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div class="bg-white p-3 rounded border">
                                <p class="text-sm font-medium text-gray-500">Request Details</p>
                                <p class="mt-1"><i class="fas fa-calendar-alt mr-2 text-gray-400"></i>Requested: ${requestDate}</p>
                                <p><i class="fas fa-user mr-2 text-gray-400"></i>Student ID: ${request.studentId}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <p class="text-sm font-medium text-gray-500">Tutor Information</p>
                                <p class="mt-1"><i class="fas fa-chalkboard-teacher mr-2 text-gray-400"></i>Tutor: ${request.tutorName}</p>
                                <p><i class="fas fa-envelope mr-2 text-gray-400"></i>Email: ${request.tutorEmail}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 ml-4">
                        <button class="approve-recall-btn bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-request-id="${request.id}"
                                data-student-id="${request.studentId}"
                                data-student-name="${request.studentName}"
                                data-tutor-email="${request.tutorEmail}">
                            <i class="fas fa-check mr-2"></i> Approve
                        </button>
                        <button class="reject-recall-btn bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-request-id="${request.id}"
                                data-student-name="${request.studentName}">
                            <i class="fas fa-times mr-2"></i> Reject
                        </button>
                    </div>
                </div>
                
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span><i class="fas fa-info-circle mr-1"></i> Action will take the student off break immediately</span>
                    <span>Request #${index + 1}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners
    const approveBtns = document.querySelectorAll('.approve-recall-btn');
    const rejectBtns = document.querySelectorAll('.reject-recall-btn');
    
    
    approveBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleRecallRequest(e.currentTarget, 'approve');
        });
    });
    
    rejectBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleRecallRequest(e.currentTarget, 'reject');
        });
    });
}

export async function handleRecallRequest(button, action) {
    const requestId = button.dataset.requestId;
    const studentId = button.dataset.studentId;
    const studentName = button.dataset.studentName;
    const tutorEmail = button.dataset.tutorEmail;
    const adminName = window.currentAdmin?.name || "Management";
    
    const actionText = action === 'approve' ? 'approve' : 'reject';
    const confirmation = confirm(`Are you sure you want to ${actionText} the recall request for ${studentName}?`);
    
    if (!confirmation) return;
    
    try {
        const originalText = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Processing...`;
        button.disabled = true;
        
        // Update the recall request status
        await updateDoc(doc(db, "recall_requests", requestId), { 
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewedBy: adminName,
            reviewDate: Timestamp.now(),
            notes: action === 'approve' ? 'Recall approved by management' : 'Recall rejected by management'
        });
        
        // If approved, also update the student's break status
        if (action === 'approve') {
            await updateDoc(doc(db, "students", studentId), { 
                summerBreak: false,
                lastBreakEnd: Timestamp.now(),
                lastUpdated: Timestamp.now()
            });
            
            // Send notification to tutor
            await sendTutorNotification(tutorEmail, studentName, 'recall_approved');
        }
        
        // Show success message
        const statusMessage = document.getElementById('break-status-message');
        statusMessage.textContent = action === 'approve' 
            ? `✅ Recall approved! ${studentName} has been taken off summer break.`
            : `✅ Recall request rejected for ${studentName}.`;
        statusMessage.className = `text-center font-semibold mb-4 ${action === 'approve' ? 'text-green-600' : 'text-yellow-600'} p-3 ${action === 'approve' ? 'bg-green-50' : 'bg-yellow-50'} rounded-lg`;
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 4000);
        
        // Refresh data
        window.sessionCache.recallRequests = null;
        window.sessionCache.breakStudents = null;
        
        // Re-fetch both data sets
        await Promise.all([
            fetchRecallRequests(true),
            fetchAndRenderBreakStudents(true)
        ]);
        
    } catch (error) {
        console.error(`Error ${action}ing recall request:`, error);
        
        // Show error message
        const statusMessage = document.getElementById('break-status-message');
        statusMessage.textContent = `❌ Failed to ${action} recall request for ${studentName}. Error: ${error.message}`;
        statusMessage.className = 'text-center font-semibold mb-4 text-red-600 p-3 bg-red-50 rounded-lg';
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
        
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

export async function sendTutorNotification(tutorEmail, studentName, notificationType) {
    try {
        const notificationRef = doc(collection(db, "tutor_notifications"));
        await setDoc(notificationRef, {
            tutorEmail: tutorEmail,
            studentName: studentName,
            type: notificationType,
            message: notificationType === 'recall_approved' 
                ? `Your recall request for ${studentName} has been approved. The student is now active.`
                : `Your recall request for ${studentName} has been processed.`,
            read: false,
            createdAt: Timestamp.now(),
            actionUrl: '#studentDatabase'
        });
    } catch (error) {
        console.error("Error sending notification:", error);
    }
}

export async function fetchAndRenderBreakStudents(forceRefresh = false) {
    const listContainer = document.getElementById('break-students-list');
    
    try {
        if (forceRefresh || !window.sessionCache.breakStudents || window.sessionCache.breakStudents.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `<div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Fetching student break status...</p>
                </div>`;
            }
            
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            const allBreakStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const activeBreakStudents = allBreakStudents.filter(student => 
                !student.status || student.status === 'active' || student.status === 'approved'
            );
            
            window.sessionCache.breakStudents = activeBreakStudents;
        }
        
        // Calculate total fees (excluding break students)
        const totalFees = window.sessionCache.breakStudents.reduce((total, student) => {
            return total + (student.studentFee || 0);
        }, 0);
        
        // Update fees total display
        const feesElement = document.getElementById('break-fees-total');
        if (feesElement) {
            feesElement.textContent = `₦${totalFees.toLocaleString()}`;
        }
        
        const searchInput = document.getElementById('break-search');
        const currentSearchTerm = searchInput ? searchInput.value : '';
        const filterValue = document.getElementById('view-filter') ? document.getElementById('view-filter').value : 'all';
        
        renderBreakStudentsFromCache(currentSearchTerm, filterValue);
        
    } catch(error) {
        console.error("Error fetching break students:", error);
        const listContainer = document.getElementById('break-students-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <p class="font-semibold">Failed to load summer break data</p>
                    <p class="text-sm mt-2">${error.message}</p>
                    <button onclick="fetchAndRenderBreakStudents(true)" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

export function renderBreakStudentsFromCache(searchTerm = '', filterValue = 'all') {
    const breakStudents = window.sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;
    
    // Update counts
    const uniqueTutors = [...new Set(breakStudents.map(s => s.tutorEmail))].filter(Boolean);
    const breakCountElement = document.getElementById('break-count-badge');
    const tutorCountElement = document.getElementById('break-tutor-count');
    
    if (breakCountElement) breakCountElement.textContent = breakStudents.length;
    if (tutorCountElement) tutorCountElement.textContent = uniqueTutors.length;
    
    // Filter based on search term
    let filteredStudents = breakStudents;
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    
    if (searchTerm) {
        filteredStudents = breakStudents.filter(student => {
            const searchFields = [
                student.studentName,
                student.tutorEmail,
                student.tutorName,
                student.parentName,
                student.parentPhone,
                student.grade,
                student.days
            ];
            
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
    }
    
    // Apply additional filter if needed
    if (filterValue === 'pending_recall') {
        const pendingRecallIds = (window.sessionCache.recallRequests || [])
            .filter(req => req.status === 'pending')
            .map(req => req.studentId);
        
        filteredStudents = filteredStudents.filter(student => 
            pendingRecallIds.includes(student.id)
        );
    }
    
    // Handle empty results
    if (filteredStudents.length === 0) {
        if (searchTerm) {
            listContainer.innerHTML = `
                <div class="text-center py-10">
                    <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-600">No students found matching "${searchTerm}"</p>
                    <p class="text-sm text-gray-400 mt-2">Try a different search term</p>
                    <button onclick="document.getElementById('break-search').value = ''; renderBreakStudentsFromCache('')" 
                            class="mt-4 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">
                        Clear Search
                    </button>
                </div>
            `;
        } else {
            listContainer.innerHTML = `
                <div class="text-center py-10">
                    <i class="fas fa-umbrella-beach text-green-400 text-4xl mb-4"></i>
                    <p class="text-gray-600">No active students are currently on summer break</p>
                    <p class="text-sm text-gray-400 mt-2">All students are active</p>
                </div>
            `;
        }
        return;
    }
    
    // Group students by tutor
    const studentsByTutor = {};
    filteredStudents.forEach(student => {
        const tutorKey = student.tutorEmail || 'No Tutor Assigned';
        if (!studentsByTutor[tutorKey]) {
            studentsByTutor[tutorKey] = {
                tutorName: student.tutorName || student.tutorEmail || 'Unknown Tutor',
                tutorEmail: student.tutorEmail,
                students: []
            };
        }
        studentsByTutor[tutorKey].students.push(student);
    });
    
    let html = '';
    
    Object.values(studentsByTutor).forEach(tutorGroup => {
        const studentItems = tutorGroup.students.map(student => {
            const breakInfo = student.lastBreakStart ? 
                `Break started: ${new Date(student.lastBreakStart.seconds * 1000).toLocaleDateString()}` : 
                'No break start date recorded';
            
            // Check if this student has a pending recall request
            const hasRecallRequest = (window.sessionCache.recallRequests || []).some(req => 
                req.studentId === student.id && req.status === 'pending'
            );
            
            return `
                <div class="border-l-4 border-l-yellow-500 bg-gray-50 p-4 rounded-r-lg flex justify-between items-center hover:bg-gray-100 transition-colors">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 class="font-bold text-lg text-gray-800">${student.studentName}</h3>
                            <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">On Summer Break</span>
                            ${hasRecallRequest ? `<span class="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">Recall Requested</span>` : ''}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                            <div>
                                <p><i class="fas fa-graduation-cap mr-2 text-gray-400"></i>Grade: ${student.grade || 'N/A'}</p>
                                <p><i class="fas fa-calendar mr-2 text-gray-400"></i>Days/Week: ${student.days || 'N/A'}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-user-friends mr-2 text-gray-400"></i>Parent: ${student.parentName || 'N/A'}</p>
                                <p><i class="fas fa-phone mr-2 text-gray-400"></i>Phone: ${student.parentPhone || 'N/A'}</p>
                            </div>
                            <div>
                                <p><i class="fas fa-money-bill-wave mr-2 text-gray-400"></i>Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                                <p><i class="fas fa-calendar-alt mr-2 text-gray-400"></i>${breakInfo}</p>
                            </div>
                        </div>
                        <div class="mt-3 text-xs text-gray-500">
                            <p><i class="fas fa-chalkboard-teacher mr-1"></i>Assigned to: ${student.tutorName || student.tutorEmail || 'No tutor assigned'}</p>
                        </div>
                    </div>
                    <div class="ml-4">
                        <button class="end-break-btn bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap font-medium"
                                data-student-id="${student.id}"
                                data-student-name="${student.studentName}"
                                data-tutor-name="${student.tutorName || student.tutorEmail || 'Unknown Tutor'}">
                            <i class="fas fa-flag mr-2"></i> End Break
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        html += `
            <div class="border rounded-lg shadow-sm mb-6">
                <div class="p-4 bg-yellow-50 border-b rounded-t-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg text-gray-800">${tutorGroup.tutorName}</h3>
                            <p class="text-sm text-gray-600">${tutorGroup.tutorEmail || 'No email'}</p>
                        </div>
                        <span class="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${tutorGroup.students.length} student${tutorGroup.students.length !== 1 ? 's' : ''} on break
                        </span>
                    </div>
                </div>
                <div class="space-y-3 p-4">
                    ${studentItems}
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    
    // Add event listeners to End Break buttons
    document.querySelectorAll('.end-break-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const studentId = e.currentTarget.dataset.studentId;
            const studentName = e.currentTarget.dataset.studentName;
            const tutorName = e.currentTarget.dataset.tutorName;
            
            const confirmation = confirm(`Are you sure you want to take ${studentName} off summer break and return them to ${tutorName}?`);
            
            if (!confirmation) {
                return;
            }
            
            try {
                const originalText = e.currentTarget.innerHTML;
                e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Ending Break...';
                e.currentTarget.disabled = true;
                
                await updateDoc(doc(db, "students", studentId), { 
                    summerBreak: false, 
                    lastBreakEnd: Timestamp.now(),
                    lastUpdated: Timestamp.now()
                });
                
                // Show success message
                const statusMessage = document.getElementById('break-status-message');
                statusMessage.textContent = `✅ Summer break ended for ${studentName}. Student is now active with ${tutorName}.`;
                statusMessage.className = 'text-center font-semibold mb-4 text-green-600 p-3 bg-green-50 rounded-lg';
                statusMessage.classList.remove('hidden');
                
                setTimeout(() => {
                    statusMessage.classList.add('hidden');
                }, 4000);
                
                // Invalidate caches
                window.sessionCache.breakStudents = null;
                
                // Force refresh
                await fetchAndRenderBreakStudents(true);
                
            } catch (error) {
                console.error("Error ending summer break:", error);
                
                // Show error message
                const statusMessage = document.getElementById('break-status-message');
                statusMessage.textContent = `❌ Failed to End Break for ${studentName}. Error: ${error.message}`;
                statusMessage.className = 'text-center font-semibold mb-4 text-red-600 p-3 bg-red-50 rounded-lg';
                statusMessage.classList.remove('hidden');
                
                setTimeout(() => {
                    statusMessage.classList.add('hidden');
                }, 5000);
                
                // Reset button
                e.currentTarget.innerHTML = originalText;
                e.currentTarget.disabled = false;
            }
        });
    });
}

// Add this debug button to your HTML temporarily:
// <button onclick="testRecallRequests()" class="bg-red-500 text-white px-4 py-2 rounded">Test Recall Requests</button>

// And add this test function:
export async function testRecallRequests() {
    
    try {
        // Test 1: Check Firestore connection
        
        // Test 2: Check if collection exists by trying to get count
        const testQuery = query(collection(db, "recall_requests"));
        const testSnapshot = await getDocs(testQuery);
        
        // Test 3: Show all documents
        testSnapshot.forEach(doc => {
        });
        
        // Test 4: Try the actual query
        const pendingQuery = query(collection(db, "recall_requests"), where("status", "==", "pending"));
        const pendingSnapshot = await getDocs(pendingQuery);
        
        if (pendingSnapshot.size === 0) {
        }
        
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// ======================================================
