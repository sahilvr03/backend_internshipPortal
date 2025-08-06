const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Student = require("../models/Student");
const PastIntern = require("../models/PastIntern");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Get all current interns from Student collection
router.get("/", async (req, res) => {
  try {
    const students = await Student.find({
      status: 'Active',
      deletedAt: { $exists: false }
    }).populate(
      "assignedProjects",
      "title description status tasks feedback startDate endDate lastModified"
    );

    const formattedInterns = students.map((student) => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      username: student.username,
      progress: student.progress || 0,
      duration: student.weeks || 8,
      status: student.status || "Active",
      joiningDate: student.joinDate || new Date(),
      tasks: student.tasks || [],
      university: student.university || "N/A",
      department: student.program || "N/A",
      domain: student.domain || "N/A",
      weeks: student.weeks || "N/A",
      program: student.program || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      lastActive: student.lastActive || new Date(),
      lastLogin: student.lastLogin || new Date(),
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || [],
      assignedProjects: student.assignedProjects || [],
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        username: student.username,
        program: student.program || "N/A",
        domain: student.domain || "N/A",
        weeks: student.weeks || "N/A",
        university: student.university || "N/A",
        contactNumber: student.contactNumber || "N/A",
        bio: student.bio || "N/A",
        dob: student.dob || null,
        linkedin: student.linkedin || "N/A",
        resume: student.resume || null,
        profilePic: student.profilePic || null,
        createdAt: student.createdAt || new Date(),
        assignedProjects: student.assignedProjects || [],
        progressUpdates: student.progressUpdates || [],
        attendance: student.attendance || []
      }
    }));

    formattedInterns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Found ${formattedInterns.length} current interns`);
    res.json(formattedInterns);
  } catch (error) {
    console.error("Error fetching interns:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error fetching interns: " + error.message });
  }
});

// Get all past interns
router.get("/past", async (req, res) => {
  try {
    const pastInterns = await PastIntern.find().populate(
      "student",
      "name email username program domain weeks university contactNumber bio dob linkedin resume profilePic createdAt assignedProjects progressUpdates"
    );

    const formattedPastInterns = pastInterns.map((pastIntern) => ({
      _id: pastIntern._id,
      name: pastIntern.student ? pastIntern.student.name : pastIntern.name,
      email: pastIntern.student ? pastIntern.student.email : pastIntern.email,
      username: pastIntern.student ? pastIntern.student.username : pastIntern.username,
      progress: pastIntern.progress || 0,
      duration: pastIntern.duration || 8,
      joiningDate: pastIntern.joiningDate,
      tasks: pastIntern.tasks || [],
      university: pastIntern.student?.university || pastIntern.university || "N/A",
      program: pastIntern.student?.program || pastIntern.program || "N/A",
      domain: pastIntern.student?.domain || pastIntern.domain || "N/A",
      weeks: pastIntern.student?.weeks || pastIntern.weeks || "N/A",
      contactNumber: pastIntern.student?.contactNumber || pastIntern.contactNumber || "N/A",
      bio: pastIntern.student?.bio || pastIntern.bio || "N/A",
      dob: pastIntern.student?.dob || pastIntern.dob || null,
      linkedin: pastIntern.student?.linkedin || pastIntern.linkedin || "N/A",
      resume: pastIntern.student?.resume || pastIntern.resume || null,
      profilePic: pastIntern.student?.profilePic || pastIntern.profilePic || null,
      createdAt: pastIntern.student?.createdAt || pastIntern.createdAt || new Date(),
      deletedAt: pastIntern.deletedAt,
      deletedProjects: pastIntern.deletedProjects || [],
      attendance: pastIntern.attendance || [],
      progressUpdates: pastIntern.progressUpdates || [],
      student: pastIntern.student
        ? {
            _id: pastIntern.student._id,
            name: pastIntern.student.name,
            email: pastIntern.student.email,
            username: pastIntern.student.username,
            program: pastIntern.student.program || "N/A",
            domain: pastIntern.student.domain || "N/A",
            weeks: pastIntern.student.weeks || "N/A",
            university: pastIntern.student.university || "N/A",
            contactNumber: pastIntern.student.contactNumber || "N/A",
            bio: pastIntern.student.bio || "N/A",
            dob: pastIntern.student.dob || null,
            linkedin: pastIntern.student.linkedin || "N/A",
            resume: pastIntern.student.resume || null,
            profilePic: pastIntern.student.profilePic || null,
            createdAt: pastIntern.student.createdAt || new Date(),
            assignedProjects: pastIntern.student.assignedProjects || [],
            progressUpdates: pastIntern.student.progressUpdates || []
          }
        : null
    }));

    formattedPastInterns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Found ${formattedPastInterns.length} past interns`);
    res.json(formattedPastInterns);
  } catch (error) {
    console.error("Error fetching past interns:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error fetching past interns: " + error.message });
  }
});

