const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const adminRoutes = require("./routes/admin");
const studentRoutes = require("./routes/student");
const internRoutes = require("./routes/intern");
const authenticateToken = require("./middleware/auth");
require("dotenv").config();

const app = express();


app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connect to MongoDB
connectDB();

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/interns", internRoutes);

// Token Verification Endpoint
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user 
  });
});
// Starting Route to Check Deployment
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to the NCAI Portal API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  
  res.status(500).json({ 
    error: "An unexpected error occurred",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    time: new Date().toISOString(),
    message: "NCAI Portal API is running"
  });
});

// Start Server
// const PORT = process.env.PORT || 8000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


// Export for Vercel serverless
module.exports = app;