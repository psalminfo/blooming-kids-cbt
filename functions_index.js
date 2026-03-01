'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();


// ============================================================
//  ROLE MAP
//  Which collection → which role gets stamped automatically
//  Add more lines here as your app grows
// ============================================================
const ROLE_MAP = {
  'tutors':       'tutor',
  'staff':        'staff',
  'parent_users': 'parent',
  'users':        'admin',
};


// ============================================================
//  UID FINDER
//  Tries every possible field name your documents might use
// ============================================================
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
//  Fires automatically when a new document is created in any
//  of the collections in ROLE_MAP. No auth page edits needed.
// ============================================================
Object.entries(ROLE_MAP).forEach(([collection, role]) => {

  exports[`assignRole_${collection}`] = functions.firestore
    .document(`${collection}/{docId}`)
    .onCreate(async (snap, context) => {

      const data = snap.data();
      const uid  = findUid(data);

      if (!uid) {
        console.warn(
          `[assignRole_${collection}] No UID found in doc: ${context.params.docId}`,
          `| Fields present: ${Object.keys(data).join(', ')}`
        );
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
//  Call from your Admin Portal to promote or demote any user.
//
//  Usage in your admin portal JS:
//    const setRole = firebase.functions().httpsCallable('manualSetRole');
//    await setRole({ uid: 'THE_USER_UID', role: 'staff' });
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


// ============================================================
//  BACKFILL — STAMPS ROLES ON ALL YOUR EXISTING USERS
//
//  After deploying visit this URL once in your browser:
//  https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/backfillRoles?secret=blooming-kids-backfill-2024
//
//  It shows a JSON result of every user stamped.
//  After it runs successfully, delete this entire block
//  and push to GitHub again. You only need it once.
// ============================================================
exports.backfillRoles = functions.https.onRequest(async (req, res) => {

  const SECRET = 'blooming-kids-backfill-2024';

  if (req.query.secret !== SECRET) {
    res.status(403).send('Forbidden');
    return;
  }

  const db      = admin.firestore();
  const results = [];

  for (const [collection, role] of Object.entries(ROLE_MAP)) {
    try {
      const snapshot = await db.collection(collection).get();
      for (const doc of snapshot.docs) {
        const uid = findUid(doc.data());
        if (!uid) {
          results.push({ collection, docId: doc.id, status: 'skipped — no uid field' });
          continue;
        }
        try {
          await admin.auth().setCustomUserClaims(uid, { role });
          await doc.ref.update({ role });
          results.push({ collection, uid, role, status: 'done' });
        } catch (err) {
          results.push({ collection, uid, status: `failed: ${err.message}` });
        }
      }
    } catch (err) {
      results.push({ collection, status: `collection error: ${err.message}` });
    }
  }

  res.json({ total: results.length, results });

});
