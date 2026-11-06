/**
 * server.js
 * ---------------------------------------------------------------------------
 * Entry point of the Mini CRM backend.
 *
 * Responsibilities:
 *   1. Load secrets from .env (never hard-code DB credentials)
 *   2. Apply security middleware (helmet, CORS allow-list, rate limit, body limit)
 *   3. Mount API routes
 *   4. Provide 404 + ONE central error handler (routes rely on it)
 *   5. Connect to MongoDB, then start listening, and shut down gracefully
 */

require('dotenv').config(); // must run before anything reads process.env

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const leadRoutes = require('./routes/leadRoutes');

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const isProduction = process.env.NODE_ENV === 'production';

// Fail fast: running without a database string is a configuration bug.
if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI is not defined. Please check your .env file.');
  process.exit(1);
}

// The audit endpoints (deleted leads, audit logs, restore) stay switched off without a key.
if (!process.env.AUDIT_KEY) {
  console.warn('WARNING: AUDIT_KEY is not set. Audit endpoints will return 503 until you add it to .env.');
}

// Behind a hosting proxy (Render, Railway, Nginx...) set TRUST_PROXY=1 so that
// req.ip, used by the rate limiter and the audit log, is the visitor's real IP.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

/* ------------------------- Security middleware --------------------------- */

// Protective HTTP headers. The defaults are fine for a JSON API.
app.use(helmet());

// CORS allow-list. Only these frontends may call the API from a browser.
// Example: CORS_ORIGIN=http://localhost:5173,https://my-crm.vercel.app
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// In development any localhost port is accepted, so Vite moving from 5173 to
// 5174 never breaks the dashboard. This relaxation is OFF in production.
const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = Postman, curl, PowerShell or server-to-server: allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && localhostPattern.test(origin)) return callback(null, true);

      const err = new Error('Origin not allowed by CORS policy');
      err.statusCode = 403;
      return callback(err);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // No "credentials: true": the dashboard does not use cookies.
  })
);

// A lead form never needs more than a few KB.
app.use(express.json({ limit: '10kb' }));

// General rate limit for the whole API (the public POST route has a stricter one).
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

/* ------------------------------- Routes ---------------------------------- */

// Health check for uptime monitors and for quick local testing.
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/leads', leadRoutes);

/* ---------------------- 404 + central error handler ---------------------- */

// Any request that reaches this point matched no route.
app.use((req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
});

// Express treats a 4-argument function as the error handler. Every route throws
// errors with a statusCode (see httpError in leadRoutes.js) and this turns them
// into clean JSON instead of Express's default HTML error page.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation failure (bad email, missing name...) -> 400 with every message.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  }

  // Wrong data type or malformed id reaching Mongoose -> 400.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field "${err.path}"`;
  }

  // Malformed JSON body -> 400.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  // Body bigger than the 10kb limit -> 413.
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // Never leak internals for unexpected errors in production.
  if (statusCode === 500) {
    console.error('Unhandled error:', err);
    if (isProduction) message = 'Something went wrong on our side';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && statusCode === 500 && { stack: err.stack }), // stack trace only while developing
  });
});

/* ------------------------ Database + server start ------------------------ */

let server;

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown: finish in-flight requests, then close the DB connection.
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  if (!server) return process.exit(0);
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});

start();

module.exports = app; // exported so automated tests (supertest) can import the app
