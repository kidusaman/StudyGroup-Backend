import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Get all notifications for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const notifications = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    res.json(notifications.rows);
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});
// ✅ Get Unread Notification Count
router.get("/count", authMiddleware, async (req, res) => {
  try {
      const userId = req.user.userId;

      // Count unread notifications
      const unreadCount = await pool.query(
          "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
          [userId]
      );

      res.json({ unread_count: parseInt(unreadCount.rows[0].count) });
  } catch (err) {
      console.error("❌ Database error:", err);
      res.status(500).json({ message: "Server error" });
  }
});

// ✅ Mark a notification as read
router.post("/:notificationId/read", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    console.log(`✅ Marking notification ${notificationId} as read for user ${userId}`);

    const updatedNotification = await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [notificationId, userId]
    );

    console.log("✅ Updated Notification:", updatedNotification.rows);

    if (updatedNotification.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found or does not belong to user" });
    }

    res.json({ message: "Notification marked as read", notification: updatedNotification.rows[0] });
  } catch (err) {
    console.error("❌ Error marking notification as read:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;