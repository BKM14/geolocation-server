require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'driver-safety.log' })
  ]
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  username: process.env.REDIS_USERNAME || '',
  password: process.env.REDIS_PASSWORD || '',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

const REDIS_KEY_DRIVERS = 'drivers';
const NEARBY_DISTANCE = 500;

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('Connected to Redis successfully');
});

io.on('connection', (socket) => {
  let currentDriverId = null;

  socket.on('register', async ({ driverId }) => {
    try {
      if (!driverId) {
        throw new Error('Driver ID is required');
      }

      currentDriverId = driverId;
      socket.join(driverId);

      logger.info(`Driver registered: ${driverId}`);
      socket.emit('registered', { success: true, driverId });
    } catch (error) {
      logger.error('Registration error:', error);
      socket.emit('registered', { success: false, error: error.message });
    }
  });

  socket.on('update_location', async ({ driverId, latitude, longitude }) => {
    try {
      if (!driverId || !latitude || !longitude) {
        throw new Error('Invalid location update data');
      }

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Invalid coordinates');
      }

      console.log({ longitude, latitude, driverId });
      await redis.geoadd(REDIS_KEY_DRIVERS, longitude, latitude, driverId);

      logger.info(`Location updated for driver ${driverId}: ${latitude}, ${longitude}`);
    } catch (error) {
      logger.error(`Location update error for driver ${driverId}:`, error);
      socket.emit('error', { type: 'location_update', message: error.message });
    }
  });

  socket.on('drowsy_alert', async ({ driverId, latitude, longitude, alertType }) => {
    try {
      if (!driverId || !latitude || !longitude || !alertType) {
        throw new Error('Invalid drowsy alert data');
      }

      await redis.geoadd(REDIS_KEY_DRIVERS, longitude, latitude, driverId);

      const nearbyDrivers = await redis.georadius(
        REDIS_KEY_DRIVERS,
        longitude,
        latitude,
        NEARBY_DISTANCE,
        'm',
        'WITHCOORD'
      );

      const alertData = {
        alertingDriver: driverId,
        location: { latitude, longitude },
        alertType,
        timestamp: new Date().toISOString()
      };

      for (const driver of nearbyDrivers) {
        const targetDriverId = driver[0];
        if (targetDriverId !== driverId) {
          io.to(targetDriverId).emit('nearby_alert', alertData);
          logger.info(`Alert sent to nearby driver ${targetDriverId}`);
        }
      }

      logger.info(`Drowsy alert processed from driver ${driverId}, notified ${nearbyDrivers.length - 1} nearby drivers`);
    } catch (error) {
      logger.error(`Drowsy alert error for driver ${driverId}:`, error);
      socket.emit('error', { type: 'drowsy_alert', message: error.message });
    }
  });

  // Handle disconnections
  socket.on('disconnect', async () => {
    if (currentDriverId) {
      try {
        // Remove driver from Redis when they disconnect
        await redis.zrem(REDIS_KEY_DRIVERS, currentDriverId);
        logger.info(`Driver disconnected and removed: ${currentDriverId}`);
      } catch (error) {
        logger.error(`Error removing disconnected driver ${currentDriverId}:`, error);
      }
    }
  });
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Driver Safety Backend Agent running on port ${PORT}`);
});

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await redis.quit();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});