
const express = require("express");
const { registerUser, loginUser } = require("../controllers/login.controller");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

module.exports = router;
