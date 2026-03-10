require('dotenv').config();
const AlertNotificationService = require('./services/AlertNotificationService');
const db = require('./config/db');

async function debugAlerts() {
    console.log("--- STARTING DIRECT SERVICE DEBUG ---");

    // Create a mock disaster
    const disaster = {
        name: 'DEBUG DISASTER',
        type: 'Fire',
        severity: 'Critical',
        latitude: 13.0827,
        longitude: 80.2707,
        radius_km: 100
    };

    console.log("Triggering sendDisasterAlerts...");
    try {
        await AlertNotificationService.sendDisasterAlerts(disaster);
        console.log("--- DIRECT SERVICE DEBUG FINISHED ---");
    } catch (err) {
        console.error("ERROR during service debug:", err);
    }
}

debugAlerts();
