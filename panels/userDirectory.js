// ============================================================
// panels/userDirectory.js
// Staff/user directory with roles
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

// SECTION 8B: USER DIRECTORY PANEL (NO ACTIVITY LOGGING)
// ======================================================

export async function renderUserDirectoryPanel(container) {
    container.innerHTML = `
    <div class="space-y-4">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">📋 User Directory</h2>
                <p class="text-sm text-gray-500">All Tutors, Students & Parents</p>
            </div>
            <button id="ud-refresh-btn" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
                <i class="fas fa-sync-alt mr-1"></i> Refresh
            </button>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-blue-700" id="ud-tutor-count">—</div>
                <div class="text-xs text-blue-600 font-semibold uppercase mt-1">Tutors</div>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-green-700" id="ud-student-count">—</div>
                <div class="text-xs text-green-600 font-semibold uppercase mt-1">Students</div>
            </div>
            <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-purple-700" id="ud-parent-count">—</div>
                <div class="text-xs text-purple-600 font-semibold uppercase mt-1">Parents</div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-black text-amber-700" id="ud-total-count">—</div>
                <div class="text-xs text-amber-600 font-semibold uppercase mt-1">Total Users</div>
            </div>
        </div>

        <!-- Search + Tab Switcher -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="relative flex-1">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i class="fas fa-search text-gray-400"></i></div>
                    <input type="text" id="ud-search" placeholder="Search by name, email, phone..."
                        class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" autocomplete="off">
                </div>
                <div class="flex bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white" data-tab="tutors">Tutors</button>
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200" data-tab="students">Students</button>
                    <button class="ud-tab-btn px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200" data-tab="parents">Parents</button>
                </div>
            </div>
        </div>

        <!-- Bulk Action Bar (hidden by default) -->
        <div id="ud-bulk-bar" class="hidden bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-indigo-800"><span id="ud-selected-count">0</span> selected</span>
                <button id="ud-clear-selection-btn" class="text-xs text-indigo-600 hover:text-indigo-800 underline">Clear</button>
            </div>
            <div class="flex gap-2">
                <button id="ud-bulk-delete-btn" class="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700">
                    <i class="fas fa-trash mr-1"></i> Delete Selected
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div id="ud-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading user data…</p>
        </div>

        <!-- Content Area -->
        <div id="ud-content" class="hidden"></div>
    </div>
    `;

    // State
    let udTutors = [], udStudents = [], udParents = [];
    let currentTab = 'tutors';
    let selectedIds = new Set();

    // --- Helpers ---
    function updateBulkBar() {
        const bar = document.getElementById('ud-bulk-bar');
        const countEl = document.getElementById('ud-selected-count');
        if (bar && countEl) {
            countEl.textContent = selectedIds.size;
            bar.classList.toggle('hidden', selectedIds.size === 0);
        }
    }

    function clearSelection() {
        selectedIds.clear();
        document.querySelectorAll('.ud-row-checkbox').forEach(cb => cb.checked = false);
        const selectAll = document.getElementById('ud-select-all');
        if (selectAll) selectAll.checked = false;
        updateBulkBar();
    }

    // Tab switching
    container.querySelectorAll('.ud-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.ud-tab-btn').forEach(b => { b.classList.remove('bg-blue-600', 'text-white'); b.classList.add('text-gray-600'); });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-600');
            currentTab = btn.dataset.tab;
            clearSelection();
            renderCurrentTab();
        });
    });

    // Search
    document.getElementById('ud-search').addEventListener('input', () => { clearSelection(); renderCurrentTab(); });

    // Refresh
    document.getElementById('ud-refresh-btn').addEventListener('click', () => { clearSelection(); loadAllUserData(); });

    // Clear selection button
    document.getElementById('ud-clear-selection-btn').addEventListener('click', clearSelection);

    // Bulk delete
    document.getElementById('ud-bulk-delete-btn').addEventListener('click', async () => {
        if (selectedIds.size === 0) return;
        const colName = currentTab === 'tutors' ? 'tutors' : currentTab === 'students' ? 'students' : 'parent_users';
        const label = currentTab.slice(0, -1); // tutor / student / parent
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} ${currentTab}? This cannot be undone.`)) return;
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, colName, id)));
            await batch.commit();
            alert(`${selectedIds.size} ${currentTab} deleted successfully.`);
            clearSelection();
            if (colName === 'tutors') invalidateCache('tutors');
            if (colName === 'students') invalidateCache('students');
            await loadAllUserData();
        } catch(e) { alert('Error deleting: ' + e.message); }
    });

    function renderCurrentTab() {
        const term = (document.getElementById('ud-search').value || '').toLowerCase().trim();
        const contentEl = document.getElementById('ud-content');
        if (!contentEl) return;
        if (currentTab === 'tutors') renderTutorsTable(contentEl, term);
        else if (currentTab === 'students') renderStudentsTable(contentEl, term);
        else renderParentsTable(contentEl, term);
    }

    // --- Checkbox wiring helper ---
    function wireCheckboxes(contentEl) {
        const selectAll = contentEl.querySelector('#ud-select-all');
        const rowCheckboxes = contentEl.querySelectorAll('.ud-row-checkbox');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                rowCheckboxes.forEach(cb => {
                    cb.checked = selectAll.checked;
                    if (selectAll.checked) selectedIds.add(cb.dataset.id);
                    else selectedIds.delete(cb.dataset.id);
                });
                updateBulkBar();
            });
        }
        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) selectedIds.add(cb.dataset.id);
                else selectedIds.delete(cb.dataset.id);
                if (selectAll) selectAll.checked = rowCheckboxes.length > 0 && [...rowCheckboxes].every(c => c.checked);
                updateBulkBar();
            });
        });
    }

    // ---- TUTORS TABLE ----
    function renderTutorsTable(el, term) {
        const filtered = udTutors.filter(t => {
            const s = `${t.name} ${t.email} ${t.phone || ''}`.toLowerCase();
            return !term || s.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} tutor${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-center py-3 px-4">Students</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-400">No tutors found.</td></tr>' :
                        filtered.map((t, i) => `
                        <tr class="border-b border-gray-50 hover:bg-gray-50">
                            <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${t.id}" ${selectedIds.has(t.id) ? 'checked' : ''}></td>
                            <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                            <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(t.name)}</td>
                            <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(t.email || '—')}</td>
                            <td class="py-3 px-4 text-gray-600">${escapeHtml(t.phone || '—')}</td>
                            <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${t.studentCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">${t.studentCount}</span></td>
                            <td class="py-3 px-4 text-center">
                                <button onclick="window._udEdit('tutors','${t.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                <button onclick="window._udDel('tutors','${t.id}','${escapeHtml(t.name)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- STUDENTS TABLE ----
    function renderStudentsTable(el, term) {
        const filtered = udStudents.filter(s => {
            const str = `${s.studentName} ${s.parentName || ''} ${s.parentEmail || ''} ${s.grade || ''} ${s.tutorName || ''}`.toLowerCase();
            return !term || str.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} student${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Student</th>
                            <th class="text-left py-3 px-4">Grade</th>
                            <th class="text-left py-3 px-4">Parent</th>
                            <th class="text-left py-3 px-4">Tutor</th>
                            <th class="text-left py-3 px-4">Subjects</th>
                            <th class="text-center py-3 px-4">Status</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="9" class="text-center py-8 text-gray-400">No students found.</td></tr>' :
                        filtered.map((s, i) => {
                            const sc = s.summerBreak ? 'bg-yellow-100 text-yellow-800' : ['archived','graduated','transferred'].includes(s.status) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
                            const sl = s.summerBreak ? 'On Break' : ['archived','graduated','transferred'].includes(s.status) ? capitalize(s.status) : 'Active';
                            return `
                            <tr class="border-b border-gray-50 hover:bg-gray-50">
                                <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}></td>
                                <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                                <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(s.studentName || '—')}</td>
                                <td class="py-3 px-4 text-gray-600">${escapeHtml(s.grade || '—')}</td>
                                <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(s.parentName || s.parentEmail || '—')}</td>
                                <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(s.tutorName || s.tutorEmail || '—')}</td>
                                <td class="py-3 px-4 text-xs text-gray-500">${escapeHtml((s.subjects || []).join(', ') || '—')}</td>
                                <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${sc}">${sl}</span></td>
                                <td class="py-3 px-4 text-center">
                                    <button onclick="window._udEdit('students','${s.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                    <button onclick="window._udDel('students','${s.id}','${escapeHtml(s.studentName)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- PARENTS TABLE ----
    function renderParentsTable(el, term) {
        const filtered = udParents.filter(p => {
            const s = `${p.name} ${p.email} ${p.phone || ''}`.toLowerCase();
            return !term || s.includes(term);
        });
        el.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-3 bg-gray-50 border-b text-xs text-gray-500">${filtered.length} parent${filtered.length !== 1 ? 's' : ''}</div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b text-xs text-gray-500 uppercase bg-gray-50">
                            <th class="py-3 px-3 w-10"><input type="checkbox" id="ud-select-all" class="rounded"></th>
                            <th class="text-left py-3 px-4">#</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Phone</th>
                            <th class="text-center py-3 px-4">Children</th>
                            <th class="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-400">No parents found.</td></tr>' :
                        filtered.map((p, i) => `
                        <tr class="border-b border-gray-50 hover:bg-gray-50">
                            <td class="py-3 px-3"><input type="checkbox" class="ud-row-checkbox rounded" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}></td>
                            <td class="py-3 px-4 text-gray-400 text-xs">${i + 1}</td>
                            <td class="py-3 px-4 font-semibold text-gray-800">${escapeHtml(p.name || '—')}</td>
                            <td class="py-3 px-4 text-gray-600 text-xs">${escapeHtml(p.email || '—')}</td>
                            <td class="py-3 px-4 text-gray-600">${escapeHtml(p.phone || '—')}</td>
                            <td class="py-3 px-4 text-center"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.childCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'}">${p.childCount}</span></td>
                            <td class="py-3 px-4 text-center">
                                <button onclick="window._udEdit('parent_users','${p.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-2"><i class="fas fa-edit"></i> Edit</button>
                                <button onclick="window._udDel('parent_users','${p.id}','${escapeHtml(p.name)}')" class="text-red-600 hover:text-red-800 text-xs font-semibold"><i class="fas fa-trash"></i> Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        wireCheckboxes(el);
    }

    // ---- UNIFIED EDIT MODAL ----
    window._udEdit = async function(colName, itemId) {
        const item = colName === 'tutors' ? udTutors.find(t => t.id === itemId)
                   : colName === 'students' ? udStudents.find(s => s.id === itemId)
                   : udParents.find(p => p.id === itemId);
        if (!item) return;

        const isTutor = colName === 'tutors';
        const isStudent = colName === 'students';
        const isParent = colName === 'parent_users';
        const title = isTutor ? 'Edit Tutor' : isStudent ? 'Edit Student' : 'Edit Parent';
        const color = isTutor ? 'blue' : isStudent ? 'green' : 'purple';

        let fieldsHtml = '';
        if (isTutor) {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" id="ud-e-name" value="${escapeHtml(item.name || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" id="ud-e-email" value="${escapeHtml(item.email || '')}" class="w-full p-2 border rounded-lg bg-gray-100" readonly></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" id="ud-e-phone" value="${escapeHtml(item.phone || '')}" class="w-full p-2 border rounded-lg"></div>`;
        } else if (isStudent) {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Student Name</label><input type="text" id="ud-e-sname" value="${escapeHtml(item.studentName || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Grade</label><select id="ud-e-grade" class="w-full p-2 border rounded-lg">${buildGradeOptions(item.grade || '')}</select></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Name</label><input type="text" id="ud-e-pname" value="${escapeHtml(item.parentName || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Parent Email</label><input type="email" id="ud-e-pemail" value="${escapeHtml(item.parentEmail || '')}" class="w-full p-2 border rounded-lg"></div>`;
        } else {
            fieldsHtml = `
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" id="ud-e-name" value="${escapeHtml(item.name || '')}" class="w-full p-2 border rounded-lg"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" id="ud-e-email" value="${escapeHtml(item.email || '')}" class="w-full p-2 border rounded-lg bg-gray-100" readonly></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" id="ud-e-phone" value="${escapeHtml(item.phone || '')}" class="w-full p-2 border rounded-lg"></div>`;
        }

        const old = document.getElementById('ud-edit-modal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', `
        <div id="ud-edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-6 bg-white w-full max-w-md rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('ud-edit-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-${color}-700"><i class="fas fa-edit mr-2"></i>${title}</h3>
                <div class="space-y-3">${fieldsHtml}</div>
                <div class="flex justify-end gap-3 mt-5">
                    <button onclick="document.getElementById('ud-edit-modal').remove()" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                    <button id="ud-save-btn" class="px-4 py-2 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700 text-sm">Save Changes</button>
                </div>
            </div>
        </div>`);

        document.getElementById('ud-save-btn').addEventListener('click', async () => {
            try {
                let updateData = {};
                if (isTutor) {
                    const name = document.getElementById('ud-e-name').value.trim();
                    if (!name) { alert('Name is required.'); return; }
                    updateData = { name: sanitizeInput(name, 200), phone: sanitizeInput(document.getElementById('ud-e-phone').value.trim(), 50) };
                } else if (isStudent) {
                    const sname = document.getElementById('ud-e-sname').value.trim();
                    if (!sname) { alert('Student name is required.'); return; }
                    updateData = {
                        studentName: sanitizeInput(sname, 200),
                        grade: document.getElementById('ud-e-grade').value,
                        parentName: sanitizeInput(document.getElementById('ud-e-pname').value.trim(), 200),
                        parentEmail: sanitizeInput(document.getElementById('ud-e-pemail').value.trim(), 200)
                    };
                } else {
                    const name = document.getElementById('ud-e-name').value.trim();
                    if (!name) { alert('Name is required.'); return; }
                    updateData = { name: sanitizeInput(name, 200), phone: sanitizeInput(document.getElementById('ud-e-phone').value.trim(), 50) };
                }
                await updateDoc(doc(db, colName, itemId), updateData);
                alert('Updated successfully!');
                document.getElementById('ud-edit-modal').remove();
                if (colName === 'tutors') invalidateCache('tutors');
                if (colName === 'students') invalidateCache('students');
                await loadAllUserData();
            } catch(e) { alert('Error: ' + e.message); }
        });
    };

    // ---- UNIFIED DELETE ----
    window._udDel = async function(colName, itemId, name) {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, colName, itemId));
            alert('Deleted successfully.');
            if (colName === 'tutors') invalidateCache('tutors');
            if (colName === 'students') invalidateCache('students');
            selectedIds.delete(itemId);
            await loadAllUserData();
        } catch(e) { alert('Error: ' + e.message); }
    };

    // ---- DATA LOADING ----
    async function loadAllUserData() {
        const loadingEl = document.getElementById('ud-loading');
        const contentEl = document.getElementById('ud-content');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');

        try {
            const [tutorsSnap, studentsSnap, parentsSnap] = await Promise.all([
                getDocs(query(collection(db, 'tutors'), orderBy('name'))),
                getDocs(collection(db, 'students')),
                getDocs(collection(db, 'parent_users'))
            ]);

            const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const studentCountByTutor = {};
            allStudents.forEach(s => { const k = s.tutorEmail || ''; studentCountByTutor[k] = (studentCountByTutor[k] || 0) + 1; });

            const tutorNameMap = {};
            tutorsSnap.docs.forEach(d => { const data = d.data(); tutorNameMap[data.email] = data.name; });

            const childCountByParent = {};
            allStudents.forEach(s => { const k = (s.parentEmail || '').toLowerCase(); if (k) childCountByParent[k] = (childCountByParent[k] || 0) + 1; });

            udTutors = tutorsSnap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, studentCount: studentCountByTutor[data.email] || 0 }; });
            udStudents = allStudents.map(s => ({ ...s, tutorName: tutorNameMap[s.tutorEmail] || '' }));
            udParents = parentsSnap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, childCount: childCountByParent[(data.email || '').toLowerCase()] || 0 }; });

            document.getElementById('ud-tutor-count').textContent = udTutors.length;
            document.getElementById('ud-student-count').textContent = udStudents.length;
            document.getElementById('ud-parent-count').textContent = udParents.length;
            document.getElementById('ud-total-count').textContent = udTutors.length + udStudents.length + udParents.length;

            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');
            renderCurrentTab();
        } catch(err) {
            console.error('User Directory load error:', err);
            const loadingEl = document.getElementById('ud-loading');
            if (loadingEl) loadingEl.innerHTML = `<p class="text-red-500">Error loading data: ${err.message}</p>`;
        }
    }

    await loadAllUserData();
}
