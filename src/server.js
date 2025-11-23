import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/message.js';
import Message from './models/Message.js';
import jwt from 'jsonwebtoken';
import { authLimiter, messageLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';


dotenv.config();

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
app.use('/api/auth/register', authLimiter);
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
    console.log(`📊 Room ${roomId} now has ${io.sockets.adapter.rooms.get(roomId)?.size || 0} users`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`👋 User ${socket.userId} left room: ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      console.log('📨 Received message from', socket.userId, ':', data);
      const { roomId, content, senderName } = data;

      const message = new Message({
        roomId,
        senderId: socket.userId,
        senderName,
        content
      });

      await message.save();
      console.log('💾 Message saved to database:', message._id);

      // Broadcast to room INCLUDING sender
      const messageObj = message.toObject();
      io.to(roomId).emit('new-message', messageObj);
      console.log('📢 Message broadcasted to room:', roomId);
      console.log('👥 Number of clients in room:', io.sockets.adapter.rooms.get(roomId)?.size || 0);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.userId);
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });