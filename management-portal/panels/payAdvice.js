// ============================================================
// panels/payAdvice.js
// Pay advice generation and download
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

<<<<<<< HEAD
=======
// Module-level state (mirrors management.js)
let currentPayData = [];
let payAdviceGifts = {};

>>>>>>> main
// SUBSECTION 4.1: Pay Advice Panel
// ======================================================

export async function renderPayAdvicePanel(container) {
    const canExport = window.userData?.permissions?.actions?.canExportPayAdvice === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="pay-name-search" class="block text-sm font-medium">Search by Tutor Name</label>
                    <input type="text" id="pay-name-search" placeholder="Type a name..." class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-2 flex-wrap gap-2">
                    <div class="bg-green-100 p-2 rounded-lg text-center shadow flex-1"><h4 class="font-bold text-green-800 text-xs">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-2 rounded-lg text-center shadow flex-1"><h4 class="font-bold text-yellow-800 text-xs">Active Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                    ${canExport ? `<button id="export-pay-xls-btn" class="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">Download XLS</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gift (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Final Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="8" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
            <div id="pay-advice-total" class="mt-4 p-4 bg-gray-100 rounded-lg hidden">
                <h3 class="text-lg font-bold text-gray-800">Grand Total: ₦<span id="grand-total-amount">0</span></h3>
            </div>
        </div>
    `;
    
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const nameSearchInput = document.getElementById('pay-name-search');
    
    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            currentPayData = [];
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
    
    nameSearchInput.addEventListener('input', () => {
        renderPayAdviceTable(nameSearchInput.value.trim().toLowerCase());
    });

    const exportBtn = document.getElementById('export-pay-xls-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (currentPayData.length === 0) {
                alert("No pay data available to export. Please select a date range first.");
                return;
            }
            exportPayAdviceAsXLS();
        };
    }
}

export async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading pay data...</td></tr>`;

    endDate.setHours(23, 59, 59, 999);
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
    
    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        
        if (reportsSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No reports found in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            currentPayData = [];
            document.getElementById('pay-advice-total').classList.add('hidden');
            return;
        }

        const tutorStudentPairs = {};
        const activeTutorEmails = new Set();
        const tutorBankDetails = {};

        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const tutorEmail = data.tutorEmail;
            const studentName = data.studentName;
            
            activeTutorEmails.add(tutorEmail);
            
            if (!tutorStudentPairs[tutorEmail]) {
                tutorStudentPairs[tutorEmail] = new Set();
            }
            tutorStudentPairs[tutorEmail].add(studentName);
            
            if (data.beneficiaryBank && data.beneficiaryAccount) {
                tutorBankDetails[tutorEmail] = {
                    beneficiaryBank: data.beneficiaryBank,
                    beneficiaryAccount: data.beneficiaryAccount,
                    beneficiaryName: data.beneficiaryName || 'N/A',
                };
            }
        });

        const activeTutorEmailsArray = Array.from(activeTutorEmails);

        const fetchTutorsInChunks = async (emails) => {
            if (emails.length === 0) return [];
            const chunks = [];
            for (let i = 0; i < emails.length; i += 30) {
                chunks.push(emails.slice(i, i + 30));
            }

            const queryPromises = chunks.map(chunk =>
                getDocs(query(collection(db, "tutors"), where("email", "in", chunk)))
            );

            const querySnapshots = await Promise.all(queryPromises);
            return querySnapshots.flatMap(snapshot => snapshot.docs);
        };

        const [tutorDocs, studentsSnapshot] = await Promise.all([
            fetchTutorsInChunks(activeTutorEmailsArray),
            getDocs(collection(db, "students"))
        ]);

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];
        
        tutorDocs.forEach(doc => {
            const tutor = doc.data();
            const tutorEmail = tutor.email;
            
            if (tutor.status === 'inactive' || tutor.status === 'on_leave') {
                return;
            }
            
            const reportedStudentNames = tutorStudentPairs[tutorEmail] || new Set();
            
            const reportedStudents = allStudents.filter(s => 
                s.tutorEmail === tutorEmail && 
                reportedStudentNames.has(s.studentName) &&
                s.summerBreak !== true &&
                s.status !== 'archived' &&
                s.status !== 'graduated' &&
                s.status !== 'transferred'
            );
            
            const totalStudentFees = reportedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += reportedStudents.length;
            const bankDetails = tutorBankDetails[tutorEmail] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: reportedStudents.length,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee,
                tinNumber: tutor.tinNumber || '',
                ...bankDetails
            });
        });
        
        currentPayData = payData;
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        renderPayAdviceTable();

    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

