import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Send a private message
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { receiver_id, message } = req.body;
        const sender_id = req.user.userId;

        if (!receiver_id || !message) {
            return res.status(400).json({ message: "Receiver ID and message are required." });
        }

        const newMessage = await pool.query(
            "INSERT INTO private_messages (sender_id, receiver_id, recipient_id, message, is_read, created_at) VALUES ($1, $2, $2, $3, FALSE, NOW()) RETURNING *",
            [sender_id, receiver_id, message]
        );

        res.status(201).json({ message: "Message sent successfully!", data: newMessage.rows[0] });
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Endpoint to fetch conversation partners for the logged-in user
router.get("/conversations", authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    console.log("Conversations endpoint hit. userId:", userId);
  
    try {
      const result = await pool.query(
        `
        SELECT DISTINCT 
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END AS conversation_partner
        FROM private_messages
        WHERE sender_id = $1 OR receiver_id = $1
        `,
        [userId]
      );
      console.log("Query result:", result.rows);
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      res.status(500).json({ message: "Server error" });
    }
});
  
// ✅ Get private messages between two users
router.get("/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.userId;

        const messages = await pool.query(
            `SELECT * FROM private_messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1) 
            ORDER BY created_at ASC`,
            [currentUserId, userId]
        );

        res.json(messages.rows);
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Mark a private message as read
router.post("/:messageId/read", authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        const updatedMessage = await pool.query(
            "UPDATE private_messages SET is_read = TRUE WHERE id = $1 AND receiver_id = $2 RETURNING *",
            [messageId, userId]
        );

        if (updatedMessage.rows.length === 0) {
            return res.status(400).json({ message: "Message not found or unauthorized." });
        }

        res.json({ message: "Message marked as read.", data: updatedMessage.rows[0] });
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
