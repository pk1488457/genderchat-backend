import express from 'express';
import Message from '../models/Message.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get messages for a room
router.get('/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 100 } = req.query;

    // Verify user has access to room
    const hasAccess = checkRoomAccess(req.user.gender, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this room' });
    }

    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Send a message
router.post('/', authenticate, async (req, res) => {
  try {
    const { roomId, content } = req.body;

    // Verify user has access to room
    const hasAccess = checkRoomAccess(req.user.gender, roomId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this room' });
    }

    const message = new Message({
      roomId,
      senderId: req.user._id,
      senderName: req.user.name,
      content
    });

    await message.save();
    res.status(201).json({ message });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function checkRoomAccess(userGender, roomId) {
  const commonRooms = ['introvert', 'extrovert'];
  if (commonRooms.includes(roomId)) return true;
  if (roomId === 'male' && userGender === 'male') return true;
  if (roomId === 'female' && userGender === 'female') return true;
  return false;
}

export default router;