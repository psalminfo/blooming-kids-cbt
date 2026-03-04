// ============================================================
// core/utils.js
// All pure helper functions — no Firestore, no DOM side effects.
// Import what you need: import { escapeHtml, formatNaira } from "../core/utils.js";
// ============================================================

// XSS protection — always use before inserting user data into innerHTML
export function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

export function formatNaira(amount) {
    return '\u20a6' + (amount || 0).toLocaleString();
}

export function buildGradeOptions(selectedGrade = '') {
    const grades = [
        'Preschool','Kindergarten',
        'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
        'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12',
        'Pre-College','College','Adults'
    ];
    return '<option value="">Select Grade</option>' +
        grades.map(g => `<option value="${g}"${selectedGrade===g?' selected':''}>${g}</option>`).join('');
}

export function buildTimeOptions(selectedVal = '') {
    let opts = '<option value="">-- Select --</option>';
    for (let h = 0; h < 24; h++) {
        for (let m of [0, 30]) {
            const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm  = h < 12 ? 'AM' : 'PM';
            const minStr = m === 0 ? '00' : '30';
            const label  = `${hour12}:${minStr} ${ampm}`;
            const value  = `${String(h).padStart(2,'0')}:${minStr}`;
            opts += `<option value="${value}"${selectedVal===value?' selected':''}>${label}</option>`;
        }
    }
    return opts;
}

export function formatTimeTo12h(val) {
    if (!val) return '';
    const [hStr, mStr] = val.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

const _rateLimitMap = new Map();
export function rateLimitCheck(key, limitMs = 3000) {
    const now = Date.now();
    if (_rateLimitMap.has(key) && now - _rateLimitMap.get(key) < limitMs) return false;
    _rateLimitMap.set(key, now);
    return true;
}

export function sanitizeInput(str, maxLen = 500) {
    if (typeof str !== 'string') return str;
    return str.trim().slice(0, maxLen);
}

// ── Tutor-directory helpers (used by tutorDirectory + other panels) ──

export function safeToString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch (e) { return ''; }
    }
    return String(value);
}

export function safeSearch(text, searchTerm) {
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    if (!text) return false;
    return safeToString(text).toLowerCase().includes(safeToString(searchTerm).toLowerCase());
}

export function formatBadgeDate(dateString) {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

// Calculate years of service from employmentDate (for tutor display)
export function calculateYearsOfService(employmentDate) {
    if (!employmentDate) return null;
    try {
        const start = new Date(employmentDate);
        if (isNaN(start.getTime())) return null;
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        const m = now.getMonth() - start.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
            years--;
        }
        return years;
    } catch (e) {
        return null;
    }
}

