const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const retry = require("async-retry");
require('dotenv').config();

// Verify pg is installed
try {
  require('pg');
  console.log('✅ pg package is installed');
} catch (error) {
  console.error('❌ pg package is missing:', error.message);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Sequelize Setup
if (!process.env.NEON_DATABASE_URL) {
  console.error('❌ NEON_DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.NEON_DATABASE_URL, {
  dialect: 'postgres',
  dialectModule: require('pg'), // Explicitly specify pg module
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 2,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// ✅ Neon PostgreSQL Connection with Retry Logic
const connectToDatabase = async () => {
  return retry(
    async () => {
      console.time('DatabaseConnection');
      try {
        await sequelize.authenticate();
        console.log('✅ Neon PostgreSQL Connected');
        await sequelize.sync();
      } catch (err) {
        console.error('❌ Neon PostgreSQL Connection Error:', err);
        throw err;
      } finally {
        console.timeEnd('DatabaseConnection');
      }
      return sequelize;
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000,
      onRetry: (err) => console.log('Retrying connection due to:', err.message)
    }
  );
};

// Pre-warm connection
connectToDatabase().catch(err => console.error('Initial connection failed:', err));

// ✅ Schema Definitions (Sequelize Models)
const Media = sequelize.define('Media', {
  fileName: { type: DataTypes.STRING },
  fileType: { type: DataTypes.STRING },
  fileUrl: { type: DataTypes.STRING },
  uploadDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

const ProjectTask = sequelize.define('ProjectTask', {
  description: { type: DataTypes.STRING },
  isComplete: { type: DataTypes.BOOLEAN, defaultValue: false },
  dueDate: { type: DataTypes.DATE }
}, { timestamps: false });

const ProjectFeedback = sequelize.define('ProjectFeedback', {
  comment: { type: DataTypes.STRING },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  from: { type: DataTypes.STRING }
}, { timestamps: false });

const Project = sequelize.define('Project', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('Not Started', 'Incomplete', 'In Progress', 'Under Review', 'Completed', 'Cancelled'),
    defaultValue: 'Not Started'
  },
  startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  endDate: { type: DataTypes.DATE },
  createdBy: { type: DataTypes.STRING, defaultValue: 'admin' },
  lastModified: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

const Attendance = sequelize.define('Attendance', {
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: {
    type: DataTypes.ENUM('Present', 'Absent', 'Late', 'Half-Day', 'Leave'),
    allowNull: false
  },
  timeIn: { type: DataTypes.STRING },
  timeOut: { type: DataTypes.STRING },
  notes: { type: DataTypes.STRING }
}, { timestamps: false });

const ProgressUpdate = sequelize.define('ProgressUpdate', {
  content: { type: DataTypes.STRING, allowNull: false },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  feedback: { type: DataTypes.STRING },
  hasAdminFeedback: { type: DataTypes.BOOLEAN, defaultValue: false },
  feedbackDate: { type: DataTypes.DATE }
}, { timestamps: false });

const Student = sequelize.define('Student', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'student' },
  profilePicture: { type: DataTypes.STRING },
  joinDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  contactNumber: { type: DataTypes.STRING },
  program: { type: DataTypes.STRING },
  university: { type: DataTypes.STRING },
  graduationYear: { type: DataTypes.INTEGER },
  tasks: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  bio: { type: DataTypes.TEXT },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  lastActive: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  lastLogin: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  notificationSettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      emailNotifications: true,
      attendanceAlerts: true,
      projectUpdates: true,
      systemAlerts: true
    }
  },
  securitySettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      twoFactorAuth: false,
      requirePasswordReset: false,
      sessionTimeout: 30
    }
  }
}, { timestamps: false });

const Intern = sequelize.define('Intern', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  resume: { type: DataTypes.STRING },
  joiningDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  endDate: { type: DataTypes.DATE },
  duration: { type: DataTypes.INTEGER },
  progress: { type: DataTypes.INTEGER, defaultValue: 0 },
  projectRating: { type: DataTypes.INTEGER, defaultValue: 0 },
  tasks: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: 'Active' }
}, { timestamps: false });

