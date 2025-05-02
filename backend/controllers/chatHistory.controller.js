const Chat = require("../models/chatHistory.model");

const getAllChats = async (req, res) => {
  const { sender, receiver } = req.query;

  if (!sender || !receiver) {
    return res.status(400).json({ message: "Sender and receiver are required" });
  }

  try {
    const messages = await Chat.find({
      $or: [
        { sender: sender, receiver: receiver },
        { sender: receiver, receiver: sender },
      ],
    })
    .populate("replyTo")
    .sort({ createdAt: 1 }) // Sort by oldest to newest
    .select("message fileUrl imageUrl createdAt sender receiver");

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat history", error });
  }
};

module.exports = { getAllChats };
