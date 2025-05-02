const mongoose = require("mongoose");

const GroupMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  sender: {
    type: String, // or use ObjectId if you're referencing the User model directly
    required: true
  },
  message: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String, // Optional, for file attachments
    default: null
  },
  replyTo: { 
    type: mongoose.Schema.Types.Mixed ,
    ref:"GroupMessage" ,
    default:null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("GroupMessage", GroupMessageSchema);
