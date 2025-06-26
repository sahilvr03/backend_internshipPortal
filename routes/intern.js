const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Student = require("../models/Student");
const PastIntern = require("../models/PastIntern");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Get all interns (current) from Student collection
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
      progress: student.progress || 0,
      duration: student.duration || 3,
      status: student.status || "Active",
      joiningDate: student.joiningDate,
      tasks: student.tasks || [],
      university: student.university || "N/A",
      department: student.department || "N/A",
      domain: student.domain || "N/A",
      week: student.week || "N/A",
      program: student.program || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      lastActive: student.lastActive || new Date(),
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || [],
      assignedProjects: student.assignedProjects || [],
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        username: student.username,
        department: student.department || "N/A",
        domain: student.domain || "N/A",
        week: student.week || "N/A",
        program: student.program || "N/A",
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

// Get Past Interns
router.get("/past", async (req, res) => {
  try {
    const pastInterns = await PastIntern.find().populate(
      "student",
      "name email username department domain week program university contactNumber bio dob linkedin resume profilePic createdAt assignedProjects progressUpdates"
    );

    const formattedPastInterns = pastInterns.map((pastIntern) => ({
      _id: pastIntern._id,
      name: pastIntern.student ? pastIntern.student.name : pastIntern.name,
      email: pastIntern.student ? pastIntern.student.email : pastIntern.email,
      progress: pastIntern.progress || 0,
      duration: pastIntern.duration || 3,
      joiningDate: pastIntern.joiningDate,
      tasks: pastIntern.tasks || [],
      university: pastIntern.student?.university || pastIntern.university || "N/A",
      department: pastIntern.student?.department || pastIntern.department || "N/A",
      domain: pastIntern.student?.domain || pastIntern.domain || "N/A",
      week: pastIntern.student?.week || pastIntern.week || "N/A",
      program: pastIntern.student?.program || pastIntern.program || "N/A",
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
            department: pastIntern.student.department || "N/A",
            domain: pastIntern.student.domain || "N/A",
            week: pastIntern.student.week || "N/A",
            program: pastIntern.student.program || "N/A",
            university: pastIntern.student.university || "N/A",
            contactNumber: pastIntern.student.contactNumber || "N/A",
            bio: pastIntern.student.bio || "N/A",
            dob: pastIntern.student.dob || null,
            linkedin: pastIntern.student.linkedin || "N/A",
            resume: pastIntern.student.resume || null,
            profilePic: pastIntern.student.profilePic || null,
            createdAt: pastIntern.student.createdAt || new Date(),
            assignedProjects: pastIntern.student.assignedProjects || [],
            progressUpdates: pastIntern.student.progressUpdates || [],
            attendance: pastIntern.student.attendance || []
          }
        : null
    }));

    console.log(`Found ${pastInterns.length} past interns`);
    res.json(formattedPastInterns);
  } catch (error) {
    console.error("Error finding past interns:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error retrieving past interns: " + error.message });
  }
});

// Get Single Intern Details
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate(
      "assignedProjects",
      "title description status tasks feedback startDate endDate lastModified"
    );

    if (!student) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const formattedIntern = {
      _id: student._id,
      name: student.name,
      email: student.email,
      progress: student.progress || 0,
      duration: student.duration || 3,
      status: student.status || "Active",
      joiningDate: student.joiningDate,
      tasks: student.tasks || [],
      university: student.university || "N/A",
      department: student.department || "N/A",
      domain: student.domain || "N/A",
      week: student.week || "N/A",
      program: student.program || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      lastActive: student.lastActive || new Date(),
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || [],
      assignedProjects: student.assignedProjects || [],
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        username: student.username,
        department: student.department || "N/A",
        domain: student.domain || "N/A",
        week: student.week || "N/A",
        program: student.program || "N/A",
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

    res.json(formattedIntern);
  } catch (error) {
    console.error("Error finding intern:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error retrieving intern: " + error.message });
  }
});

