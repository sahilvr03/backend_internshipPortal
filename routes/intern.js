const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Intern = require("../models/Intern");
const PastIntern = require("../models/PastIntern");
const Student = require("../models/Student");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Get all interns (current) with COMBINED attendance
router.get("/", async (req, res) => {
  try {
    // Student ki details ke sath uska attendance array bhi populate kar rahe hain
    const interns = await Intern.find({
      deletedAt: { $exists: false }
    }).populate('student', 'name email username attendance');

    const formattedInterns = interns.map(intern => {
      const studentName = intern.student ? intern.student.name : intern.name;
      const studentEmail = intern.student ? intern.student.email : intern.email;

      // Dono sources se attendance arrays hasil karein
      const adminAttendance = intern.attendance || []; // Admin ki manual attendance
      const studentAttendance = intern.student ? intern.student.attendance : []; // Student ki QR scan wali attendance

      // Dono arrays ko ek array mein combine/merge karein
      let combinedAttendance = [...adminAttendance, ...studentAttendance];

      // Combined array ko date ke hisab se sort karein (sabse nayi pehle)
      combinedAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      return {
        _id: intern._id,
        name: studentName,
        email: studentEmail,
        progress: intern.progress || 0,
        duration: intern.duration || 3,
        status: intern.status || 'Active',
        joiningDate: intern.joiningDate,
        tasks: intern.tasks || [],
        university: intern.university,
        dailyProgress: intern.dailyProgress || [],
        attendance: combinedAttendance, // Yahan combined array bhej rahe hain
        student: intern.student ? {
            _id: intern.student._id,
            name: intern.student.name,
            email: intern.student.email,
            username: intern.student.username
        } : null
      };
    });

    console.log(`Found ${formattedInterns.length} current interns with COMBINED attendance`);
    res.json(formattedInterns);
  } catch (error) {
    console.error("Error fetching interns:", error);
    res.status(500).json({ error: "Error fetching interns: " + error.message });
  }
});

// Get Past Interns
router.get("/past", async (req, res) => {
  try {
    const pastInterns = await PastIntern.find()
      .populate('student', 'name email');
    
    console.log(`Found ${pastInterns.length} past interns`);
    res.json(pastInterns);
  } catch (error) {
    console.error("Error fetching past interns:", error);
    res.status(500).json({ error: "Error fetching past interns: " + error.message });
  }
});

// Get Single Intern Details with COMBINED attendance
router.get("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id)
      .populate('student', 'name email username attendance');
    
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    // Dono attendance ko combine karein aur sort karein
    const adminAttendance = intern.attendance || [];
    const studentAttendance = intern.student ? intern.student.attendance : [];
    intern.attendance = [...adminAttendance, ...studentAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(intern);
  } catch (error) {
    console.error("Error fetching intern:", error);
    res.status(500).json({ error: "Error fetching intern: " + error.message });
  }
});

