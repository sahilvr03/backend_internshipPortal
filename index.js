const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const internRoutes = require('./routes/intern');
const authenticateToken = require('./middleware/auth');
require('dotenv').config();

const app = express();

// Normalize URLs to prevent double-slash redirects
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// CORS configuration
app.use(cors({
  origin: 'https://ncai-internship-portal-v1.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Explicit OPTIONS handler for /api/interns
app.options('/api/interns', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://ncai-internship-portal-v1.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/interns', internRoutes);

// Token Verification Endpoint
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user 
  });
});

// Starting Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the NCAI Portal API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    message: 'NCAI Portal API is running'
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ 
    error: 'An unexpected error occurred',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Export for Vercel
module.exports = app;