// Add New Intern
router.post("/", async (req, res) => {
  try {
    const { name, email, duration, username, password, tasks, department, domain, weeks, program, university, phone, bio, dob, linkedin, resume, profilePic } = req.body;

    console.log('Received payload:', req.body);

    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: "Missing required fields: name, email, username, and password are required" });
    }

    const existingStudent = await Student.findOne({ $or: [{ email }, { username }] });
    if (existingStudent) {
      return res.status(409).json({ error: "Email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let tasksArray = [];
    if (tasks) {
      if (typeof tasks === "string") {
        tasksArray = tasks.split(",").map((task) => task.trim()).filter((task) => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }
    }

    const newStudent = new Student({
      name,
      email,
      username,
      password: hashedPassword,
      department: department || "N/A",
      domain: domain || "N/A",
      week: weeks || "N/A",
      program: program || "N/A",
      university: university || "N/A",
      contactNumber: phone || "N/A",
      bio: bio || "N/A",
      dob: dob || null,
      linkedin: linkedin || "N/A",
      resume: resume || null,
      profilePic: profilePic || null,
      duration: duration || 3,
      status: "Active",
      joiningDate: new Date(),
      tasks: tasksArray,
      role: 'student',
      createdAt: new Date(),
      lastActive: new Date(),
      lastLogin: new Date(),
      notificationSettings: {
        emailNotifications: true,
        attendanceAlerts: true,
        projectUpdates: true,
        systemAlerts: true
      },
      securitySettings: {
        twoFactorAuth: false,
        requirePasswordReset: false,
        sessionTimeout: 30
      }
    });

    const studentAccount = await newStudent.save();
    console.log('Student saved:', studentAccount);

    if (tasksArray.length > 0) {
      const projectIds = [];
      for (const taskName of tasksArray) {
        const project = new Project({
          title: taskName,
          description: `Task assigned to ${name}: ${taskName}`,
          status: "Not Started",
          assignedTo: [studentAccount._id],
          createdBy: "admin"
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

    const populatedStudent = await Student.findById(studentAccount._id).populate(
      "assignedProjects",
      "title description status tasks feedback startDate endDate lastModified"
    );

    const formattedIntern = {
      _id: populatedStudent._id,
      name: populatedStudent.name,
      email: populatedStudent.email,
      progress: populatedStudent.progress || 0,
      duration: populatedStudent.duration || 3,
      status: populatedStudent.status || "Active",
      joiningDate: populatedStudent.joiningDate,
      tasks: populatedStudent.tasks || [],
      university: populatedStudent.university || "N/A",
      department: populatedStudent.department || "N/A",
      domain: populatedStudent.domain || "N/A",
      week: populatedStudent.week || "N/A",
      program: populatedStudent.program || "N/A",
      contactNumber: populatedStudent.contactNumber || "N/A",
      bio: populatedStudent.bio || "N/A",
      dob: populatedStudent.dob || null,
      linkedin: populatedStudent.linkedin || "N/A",
      resume: populatedStudent.resume || null,
      profilePic: populatedStudent.profilePic || null,
      createdAt: populatedStudent.createdAt || new Date(),
      lastActive: populatedStudent.lastActive || new Date(),
      attendance: populatedStudent.attendance || [],
      progressUpdates: populatedStudent.progressUpdates || [],
      assignedProjects: populatedStudent.assignedProjects || [],
      student: {
        _id: populatedStudent._id,
        name: populatedStudent.name,
        email: populatedStudent.email,
        username: populatedStudent.username,
        department: populatedStudent.department || "N/A",
        domain: populatedStudent.domain || "N/A",
        week: populatedStudent.week || "N/A",
        program: populatedStudent.program || "N/A",
        university: populatedStudent.university || "N/A",
        contactNumber: populatedStudent.contactNumber || "N/A",
        bio: populatedStudent.bio || "N/A",
        dob: populatedStudent.dob || null,
        linkedin: populatedStudent.linkedin || "N/A",
        resume: populatedStudent.resume || null,
        profilePic: populatedStudent.profilePic || null,
        createdAt: populatedStudent.createdAt || new Date(),
        assignedProjects: populatedStudent.assignedProjects || [],
        progressUpdates: populatedStudent.progressUpdates || [],
        attendance: populatedStudent.attendance || []
      }
    };

    res.status(201).json({
      message: "Intern added successfully!",
      intern: formattedIntern,
      studentAccount: { id: studentAccount._id, username: studentAccount.username }
    });
  } catch (error) {
    console.error("Error adding intern:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      request딩: req.body
    });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: "Validation failed: " + error.message });
    }
    if (error.name === 'MongoServerError') {
      return res.status(500).json({ error: "Database error: " + error.message });
    }
    res.status(500).json({ error: "Error adding intern: " + error.message });
  }
});

// Update Intern
router.put("/:id", async (req, res) => {
  try {
    const { name, email, joiningDate, duration, tasks, username, password, department, domain, week, program, university, contactNumber, bio, dob, linkedin, resume, profilePic } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const studentUpdates = {};
    if (name) studentUpdates.name = name;
    if (email) studentUpdates.email = email;
    if (joiningDate) studentUpdates.joiningDate = joiningDate;
    if (duration) studentUpdates.duration = duration;
    if (department) studentUpdates.department = department;
    if (domain) studentUpdates.domain = domain;
    if (week) studentUpdates.week = week;
    if (program) studentUpdates.program = program;
    if (university) studentUpdates.university = university;
    if (contactNumber) studentUpdates.contactNumber = contactNumber;
    if (bio) studentUpdates.bio = bio;
    if (dob) studentUpdates.dob = dob;
    if (linkedin) studentUpdates.linkedin = linkedin;
    if (resume) studentUpdates.resume = resume;
    if (profilePic) studentUpdates.profilePic = profilePic;
    if (username) studentUpdates.username = username;
    if (password) studentUpdates.password = await bcrypt.hash(password, 10);

    if (Object.keys(studentUpdates).length > 0) {
      if (username) {
        const existingUser = await Student.findOne({ username });
        if (existingUser && existingUser._id.toString() !== student._id.toString()) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      if (email) {
        const existingUser = await Student.findOne({ email });
        if (existingUser && existingUser._id.toString() !== student._id.toString()) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }
      await Student.findByIdAndUpdate(student._id, studentUpdates);
    }

    if (tasks) {
      let tasksArray = [];
      if (typeof tasks === "string") {
        tasksArray = tasks.split(",").map((task) => task.trim()).filter((task) => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }

      const oldTasks = student.tasks || [];
      studentUpdates.tasks = tasksArray;

      const newTasks = tasksArray.filter((task) => !oldTasks.includes(task));
      if (newTasks.length > 0) {
        const projectIds = [];
        for (const taskName of newTasks) {
          const project = new Project({
            title: taskName,
            description: `Task assigned to ${student.name}: ${taskName}`,
            status: "Not Started",
            assignedTo: [student._id],
            createdBy: "admin"
          });
          const savedProject = await project.save();
          projectIds.push(savedProject._id);
        }
        if (projectIds.length > 0) {
          await Student.findByIdAndUpdate(student._id, {
            $push: { assignedProjects: { $each: projectIds } }
          });
        }
      }
    }

    await Student.findByIdAndUpdate(student._id, studentUpdates);

    const populatedStudent = await Student.findById(student._id).populate(
      "assignedProjects",
      "title description status tasks feedback startDate endDate lastModified"
    );

    const formattedIntern = {
      _id: populatedStudent._id,
      name: populatedStudent.name,
      email: populatedStudent.email,
      progress: populatedStudent.progress || 0,
      duration: populatedStudent.duration || 3,
      status: populatedStudent.status || "Active",
      joiningDate: populatedStudent.joiningDate,
      tasks: populatedStudent.tasks || [],
      university: populatedStudent.university || "N/A",
      department: populatedStudent.department || "N/A",
      domain: populatedStudent.domain || "N/A",
      week: populatedStudent.week || "N/A",
      program: populatedStudent.program || "N/A",
      contactNumber: populatedStudent.contactNumber || "N/A",
      bio: populatedStudent.bio || "N/A",
      dob: populatedStudent.dob || null,
      linkedin: populatedStudent.linkedin || "N/A",
      resume: populatedStudent.resume || null,
      profilePic: populatedStudent.profilePic || null,
      createdAt: populatedStudent.createdAt || new Date(),
      lastActive: populatedStudent.lastActive || new Date(),
      attendance: populatedStudent.attendance || [],
      progressUpdates: populatedStudent.progressUpdates || [],
      assignedProjects: populatedStudent.assignedProjects || [],
      student: {
        _id: populatedStudent._id,
        name: populatedStudent.name,
        email: populatedStudent.email,
        username: populatedStudent.username,
        department: populatedStudent.department || "N/A",
        domain: populatedStudent.domain || "N/A",
        week: populatedStudent.week || "N/A",
        program: populatedStudent.program || "N/A",
        university: populatedStudent.university || "N/A",
        contactNumber: populatedStudent.contactNumber || "N/A",
        bio: populatedStudent.bio || "N/A",
        dob: populatedStudent.dob || null,
        linkedin: populatedStudent.linkedin || "N/A",
        resume: populatedStudent.resume || null,
        profilePic: populatedStudent.profilePic || null,
        createdAt: populatedStudent.createdAt || new Date(),
        assignedProjects: populatedStudent.assignedProjects || [],
        progressUpdates: populatedStudent.progressUpdates || [],
        attendance: populatedStudent.attendance || []
      }
    };

    res.json({ message: "Intern updated successfully", intern: formattedIntern });
  } catch (error) {
    console.error("Error updating intern:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error updating intern: " + error.message });
  }
});

// Mark Intern Attendance
router.post("/:id/attendance", async (req, res) => {
  try {
    const { date, status, timeIn, timeOut, notes } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const attendanceRecord = {
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes
    };

    student.attendance.push(attendanceRecord);
    await student.save();

    res.status(201).json({
      message: "Attendance marked successfully!",
      attendance: student.attendance[student.attendance.length - 1]
    });
  } catch (error) {
    console.error("Error marking attendance:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to mark attendance: " + error.message });
  }
});

// Submit Progress Update for Intern
router.post("/:id/progress", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const progressUpdate = {
      content,
      timestamp: new Date(),
      hasAdminFeedback: false
    };

    student.progressUpdates = student.progressUpdates || [];
    student.progressUpdates.push(progressUpdate);
    await student.save();

    res.status(201).json({
      message: "Progress update submitted successfully!",
      update: progressUpdate
    });
  } catch (error) {
    console.error("Error submitting progress update:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to submit progress update: " + error.message });
  }
});