export function renderPayAdviceTable(nameFilter = '') {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    
    let grandTotal = 0;
    const dataToRender = nameFilter 
        ? currentPayData.filter(d => (d.tutorName || '').toLowerCase().includes(nameFilter))
        : currentPayData;
    
    tableBody.innerHTML = dataToRender.map(d => {
        const giftAmount = payAdviceGifts[d.tutorEmail] || 0;
        const finalPay = d.totalPay + giftAmount;
        grandTotal += finalPay;
        
        return `
            <tr>
                <td class="px-6 py-4">${d.tutorName}</td>
                <td class="px-6 py-4">${d.studentCount}</td>
                <td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 text-blue-600 font-bold">₦${giftAmount.toFixed(2)}</td>
                <td class="px-6 py-4 font-bold">₦${finalPay.toFixed(2)}</td>
                <td class="px-6 py-4">
                    <button class="add-gift-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-tutor-email="${d.tutorEmail}">Add Gift</button>
                </td>
            </tr>
        `;
    }).join('');
    
    const totalElement = document.getElementById('pay-advice-total');
    const totalAmountElement = document.getElementById('grand-total-amount');
    totalAmountElement.textContent = grandTotal.toLocaleString();
    totalElement.classList.remove('hidden');
    
    document.querySelectorAll('.add-gift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const currentGift = payAdviceGifts[tutorEmail] || 0;
            const giftInput = prompt(`Enter gift amount for this tutor:`, currentGift);
            if (giftInput !== null) {
                const giftAmount = parseFloat(giftInput);
                if (!isNaN(giftAmount) && giftAmount >= 0) {
                    payAdviceGifts[tutorEmail] = giftAmount;
                    renderPayAdviceTable();
                } else {
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}

export function convertPayAdviceToCSV(data) {
    const header = [
        'Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)',
        'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name'
    ];
    const rows = data.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return [
            `"${item.tutorName}"`,
            item.studentCount,
            item.totalStudentFees,
            item.managementFee,
            item.totalPay,
            giftAmount,
            finalPay,
            `"${item.beneficiaryBank || 'N/A'}"`,
            `"${item.beneficiaryAccount || 'N/A'}"`,
            `"${item.beneficiaryName || 'N/A'}"`
        ];
    });
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export async function exportPayAdviceAsXLS() {
    try {
        // Check if SheetJS is loaded
        if (typeof XLSX === 'undefined') {
            alert("Excel library not loaded. Please add the SheetJS library to your page.");
            return;
        }

        const currentDate = new Date();
        const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const processedData = currentPayData.map(tutor => {
            const giftAmount = payAdviceGifts[tutor.tutorEmail] || 0;
            const finalPay = tutor.totalPay + giftAmount;
            
            const firstHalf = finalPay / 2;
            const tenPercentDeduction = firstHalf * 0.1;
            const mainPayment = firstHalf - tenPercentDeduction;
            const dataZoomPayment = firstHalf;
            const tinRemittance = tenPercentDeduction;
            
            return {
                ...tutor,
                finalPay: finalPay,
                giftAmount: giftAmount,
                mainPayment: mainPayment,
                dataZoomPayment: dataZoomPayment,
                tinRemittance: tinRemittance
            };
        });

        // Create Main Payment workbook
        const mainPaymentWB = XLSX.utils.book_new();
        const mainPaymentWS = XLSX.utils.aoa_to_sheet([
            ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
        ]);
        
        processedData.forEach(tutor => {
            // Force beneficiary account to be treated as text to preserve leading zeros
            XLSX.utils.sheet_add_aoa(mainPaymentWS, [[
                tutor.tutorName,
                tutor.beneficiaryBank,
                '',
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                '',
                'NIP',
                tutor.mainPayment,
                'NGN',
                `${monthYear} Tutor Payment`
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(mainPaymentWB, mainPaymentWS, 'Main Payment');

        // Create DataZoom Allocation workbook
        const dataZoomWB = XLSX.utils.book_new();
        const dataZoomWS = XLSX.utils.aoa_to_sheet([
            ['Beneficiary name', 'Beneficiary Bank name', 'Beneficiary branch', 'Beneficiary account', 'Transaction Unique Reference number', 'payment method code', 'payment amount', 'payment currency', 'remarks']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(dataZoomWS, [[
                tutor.tutorName,
                tutor.beneficiaryBank,
                '',
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                '',
                'NIP',
                tutor.dataZoomPayment,
                'NGN',
                'DATAZOOMALLOCT'
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(dataZoomWB, dataZoomWS, 'DataZoom Allocation');

        // Create TIN Remittance workbook
        const tinWB = XLSX.utils.book_new();
        const tinWS = XLSX.utils.aoa_to_sheet([
            ['Tutor Name', 'TIN Number', 'Amount', 'Currency', 'Month']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(tinWS, [[
                tutor.tutorName,
                String(tutor.tinNumber || ''), // Convert to string to preserve leading zeros
                tutor.tinRemittance,
                'NGN',
                monthYear
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(tinWB, tinWS, 'TIN Remittance');

        // Create Full PayAdvice workbook
        const fullWB = XLSX.utils.book_new();
        const fullWS = XLSX.utils.aoa_to_sheet([
            ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)', 'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name']
        ]);
        
        processedData.forEach(tutor => {
            XLSX.utils.sheet_add_aoa(fullWS, [[
                tutor.tutorName,
                tutor.studentCount,
                tutor.totalStudentFees,
                tutor.managementFee,
                tutor.totalPay,
                tutor.giftAmount,
                tutor.finalPay,
                tutor.beneficiaryBank,
                String(tutor.beneficiaryAccount), // Convert to string to preserve leading zeros
                tutor.tutorName
            ]], { origin: -1 });
        });
        
        XLSX.utils.book_append_sheet(fullWB, fullWS, 'Full PayAdvice');

        // Download all files
        XLSX.writeFile(mainPaymentWB, `Main_Payment_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(dataZoomWB, `DataZoom_Allocation_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(tinWB, `TIN_Remittance_${monthYear.replace(' ', '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        XLSX.writeFile(fullWB, `Full_PayAdvice_${monthYear.replace(' ', '_')}.xlsx`);

        alert('All 4 Excel files downloaded successfully!');

    } catch (error) {
        console.error("Error exporting Excel files:", error);
        alert("Failed to export Excel files. Please try again.");
    }
}



// ======================================================
