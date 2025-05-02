const GroupMessage = require('../models/groupMessages.model');

exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required' });
    }

    // Fetch all messages for the group sorted by creation time (oldest first)
    const messages = await GroupMessage.find({ groupId })
      .populate("replyTo")
      .sort({ createdAt: 1 })
      .lean(); // Optional: Improves performance if no virtuals/methods are needed

    res.status(200).json(messages);
  } catch (err) {
    console.error('Error fetching group messages:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
