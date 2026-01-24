/**
 * Socket.IO Server for Realtime Game Communication
 * 
 * Handles:
 * - Session connections
 * - Location updates
 * - Hex claiming
 * - Team score updates
 * - Team chat messages
 * - Event broadcasting
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { createClient } = require('redis');

require('dotenv').config();

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hexgame',
  user: process.env.DB_USER || 'hexgame',
  password: process.env.DB_PASSWORD || 'hexgame',
});

// Redis client for pub/sub
const redisClient = createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

// Redis subscriber for cross-instance communication
const redisSubscriber = redisClient.duplicate();
redisSubscriber.connect().catch(console.error);

// JWT secret (should match Django's SECRET_KEY or JWT secret)
const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'dev-secret-key';

// Middleware: Socket authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.user_id;
    socket.username = decoded.username;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Helper function: Get participant from database
async function getParticipant(sessionId, userId) {
  const query = `
    SELECT p.*, u.username, u.email
    FROM participants p
    JOIN users u ON p.user_id = u.id
    WHERE p.session_id = $1 AND p.user_id = $2
  `;
  const result = await pool.query(query, [sessionId, userId]);
  return result.rows[0];
}

// Helper function: Get session from database
async function getSession(sessionId) {
  const query = 'SELECT * FROM sessions WHERE id = $1';
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}

// Helper function: Broadcast to Redis (for multi-instance support)
async function broadcastToRedis(channel, data) {
  await redisClient.publish(channel, JSON.stringify(data));
}

// Socket connection handler
io.on('connection', async (socket) => {
  console.log(`Client connected: ${socket.id} (User: ${socket.username})`);

  let currentSessionId = null;
  let currentParticipant = null;

  // Join session
  socket.on('join_session', async (data) => {
    try {
      const { session_id } = data;
      currentSessionId = session_id;

      // Verify session exists
      const session = await getSession(session_id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Get participant
      const participant = await getParticipant(session_id, socket.userId);
      if (!participant) {
        socket.emit('error', { message: 'Not a participant in this session' });
        return;
      }

      currentParticipant = participant;

      // Join session room
      const roomName = `session_${session_id}`;
      socket.join(roomName);

      // Join team chat room if team exists
      if (participant.team_id) {
        const teamRoomName = `team_${participant.team_id}`;
        socket.join(teamRoomName);
        socket.currentTeamId = participant.team_id;
      }

      // Notify others
      socket.to(roomName).emit('participant_joined', {
        participant_id: participant.id,
        user: {
          id: socket.userId,
          username: socket.username
        },
        team_id: participant.team_id,
        timestamp: new Date().toISOString()
      });

      // Send confirmation
      socket.emit('connection_established', {
        session_id: session_id,
        participant_id: participant.id,
        status: 'connected'
      });

      console.log(`User ${socket.username} joined session ${session_id}`);
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit('error', { message: 'Failed to join session' });
    }
  });

  // Location update
  socket.on('loc', async (data) => {
    try {
      if (!currentSessionId || !currentParticipant) {
        socket.emit('error', { message: 'Not in a session' });
        return;
      }

      const { lat, lng, accuracy, speed, timestamp } = data;

      // Update participant location in database
      const updateQuery = `
        UPDATE participants
        SET last_lat = $1, last_lng = $2, last_location_at = $3
        WHERE id = $4
      `;
      await pool.query(updateQuery, [lat, lng, new Date(), currentParticipant.id]);

      // Broadcast location update to room
      const roomName = `session_${currentSessionId}`;
      socket.to(roomName).emit('location_update', {
        participant_id: currentParticipant.id,
        lat,
        lng,
        accuracy,
        speed,
        timestamp: timestamp || new Date().toISOString()
      });

      // TODO: Hex claiming logic (can call Django API or implement here)
      // For now, we'll just broadcast the location
    } catch (error) {
      console.error('Error handling location update:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Team chat message
  socket.on('team_chat', async (data) => {
    try {
      if (!currentSessionId || !currentParticipant) {
        socket.emit('error', { message: 'Not in a session' });
        return;
      }

      const { message, team_id } = data;

      if (!message || message.trim().length === 0) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (message.length > 500) {
        socket.emit('error', { message: 'Message too long (max 500 characters)' });
        return;
      }

      // Use provided team_id or current participant's team
      const targetTeamId = team_id || currentParticipant.team_id;

      if (!targetTeamId) {
        socket.emit('error', { message: 'No team assigned' });
        return;
      }

      // Verify participant is in this team
      if (currentParticipant.team_id !== targetTeamId) {
        socket.emit('error', { message: 'Not a member of this team' });
        return;
      }

      // Save message to database
      const insertQuery = `
        INSERT INTO chat_messages (id, session_id, team_id, participant_id, message, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
        RETURNING id, created_at
      `;
      const result = await pool.query(insertQuery, [
        currentSessionId,
        targetTeamId,
        currentParticipant.id,
        message.trim()
      ]);

      const chatMessage = {
        id: result.rows[0].id,
        session_id: currentSessionId,
        team_id: targetTeamId,
        participant: {
          id: currentParticipant.id,
          user: {
            id: socket.userId,
            username: socket.username
          }
        },
        message: message.trim(),
        created_at: result.rows[0].created_at
      };

      // Broadcast to team chat room
      const teamRoomName = `team_${targetTeamId}`;
      io.to(teamRoomName).emit('team_chat_message', chatMessage);

      console.log(`Team chat from ${socket.username} in team ${targetTeamId}: ${message}`);
    } catch (error) {
      console.error('Error handling team chat:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Leave session
  socket.on('leave_session', async () => {
    try {
      if (currentSessionId) {
        const roomName = `session_${currentSessionId}`;
        
        // Leave team room if joined
        if (socket.currentTeamId) {
          const teamRoomName = `team_${socket.currentTeamId}`;
          socket.leave(teamRoomName);
        }
        
        // Notify others
        socket.to(roomName).emit('participant_left', {
          participant_id: currentParticipant?.id,
          timestamp: new Date().toISOString()
        });

        socket.leave(roomName);
        currentSessionId = null;
        currentParticipant = null;
        socket.currentTeamId = null;
      }
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    try {
      if (currentSessionId && currentParticipant) {
        const roomName = `session_${currentSessionId}`;
        socket.to(roomName).emit('participant_left', {
          participant_id: currentParticipant.id,
          timestamp: new Date().toISOString()
        });
      }
      console.log(`Client disconnected: ${socket.id}`);
    } catch (error) {
      console.error('Error on disconnect:', error);
    }
  });

  // Error handler
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Redis subscriber for cross-instance events
redisSubscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    const { event_type, session_id, payload } = data;

    // Broadcast to all sockets in the session room
    const roomName = `session_${session_id}`;
    
    switch (event_type) {
      case 'claim_hex':
        io.to(roomName).emit('claim_hex', payload);
        break;
      case 'loop_complete':
        io.to(roomName).emit('loop_complete', payload);
        break;
      case 'score_update':
        io.to(roomName).emit('score_update', payload);
        break;
      case 'match_end':
        io.to(roomName).emit('match_end', payload);
        break;
      case 'team_chat':
        // Team chat is already handled in socket.on('team_chat')
        // This is for cross-instance broadcasting if needed
        if (payload.team_id) {
          const teamRoomName = `team_${payload.team_id}`;
          io.to(teamRoomName).emit('team_chat_message', payload);
        }
        break;
    }
  } catch (error) {
    console.error('Error processing Redis message:', error);
  }
});

// Subscribe to session events
redisSubscriber.subscribe('session_events', (err) => {
  if (err) {
    console.error('Error subscribing to Redis:', err);
  } else {
    console.log('Subscribed to Redis channel: session_events');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'socketio' });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.IO server running on port ${PORT}`);
  console.log(`Path: /socket.io/`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  await redisClient.quit();
  await redisSubscriber.quit();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

