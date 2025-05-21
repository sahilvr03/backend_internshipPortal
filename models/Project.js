const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["Not Started", "Incomplete", "In Progress", "Under Review", "Completed", "Cancelled"],
    default: "Not Started" 
  },
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  createdBy: { type: String, default: 'admin' },
  tasks: [{
    description: String,
    isComplete: { type: Boolean, default: false },
    dueDate: Date
  }],
  feedback: [{
    comment: String,
    date: { type: Date, default: Date.now },
    from: String
  }],
  lastModified: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Project", projectSchema);