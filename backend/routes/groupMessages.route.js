const express = require('express');
const router = express.Router();
const groupMessageController = require('../controllers/groupMessages.controller');

router.get('/group-messages', groupMessageController.getGroupMessages);

module.exports = router;
