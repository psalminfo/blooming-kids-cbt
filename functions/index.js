'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();

// ============================================================
//  ROLE MAP
// ============================================================
const ROLE_MAP = {
  'tutors':       'tutor',
  'staff':        'staff',
  'parent_users': 'parent',
  'users':        'admin',
};

function findUid(data) {
  const fields = [
    'uid', 'userId', 'id', 'firebaseUid',
    'authUid', 'user_id', 'userUID', 'firebase_uid',
  ];
  for (const f of fields) {
    if (data[f] && typeof data[f] === 'string' && data[f].length > 0) {
      return data[f];
    }
  }
  return null;
}

// ============================================================
//  AUTO ROLE STAMPER
// ============================================================
Object.entries(ROLE_MAP).forEach(([collection, role]) => {
  exports[`assignRole_${collection}`] = functions.firestore
    .document(`${collection}/{docId}`)
    .onCreate(async (snap, context) => {
      const data = snap.data();
      const uid  = findUid(data);
      if (!uid) {
        console.warn(`[assignRole_${collection}] No UID found in doc: ${context.params.docId}`);
        return null;
      }
      try {
        await admin.auth().getUser(uid);
        await admin.auth().setCustomUserClaims(uid, { role });
        await snap.ref.update({ role });
        console.log(`[assignRole_${collection}] Role '${role}' stamped on uid: ${uid}`);
        return null;
      } catch (err) {
        console.error(`[assignRole_${collection}] Failed for uid: ${uid} — ${err.message}`);
        return null;
      }
    });
});

// ============================================================
//  MANUAL ROLE OVERRIDE
// ============================================================
exports.manualSetRole = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied', 'Only admins can assign roles.'
    );
  }
  const { uid, role } = data;
  const allowedRoles  = ['admin', 'staff', 'tutor', 'parent'];
  if (!uid || !role || !allowedRoles.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `uid and role are required. Allowed roles: ${allowedRoles.join(', ')}`
    );
  }
  await admin.auth().setCustomUserClaims(uid, { role });
  await admin.firestore().collection('users').doc(uid).update({ role }).catch(() => {});
  console.log(`[manualSetRole] Set role '${role}' on uid: ${uid}`);
  return { success: true, uid, role };
});
