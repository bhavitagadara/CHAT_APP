const express = require("express");
const router = express.Router();
const { uploadFile } = require("../controllers/fileUpload.controller");

router.post("/upload", uploadFile);

module.exports = router;
