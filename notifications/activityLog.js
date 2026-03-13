// ============================================================
// notifications/activityLog.js
// Writes and displays the management activity log.
// ============================================================

import { db } from '../core/firebase.js';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from '../core/firebase.js';
import { escapeHtml, sanitizeInput } from '../core/utils.js';

export async function logManagementActivity(action, details = '') {
    try {
        const userEmail = window.userData?.email;
        if (!userEmail) return;
        await addDoc(collection(db, 'management_activity'), {
            userEmail,
            userName: window.userData?.name || 'Unknown',
            action: sanitizeInput(action, 200),
            details: sanitizeInput(details, 500),
            timestamp: Timestamp.now()
        });
    } catch(e) { /* Non-critical, ignore */ }
}

export async function showManagementActivityLog() {
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
