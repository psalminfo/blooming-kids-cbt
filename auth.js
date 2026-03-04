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

const allNavItems = {
    navDashboard: { fn: renderDashboardPanel, perm: 'viewDashboard', label: 'Dashboard' },
    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement', label: 'Tutor Directory' },
    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice', label: 'Pay Advice' },
    navTenureBonus: { fn: renderTenureBonusPanel, perm: 'viewTenureBonus', label: 'Tenure Bonus' },
    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports', label: 'Tutor Reports' },
    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak', label: 'Summer Break' },
    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'viewPendingApprovals', label: 'Pending Approvals' },
    navParentFeedback: { fn: renderParentFeedbackPanel, perm: 'viewParentFeedback', label: 'Parent Feedback' },
    navMessaging: { fn: renderManagementMessagingPanel, perm: 'viewParentFeedback', label: 'Messaging' },
    navReferralsAdmin: { fn: renderReferralsAdminPanel, perm: 'viewReferralsAdmin', label: 'Referral Management' },
    navEnrollments: { fn: renderEnrollmentsPanel, perm: 'viewEnrollments', label: 'Enrollments' },
    navInactiveTutors: { fn: renderInactiveTutorsPanel, perm: 'viewInactiveTutors', label: 'Inactive Tutors' },
    navArchivedStudents: { fn: renderArchivedStudentsPanel, perm: 'viewArchivedStudents', label: 'Archived Students' },
    navMasterPortal: { fn: renderMasterPortalPanel, perm: 'viewMasterPortal', label: 'Management Portal' },
    navAcademicFollowUp: { fn: renderAcademicFollowUpPanel, perm: 'viewMasterPortal', label: 'Academic Follow-Up' },
    navUserDirectory: { fn: renderUserDirectoryPanel, perm: 'viewUserDirectory', label: 'User Directory' }
};

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

// ======================================================
// SECTION: MANAGEMENT MESSAGING PANEL
// ======================================================

