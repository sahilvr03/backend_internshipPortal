const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const PendingStudent = require("../models/PendingStudent"); // Ensure this path is correct
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config(); // Ensure dotenv is loaded for JWT_SECRET


// Student Registration
router.post("/register", async (req, res) => {
    console.log("--- Student Registration Attempt ---");
    const { name, email, username, password, contactNumber, program, university, bio } = req.body;
    console.log("Registration request body:", req.body);

    try {
        if (!name || !email || !username || !password) {
            console.warn("Registration error: Missing required fields (name, email, username, password)");
            return res.status(400).json({ error: "Name, email, username, and password are required." });
        }

        // Check if email or username already exists in active students
        const existingStudent = await Student.findOne({ $or: [{ email }, { username }] });
        if (existingStudent) {
            console.warn(`Registration error: Email (${email}) or username (${username}) already in use by an active student.`);
            return res.status(400).json({ error: "Email or username is already in use by an active student account. Please use different credentials or log in." });
        }

        // Check if email or username already exists in pending students
        const existingPendingStudent = await PendingStudent.findOne({ $or: [{ email }, { username }] });
        if (existingPendingStudent) {
            console.warn(`Registration error: Email (${email}) or username (${username}) already has a pending registration.`);
            return res.status(400).json({ error: "A registration request is already pending for this email or username. Please await admin approval." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Password hashed successfully.");

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
        });

        await pendingStudent.save();
        console.log("Pending student saved successfully:", pendingStudent._id);

        res.status(201).json({ message: "Registration request submitted successfully. Awaiting admin approval." });
    } catch (error) {
        console.error("Student registration error:", error);
        res.status(500).json({ error: "Server error during registration: " + error.message });
    } finally {
        console.log("--- Student Registration Attempt End ---");
    }
});
// Student Login
router.post("/login", async (req, res) => {
    console.log("--- Student Login Attempt ---");
    const { username, email, password } = req.body;
    console.log("Login attempt for:", { username, email });

    try {
        if (!password) {
            console.warn("Login error: Password is required.");
            return res.status(400).json({ error: "Password is required." });
        }

        if (!username && !email) {
            console.warn("Login error: Username or email is required.");
            return res.status(400).json({ error: "Username or email is required." });
        }

        // --- IMPORTANT: Check for pending students FIRST ---
        let pendingStudentQuery = {};
        if (username) {
            pendingStudentQuery = { username };
        } else {
            pendingStudentQuery = { email };
        }

        const pendingStudent = await PendingStudent.findOne(pendingStudentQuery);

        if (pendingStudent) {
            console.log(`Login blocked: Pending registration found for ${username || email}.`);
            return res.status(403).json({ error: "Your registration is pending admin approval. You cannot log in yet." });
        }
        // --- End of Pending Student Check ---

        let studentQuery = {};
        if (username) {
            studentQuery = { username };
        } else {
            studentQuery = { email };
        }

        let student = await Student.findOne(studentQuery);

        if (!student) {
            console.warn(`Login error: No active student found for ${username || email}.`);
            return res.status(401).json({ error: "Invalid credentials or account not found." });
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            console.warn(`Login error: Password mismatch for ${student.username || student.email}.`);
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // If login successful, generate token
        const token = jwt.sign(
            { id: student._id, role: student.role || 'student' },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );
        console.log(`Login successful for student ${student.username || student.email}. Token generated.`);

        // Update last active/login time
        student.lastActive = new Date();
        student.lastLogin = new Date(); // Added this for consistency
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
        if (!student || (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin')) { // Added !student check
            return res.status(403).json({ error: "Access denied" });
        }

        res.json(project);
    } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({ error: "Error fetching project details" });
    }
});

// Submit Project Update (NOTE: This seems to be a general progress update, not specific to a project, though named for it)
router.post("/progress/:projectId", authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params; // This projectId is not used in the progressUpdates push
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: "Progress update content is required" });
        }

        const student = await Student.findById(req.user.id);
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Logic to check if student is assigned to this projectId, if this route is meant for project-specific updates
        // if (!student.assignedProjects.includes(projectId) && req.user.role !== 'admin') {
        //     return res.status(403).json({ error: "Access denied: Not assigned to this project." });
        // }

        const progressUpdate = {
            date: new Date(),
            content
        };

        if (!student.progressUpdates) { // Initialize if null/undefined
            student.progressUpdates = [];
        }
        student.progressUpdates.push(progressUpdate);

        // Update project status to "In Progress" if it was "Not Started"
        const project = await Project.findById(projectId);
        if (project) { // Check if project exists
            if (project.status === "Not Started") {
                project.status = "In Progress";
            }
            project.lastModified = new Date();
            // Also add a feedback entry to the project for this progress update
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
            update: progressUpdate // Return the saved update for client-side use
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

// Submit General Progress Update (without a specific project ID in URL)
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

        // Return the created update with its ID for client-side tracking
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
        // Sort from newest to oldest
        updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(updates);
    } catch (error) {
        console.error("Error fetching progress updates:", error);
        res.status(500).json({ error: "Failed to fetch progress updates" });
    }
});

module.exports = router;
