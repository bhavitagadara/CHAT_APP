const express = require("express");
const router = express.Router();
const { getAllChats } = require("../controllers/chatHistory.controller");

router.get("/chat-history", getAllChats);

module.exports = router;
