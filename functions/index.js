/**
 * Firebase Cloud Functions: Custom Claims Sync
 *
 * Purpose (plain English):
 * - Your Storage rules rely on request.auth.token.adminId.
 * - Firebase Auth tokens do NOT automatically contain adminId.
 * - This function keeps a user's custom claims in sync with their Firestore profile.
 *
 * How it works:
 * - Whenever userProfiles/{uid} is created or updated, we copy adminId + role
 *   into Firebase Auth custom claims for that user.
 * - When a profile is deleted, we remove those claims.
 *
 * Important:
 * - Clients must refresh their token (logout/login) to receive updated claims.
 */

const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

function pickString(value) {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

exports.syncAuthClaimsFromUserProfile = functions.firestore
  .document("userProfiles/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;

    // If profile was deleted, clear claims
    if (!change.after.exists) {
      await admin.auth().setCustomUserClaims(uid, {});
      return;
    }

    const data = change.after.data() || {};
    const adminId = pickString(data.adminId);
    const role = pickString(data.role);

    // If there's no adminId, don't set it (keeps Storage locked down for that user)
    // You can choose to clear claims instead:
    // await admin.auth().setCustomUserClaims(uid, {});
    if (!adminId) {
      await admin.auth().setCustomUserClaims(uid, {});
      return;
    }

    // Keep claims minimal: only what's needed for access control
    const claims = { adminId };
    if (role) claims.role = role;

    await admin.auth().setCustomUserClaims(uid, claims);
  });

