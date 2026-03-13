// ============================================================
// panels/tutorReports.js
// Tutor report PDF preview and download
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

// SUBSECTION 5.1: Tutor Reports Panel
// ======================================================

export async function renderTutorReportsPanel(container) {
    const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
    const canExport = window.userData?.permissions?.actions?.canExportPayAdvice === true;
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            
            <!-- Quick name search -->
            <div class="mb-4 flex gap-3 items-center">
                <div class="relative flex-1">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="text" id="reports-name-quick-search" placeholder="🔍 Type a tutor or student name to search..." 
                           class="w-full pl-9 pr-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-medium">
                </div>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                    <div>
                        <label for="reports-start-date" class="block text-sm font-medium">Start Date</label>
                        <input type="date" id="reports-start-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="reports-end-date" class="block text-sm font-medium">End Date</label>
                        <input type="date" id="reports-end-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="reports-tutor-filter" class="block text-sm font-medium">Filter by Tutor</label>
                        <select id="reports-tutor-filter" class="mt-1 block w-full p-2 border rounded-md">
                            <option value="">All Tutors</option>
                        </select>
                    </div>
                    <div>
                        <label for="reports-student-filter" class="block text-sm font-medium">Filter by Student</label>
                        <select id="reports-student-filter" class="mt-1 block w-full p-2 border rounded-md">
                            <option value="">All Students</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-4">
                        <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                            <h4 class="font-bold text-green-800 text-sm">Tutors Submitted</h4>
                            <p id="report-tutor-count" class="text-2xl font-extrabold">0</p>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                            <h4 class="font-bold text-yellow-800 text-sm">Total Reports</h4>
                            <p id="report-total-count" class="text-2xl font-extrabold">0</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Refresh
                        </button>
                        ${canExport ? `<button id="export-reports-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Export CSV
                        </button>` : ''}
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <input type="search" id="reports-search" placeholder="Search reports by student, tutor, or content..." 
                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
            </div>

            <div id="pdf-progress-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center hidden">
                <div class="relative p-8 bg-white w-96 rounded-lg shadow-xl">
                    <h3 class="text-xl font-bold mb-4">Generating PDF</h3>
                    <p id="pdf-progress-message" class="mb-4">Initializing...</p>
                    <div class="w-full bg-gray-200 rounded-full h-4 mb-4">
                        <div id="pdf-progress-bar" class="bg-green-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="pdf-progress-text" class="text-center text-sm text-gray-600">0%</p>
                </div>
            </div>

            <div id="tutor-reports-list" class="space-y-4">
                <div class="text-center py-10">
                    <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading reports...</p>
                </div>
            </div>
        </div>
    `;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('reports-start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reports-end-date').value = lastDay.toISOString().split('T')[0];

    let allReports = [];
    let filteredReports = [];

    const handleDateChange = () => {
        fetchAndRenderTutorReports();
    };

    document.getElementById('reports-start-date').addEventListener('change', handleDateChange);
    document.getElementById('reports-end-date').addEventListener('change', handleDateChange);
    document.getElementById('refresh-reports-btn').addEventListener('click', handleDateChange);
    
    document.getElementById('reports-search').addEventListener('input', (e) => {
        filterReports(e.target.value);
    });
    
    document.getElementById('reports-name-quick-search').addEventListener('input', (e) => {
        filterReports(e.target.value);
    });

    document.getElementById('reports-tutor-filter').addEventListener('change', () => {
        applyFilters();
    });
    
    document.getElementById('reports-student-filter').addEventListener('change', () => {
        applyFilters();
    });

    const exportBtn = document.getElementById('export-reports-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReportsToCSV);
    }

    handleDateChange();

    function filterReports(searchTerm) {
        const lowerCaseTerm = searchTerm.toLowerCase();
        filteredReports = allReports.filter(report => 
            report.studentName?.toLowerCase().includes(lowerCaseTerm) ||
            report.tutorName?.toLowerCase().includes(lowerCaseTerm) ||
            report.tutorEmail?.toLowerCase().includes(lowerCaseTerm) ||
            report.introduction?.toLowerCase().includes(lowerCaseTerm) ||
            report.topics?.toLowerCase().includes(lowerCaseTerm) ||
            report.progress?.toLowerCase().includes(lowerCaseTerm)
        );
        renderTutorReportsFromCache();
    }

    function applyFilters() {
        const tutorFilter = document.getElementById('reports-tutor-filter').value;
        const studentFilter = document.getElementById('reports-student-filter').value;
        
        filteredReports = allReports.filter(report => {
            const tutorMatch = !tutorFilter || report.tutorEmail === tutorFilter;
            const studentMatch = !studentFilter || report.studentName === studentFilter;
            return tutorMatch && studentMatch;
        });
        
        renderTutorReportsFromCache();
    }

    async function exportReportsToCSV() {
        try {
            const csvData = convertReportsToCSV(filteredReports);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const startDate = document.getElementById('reports-start-date').value;
            const endDate = document.getElementById('reports-end-date').value;
            link.href = URL.createObjectURL(blob);
            link.download = `Tutor_Reports_${startDate}_to_${endDate}.csv`;
            link.click();
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Failed to export CSV. Please try again.');
        }
    }

    function convertReportsToCSV(reports) {
        const headers = [
            'Tutor Name', 'Tutor Email', 'Student Name', 'Parent Name', 'Grade',
            'Submission Date', 'Topics Covered', 'Progress', 'Strengths & Weaknesses',
            'Recommendations'
        ];

        const rows = reports.map(report => {
            const submissionDate = report.submittedAt ? 
                new Date(report.submittedAt.seconds * 1000).toLocaleDateString() : 'N/A';
            
            return [
                `"${report.tutorName || 'N/A'}"`,
                `"${report.tutorEmail || 'N/A'}"`,
                `"${report.studentName || 'N/A'}"`,
                `"${report.parentName || 'N/A'}"`,
                `"${report.grade || 'N/A'}"`,
                `"${submissionDate}"`,
                `"${(report.topics || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.progress || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.strengthsWeaknesses || 'N/A').replace(/"/g, '""')}"`,
                `"${(report.recommendations || 'N/A').replace(/"/g, '""')}"`
            ];
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    async function fetchAndRenderTutorReports() {
        const reportsListContainer = document.getElementById('tutor-reports-list');
        if (!reportsListContainer) return;

        reportsListContainer.innerHTML = `
            <div class="text-center py-10">
                <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div>
                <p class="text-green-600 font-semibold mt-4">Loading reports for selected period...</p>
            </div>
        `;

        try {
            const startDateInput = document.getElementById('reports-start-date');
            const endDateInput = document.getElementById('reports-end-date');
            
            const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
            const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
            
            if (!startDate || !endDate) {
                throw new Error('Please select both start and end dates.');
            }

            endDate.setHours(23, 59, 59, 999);

            const startTimestamp = Timestamp.fromDate(startDate);
            const endTimestamp = Timestamp.fromDate(endDate);

            const reportsQuery = query(
                collection(db, "tutor_submissions"), 
                where("submittedAt", ">=", startTimestamp),
                where("submittedAt", "<=", endTimestamp),
                orderBy("submittedAt", "desc")
            );

            const snapshot = await getDocs(reportsQuery);
            
            if (snapshot.empty) {
                allReports = [];
                filteredReports = [];
                renderTutorReportsFromCache();
                return;
            }

            allReports = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));

            filteredReports = [...allReports];

            updateFilterDropdowns();

            saveToLocalStorage('reports', allReports);
            renderTutorReportsFromCache();

        } catch (error) {
            console.error("Error fetching reports:", error);
            reportsListContainer.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <p class="font-semibold">Failed to load reports</p>
                    <p class="text-sm mt-2">${error.message}</p>
                    <button onclick="fetchAndRenderTutorReports()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    function updateFilterDropdowns() {
        const tutorFilter = document.getElementById('reports-tutor-filter');
        const studentFilter = document.getElementById('reports-student-filter');
        
        const tutors = [...new Set(allReports.map(r => r.tutorEmail))].filter(Boolean);
        const students = [...new Set(allReports.map(r => r.studentName))].filter(Boolean);
        
        tutorFilter.innerHTML = '<option value="">All Tutors</option>' + 
            tutors.map(tutor => `<option value="${tutor}">${tutor}</option>`).join('');
        
        studentFilter.innerHTML = '<option value="">All Students</option>' + 
            students.map(student => `<option value="${student}">${student}</option>`).join('');
    }

    function renderTutorReportsFromCache() {
        const reportsListContainer = document.getElementById('tutor-reports-list');
        if (!reportsListContainer) return;

        if (filteredReports.length === 0) {
            reportsListContainer.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-gray-500">No reports found for the selected period and filters.</p>
                    <p class="text-sm text-gray-400 mt-2">Try adjusting your date range or search terms.</p>
                </div>`;
            
            document.getElementById('report-tutor-count').textContent = '0';
            document.getElementById('report-total-count').textContent = '0';
            return;
        }

        const reportsByTutor = {};
        filteredReports.forEach(report => {
            if (!reportsByTutor[report.tutorEmail]) {
                reportsByTutor[report.tutorEmail] = { 
                    name: report.tutorName || report.tutorEmail, 
                    reports: [] 
                };
            }
            reportsByTutor[report.tutorEmail].reports.push(report);
        });

        const uniqueTutors = Object.keys(reportsByTutor).length;
        document.getElementById('report-tutor-count').textContent = uniqueTutors;
        document.getElementById('report-total-count').textContent = filteredReports.length;

        const canDownload = window.userData?.permissions?.actions?.canDownloadReports === true;
        
        let html = '';
        
        Object.values(reportsByTutor).forEach(tutorData => {
            const reportsByStudent = {};
            tutorData.reports.forEach(report => {
                if (!reportsByStudent[report.studentName]) {
                    reportsByStudent[report.studentName] = [];
                }
                reportsByStudent[report.studentName].push(report);
            });

            const studentReportsHTML = Object.entries(reportsByStudent).map(([studentName, studentReports]) => {
                const reportLinks = studentReports.map(report => {
                    const reportDate = report.submittedAt ? 
                        new Date(report.submittedAt.seconds * 1000).toLocaleDateString() : 
                        'Unknown date';
                        
                    return `
                        <li class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                            <div>
                                <span class="font-medium">${reportDate}</span>
                                <span class="text-sm text-gray-500 ml-3">Grade: ${report.grade || 'N/A'}</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="previewReport('${report.id}')" 
                                        class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600">
                                    👁️ Preview
                                </button>
                                ${canDownload ? `
                                    <button onclick="downloadSingleReport('${report.id}', event)" 
                                            class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                                        📥 Download
                                    </button>
                                ` : ''}
                            </div>
                        </li>
                    `;
                }).join('');

                return `
                    <div class="ml-4 mt-2">
                        <h4 class="font-semibold text-gray-700 mb-2">📚 ${studentName}</h4>
                        <ul class="space-y-2">
                            ${reportLinks}
                        </ul>
                    </div>
                `;
            }).join('');

            const zipButtonHTML = canDownload ? `
                <div class="p-4 border-t bg-blue-50">
                    <button onclick="zipAndDownloadTutorReports(${JSON.stringify(tutorData.reports).replace(/"/g, '&quot;')}, '${tutorData.name.replace(/'/g, "\\'")}', this)" 
                            class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                        📦 ZIP & DOWNLOAD ALL REPORTS FOR ${tutorData.name.toUpperCase()}
                    </button>
                </div>
            ` : '';

            html += `
                <div class="border rounded-lg shadow-sm bg-white">
                    <details open>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg bg-green-50 hover:bg-green-100 rounded-t-lg">
                            <span>👨‍🏫 ${tutorData.name}</span>
                            <span class="text-sm font-normal text-gray-500 bg-green-200 px-2 py-1 rounded-full">
                                ${tutorData.reports.length} report${tutorData.reports.length !== 1 ? 's' : ''}
                            </span>
                        </summary>
                        <div class="border-t">
                            <div class="space-y-4 p-4">
                                ${studentReportsHTML}
                            </div>
                            ${zipButtonHTML}
                        </div>
                    </details>
                </div>
            `;
        });

        reportsListContainer.innerHTML = html;
    }
}

// ======================================================
