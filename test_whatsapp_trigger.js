const http = require('http');

const loginData = JSON.stringify({
    email: 'admin@reliefsync.com',
    password: 'admin123'
});

const reqLogin = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
    }
}, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
        const { token } = JSON.parse(body);

        if (!token) {
            console.error("Login failed");
            return;
        }

        const disasterData = JSON.stringify({
            name: 'WHATSAPP TEST: Monsoon Flood',
            type: 'Flood',
            severity: 'High',
            location: 'Chennai Central',
            latitude: 13.0827,
            longitude: 80.2707,
            radius_km: 10
        });

        const reqD = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/disasters',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(disasterData),
                'Authorization': `Bearer ${token}`
            }
        }, (resD) => {
            let bodyD = '';
            resD.on('data', (c) => bodyD += c);
            resD.on('end', () => {
                console.log("Trigger Status:", resD.statusCode);
                console.log("Trigger Response:", bodyD);
            });
        });
        reqD.write(disasterData);
        reqD.end();
    });
});
reqLogin.write(loginData);
reqLogin.end();
