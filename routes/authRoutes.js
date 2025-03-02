// src/routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import dotenv from "dotenv";
import authMiddleware from "../middleware/authMiddleware.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

const router = express.Router();

// Set up the nodemailer transporter for Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ✅ User Signup Route with Email Verification
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists by email
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate a verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Insert new user with verified=false and store the verification token
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password_hash, verified, verification_token)
       VALUES ($1, $2, $3, false, $4)
       RETURNING id, username, email, verified`,
      [username, email, hashedPassword, verificationToken]
    );

    // Construct verification link
    const verifyLink = `http://localhost:5001/api/auth/verify?token=${verificationToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your email",
      text: `Hello ${username}, please verify your email by clicking this link: ${verifyLink}`
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "User registered successfully! Please check your email to verify your account.",
      user: newUser.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Username already exists. Please choose a different username." });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ User Login Route (Only verified users can log in)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = userRes.rows[0];

    // Ensure the user is verified
    if (!user.verified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT Token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Login successful!", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Protected User Profile Route
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await pool.query(
      "SELECT id, username, email, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: user.rows[0] });
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ New Endpoint: Get User Profile Stats
router.get("/profile/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const questionCount = await pool.query(
      "SELECT COUNT(*) FROM questions WHERE user_id = $1",
      [userId]
    );
    const answerCount = await pool.query(
      "SELECT COUNT(*) FROM answers WHERE user_id = $1",
      [userId]
    );
    const acceptedCount = await pool.query(
      "SELECT COUNT(*) FROM answers WHERE user_id = $1 AND accepted = TRUE",
      [userId]
    );

    res.json({
      questionsAsked: parseInt(questionCount.rows[0].count),
      answersGiven: parseInt(answerCount.rows[0].count),
      acceptedAnswers: parseInt(acceptedCount.rows[0].count)
    });
  } catch (err) {
    console.error("Error fetching profile stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Email Verification Endpoint with Redirect
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const userRes = await pool.query("SELECT * FROM users WHERE verification_token = $1", [token]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = userRes.rows[0];
    await pool.query("UPDATE users SET verified = true, verification_token = null WHERE id = $1", [user.id]);

    // Redirect to the login page after successful verification
    res.redirect("http://localhost:3000/login");
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
