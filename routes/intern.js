const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Intern = require("../models/Intern");
const PastIntern = require("../models/PastIntern");
const Student = require("../models/Student");
const Project = require("../models/Project");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();

// Get all interns (current) with Student attributes and sorted by createdAt
router.get("/", async (req, res) => {
  try {
    // Populate student details including additional fields
    const interns = await Intern.find({
      deletedAt: { $exists: false },
    }).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt assignedProjects progressUpdates lastActive"
    );

    const formattedInterns = interns.map((intern) => {
      // Prefer Student model fields when available, fall back to Intern fields
      const studentName = intern.student ? intern.student.name : intern.name;
      const studentEmail = intern.student ? intern.student.email : intern.email;

      // Combine attendance arrays
      const adminAttendance = intern.attendance || [];
      const studentAttendance = intern.student ? intern.student.attendance || [] : [];
      let combinedAttendance = [...adminAttendance, ...studentAttendance].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      // Combine progress updates
      const adminProgressUpdates = intern.dailyProgress || [];
      const studentProgressUpdates = intern.student ? intern.student.progressUpdates || [] : [];
      let combinedProgressUpdates = [...adminProgressUpdates, ...studentProgressUpdates].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
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
        university: intern.student?.university || intern.university || "N/A",
        department: intern.student?.department || "N/A",
        domain: intern.student?.domain || "N/A",
        week: intern.student?.week || "N/A",
        program: intern.student?.program || "N/A",
        contactNumber: intern.student?.contactNumber || "N/A",
        bio: intern.student?.bio || "N/A",
        createdAt: intern.student?.createdAt || intern.createdAt || new Date(),
        lastActive: intern.student?.lastActive || intern.createdAt || new Date(),
        attendance: combinedAttendance,
        progressUpdates: combinedProgressUpdates,
        assignedProjects: intern.student?.assignedProjects || [],
        student: intern.student
          ? {
              _id: intern.student._id,
              name: intern.student.name,
              email: intern.student.email,
              username: intern.student.username,
              department: intern.student.department || "N/A",
              domain: intern.student.domain || "N/A",
              week: intern.student.week || "N/A",
              program: intern.student.program || "N/A",
              university: intern.student.university || "N/A",
              contactNumber: intern.student.contactNumber || "N/A",
              bio: intern.student.bio || "N/A",
              createdAt: intern.student.createdAt || new Date(),
              assignedProjects: intern.student.assignedProjects || [],
              progressUpdates: intern.student.progressUpdates || [],
              attendance: intern.student.attendance || [],
            }
          : null,
      };
    });

    // Sort by createdAt (latest first)
    formattedInterns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Found ${formattedInterns.length} current interns with combined Student data`);
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
      "name email username department domain week program university contactNumber bio createdAt assignedProjects progressUpdates"
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
      department: pastIntern.student?.department || "N/A",
      domain: pastIntern.student?.domain || "N/A",
      week: pastIntern.student?.week || "N/A",
      program: pastIntern.student?.program || "N/A",
      contactNumber: pastIntern.student?.contactNumber || "N/A",
      bio: pastIntern.student?.bio || "N/A",
      createdAt: pastIntern.student?.createdAt || pastIntern.createdAt || new Date(),
      deletedAt: pastIntern.deletedAt,
      deletedProjects: pastIntern.deletedProjects || [],
      attendance: pastIntern.attendance || [],
      progressUpdates: pastIntern.student?.progressUpdates || pastIntern.progressUpdates || [],
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
            createdAt: pastIntern.student.createdAt || new Date(),
            assignedProjects: pastIntern.student.assignedProjects || [],
            progressUpdates: pastIntern.student.progressUpdates || [],
            attendance: pastIntern.student.attendance || [],
          }
        : null,
    }));

    console.log(`Found ${pastInterns.length} past interns`);
    res.json(formattedPastInterns);
  } catch (error) {
    console.error("Error finding past interns:", error);
    res.status(500).json({ error: "Error retrieving past interns: " + error.message });
  }
});

// Get Single Intern Details with combined Student data
router.get("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt assignedProjects progressUpdates lastActive"
    );

    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    // Combine attendance
    const adminAttendance = intern.attendance || [];
    const studentAttendance = intern.student ? intern.student.attendance || [] : [];
    const combinedAttendance = [...adminAttendance, ...studentAttendance].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Combine progress updates
    const adminProgressUpdates = intern.dailyProgress || [];
    const studentProgressUpdates = intern.student ? intern.student.progressUpdates || [] : [];
    const combinedProgressUpdates = [...adminProgressUpdates, ...studentProgressUpdates].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    const formattedIntern = {
      _id: intern._id,
      name: intern.student ? intern.student.name : intern.name,
      email: intern.student ? intern.student.email : intern.email,
      progress: intern.progress || 0,
      duration: intern.duration || 3,
      status: intern.status || "Active",
      joiningDate: intern.joiningDate,
      tasks: intern.tasks || [],
      university: intern.student?.university || intern.university || "N/A",
      department: intern.student?.department || "N/A",
      domain: intern.student?.domain || "N/A",
      week: intern.student?.week || "N/A",
      program: intern.student?.program || "N/A",
      contactNumber: intern.student?.contactNumber || "N/A",
      bio: intern.student?.bio || "N/A",
      createdAt: intern.student?.createdAt || intern.createdAt || new Date(),
      lastActive: intern.student?.lastActive || intern.createdAt || new Date(),
      attendance: combinedAttendance,
      progressUpdates: combinedProgressUpdates,
      assignedProjects: intern.student?.assignedProjects || [],
      student: intern.student
        ? {
            _id: intern.student._id,
            name: intern.student.name,
            email: intern.student.email,
            username: intern.student.username,
            department: intern.student.department || "N/A",
            domain: intern.student.domain || "N/A",
            week: intern.student.week || "N/A",
            program: intern.student.program || "N/A",
            university: intern.student.university || "N/A",
            contactNumber: intern.student.contactNumber || "N/A",
            bio: intern.student.bio || "N/A",
            createdAt: intern.student.createdAt || new Date(),
            assignedProjects: intern.student.assignedProjects || [],
            progressUpdates: intern.student.progressUpdates || [],
            attendance: intern.student.attendance || [],
          }
        : null,
    };

    res.json(formattedIntern);
  } catch (error) {
    console.error("Error finding intern:", error);
    res.status(500).json({ error: "Error retrieving intern: " + error.message });
  }
});

// Add New Intern
router.post("/", async (req, res) => {
  try {
    const { name, email, studentId, duration, username, password, tasks, department, domain, week, program, university, contactNumber, bio } = req.body;

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
          department,
          domain,
          week,
          program,
          university,
          contactNumber,
          bio,
        });
        studentAccount = await Student.findById(studentId);
      } else {
        const newStudent = new Student({
          name,
          email,
          username,
          password: hashedPassword,
          department,
          domain,
          week,
          program,
          university,
          contactNumber,
          bio,
        });
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

    // Fetch the newly created intern with populated student data for response
    const populatedIntern = await Intern.findById(newIntern._id).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt assignedProjects progressUpdates"
    );

    const formattedIntern = {
      _id: populatedIntern._id,
      name: populatedIntern.student ? populatedIntern.student.name : populatedIntern.name,
      email: populatedIntern.student ? populatedIntern.student.email : populatedIntern.email,
      progress: populatedIntern.progress || 0,
      duration: populatedIntern.duration || 3,
      status: populatedIntern.status || "Active",
      joiningDate: populatedIntern.joiningDate,
      tasks: populatedIntern.tasks || [],
      university: populatedIntern.student?.university || populatedIntern.university || "N/A",
      department: populatedIntern.student?.department || "N/A",
      domain: populatedIntern.student?.domain || "N/A",
      week: populatedIntern.student?.week || "N/A",
      program: populatedIntern.student?.program || "N/A",
      contactNumber: populatedIntern.student?.contactNumber || "N/A",
      bio: populatedIntern.student?.bio || "N/A",
      createdAt: populatedIntern.student?.createdAt || populatedIntern.createdAt || new Date(),
      attendance: [...(populatedIntern.attendance || []), ...(populatedIntern.student?.attendance || [])].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
      progressUpdates: [...(populatedIntern.dailyProgress || []), ...(populatedIntern.student?.progressUpdates || [])].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
      assignedProjects: populatedIntern.student?.assignedProjects || [],
      student: populatedIntern.student
        ? {
            _id: populatedIntern.student._id,
            name: populatedIntern.student.name,
            email: populatedIntern.student.email,
            username: populatedIntern.student.username,
            department: populatedIntern.student.department || "N/A",
            domain: populatedIntern.student.domain || "N/A",
            week: populatedIntern.student.week || "N/A",
            program: populatedIntern.student.program || "N/A",
            university: populatedIntern.student.university || "N/A",
            contactNumber: populatedIntern.student.contactNumber || "N/A",
            bio: populatedIntern.student.bio || "N/A",
            createdAt: populatedIntern.student.createdAt || new Date(),
            assignedProjects: populatedIntern.student.assignedProjects || [],
            progressUpdates: populatedIntern.student.progressUpdates || [],
            attendance: populatedIntern.student.attendance || [],
          }
        : null,
    };

    res.status(201).json({
      message: "Intern added successfully!",
      intern: formattedIntern,
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
    const { name, email, joiningDate, duration, tasks, username, password, department, domain, week, program, university, contactNumber, bio } = req.body;

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

        // Update student fields if provided
        const studentUpdates = {};
        if (username) studentUpdates.username = username;
        if (password) studentUpdates.password = await bcrypt.hash(password, 10);
        if (department) studentUpdates.department = department;
        if (domain) studentUpdates.domain = domain;
        if (week) studentUpdates.week = week;
        if (program) studentUpdates.program = program;
        if (university) studentUpdates.university = university;
        if (contactNumber) studentUpdates.contactNumber = contactNumber;
        if (bio) studentUpdates.bio = bio;

        if (Object.keys(studentUpdates).length > 0) {
          if (username) {
            const existingUser = await Student.findOne({ username });
            if (existingUser && existingUser._id.toString() !== studentId.toString()) {
              return res.status(400).json({ error: "Username already exists" });
            }
          }
          await Student.findByIdAndUpdate(studentId, studentUpdates);
        }
      }
    }

    await intern.save();

    // Fetch updated intern with populated student data
    const populatedIntern = await Intern.findById(internId).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio createdAt assignedProjects progressUpdates"
    );

    const formattedIntern = {
      _id: populatedIntern._id,
      name: populatedIntern.student ? populatedIntern.student.name : populatedIntern.name,
      email: populatedIntern.student ? populatedIntern.student.email : populatedIntern.email,
      progress: populatedIntern.progress || 0,
      duration: populatedIntern.duration || 3,
      status: populatedIntern.status || "Active",
      joiningDate: populatedIntern.joiningDate,
      tasks: populatedIntern.tasks || [],
      university: populatedIntern.student?.university || populatedIntern.university || "N/A",
      department: populatedIntern.student?.department || "N/A",
      domain: populatedIntern.student?.domain || "N/A",
      week: populatedIntern.student?.week || "N/A",
      program: populatedIntern.student?.program || "N/A",
      contactNumber: populatedIntern.student?.contactNumber || "N/A",
      bio: populatedIntern.student?.bio || "N/A",
      createdAt: populatedIntern.student?.createdAt || populatedIntern.createdAt || new Date(),
      attendance: [...(populatedIntern.attendance || []), ...(populatedIntern.student?.attendance || [])].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
      progressUpdates: [...(populatedIntern.dailyProgress || []), ...(populatedIntern.student?.progressUpdates || [])].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
      assignedProjects: populatedIntern.student?.assignedProjects || [],
      student: populatedIntern.student
        ? {
            _id: populatedIntern.student._id,
            name: populatedIntern.student.name,
            email: populatedIntern.student.email,
            username: populatedIntern.student.username,
            department: populatedIntern.student.department || "N/A",
            domain: populatedIntern.student.domain || "N/A",
            week: populatedIntern.student.week || "N/A",
            program: populatedIntern.student.program || "N/A",
            university: populatedIntern.student.university || "N/A",
            contactNumber: populatedIntern.student.contactNumber || "N/A",
            bio: populatedIntern.student.bio || "N/A",
            createdAt: populatedIntern.student.createdAt || new Date(),
            assignedProjects: populatedIntern.student.assignedProjects || [],
            progressUpdates: populatedIntern.student.progressUpdates || [],
            attendance: populatedIntern.student.attendance || [],
          }
        : null,
    };

    res.json({ message: "Intern updated successfully", intern: formattedIntern });
  } catch (error) {
    console.error("Error updating intern:", error);
    res.status(500).json({ error: "Error updating intern: " + error.message });
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

    const attendanceRecord = {
      date: date ? new Date(date) : new Date(),
      status,
      timeIn,
      timeOut,
      notes,
    };

    intern.attendance.push(attendanceRecord);

    // Optionally, update student's attendance if linked
    if (intern.student) {
      await Student.findByIdAndUpdate(intern.student, {
        $push: { attendance: attendanceRecord },
      });
    }

    await intern.save();

    res.status(201).json({
      message: "Attendance marked successfully!",
      attendance: intern.attendance[intern.attendance.length - 1],
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
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

    const intern = await Intern.findById(req.params.id);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    const progressUpdate = {
      content,
      timestamp: new Date(),
      hasAdminFeedback: false,
    };

    intern.dailyProgress = intern.dailyProgress || [];
    intern.dailyProgress.push(progressUpdate);

    // Optionally, update student's progressUpdates if linked
    if (intern.student) {
      await Student.findByIdAndUpdate(intern.student, {
        $push: { progressUpdates: progressUpdate },
      });
    }

    await intern.save();

    res.status(201).json({
      message: "Progress update submitted successfully!",
      update: progressUpdate,
    });
  } catch (error) {
    console.error("Error submitting progress update:", error);
    res.status(500).json({ error: "Failed to submit progress update: " + error.message });
  }
});

// Delete an Intern (Move to Past Interns)
router.delete("/:id", async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id).populate(
      "student",
      "name email username attendance department domain week program university contactNumber bio assignedProjects createdAt progressUpdates lastActive"
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

        // Update projects to remove the student from assignedTo
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
      university: intern.student?.university || intern.university || "N/A",
      department: intern.student?.department || "N/A",
      domain: intern.student?.domain || "N/A",
      week: intern.student?.week || "N/A",
      program: intern.student?.program || "N/A",
      contactNumber: intern.student?.contactNumber || "N/A",
      bio: intern.student?.bio || "N/A",
      createdAt: intern.student?.createdAt || intern.createdAt || new Date(),
      lastActive: intern.student?.lastActive || intern.createdAt || new Date(),
      student: studentId,
      deletedAt: new Date(),
      deletedProjects: deletedProjectsInfo,
      attendance: [...(intern.attendance || []), ...(intern.student?.attendance || [])].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
      progressUpdates: [...(intern.dailyProgress || []), ...(intern.student?.progressUpdates || [])].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
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