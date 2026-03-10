require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const logger = require('./middleware/logger');

// Routes
const authRoutes = require('./routes/auth');
const disasterRoutes = require('./routes/disasters');
const notificationRoutes = require('./routes/notifications');
const resourceRoutes = require('./routes/resources');
const requestRoutes = require('./routes/requests');
const volunteerRoutes = require('./routes/volunteers');
const allocationRoutes = require('./routes/allocation');
const emergencyRoutes = require('./routes/emergency');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Make io accessible in controllers
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        socket.userId = userId; // Store userId on socket for easier lookup
        console.log(`👤 User ${userId} joined room user_${userId}`);
    });

    // Handle live location updates
    socket.on('location_update', (data) => {
        const { userId, latitude, longitude } = data;
        if (!userId || latitude === undefined || longitude === undefined) return;

        try {
            const db = require('./config/db');
            // Update user coordinates in DB
            db.prepare('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?')
                .run(latitude, longitude, userId);

            // Get user info for broadcasting
            const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId);

            if (user) {
                // Broadcast to everyone else (or specific rooms if needed)
                socket.broadcast.emit('user_location_updated', {
                    userId: user.id,
                    name: user.name,
                    role: user.role,
                    latitude,
                    longitude,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('[Socket] Location update error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Swagger ─────────────────────────────────────────────────────────────────
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ReliefSync Pro API',
            version: '1.0.0',
            description: 'Geo-Alert Disaster Management System API',
        },
        servers: [{ url: `http://localhost:${process.env.PORT || 5000}` }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./routes/*.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/allocate', allocationRoutes);

// Emergency / Safety Hub routes (weather, SOS, hospitals, safe zones, live location)
app.use('/api', emergencyRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'ReliefSync Pro API' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 ReliefSync Pro API running on http://localhost:${PORT}`);
    console.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
});

module.exports = { app, server, io };
