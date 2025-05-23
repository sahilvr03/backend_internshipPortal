const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ["Present", "Absent", "Late", "Half-Day", "Leave"],
    required: true
  },
  timeIn: String,
  timeOut: String ,
  notes: String
});

const progressUpdateSchema = new mongoose.Schema({
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  feedback: { type: String },
  hasAdminFeedback: { type: Boolean, default: false },
  feedbackDate: { type: Date }
});

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  joinDate: { type: Date, default: Date.now },
  contactNumber: String,
  program: String,
  university: String,
  graduationYear: Number,
  tasks: [{ type: String }],
  bio: String,
  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  attendance: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true },
    timeIn: { type: String },
    timeOut: { type: String },
    notes: { type: String }
  }],
  progressUpdates: [progressUpdateSchema],
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    attendanceAlerts: { type: Boolean, default: true },
    projectUpdates: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true }
  },
  securitySettings: {
    twoFactorAuth: { type: Boolean, default: false },
    requirePasswordReset: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 30 }
  }
});

module.exports = mongoose.model("Student", studentSchema);