const Group = require("../models/group.model");
const User = require("../models/login.model"); // Ensure you have the User model imported

const createGroup = async (req, res) => {
  const { groupName, members, createdBy } = req.body;

  try {
    const newGroup = new Group({
      name: groupName,
      members,
      createdBy,
      admin: createdBy, 
    });

    const savedGroup = await newGroup.save();
    res.status(201).json({ success: true, group: savedGroup });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getGroupUser = async (req, res) => {
  const email = req.params.email;

  try {
    // Find the user by email to get their ObjectId
    const user = await User.findOne({ email: email });
    console.log("user : ",user);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.log("user : ",user);

    // Use the user's ObjectId to find groups
    const groups = await Group.find({ members: user._id }).populate('members');
    console.log("groups : ",groups);

    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const removeUser = async (req, res) => {
  const { groupId, targetEmail } = req.body;

  try {
    const group = await Group.findById(groupId).populate('members');

    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const userToRemove = group.members.find(m => m.email === targetEmail);
    if (!userToRemove) {
      return res.status(404).json({ success: false, message: 'User not in group' });
    }

    // Remove the user
    group.members = group.members.filter(m => m.email !== targetEmail);
    await group.save();

    res.status(200).json({ success: true, message: 'User removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

const getGroupUsers = async ( req, res) =>{
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('members', 'name email');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json({ members: group.members });
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

const addUserToGroup = async (req , res) => {
  const { groupId, userEmail } = req.body;

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    // Check if user is already in group
    if (group.members.includes(user._id)) {
      return res.status(400).json({ success: false, message: 'User already in group' });
    }

    group.members.push(user._id);
    await group.save();

    res.json({ success: true, message: 'User added to group', user });
  } catch (error) {
    console.error('Error adding user to group:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { createGroup , getGroupUser , removeUser ,getGroupUsers ,addUserToGroup}; // Ensure both functions are exported
