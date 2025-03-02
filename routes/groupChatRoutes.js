// routes/groupChatRoutes.js
import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Get all messages for a given group
router.get("/:groupId", authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await pool.query(
      `SELECT group_messages.*, users.username
       FROM group_messages
       JOIN users ON group_messages.user_id = users.id
       WHERE group_id = $1
       ORDER BY group_messages.created_at ASC`,
      [groupId]
    );
    res.json(messages.rows);
  } catch (err) {
    console.error("❌ Error fetching group messages:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Post a new message to a group
router.post("/:groupId", authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId; // from JWT

    // Insert a new message
    const newMsg = await pool.query(
      `INSERT INTO group_messages (group_id, user_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [groupId, userId, message]
    );
    res.status(201).json({ message: "Message sent!", data: newMsg.rows[0] });
  } catch (err) {
    console.error("❌ Error posting group message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
