// routes/questionsRoutes.js
import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Post a Question (Protected)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, body, tags } = req.body;
    const userId = req.user.userId;

    const newQuestion = await pool.query(
      `INSERT INTO questions (user_id, title, body, tags, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, title, body, tags]
    );

    res.status(201).json(newQuestion.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Search & Filter Questions (Enhanced)
router.get("/search", async (req, res) => {
  try {
    const { query, tag } = req.query;
    let sql = "SELECT * FROM questions WHERE 1=1";
    let params = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` AND (title ILIKE $${params.length} OR body ILIKE $${params.length})`;
    }

    if (tag) {
      params.push(tag);
      sql += ` AND $${params.length} = ANY(tags)`;
    }

    // Sort by created_at DESC (since we removed question upvotes)
    sql += " ORDER BY created_at DESC";

    const results = await pool.query(sql, params);
    res.json(results.rows);
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get a Single Question by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM questions WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching single question:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get All Questions (this should come last so that "/:id" routes are not overridden)
// Example in routes/questionsRoutes.js
router.get("/", async (req, res) => {
  try {
    const questions = await pool.query(
      `SELECT questions.*, users.username 
       FROM questions 
       JOIN users ON questions.user_id = users.id 
       ORDER BY questions.created_at DESC`
    );
    res.json(questions.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