async function renderManagementMessagingPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-6">📨 Messaging & Broadcast</h2>

            <!-- Tab Navigation -->
            <div class="flex border-b border-gray-200 mb-6 overflow-x-auto">
                <button data-msg-tab="inbox" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-green-600 text-green-700 whitespace-nowrap flex items-center gap-2">
                    <i class="fas fa-inbox"></i> Tutor Inbox
                    <span id="inbox-unread-badge" class="hidden bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center"></span>
                </button>
                <button data-msg-tab="compose" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-paper-plane"></i> Send Message
                </button>
                <button data-msg-tab="broadcast" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-bullhorn"></i> Broadcast
                </button>
                <button data-msg-tab="logs" class="msg-tab-btn px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-gray-500 hover:text-green-700 whitespace-nowrap">
                    <i class="fas fa-list"></i> Sent Log
                </button>
            </div>

            <!-- ====== INBOX TAB ====== -->
            <div id="msg-tab-inbox" class="msg-tab-content">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-700">📥 Messages from Tutors</h3>
                    <button id="refresh-inbox-btn" class="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                <div class="flex gap-2 mb-4 flex-wrap">
                    <button data-inbox-filter="all" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-green-600 text-white">All</button>
                    <button data-inbox-filter="unread" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Unread</button>
                    <button data-inbox-filter="replied" class="inbox-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Replied</button>
                </div>
                <div id="inbox-list" class="space-y-3">
                    <div class="text-center py-10 text-gray-400">
                        <i class="fas fa-inbox text-4xl mb-3 block"></i>
                        <p>Loading messages...</p>
                    </div>
                </div>
            </div>

            <!-- ====== COMPOSE (DIRECT MSG) TAB ====== -->
            <div id="msg-tab-compose" class="msg-tab-content hidden">
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-blue-800 mb-4">💬 Message a Tutor Directly</h3>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Search Tutor</label>
                        <div class="relative">
                            <input type="text" id="msg-tutor-search" placeholder="Type tutor name..." autocomplete="off"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <input type="hidden" id="msg-tutor-id">
                            <div id="msg-tutor-dropdown" class="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto hidden"></div>
                        </div>
                    </div>
                    
                    <div id="selected-tutor-info" class="hidden mb-4 p-3 bg-white rounded-lg border border-blue-100">
                        <p class="text-sm font-medium text-blue-800" id="selected-tutor-name-msg">—</p>
                        <p class="text-xs text-gray-500" id="selected-tutor-email-msg">—</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Subject (Optional)</label>
                        <input type="text" id="direct-msg-subject" placeholder="e.g. Schedule Update"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea id="direct-msg-content" rows="4" placeholder="Type your message..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
                    </div>
                    
                    <div class="flex justify-end">
                        <button id="send-direct-msg-btn" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                            <i class="fas fa-paper-plane"></i> Send Message
                        </button>
                    </div>
                    <div id="direct-msg-status" class="mt-3 hidden"></div>
                </div>
            </div>

            <!-- ====== BROADCAST TAB ====== -->
            <div id="msg-tab-broadcast" class="msg-tab-content hidden">
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-green-800 mb-4">📢 Broadcast Message</h3>
                    <p class="text-sm text-gray-600 mb-4">Send a pop-up announcement to all tutors and/or parents. Recipients will see it the next time they log in.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Subject / Title</label>
                            <input type="text" id="broadcast-title" placeholder="e.g. Important Notice" 
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Send To</label>
                            <div class="flex gap-4 mt-1">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="broadcast-to-tutors" checked class="rounded">
                                    <span class="text-sm">Tutors</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="broadcast-to-parents" class="rounded">
                                    <span class="text-sm">Parents</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea id="broadcast-message" rows="4" placeholder="Type your broadcast message here..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Attach Image or File (Optional)</label>
                        <input type="file" id="broadcast-file" accept="image/*,.pdf" 
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <p class="text-xs text-gray-500 mt-1">Images will be shown in the pop-up. PDFs will be downloadable.</p>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Show Popup For (Days) <span class="text-gray-400 text-xs">— how many days this pop-up stays active after login</span></label>
                        <input type="number" id="broadcast-popup-days" min="1" max="30" value="3"
                            class="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm">
                        <span class="text-xs text-gray-500 ml-2">days (default: 3 days)</span>
                    </div>
                    
                    <div class="flex justify-end">
                        <button id="send-broadcast-btn" class="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2">
                            <i class="fas fa-bullhorn"></i> Send Broadcast
                        </button>
                    </div>
                    
                    <div id="broadcast-status" class="mt-3 hidden"></div>
                </div>
            </div>

            <!-- ====== SENT LOG TAB ====== -->
            <div id="msg-tab-logs" class="msg-tab-content hidden">
                <div class="bg-white border border-gray-200 rounded-xl p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-gray-700">📋 Recent Broadcasts & Messages</h3>
                        <button id="refresh-broadcasts-btn" class="text-sm text-blue-600 hover:underline">Refresh</button>
                    </div>
                    <div id="broadcasts-list">
                        <p class="text-gray-500 text-sm text-center py-4">Loading...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ── Tab switching logic ──
    const msgTabBtns = container.querySelectorAll('.msg-tab-btn');
    const msgTabContents = container.querySelectorAll('.msg-tab-content');
    function switchMsgTab(tabId) {
        msgTabBtns.forEach(btn => {
            const active = btn.dataset.msgTab === tabId;
            btn.classList.toggle('border-green-600', active);
            btn.classList.toggle('text-green-700', active);
            btn.classList.toggle('border-transparent', !active);
            btn.classList.toggle('text-gray-500', !active);
        });
        msgTabContents.forEach(c => c.classList.toggle('hidden', c.id !== `msg-tab-${tabId}`));
        if (tabId === 'inbox') renderInbox(inboxFilter);
        if (tabId === 'logs') loadBroadcasts();
    }
    msgTabBtns.forEach(btn => btn.addEventListener('click', () => switchMsgTab(btn.dataset.msgTab)));

    // ── Inbox filter buttons ──
    container.querySelectorAll('.inbox-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.inbox-filter-btn').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            btn.classList.add('bg-green-600', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            renderInbox(btn.dataset.inboxFilter);
        });
    });
    document.getElementById('refresh-inbox-btn').addEventListener('click', () => startInboxListener());

    // ═══ INBOX: Real-time listener (messages appear instantly) ═══
    let inboxFilter = 'all';
    let _inboxUnsub = null;
    let _cachedInbox = [];

    function startInboxListener() {
        if (_inboxUnsub) _inboxUnsub();
        const listEl = document.getElementById('inbox-list');
        if (!listEl) return;
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl mb-3 block"></i><p>Loading inbox...</p></div>`;

        _inboxUnsub = onSnapshot(
            query(collection(db, 'tutor_to_management_messages'), orderBy('createdAt', 'desc'), limit(100)),
            (snap) => {
                let msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Already ordered desc by Firestore, but keep client-side sort as safety net
                msgs.sort((a, b) => {
                    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return tb - ta;
                });
                _cachedInbox = msgs;
                renderInbox(inboxFilter);
            },
            (err) => {
                console.error('Inbox listener error:', err);
                if (listEl) listEl.innerHTML = `
                    <div class="text-center py-10 text-red-400">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
                        <p class="font-medium">Failed to load inbox</p>
                        <p class="text-sm mt-1">${escapeHtml(err.message)}</p>
                        <button onclick="startInboxListener()" class="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
                    </div>`;
            }
        );
    }

    function renderInbox(filter) {
        inboxFilter = filter || 'all';
        const listEl = document.getElementById('inbox-list');
        if (!listEl) return;

        let messages = [..._cachedInbox];
        if (filter === 'unread') messages = messages.filter(m => !m.managementRead);
        if (filter === 'replied') messages = messages.filter(m => m.replied);

        // Update inbox badge
        const unreadCount = _cachedInbox.filter(m => !m.managementRead).length;
        const inboxBadge = document.getElementById('inbox-unread-badge');
        if (inboxBadge) { inboxBadge.textContent = unreadCount > 9 ? '9+' : unreadCount; inboxBadge.classList.toggle('hidden', unreadCount === 0); }

        if (messages.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-14 text-gray-400">
                    <i class="fas fa-inbox text-5xl mb-4 block"></i>
                    <p class="font-medium">No messages yet</p>
                    <p class="text-sm mt-1">Tutor messages will appear here in real-time</p>
                </div>`;
            return;
        }

        listEl.innerHTML = messages.map(msg => {
            const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Unknown';
            const unreadStyle = !msg.managementRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : 'bg-white';
            const unreadDot = !msg.managementRead ? '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>' : '';
            const repliedBadge = msg.replied ? '<span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Replied</span>' : '';
            const urgentBadge = msg.isUrgent ? '<span class="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">🔴 Urgent</span>' : '';
            const imgHTML = msg.imageUrl ? `<div class="mt-2"><img src="${escapeHtml(msg.imageUrl)}" class="max-w-xs rounded-lg cursor-pointer" onclick="window.open('${escapeHtml(msg.imageUrl)}','_blank')"></div>` : '';
            const repliesHTML = msg.managementReplies?.length ? `
                <div class="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Replies</p>
                    ${msg.managementReplies.map(r => `
                        <div class="bg-green-50 border border-green-100 rounded-lg p-2.5 ml-4">
                            <p class="text-sm text-gray-800">${escapeHtml(r.message)}</p>
                            <p class="text-xs text-gray-400 mt-1">${r.repliedBy || 'Management'} · ${r.repliedAt?.toDate ? r.repliedAt.toDate().toLocaleString() : ''}</p>
                        </div>
                    `).join('')}
                </div>` : '';
            return `
                <div class="border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${unreadStyle}" data-inbox-id="${msg.id}">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                        <div class="flex-1">
                            <div class="flex items-center flex-wrap gap-1 mb-1">
                                ${unreadDot}
                                <span class="font-bold text-gray-800">${escapeHtml(msg.tutorName || 'Unknown Tutor')}</span>
                                <span class="text-xs text-gray-400">${escapeHtml(msg.tutorEmail || '')}</span>
                                ${repliedBadge}${urgentBadge}
                            </div>
                            ${msg.subject ? `<p class="text-sm font-semibold text-gray-700 mb-1">📌 ${escapeHtml(msg.subject)}</p>` : ''}
                            <p class="text-sm text-gray-700 leading-relaxed">${escapeHtml(msg.message || '')}</p>
                            ${imgHTML}
                            ${repliesHTML}
                        </div>
                        <span class="text-xs text-gray-400 whitespace-nowrap">${date}</span>
                    </div>
                    <div class="mt-3 flex gap-2 flex-wrap">
                        ${!msg.managementRead ? `<button class="mark-inbox-read-btn text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1" data-id="${msg.id}"><i class="fas fa-check mr-1"></i>Mark Read</button>` : ''}
                        <button class="reply-inbox-btn text-xs text-green-700 hover:text-green-900 border border-green-200 rounded px-2 py-1 font-medium" data-id="${msg.id}" data-tutor-email="${escapeHtml(msg.tutorEmail || '')}" data-tutor-name="${escapeHtml(msg.tutorName || '')}">
                            <i class="fas fa-reply mr-1"></i>Reply
                        </button>
                    </div>
                    <!-- Reply form -->
                    <div class="inbox-reply-form hidden mt-3 pt-3 border-t border-gray-100" id="reply-form-${msg.id}">
                        <textarea class="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none focus:ring-2 focus:ring-green-500" rows="3" placeholder="Type your reply..."></textarea>
                        <div class="flex justify-end gap-2 mt-2">
                            <button class="cancel-reply-btn text-xs text-gray-500 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">Cancel</button>
                            <button class="submit-reply-btn bg-green-600 text-white text-xs rounded px-3 py-1.5 hover:bg-green-700 font-medium" data-id="${msg.id}" data-tutor-email="${escapeHtml(msg.tutorEmail || '')}" data-tutor-name="${escapeHtml(msg.tutorName || '')}">
                                <i class="fas fa-paper-plane mr-1"></i>Send Reply
                            </button>
                        </div>
                        <div class="reply-status hidden mt-2 text-xs p-2 rounded"></div>
                    </div>
                </div>`;
        }).join('');

        // Wire mark-read (onSnapshot auto-re-renders)
        listEl.querySelectorAll('.mark-inbox-read-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try { await updateDoc(doc(db, 'tutor_to_management_messages', btn.dataset.id), { managementRead: true }); } catch(e) { console.error(e); }
            });
        });
        // Wire reply toggle
        listEl.querySelectorAll('.reply-inbox-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = document.getElementById(`reply-form-${btn.dataset.id}`);
                if (f) f.classList.toggle('hidden');
            });
        });
        // Wire cancel
        listEl.querySelectorAll('.cancel-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.inbox-reply-form').classList.add('hidden'));
        });
        // Wire submit reply
        listEl.querySelectorAll('.submit-reply-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const form = document.getElementById(`reply-form-${id}`);
                const textarea = form.querySelector('textarea');
                const replyMsg = textarea.value.trim();
                const statusEl = form.querySelector('.reply-status');
                if (!replyMsg) { 
                    statusEl.textContent = 'Please enter a reply.'; 
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-red-50 text-red-700'; 
                    statusEl.classList.remove('hidden'); 
                    return; 
                }
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Sending...';
                try {
                    const senderName = window.userData?.name || 'Management';
                    const senderEmail = window.userData?.email || '';
                    const replyData = {
                        message: sanitizeInput(replyMsg),
                        repliedBy: senderName,
                        repliedByEmail: senderEmail,
                        repliedAt: Timestamp.now()
                    };
                    const msgDocRef = doc(db, 'tutor_to_management_messages', id);
                    const msgSnap = await getDoc(msgDocRef);
                    const existing = msgSnap.exists() ? (msgSnap.data().managementReplies || []) : [];
                    await updateDoc(msgDocRef, {
                        managementReplies: [...existing, replyData],
                        managementRead: true,
                        replied: true,
                        lastRepliedAt: Timestamp.now()
                    });
                    // Also notify the tutor
                    await addDoc(collection(db, 'tutor_notifications'), {
                        tutorEmail: btn.dataset.tutorEmail,
                        type: 'management_reply',
                        title: 'Reply from Management',
                        message: sanitizeInput(replyMsg),
                        senderName: senderName,
                        senderDisplay: 'Management',
                        read: false,
                        createdAt: Timestamp.now()
                    });
                    // Also write to conversations collection so tutor sees reply in chat
                    const origMsg = _cachedInbox.find(m => m.id === id);
                    if (origMsg?.conversationId) {
                        try {
                            await addDoc(collection(db, "conversations", origMsg.conversationId, "messages"), {
                                content: replyMsg,
                                senderId: 'management',
                                senderName: senderName,
                                senderRole: 'management',
                                createdAt: Timestamp.now(),
                                read: false
                            });
                            await updateDoc(doc(db, "conversations", origMsg.conversationId), {
                                lastMessage: replyMsg,
                                lastMessageTimestamp: Timestamp.now(),
                                lastSenderId: 'management',
                                unreadCount: 1
                            }).catch(() => {});
                        } catch(convErr) { console.warn('Could not write to conversation:', convErr); }
                    }
                    statusEl.textContent = '✅ Reply sent!';
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-green-50 text-green-700';
                    statusEl.classList.remove('hidden');
                    textarea.value = '';
                    setTimeout(() => form.classList.add('hidden'), 1200);
                    await logManagementActivity('Replied to tutor message', `Replied to ${btn.dataset.tutorName || btn.dataset.tutorEmail}`);
                } catch(e) {
                    statusEl.textContent = '❌ Failed: ' + e.message;
                    statusEl.className = 'reply-status mt-2 text-xs p-2 rounded bg-red-50 text-red-700';
                    statusEl.classList.remove('hidden');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Send Reply';
                }
            });
        });
    }

    // Start real-time inbox listener
    startInboxListener();
    
    // Load tutors for search
    let tutorsList = [];
    try {
        if (!sessionCache.tutors) {
            const snap = await getDocs(query(collection(db, "tutors")));
            sessionCache.tutors = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.status || t.status === 'active');
        }
        tutorsList = sessionCache.tutors || [];
    } catch(e) { console.error(e); }
    
    // Tutor search dropdown
    const tutorSearchInput = document.getElementById('msg-tutor-search');
    const tutorHiddenInput = document.getElementById('msg-tutor-id');
    const tutorDropdown = document.getElementById('msg-tutor-dropdown');
    
    tutorSearchInput.addEventListener('input', () => {
        const term = tutorSearchInput.value.toLowerCase();
        const matches = tutorsList.filter(t => (t.name || t.email || '').toLowerCase().includes(term)).slice(0, 10);
        tutorDropdown.innerHTML = matches.map(t => `
            <div class="tutor-msg-opt px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0" 
                data-id="${t.id}" data-name="${t.name || t.email}" data-email="${t.email || ''}">
                <span class="font-medium">${t.name || 'Unknown'}</span>
                <span class="text-gray-400 text-xs ml-2">${t.email || ''}</span>
            </div>
        `).join('');
        tutorDropdown.classList.toggle('hidden', matches.length === 0);
    });
    
    tutorDropdown.addEventListener('mousedown', (e) => {
        const opt = e.target.closest('.tutor-msg-opt');
        if (!opt) return;
        e.preventDefault();
        tutorSearchInput.value = opt.dataset.name;
        tutorHiddenInput.value = opt.dataset.id;
        document.getElementById('selected-tutor-name-msg').textContent = opt.dataset.name;
        document.getElementById('selected-tutor-email-msg').textContent = opt.dataset.email;
        document.getElementById('selected-tutor-info').classList.remove('hidden');
        tutorDropdown.classList.add('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!tutorSearchInput.contains(e.target)) tutorDropdown.classList.add('hidden');
    });
    
    // Send direct message
    document.getElementById('send-direct-msg-btn').addEventListener('click', async () => {
        const tutorId = tutorHiddenInput.value;
        const content = document.getElementById('direct-msg-content').value.trim();
        const subject = document.getElementById('direct-msg-subject')?.value.trim() || '';
        const senderName = window.userData?.name || 'Management';
        const senderEmail = window.userData?.email || '';
        const statusEl = document.getElementById('direct-msg-status');
        
        if (!tutorId) { showMsgStatus(statusEl, '❌ Please select a tutor first.', false); return; }
        if (!content) { showMsgStatus(statusEl, '❌ Please enter a message.', false); return; }
        
        const tutor = tutorsList.find(t => t.id === tutorId);
        if (!tutor) { showMsgStatus(statusEl, '❌ Tutor not found.', false); return; }
        
        try {
            document.getElementById('send-direct-msg-btn').disabled = true;
            // Send to tutor's notification inbox
            await addDoc(collection(db, 'tutor_notifications'), {
                tutorEmail: tutor.email,
                type: 'management_message',
                title: subject ? `Message from Management: ${subject}` : 'Message from Management',
                message: sanitizeInput(content),
                senderName: senderName,
                senderEmail: senderEmail,
                senderDisplay: 'Management',
                read: false,
                createdAt: Timestamp.now()
            });
            // Also log in management_sent_messages for thread tracking
            await addDoc(collection(db, 'management_sent_messages'), {
                tutorEmail: tutor.email,
                tutorName: tutor.name || tutor.email,
                subject: sanitizeInput(subject),
                message: sanitizeInput(content),
                senderName: senderName,
                senderEmail: senderEmail,
                createdAt: Timestamp.now()
            });
            document.getElementById('direct-msg-content').value = '';
            if (document.getElementById('direct-msg-subject')) document.getElementById('direct-msg-subject').value = '';
            showMsgStatus(statusEl, `✅ Message sent to ${tutor.name || tutor.email}!`, true);
            await logManagementActivity('Sent direct message', `To tutor: ${tutor.name || tutor.email}`);
        } catch(err) {
            showMsgStatus(statusEl, '❌ Failed to send: ' + err.message, false);
        } finally {
            document.getElementById('send-direct-msg-btn').disabled = false;
        }
    });
    
    // Send broadcast
    document.getElementById('send-broadcast-btn').addEventListener('click', async () => {
        const title = document.getElementById('broadcast-title').value.trim();
        const message = document.getElementById('broadcast-message').value.trim();
        const toTutors = document.getElementById('broadcast-to-tutors').checked;
        const toParents = document.getElementById('broadcast-to-parents').checked;
        const fileInput = document.getElementById('broadcast-file');
        const statusEl = document.getElementById('broadcast-status');
        const popupDays = parseInt(document.getElementById('broadcast-popup-days').value) || 3;
        const senderName = window.userData?.name || 'Management';
        
        if (!title) { showMsgStatus(statusEl, '❌ Please enter a broadcast title.', false); return; }
        if (!message) { showMsgStatus(statusEl, '❌ Please enter a message.', false); return; }
        if (!toTutors && !toParents) { showMsgStatus(statusEl, '❌ Please select at least one recipient group.', false); return; }
        
        const btn = document.getElementById('send-broadcast-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sending...';
        
        try {
            let fileUrl = null;
            let fileType = null;
            
            // Upload file if present
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'bkh_assessments');
                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/dy2hxcyaf/auto/upload`, { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                fileUrl = uploadData.secure_url;
                fileType = file.type.startsWith('image/') ? 'image' : 'file';
            }
            
            const broadcastDoc = {
                title,
                message,
                toTutors,
                toParents,
                senderName,
                senderDisplay: 'Management',
                fileUrl: fileUrl || null,
                fileType: fileType || null,
                popupDays: popupDays,
                createdAt: Timestamp.now(),
                isGlobal: true
            };
            
            // Save broadcast log
            await addDoc(collection(db, 'broadcasts'), broadcastDoc);

            // ── Fan-out to each tutor's inbox (tutor_notifications) ──
            if (toTutors) {
                let tutorsToNotify = tutorsList;
                if (!tutorsToNotify || tutorsToNotify.length === 0) {
                    const snap = await getDocs(query(collection(db, 'tutors')));
                    tutorsToNotify = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(t => !t.status || t.status === 'active');
                }
                const batch = writeBatch(db);
                tutorsToNotify.forEach(tutor => {
                    if (!tutor.email) return;
                    const ref = doc(collection(db, 'tutor_notifications'));
                    batch.set(ref, {
                        tutorEmail: tutor.email,
                        type: 'broadcast',
                        title: title,
                        message: message,
                        fileUrl: fileUrl || null,
                        fileType: fileType || null,
                        popupDays: popupDays,
                        senderName: senderName,
                        senderDisplay: 'Management',
                        read: false,
                        popupShown: false,
                        createdAt: Timestamp.now(),
                        isGlobal: true
                    });
                });
                await batch.commit();
            }

            // ── Fan-out to each parent's notifications ──
            if (toParents) {
                const studentsSnap = await getDocs(query(collection(db, 'students')));
                const parentEmails = [...new Set(
                    studentsSnap.docs
                        .map(d => d.data().parentEmail)
                        .filter(Boolean)
                )];
                if (parentEmails.length > 0) {
                    const batch = writeBatch(db);
                    parentEmails.forEach(email => {
                        const ref = doc(collection(db, 'parent_notifications'));
                        batch.set(ref, {
                            parentEmail: email,
                            type: 'broadcast',
                            title: title,
                            message: message,
                            fileUrl: fileUrl || null,
                            fileType: fileType || null,
                            senderName: senderName,
                            senderDisplay: 'Management',
                            read: false,
                            createdAt: Timestamp.now(),
                            isGlobal: true
                        });
                    });
                    await batch.commit();
                }
            }
            
            showMsgStatus(statusEl, `✅ Broadcast sent to ${[toTutors && 'Tutors', toParents && 'Parents'].filter(Boolean).join(' & ')}!`, true);
            document.getElementById('broadcast-title').value = '';
            document.getElementById('broadcast-message').value = '';
            fileInput.value = '';
            loadBroadcasts();
        } catch(err) {
            showMsgStatus(statusEl, '❌ Failed: ' + err.message, false);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-bullhorn"></i> Send Broadcast';
        }
    });
    
    document.getElementById('refresh-broadcasts-btn').addEventListener('click', loadBroadcasts);
    loadBroadcasts();
    
    function showMsgStatus(el, msg, success) {
        el.textContent = msg;
        el.className = `mt-3 p-3 rounded-lg text-sm font-medium ${success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
    
    async function loadBroadcasts() {
        const listEl = document.getElementById('broadcasts-list');
        if (!listEl) return;
        try {
            // Load broadcasts + direct sent messages
            const [bcSnap, sentSnap] = await Promise.all([
                getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20))),
                getDocs(query(collection(db, 'management_sent_messages'), orderBy('createdAt', 'desc'), limit(20)))
            ]);
            const allLogs = [];
            bcSnap.docs.forEach(d => allLogs.push({ ...d.data(), id: d.id, _type: 'broadcast' }));
            sentSnap.docs.forEach(d => allLogs.push({ ...d.data(), id: d.id, _type: 'direct' }));
            allLogs.sort((a, b) => {
                const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return tb - ta;
            });
            if (allLogs.length === 0) { listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No sent messages yet.</p>'; return; }
            listEl.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mb-3 text-xs text-yellow-700"><i class="fas fa-info-circle mr-1"></i>Logs older than 7 days are automatically cleared.</div>` +
                allLogs.map(b => {
                const date = b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString() : 'Unknown';
                if (b._type === 'broadcast') {
                    const targets = [b.toTutors && '👩‍🏫 Tutors', b.toParents && '👨‍👩‍👧 Parents'].filter(Boolean).join(', ');
                    return `<div class="border-b py-3 last:border-0"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-800">📢 ${escapeHtml(b.title || 'Broadcast')}</p><p class="text-sm text-gray-600 mt-1">${escapeHtml(b.message || '')}</p><p class="text-xs text-gray-400 mt-1">By: ${escapeHtml(b.senderName || 'Management')} · To: ${targets}</p></div><span class="text-xs text-gray-400 whitespace-nowrap ml-4">${date}</span></div></div>`;
                } else {
                    return `<div class="border-b py-3 last:border-0"><div class="flex justify-between items-start"><div><p class="font-semibold text-gray-800">💬 ${escapeHtml(b.tutorName || b.tutorEmail || 'Tutor')}</p>${b.subject ? `<p class="text-sm text-blue-600 font-medium">📌 ${escapeHtml(b.subject)}</p>` : ''}<p class="text-sm text-gray-600 mt-1">${escapeHtml(b.message || '')}</p><p class="text-xs text-gray-400 mt-1">By: ${escapeHtml(b.senderName || 'Management')}</p></div><span class="text-xs text-gray-400 whitespace-nowrap ml-4">${date}</span></div></div>`;
                }
            }).join('');
        } catch(e) { listEl.innerHTML = '<p class="text-red-500 text-sm">Failed to load sent log.</p>'; }
    }
}

