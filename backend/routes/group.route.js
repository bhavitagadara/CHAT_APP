const express = require("express");
const { createGroup , getGroupUser , removeUser , getGroupUsers , addUserToGroup} = require("../controllers/group.controller");

const router = express.Router();

router.post("/create", createGroup);
router.get("/:email",getGroupUser);
router.post("/remove-user",removeUser);
router.get("/:groupId/members",getGroupUsers)
router.post("/add-user",addUserToGroup)


module.exports = router;