// Move student to past interns (soft delete)
router.post("/archive/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.warn("Unauthorized attempt to archive student");
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      console.warn(`Student not found: ${req.params.id}`);
      return res.status(404).json({ error: "Student not found" });
    }

    const pastIntern = new PastIntern({
      student: student._id,
      name: student.name,
      email: student.email,
      username: student.username,
      progress: student.progress || 0,
      duration: student.weeks || 8,
      joiningDate: student.joinDate,
      tasks: student.tasks || [],
      university: student.university || "N/A",
      program: student.program || "N/A",
      domain: student.domain || "N/A",
      weeks: student.weeks || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      deletedAt: new Date(),
      deletedProjects: student.assignedProjects || [],
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || []
    });

    await pastIntern.save();
    console.log(`Student archived to past interns: ${pastIntern._id}`);

    await Student.findByIdAndDelete(req.params.id);
    console.log(`Student deleted from active students: ${req.params.id}`);

    res.json({ message: "Student archived successfully" });
  } catch (error) {
    console.error("Error archiving student:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error archiving student: " + error.message });
  }
});

// Get specific intern details
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate(
        "assignedProjects",
        "title description status tasks feedback startDate endDate lastModified"
      );

    if (!student) {
      console.warn(`Student not found: ${req.params.id}`);
      return res.status(404).json({ error: "Student not found" });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      console.warn("Unauthorized access to intern details");
      return res.status(403).json({ error: "Access denied" });
    }

    const formattedIntern = {
      _id: student._id,
      name: student.name,
      email: student.email,
      username: student.username,
      progress: student.progress || 0,
      duration: student.weeks || 8,
      status: student.status || "Active",
      joiningDate: student.joinDate,
      tasks: student.tasks || [],
      university: student.university || "N/A",
      program: student.program || "N/A",
      domain: student.domain || "N/A",
      weeks: student.weeks || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      lastActive: student.lastActive || new Date(),
      lastLogin: student.lastLogin || new Date(),
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || [],
      assignedProjects: student.assignedProjects || [],
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        username: student.username,
        program: student.program || "N/A",
        domain: student.domain || "N/A",
        weeks: student.weeks || "N/A",
        university: student.university || "N/A",
        contactNumber: student.contactNumber || "N/A",
        bio: student.bio || "N/A",
        dob: student.dob || null,
        linkedin: student.linkedin || "N/A",
        resume: student.resume || null,
        profilePic: student.profilePic || null,
        createdAt: student.createdAt || new Date(),
        assignedProjects: student.assignedProjects || [],
        progressUpdates: student.progressUpdates || [],
        attendance: student.attendance || []
      }
    };

    console.log(`Fetched details for intern: ${req.params.id}`);
    res.json(formattedIntern);
  } catch (error) {
    console.error("Error fetching intern details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error fetching intern details: " + error.message });
  }
});

module.exports = router;