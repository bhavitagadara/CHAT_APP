const MappingTable = require("../models/mappinguser");
const User = require("../models/login.model");

const getAllUsers = async (req, res) => {
  try {
    console.log(" Received Query Params:", req.query);

    const { email } = req.query;
    if (!email) {
      console.error("Error: Missing email in request");
      return res.status(400).json({ error: "Email is required" });
    }

    console.log("Email received:", email);

    const mappings = await MappingTable.find({
      $or: [{ fromUser: email }, { touser: email }]
    });

    console.log("Mappings found:", mappings);

    const userEmails = new Set();
    mappings.forEach(({ fromUser, touser }) => {
      if (fromUser !== email) userEmails.add(fromUser);
      if (touser !== email) userEmails.add(touser);
    });

    if (userEmails.size === 0) {
      return res.status(200).json({ users: [] }); // No error, just return empty array
    }

    const users = await User.find({ email: { $in: Array.from(userEmails) } }).select("firstName lastName email");

    console.log("Users found:", users);

    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};



module.exports = { getAllUsers };
