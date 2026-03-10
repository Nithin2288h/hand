const path = require('path');
const db = require('../config/db');

let admin;
let messaging;
let initialized = false;

/**
 * Lazily initializes Firebase Admin SDK.
 * If the service account file is missing, FCM is disabled gracefully.
 */
const initFirebase = () => {
    if (initialized) return initialized;

    try {
        const serviceAccountPath = path.join(__dirname, '..', 'config', 'message-for-hand-firebase-adminsdk-fbsvc-53ee8e107a.json');
        const fs = require('fs');

        if (!fs.existsSync(serviceAccountPath)) {
            console.warn('[FCM] ⚠️  firebase-service-account.json not found. Push notifications disabled.');
            console.warn('[FCM]    → Download it from Firebase Console → Project Settings → Service Accounts');
            initialized = false;
            return false;
        }

        admin = require('firebase-admin');
        const serviceAccount = require(serviceAccountPath);

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }

        messaging = admin.messaging();
        initialized = true;
        console.log('[FCM] ✅ Firebase Admin SDK initialized');
        return true;
    } catch (err) {
        console.error('[FCM] ❌ Failed to initialize Firebase:', err.message);
        initialized = false;
        return false;
    }
};

/**
 * Send a push notification to ALL users who have a stored FCM token.
 * @param {string} title  - Notification title
 * @param {string} body   - Notification body
 * @param {object} data   - Extra data payload (key-value strings)
 */
const sendToAllUsers = async (title, body, data = {}) => {
    if (!initFirebase()) {
        console.warn('[FCM] Skipping push notification — Firebase not initialized.');
        return;
    }

    try {
        // Get all users with a stored FCM token
        const users = db.prepare('SELECT id, name, fcm_token FROM users WHERE fcm_token IS NOT NULL').all();

        if (users.length === 0) {
            console.log('[FCM] No users with FCM tokens found. Skipping.');
            return;
        }

        const tokens = users.map(u => u.fcm_token).filter(Boolean);

        if (tokens.length === 0) return;

        // Convert data values to strings (FCM requirement)
        const stringData = {};
        for (const [k, v] of Object.entries(data)) {
            stringData[k] = String(v);
        }

        const message = {
            notification: { title, body },
            data: stringData,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'disaster_alerts',
                    priority: 'max',
                    defaultVibrateTimings: true,
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
            tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`[FCM] ✅ Sent to ${response.successCount}/${tokens.length} devices. Failures: ${response.failureCount}`);

        // Clean up stale tokens (e.g. uninstalled apps)
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const failedToken = tokens[idx];
                    console.warn(`[FCM] Stale token detected, removing: ${failedToken.substring(0, 20)}...`);
                    db.prepare('UPDATE users SET fcm_token = NULL WHERE fcm_token = ?').run(failedToken);
                }
            });
        }

        return response;
    } catch (err) {
        console.error('[FCM] Error sending notification:', err.message);
    }
};

/**
 * Send a push notification to a single user by userId.
 */
const sendToUser = async (userId, title, body, data = {}) => {
    if (!initFirebase()) return;

    try {
        const user = db.prepare('SELECT fcm_token FROM users WHERE id = ?').get(userId);
        if (!user || !user.fcm_token) return;

        const stringData = {};
        for (const [k, v] of Object.entries(data)) {
            stringData[k] = String(v);
        }

        await messaging.send({
            token: user.fcm_token,
            notification: { title, body },
            data: stringData,
            android: { priority: 'high' },
        });

        console.log(`[FCM] ✅ Sent to user ${userId}`);
    } catch (err) {
        console.error(`[FCM] Error sending to user ${userId}:`, err.message);
    }
};

module.exports = { sendToAllUsers, sendToUser };
