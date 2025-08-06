const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const PendingStudent = require("../models/pendingStudents");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Student Registration - Stores in PendingStudent collection for admin approval
router.post("/register", async (req, res) => {
    console.log("--- Student Registration Attempt ---");
    const { name, email, username, password, contactNumber, program, university, graduationYear, bio, domain, weeks, dob, linkedin, resume, profilePic } = req.body;

    try {
        // Validate required fields
        if (!name || !email || !username || !password) {
            console.warn("Registration error: Missing required fields");
            return res.status(400).json({ error: "Name, email, username, and password are required." });
        }

        // Check for existing active student
        const existingStudent = await Student.findOne({ $or: [{ email }, { username }] });
        if (existingStudent) {
            console.warn(`Registration error: Email (${email}) or username (${username}) already in use`);
            return res.status(400).json({ error: "Email or username is already in use by an active student account." });
        }

        // Check for existing pending student
        const existingPendingStudent = await PendingStudent.findOne({ $or: [{ email }, { username }] });
        if (existingPendingStudent) {
            console.warn(`Registration error: Pending registration for email (${email}) or username (${username})`);
            return res.status(400).json({ error: "A registration request is already pending for this email or username." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Password hashed successfully");

        // Create new pending student
        const pendingStudent = new PendingStudent({
            name,
            email,
            username,
            password: hashedPassword,
            contactNumber,
            program,
            university,
            graduationYear,
            bio,
            domain,
            weeks,
            dob,
            linkedin,
            resume,
            profilePic,
            createdAt: new Date(),
        });

        await pendingStudent.save();
        console.log("Pending student saved:", pendingStudent._id);

        res.status(201).json({ message: "Registration request submitted successfully. Awaiting admin approval." });
    } catch (error) {
        console.error("Student registration error:", error);
        res.status(500).json({ error: "Server error during registration: " + error.message });
    } finally {
        console.log("--- Student Registration Attempt End ---");
    }
});

// Get All Pending Students - Admin only
router.get("/pending-students", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            console.warn("Unauthorized access to pending students");
            return res.status(403).json({ error: "Access denied. Admin only." });
        }

        const pendingStudents = await PendingStudent.find().select('-password');
        console.log(`Fetched ${pendingStudents.length} pending students`);
        res.json(pendingStudents);
    } catch (error) {
        console.error("Error fetching pending students:", error);
        res.status(500).json({ error: "Error fetching pending students: " + error.message });
    }
});

// Accept Pending Student - Admin only
router.post("/pending-students/:id/accept", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            console.warn("Unauthorized attempt to accept pending student");
            return res.status(403).json({ error: "Access denied. Admin only." });
        }

        const pendingStudent = await PendingStudent.findById(req.params.id);
        if (!pendingStudent) {
            console.warn(`Pending student not found: ${req.params.id}`);
            return res.status(404).json({ error: "Pending student not found" });
        }

        // Create new active student
        const newStudent = new Student({
            name: pendingStudent.name,
            email: pendingStudent.email,
            username: pendingStudent.username,
            password: pendingStudent.password,
            contactNumber: pendingStudent.contactNumber,
            program: pendingStudent.program,
            university: pendingStudent.university,
            graduationYear: pendingStudent.graduationYear,
            bio: pendingStudent.bio,
            domain: pendingStudent.domain,
            weeks: pendingStudent.weeks,
            dob: pendingStudent.dob,
            linkedin: pendingStudent.linkedin,
            resume: pendingStudent.resume,
            profilePic: pendingStudent.profilePic,
            role: 'student',
            joinDate: new Date(),
            notificationSettings: pendingStudent.notificationSettings,
            securitySettings: pendingStudent.securitySettings,
            status: 'Active',
            createdAt: new Date(),
            lastActive: new Date(),
            lastLogin: new Date(),
        });

        const savedStudent = await newStudent.save();
        console.log(`Student approved: ${savedStudent._id}`);

        // Delete from pending students
        await PendingStudent.findByIdAndDelete(req.params.id);
        console.log(`Pending student deleted: ${req.params.id}`);

        res.json({ message: "Student approved and added to active students", studentId: savedStudent._id });
    } catch (error) {
        console.error("Error accepting pending student:", error);
        res.status(500).json({ error: "Error accepting pending student: " + error.message });
    }
});

