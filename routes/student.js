const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");

// Student Login
router.post("/login", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    
    if (!username && !email) {
      return res.status(400).json({ error: "Username or email is required" });
    }
    
    let student;
    if (username) {
      student = await Student.findOne({ username });
    } else {
      student = await Student.findOne({ email });
    }
    
    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const isMatch = await bcrypt.compare(password, student.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign(
      { id: student._id, role: student.role || 'student' },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    
    student.lastActive = new Date();
    await student.save();
    
    res.json({
      token,
      studentId: student._id,
      name: student.name,
      role: student.role || 'student'
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Get Student Profile & Assigned Projects
router.get("/profile/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const student = await Student.findById(req.params.id)
      .select('-password')
      .populate({
        path: 'assignedProjects',
        select: 'title description status tasks feedback startDate endDate lastModified'
      });
      
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    console.log(`Fetched profile for student ${req.params.id}:`, {
      assignedProjects: student.assignedProjects.map(p => ({
        id: p._id,
        title: p.title
      }))
    });
    
    res.json(student);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Error fetching profile: " + error.message });
  }
});


// Get Student's Project Details
router.get("/projects/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const student = await Student.findById(req.user.id);
    if (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Error fetching project details" });
  }
});

// Submit Project Update
router.post("/progress/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    const student = await Student.findById(req.user.id);
    if (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const progressUpdate = {
      date: new Date(),
      content
    };
    
    student.progressUpdates.push(progressUpdate);
    
    const project = await Project.findById(projectId);
    if (project && project.status === "Not Started") {
      project.status = "In Progress";
      project.lastModified = new Date();
      await project.save();
    }
    
    if (project) {
      project.feedback.push({
        comment: `Progress update: ${content}`,
        from: student.name
      });
      await project.save();
    }
    
    await student.save();
    
    res.status(201).json({ 
      message: "Progress update submitted successfully!",
      update: progressUpdate
    });
  } catch (error) {
    console.error("Error submitting progress update:", error);
    res.status(500).json({ error: "Error submitting progress update" });
  }
});

// Update Student Profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { contactNumber, skills, bio } = req.body;
    
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    if (contactNumber) student.contactNumber = contactNumber;
    if (skills) student.skills = skills;
    if (bio) student.bio = bio;
    
    await student.save();
    
    res.json({ 
      message: "Profile updated successfully",
      student: {
        name: student.name,
        email: student.email,
        contactNumber: student.contactNumber,
        skills: student.skills,
        bio: student.bio
      }
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Error updating profile" });
  }
});

// Submit Progress Update
router.post("/progress-updates", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    const newProgressUpdate = {
      content,
      timestamp: new Date(),
      hasAdminFeedback: false
    };
    
    if (!student.progressUpdates) {
      student.progressUpdates = [];
    }
    
    student.progressUpdates.push(newProgressUpdate);
    await student.save();
    
    const createdUpdate = student.progressUpdates[student.progressUpdates.length - 1];
    
    res.status(201).json({
      _id: createdUpdate._id,
      content: createdUpdate.content,
      timestamp: createdUpdate.timestamp,
      studentId: student._id,
      studentName: student.name,
      hasAdminFeedback: false
    });
  } catch (error) {
    console.error("Error submitting progress update:", error);
    res.status(500).json({ error: "Failed to submit progress update" });
  }
});

// Get All Progress Updates
router.get("/progress-updates", authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    const updates = student.progressUpdates || [];
    updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(updates);
  } catch (error) {
    console.error("Error fetching progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

module.exports = router;