const PastIntern = sequelize.define('PastIntern', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  resume: { type: DataTypes.STRING },
  joiningDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  endDate: { type: DataTypes.DATE },
  duration: { type: DataTypes.INTEGER },
  progress: { type: DataTypes.INTEGER, defaultValue: 0 },
  projectRating: { type: DataTypes.INTEGER, defaultValue: 0 },
  tasks: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: 'Active' },
  deletedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  deletedProjects: { type: DataTypes.JSONB, defaultValue: [] },
  completionRate: { type: DataTypes.INTEGER },
  performanceRating: { type: DataTypes.INTEGER }
}, { timestamps: false });

// Define Relationships
Student.hasMany(Attendance, { foreignKey: 'studentId' });
Attendance.belongsTo(Student, { foreignKey: 'studentId' });

Student.hasMany(ProgressUpdate, { foreignKey: 'studentId' });
ProgressUpdate.belongsTo(Student, { foreignKey: 'studentId' });

Student.belongsToMany(Project, { through: 'StudentProjects', foreignKey: 'studentId' });
Project.belongsToMany(Student, { through: 'StudentProjects', foreignKey: 'projectId' });

Project.hasMany(Media, { foreignKey: 'projectId' });
Media.belongsTo(Project, { foreignKey: 'projectId' });
Media.belongsTo(Student, { foreignKey: 'uploadedBy' });

Project.hasMany(ProjectTask, { foreignKey: 'projectId' });
ProjectTask.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(ProjectFeedback, { foreignKey: 'projectId' });
ProjectFeedback.belongsTo(Project, { foreignKey: 'projectId' });

Intern.hasMany(Attendance, { foreignKey: 'internId' });
Attendance.belongsTo(Intern, { foreignKey: 'internId' });

Intern.hasMany(ProgressUpdate, { foreignKey: 'internId' });
ProgressUpdate.belongsTo(Intern, { foreignKey: 'internId' });

Intern.belongsTo(Student, { foreignKey: 'studentId' });
PastIntern.belongsTo(Student, { foreignKey: 'studentId' });

// Middleware for Authentication
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

// Routes (same as before, included for completeness)
app.get('/', (req, res) => res.json({ message: 'API is working' }));

app.post("/api/admin/students", async (req, res) => {
  try {
    await connectToDatabase();
    const { name, email, username, password, program, university, graduationYear, contactNumber, skills } = req.body;
    
    const existingUser = await Student.findOne({ where: { [Op.or]: [{ email }, { username }] } });
    if (existingUser) {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newStudent = await Student.create({
      name,
      email,
      username,
      password: hashedPassword,
      program,
      university,
      graduationYear,
      contactNumber,
      tasks: skills || []
    });
    
    res.status(201).json({ 
      message: "Student added successfully!",
      studentId: newStudent.id
    });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Error adding student" });
  }
});

app.get("/api/admin/students", async (req, res) => {
  try {
    await connectToDatabase();
    const students = await Student.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Project, through: { attributes: [] } }]
    });
    
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Error fetching students" });
  }
});

app.get("/api/admin/students/:id", async (req, res) => {
  try {
    await connectToDatabase();
    const student = await Student.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Project, through: { attributes: [] } }]
    });
    
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ error: "Error fetching student details" });
  }
});

app.post("/api/admin/projects", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { title, description, assignedTo, tasks, endDate } = req.body;
    
    const newProject = await Project.create({
      title,
      description,
      endDate: endDate ? new Date(endDate) : null,
    });
    
    if (assignedTo && assignedTo.length > 0) {
      await newProject.setStudents(assignedTo);
    }
    
    if (tasks && tasks.length > 0) {
      const taskRecords = tasks.map(task => ({
        description: task.description,
        isComplete: task.isComplete || false,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        projectId: newProject.id
      }));
      await ProjectTask.bulkCreate(taskRecords);
    }
    
    res.status(201).json({ 
      message: "Project created successfully!",
      project: newProject
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Error creating project" });
  }
});

