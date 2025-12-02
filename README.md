# Driver Safety Backend Agent

This is a Node.js backend agent for real-time driver safety monitoring. It handles driver location tracking and drowsy driver alerts using WebSocket communication and Redis geospatial features.

## Features

- Real-time driver location tracking
- Drowsy driver alert system
- Geospatial querying for nearby drivers
- WebSocket-based communication
- Redis geospatial index for efficient location queries

## Prerequisites

- Node.js 14+ installed
- Redis server running locally or accessible remotely
- npm or yarn package manager

## Installation

1. Install dependencies:
```bash
npm install
```

2. Ensure Redis is running locally or set environment variables:
```bash
REDIS_HOST=your-redis-host
REDIS_PORT=your-redis-port
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## WebSocket Events

### Client to Server

1. `register`
   - Payload: `{ driverId: string }`
   - Registers a driver in the system

2. `update_location`
   - Payload: `{ driverId: string, latitude: number, longitude: number }`
   - Updates driver's current location

3. `drowsy_alert`
   - Payload: `{ driverId: string, latitude: number, longitude: number, alertType: string }`
   - Sends a drowsy driver alert

### Server to Client

1. `registered`
   - Payload: `{ success: boolean, driverId?: string, error?: string }`
   - Confirmation of registration

2. `nearby_alert`
   - Payload: `{ alertingDriver: string, location: { latitude: number, longitude: number }, alertType: string, timestamp: string }`
   - Alert received when a nearby driver is drowsy

3. `error`
   - Payload: `{ type: string, message: string }`
   - Error notifications

## Environment Variables

- `PORT`: Server port (default: 3000)
- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)

## Logging

The system uses Winston for logging. Logs are written to:
- Console
- `driver-safety.log` file

## Error Handling

- Input validation for all events
- Redis connection error handling
- Graceful shutdown on SIGTERM
- Socket disconnection handling