// ============================================================
// panels/inactiveTutors.js
// Inactive tutors list and reactivation
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

// SUBSECTION 3.2: Inactive Tutors Panel
// ======================================================

export async function renderInactiveTutorsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-700">Inactive Tutors</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="inactive-search" placeholder="Search inactive tutors..." class="p-2 border rounded-md w-64">
                    <button id="refresh-inactive-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="mark-inactive-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Mark Tutor as Inactive</button>
                </div>
            </div>
            
            <div class="flex space-x-4 mb-6">
                <div class="bg-gray-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-gray-800 text-sm">Total Inactive Tutors</h4>
                    <p id="inactive-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Active Tutors</h4>
                    <p id="active-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">On Leave</h4>
                    <p id="leave-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>

            <div id="inactive-tutors-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading inactive tutors...</p>
            </div>
        </div>
    `;
    
    document.getElementById('refresh-inactive-btn').addEventListener('click', () => fetchAndRenderInactiveTutors(true));
    document.getElementById('inactive-search').addEventListener('input', (e) => renderInactiveTutorsFromCache(e.target.value));
    document.getElementById('mark-inactive-btn').addEventListener('click', showMarkInactiveModal);
    
    fetchAndRenderInactiveTutors();
}

export async function fetchAndRenderInactiveTutors(forceRefresh = false) {
    if (forceRefresh) invalidateCache('inactiveTutors');
    
    const listContainer = document.getElementById('inactive-tutors-list');
    if (!listContainer) return;
    
    try {
        if (!sessionCache.inactiveTutors) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching tutor data...</p>`;
            
            const tutorsSnapshot = await getDocs(collection(db, "tutors"));
            const allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const inactiveTutors = allTutors.filter(tutor => tutor.status === 'inactive' || tutor.status === 'on_leave');
            const activeTutors = allTutors.filter(tutor => !tutor.status || tutor.status === 'active');
            
            saveToLocalStorage('inactiveTutors', inactiveTutors);
            
            document.getElementById('inactive-count-badge').textContent = inactiveTutors.filter(t => t.status === 'inactive').length;
            document.getElementById('active-count-badge').textContent = activeTutors.length;
            document.getElementById('leave-count-badge').textContent = inactiveTutors.filter(t => t.status === 'on_leave').length;
        }
        
        renderInactiveTutorsFromCache();
    } catch (error) {
        console.error("Error fetching inactive tutors:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

export function renderInactiveTutorsFromCache(searchTerm = '') {
    const inactiveTutors = sessionCache.inactiveTutors || [];
    const listContainer = document.getElementById('inactive-tutors-list');
    if (!listContainer) return;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredTutors = inactiveTutors.filter(tutor => 
        tutor.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        tutor.email.toLowerCase().includes(lowerCaseSearchTerm)
    );
    
    if (filteredTutors.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">${searchTerm ? 'No matching inactive tutors found.' : 'No inactive tutors found.'}</p>`;
        return;
    }
    
    listContainer.innerHTML = filteredTutors.map(tutor => {
        const statusBadge = tutor.status === 'inactive' 
            ? '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Inactive</span>'
            : '<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">On Leave</span>';
        
        const inactiveDate = tutor.inactiveDate ? new Date(tutor.inactiveDate.seconds * 1000).toLocaleDateString() : 'Unknown';
        
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                <div class="flex-1">
                    <h3 class="font-bold text-lg text-gray-800">${tutor.name}</h3>
                    <p class="text-gray-600">${tutor.email}</p>
                    <div class="mt-2 flex items-center space-x-4 text-sm">
                        <span>${statusBadge}</span>
                        <span class="text-gray-500">Inactive since: ${inactiveDate}</span>
                        ${tutor.inactiveReason ? `<span class="text-gray-500">Reason: ${tutor.inactiveReason}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="reactivate-btn bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600" data-tutor-id="${tutor.id}">Reactivate</button>
                    <button class="view-history-btn bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">View History</button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.reactivate-btn').forEach(button => {
        button.addEventListener('click', (e) => handleReactivateTutor(e.target.dataset.tutorId));
    });
    
    document.querySelectorAll('.view-history-btn').forEach(button => {
        button.addEventListener('click', (e) => showTutorHistory(e.target.dataset.tutorId));
    });
}

export function showMarkInactiveModal() {
    const allTutors = sessionCache.tutors || [];
    const inactiveTutors = sessionCache.inactiveTutors || [];
    
    const activeTutorsFiltered = allTutors.filter(tutor => 
        !tutor.status || tutor.status === 'active'
    );
    
    if (activeTutorsFiltered.length === 0) {
        alert("No active tutors available to mark as inactive.");
        return;
    }
    
    const tutorOptions = activeTutorsFiltered
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => `<option value="${tutor.id}">${tutor.name} (${tutor.email})</option>`)
        .join('');
    
    const modalHtml = `
        <div id="mark-inactive-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('mark-inactive-modal')">&times;</button>
                <h3 class="text-xl font-bold mb-4">Mark Tutor as Inactive</h3>
                <form id="mark-inactive-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Select Tutor</label>
                        <select id="inactive-tutor-select" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="" disabled selected>Select a tutor...</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Status</label>
                        <select id="inactive-status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="inactive">Inactive (no longer working)</option>
                            <option value="on_leave">On Leave (temporary)</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Reason (optional)</label>
                        <textarea id="inactive-reason" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="Reason for inactivity..."></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Effective Date</label>
                        <input type="date" id="inactive-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="closeManagementModal('mark-inactive-modal')" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Mark as Inactive</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('mark-inactive-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const tutorId = form.elements['inactive-tutor-select'].value;
        const status = form.elements['inactive-status'].value;
        const reason = form.elements['inactive-reason'].value;
        const date = form.elements['inactive-date'].value;
        
        try {
            await updateDoc(doc(db, "tutors", tutorId), {
                status: status,
                inactiveReason: reason || '',
                inactiveDate: Timestamp.fromDate(new Date(date)),
                lastUpdated: Timestamp.now()
            });
            
            alert("Tutor marked as inactive successfully!");
            closeManagementModal('mark-inactive-modal');
            invalidateCache('inactiveTutors');
            invalidateCache('tutors');
            fetchAndRenderInactiveTutors(true);
            
        } catch (error) {
            console.error("Error marking tutor as inactive:", error);
            alert("Failed to mark tutor as inactive. Please try again.");
        }
    });
}

export async function handleReactivateTutor(tutorId) {
    if (confirm("Are you sure you want to reactivate this tutor?")) {
        try {
            await updateDoc(doc(db, "tutors", tutorId), {
                status: 'active',
                reactivatedDate: Timestamp.now(),
                lastUpdated: Timestamp.now()
            });
            
            alert("Tutor reactivated successfully!");
            invalidateCache('inactiveTutors');
            invalidateCache('tutors');
            fetchAndRenderInactiveTutors(true);
            
        } catch (error) {
            console.error("Error reactivating tutor:", error);
            alert("Failed to reactivate tutor. Please try again.");
        }
    }
}

export async function showTutorHistory(tutorId) {
    try {
        const studentsSnapshot = await getDocs(query(collection(db, "students"), where("tutorEmail", "==", tutorId)));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const reportsSnapshot = await getDocs(query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorId)));
        const reports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tutorDoc = await getDoc(doc(db, "tutors", tutorId));
        const tutorData = tutorDoc.data();
        
        const studentsHTML = students.map(student => {
            const statusBadge = student.status === 'archived' ? '<span class="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Archived</span>' :
                            student.status === 'graduated' ? '<span class="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Graduated</span>' :
                            student.status === 'transferred' ? '<span class="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Transferred</span>' : '';
            
            return `
                <div class="border rounded p-3 mb-2">
                    <p><strong>${student.studentName}</strong> (Grade: ${student.grade}) ${statusBadge}</p>
                    <p class="text-sm text-gray-600">Fee: ₦${(student.studentFee || 0).toLocaleString()}</p>
                    ${student.tutorHistory ? `<p class="text-xs text-gray-500">Assigned: ${student.tutorHistory[0]?.assignedDate?.toDate?.().toLocaleDateString() || 'Unknown'}</p>` : ''}
                </div>
            `;
        }).join('');
        
        const reportsHTML = reports.slice(0, 10).map(report => `
            <div class="border rounded p-2 mb-2">
                <p class="text-sm"><strong>${report.studentName}</strong> - ${report.submittedAt?.toDate?.().toLocaleDateString() || 'Unknown date'}</p>
                <p class="text-xs text-gray-600 truncate">${(report.topics || '').substring(0, 100)}...</p>
            </div>
        `).join('');
        
        const modalHtml = `
            <div id="tutor-history-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div class="relative p-8 bg-white w-full max-w-4xl rounded-lg shadow-2xl">
                    <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="closeManagementModal('tutor-history-modal')">&times;</button>
                    <h3 class="text-2xl font-bold mb-4">Tutor History: ${tutorData.name}</h3>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <h4 class="font-bold text-lg mb-3">Assigned Students (${students.length})</h4>
                            ${studentsHTML || '<p class="text-gray-500">No students assigned.</p>'}
                        </div>
                        <div>
                            <h4 class="font-bold text-lg mb-3">Recent Reports (${reports.length})</h4>
                            ${reportsHTML || '<p class="text-gray-500">No reports submitted.</p>'}
                        </div>
                    </div>
                    
                    <div class="mt-6 pt-6 border-t">
                        <div class="grid grid-cols-3 gap-4">
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Total Students</p>
                                <p class="text-2xl font-bold">${students.length}</p>
                            </div>
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Total Reports</p>
                                <p class="text-2xl font-bold">${reports.length}</p>
                            </div>
                            <div class="bg-gray-100 p-3 rounded">
                                <p class="text-sm font-medium">Status</p>
                                <p class="text-lg font-bold ${tutorData.status === 'inactive' ? 'text-red-600' : 'text-yellow-600'}">${capitalize(tutorData.status || 'active')}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end mt-6">
                        <button onclick="closeManagementModal('tutor-history-modal')" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error("Error showing tutor history:", error);
        alert("Failed to load tutor history. Please try again.");
    }
}

// ======================================================
