const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  socketId: String,
});

module.exports = mongoose.model("User", userSchema);