// ======================================================
// SECTION: WRITE MANAGEMENT_NOTIFICATIONS FROM EVENTS
// Call these helpers whenever you need to alert management
// ======================================================

/**
 * Creates a management_notifications entry for any significant event.
 * type: 'student_break' | 'recall_request' | 'placement_test' | 'parent_feedback' | 'tutor_message' | 'new_enrollment'
 */
async function createManagementNotification(type, title, message, extraData = {}) {
    try {
        await addDoc(collection(db, 'management_notifications'), {
            type,
            title: sanitizeInput(title, 200),
            message: sanitizeInput(message, 500),
            read: false,
            createdAt: Timestamp.now(),
            ...extraData
        });
    } catch(e) { console.warn('Could not create management notification:', e.message); }
}

window.createManagementNotification = createManagementNotification;

// ======================================================
// SECTION: MANAGEMENT NOTIFICATION BELL
// ======================================================

async function initManagementNotifications() {
    const bellBtn = document.getElementById('notificationBell') || document.querySelector('[data-notification-bell]');
    if (!bellBtn) return;

    let allNotifications = [];
    const _unsubs = [];
    let _prevUnread = -1; // -1 = first load, skip sound

    // ── Notification Sound ──
    function playBellSound() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine';
            const t = ctx.currentTime;
            o.frequency.setValueAtTime(659, t);       // E5
            o.frequency.setValueAtTime(880, t + 0.1);  // A5
            o.frequency.setValueAtTime(988, t + 0.2);  // B5
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            o.start(t); o.stop(t + 0.5);
        } catch(e) {}
    }

    // ── Badge setup ──
    let badge = document.getElementById('notification-badge') || bellBtn.querySelector('.notification-badge, span');
    if (!badge) { badge = document.createElement('span'); bellBtn.appendChild(badge); }
    badge.id = 'notification-badge';
    badge.className = 'absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold text-[10px] hidden px-1';
    bellBtn.style.position = 'relative';

    const TYPE_CONFIG = {
        management_notification: { icon: '🔔', color: 'border-l-green-500',  label: 'Alert' },
        tutor_message:           { icon: '💬', color: 'border-l-blue-500',   label: 'Tutor Message' },
        parent_feedback:         { icon: '💌', color: 'border-l-purple-500', label: 'Parent Feedback' },
        recall_request:          { icon: '🔁', color: 'border-l-orange-500', label: 'Recall Request' },
        student_break:           { icon: '☕', color: 'border-l-yellow-500', label: 'Student on Break' },
        placement_test:          { icon: '📋', color: 'border-l-indigo-500', label: 'Placement Test' },
        new_enrollment:          { icon: '📝', color: 'border-l-teal-500',   label: 'New Enrollment' },
        tutor_inactive:          { icon: '⚠️', color: 'border-l-red-400',    label: 'Tutor Inactive' },
    };

    // ── 7-day auto-clear (runs once per calendar day) ──
    (async function autoClear7Days() {
        const key = 'mgmt_clear7_' + new Date().toISOString().slice(0,10);
        if (localStorage.getItem(key)) return;
        const cutoff = new Date(Date.now() - 7*24*60*60*1000);
        const cutTS = Timestamp.fromDate(cutoff);
        try {
            // Old read management_notifications
            const s1 = await getDocs(query(collection(db,'management_notifications'), where('read','==',true), limit(200)));
            if (s1.size) { const b = writeBatch(db); let n=0; s1.docs.forEach(d => { const c=d.data().createdAt?.toDate?.(); if(c&&c<cutoff){b.delete(d.ref);n++;} }); if(n) await b.commit();; }
            // Old broadcasts
            const s2 = await getDocs(query(collection(db,'broadcasts'), where('createdAt','<',cutTS), limit(200)));
            if (s2.size) { const b = writeBatch(db); s2.docs.forEach(d=>b.delete(d.ref)); await b.commit();; }
            // Old sent messages
            const s3 = await getDocs(query(collection(db,'management_sent_messages'), where('createdAt','<',cutTS), limit(200)));
            if (s3.size) { const b = writeBatch(db); s3.docs.forEach(d=>b.delete(d.ref)); await b.commit();; }
            // Old read inbox messages
            const s4 = await getDocs(query(collection(db,'tutor_to_management_messages'), where('managementRead','==',true), limit(200)));
            if (s4.size) { const b = writeBatch(db); let n=0; s4.docs.forEach(d => { const c=d.data().createdAt?.toDate?.(); if(c&&c<cutoff){b.delete(d.ref);n++;} }); if(n) await b.commit();; }
            // Old management_activity
            const s5 = await getDocs(query(collection(db,'management_activity'), where('timestamp','<',cutTS), limit(200)));
            if (s5.size) { const b = writeBatch(db); s5.docs.forEach(d=>b.delete(d.ref)); await b.commit();; }
            localStorage.setItem(key, '1');
        } catch(e) { console.warn('Auto-clear err:', e.message); }
    })();

    // ── Shared buckets — each onSnapshot updates its own ──
    let bk1=[], bk2=[], bk3=[], bk4=[], bk5=[], bk6=[], bk7=[];

    function rebuild() {
        const sevenAgo = new Date(Date.now() - 7*24*60*60*1000);
        allNotifications = [...bk1,...bk2,...bk3,...bk4,
            ...bk5.filter(n=>{const d=n._bd?.toDate?.();return d&&d>sevenAgo;}),
            ...bk6,...bk7
        ];
        allNotifications.sort((a,b)=>{
            const ta=a.createdAt?.toDate?a.createdAt.toDate():(a.createdAt instanceof Date?a.createdAt:new Date(0));
            const tb=b.createdAt?.toDate?b.createdAt.toDate():(b.createdAt instanceof Date?b.createdAt:new Date(0));
            return tb-ta;
        });
        const uc = allNotifications.filter(n=>!n.read).length;
        badge.textContent = uc>9?'9+':String(uc);
        badge.classList.toggle('hidden', uc===0);
        // Play sound only when count increases (skip first load)
        if (_prevUnread >= 0 && uc > _prevUnread) playBellSound();
        _prevUnread = uc;
    }

    // 1. management_notifications (unread)
    _unsubs.push(onSnapshot(query(collection(db,'management_notifications'),where('read','==',false),limit(30)),
        s=>{bk1=s.docs.map(d=>({id:d.id,_collection:'management_notifications',_type:'management_notification',title:d.data().title||'Notification',message:d.data().message||'',createdAt:d.data().createdAt,read:false}));rebuild();},
        e=>console.warn('Bell[1]',e.message)));
    // 2. Tutor messages (unread)
    _unsubs.push(onSnapshot(query(collection(db,'tutor_to_management_messages'),where('managementRead','==',false),limit(20)),
        s=>{bk2=s.docs.map(d=>({id:d.id,_collection:'tutor_to_management_messages',_type:'tutor_message',title:'Message from '+(d.data().tutorName||'Tutor'),message:(d.data().message||'').slice(0,100),createdAt:d.data().createdAt,read:false,actionTab:'messaging'}));rebuild();},
        e=>console.warn('Bell[2]',e.message)));
    // 3. Parent feedback (unread)
    _unsubs.push(onSnapshot(query(collection(db,'parent_feedback'),where('read','==',false),limit(20)),
        s=>{bk3=s.docs.map(d=>({id:d.id,_collection:'parent_feedback',_type:'parent_feedback',title:'Feedback from '+(d.data().parentName||'Parent'),message:'Student: '+(d.data().studentName||'N/A')+' · '+(d.data().message||'').slice(0,80),createdAt:d.data().submittedAt||d.data().timestamp||d.data().createdAt,read:false,actionTab:'feedback'}));rebuild();},
        e=>console.warn('Bell[3]',e.message)));
    // 4. Recall requests (pending)
    _unsubs.push(onSnapshot(query(collection(db,'recall_requests'),where('status','==','pending'),limit(20)),
        s=>{bk4=s.docs.map(d=>({id:d.id,_collection:'recall_requests',_type:'recall_request',title:'Recall: '+(d.data().studentName||'Student'),message:'Tutor: '+(d.data().tutorName||d.data().tutorEmail||'N/A'),createdAt:d.data().createdAt,read:false,actionTab:'breaks'}));rebuild();},
        e=>console.warn('Bell[4]',e.message)));
    // 5. Students on break
    _unsubs.push(onSnapshot(query(collection(db,'students'),where('summerBreak','==',true),limit(30)),
        s=>{bk5=s.docs.filter(d=>d.data().breakNotifRead!==true).map(d=>({id:d.id,_collection:'students',_type:'student_break',title:(d.data().studentName||'Student')+' on break',message:'Tutor: '+(d.data().tutorName||'N/A'),createdAt:d.data().breakDate,_bd:d.data().breakDate,read:false,actionTab:'breaks'}));rebuild();},
        e=>console.warn('Bell[5]',e.message)));
    // 6. Placement tests
    _unsubs.push(onSnapshot(query(collection(db,'tutors'),where('placementTestStatus','==','completed'),limit(20)),
        s=>{bk6=s.docs.filter(d=>d.data().placementTestAcknowledged!==true).map(d=>({id:d.id,_collection:'tutors',_type:'placement_test',title:'Placement: '+(d.data().name||d.data().email),message:(d.data().name||d.data().email)+' completed test',createdAt:d.data().placementTestDate||d.data().updatedAt,read:false,actionTab:'tutors'}));rebuild();},
        e=>console.warn('Bell[6]',e.message)));
    // 7. Enrollments (last 3 days)
    const threeAgo = Timestamp.fromDate(new Date(Date.now()-3*24*60*60*1000));
    _unsubs.push(onSnapshot(query(collection(db,'enrollments'),where('createdAt','>',threeAgo),limit(20)),
        s=>{bk7=s.docs.filter(d=>d.data().managementSeen!==true).map(d=>({id:d.id,_collection:'enrollments',_type:'new_enrollment',title:'New enrollment: '+(d.data().studentName||'Student'),message:(d.data().parentName||'Parent')+' enrolled '+(d.data().studentName||'student'),createdAt:d.data().createdAt,read:false,actionTab:'enrollments'}));rebuild();},
        e=>console.warn('Bell[7]',e.message)));

    // Cleanup old polling interval if exists
    if (window._notifPollInterval) { clearInterval(window._notifPollInterval); window._notifPollInterval = null; }
    window._bellUnsubs = _unsubs;

    // ── Mark single notification read ──
    async function markNotifRead(notif) {
        try {
            if (notif._collection==='management_notifications') await updateDoc(doc(db,'management_notifications',notif.id),{read:true});
            else if (notif._collection==='tutor_to_management_messages') await updateDoc(doc(db,'tutor_to_management_messages',notif.id),{managementRead:true});
            else if (notif._collection==='parent_feedback') await updateDoc(doc(db,'parent_feedback',notif.id),{read:true});
            else if (notif._collection==='students') await updateDoc(doc(db,'students',notif.id),{breakNotifRead:true});
            else if (notif._collection==='tutors') await updateDoc(doc(db,'tutors',notif.id),{placementTestAcknowledged:true});
            else if (notif._collection==='enrollments') await updateDoc(doc(db,'enrollments',notif.id),{managementSeen:true});
        } catch(e) { console.warn('markRead err:', e.message); }
    }

    // ── Mark all as read ──
    async function markAllRead() {
        try {
            const batch = writeBatch(db);
            (await getDocs(query(collection(db,'management_notifications'),where('read','==',false)))).docs.forEach(d=>batch.update(d.ref,{read:true}));
            (await getDocs(query(collection(db,'tutor_to_management_messages'),where('managementRead','==',false)))).docs.forEach(d=>batch.update(d.ref,{managementRead:true}));
            (await getDocs(query(collection(db,'parent_feedback'),where('read','==',false)))).docs.forEach(d=>batch.update(d.ref,{read:true}));
            await batch.commit();
        } catch(e) { console.warn('markAllRead err:', e.message); }
    }

    // ── Bell click → show notification panel ──
    bellBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const existing = document.getElementById('notification-panel');
        if (existing) { existing.remove(); return; }

        const notifications = allNotifications;
        const unreadCount = notifications.filter(n => !n.read).length;

        const panel = document.createElement('div');
        panel.id = 'notification-panel';
        panel.className = 'fixed top-16 right-4 w-96 max-w-[95vw] bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden';

        // Group by type for summary
        const typeCounts = {};
        notifications.filter(n => !n.read).forEach(n => { typeCounts[n._type] = (typeCounts[n._type] || 0) + 1; });
        const summaryHTML = Object.entries(typeCounts).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] || { icon: '🔔', label: type };
            return `<span class="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">${cfg.icon} <span class="font-semibold">${count}</span> ${cfg.label}</span>`;
        }).join(' ');

        panel.innerHTML = `
            <div class="bg-green-700 text-white px-4 py-3 flex justify-between items-center">
                <div>
                    <span class="font-bold text-base">🔔 Notifications</span>
                    <span class="ml-2 bg-white text-green-700 text-xs font-bold rounded-full px-2 py-0.5">${unreadCount} unread</span>
                </div>
                <button id="close-notif-panel" class="text-white hover:text-gray-200 text-xl leading-none">&times;</button>
            </div>
            ${summaryHTML ? `<div class="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-1">${summaryHTML}</div>` : ''}
            <div class="max-h-[420px] overflow-y-auto divide-y" id="notif-list">
                ${notifications.length === 0
                    ? '<p class="text-gray-500 text-sm text-center py-8">✅ You\'re all caught up!</p>'
                    : notifications.slice(0, 40).map(n => {
                        const cfg = TYPE_CONFIG[n._type] || { icon: '🔔', color: 'border-l-gray-400', label: '' };
                        const date = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : '';
                        const unreadClass = !n.read ? `border-l-4 ${cfg.color} bg-gray-50` : '';
                        return `
                            <div class="p-3 hover:bg-blue-50 cursor-pointer notif-item transition-colors ${unreadClass}" 
                                data-idx="${notifications.indexOf(n)}"
                                data-tab="${n.actionTab || ''}">
                                <div class="flex items-start gap-2">
                                    <span class="text-lg leading-none mt-0.5">${cfg.icon}</span>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex justify-between items-start gap-2">
                                            <p class="text-sm font-semibold text-gray-800 leading-snug">${escapeHtml(n.title)}</p>
                                            ${!n.read ? '<span class="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>' : ''}
                                        </div>
                                        <p class="text-xs text-gray-600 mt-0.5 leading-snug">${escapeHtml(n.message)}</p>
                                        <p class="text-[10px] text-gray-400 mt-1">${date}</p>
                                    </div>
                                </div>
                            </div>`;
                    }).join('')
                }
            </div>
            ${unreadCount > 0 ? `
                <div class="p-3 border-t flex justify-between items-center bg-gray-50">
                    <span class="text-xs text-gray-500">${notifications.length} total notifications</span>
                    <button id="mark-all-read-btn" class="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50 transition-colors">
                        ✓ Mark all as read
                    </button>
                </div>` : ''}
        `;
        document.body.appendChild(panel);

        document.getElementById('close-notif-panel').addEventListener('click', () => panel.remove());

        document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
            await markAllRead();
            panel.remove();
        });

        panel.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async () => {
                const idx = parseInt(item.dataset.idx);
                const notif = notifications[idx];
                if (notif && !notif.read) await markNotifRead(notif);
                panel.remove();
                // Navigate to relevant tab if actionTab is set
                if (notif?.actionTab) {
                    const navMap = {
                        messaging:   'navMessaging',
                        feedback:    'navParentFeedback',
                        breaks:      'navBreaks',
                        tutors:      'navTutorManagement',
                        enrollments: 'navEnrollments',
                    };
                    const navId = navMap[notif.actionTab];
                    if (navId) {
                        const navBtn = document.getElementById(navId);
                        if (navBtn) navBtn.click();
                    }
                }
            });
        });

        document.addEventListener('click', (ev) => {
            if (!panel.contains(ev.target) && ev.target !== bellBtn) panel.remove();
        }, { once: true });
    });
}

