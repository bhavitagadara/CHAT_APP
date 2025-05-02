const User = require("../models/login.model");
const Chat = require("../models/chatHistory.model");
const MappingTable = require("../models/mappinguser");
const upload = require("../middelwer/fileUpload.middelwer");
const path = require("path");
const fs = require("fs");
const GroupMessage = require("../models/groupMessages.model");
const Group = require("../models/group.model");
const { request } = require("http");

const lastSeenMap = {}; // { email: Date }
const onlineUsers = new Map();
const userLastSeen = new Map();
const emailToSocketIdMap = {};
const userSocketMap = new Map(); // email => socketId

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    const userEmail = socket.handshake.query.email;
    console.log(`User connected: ${socket.id}, Email: ${userEmail}`);
    if (userEmail) {
      emailToSocketIdMap[userEmail] = socket.id;
      onlineUsers[userEmail] = socket.id;

      userSocketMap.set(userEmail, socket.id);

    }

    if (!userEmail) return;

    // Track user in memory and DB
    onlineUsers[userEmail] = socket.id;
    await User.findOneAndUpdate({ email: userEmail }, { socketId: socket.id });
    console.log("Online users after connect:", onlineUsers);

    function getSocketIdByEmail(email) {
      return emailToSocketIdMap[email];
    }
    //const targetSocketId = emailToSocketIdMap[to];

    // Broadcast user is online
    // socket.broadcast.emit("userStatusUpdate", {
    //   email: userEmail,
    //   status: "online",
    // });
    // Get mapped users for sidebar
    const mappings = await MappingTable.find({
      $or: [{ fromUser: userEmail }, { touser: userEmail }]
    });

    const userEmails = new Set();
    mappings.forEach(({ fromUser, touser }) => {
      if (fromUser !== userEmail) userEmails.add(fromUser);
      if (touser !== userEmail) userEmails.add(touser);
    });

    let users = [];
    if (userEmails.size > 0) {
      users = await User.find({ email: { $in: Array.from(userEmails) } }).select("firstName lastName email");
    }

    socket.emit("activeUsers", users);

    // Handle private message
    socket.on("sendMessage", async (data) => {
      const { sender, receiver, message, replyTo, fileUrl } = data;

      const chatMessage = new Chat({
        sender,
        receiver,
        message,
        fileUrl: fileUrl ?? undefined,
        replyTo: replyTo ? replyTo._id : null
      });

      await chatMessage.save();

      const recipient = await User.findOne({ email: receiver });
      if (recipient?.socketId) {
        io.to(recipient.socketId).emit("privateMessage", {
          sender,
          receiver,
          message,
          fileUrl,
          replyTo
        });
      }
    });

    // Start call
    socket.on("startCall", ({ caller, callee }) => {
      const calleeSocketId = onlineUsers[callee];
      if (calleeSocketId) {
        io.to(calleeSocketId).emit("incomingCall", { caller });
      } else {
        console.log(`Callee (${callee}) not found in online users.`);
      }
    });

    socket.on("videoOffer", ({ target, offer, caller }) => {
      const targetSocketId = onlineUsers[target];
      if (targetSocketId) {
        io.to(targetSocketId).emit("videoOffer", { offer, caller });
      }
    });

    socket.on("videoAnswer", ({ target, answer }) => {
      const targetSocketId = onlineUsers[target];
      if (targetSocketId) {
        io.to(targetSocketId).emit("videoAnswer", { answer });
      }
    });

    socket.on("iceCandidate", ({ target, candidate }) => {
      const targetSocketId = onlineUsers[target];
      if (targetSocketId) {
        io.to(targetSocketId).emit("iceCandidate", { candidate });
      }
    });

    socket.on("rejectCall", ({ caller }) => {
      const callerSocketId = onlineUsers[caller];
      if (callerSocketId) {
        io.to(callerSocketId).emit("callRejected");
      }
    });

    socket.on("endCall", ({ target }) => {
      const targetSocketId = onlineUsers[target];
      if (targetSocketId) {
        io.to(targetSocketId).emit("callEnded");
      }
    });

    socket.on("joinGroup", (groupId) => {
      socket.join(groupId);
      console.log(`User ${userEmail} joined group ${groupId}`);
    });

    // Handle group message
    socket.on("sendGroupMessage", async (data) => {
      console.log("Group message received", data);

      const group = await Group.findById(data.groupId);
      if (!group) return;

      console.log("group : ", group);

      const newMsg = new GroupMessage({
        groupId: data.groupId,
        sender: data.sender,
        message: data.message,
        fileUrl: data.fileUrl ?? undefined,
        replyTo: data.replyTo ? data.replyTo._id : null,
      });
      console.log("new messages 1: ", newMsg);

      await newMsg.save();

      console.log("new messages 2: ", newMsg);

      // Optionally populate replyTo
      let populatedMsg = await GroupMessage.findById(newMsg._id).populate('replyTo');

      console.log("populatedMsg : ", populatedMsg);

      group.members.forEach(member => {
        const memberSocketId = onlineUsers[member];
        console.log("memberSocketId : ", memberSocketId);
        if (memberSocketId) {
          io.to(memberSocketId).emit("receiveGroupMessage", populatedMsg);
        }
      });

    });

    //admin can remove user
    socket.on("removeUserFromGroup", async ({ groupId, requesterEmail, targetEmail }) => {
      try {
        const group = await Group.findById(groupId).populate("admin");
        const requester = await User.findOne({ email: requesterEmail });
        const targetUser = await User.findOne({ email: targetEmail });

        if (!group || !requester || !targetUser) {
          return socket.emit("userRemovedFromGroup", { success: false, message: "Invalid data" });
        }

        // Check if the requester is the admin
        if (group.admin.toString() !== requester._id.toString()) {
          return socket.emit("userRemovedFromGroup", { success: false, message: "Only admin can remove users" });
        }

        // Remove the target user from the group
        await Group.findByIdAndUpdate(groupId, {
          $pull: { members: targetUser._id }
        });

        socket.emit("userRemovedFromGroup", {
          success: true,
          groupId,
          userEmail: targetEmail
        });

        // Notify other group members
        socket.to(groupId).emit("userRemovedFromGroup", {
          success: true,
          groupId,
          userEmail: targetEmail
        });

      } catch (error) {
        console.error("Error removing user from group:", error);
        socket.emit("userRemovedFromGroup", { success: false, message: "Server error" });
      }
    });

    //exit from group
    socket.on("exitGroup", async ({ groupId, userEmail }) => {
      try {
        // Step 1: Find the user by email to get their ObjectId
        const user = await User.findOne({ email: userEmail });

        if (!user) {
          return socket.emit("exitedGroup", { success: false, groupId });
        }

        // Step 2: Remove the user ObjectId from the group members array
        await Group.findByIdAndUpdate(groupId, {
          $pull: { members: user._id }
        });

        // Step 3: Notify the exiting user and other group members
        socket.emit("exitedGroup", { success: true, groupId });
        socket.to(groupId).emit("userExitedGroup", { groupId, userEmail });

        socket.leave(groupId);
      } catch (error) {
        console.error("Error exiting group:", error);
        socket.emit("exitedGroup", { success: false, groupId });
      }
    });

    //delete group
    socket.on("deleteGroup", async ({ groupId, requesterEmail }) => {
      try {
        console.log("Delete group request for groupId:", groupId, "from:", requesterEmail);

        const group = await Group.findById(groupId).populate("admin");
        const requester = await User.findOne({ email: requesterEmail });

        if (!group || !requester) {
          return socket.emit("groupDeleted", { success: false, message: "Invalid group or user." });
        }

        // Fix: Compare admin._id if admin is populated
        if (group.admin._id.toString() !== requester._id.toString()) {
          return socket.emit("groupDeleted", {
            success: false,
            message: "Only the admin can delete the group.",
          });
        }

        // Remove all group messages
        await GroupMessage.deleteMany({ groupId });

        // Delete group itself
        await Group.findByIdAndDelete(groupId);

        // Notify all group members
        group.members.forEach((memberId) => {
          User.findById(memberId).then((member) => {
            if (member && onlineUsers[member.email]) {
              io.to(onlineUsers[member.email]).emit("groupDeleted", {
                success: true,
                groupId,
                message: `Group "${group.name}" has been deleted by the admin.`,
              });
            }
          });
        });

        // Notify the admin too
        socket.emit("groupDeleted", {
          success: true,
          groupId,
          message: `Group "${group.name}" successfully deleted.`,
        });

        console.log(`Group "${group.name}" deleted by admin ${requester.email}`);
      } catch (error) {
        console.error("Error deleting group:", error);
        socket.emit("groupDeleted", {
          success: false,
          message: "Server error while deleting group.",
        });
      }
    });

    //delete messages from group
    socket.on("deleteGroupMessages", async (data) => {
      try {
        const { messageIds, sender } = data;

        const messages = await GroupMessage.find({ _id: { $in: messageIds }, sender });
        if (messages.length === 0) return;

        await GroupMessage.deleteMany({ _id: { $in: messageIds } });

        io.emit("groupMessagesDeleted", { messageIds });
      } catch (error) {
        console.error("Error deleting group messages:", error);
        socket.emit("error", { message: "Failed to delete group messages." });
      }
    });

    // Forward single message
    socket.on("forwardMessage", async (data) => {
      try {
        const { sender, messageId, recipients } = data;

        const originalMessage = await Chat.findById(messageId);
        if (!originalMessage) {
          return socket.emit("error", { error: "Original message not found" });
        }

        for (const recipientEmail of recipients) {
          const forwardedMessage = new Chat({
            sender,
            receiver: recipientEmail,
            message: originalMessage.message,
            fileUrl: originalMessage.fileUrl,
            replyTo: null,
            isForwarded: true
          });

          await forwardedMessage.save();

          const recipient = await User.findOne({ email: recipientEmail });
          if (recipient?.socketId) {
            io.to(recipient.socketId).emit("privateMessage", {
              sender,
              receiver: recipientEmail,
              message: originalMessage.message,
              fileUrl: originalMessage.fileUrl,
              replyTo: null
            });
          }
        }

        console.log(`Message forwarded by ${sender} to:`, recipients);
      } catch (error) {
        console.error("Error forwarding message:", error);
        socket.emit("error", { error: "Failed to forward message" });
      }
    });

    // Forward multiple messages
    socket.on("forwardMessages", async (data) => {
      try {
        const { sender, messageIds, recipients } = data;
        if (!messageIds.length || !recipients.length) return;

        let forwardedMessages = [];

        for (const messageId of messageIds) {
          const originalMessage = await Chat.findById(messageId);
          if (!originalMessage) continue;

          for (const recipientEmail of recipients) {
            const forwardedMessage = new Chat({
              sender,
              receiver: recipientEmail,
              message: originalMessage.message,
              fileUrl: originalMessage.fileUrl,
              replyTo: null
            });

            await forwardedMessage.save();
            forwardedMessages.push(forwardedMessage);

            const recipient = await User.findOne({ email: recipientEmail });
            if (recipient?.socketId) {
              io.to(recipient.socketId).emit("privateMessage", forwardedMessage.toObject());
            }
          }
        }

        socket.emit("messagesForwarded", { forwardedMessages });
      } catch (error) {
        console.error("Error forwarding messages:", error);
        socket.emit("error", { message: "Failed to forward messages." });
      }
    });

    // Delete multiple messages
    socket.on("deleteMessages", async (data) => {
      const { messageIds, sender } = data;
      if (!messageIds.length) return;

      const messages = await Chat.find({ _id: { $in: messageIds }, sender });
      if (messages.length === 0) return;

      await Chat.deleteMany({ _id: { $in: messageIds } });

      io.emit("messagesDeleted", { messageIds });
    });

    // File upload
    socket.on("uploadFile", async (data, callback) => {
      try {
        const { sender, receiver, fileName } = data;
        const filePath = path.join(__dirname, "../uploads", fileName);

        if (!fs.existsSync(filePath)) {
          return callback({ success: false, message: "File not found" });
        }

        const chatMessage = new Chat({ sender, receiver, message: fileName });
        await chatMessage.save();

        const recipient = await User.findOne({ email: receiver });
        if (recipient?.socketId) {
          io.to(recipient.socketId).emit("privateMessage", {
            sender,
            receiver,
            message: fileName,
            fileUrl: `http://localhost:3002/uploads/${fileName}`
          });
        }

        callback({ success: true, fileUrl: `http://localhost:3002/uploads/${fileName}` });
      } catch (error) {
        console.error("File upload error:", error);
        callback({ success: false, message: "Upload failed" });
      }
    });

    // Delete single message
    socket.on("deleteMessage", async (data) => {
      try {
        const { messageId, sender } = data;

        const message = await Chat.findById(messageId);
        if (!message) {
          return socket.emit("error", { error: "Message not found" });
        }

        if (message.sender !== sender) {
          return socket.emit("error", { error: "Unauthorized: You can only delete your own messages." });
        }

        await Chat.findByIdAndDelete(messageId);
        console.log(`Message ${messageId} deleted by ${sender}`);

        io.emit("deleteMessage", { messageId });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("error", { error: "Failed to delete message" });
      }
    });

    // socket.on("userTyping", ({ from, to }) => {
    //   const toSocketId = userSocketMap.get(to);
    //   if (toSocketId) {
    //     io.to(toSocketId).emit("userStatusUpdate", {
    //       email: from,
    //       status: "typing..."
    //     });
    //   }
    // });

    // socket.on("userStopTyping", ({ from, to }) => {
    //   const toSocketId = userSocketMap.get(to);
    //   if (toSocketId) {
    //     setTimeout(() => {
    //       io.to(toSocketId).emit("userStatusUpdate", {
    //         email: from,
    //         status: "online"
    //       });
    //     }, 1000); // Delay a bit to reduce flicker
    //   }
    // });

    socket.on("disconnect", async () => {
      if (userEmail) {
        userSocketMap.delete(userEmail);
        delete onlineUsers[userEmail];
        delete emailToSocketIdMap[userEmail];

        const lastSeenTime = new Date().toISOString();
        userLastSeen.set(userEmail, lastSeenTime);

        console.log(`${userEmail} disconnected at ${lastSeenTime}`);

        io.emit("userStatusUpdate", {
          email: userEmail,
          status: "offline",
          lastSeen: lastSeenTime,
        });

        await User.findOneAndUpdate({ email: userEmail }, { socketId: "" });
        userSocketMap.delete(userEmail);

      }
    });

  });
};

module.exports = socketHandler;