// Delete an Intern (Move to Past Interns)
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate(
      "assignedProjects",
      "title description status tasks feedback startDate endDate lastModified"
    );
    if (!student) {
      return res.status(404).json({ error: "Intern not found" });
    }

    let deletedProjectsInfo = [];
    if (student.assignedProjects && student.assignedProjects.length > 0) {
      deletedProjectsInfo = student.assignedProjects.map((project) => ({
        _id: project._id,
        title: project.title,
        description: project.description,
        status: project.status
      }));

      await Project.updateMany(
        { _id: { $in: student.assignedProjects.map((p) => p._id) } },
        { $pull: { assignedTo: student._id } }
      );

      await Student.findByIdAndUpdate(student._id, {
        $set: { assignedProjects: [] }
      });
    }

    const pastIntern = new PastIntern({
      name: student.name,
      email: student.email,
      progress: student.progress || 0,
      duration: student.duration || 3,
      joiningDate: student.joiningDate,
      tasks: student.tasks || [],
      university: student.university || "N/A",
      department: student.department || "N/A",
      domain: student.domain || "N/A",
      week: student.week || "N/A",
      program: student.program || "N/A",
      contactNumber: student.contactNumber || "N/A",
      bio: student.bio || "N/A",
      dob: student.dob || null,
      linkedin: student.linkedin || "N/A",
      resume: student.resume || null,
      profilePic: student.profilePic || null,
      createdAt: student.createdAt || new Date(),
      lastActive: student.lastActive || new Date(),
      student: student._id,
      deletedAt: new Date(),
      deletedProjects: deletedProjectsInfo,
      attendance: student.attendance || [],
      progressUpdates: student.progressUpdates || []
    });

    await pastIntern.save();

    await Student.findByIdAndUpdate(student._id, {
      $set: { status: 'Inactive', deletedAt: new Date() }
    });

    console.log(`Intern ${student.name} moved to past interns with ${deletedProjectsInfo.length} projects`);

    res.json({ message: "Intern moved to past interns successfully!" });
  } catch (error) {
    console.error("Error deleting intern:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Error deleting intern: " + error.message });
  }
});

module.exports = router;