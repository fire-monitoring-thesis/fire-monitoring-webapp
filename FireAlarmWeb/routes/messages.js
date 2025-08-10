const express = require('express');
const router = express.Router();

// Store SSE connections
let sseConnections = [];

// Real-time message stream endpoint
router.get('/stream', (req, res) => {
  // Check authentication
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add connection to list
  const connection = {
    id: Date.now(),
    userId: req.session.user.id,
    username: req.session.user.username,
    res: res
  };
  sseConnections.push(connection);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to message stream' })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    sseConnections = sseConnections.filter(conn => conn.id !== connection.id);
  });
});

// Broadcast message to all connected clients
function broadcastMessage(messageData) {
  const eventData = JSON.stringify({
    type: 'new_message',
    data: messageData
  });

  sseConnections.forEach(connection => {
    try {
      connection.res.write(`data: ${eventData}\n\n`);
    } catch (err) {
      console.error('Error broadcasting to connection:', err);
    }
  });
}

// Broadcast typing indicator
function broadcastTyping(userId, username, isTyping) {
  const eventData = JSON.stringify({
    type: 'typing',
    data: { userId, username, isTyping }
  });

  sseConnections.forEach(connection => {
    if (connection.userId !== userId) { // Don't send to sender
      try {
        connection.res.write(`data: ${eventData}\n\n`);
      } catch (err) {
        console.error('Error broadcasting typing indicator:', err);
      }
    }
  });
}

// Get all messages with pagination
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  try {
    const result = await req.pool.query(`
      SELECT m.*, u.username, u.role,
             CASE WHEN m.user_id = $1 THEN true ELSE false END as is_own_message
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.session.user.id, limit, offset]);

    // Reverse to show oldest first
    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/', async (req, res) => {
  const { message, type = 'text' } = req.body;
  const userId = req.session.user.id;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
  }

  try {
    const result = await req.pool.query(
      'INSERT INTO messages (user_id, message, message_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, message.trim(), type]
    );

    // Get the complete message with username
    const messageWithUser = await req.pool.query(`
      SELECT m.*, u.username, u.role,
             CASE WHEN m.user_id = $1 THEN true ELSE false END as is_own_message
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.id = $2
    `, [userId, result.rows[0].id]);

    const newMessage = messageWithUser.rows[0];

    // Broadcast to all connected clients
    broadcastMessage(newMessage);

    res.json(newMessage);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Typing indicator endpoint
router.post('/typing', (req, res) => {
  const { isTyping } = req.body;
  const userId = req.session.user.id;
  const username = req.session.user.username;

  broadcastTyping(userId, username, isTyping);
  res.json({ success: true });
});

// Delete message (admin only or message owner)
router.delete('/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    // Check if user owns the message or is admin
    const messageCheck = await req.pool.query(
      'SELECT user_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageOwnerId = messageCheck.rows[0].user_id;
    const canDelete = (messageOwnerId === userId) || (userRole === 'admin');

    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await req.pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    // Broadcast deletion to all clients
    const eventData = JSON.stringify({
      type: 'message_deleted',
      data: { messageId }
    });

    sseConnections.forEach(connection => {
      try {
        connection.res.write(`data: ${eventData}\n\n`);
      } catch (err) {
        console.error('Error broadcasting message deletion:', err);
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get online users count
router.get('/online', (req, res) => {
  const uniqueUsers = [...new Set(sseConnections.map(conn => conn.userId))];
  res.json({ 
    count: uniqueUsers.length,
    users: sseConnections.map(conn => ({ 
      username: conn.username, 
      userId: conn.userId 
    })).filter((user, index, self) => 
      index === self.findIndex(u => u.userId === user.userId)
    )
  });
});

module.exports = router;