import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Create a new study group
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.userId;

        const newGroup = await pool.query(
            "INSERT INTO study_groups (name, created_by) VALUES ($1, $2) RETURNING *",
            [name, userId]
        );

        res.status(201).json({ message: "Study group created!", group: newGroup.rows[0] });
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// ✅ Get all study groups
router.get("/", async (req, res) => {
    try {
        const groups = await pool.query("SELECT * FROM study_groups ORDER BY created_at DESC");
        res.json(groups.rows);
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Join a study group (no database action needed for now)
router.post("/:groupId/join", authMiddleware, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.userId;

        // ✅ Check if group exists
        const groupExists = await pool.query("SELECT * FROM study_groups WHERE id = $1", [groupId]);
        if (groupExists.rows.length === 0) {
            return res.status(404).json({ message: "Study group not found" });
        }

        res.json({ message: `Joined study group ${groupExists.rows[0].name}!` });
    } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
