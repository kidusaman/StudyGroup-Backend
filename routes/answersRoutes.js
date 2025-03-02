// routes/answersRoutes.js
import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendNotification } from "../server.js";

const router = express.Router();

// Toggle Upvote on an Answer
router.post("/:answerId/upvote", authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.userId;

    // Check if the user has already upvoted this answer
    const existingUpvote = await pool.query(
      "SELECT * FROM answer_upvotes WHERE user_id = $1 AND answer_id = $2",
      [userId, answerId]
    );
    // Check if the user has already downvoted this answer
    const existingDownvote = await pool.query(
      "SELECT * FROM answer_downvotes WHERE user_id = $1 AND answer_id = $2",
      [userId, answerId]
    );

    if (existingUpvote.rows.length > 0) {
      // Already upvoted; do nothing (vote remains)
      const currentAnswer = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
      return res.json({ message: "Already upvoted", answer: currentAnswer.rows[0] });
    } else if (existingDownvote.rows.length > 0) {
      // If a downvote exists, remove it and add an upvote.
      await pool.query(
        "DELETE FROM answer_downvotes WHERE user_id = $1 AND answer_id = $2",
        [userId, answerId]
      );
      // Switching from downvote to upvote means net change of +2 (from -1 to +1)
      const updatedAnswer = await pool.query(
        "UPDATE answers SET upvotes = upvotes + 2 WHERE id = $1 RETURNING *",
        [answerId]
      );
      await pool.query(
        "INSERT INTO answer_upvotes (user_id, answer_id) VALUES ($1, $2)",
        [userId, answerId]
      );
      return res.json({ message: "Switched vote to upvote", answer: updatedAnswer.rows[0] });
    } else {
      // No previous vote: add an upvote (net +1)
      await pool.query(
        "INSERT INTO answer_upvotes (user_id, answer_id) VALUES ($1, $2)",
        [userId, answerId]
      );
      const updatedAnswer = await pool.query(
        "UPDATE answers SET upvotes = upvotes + 1 WHERE id = $1 RETURNING *",
        [answerId]
      );
      return res.json({ message: "Upvote added", answer: updatedAnswer.rows[0] });
    }
  } catch (err) {
    console.error("❌ Database error in upvote:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle Downvote on an Answer
router.post("/:answerId/downvote", authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.userId;

    // Check if the user has already downvoted this answer
    const existingDownvote = await pool.query(
      "SELECT * FROM answer_downvotes WHERE user_id = $1 AND answer_id = $2",
      [userId, answerId]
    );
    // Check if the user has already upvoted this answer
    const existingUpvote = await pool.query(
      "SELECT * FROM answer_upvotes WHERE user_id = $1 AND answer_id = $2",
      [userId, answerId]
    );

    if (existingDownvote.rows.length > 0) {
      // Already downvoted; do nothing (vote remains)
      const currentAnswer = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
      return res.json({ message: "Already downvoted", answer: currentAnswer.rows[0] });
    } else if (existingUpvote.rows.length > 0) {
      // If an upvote exists, remove it and add a downvote.
      await pool.query(
        "DELETE FROM answer_upvotes WHERE user_id = $1 AND answer_id = $2",
        [userId, answerId]
      );
      // Switching from upvote to downvote means net change of -2 (from +1 to -1)
      const updatedAnswer = await pool.query(
        "UPDATE answers SET upvotes = upvotes - 2 WHERE id = $1 RETURNING *",
        [answerId]
      );
      await pool.query(
        "INSERT INTO answer_downvotes (user_id, answer_id) VALUES ($1, $2)",
        [userId, answerId]
      );
      return res.json({ message: "Switched vote to downvote", answer: updatedAnswer.rows[0] });
    } else {
      // No previous vote: add a downvote (net -1)
      await pool.query(
        "INSERT INTO answer_downvotes (user_id, answer_id) VALUES ($1, $2)",
        [userId, answerId]
      );
      const updatedAnswer = await pool.query(
        "UPDATE answers SET upvotes = upvotes - 1 WHERE id = $1 RETURNING *",
        [answerId]
      );
      return res.json({ message: "Downvote added", answer: updatedAnswer.rows[0] });
    }
  } catch (err) {
    console.error("❌ Database error in downvote:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Accept an Answer (Only Question Owner Can Do This)
router.post("/:answerId/accept", authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.userId;

    // Find the question ID for this answer
    const answer = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
    if (answer.rows.length === 0) {
      return res.status(404).json({ message: "Answer not found." });
    }
    const questionId = answer.rows[0].question_id;
    const answerAuthorId = answer.rows[0].user_id;

    // Verify that the logged-in user is the owner of the question
    const question = await pool.query("SELECT * FROM questions WHERE id = $1", [questionId]);
    if (question.rows.length === 0) {
      return res.status(404).json({ message: "Question not found." });
    }
    if (question.rows[0].user_id !== userId) {
      return res.status(403).json({ message: "Only the question owner can accept an answer." });
    }

    // Unmark any previously accepted answer for this question
    await pool.query("UPDATE answers SET accepted = FALSE WHERE question_id = $1", [questionId]);

    // Mark the selected answer as accepted
    const updatedAnswer = await pool.query(
      "UPDATE answers SET accepted = TRUE WHERE id = $1 RETURNING *",
      [answerId]
    );

    // Send a real-time notification
    sendNotification(answerAuthorId, "Your answer has been accepted!", answerId);

    res.json({ message: "Answer marked as accepted!", answer: updatedAnswer.rows[0] });
  } catch (err) {
    console.error("❌ Database error in accept:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Unaccept an Answer (Only Question Owner Can Do This)
router.post("/:answerId/unaccept", authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.userId;

    // Find the question ID for this answer
    const answer = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
    if (answer.rows.length === 0) {
      return res.status(404).json({ message: "Answer not found." });
    }
    const questionId = answer.rows[0].question_id;
    const answerAuthorId = answer.rows[0].user_id;

    // Verify that the logged-in user is the owner of the question
    const question = await pool.query("SELECT * FROM questions WHERE id = $1", [questionId]);
    if (question.rows.length === 0) {
      return res.status(404).json({ message: "Question not found." });
    }
    if (question.rows[0].user_id !== userId) {
      return res.status(403).json({ message: "Only the question owner can unaccept an answer." });
    }

    // Unaccept the selected answer
    const updatedAnswer = await pool.query(
      "UPDATE answers SET accepted = FALSE WHERE id = $1 AND accepted = TRUE RETURNING *",
      [answerId]
    );

    if (updatedAnswer.rows.length === 0) {
      return res.status(400).json({ message: "This answer is not currently accepted." });
    }

    // Send a notification for unacceptance
    sendNotification(answerAuthorId, "Your answer is no longer accepted.", answerId);

    res.json({ message: "Answer unaccepted!", answer: updatedAnswer.rows[0] });
  } catch (err) {
    console.error("❌ Database error in unaccept:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

// ✅ Create a New Answer
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { questionId, body } = req.body;
    const userId = req.user.userId;

    const newAnswer = await pool.query(
      `INSERT INTO answers (question_id, user_id, body, upvotes, accepted, created_at)
       VALUES ($1, $2, $3, 0, FALSE, NOW())
       RETURNING *`,
      [questionId, userId, body]
    );

    // Fetch the username for display
    const userRes = await pool.query("SELECT username FROM users WHERE id = $1", [userId]);
    const username = userRes.rows[0].username;

    const answerData = {
      ...newAnswer.rows[0],
      username
    };

    res.json({ message: "Answer created!", answer: answerData });
  } catch (err) {
    console.error("Error creating answer:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get All Answers for a Question (Accepted Answer First)
router.get("/:questionId", async (req, res) => {
    try {
      const { questionId } = req.params;
  
      const answers = await pool.query(
        `SELECT answers.id, answers.body, answers.upvotes, answers.accepted, answers.created_at, answers.user_id, users.username 
         FROM answers 
         JOIN users ON answers.user_id = users.id 
         WHERE question_id = $1 
         ORDER BY accepted DESC, upvotes DESC, created_at DESC`,
        [questionId]
      );
  
      res.json(answers.rows);
    } catch (err) {
      console.error("❌ Database error in fetching answers:", err);
      res.status(500).json({ message: "Server error", error: err });
    }
  });
  
// Update an answer (PUT endpoint)
router.put("/:answerId", authMiddleware, async (req, res) => {
    try {
      const { answerId } = req.params;
      const { body } = req.body;
      const userId = req.user.userId;
      
      // Optionally, verify the answer belongs to the user before allowing update
      const answerCheck = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
      if (answerCheck.rows.length === 0) {
        return res.status(404).json({ message: "Answer not found." });
      }
      if (answerCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ message: "You are not authorized to edit this answer." });
      }
  
      const updatedAnswer = await pool.query(
        "UPDATE answers SET body = $1 WHERE id = $2 RETURNING *",
        [body, answerId]
      );
  
      res.json({ message: "Answer updated successfully!", answer: updatedAnswer.rows[0] });
    } catch (err) {
      console.error("Error updating answer:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  // DELETE /api/answers/:answerId
router.delete("/:answerId", authMiddleware, async (req, res) => {
    try {
      const { answerId } = req.params;
      const userId = req.user.userId;
      
      // Optionally, check that the answer belongs to the user
      const answerCheck = await pool.query("SELECT * FROM answers WHERE id = $1", [answerId]);
      if (answerCheck.rows.length === 0) {
        return res.status(404).json({ message: "Answer not found." });
      }
      if (answerCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ message: "You are not authorized to delete this answer." });
      }
      
      const deletedAnswer = await pool.query(
        "DELETE FROM answers WHERE id = $1 RETURNING *",
        [answerId]
      );
      
      if (deletedAnswer.rows.length === 0) {
        return res.status(404).json({ message: "Answer not found." });
      }
      
      res.json({ message: "Answer deleted successfully!", answer: deletedAnswer.rows[0] });
    } catch (err) {
      console.error("Error deleting answer:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  
export default router;
