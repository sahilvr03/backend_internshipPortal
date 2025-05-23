const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Student = require("../models/Student");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");

// Get All Students
router.get("/students", async (req, res) => {
  try {
    const students = await Student.find()
      .select('-password')
      .populate('assignedProjects');
      
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Error fetching students" });
  }
});

// Get Single Student
router.get("/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .select('-password')
      .populate('assignedProjects');
      
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ error: "Error fetching student details" });
  }
});
// Delete a Project
router.delete("/projects/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Remove project reference from assigned students
    if (project.assignedTo && project.assignedTo.length > 0) {
      await Student.updateMany(
        { _id: { $in: project.assignedTo } },
        { $pull: { assignedProjects: project._id } }
      );
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({
      message: "Project deleted successfully",
      projectId: req.params.id,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Error deleting project: " + error.message });
  }
});

// Create New Project
router.post("/projects", async (req, res) => {
  try {
    const { title, description, assignedTo, tasks, endDate } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }
    const newProject = new Project({
      title,
      description,
      assignedTo: assignedTo || [],
      endDate: endDate ? new Date(endDate) : undefined,
      tasks: tasks || [],
    });
    const savedProject = await newProject.save();
    if (assignedTo && assignedTo.length > 0) {
      // Verify student IDs exist
      const students = await Student.find({ _id: { $in: assignedTo } });
      if (students.length !== assignedTo.length) {
        console.warn('Some assignedTo IDs are invalid:', assignedTo);
      }
      await Student.updateMany(
        { _id: { $in: assignedTo } },
        { $push: { assignedProjects: savedProject._id } }
      );
      console.log(`Assigned project ${savedProject._id} to ${assignedTo.length} students`);
    }
    res.status(201).json({ message: "Project created successfully!", project: savedProject });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Error creating project: " + error.message });
  }
});
// Get All Projects
router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('assignedTo', 'name email');
    
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Error fetching projects" });
  }
});

// Get Single Project Details
router.get("/projects/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedTo', 'name email');
      
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ error: "Error fetching project details" });
  }
});
router.post("/attendance/qr/:studentId", async (req, res) => {
  try {
    const { qrToken } = req.body;

    // Validate QR token (e.g., a simple token check; adjust based on your QR code data)
    if (!qrToken || qrToken !== process.env.QR_ATTENDANCE_TOKEN) {
      return res.status(400).json({ error: "Invalid QR code token" });
    }

    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const now = new Date();
    const attendanceRecord = {
      date: now,
      status: "Present",
      timeIn: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeOut: null,
      notes: "Attendance marked via QR code scanner"
    };

    student.attendance.push(attendanceRecord);
    await student.save();

    res.status(201).json({
      message: "Attendance recorded successfully via QR code!",
      attendance: attendanceRecord
    });
  } catch (error) {
    console.error("Error recording QR attendance:", error);
    res.status(500).json({ error: "Error recording attendance: " + error.message });
  }
});

// Update Project Status
router.put("/projects/:id", async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    if (status) project.status = status;
    
    if (feedback) {
      project.feedback.push({
        comment: feedback,
        from: 'admin'
      });
    }
    
    project.lastModified = new Date();
    await project.save();
    
    res.json({ 
      message: "Project updated successfully!",
      project
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Error updating project" });
  }
});

// Record Student Attendance
// Record Student Attendance
router.post("/attendance/:studentId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const { date, status, timeIn, timeOut, notes } = req.body;

    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const attendanceRecord = {
      date: date ? new Date(date) : new Date(),
      status: status || "Present",
      timeIn: timeIn || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeOut: timeOut || null,
      notes: notes || `Marked by admin: ${req.user.name || 'Admin'}`
    };

    student.attendance.push(attendanceRecord);
    await student.save();

    res.status(201).json({
      message: "Attendance recorded successfully!",
      attendance: attendanceRecord
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance: " + error.message });
  }
});

// Get all attendance records for a student
// Get all attendance records for a student
router.get("/student/:id/attendance", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied. You can only view your own attendance or must be an admin." });
    }

    const student = await Student.findById(req.params.id).select('attendance');
    if (!student) return res.status(404).json({ error: "Student not found" });

    res.json(student.attendance);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ error: "Error fetching attendance records" });
  }
});

// Get Admin Profile and Settings
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    res.json({
      name: admin.name,
      email: admin.email,
      username: admin.username,
      notificationSettings: admin.notificationSettings || {
        emailNotifications: true,
        attendanceAlerts: true,
        projectUpdates: true,
        systemAlerts: true
      },
      securitySettings: admin.securitySettings || {
        twoFactorAuth: false,
        requirePasswordReset: false,
        sessionTimeout: 30
      },
      lastLogin: admin.lastLogin
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ error: "Error fetching admin profile" });
  }
});

// Update Admin Profile
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { name, email, username } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    if (email && email !== admin.email) {
      const existingEmail = await Student.findOne({ email, _id: { $ne: req.user.id } });
      if (existingEmail) {
        return res.status(400).json({ error: "Email is already in use" });
      }
    }
    
    if (username && username !== admin.username) {
      const existingUsername = await Student.findOne({ username, _id: { $ne: req.user.id } });
      if (existingUsername) {
        return res.status(400).json({ error: "Username is already in use" });
      }
    }
    
    admin.name = name || admin.name;
    admin.email = email || admin.email;
    admin.username = username || admin.username;
    
    await admin.save();
    
    res.json({
      message: "Profile updated successfully",
      admin: {
        name: admin.name,
        email: admin.email,
        username: admin.username
      }
    });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ error: "Error updating admin profile" });
  }
});

