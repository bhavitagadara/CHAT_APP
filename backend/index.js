const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const { connectToMongoDB } = require("./globel/connection");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Chat = require("./models/chatHistory.model");
const GroupMessage = require("./models/groupMessages.model");


const loginRoutes = require("./routes/login.route");
const userRoutes = require("./routes/user.route");
const chatHistory = require("./routes/chatHistory.route");
const createGroup = require("./routes/group.route");
const groupMessageRoutes = require('./routes/groupMessages.route');

const socketHandler = require("./sockets/socketHendler");
const { connect, default: mongoose } = require("mongoose");
mongoose.set('strictQuery',false);


connectToMongoDB("mongodb://127.0.0.1:27017/chattingApp",{
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => console.log('mongodb connected'));
  

// Initialize app and database
const app = express();

// Middleware
app.use(cors());  
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());


// Start server and WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "http://localhost:4200", 
  methods: ["GET", "POST"] },
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true 
});

const uploadDir = path.join(__dirname, "uploads");

//for open photo in node's localhost
app.use(express.static('uploads')); 

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});


const upload = multer({ storage: storage });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { sender, receiver, groupId } = req.body;

    if (!sender || (!receiver && !groupId)) {
      return res.status(400).json({ error: "Sender and receiver or groupId are required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const fileUrl = `http://localhost:3002/${req.file.filename}`;

    let savedMessage;

    if (groupId) {
      // Save to GroupMessage collection
      const groupMessage = new GroupMessage({
        sender,
        groupId,
        message: " ", // optional text or "Sent a file"
        fileUrl,
        timestamp: new Date(),
      });
      savedMessage = await groupMessage.save();
    } else {
      // Save to Chat collection
      const chatMessage = new Chat({
        sender,
        receiver,
        message: " ", // optional text or "Sent a file"
        fileUrl,
        timestamp: new Date(),
      });
      savedMessage = await chatMessage.save();
    }

    res.json({
      message: "File uploaded successfully",
      fileUrl,
      chat: savedMessage,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

app.use("/", loginRoutes);
app.use("/", userRoutes);
app.use("/", chatHistory);
app.use("/groups", createGroup);
app.use('/', groupMessageRoutes); 

socketHandler(io);

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

