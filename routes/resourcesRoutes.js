// In routes/resourcesRoutes.js
import express from "express";
import pool from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

// Configure multer for file uploads (local storage for now)
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// ✅ Upload a Resource
router.post("/", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    const userId = req.user.userId;
    // req.file contains the uploaded file details.
    const fileUrl = `/uploads/${req.file.filename}`;

    const newResource = await pool.query(
      "INSERT INTO resources (user_id, title, description, file_url, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [userId, title, description, fileUrl, tags ? tags.split(",") : []]
    );

    res.status(201).json({ message: "Resource uploaded", resource: newResource.rows[0] });
  } catch (err) {
    console.error("❌ Error uploading resource:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