// Update Admin Password
router.put("/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    admin.password = hashedPassword;
    
    await admin.save();
    
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating admin password:", error);
    res.status(500).json({ error: "Error updating admin password" });
  }
});

// Update Notification Settings
router.put("/settings/notifications", authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, attendanceAlerts, projectUpdates, systemAlerts } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    if (!admin.notificationSettings) {
      admin.notificationSettings = {};
    }
    
    admin.notificationSettings = {
      emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
      attendanceAlerts: attendanceAlerts !== undefined ? attendanceAlerts : true,
      projectUpdates: projectUpdates !== undefined ? projectUpdates : true,
      systemAlerts: systemAlerts !== undefined ? systemAlerts : true
    };
    
    await admin.save();
    
    res.json({
      message: "Notification settings updated successfully",
      settings: admin.notificationSettings
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ error: "Error updating notification settings" });
  }
});

// Update Security Settings
router.put("/settings/security", authenticateToken, async (req, res) => {
  try {
    const { twoFactorAuth, requirePasswordReset, sessionTimeout } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    if (!admin.securitySettings) {
      admin.securitySettings = {};
    }
    
    admin.securitySettings = {
      twoFactorAuth: twoFactorAuth !== undefined ? twoFactorAuth : false,
      requirePasswordReset: requirePasswordReset !== undefined ? requirePasswordReset : false,
      sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : 30
    };
    
    await admin.save();
    
    res.json({
      message: "Security settings updated successfully",
      settings: admin.securitySettings
    });
  } catch (error) {
    console.error("Error updating security settings:", error);
    res.status(500).json({ error: "Error updating security settings" });
  }
});

// Get All Students' Progress Updates
router.get("/progress-updates", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const students = await Student.find({ role: 'student' });
    
    const allUpdates = [];
    
    students.forEach(student => {
      if (student.progressUpdates && student.progressUpdates.length > 0) {
        student.progressUpdates.forEach(update => {
          allUpdates.push({
            _id: update._id,
            content: update.content,
            timestamp: update.timestamp,
            feedback: update.feedback,
            hasAdminFeedback: update.hasAdminFeedback,
            studentId: student._id,
            studentName: student.name,
            studentEmail: student.email
          });
        });
      }
    });
    
    allUpdates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allUpdates);
  } catch (error) {
    console.error("Error fetching all progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

// Add Feedback to a Progress Update
router.post("/progress-updates/:updateId/feedback", authenticateToken, async (req, res) => {
  try {
    const { updateId } = req.params;
    const { feedback } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    const student = await Student.findOne({ 
      "progressUpdates._id": updateId 
    });
    
    if (!student) {
      return res.status(404).json({ error: "Progress update not found" });
    }
    
    const progressUpdateIndex = student.progressUpdates.findIndex(
      update => update._id.toString() === updateId
    );
    
    if (progressUpdateIndex === -1) {
      return res.status(404).json({ error: "Progress update not found" });
    }
    
    student.progressUpdates[progressUpdateIndex].feedback = feedback;
    student.progressUpdates[progressUpdateIndex].hasAdminFeedback = true;
    student.progressUpdates[progressUpdateIndex].feedbackDate = new Date();
    
    await student.save();
    
    res.json({
      message: "Feedback added successfully",
      update: student.progressUpdates[progressUpdateIndex]
    });
  } catch (error) {
    console.error("Error adding feedback to progress update:", error);
    res.status(500).json({ error: "Failed to add feedback" });
  }
});

// Add Feedback to a Project
router.post("/projects/:projectId/feedback", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { feedback, studentId } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (!project.feedback) {
      project.feedback = [];
    }
    
    project.feedback.push({
      content: feedback,
      date: new Date(),
      adminId: req.user.id,
      studentId: studentId
    });
    
    await project.save();
    
    if (studentId) {
      const student = await Student.findById(studentId);
      
      if (student) {
        const studentProjectIndex = student.assignedProjects.findIndex(
          p => p._id.toString() === projectId || p.toString() === projectId
        );
        
        if (studentProjectIndex !== -1) {
          if (typeof student.assignedProjects[studentProjectIndex] === 'object') {
            if (!student.assignedProjects[studentProjectIndex].feedback) {
              student.assignedProjects[studentProjectIndex].feedback = [];
            }
            
            student.assignedProjects[studentProjectIndex].feedback.push({
              content: feedback,
              date: new Date(),
              adminId: req.user.id
            });
          } else {
            if (!student.projectFeedback) {
              student.projectFeedback = [];
            }
            
            student.projectFeedback.push({
              projectId: projectId,
              content: feedback,
              date: new Date(),
              adminId: req.user.id,
              isRead: false
            });
          }
        }
        
        if (!student.notifications) {
          student.notifications = [];
        }
        
        student.notifications.unshift({
          type: 'project_feedback',
          message: `New feedback on project: ${project.title}`,
          projectId: projectId,
          read: false,
          date: new Date()
        });
        
        await student.save();
      }
    }
    
    res.json({
      message: "Feedback added successfully",
      project: project
    });
  } catch (error) {
    console.error("Error adding feedback to project:", error);
    res.status(500).json({ error: "Failed to add feedback" });
  }
});

// Get student credentials (admin only)
router.get("/student-credentials/:studentId", async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId).select('username');
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    res.json({
      username: student.username
    });
  } catch (error) {
    console.error("Error fetching student credentials:", error);
    res.status(500).json({ error: "Error fetching student credentials" });
  }
});

module.exports = router;