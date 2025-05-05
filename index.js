const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'https://backend-internship-portal.vercel.app', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ **Middleware for Authentication**
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Access denied. Token required." });
    
    jwt.verify(token, "secret_key", (err, user) => {
      if (err) return res.status(403).json({ error: "Invalid or expired token" });
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
};

// ✅ **Enhanced File Upload Configuration**
// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, "uploads");
const imageDir = path.join(uploadDir, "images");
const documentDir = path.join(uploadDir, "documents");
const videoDir = path.join(uploadDir, "videos");

[uploadDir, imageDir, documentDir, videoDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer with file type validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadDir;
    
    // Determine file type based on mimetype
    if (file.mimetype.startsWith('image/')) {
      uploadPath = imageDir;
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath = videoDir;
    } else {
      uploadPath = documentDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create safer filenames by removing spaces and special characters
    const fileName = file.originalname.replace(/\s+/g, '_').toLowerCase();
    cb(null, `${Date.now()}-${fileName}`);
  },
});

// Add file validation
const fileFilter = (req, file, cb) => {
  // Define allowed mime types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4', 'video/quicktime', 'video/x-msvideo'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});


app.get('/', (req, res) => res.json({ message: 'API is working' }));

// Serve static files from upload directories
app.use("/uploads", express.static(uploadDir));

// ✅ **MongoDB Connection with Better Error Handling**
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit on database connection failure
  });

// ✅ **Enhanced Schema Definitions**
const mediaSchema = new mongoose.Schema({
  fileName: String,
  fileType: String,
  filePath: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  uploadDate: { type: Date, default: Date.now },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }
});

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
  attachments: [mediaSchema],
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

// Update the studentSchema with these additional fields

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  profilePicture: { type: String },
  joinDate: { type: Date, default: Date.now },
  contactNumber: String,
  program: String,
  university: String,
  graduationYear: Number,
  tasks: [{ type: String }],
  bio: String,
  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  attendance: [attendanceSchema],
  progressUpdates: [progressUpdateSchema],
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  // Add these new fields for admin settings
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

const internSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  resume: String,
  joiningDate: { type: Date, default: Date.now },
  endDate: Date,
  duration: Number,
  progress: { type: Number, default: 0 },
  projectRating: { type: Number, default: 0 },
  tasks: [{ type: String }],
  attendance: [attendanceSchema],
  dailyProgress: [progressUpdateSchema],
  status: { type: String, default: "Active" },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }
});

const pastInternSchema = new mongoose.Schema({
  ...internSchema.obj,
  deletedAt: { type: Date, default: Date.now },
  deletedProjects: [{
    _id: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    status: String,
    startDate: Date,
    endDate: Date,
    feedback: [{
      comment: String,
      date: Date,
      from: String
    }],
    attachments: [{
      fileName: String,
      fileType: String,
      filePath: String
    }]
  }],
  completionRate: Number,
  performanceRating: Number
});

// ✅ **Create Models**
const Project = mongoose.model("Project", projectSchema);
const Media = mongoose.model("Media", mediaSchema);
const Student = mongoose.model("Student", studentSchema);
const Intern = mongoose.model("Intern", internSchema);
const PastIntern = mongoose.model("PastIntern", pastInternSchema);

// ✅ **Enhanced Admin APIs**

// **🔐 Add Student with Login Credentials**
app.post("/api/admin/students", async (req, res) => {
  try {
    const { name, email, username, password, program, university, graduationYear, contactNumber, skills } = req.body;
    
    // Check if username or email already exists
    const existingUser = await Student.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newStudent = new Student({
      name,
      email,
      username,
      password: hashedPassword,
      program,
      university,
      graduationYear,
      contactNumber,
      skills: skills || []
    });

    await newStudent.save();
    
    res.status(201).json({ 
      message: "Student added successfully!",
      studentId: newStudent._id
    });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Error adding student" });
  }
});

