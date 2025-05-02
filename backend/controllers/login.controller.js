
const User = require("../models/login.model");

// Register User Function
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    user = new User({ firstName, lastName, email, socketId: "" });
    await user.save();

    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
};

// Login User Function
const loginUser = async (req, res) => {
    try {
      console.log("Login request received:", req.body);  // Debugging

      const { email, socketId } = req.body;

      if (!email) {
          return res.status(400).json({ message: "Email is required" });
      }

      let user = await User.findOne({ email });

      if (!user) {
          return res.status(400).json({ message: "User not found" });
      }

      console.log("User found:", user);  // Debugging

      // Update user's socketId
      user.socketId = socketId;
      await user.save();

      const users = await User.find();
      res.status(200).json({ message: "Login successful", user, users });

  } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ message: "Login error", error });
  }
  // try {
  //   console.log("Login request received:", req.body); // Debugging

  //   const { email, socketId } = req.body;

  //   if (!email) {
  //     return res.status(400).json({ message: "Email is required" });
  //   }

  //   let user = await User.findOne({ email });

  //   if (!user) {
  //     return res.status(400).json({ message: "User not found" });
  //   }

  //   console.log("User found:", user); // Debugging

  //   // Update user's socketId
  //   user.socketId = socketId;
  //   await user.save();

  //   // Fetch all users after login
  //   const users = await User.find();

  //   res.status(200).json({ message: "Login successful", user, users });
  // } catch (error) {
  //   console.error("Login Error:", error);
  //   res.status(500).json({ message: "Login error", error });
  // }
};

module.exports = { registerUser, loginUser }; // Ensure both functions are exported