// Add New Intern
router.post("/", async (req, res) => {
  try {
    const { name, email, studentId, duration, username, password, tasks } = req.body;
    
    const newIntern = new Intern({
      name,
      email,
      duration: duration || 3,
      student: studentId
    });
    
    let studentAccount = null;
    let tasksArray = [];
    
    if (tasks) {
      if (typeof tasks === 'string') {
        tasksArray = tasks.split(',').map(task => task.trim()).filter(task => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }
      newIntern.tasks = tasksArray;
    }
    
    if (username && password) {
      const existingUser = await Student.findOne({ username });
      if (existingUser && (!studentId || existingUser._id.toString() !== studentId)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      if (studentId) {
        await Student.findByIdAndUpdate(studentId, {
          username,
          password: hashedPassword
        });
        studentAccount = await Student.findById(studentId);
      } else {
        const newStudent = new Student({ name, email, username, password: hashedPassword });
        studentAccount = await newStudent.save();
        newIntern.student = studentAccount._id;
      }
      
      if (studentAccount && tasksArray.length > 0) {
        const projectIds = [];
        for (const taskName of tasksArray) {
          const project = new Project({
            title: taskName,
            description: `Task assigned to ${name}: ${taskName}`,
            status: "Not Started",
            assignedTo: [studentAccount._id],
            createdBy: 'admin'
          });
          const savedProject = await project.save();
          projectIds.push(savedProject._id);
        }
        if (projectIds.length > 0) {
          await Student.findByIdAndUpdate(studentAccount._id, {
            $push: { assignedProjects: { $each: projectIds } }
          });
        }
      }
    }
    
    await newIntern.save();
    
    res.status(201).json({
      message: "Intern added successfully!",
      intern: newIntern,
      studentAccount: studentAccount ? { id: studentAccount._id, username: studentAccount.username } : null
    });
  } catch (error) {
    console.error("Error adding intern:", error);
    res.status(500).json({ error: "Error adding intern: " + error.message });
  }
});

// Update Intern
router.put("/:id", async (req, res) => {
  try {
    const internId = req.params.id;
    const { name, email, joiningDate, duration, tasks } = req.body;
    
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    if (name) intern.name = name;
    if (email) intern.email = email;
    if (joiningDate) intern.joiningDate = joiningDate;
    if (duration) intern.duration = duration;
    
    if (tasks) {
      let tasksArray = [];
      if (typeof tasks === 'string') {
        tasksArray = tasks.split(',').map(task => task.trim()).filter(task => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }
      
      const oldTasks = intern.tasks || [];
      intern.tasks = tasksArray;
      
      if (intern.student) {
        const studentId = intern.student;
        const newTasks = tasksArray.filter(task => !oldTasks.includes(task));
        
        if (newTasks.length > 0) {
          const projectIds = [];
          for (const taskName of newTasks) {
            const project = new Project({
              title: taskName,
              description: `Task assigned to ${intern.name}: ${taskName}`,
              status: "Not Started",
              assignedTo: [studentId],
              createdBy: 'admin'
            });
            const savedProject = await project.save();
            projectIds.push(savedProject._id);
          }
          if (projectIds.length > 0) {
            await Student.findByIdAndUpdate(studentId, {
              $push: { assignedProjects: { $each: projectIds } }
            });
          }
        }
      }
    }
    
    await intern.save();
    res.json({ message: "Intern updated successfully", intern });
  } catch (error) {
    console.error("Error updating intern:", error);
    res.status(500).json({ error: "Error updating intern" });
  }
});

// Mark Intern Attendance (Manual by Admin)
router.post("/:id/attendance", async (req, res) => {
  try {
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    intern.attendance.push({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes
    });
    
    await intern.save();
    
    res.status(201).json({
      message: "Attendance recorded successfully!",
      attendance: intern.attendance[intern.attendance.length - 1]
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
});

// Delete an Intern (Move to Past Interns)
router.delete("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    let deletedProjectsInfo = [];
    const studentId = intern.student;
    
    if (studentId) {
      const student = await Student.findById(studentId);
      if (student && student.assignedProjects && student.assignedProjects.length > 0) {
        const projects = await Project.find({ _id: { $in: student.assignedProjects } });
        deletedProjectsInfo = projects.map(p => ({ title: p.title, description: p.description, status: p.status }));
        await Project.deleteMany({ _id: { $in: student.assignedProjects } });
      }
    }

    const pastIntern = new PastIntern({ ...intern.toObject(), deletedProjects: deletedProjectsInfo });
    await pastIntern.save();
    await Intern.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: "Intern and associated projects moved to past interns",
      pastInternId: pastIntern._id,
      deletedProjects: deletedProjectsInfo.length
    });
  } catch (error) {
    console.error("Error deleting intern:", error);
    res.status(500).json({ error: "Error deleting intern" });
  }
});

// Get Single Past Intern Details
router.get("/past/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const pastIntern = await PastIntern.findById(req.params.id)
      .populate('student', 'name email username profilePicture');

    if (!pastIntern) {
      return res.status(404).json({ error: "Past intern not found" });
    }

    const formattedIntern = {
      _id: pastIntern._id,
      name: pastIntern.student ? pastIntern.student.name : pastIntern.name,
      email: pastIntern.student ? pastIntern.student.email : pastIntern.email,
      duration: pastIntern.duration || 3,
      joiningDate: pastIntern.joiningDate,
      endDate: pastIntern.endDate || pastIntern.deletedAt,
      tasks: pastIntern.tasks || [],
      attendance: pastIntern.attendance || [],
      progressUpdates: pastIntern.dailyProgress || [],
      deletedProjects: pastIntern.deletedProjects || [],
      student: pastIntern.student,
      // You can add more formatted fields here if needed
    };

    res.json(formattedIntern);
  } catch (error) {
    console.error("Error fetching past intern details:", error);
    res.status(500).json({ error: "Error fetching past intern details: " + error.message });
  }
});

// Update Intern Credentials
router.put("/:id/credentials", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    if (username) {
      const existingUser = await Student.findOne({ username, _id: { $ne: intern.student } });
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }
    
    if (intern.student) {
      const updates = { username };
      if (password) {
        updates.password = await bcrypt.hash(password, 10);
      }
      await Student.findByIdAndUpdate(intern.student, updates);
      res.json({ message: "Credentials updated successfully" });
    } else {
      res.status(400).json({ error: "No student account linked to this intern" });
    }
  } catch (error) {
    console.error("Error updating credentials:", error);
    res.status(500).json({ error: "Error updating credentials" });
  }
});


module.exports = router;