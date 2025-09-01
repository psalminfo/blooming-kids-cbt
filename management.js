import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container) { /* ... Same as before ... */ }
async function renderSummerBreakPanel(container) { /* ... Same as before ... */ }
async function renderPayAdvicePanel(container) { /* ... Full version copied from admin.js ... */ }
async function loadPayAdviceData(startDate, endDate) { /* ... Full version copied from admin.js ... */ }

// ### This version reads permissions ###
async function renderTutorReportsPanel(container) {
    // ... Copy the HTML structure from your latest admin.js ...
}

// ### This version reads permissions ###
async function loadTutorReportsForAdmin() {
    // ... Copy the grouping logic from your latest admin.js ...
    // ... Then, modify the button creation logic:
    const canDownload = window.userData.permissions.actions.canDownloadReports === true;
    
    // For the individual download button
    const singleButtonHTML = canDownload
        ? `<button class="download-single-report-btn bg-blue-600 ..." data-report-id="${report.id}">Download PDF</button>`
        : `<button class="view-report-btn bg-gray-500 ..." data-report-id="${report.id}">View</button>`;
    
    // For the "Download All" button
    let allButtonHTML = '';
    if (canDownload) {
        allButtonHTML = `<button class="download-all-btn bg-green-600 ...">Download All as ZIP</button>`;
    }

    // Attach event listener for the new "View" button
    document.querySelectorAll('.view-report-btn').forEach(button => {
        button.addEventListener('click', (e) => viewReportInNewTab(e.target.dataset.reportId));
    });
}

// ### NEW HELPER for viewing reports ###
async function viewReportInNewTab(reportId) {
    // This logic is nearly identical to downloadAdminReport but opens in a new tab
    // ... (code to fetch report and build HTML template) ...
    const newWindow = window.open();
    newWindow.document.write(reportTemplate);
    newWindow.document.close();
}


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();
            if (staffData.role && staffData.role !== 'pending') {
                window.userData = staffData;
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement' },
                    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice' },
                    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak' }
                };

                const navContainer = document.querySelector('nav');
                navContainer.innerHTML = ''; // Clear existing nav buttons
                let firstVisibleTab = null;

                // ### NEW ### Dynamically build the navigation based on permissions
                Object.entries(allNavItems).forEach(([id, item]) => {
                    if (window.userData.permissions?.tabs?.[item.perm]) {
                        if (!firstVisibleTab) firstVisibleTab = id; // Keep track of the first tab to show
                        const button = document.createElement('button');
                        button.id = id;
                        button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700';
                        button.textContent = document.getElementById(id)?.textContent || id.replace('nav', ''); // Get text from original hidden button
                        navContainer.appendChild(button);
                        
                        button.addEventListener('click', () => {
                            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                            button.classList.add('active');
                            item.fn(mainContent);
                        });
                    }
                });

                if (firstVisibleTab) {
                    document.getElementById(firstVisibleTab).click(); // Click the first available tab
                } else {
                    mainContent.innerHTML = `<p class="text-center">You do not have permission to view any panels.</p>`;
                }
                
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else { /* ... pending user logic ... */ }
        } else { /* ... unregistered user logic ... */ }
    } else { /* ... not logged in logic ... */ }
});
