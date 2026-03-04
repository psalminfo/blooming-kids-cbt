// ============================================================
// core/auth.js
// App boot: authentication, sidebar navigation, permission gating.
// Add new panels here as you create them — no other file needs changing.
// ============================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from './firebase.js';
import { getDoc, doc } from './firebase.js';
import { capitalize } from './utils.js';
import { switchToTabCached } from './cache.js';
import { initManagementNotifications } from '../notifications/bell.js';
import { showManagementActivityLog } from '../notifications/activityLog.js';

// ── Panel imports ─────────────────────────────────────────────
import { renderDashboardPanel }           from '../panels/dashboard.js';
import { renderManagementTutorView }      from '../panels/tutorDirectory.js';
import { renderInactiveTutorsPanel }      from '../panels/inactiveTutors.js';
import { renderArchivedStudentsPanel }    from '../panels/studentManagement.js';
import { renderPayAdvicePanel }           from '../panels/payAdvice.js';
import { renderTenureBonusPanel }         from '../panels/tenureBonus.js';
import { renderReferralsAdminPanel }      from '../panels/referrals.js';
import { renderTutorReportsPanel }        from '../panels/tutorReports.js';
import { renderEnrollmentsPanel }         from '../panels/enrollments.js';
import { renderPendingApprovalsPanel }    from '../panels/pendingApprovals.js';
import { renderSummerBreakPanel }         from '../panels/summerBreak.js';
import { renderParentFeedbackPanel }      from '../panels/parentFeedback.js';
import { renderMasterPortalPanel }        from '../panels/masterPortal.js';
import { renderAcademicFollowUpPanel }    from '../panels/academicFollowUp.js';
import { renderUserDirectoryPanel }       from '../panels/userDirectory.js';
import { renderManagementMessagingPanel } from '../panels/messaging.js';

const navigationGroups = {
    "dashboard": {
        icon: "fas fa-tachometer-alt",
        label: "Dashboard",
        fn: renderDashboardPanel
    },
    "tutorManagement": {
        icon: "fas fa-user-friends",
        label: "Tutor Management",
        items: [
            { id: "navTutorManagement", label: "Tutor Directory", icon: "fas fa-users", fn: renderManagementTutorView },
            { id: "navInactiveTutors", label: "Inactive Tutors", icon: "fas fa-user-slash", fn: renderInactiveTutorsPanel },
            { id: "navArchivedStudents", label: "Archived Students", icon: "fas fa-archive", fn: renderArchivedStudentsPanel }
        ]
    },
    "financial": {
        icon: "fas fa-money-bill-wave",
        label: "Financial",
        items: [
            { id: "navPayAdvice", label: "Pay Advice", icon: "fas fa-file-invoice-dollar", fn: renderPayAdvicePanel },
            { id: "navTenureBonus", label: "Tenure Bonus", icon: "fas fa-award", fn: renderTenureBonusPanel, perm: "viewTenureBonus" },
            { id: "navReferralsAdmin", label: "Referral Management", icon: "fas fa-handshake", fn: renderReferralsAdminPanel, perm: "viewReferralsAdmin" }
        ]
    },
    "academics": {
        icon: "fas fa-graduation-cap",
        label: "Academics",
        items: [
            { id: "navTutorReports", label: "Tutor Reports", icon: "fas fa-file-alt", fn: renderTutorReportsPanel },
            { id: "navEnrollments", label: "Enrollments", icon: "fas fa-user-plus", fn: renderEnrollmentsPanel },
            { id: "navPendingApprovals", label: "Pending Approvals", icon: "fas fa-user-check", fn: renderPendingApprovalsPanel },
            { id: "navSummerBreak", label: "Summer Break", icon: "fas fa-umbrella-beach", fn: renderSummerBreakPanel }
        ]
    },
    "masterPortal": {
        icon: "fas fa-chart-line",
        label: "Master Portal",
        items: [
            { id: "navMasterPortal", label: "Management Portal", icon: "fas fa-table", fn: renderMasterPortalPanel, perm: "viewMasterPortal" },
            { id: "navAcademicFollowUp", label: "Academic Follow-Up", icon: "fas fa-graduation-cap", fn: renderAcademicFollowUpPanel, perm: "viewMasterPortal" }
        ]
    },
    "userDirectory": {
        icon: "fas fa-address-book",
        label: "User Directory",
        items: [
            { id: "navUserDirectory", label: "User Directory", icon: "fas fa-address-book", fn: renderUserDirectoryPanel, perm: "viewUserDirectory" }
        ]
    },
    "communication": {
        icon: "fas fa-comments",
        label: "Communication",
        items: [
            { id: "navParentFeedback", label: "Parent Feedback", icon: "fas fa-comment-dots", fn: renderParentFeedbackPanel },
            { id: "navMessaging", label: "Messaging", icon: "fas fa-paper-plane", fn: renderManagementMessagingPanel, perm: "viewParentFeedback" }
        ]
    }
};

