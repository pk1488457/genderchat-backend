import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import Message from './models/Message.js';
import jwt from 'jsonwebtoken';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'GenderChat API is running' });
});

// Socket.IO for real-time chat
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    console.log('🔐 Socket auth attempt with token:', token ? 'present' : 'missing');

    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    console.log('✅ Socket authenticated for user:', socket.userId);
    next();
  } catch (error) {
    console.log('❌ Socket auth failed:', error.message);
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.userId);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`🚪 User ${socket.userId} joined room: ${roomId}`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`👋 User ${socket.userId} left room: ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      console.log('📨 Received message from', socket.userId);
      const { roomId, content, senderName } = data;

      const message = new Message({
        roomId,
        senderId: socket.userId,
        senderName,
        content
      });

      await message.save();
      console.log('💾 Message saved to database');

      // Broadcast to room
      io.to(roomId).emit('new-message', message.toObject());
      console.log('📢 Message broadcasted to room:', roomId);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.userId);
  });
});

// Check environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

console.log('🔍 Checking environment variables...');
console.log('PORT:', PORT);
console.log('MONGODB_URI:', MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('JWT_SECRET:', JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set!');
  console.error('Please add MONGODB_URI to your environment variables in Render dashboard');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET environment variable is not set!');
  console.error('Please add JWT_SECRET to your environment variables in Render dashboard');
  process.exit(1);
}

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });