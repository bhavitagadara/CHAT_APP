const mongoose = require("mongoose");

const mappingUserSchema = new mongoose.Schema({
  fromUser: String,
  touser : String,
});

module.exports = mongoose.model("MappingTable", mappingUserSchema);