// **📋 Get All Students**
app.get("/api/admin/students", async (req, res) => {
  try {
    const students = await Student.find()
      .select('-password') // Exclude password field
      .populate('assignedProjects');
      
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Error fetching students" });
  }
});

// **📋 Get Single Student**
app.get("/api/admin/students/:id", async (req, res) => {
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

// Create a new project
app.post("/api/admin/projects", authenticateToken, async (req, res) => {
  try {
    const { title, description, assignedTo, tasks, endDate } = req.body;
    
    const newProject = new Project({
      title,
      description,
      assignedTo,
      endDate: endDate ? new Date(endDate) : undefined,
      tasks: tasks || []
    });
    
    const savedProject = await newProject.save();
    
    // Update assigned students with this project
    if (assignedTo && assignedTo.length > 0) {
      await Student.updateMany(
        { _id: { $in: assignedTo } },
        { $push: { assignedProjects: savedProject._id } }
      );
    }
    
    res.status(201).json({ 
      message: "Project created successfully!",
      project: savedProject
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Error creating project" });
  }
});

// **📋 Get All Projects**
app.get("/api/admin/projects", async (req, res) => {
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
app.get("/api/admin/projects/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate({
        path: 'attachments',
        select: 'fileName fileType filePath uploadDate uploadedBy',
      });
      
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ error: "Error fetching project details" });
  }
});

