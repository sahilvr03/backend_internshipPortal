const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Intern = require("../models/Intern");
const PastIntern = require("../models/PastIntern");
const Student = require("../models/Student");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Get all interns (current) with COMBINED attributes and sorted by createdAt
router.get("/", async (req, res) => {
  try {
    // Populate student details including additional fields
    const interns = await Intern.find({
      deletedAt: { $exists: false },
    }).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt"
    );

    const formattedInterns = interns.map((intern) => {
      const studentName = intern.student ? intern.student.name : intern.name;
      const studentEmail = intern.student ? intern.student.email : intern.email;

      // Combine attendance arrays
      const adminAttendance = intern.attendance || [];
      const studentAttendance = intern.student ? intern.student.attendance : [];
      let combinedAttendance = [...adminAttendance, ...studentAttendance].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      return {
        _id: intern._id,
        name: studentName,
        email: studentEmail,
        progress: intern.progress || 0,
        duration: intern.duration || 3,
        status: intern.status || "Active",
        joiningDate: intern.joiningDate,
        tasks: intern.tasks || [],
        university: intern.student?.university || intern.university,
        department: intern.student?.department || "N/A",
        domain: intern.student?.domain || "N/A",
        week: intern.student?.week || "N/A",
        program: intern.student?.program || "N/A",
        contactNumber: intern.student?.contactNumber || "N/A",
        bio: intern.student?.bio || "N/A",
        createdAt: intern.student?.createdAt || intern.createdAt,
        attendance: combinedAttendance,
        student: intern.student
          ? {
              _id: intern.student._id,
              name: intern.student.name,
              email: intern.student.email,
              username: intern.student.username,
              department: intern.student.department,
              domain: intern.student.domain,
              week: intern.student.week,
              program: intern.student.program,
              university: intern.student.university,
              contactNumber: intern.student.contactNumber,
              bio: intern.student.bio,
              createdAt: intern.student.createdAt,
            }
          : null,
      };
    });

    // Sort by createdAt (latest first)
    formattedInterns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    const pastInterns = await PastIntern.find().populate(
      "student",
      "name email username department domain week program university contactNumber bio"
    );

    console.log(`Found ${pastInterns.length} past interns`);
    res.json(pastInterns);
  } catch (error) {
    console.error("Error finding past interns:", error);
    res.status(500).json({ error: "Error retrieving past interns: " + error.message });
  }
});

// Get Single Intern Details with COMBINED attendance
router.get("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt"
    );

    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    // Combine attendance
    const adminAttendance = intern.attendance || [];
    const studentAttendance = intern.student ? intern.student.attendance : [];
    intern.attendance = [...adminAttendance, ...studentAttendance].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json(intern);
  } catch (error) {
    console.error("Error finding intern:", error);
    res.status(500).json({ error: "Error retrieving intern: " + error.message });
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
      student: studentId,
    });

    let studentAccount = null;
    let tasksArray = [];

    if (tasks) {
      if (typeof tasks === "string") {
        tasksArray = tasks.split(",").map((task) => task.trim()).filter((task) => task);
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
          password: hashedPassword,
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
            createdBy: "admin",
          });
          const savedProject = await project.save();
          projectIds.push(savedProject._id);
        }
        if (projectIds.length > 0) {
          await Student.findByIdAndUpdate(studentAccount._id, {
            $push: { assignedProjects: { $each: projectIds } },
          });
        }
      }
    }

    await newIntern.save();

    res.status(201).json({
      message: "Intern added successfully!",
      intern: newIntern,
      studentAccount: studentAccount ? { id: studentAccount._id, username: studentAccount.username } : null,
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
      if (typeof tasks === "string") {
        tasksArray = tasks.split(",").map((task) => task.trim()).filter((task) => task);
      } else if (Array.isArray(tasks)) {
        tasksArray = tasks;
      }

      const oldTasks = intern.tasks || [];
      intern.tasks = tasksArray;

      if (intern.student) {
        const studentId = intern.student;
        const newTasks = tasksArray.filter((task) => !oldTasks.includes(task));

        if (newTasks.length > 0) {
          const projectIds = [];
          for (const taskName of newTasks) {
            const project = new Project({
              title: taskName,
              description: `Task assigned to ${intern.name}: ${taskName}`,
              status: "Not Started",
              assignedTo: [studentId],
              createdBy: "admin",
            });
            const savedProject = await project.save();
            projectIds.push(savedProject._id);
          }
          if (projectIds.length > 0) {
            await Student.findByIdAndUpdate(studentId, {
              $push: { assignedProjects: { $each: projectIds } },
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

// Mark Intern Attendance
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
      notes,
    });

    await intern.save();

    res.status(201).json({
      message: "Attendance marked successfully!",
      attendance: intern.attendance[intern.attendance.length - 1],
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// Delete an Intern (Move to Past Interns)
router.delete("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio assignedProjects createdAt"
    );
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    let deletedProjectsInfo = [];
    const studentId = intern.student ? intern.student._id : null;

    // Capture project details if the intern has an associated student
    if (studentId) {
      const student = await Student.findById(studentId).populate("assignedProjects");
      if (student && student.assignedProjects && student.assignedProjects.length > 0) {
        deletedProjectsInfo = student.assignedProjects.map((project) => ({
          _id: project._id,
          title: project.title,
          description: project.description,
          status: project.status,
        }));

        // Optionally, update projects to remove the student from assignedTo
        await Project.updateMany(
          { _id: { $in: student.assignedProjects.map((p) => p._id) } },
          { $pull: { assignedTo: studentId } }
        );

        // Remove project references from the student
        await Student.findByIdAndUpdate(studentId, {
          $set: { assignedProjects: [] },
        });
      }
    }

    // Create a new PastIntern record
    const pastIntern = new PastIntern({
      name: intern.student ? intern.student.name : intern.name,
      email: intern.student ? intern.student.email : intern.email,
      progress: intern.progress || 0,
      duration: intern.duration || 3,
      joiningDate: intern.joiningDate,
      tasks: intern.tasks || [],
      university: intern.student?.university || intern.university,
      department: intern.student?.department || "N/A",
      domain: intern.student?.domain || "N/A",
      week: intern.student?.week || "N/A",
      program: intern.student?.program || "N/A",
      contactNumber: intern.student?.contactNumber || "N/A",
      bio: intern.student?.bio || "N/A",
      student: studentId,
      deletedAt: new Date(),
      deletedProjects: deletedProjectsInfo,
      attendance: [...(intern.attendance || []), ...(intern.student?.attendance || [])].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
      createdAt: intern.student?.createdAt || intern.createdAt,
    });

    await pastIntern.save();

    // Delete the intern from the Intern collection
    await Intern.findByIdAndDelete(req.params.id);

    console.log(`Intern ${intern.name} moved to past interns with ${deletedProjectsInfo.length} projects`);

    res.json({ message: "Intern moved to past interns successfully!" });
  } catch (error) {
    console.error("Error deleting intern:", error);
    res.status(500).json({ error: "Error deleting intern: " + error.message });
  }
});

module.exports = router;