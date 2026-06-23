import express from "express";

const router = express.Router();

// Debug helpers for verifying that the deployed backend is routing /api/public/*
// (Safe to remove later)
router.get("/__debug", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
