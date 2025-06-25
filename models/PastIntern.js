const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ["Present", "Absent", "Late", "Half-Day", "Leave"],
    required: true
  },
  timeIn: String,
  timeOut: String,
  notes: String
});

const progressUpdateSchema = new mongoose.Schema({
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  feedback: { type: String },
  hasAdminFeedback: { type: Boolean, default: false },
  feedbackDate: { type: Date }
});

const pastInternSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  joiningDate: { type: Date, default: Date.now },
  endDate: Date,
  duration: Number,
  progress: { type: Number, default: 0 },
  projectRating: { type: Number, default: 0 },
  tasks: [{ type: String }],
  attendance: [attendanceSchema],
  dailyProgress: [progressUpdateSchema],
  status: { type: String, default: "Active" },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  deletedAt: { type: Date, default: Date.now },
  deletedProjects: [{ 
    title: String,
    description: String,
    status: String
  }]
});

module.exports = mongoose.model("PastIntern", pastInternSchema);