function initializeSidebarNavigation(staffData) {
    const navContainer = document.getElementById('navContainer');
    const searchInput = document.getElementById('navSearch');
    
    if (!navContainer) return;
    
    navContainer.innerHTML = '';
    
    let allNavItems = {};
    let hasVisibleItems = false;
    
    Object.entries(navigationGroups).forEach(([groupKey, group]) => {
        const visibleItems = group.items ? group.items.filter(item => {
            // Use explicit perm key if provided on the item, otherwise derive it
            const permKey = item.perm || getPermissionKey(item.id);
            const hasPermission = !staffData.permissions || 
                                !staffData.permissions.tabs || 
                                staffData.permissions.tabs[permKey] === true;
            return hasPermission;
        }) : [];
        
        if (visibleItems.length === 0 && groupKey !== 'dashboard') return;
        
        const groupElement = document.createElement('div');
        groupElement.className = 'nav-group';
        
        if (groupKey === 'dashboard') {
            const dashboardItem = document.createElement('div');
            dashboardItem.className = 'nav-item';
            dashboardItem.innerHTML = `
                <div class="nav-icon"><i class="${group.icon}"></i></div>
                <span class="nav-text">${group.label}</span>
            `;
            dashboardItem.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                dashboardItem.classList.add('active');
                
                document.getElementById('pageTitle').textContent = group.label;
                
                if (group.fn) {
                    switchToTabCached('navDashboard', group.fn);
                }
            });
            navContainer.appendChild(dashboardItem);
            
            setTimeout(() => dashboardItem.click(), 100);
            
        } else {
            groupElement.innerHTML = `
                <div class="nav-group-header">
                    <div class="group-title">
                        <i class="${group.icon}"></i>
                        <span>${group.label}</span>
                    </div>
                    <i class="fas fa-chevron-down group-arrow"></i>
                </div>
                <div class="nav-items" style="max-height: ${visibleItems.length * 48}px">
                    ${visibleItems.map(item => {
                        allNavItems[item.id] = { fn: item.fn, perm: getPermissionKey(item.id) };
                        return `
                            <div class="nav-item" data-nav-id="${item.id}">
                                <div class="nav-icon"><i class="${item.icon}"></i></div>
                                <span class="nav-text">${item.label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            const header = groupElement.querySelector('.nav-group-header');
            header.addEventListener('click', () => {
                groupElement.classList.toggle('collapsed');
            });
            
            navContainer.appendChild(groupElement);
            hasVisibleItems = true;
            
            groupElement.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const navId = item.dataset.navId;
                    
                    document.querySelectorAll('.nav-item').forEach(navItem => navItem.classList.remove('active'));
                    
                    item.classList.add('active');
                    
                    const itemLabel = item.querySelector('.nav-text').textContent;
                    document.getElementById('pageTitle').textContent = itemLabel;
                    
                    if (navId && allNavItems[navId]) {
                        switchToTabCached(navId, allNavItems[navId].fn);
                    }
                });
            });
        }
    });
    
    if (!hasVisibleItems && !document.querySelector('.nav-item[data-nav-id]')) {
        navContainer.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-lock text-gray-400 text-4xl mb-4"></i>
                <p class="text-gray-600">No accessible panels available for your role.</p>
            </div>
        `;
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const navItems = document.querySelectorAll('.nav-item');
            
            navItems.forEach(item => {
                const text = item.querySelector('.nav-text').textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    item.style.display = 'flex';
                    let parentGroup = item.closest('.nav-group');
                    if (parentGroup) {
                        parentGroup.style.display = 'block';
                        parentGroup.classList.remove('collapsed');
                    }
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    return allNavItems;
}

function getPermissionKey(navId) {
    return 'view' + navId.replace('nav', '').replace(/([A-Z])/g, (match, p1) => p1.charAt(0).toUpperCase() + p1.slice(1));
}

function updatePageTitle(title) {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = title;
    }
}


window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const body = document.body;
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            const icon = toggleBtn.querySelector('i');
            if (body.classList.contains('sidebar-collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-left';
            }
        });
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('mobile-open');
        });
    }
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.classList.remove('hidden');
    }
    
    if (user) {
        
        try {
            const staffDocRef = doc(db, "staff", user.email);
            const staffDocSnap = await getDoc(staffDocRef);
            
            if (staffDocSnap.exists() && staffDocSnap.data().role !== 'pending') {
                const staffData = staffDocSnap.data();
                window.userData = staffData;
                
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;
                
                const navItems = initializeSidebarNavigation(staffData);
                
                setupSidebarToggle();
                
                // Initialize notifications bell
                setTimeout(() => initManagementNotifications(), 500);
                
                // Wire activity log button
                const activityBtn = document.getElementById('activityLogBtn');
                if (activityBtn) {
                    activityBtn.addEventListener('click', showManagementActivityLog);
                }
                
                if (sidebarLogoutBtn) {
                    sidebarLogoutBtn.addEventListener('click', () => {
                        signOut(auth).then(() => {
                            window.location.href = "management-auth.html";
                        });
                    });
                }
                
                const defaultNavId = 'navDashboard';
                if (defaultNavId && navItems[defaultNavId]) {
                    updatePageTitle('Dashboard');
                    navItems[defaultNavId].fn(mainContent);
                }
                
            } else {
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="bg-white p-8 rounded-lg shadow-md text-center">
                            <i class="fas fa-user-clock text-yellow-500 text-5xl mb-4"></i>
                            <h2 class="text-2xl font-bold text-yellow-600 mb-2">Account Pending Approval</h2>
                            <p class="text-gray-600 mb-6">Your account is awaiting approval from an administrator.</p>
                            <button onclick="window.location.href='management-auth.html'" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                                Return to Login
                            </button>
                        </div>
                    `;
                }
                if (sidebarLogoutBtn) sidebarLogoutBtn.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error checking staff permissions:", error);
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="bg-white p-8 rounded-lg shadow-md text-center">
                        <i class="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
                        <h2 class="text-2xl font-bold text-red-600 mb-2">Error Loading Dashboard</h2>
                        <p class="text-gray-600 mb-4">There was an error loading your dashboard. Please try again.</p>
                        <p class="text-sm text-gray-500 mb-6">Error: ${error.message}</p>
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    } else {
        window.location.href = "management-auth.html";
    }
});
