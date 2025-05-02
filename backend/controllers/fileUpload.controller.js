const upload = require("../middelwer/fileUpload.middelwer");
const Chat = require("../models/chatHistory.model"); // Import the Chat model

exports.uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Extract sender and receiver from request body
  const { sender, receiver } = req.body;
  if (!sender || !receiver) {
    return res.status(400).json({ message: "Sender and receiver are required" });
  }

  // Construct file URL
  const fileUrl = `http://localhost:3002/uploads/${req.file.filename}`;

  // Save file message in the database
  const chatMessage = new Chat({
    sender,
    receiver,
    message: "File shared",
    fileUrl: fileUrl, // Add file URL to the database
  });

  chatMessage.save()
    .then(() => {
      res.status(200).json({
        message: "File uploaded successfully",
        fileUrl: fileUrl,
      });
    })
    .catch((error) => {
      console.error("Error saving file message:", error);
      res.status(500).json({ message: "Error saving file message" });
    });
};
