// server.js
import path from 'path';
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import questionsRoutes from "./routes/questionsRoutes.js";
import answersRoutes from "./routes/answersRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import studyGroupRoutes from "./routes/studyGroupRoutes.js";
import privateMessageRoutes from "./routes/privateMessageRoutes.js";
import groupChatRoutes from "./routes/groupChatRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
  },
});

// Middlewares
app.use(cors());
app.use(express.json());

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/answers", answersRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/study-groups", studyGroupRoutes);
app.use("/api/private-messages", privateMessageRoutes);
app.use("/api/group-chat", groupChatRoutes);

// Socket.io events
io.on("connection", (socket) => {
  console.log("🟢 A user connected:", socket.id);

  // Private Chat: Join private room by user id
  socket.on("joinPrivateChat", (userId) => {
    const room = `user-${userId}`;
    socket.join(room);
    console.log(`🔔 Socket ${socket.id} joined private chat: ${room}`);
  });

  // Handle sending private messages
  socket.on("sendPrivateMessage", async (data) => {
    const { senderId, recipientId, message } = data;
    try {
      // Fetch sender's username
      const userRes = await pool.query("SELECT username FROM users WHERE id = $1", [senderId]);
      if (userRes.rows.length === 0) {
        console.error("❌ Sender not found!");
        return;
      }
      const username = userRes.rows[0].username;

      // Save message in database
      const newMsg = await pool.query(
        "INSERT INTO private_messages (sender_id, receiver_id, recipient_id, message, created_at, is_read) VALUES ($1, $2, $3, $4, NOW(), FALSE) RETURNING *",
        [senderId, recipientId, recipientId, message]
      );
      const messageData = {
        id: newMsg.rows[0].id,
        sender_id: senderId,
        recipient_id: recipientId,
        message,
        created_at: newMsg.rows[0].created_at,
        username,
        is_read: false,
      };

      console.log(`📩 Private message from User ${senderId} to User ${recipientId}: ${message}`);
      // Emit message to the recipient's room
      io.to(`user-${recipientId}`).emit("receivePrivateMessage", messageData);
    } catch (err) {
      console.error("❌ Error sending private message:", err);
    }
  });

  // Group Chat: Join a group room
  socket.on("joinGroup", (groupId) => {
    const groupRoom = `group-${groupId}`;
    socket.join(groupRoom);
    console.log(`🔔 Socket ${socket.id} joined group room: ${groupRoom}`);
  });

  // Handle sending group messages
// Example snippet for your Socket.io "sendGroupMessage" event:
socket.on("sendGroupMessage", async (data) => {
  const { groupId, userId, message, localId } = data;
  try {
    // Save the message in the database (your query may differ)
    const newMsgResult = await pool.query(
      `INSERT INTO group_messages (group_id, user_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [groupId, userId, message]
    );
    const newMsg = newMsgResult.rows[0];

    // (Optional) Fetch the username if needed
    const userRes = await pool.query("SELECT username FROM users WHERE id = $1", [userId]);
    const username = userRes.rows[0].username;

    // Construct the message object, including the localId from the client
    const messageData = {
      ...newMsg,
      username,
      localId: localId || null // include localId if provided
    };

    // Emit the message to the group room
    io.to(`group-${groupId}`).emit("receiveGroupMessage", messageData);
    console.log(`📩 Group message in group-${groupId}: ${message}`);
  } catch (err) {
    console.error("❌ Error sending group message:", err);
  }
});


  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
  });
});

// Real-time notifications function
const sendNotification = async (userId, message, answerId) => {
  try {
    const newNotification = await pool.query(
      "INSERT INTO notifications (user_id, message, answer_id, is_read, created_at) VALUES ($1, $2, $3, FALSE, NOW()) RETURNING *",
      [userId, message, answerId]
    );
    io.to(`user-${userId}`).emit(`notification-${userId}`, newNotification.rows[0]);
  } catch (err) {
    console.error("❌ Error sending notification:", err);
  }
};
if (process.env.NODE_ENV === 'production') {
  // The build folder from your React app
  app.use(express.static(path.join(__dirname, 'build')));

  // Catch-all handler: send back index.html for any request that doesn't match your API routes.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

export { sendNotification, io };

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