// **📋 Update Project Status**
app.put("/api/admin/projects/:id", authenticateToken, async (req, res) => {
  try {
    const { title, description, status, assignedTo, tasks, feedback } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    // Update fields if provided
    if (title) project.title = title;
    if (description) project.description = description;
    if (status) project.status = status;
    if (assignedTo) project.assignedTo = assignedTo;
    if (tasks) project.tasks = tasks;
    
    // Add feedback if provided
    if (feedback) {
      project.feedback.push({
        comment: feedback,
        from: req.user.role || 'admin'
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


// **📋 Record Student Attendance**
app.post("/api/admin/attendance/:studentId", async (req, res) => {
  try {
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    student.attendance.push({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes
    });
    
    await student.save();
    
    res.status(201).json({ 
      message: "Attendance recorded successfully!",
      attendance: student.attendance[student.attendance.length - 1]
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
});

// **🔐 Student Login**
app.post("/api/student/login", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    
    // Check if we have either username or email
    if (!username && !email) {
      return res.status(400).json({ error: "Username or email is required" });
    }
    
    // Find the student by username or email
    let student;
    if (username) {
      student = await Student.findOne({ username });
    } else {
      student = await Student.findOne({ email });
    }
    
    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Check if password matches
    const isMatch = await bcrypt.compare(password, student.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: student._id, role: student.role || 'student' },
      "secret_key",
      { expiresIn: "1d" }
    );
    
    // Update last active timestamp
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

// **👤 Get Student Profile & Assigned Projects**
app.get("/api/student/profile/:id", authenticateToken, async (req, res) => {
  try {
    // Verify the student is accessing their own data
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const student = await Student.findById(req.params.id)
      .select('-password')
      .populate('assignedProjects');
      
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    res.json(student);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Error fetching profile" });
  }
});

// **👤 Get Student's Project Details**
app.get("/api/student/projects/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Verify the student is assigned to this project
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

// **📤 Submit Project Update**
app.post("/api/student/progress/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    // Verify student is assigned to this project
    const student = await Student.findById(req.user.id);
    if (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Add progress update
    const progressUpdate = {
      date: new Date(),
      content
    };
    
    student.progressUpdates.push(progressUpdate);
    
    // Update project status to "In Progress" if it was "Not Started"
    const project = await Project.findById(projectId);
    if (project && project.status === "Not Started") {
      project.status = "In Progress";
      project.lastModified = new Date();
      await project.save();
    }
    
    // Add feedback to project
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

// **📤 Upload Files for Assigned Projects - Enhanced with Multiple File Types**
app.post("/api/student/upload/:projectId", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const studentId = req.user.id; // Get student ID from the auth token
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Verify the student is assigned to this project
    if (!project.assignedTo.includes(studentId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: "You don't have access to this project" });
    }
    
    // Check if project is completed
    if (project.status === "Completed") {
      return res.status(400).json({ error: "Cannot upload to a completed project" });
    }
    
    // Create media entry
    const media = new Media({
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      filePath: req.file.path,
      uploadedBy: studentId,
      projectId: projectId
    });
    
    await media.save();
    
    // Add to project attachments
    project.attachments = project.attachments || [];
    project.attachments.push(media);
    
    // Update status if needed
    if (project.status === "Not Started") {
      project.status = "In Progress";
    }
    
    project.lastModified = new Date();
    await project.save();
    
    // Add to student's progress updates
    student.progressUpdates = student.progressUpdates || [];
    student.progressUpdates.push({
      date: new Date(),
      content: `Uploaded file: ${req.file.originalname} for project ${project.title}`,
      attachments: [req.file.path]
    });
    await student.save();
    
    res.json({
      message: "File uploaded successfully!",
      file: {
        name: req.file.originalname,
        path: req.file.path,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// **👤 Update Student Profile**
app.put("/api/student/profile", authenticateToken, async (req, res) => {
  try {
    const { contactNumber, skills, bio } = req.body;
    
    // Find student by id from token
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Update fields if provided
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

// **👤 Upload Profile Picture**
app.post("/api/student/profile-picture", authenticateToken, upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Verify file is an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: "File must be an image" });
    }
    
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // If there's an existing profile picture, remove it
    if (student.profilePicture) {
      try {
        fs.unlinkSync(student.profilePicture);
      } catch (err) {
        console.error("Error deleting previous profile picture:", err);
      }
    }
    
    // Update profile picture
    student.profilePicture = req.file.path;
    await student.save();
    
    res.json({
      message: "Profile picture updated successfully",
      profilePicture: req.file.path
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: "Error uploading profile picture" });
  }
});

// **📌 Get Past Interns**
app.get("/api/interns/past", authenticateToken, async (req, res) => {
  try {
    const pastInterns = await PastIntern.find()
      .populate('student', 'name email username profilePicture')
      .sort({ deletedAt: -1 }); // Sort by most recent first

    // Calculate completion rates for each past intern
    const pastInternsWithStats = pastInterns.map(intern => {
      const completedProjects = intern.deletedProjects.filter(
        p => p.status === "Completed"
      ).length;
      const totalProjects = intern.deletedProjects.length;
      const completionRate = totalProjects > 0 
        ? Math.round((completedProjects / totalProjects) * 100) 
        : 0;

      return {
        ...intern.toObject(),
        completionRate,
        completedProjects,
        totalProjects
      };
    });

    res.json(pastInternsWithStats);
  } catch (error) {
    console.error("Error fetching past interns:", error);
    res.status(500).json({ error: "Error fetching past interns" });
  }
});

// **📌 Get Single Intern Details**
app.get("/api/interns/past/:id", authenticateToken, async (req, res) => {
  try {
    const pastIntern = await PastIntern.findById(req.params.id)
      .populate('student', 'name email username profilePicture contactNumber university');

    if (!pastIntern) {
      return res.status(404).json({ error: "Past intern not found" });
    }

    // Calculate detailed stats
    const completedProjects = pastIntern.deletedProjects.filter(
      p => p.status === "Completed"
    );
    const inProgressProjects = pastIntern.deletedProjects.filter(
      p => p.status === "In Progress"
    );
    const completionRate = pastIntern.deletedProjects.length > 0
      ? Math.round((completedProjects.length / pastIntern.deletedProjects.length) * 100)
      : 0;

    const response = {
      ...pastIntern.toObject(),
      stats: {
        completionRate,
        completedProjects: completedProjects.length,
        inProgressProjects: inProgressProjects.length,
        totalProjects: pastIntern.deletedProjects.length,
        attendance: pastIntern.attendance ? {
          present: pastIntern.attendance.filter(a => a.status === 'Present').length,
          absent: pastIntern.attendance.filter(a => a.status === 'Absent').length,
          late: pastIntern.attendance.filter(a => a.status === 'Late').length,
          total: pastIntern.attendance.length
        } : null
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching past intern details:", error);
    res.status(500).json({ error: "Error fetching past intern details" });
  }
});

// **📌 Add New Intern**

// Get all interns (current)
app.get("/api/interns", async (req, res) => {
  try {
    // Get all interns that aren't deleted
    const interns = await Intern.find({ 
      deletedAt: { $exists: false } 
    }).populate('student', 'name email username');
    
    // Format data for frontend
    const formattedInterns = interns.map(intern => {
      const studentName = intern.student ? intern.student.name : intern.name;
      const studentEmail = intern.student ? intern.student.email : intern.email;
      
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
        attendance: intern.attendance || [],
        resume: intern.resume,
        student: intern.student
      };
    });
    
    console.log(`Found ${formattedInterns.length} current interns`);
    res.json(formattedInterns);
  } catch (error) {
    console.error("Error fetching interns:", error);
    res.status(500).json({ error: "Error fetching interns: " + error.message });
  }
});

// Add this endpoint for health checks


app.post("/api/interns", upload.single("resume"), async (req, res) => {
  try {
    const { name, email, studentId, duration, username, password, tasks } = req.body;
    
    console.log("Adding new intern with data:", { 
      name, 
      email, 
      duration: duration || 3,
      hasResume: !!req.file,
      hasTasks: !!tasks 
    });
    
    // Create a new intern
    const newIntern = new Intern({
      name,
      email,
      duration: duration || 3, // Default 3 months if not specified
      resume: req.file ? req.file.path : undefined,
      student: studentId
    });
    
    let studentAccount = null;
    let tasksArray = [];
    
    // Parse tasks
    if (tasks) {
      try {
        if (typeof tasks === 'string') {
          tasksArray = tasks.split(',').map(task => task.trim()).filter(task => task);
        } else if (Array.isArray(tasks)) {
          tasksArray = tasks;
        }
        
        // Store tasks in intern object
        newIntern.tasks = tasksArray;
      } catch (error) {
        console.error("Error parsing tasks:", error);
      }
    }
    
    // If username and password are provided, create or update student account
    if (username && password) {
      console.log("Creating student account with username:", username);
      
      // Check if username already exists
      const existingUser = await Student.findOne({ username });
      if (existingUser && (!studentId || existingUser._id.toString() !== studentId)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Hash the password      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      if (studentId) {
        // Update existing student
        await Student.findByIdAndUpdate(studentId, {
          username,
          password: hashedPassword
        });
        studentAccount = await Student.findById(studentId);
      } else {
        // Create new student
        const newStudent = new Student({
          name,
          email,
          username,
          password: hashedPassword
        });
        
        studentAccount = await newStudent.save();
        console.log("New student account created:", studentAccount._id);
        
        // Link the student to the intern
        newIntern.student = studentAccount._id;
      }
      
      // Create projects for each task if student account exists
      if (studentAccount && tasksArray.length > 0) {
        const projectIds = [];
        
        // Create a project for each task
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
        
        // Add projects to student's assignedProjects
        if (projectIds.length > 0) {
          await Student.findByIdAndUpdate(studentAccount._id, {
            $push: { assignedProjects: { $each: projectIds } }
          });
          
          console.log(`${projectIds.length} projects created and assigned to student`);
        }
      }
    }
    
    await newIntern.save();
    console.log("Intern saved successfully:", newIntern._id);
    
    res.status(201).json({
      message: "Intern added successfully!",
      intern: newIntern,
      studentAccount: studentAccount ? {
        id: studentAccount._id,
        username: studentAccount.username
      } : null
    });
  } catch (error) {
    console.error("Error adding intern:", error);
    res.status(500).json({ error: "Error adding intern: " + error.message });
  }
});

// Also update the intern update endpoint to handle project changes
// Update Intern endpoint
app.put("/api/interns/:id", upload.single("resume"), async (req, res) => {
  try {
    const internId = req.params.id;
    const { name, email, joiningDate, duration, tasks } = req.body;
    
    // Find the intern
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    // Update basic fields
    if (name) intern.name = name;
    if (email) intern.email = email;
    if (joiningDate) intern.joiningDate = joiningDate;
    if (duration) intern.duration = duration;
    
    // Handle resume file if provided
    if (req.file) {
      intern.resume = req.file.path;
    }
    
    // Handle tasks update
    if (tasks) {
      let tasksArray = [];
      
      if (typeof tasks === 'string') {
        tasksArray = tasks.split(',').map(task => task.trim()).filter(task => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }
      
      // Get original tasks to compare
      const oldTasks = intern.tasks || [];
      console.log("Old tasks:", oldTasks);
      console.log("New tasks:", tasksArray);
      
      // Store updated tasks in intern object
      intern.tasks = tasksArray;
      
      // If there's a student account, create projects for new tasks
      if (intern.student) {
        const studentId = intern.student;
        
        // Find new tasks (not in old tasks)
        const newTasks = tasksArray.filter(task => !oldTasks.includes(task));
        console.log("New tasks to create projects for:", newTasks);
        
        // Create projects for new tasks
        if (newTasks.length > 0) {
          const projectIds = [];
          
          // Create a project for each new task
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
          
          // Add projects to student's assignedProjects
          if (projectIds.length > 0) {
            await Student.findByIdAndUpdate(studentId, {
              $push: { assignedProjects: { $each: projectIds } }
            });
            
            console.log(`${projectIds.length} new projects created and assigned to student`);
          }
        }
      }
    }
    
    await intern.save();
    
    res.json({
      message: "Intern updated successfully",
      intern
    });
  } catch (error) {
    console.error("Error updating intern:", error);
    res.status(500).json({ error: "Error updating intern" });
  }
});

// **📌 Update Intern Progress**
// Add or update intern progress
app.post("/api/interns/:id/progress", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress content is required" });
    }
    
    const intern = await Intern.findById(req.params.id);
    
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    // Add progress update
    intern.dailyProgress.push({
      date: new Date(),
      content
    });
    
    // Calculate and update overall progress
    const totalTasks = intern.tasks ? intern.tasks.length : 0;
    const completedTasks = intern.dailyProgress.length;
    
    if (totalTasks > 0) {
      // Cap at 100% maximum
      const progressPercent = Math.min(
        Math.round((completedTasks / totalTasks) * 100),
        100
      );
      intern.progress = progressPercent;
    }
    
    await intern.save();
    
    res.json({
      message: "Progress updated successfully",
      progress: intern.progress,
      update: intern.dailyProgress[intern.dailyProgress.length - 1]
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Error updating progress: " + error.message });
  }
});

// Delete project
app.delete("/api/admin/projects/:id", authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Remove project from students' assigned projects
    if (project.assignedTo && project.assignedTo.length > 0) {
      await Student.updateMany(
        { _id: { $in: project.assignedTo } },
        { $pull: { assignedProjects: project._id } }
      );
    }
    
    // Delete associated media files
    if (project.attachments && project.attachments.length > 0) {
      project.attachments.forEach(attachment => {
        try {
          if (fs.existsSync(attachment.filePath)) {
            fs.unlinkSync(attachment.filePath);
          }
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      });
      await Media.deleteMany({ projectId: project._id });
    }
    
    // Delete the project
    await Project.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: "Project deleted successfully!",
      deletedProjectId: req.params.id
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Error deleting project" });
  }
});

// **📌 Mark Intern Attendance**
app.post("/api/interns/:id/attendance", async (req, res) => {
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

// **📌 Delete an Intern (Move to Past Interns)**

app.delete("/api/interns/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    let deletedProjectsInfo = [];
    
    // Get the student ID associated with the intern
    const studentId = intern.student;
    
    // If there's an associated student account, find and delete their projects
    if (studentId) {
      // First, get the student to find assigned projects
      const student = await Student.findById(studentId);
      
      if (student && student.assignedProjects && student.assignedProjects.length > 0) {
        console.log(`Deleting ${student.assignedProjects.length} projects for intern ${intern.name}`);
        
        // Retrieve projects before deletion to store their information
        const projects = await Project.find({ _id: { $in: student.assignedProjects } });
        
        // Store project information
        deletedProjectsInfo = projects.map(project => ({
          title: project.title,
          description: project.description,
          status: project.status
        }));
        
        // Delete all projects assigned to this student
        await Project.deleteMany({ _id: { $in: student.assignedProjects } });
        console.log("Projects deleted successfully");
      }
    }
    
    // Create a past intern entry with project information
    const pastIntern = new PastIntern({
      ...intern.toObject(),
      deletedProjects: deletedProjectsInfo
    });
    
    await pastIntern.save();
    
    // Delete the current intern
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

// Add endpoint to update intern credentials
app.put("/api/interns/:id/credentials", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find the intern
    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    // Check if username already exists (except for the current student)
    if (username) {
      const existingUser = await Student.findOne({ 
        username, 
        _id: { $ne: intern.student } 
      });
      
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }
    
    // Update student credentials
    if (intern.student) {
      const updates = { username };
      
      // Only update password if provided
      if (password) {
        updates.password = await bcrypt.hash(password, 10);
      }
      
      await Student.findByIdAndUpdate(intern.student, updates);
      
      res.json({ 
        message: "Credentials updated successfully",
      });
    } else {
      res.status(400).json({ error: "No student account linked to this intern" });
    }
  } catch (error) {
    console.error("Error updating credentials:", error);
    res.status(500).json({ error: "Error updating credentials" });
  }
});

// Add endpoint to get student credentials (for admin only)
app.get("/api/admin/student-credentials/:studentId", async (req, res) => {
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

// **📌 Mark attendance**

app.post("/api/admin/student/:id/attendance", async (req, res) => {
  try {
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    student.attendance.push({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes
    });
    
    await student.save();
    
    res.status(201).json({ 
      message: "Attendance recorded successfully!",
      attendance: student.attendance[student.attendance.length - 1]
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
}
);

// **📌 Get all attendance records for a student**

app.get("/api/admin/student/:id/attendance", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('attendance');
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    res.json(student.attendance);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ error: "Error fetching attendance records" });
  }
}
);


// **🔧 Get Admin Profile and Settings**
app.get("/api/admin/profile", authenticateToken, async (req, res) => {
  try {
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    // Return admin profile data without password
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

// **🔧 Update Admin Profile**
app.put("/api/admin/profile", authenticateToken, async (req, res) => {
  try {
    const { name, email, username } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    // Find the admin
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    // Check if email is unique (except for current admin)
    if (email && email !== admin.email) {
      const existingEmail = await Student.findOne({ email, _id: { $ne: req.user.id } });
      if (existingEmail) {
        return res.status(400).json({ error: "Email is already in use" });
      }
    }
    
    // Check if username is unique (except for current admin)
    if (username && username !== admin.username) {
      const existingUsername = await Student.findOne({ username, _id: { $ne: req.user.id } });
      if (existingUsername) {
        return res.status(400).json({ error: "Username is already in use" });
      }
    }
    
    // Update admin profile
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

// **🔧 Update Admin Password**
app.put("/api/admin/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    
    // Find the admin
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    
    // Update password
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

// **🔧 Update Notification Settings**
app.put("/api/admin/settings/notifications", authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, attendanceAlerts, projectUpdates, systemAlerts } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    // Add notificationSettings if it doesn't exist
    if (!admin.notificationSettings) {
      admin.notificationSettings = {};
    }
    
    // Update notification settings (maintain defaults if values not provided)
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

// **🔧 Update Security Settings**
app.put("/api/admin/settings/security", authenticateToken, async (req, res) => {
  try {
    const { twoFactorAuth, requirePasswordReset, sessionTimeout } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    // Add securitySettings if it doesn't exist
    if (!admin.securitySettings) {
      admin.securitySettings = {};
    }
    
    // Update security settings (maintain defaults if values not provided)
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


// ✅ **Error Handling Middleware**
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File is too large. Maximum size is 50MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  
  // Handle other errors
  res.status(500).json({ 
    error: "An unexpected error occurred",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    time: new Date().toISOString(),
    message: "NCAI Portal API is running"
  });
});

// **📊 Student: Submit Progress Update**
app.post("/api/progress-updates", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    // Find the student
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Create progress update
    const newProgressUpdate = {
      content,
      timestamp: new Date(),
      hasAdminFeedback: false
    };
    
    // Add to student's progress updates
    if (!student.progressUpdates) {
      student.progressUpdates = [];
    }
    
    student.progressUpdates.push(newProgressUpdate);
    await student.save();
    
    // Return the new progress update
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

// **📋 Student: Get All Progress Updates**
app.get("/api/progress-updates", authenticateToken, async (req, res) => {
  try {
    // Find the student
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Return progress updates in reverse chronological order (newest first)
    const updates = student.progressUpdates || [];
    updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(updates);
  } catch (error) {
    console.error("Error fetching progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

// **📊 Admin: Get All Students' Progress Updates**
app.get("/api/admin/progress-updates", authenticateToken, async (req, res) => {
  try {
    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    // Find all students
    const students = await Student.find({ role: 'student' });
    
    // Collect all progress updates
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
    
    // Sort by timestamp (newest first)
    allUpdates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allUpdates);
  } catch (error) {
    console.error("Error fetching all progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

// **📝 Admin: Add Feedback to a Progress Update**
app.post("/api/admin/progress-updates/:updateId/feedback", authenticateToken, async (req, res) => {
  try {
    const { updateId } = req.params;
    const { feedback } = req.body;
    
    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    // Find student with this progress update
    const student = await Student.findOne({ 
      "progressUpdates._id": updateId 
    });
    
    if (!student) {
      return res.status(404).json({ error: "Progress update not found" });
    }
    
    // Find and update the specific progress update
    const progressUpdateIndex = student.progressUpdates.findIndex(
      update => update._id.toString() === updateId
    );
    
    if (progressUpdateIndex === -1) {
      return res.status(404).json({ error: "Progress update not found" });
    }
    
    // Update the progress update with feedback
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

// Admin: Add Feedback to a Project
app.post("/api/admin/projects/:projectId/feedback", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { feedback, studentId } = req.body;
    
    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Add feedback to project
    if (!project.feedback) {
      project.feedback = [];
    }
    
    project.feedback.push({
      content: feedback,
      date: new Date(),
      adminId: req.user.id,
      studentId: studentId // Target specific student if provided
    });
    
    // Update project
    await project.save();
    
    // If studentId is provided, also add notification to that student
    if (studentId) {
      const student = await Student.findById(studentId);
      
      if (student) {
        // Add feedback to the student's project record
        const studentProjectIndex = student.assignedProjects.findIndex(
          p => p._id.toString() === projectId || p.toString() === projectId
        );
        
        if (studentProjectIndex !== -1) {
          // If assignedProjects contains full project objects
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
            // If assignedProjects contains only IDs, we need a different approach
            // Create a new field for project feedback if it doesn't exist
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
        
        // Add notification
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

app.get('/api/verify-token', authenticateToken, (req, res) => {
  // If middleware passes, token is valid
  // Return user data from the token
  res.json({ 
      valid: true,
      user: req.user 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));