app.get("/api/admin/projects", async (req, res) => {
  try {
    await connectToDatabase();
    const projects = await Project.findAll({
      include: [{ model: Student, attributes: ['name', 'email'], through: { attributes: [] } }]
    });
    
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Error fetching projects" });
  }
});

app.get("/api/admin/projects/:id", async (req, res) => {
  try {
    await connectToDatabase();
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: Student, attributes: ['name', 'email'], through: { attributes: [] } },
        { model: Media, attributes: ['fileName', 'fileType', 'fileUrl', 'uploadDate', 'uploadedBy'] }
      ]
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

app.put("/api/admin/projects/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { title, description, status, assignedTo, tasks, feedback } = req.body;
    
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    if (title) project.title = title;
    if (description) project.description = description;
    if (status) project.status = status;
    if (assignedTo) await project.setStudents(assignedTo);
    
    if (tasks) {
      await ProjectTask.destroy({ where: { projectId: project.id } });
      const taskRecords = tasks.map(task => ({
        description: task.description,
        isComplete: task.isComplete || false,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        projectId: project.id
      }));
      await ProjectTask.bulkCreate(taskRecords);
    }
    
    if (feedback) {
      await ProjectFeedback.create({
        comment: feedback,
        from: req.user.role || 'admin',
        projectId: project.id
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

app.post("/api/admin/attendance/:studentId", async (req, res) => {
  try {
    await connectToDatabase();
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const student = await Student.findByPk(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    const attendance = await Attendance.create({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes,
      studentId: student.id
    });
    
    res.status(201).json({ 
      message: "Attendance recorded successfully!",
      attendance
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
});

app.post("/api/student/login", async (req, res) => {
  try {
    await connectToDatabase();
    const { username, email, password } = req.body;

    // Log request body for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Login request body:', { username, email, password });
    }

    // Validate inputs
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    if (!username && !email) {
      return res.status(400).json({ error: "Username or email is required" });
    }

    // Build dynamic WHERE conditions
    const whereConditions = [];
    if (username && typeof username === 'string' && username.trim()) {
      whereConditions.push({ username: username.trim() });
    }
    if (email && typeof email === 'string' && email.trim()) {
      whereConditions.push({ email: email.trim() });
    }

    if (whereConditions.length === 0) {
      return res.status(400).json({ error: "Valid username or email is required" });
    }

    // Query student with dynamic conditions
    const student = await Student.findOne({
      where: {
        [Op.or]: whereConditions
      }
    });

    if (!student) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: student.id, role: student.role || 'student' },
      "secret_key",
      { expiresIn: "1d" }
    );

    student.lastActive = new Date();
    await student.save();

    res.json({
      token,
      studentId: student.id,
      name: student.name,
      role: student.role || 'student'
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get("/api/student/profile/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const student = await Student.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Project, through: { attributes: [] } }]
    });
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    res.json(student);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Error fetching profile" });
  }
});

app.get("/api/student/projects/:projectId", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { projectId } = req.params;
    
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const student = await Student.findByPk(req.user.id, {
      include: [{ model: Project, through: { attributes: [] } }]
    });
    const hasAccess = student.Projects.some(p => p.id === parseInt(projectId)) || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Error fetching project details" });
  }
});

app.post("/api/student/progress/:projectId", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { projectId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    const student = await Student.findByPk(req.user.id, {
      include: [{ model: Project, through: { attributes: [] } }]
    });
    const hasAccess = student.Projects.some(p => p.id === parseInt(projectId)) || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const progressUpdate = await ProgressUpdate.create({
      content,
      studentId: student.id
    });
    
    const project = await Project.findByPk(projectId);
    if (project && project.status === "Not Started") {
      project.status = "In Progress";
      project.lastModified = new Date();
      await project.save();
    }
    
    if (project) {
      await ProjectFeedback.create({
        comment: `Progress update: ${content}`,
        from: student.name,
        projectId
      });
    }
    
    res.status(201).json({ 
      message: "Progress update submitted successfully!",
      update: progressUpdate
    });
  } catch (error) {
    console.error("Error submitting progress update:", error);
    res.status(500).json({ error: "Error submitting progress update" });
  }
});

app.put("/api/student/profile", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { contactNumber, skills, bio } = req.body;
    
    const student = await Student.findByPk(req.user.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    if (contactNumber) student.contactNumber = contactNumber;
    if (skills) student.tasks = skills;
    if (bio) student.bio = bio;
    
    await student.save();
    
    res.json({ 
      message: "Profile updated successfully",
      student: {
        name: student.name,
        email: student.email,
        contactNumber: student.contactNumber,
        skills: student.tasks,
        bio: student.bio
      }
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Error updating profile" });
  }
});

app.get("/api/interns/past", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const pastInterns = await PastIntern.findAll({
      include: [{ model: Student, attributes: ['name', 'email', 'username'] }],
      order: [['deletedAt', 'DESC']]
    });

    const pastInternsWithStats = pastInterns.map(intern => {
      const deletedProjects = intern.deletedProjects || [];
      const completedProjects = deletedProjects.filter(p => p.status === "Completed").length;
      const totalProjects = deletedProjects.length;
      const completionRate = totalProjects > 0 
        ? Math.round((completedProjects / totalProjects) * 100) 
        : 0;

      return {
        ...intern.toJSON(),
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

app.get("/api/interns/past/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const pastIntern = await PastIntern.findByPk(req.params.id, {
      include: [{ model: Student, attributes: ['name', 'email', 'username', 'contactNumber', 'university'] }]
    });

    if (!pastIntern) {
      return res.status(404).json({ error: "Past intern not found" });
    }

    const deletedProjects = pastIntern.deletedProjects || [];
    const completedProjects = deletedProjects.filter(p => p.status === "Completed");
    const inProgressProjects = deletedProjects.filter(p => p.status === "In Progress");
    const completionRate = deletedProjects.length > 0
      ? Math.round((completedProjects.length / deletedProjects.length) * 100)
      : 0;

    const response = {
      ...pastIntern.toJSON(),
      stats: {
        completionRate,
        completedProjects: completedProjects.length,
        inProgressProjects: inProgressProjects.length,
        totalProjects: deletedProjects.length,
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

app.get("/api/interns", async (req, res) => {
  try {
    await connectToDatabase();
    const interns = await Intern.findAll({
      include: [{ model: Student, attributes: ['name', 'email', 'username'] }]
    });
    
    const formattedInterns = interns.map(intern => ({
      id: intern.id,
      name: intern.Student ? intern.Student.name : intern.name,
      email: intern.Student ? intern.Student.email : intern.email,
      progress: intern.progress || 0,
      duration: intern.duration || 3,
      status: intern.status || 'Active',
      joiningDate: intern.joiningDate,
      tasks: intern.tasks || [],
      university: intern.Student ? intern.Student.university : null,
      dailyProgress: [],
      attendance: [],
      student: intern.Student
    }));
    
    res.json(formattedInterns);
  } catch (error) {
    console.error("Error fetching interns:", error);
    res.status(500).json({ error: "Error fetching interns: " + error.message });
  }
});

app.post("/api/interns", async (req, res) => {
  console.log("Starting /api/interns request with body:", req.body);
  try {
    await connectToDatabase();
    const { name, email, studentId, duration, username, password, tasks } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const newIntern = await Intern.create({
      name,
      email,
      duration: duration || 3,
      studentId
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
      await newIntern.save();
      console.log("Tasks array processed:", tasksArray);
    }

    if (username && password) {
      const existingUser = await Student.findOne({ where: { username } });
      console.log("Checked for existing user with username:", username);
      if (existingUser && (!studentId || existingUser.id !== parseInt(studentId))) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Password hashed");

      if (studentId) {
        await Student.update(
          { username, password: hashedPassword },
          { where: { id: studentId } }
        );
        studentAccount = await Student.findByPk(studentId);
        console.log("Updated existing student account:", studentId);
      } else {
        const newStudent = await Student.create({ name, email, username, password: hashedPassword });
        studentAccount = newStudent;
        newIntern.studentId = studentAccount.id;
        await newIntern.save();
        console.log("Created new student account:", studentAccount.id);
      }

      if (studentAccount && tasksArray.length > 0) {
        const projectRecords = tasksArray.map(taskName => ({
          title: taskName,
          description: `Task assigned to ${name}: ${taskName}`,
          status: "Not Started",
          createdBy: 'admin'
        }));
        const projects = await Project.bulkCreate(projectRecords);
        
        await studentAccount.setProjects(projects.map(p => p.id));
        console.log("Updated student with project IDs:", projects.map(p => p.id));
      }
    }

    res.status(201).json({
      message: "Intern added successfully!",
      intern: newIntern,
      studentAccount: studentAccount ? { id: studentAccount.id, username: studentAccount.username } : null
    });
  } catch (error) {
    console.error("Error adding intern:", error);
    res.status(500).json({ error: "Error adding intern: " + error.message });
  }
});

app.put("/api/interns/:id", async (req, res) => {
  try {
    await connectToDatabase();
    const internId = req.params.id;
    const { name, email, joiningDate, duration, tasks } = req.body;
    
    const intern = await Intern.findByPk(internId);
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
      
      if (intern.studentId) {
        const studentId = intern.studentId;
        
        const newTasks = tasksArray.filter(task => !oldTasks.includes(task));
        
        if (newTasks.length > 0) {
          const projectRecords = newTasks.map(taskName => ({
            title: taskName,
            description: `Task assigned to ${intern.name}: ${taskName}`,
            status: "Not Started",
            createdBy: 'admin'
          }));
          
          const projects = await Project.bulkCreate(projectRecords);
          const student = await Student.findByPk(studentId);
          await student.addProjects(projects.map(p => p.id));
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

app.post("/api/interns/:id/progress", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress content is required" });
    }
    
    const intern = await Intern.findByPk(req.params.id);
    
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    const progressUpdate = await ProgressUpdate.create({
      content,
      internId: intern.id
    });
    
    const totalTasks = intern.tasks ? intern.tasks.length : 0;
    const completedTasks = await ProgressUpdate.count({ where: { internId: intern.id } });
    
    if (totalTasks > 0) {
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
      update: progressUpdate
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Error updating progress: " + error.message });
  }
});

app.delete("/api/admin/projects/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    await sequelize.model('StudentProjects').destroy({ where: { projectId: project.id } });
    await Media.destroy({ where: { projectId: project.id } });
    await ProjectTask.destroy({ where: { projectId: project.id } });
    await ProjectFeedback.destroy({ where: { projectId: project.id } });
    
    await project.destroy();
    
    res.json({ 
      message: "Project deleted successfully!",
      deletedProjectId: req.params.id
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Error deleting project" });
  }
});

app.post("/api/interns/:id/attendance", async (req, res) => {
  try {
    await connectToDatabase();
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const intern = await Intern.findByPk(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    const attendance = await Attendance.create({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes,
      internId: intern.id
    });
    
    res.status(201).json({
      message: "Attendance recorded successfully!",
      attendance
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
});

app.delete("/api/interns/:id", async (req, res) => {
  try {
    await connectToDatabase();
    const intern = await Intern.findByPk(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    let deletedProjectsInfo = [];
    
    const studentId = intern.studentId;
    
    if (studentId) {
      const student = await Student.findByPk(studentId, {
        include: [{ model: Project, through: { attributes: [] } }]
      });
      
      if (student && student.Projects && student.Projects.length > 0) {
        deletedProjectsInfo = student.Projects.map(project => ({
          title: project.title,
          description: project.description,
          status: project.status
        }));
        
        await Project.destroy({ where: { id: student.Projects.map(p => p.id) } });
        await sequelize.model('StudentProjects').destroy({ where: { studentId } });
      }
    }
    
    const pastIntern = await PastIntern.create({
      ...intern.toJSON(),
      deletedProjects: deletedProjectsInfo
    });
    
    await intern.destroy();
    
    res.json({ 
      message: "Intern and associated projects moved to past interns",
      pastInternId: pastIntern.id,
      deletedProjects: deletedProjectsInfo.length
    });
  } catch (error) {
    console.error("Error deleting intern:", error);
    res.status(500).json({ error: "Error deleting intern" });
  }
});

app.put("/api/interns/:id/credentials", async (req, res) => {
  try {
    await connectToDatabase();
    const { username, password } = req.body;
    
    const intern = await Intern.findByPk(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }
    
    if (username) {
      const existingUser = await Student.findOne({ 
        where: { username, id: { [Op.ne]: intern.studentId } }
      });
      
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }
    
    if (intern.studentId) {
      const updates = { username };
      
      if (password) {
        updates.password = await bcrypt.hash(password, 10);
      }
      
      await Student.update(updates, { where: { id: intern.studentId } });
      
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

app.get("/api/admin/student-credentials/:studentId", async (req, res) => {
  try {
    await connectToDatabase();
    const student = await Student.findByPk(req.params.studentId, {
      attributes: ['username']
    });
    
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

app.post("/api/admin/student/:id/attendance", async (req, res) => {
  try {
    await connectToDatabase();
    const { date, status, timeIn, timeOut, notes } = req.body;
    
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    const attendance = await Attendance.create({
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes,
      studentId: student.id
    });
    
    res.status(201).json({ 
      message: "Attendance recorded successfully", 
      attendance
    });
  } catch (error) {
    console.error("Error recording attendance:", error);
    res.status(500).json({ error: "Error recording attendance" });
  }
});

app.get("/api/admin/student/:id/attendance", async (req, res) => {
  try {
    await connectToDatabase();
    const student = await Student.findByPk(req.params.id, {
      include: [{ model: Attendance }]
    });
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    res.json(student.Attendances || []);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ error: "Error fetching attendance records" });
  }
});

app.get("/api/admin/profile", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findByPk(req.user.id);
    
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

app.put("/api/admin/profile", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { name, email, username } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findByPk(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    if (email && email !== admin.email) {
      const existingEmail = await Student.findOne({ where: { email, id: { [Op.ne]: req.user.id } } });
      if (existingEmail) {
        return res.status(400).json({ error: "Email is already in use" });
      }
    }
    
    if (username && username !== admin.username) {
      const existingUsername = await Student.findOne({ where: { username, id: { [Op.ne]: req.user.id } } });
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

app.put("/api/admin/password", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { currentPassword, newPassword } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    
    const admin = await Student.findByPk(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    
    await admin.save();
    
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating admin password:", error);
    res.status(500).json({ error: "Error updating admin password" });
  }
});

app.put("/api/admin/settings/notifications", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { emailNotifications, attendanceAlerts, projectUpdates, systemAlerts } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findByPk(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    admin.notificationSettings = {
      emailNotifications: emailNotifications !== undefined ? emailNotifications : admin.notificationSettings.emailNotifications,
      attendanceAlerts: attendanceAlerts !== undefined ? attendanceAlerts : admin.notificationSettings.attendanceAlerts,
      projectUpdates: projectUpdates !== undefined ? projectUpdates : admin.notificationSettings.projectUpdates,
      systemAlerts: systemAlerts !== undefined ? systemAlerts : admin.notificationSettings.systemAlerts
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

app.put("/api/admin/settings/security", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { twoFactorAuth, requirePasswordReset, sessionTimeout } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const admin = await Student.findByPk(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ error: "Admin profile not found" });
    }
    
    admin.securitySettings = {
      twoFactorAuth: twoFactorAuth !== undefined ? twoFactorAuth : admin.securitySettings.twoFactorAuth,
      requirePasswordReset: requirePasswordReset !== undefined ? requirePasswordReset : admin.securitySettings.requirePasswordReset,
      sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : admin.securitySettings.sessionTimeout
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

app.post("/api/progress-updates", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Progress update content is required" });
    }
    
    const student = await Student.findByPk(req.user.id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    const newProgressUpdate = await ProgressUpdate.create({
      content,
      timestamp: new Date(),
      hasAdminFeedback: false,
      studentId: student.id
    });
    
    res.status(201).json({
      id: newProgressUpdate.id,
      content: newProgressUpdate.content,
      timestamp: newProgressUpdate.timestamp,
      studentId: student.id,
      studentName: student.name,
      hasAdminFeedback: false
    });
  } catch (error) {
    console.error("Error submitting progress update:", error);
    res.status(500).json({ error: "Failed to submit progress update" });
  }
});

app.get("/api/progress-updates", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const student = await Student.findByPk(req.user.id, {
      include: [{ model: ProgressUpdate }]
    });
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    const updates = student.ProgressUpdates || [];
    updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(updates);
  } catch (error) {
    console.error("Error fetching progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

app.get("/api/admin/progress-updates", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    const students = await Student.findAll({
      where: { role: 'student' },
      include: [{ model: ProgressUpdate }]
    });
    
    const allUpdates = students.flatMap(student =>
      (student.ProgressUpdates || []).map(update => ({
        id: update.id,
        content: update.content,
        timestamp: update.timestamp,
        feedback: update.feedback,
        hasAdminFeedback: update.hasAdminFeedback,
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email
      }))
    );
    
    allUpdates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allUpdates);
  } catch (error) {
    console.error("Error fetching all progress updates:", error);
    res.status(500).json({ error: "Failed to fetch progress updates" });
  }
});

app.post("/api/admin/progress-updates/:updateId/feedback", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { updateId } = req.params;
    const { feedback } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    const progressUpdate = await ProgressUpdate.findByPk(updateId);
    
    if (!progressUpdate) {
      return res.status(404).json({ error: "Progress update not found" });
    }
    
    progressUpdate.feedback = feedback;
    progressUpdate.hasAdminFeedback = true;
    progressUpdate.feedbackDate = new Date();
    
    await progressUpdate.save();
    
    res.json({
      message: "Feedback added successfully",
      update: progressUpdate
    });
  } catch (error) {
    console.error("Error adding feedback to progress update:", error);
    res.status(500).json({ error: "Failed to add feedback" });
  }
});

app.post("/api/admin/projects/:projectId/feedback", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const { projectId } = req.params;
    const { feedback, studentId } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
    
    if (!feedback) {
      return res.status(400).json({ error: "Feedback content is required" });
    }
    
    const project = await Project.findByPk(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const projectFeedback = await ProjectFeedback.create({
      comment: feedback,
      date: new Date(),
      from: 'admin',
      projectId
    });
    
    if (studentId) {
      const student = await Student.findByPk(studentId);
      
      if (student) {
        // Note: Project feedback is stored in ProjectFeedback table
      }
    }
    
    res.json({
      message: "Feedback added successfully",
      project
    });
  } catch (error) {
    console.error("Error adding feedback to project:", error);
    res.status(500).json({ error: "Failed to add feedback" });
  }
});

app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user 
  });
});

app.get("/health", async (req, res) => {
  try {
    if (!process.env.NEON_DATABASE_URL) {
      return res.status(500).json({ 
        status: "error", 
        time: new Date().toISOString(),
        message: "NEON_DATABASE_URL environment variable is not set"
      });
    }
    await connectToDatabase();
    res.status(200).json({ 
      status: "ok", 
      time: new Date().toISOString(),
      message: "NCAI Portal API is running",
      databaseUrl: process.env.NEON_DATABASE_URL ? "Set" : "Not set"
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ 
      status: "error", 
      time: new Date().toISOString(),
      message: "Database connection failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  
  res.status(500).json({ 
    error: "An unexpected error occurred",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;