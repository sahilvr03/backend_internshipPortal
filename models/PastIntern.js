const mongoose = require("mongoose");

const pastInternSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  progress: { type: Number, default: 0 },
  duration: { type: Number, default: 3 },
  joiningDate: { type: Date },
  tasks: [{ type: String }],
  university: { type: String },
  department: { type: String },
  domain: { type: String },
  week: { type: String },
  program: { type: String },
  contactNumber: { type: String },
  bio: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date },
  deletedAt: { type: Date, default: Date.now },
  deletedProjects: [{ _id: mongoose.Schema.Types.ObjectId, title: String, description: String, status: String }],
  attendance: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ["Present", "Absent", "Late", "Half-Day", "Leave"], required: true },
    timeIn: String,
    timeOut: String,
    notes: String,
  }],
  progressUpdates: [{
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    hasAdminFeedback: { type: Boolean, default: false },
    feedback: { type: String },
    feedbackDate: { type: Date },
  }],
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
});

module.exports = mongoose.model("PastIntern", pastInternSchema);