export function calculateTransitioningStatus(student) {
    if (!student.transitionEndDate) return { isTransitioning: false, daysLeft: 0, shouldGenerateReport: false };
    
    const endDate = new Date(student.transitionEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    const startDate = new Date(student.transitionStartDate || student.updatedAt);
    const totalDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    
    return {
        isTransitioning: daysLeft > 0,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        shouldGenerateReport: totalDays >= 14,
        totalDays: totalDays
    };
}

export function searchStudentFromFirebase(student, searchTerm, tutors = []) {
    if (!student) return false;
    if (!searchTerm || safeToString(searchTerm).trim() === '') return true;
    
    const searchLower = safeToString(searchTerm).toLowerCase();
    
    const transitioningStatus = calculateTransitioningStatus(student);
    if (searchLower === 'break' && student.summerBreak === true) return true;
    if (searchLower === 'transitioning' && transitioningStatus.isTransitioning) return true;
    if (searchLower === 'group' && student.groupId) return true;
    
    const studentFieldsToSearch = [
        'studentName', 'grade', 'days', 'parentName', 'parentPhone', 
        'parentEmail', 'address', 'status', 'tutorEmail', 'tutorName',
        'createdBy', 'updatedBy', 'notes', 'school', 'location',
        'groupId', 'groupName'
    ];
    
    for (const field of studentFieldsToSearch) {
        if (student[field] && safeSearch(student[field], searchTerm)) return true;
    }
    
    if (student.studentFee !== undefined && student.studentFee !== null) {
        if (safeToString(student.studentFee).includes(searchLower)) return true;
    }
    
    if (student.subjects) {
        if (Array.isArray(student.subjects)) {
            for (const subject of student.subjects) {
                if (safeSearch(subject, searchTerm)) return true;
            }
        } else {
            if (safeSearch(student.subjects, searchTerm)) return true;
        }
    }
    
    if (student.tutorEmail && tutors && tutors.length > 0) {
        const tutor = tutors.find(t => t && t.email === student.tutorEmail);
        if (tutor) {
            const tutorFieldsToSearch = ['name', 'email', 'phone', 'qualification', 'subjects'];
            for (const field of tutorFieldsToSearch) {
                if (tutor[field] && safeSearch(tutor[field], searchTerm)) return true;
            }
        }
    }
    
    return false;
}

// --- ENHANCED SELECT WITH SEARCH FUNCTIONALITY (includes employment years) ---

export function createSearchableSelect(options, placeholder = "Select...", id = '', isTutor = false) {
    const uniqueOptions = [];
    const seen = new Set();
    
    options.forEach(opt => {
        const key = isTutor ? opt.email : opt.id;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueOptions.push(opt);
        }
    });
    
    return `
        <div class="relative w-full">
            <input type="text" 
                   id="${id}-search" 
                   placeholder="Type to search ${isTutor ? 'tutor' : 'student'}..." 
                   class="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   autocomplete="off">
            <select id="${id}" 
                    class="hidden"
                    ${isTutor ? 'data-is-tutor="true"' : ''}>
                <option value="">${placeholder}</option>
                ${uniqueOptions.map(opt => {
                    let label = isTutor ? opt.name : opt.studentName;
                    if (isTutor && opt.employmentDate) {
                        const years = calculateYearsOfService(opt.employmentDate);
                        if (years !== null) label += ` (${years} yr${years !== 1 ? 's' : ''})`;
                    }
                    return `<option value="${isTutor ? opt.email : opt.id}" 
                                    data-label="${isTutor ? opt.name : opt.studentName}">
                        ${label} 
                        ${isTutor && opt.email ? `(${opt.email})` : ''}
                        ${!isTutor && opt.grade ? ` - Grade ${opt.grade}` : ''}
                        ${!isTutor && opt.tutorName ? ` (${opt.tutorName})` : ''}
                    </option>`;
                }).join('')}
            </select>
            <div id="${id}-dropdown" 
                 class="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg hidden max-h-60 overflow-y-auto">
                ${uniqueOptions.map(opt => {
                    let title = isTutor ? opt.name : opt.studentName;
                    if (isTutor && opt.employmentDate) {
                        const years = calculateYearsOfService(opt.employmentDate);
                        if (years !== null) title += ` (${years} yr${years !== 1 ? 's' : ''})`;
                    }
                    return `
                    <div class="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                         data-value="${isTutor ? opt.email : opt.id}"
                         data-label="${isTutor ? opt.name : opt.studentName}">
                        <div class="font-medium">${title}</div>
                        ${isTutor && opt.email ? `<div class="text-xs text-gray-500">${opt.email}</div>` : ''}
                        ${!isTutor && opt.grade ? `<div class="text-xs text-gray-500">Grade: ${opt.grade}</div>` : ''}
                        ${!isTutor && opt.tutorName ? `<div class="text-xs text-gray-500">Tutor: ${opt.tutorName}</div>` : ''}
                        ${!isTutor && opt.groupId ? `<div class="text-xs text-blue-600">Group Class</div>` : ''}
                    </div>
                `}).join('')}
            </div>
        </div>`;
}

