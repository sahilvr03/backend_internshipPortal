const mongoose = require("mongoose");

// Yeh schema Student Schema ka carbon copy hoga
const pendingStudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Hashed password
  
  // Baaqi ki saari profile information
  contactNumber: String,
  program: String,
  university: String,
  graduationYear: Number,
  bio: String,
  
  // Default settings
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    attendanceAlerts: { type: Boolean, default: true },
    projectUpdates: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
  },
  securitySettings: {
    twoFactorAuth: { type: Boolean, default: false },
    requirePasswordReset: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 30 },
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PendingStudent", pendingStudentSchema);