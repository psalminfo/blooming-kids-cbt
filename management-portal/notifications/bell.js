// ============================================================
// notifications/bell.js
// Notification bell — real-time badge and dropdown panel.
// ============================================================

import { db } from '../core/firebase.js';
import {
         Timestamp, addDoc, collection, doc,
         getDocs, limit, onSnapshot, orderBy,
         query, updateDoc, where, writeBatch
    } from '../core/firebase.js';
import { escapeHtml, sanitizeInput } from '../core/utils.js';

export async function createManagementNotification(type, title, message, extraData = {}) {
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

export async function initManagementNotifications() {
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
