const db = require('../config/db');

/**
 * Multi-channel notification service for volunteers
 */
class MultiChannelNotificationService {
    /**
     * Main entry point to notify users based on distance and role
     */
    static async notifyUser(user, disaster, distance, io) {
        try {
            console.log(`[NotificationEngine] Processing ${user.role}: ${user.name} (Distance: ${Math.round(distance)}km)`);

            // 1. Initial Alert (Everyone: NGO, Citizen, Volunteer)
            await this.sendEmail(user, disaster, `URGENT: ${disaster.name} Alert`);
            await this.sendWhatsApp(user, disaster, `URGENT: ${disaster.name} Alert`);

            // 2. Specialized Volunteer Logic (Follow-up)
            if (user.role === 'volunteer' && distance <= 50) {
                console.log(`[Scheduler] 15-minute follow-up scheduled for volunteer: ${user.name}`);
                this.scheduleFollowUp(user, disaster, 15, io);
            }
        } catch (err) {
            console.error(`Error notifying user ${user.id}:`, err.message);
        }
    }

    static async sendEmail(volunteer, disaster, subject) {
        console.log(`[EMAIL SEND] To: ${volunteer.email} | Subject: ${subject} | Message: ${disaster.name} alert!`);
        this.logToDB(volunteer.id, disaster.id, 'Email', subject);
    }

    static async sendSMS(volunteer, disaster, subject) {
        console.log(`[SMS SEND] To: ${volunteer.phone} | Msg: ${subject}: ${disaster.name} is occurring within 50km.`);
        this.logToDB(volunteer.id, disaster.id, 'SMS', subject);
    }

    static async sendWhatsApp(volunteer, disaster, subject) {
        console.log(`[WHATSAPP SEND] To: ${volunteer.phone} | Msg: ${subject}: Disaster ${disaster.name} reported at 100km range.`);
        this.logToDB(volunteer.id, disaster.id, 'WhatsApp', subject);
    }

    static scheduleFollowUp(volunteer, disaster, minutes, io) {
        console.log(`[Scheduler] Follow-up for ${volunteer.name} scheduled in ${minutes} minutes.`);

        // We use setTimeout for simplicity in this demo environment. 
        // In production, use a job queue like Bull or Agenda.
        const ms = minutes * 60 * 1000;

        setTimeout(async () => {
            console.log(`[Follow-up] 15-minute follow-up triggered for: ${volunteer.name}`);
            await this.sendEmail(volunteer, disaster, "FOLLOW-UP: URGENT DISASTER ALERT");
            await this.sendWhatsApp(volunteer, disaster, "FOLLOW-UP: URGENT DISASTER ALERT");

            // Optionally notify via Socket.io too
            if (io) {
                io.to(`user_${volunteer.id}`).emit('notification', {
                    notification: {
                        message: "⚠️ SECONDARY ALERT: Emergency assistance still required in your area. Please respond if available.",
                        type: 'disaster_alert_followup',
                        created_at: new Date()
                    },
                    disaster
                });
            }
        }, ms);
    }

    static logToDB(userId, disasterId, channel, subject) {
        try {
            const message = `[${channel}] ${subject}`;
            db.prepare(
                `INSERT INTO notifications (user_id, disaster_id, type, message)
         VALUES (?, ?, ?, ?)`
            ).run(userId, disasterId, 'external_alert', message);
        } catch (e) {
            console.error("DB Log error:", e.message);
        }
    }
}

module.exports = MultiChannelNotificationService;
