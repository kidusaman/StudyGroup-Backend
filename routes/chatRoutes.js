import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Get messages for a study group
router.get("/:groupId", authMiddleware, async (req, res) => {
    try {
        const { groupId } = req.params;
        const messages = await pool.query(
            `SELECT chat_messages.*, users.username 
             FROM chat_messages 
             JOIN users ON chat_messages.user_id = users.id
             WHERE chat_messages.group_id = $1
             ORDER BY chat_messages.created_at ASC`,
            [groupId]
        );
        res.json(messages.rows);
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Post a new message
router.post("/:groupId", authMiddleware, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message } = req.body;
        const userId = req.user.userId; // Get user ID from JWT

        // ✅ Save message to database
        const newMessage = await pool.query(
            "INSERT INTO chat_messages (group_id, user_id, message, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
            [groupId, userId, message]
        );

        res.status(201).json({ message: "Message sent!", chat: newMessage.rows[0] });
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
