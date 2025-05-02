const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  message: { type: String, required: false },
  fileUrl: { type: String, required: false }, // Store uploaded file URL
  replyTo:{type: mongoose.Schema.Types.Mixed ,ref:"Chat" , default:null},
  isForwarded:{type:Boolean , default:false}
}, { timestamps: true });

module.exports = mongoose.model("Chat", ChatSchema);