// ======================================================
// SECTION: MANAGEMENT ACTIVITY LOG (second button)
// ======================================================

async function showManagementActivityLog() {
    const existing = document.getElementById('activity-log-modal');
    if (existing) { existing.remove(); return; }
    
    const staffName = window.userData?.name || 'Unknown';
    const staffEmail = window.userData?.email || '';
    const staffRole = window.userData?.role || '';
    
    const modal = document.createElement('div');
    modal.id = 'activity-log-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div class="bg-green-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold">👤 Management Profile</h2>
                    <p class="text-green-200 text-sm">${staffEmail}</p>
                </div>
                <button id="close-activity-log" class="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <div class="p-6">
                <div class="bg-green-50 rounded-xl p-4 mb-6">
                    <p class="font-bold text-green-800 text-lg">${staffName}</p>
                    <p class="text-green-700 capitalize">${staffRole}</p>
                    <p class="text-sm text-gray-500 mt-1">Logged in: ${new Date().toLocaleString()}</p>
                </div>
                <h3 class="font-bold text-gray-700 mb-3">Recent Actions</h3>
                <div id="activity-log-list" class="space-y-2 max-h-64 overflow-y-auto">
                    <p class="text-gray-400 text-sm text-center py-4">Loading activity log...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('close-activity-log').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    // Load activity log (single where clause — sort client-side to avoid composite index requirement)
    try {
        const snap = await getDocs(query(
            collection(db, 'management_activity'),
            where('userEmail', '==', staffEmail),
            limit(50)
        ));
        const logEl = document.getElementById('activity-log-list');
        if (!logEl) return;
        if (snap.empty) {
            logEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No recent activity found.</p>';
        } else {
            // Sort client-side by timestamp descending
            const sorted = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
                    const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
                    return tb - ta;
                })
                .slice(0, 20);
            logEl.innerHTML = sorted.map(a => {
                const date = a.timestamp?.toDate ? a.timestamp.toDate().toLocaleString() : '';
                return `
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p class="text-sm font-medium text-gray-700">${escapeHtml(a.action || 'Action')}</p>
                        <p class="text-xs text-gray-500">${escapeHtml(a.details || '')}</p>
                        <p class="text-xs text-gray-400 mt-1">${date}</p>
                    </div>
                `;
            }).join('');
        }
    } catch(e) {
        const logEl = document.getElementById('activity-log-list');
        if (logEl) logEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Activity log not available.</p>';
    }
}

window.showManagementActivityLog = showManagementActivityLog;

// ── Sidebar toggle (desktop collapse + mobile open) ───────────
function setupSidebarToggle() {
    const toggleBtn    = document.getElementById('toggleSidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const body         = document.body;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            const icon = toggleBtn.querySelector('i');
            icon.className = body.classList.contains('sidebar-collapsed')
                ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        });
    }
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
    }
    document.addEventListener('click', e => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
}

function getPermissionKey(navId) {
    return 'view' + navId.replace('nav','').replace(/([A-Z])/g, m => m.charAt(0).toUpperCase() + m.slice(1));
}

function updatePageTitle(title) {
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = title;
}

window.closeManagementModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
};

// ── App boot ──────────────────────────────────────────────────
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