// Reject Pending Student - Admin only
router.post("/pending-students/:id/reject", authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            console.warn("Unauthorized attempt to reject pending student");
            return res.status(403).json({ error: "Access denied. Admin only." });
        }

        const pendingStudent = await PendingStudent.findById(req.params.id);
        if (!pendingStudent) {
            console.warn(`Pending student not found: ${req.params.id}`);
            return res.status(404).json({ error: "Pending student not found" });
        }

        await PendingStudent.findByIdAndDelete(req.params.id);
        console.log(`Pending student rejected and deleted: ${req.params.id}`);

        res.json({ message: "Student registration request rejected" });
    } catch (error) {
        console.error("Error rejecting pending student:", error);
        res.status(500).json({ error: "Error rejecting pending student: " + error.message });
    }
});

// Student Login
router.post("/login", async (req, res) => {
    console.log("--- Student Login Attempt ---");
    const { username, email, password } = req.body;

    try {
        // Validate input
        if (!password || (!username && !email)) {
            console.warn("Login error: Missing required fields");
            return res.status(400).json({ error: "Password and either username or email are required." });
        }

        // Check for pending student
        const pendingQuery = username ? { username } : { email };
        const pendingStudent = await PendingStudent.findOne(pendingQuery);
        if (pendingStudent) {
            console.log(`Login blocked: Pending registration for ${username || email}`);
            return res.status(403).json({ error: "Your registration is pending admin approval." });
        }

        // Find active student
        const studentQuery = username ? { username } : { email };
        const student = await Student.findOne(studentQuery);
        if (!student) {
            console.warn(`Login error: No student found for ${username || email}`);
            return res.status(401).json({ error: "Invalid credentials or account not found." });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            console.warn(`Login error: Password mismatch for ${username || email}`);
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: student._id, role: student.role || 'student' },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );
        console.log(`Login successful for ${student.username || student.email}`);

        // Update last active and login times
        student.lastActive = new Date();
        student.lastLogin = new Date();
        await student.save();

        res.json({
            token,
            studentId: student._id,
            name: student.name,
            role: student.role || 'student'
        });
    } catch (error) {
        console.error("Student login error:", error);
        res.status(500).json({ error: "Server error during login: " + error.message });
    } finally {
        console.log("--- Student Login Attempt End ---");
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
        if (!student || (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin')) {
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
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const progressUpdate = {
            date: new Date(),
            content
        };

        if (!student.progressUpdates) {
            student.progressUpdates = [];
        }
        student.progressUpdates.push(progressUpdate);

        const project = await Project.findById(projectId);
        if (project) {
            if (project.status === "Not Started") {
                project.status = "In Progress";
            }
            project.lastModified = new Date();
            project.feedback.push({
                comment: `Student ${student.name} submitted progress update: ${content}`,
                from: student.name,
                date: new Date()
            });
            await project.save();
        } else {
            console.warn(`Project with ID ${projectId} not found when trying to update its status based on student progress.`);
        }

        await student.save();

        res.status(201).json({
            message: "Progress update submitted successfully!",
            update: progressUpdate
        });
    } catch (error) {
        console.error("Error submitting project update:", error);
        res.status(500).json({ error: "Error submitting project update: " + error.message });
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

// Submit General Progress Update
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

        res.status( 201).json({
            _id: createdUpdate._id,
            content: createdUpdate.content,
            timestamp: createdUpdate.timestamp,
            studentId: student._id,
            studentName: student.name,
            hasAdminFeedback: false
        });
    } catch (error) {
        console.error("Error submitting progress update (general):", error);
        res.status(500).json({ error: "Failed to submit progress update" });
    }
});

// Get All Progress Updates for the logged-in student
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