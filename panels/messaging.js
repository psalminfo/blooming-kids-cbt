// ============================================================
// panels/messaging.js
// Management messaging and broadcast panel
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

// SECTION: MANAGEMENT MESSAGING PANEL
// ======================================================

export async function renderManagementMessagingPanel(container) {
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