export function initializeSearchableSelect(selectId) {
    const searchInput = document.getElementById(`${selectId}-search`);
    const dropdown = document.getElementById(`${selectId}-dropdown`);
    const hiddenSelect = document.getElementById(selectId);
    
    if (!searchInput || !dropdown || !hiddenSelect) return;
    
    searchInput.addEventListener('focus', () => {
        dropdown.classList.remove('hidden');
    });
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = dropdown.querySelectorAll('div[data-value]');
        let hasVisible = false;
        
        items.forEach(item => {
            const label = item.getAttribute('data-label').toLowerCase();
            const details = item.textContent.toLowerCase();
            const matches = label.includes(searchTerm) || details.includes(searchTerm);
            
            item.style.display = matches ? 'block' : 'none';
            if (matches) hasVisible = true;
        });
        
        dropdown.style.display = hasVisible ? 'block' : 'none';
    });
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('div[data-value]');
        if (item) {
            const value = item.getAttribute('data-value');
            const label = item.getAttribute('data-label');
            
            searchInput.value = label;
            hiddenSelect.value = value;
            hiddenSelect.dispatchEvent(new Event('change'));
            dropdown.classList.add('hidden');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// --- DATE PICKER UTILITY ---

export function createDatePicker(id, value = '') {
    const today = new Date().toISOString().split('T')[0];
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    
    return `
        <input type="date" 
               id="${id}" 
               value="${value}"
               min="${minDate.toISOString().split('T')[0]}"
               class="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`;
}

// --- Student Event Logger (Comprehensive History) ---
export async function logStudentEvent(studentId, eventType, changes = {}, description = '', metadata = {}) {
    if (!studentId) return;
    try {
        const user = window.userData?.name || 'Admin';
        const userEmail = window.userData?.email || 'admin@system';
        await addDoc(collection(db, "studentEvents"), {
            studentId,
            type: eventType,
            timestamp: new Date().toISOString(),
            userId: user,
            userEmail,
            changes,
            description,
            metadata
        });
    } catch (e) {
        console.error("Error logging student event:", e);
    }
}

// ======================================================
// MAIN VIEW RENDERER (Updated with visible orange button)
// ======================================================

// ── Master-portal helpers (used by masterPortal + academicFollowUp) ──

export function getLagosDatetime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
}
export function formatLagosDatetime() {
    const d = getLagosDatetime();
    const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric',
                   hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true,
                   timeZone:'Africa/Lagos' };
    return new Intl.DateTimeFormat('en-NG', opts).format(new Date());
}
export function getCurrentMonthKeyLagos() {
    const d = getLagosDatetime();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
export function getCurrentMonthLabelLagos() {
    return getLagosDatetime().toLocaleString('en-NG', { month:'long', year:'numeric', timeZone:'Africa/Lagos' });
}

// --- Score Color Helper ---
export function getScoreColor(score) {
    if (score >= 85) return 'text-green-600';
    if (score >= 65) return 'text-yellow-600';
    if (score >= 45) return 'text-orange-500';
    return 'text-red-500';
}
export function getScoreBg(score) {
    if (score >= 85) return 'bg-green-50 border-green-200';
    if (score >= 65) return 'bg-yellow-50 border-yellow-200';
    if (score >= 45) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
}
export function getScoreBar(score) {
    if (score >= 85) return 'bg-green-500';
    if (score >= 65) return 'bg-yellow-500';
    if (score >= 45) return 'bg-orange-400';
    return 'bg-red-400';
}

// --- Student Type Label ---
export function getStudentTypeLabel(student) {
    if (student.groupClass) return '<span class="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-semibold">Group</span>';
    if (student.isTransitioning) return '<span class="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-semibold">Transitioning</span>';
    return '<span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">Regular</span>';
}

// --- Schedule Display ---
export function formatStudentSchedule(student) {
    if (!student.schedule || !Array.isArray(student.schedule) || student.schedule.length === 0) {
        return '<span class="text-gray-400 text-xs italic">No schedule</span>';
    }
    return student.schedule.map(slot => {
        const day = slot.day ? slot.day.substring(0,3) : '?';
        const start = slot.start || '';
        const end = slot.end || '';
        function fmtTime(t) {
            if (!t) return '';
            const [h, m] = t.split(':').map(Number);
            const ap = h >= 12 ? 'PM' : 'AM';
            return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}`;
        }
        return `<span class="inline-block bg-gray-100 rounded px-1.5 py-0.5 text-xs mr-1 mb-1">${day} ${fmtTime(start)}–${fmtTime(end)}</span>`;
    }).join('');
}

// --- Main Render Function ---