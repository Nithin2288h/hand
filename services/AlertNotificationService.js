const twilio = require('twilio');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { haversineDistance } = require('../utils/haversine');

// Helper to get Twilio client lazily
function getTwilioClient() {
    let accountSid = process.env.TWILIO_ACCOUNT_SID;
    let authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;

    accountSid = accountSid.trim().replace(/^['"]|['"]$/g, '');
    authToken = authToken.trim().replace(/^['"]|['"]$/g, '');

    if (!accountSid.startsWith('AC') && !accountSid.startsWith('SK')) {
        console.warn('[AlertService] Invalid Twilio Account SID format. Mocking WhatsApp.');
        return null;
    }

    return twilio(accountSid, authToken);
}

// Helper to get Nodemailer transporter lazily
function getEmailTransporter() {
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) return null;
    return nodemailer.createTransport({
        service: emailService,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
}

/**
 * AlertNotificationService
 * Handles geo-targeted, role-based, multi-channel disaster alerts.
 */
class AlertNotificationService {
    /**
     * Main entry point to send alerts to all relevant users.
     */
    static async sendDisasterAlerts(disaster) {
        try {
            console.log(`[AlertService] Starting alerts for disaster: ${disaster.name}`);

            // Get all users with locations
            const users = db.prepare(
                'SELECT id, name, email, phone, role, latitude, longitude FROM users WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
            ).all();

            // Run notifications in parallel (don't await the entire loop sequentially)
            const notificationPromises = users.map(async (user) => {
                const distance = haversineDistance(
                    parseFloat(disaster.latitude),
                    parseFloat(disaster.longitude),
                    parseFloat(user.latitude),
                    parseFloat(user.longitude)
                );

                // Any user within default 100km or disaster radius
                const radius = disaster.radius_km || 100;
                if (distance <= radius) {
                    return this.processUserNotification(user, disaster, distance);
                }
            });

            // Wait for all initial notifications to be dispatched
            await Promise.all(notificationPromises);
            console.log(`[AlertService] All ${users.length} user notifications dispatched.`);
        } catch (error) {
            console.error('[AlertService] Error in sendDisasterAlerts:', error.message);
        }
    }

    /**
     * Process notification for a specific user.
     */
    static async processUserNotification(user, disaster, distance) {
        const message = this.getMessageTemplate(user, disaster, distance);

        // Initial Send
        await this.sendWhatsApp(user, message);
        await this.sendEmail(user, `DISASTER ALERT: ${disaster.name}`, message);

        // Repeat after 2 minutes if within 50km
        if (distance <= 50) {
            console.log(`[AlertService] Scheduling 2-minute repeat for ${user.name} (${user.role})`);
            setTimeout(async () => {
                console.log(`[AlertService] Repeating alert for ${user.name}`);
                await this.sendWhatsApp(user, `REPEAT: ${message}`);
                await this.sendEmail(user, `REPEAT DISASTER ALERT: ${disaster.name}`, message);
            }, 2 * 60 * 1000); // 2 minutes
        }
    }

    /**
     * Generate role-based message templates.
     */
    static getMessageTemplate(user, disaster, distance) {
        const base = `🚨 ALERT: ${disaster.name} (${disaster.type}) detected at ${disaster.location || 'your area'}. Severity: ${disaster.severity}. You are approximately ${Math.round(distance)}km away.`;

        switch (user.role) {
            case 'ngo':
                return `${base}\n\nATTENTION NGO: Please mobilize resources and emergency supplies immediately to assist in the affected area.`;
            case 'volunteer':
                return `${base}\n\nVOLUNTEER REQUEST: We need your assistance on the ground. Please report your availability in the app or head to the nearest relief center.`;
            case 'citizen':
                return `${base}\n\nSAFETY ALERT: Please stay indoors, secure your property, and follow all official safety protocols. Emergency services are being deployed.`;
            default:
                return base;
        }
    }

    /**
     * Sends WhatsApp message via Twilio.
     */
    static async sendWhatsApp(user, message) {
        console.log(`[AlertService] Preparing WhatsApp for ${user.name} (${user.phone})`);
        const client = getTwilioClient();
        if (!client) {
            console.log(`[MOCK WHATSAPP] To: ${user.phone} | Msg: ${message}`);
            return;
        }

        try {
            const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
            const contentSid = process.env.TWILIO_CONTENT_SID;

            const formattedFrom = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`;

            // SANITIZE PHONE: Remove hyphens, spaces, and other non-digits (keeping +)
            const cleanPhone = user.phone.replace(/[^\d+]/g, '');
            const to = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

            const messageOptions = {
                from: formattedFrom,
                to: to
            };

            // Use Content Template if SID is provided in .env
            if (contentSid) {
                console.log(`[AlertService] Using Twilio Content Template: ${contentSid}`);
                messageOptions.contentSid = contentSid;
                messageOptions.contentVariables = JSON.stringify({
                    "1": new Date().toLocaleDateString(),
                    "2": new Date().toLocaleTimeString()
                });
            } else {
                messageOptions.body = message;
            }

            const result = await client.messages.create(messageOptions);
            console.log(`[AlertService] WhatsApp sent to ${user.name} (${cleanPhone}) | SID: ${result.sid}`);
            this.logToDB(user.id, null, 'WhatsApp', message);
        } catch (error) {
            if (error.code === 63038 || error.status === 429) {
                console.error(`[AlertService] TWILIO LIMIT REACHED: Your account has exceeded its daily message limit. WhatsApp for ${user.name} failed.`);
            } else {
                console.error(`[AlertService] Twilio Error for ${user.name} (${user.phone}):`, error.message);
            }
        }
    }

    /**
     * Sends Email via Nodemailer.
     */
    static async sendEmail(user, subject, text) {
        const transporter = getEmailTransporter();
        if (!transporter) {
            console.log(`[MOCK EMAIL] To: ${user.email} | Subject: ${subject}`);
            this.logToDB(user.id, null, 'Email', subject);
            return;
        }

        try {
            await transporter.sendMail({
                from: `"HAND Disaster Alerts" <${emailUser}>`,
                to: user.email,
                subject: subject,
                text: text
            });
            console.log(`[AlertService] Email sent to ${user.name}`);
            this.logToDB(user.id, null, 'Email', subject);
        } catch (error) {
            console.error(`[AlertService] Nodemailer Error for ${user.name}:`, error.message);
        }
    }

    /**
     * Log external alerts to database
     */
    static logToDB(userId, disasterId, channel, message) {
        try {
            const fullMsg = `[${channel}] ${message}`;
            db.prepare(
                `INSERT INTO notifications (user_id, disaster_id, type, message)
                 VALUES (?, ?, ?, ?)`
            ).run(userId, disasterId, 'external_alert', fullMsg.substring(0, 255));
        } catch (e) {
            console.error("[AlertService] DB Log error:", e.message);
        }
    }
}

module.exports = AlertNotificationService;
