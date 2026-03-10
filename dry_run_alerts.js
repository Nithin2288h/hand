const AlertNotificationService = require('./services/AlertNotificationService');
const db = require('./config/db');

const disaster = {
    id: 999,
    name: 'MANUAL TEST DISASTER',
    type: 'Fire',
    severity: 'High',
    latitude: 13.0827,
    longitude: 80.2707,
    radius_km: 50
};

console.log("Triggering manual alerts...");
AlertNotificationService.sendDisasterAlerts(disaster).then(() => {
    console.log("Alerts sent (Initial)");
}).catch(err => {
    console.error("Alert Error:", err);
});
