/**
 * routes/leadRoutes.js
 * ---------------------------------------------------------------------------
 * REST API for managing leads. Mounted in server.js at /api/leads.
 *
 * Dashboard endpoints
 *   POST   /api/leads              Create a lead (public website contact form)
 *   GET    /api/leads              List visible leads, newest first
 *   PATCH  /api/leads/:id          Edit name / email / source (fix mistakes)
 *   PUT    /api/leads/:id/status   Move a lead to another pipeline stage
 *   PATCH  /api/leads/:id/notes    Append a timestamped note
 *   DELETE /api/leads/:id          SOFT delete: hides the lead, keeps the record
 *
 * Audit endpoints (need the x-audit-key header, NOT used by the dashboard)
 *   GET    /api/leads/deleted      Every deleted lead, with its full audit log
 *   GET    /api/leads/:id/audit    Full audit log of one lead (deleted or not)
 *   POST   /api/leads/:id/restore  Bring a deleted lead back to the dashboard
 *
 * Business rule: data is never physically removed through this API. "Delete"
 * only hides a lead from the dashboard, and every change is written to the
 * lead's append-only audit log. That way a lead manager cannot make data
 * disappear (for example after being paid to), and a reviewer can always see
 * what was deleted, when, why and from which IP.
 */

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Lead = require('../models/Lead');
const { LEAD_STATUSES } = require('../models/Lead');

const router = express.Router();

/* ------------------------------ Helpers ---------------------------------- */

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(httpError(400, 'Invalid lead id'));
  next();
};

// IMPORTANT: leads created before soft delete existed have no isDeleted field.
// { isDeleted: false } would NOT match them, so we use $ne: true instead.
const VISIBLE = { isDeleted: { $ne: true } };

// Describes what changed between the old and new values of a lead.
const diffFields = (before, after, fields) =>
  fields
    .filter((f) => String(before[f]) !== String(after[f]))
    .map((f) => ({ field: f, from: String(before[f]), to: String(after[f]) }));

// Guards the audit endpoints with a secret key kept in the server's .env.
// The dashboard never knows this key, so deleted data stays off the dashboard
// but is available to whoever is checking the system.
const requireAuditKey = (req, res, next) => {
  const expected = process.env.AUDIT_KEY;
  if (!expected) return next(httpError(503, 'Audit access is not configured on this server'));

  const provided = Buffer.from(req.get('x-audit-key') || '');
  const wanted = Buffer.from(expected);
  // timingSafeEqual avoids leaking the key through response timing.
  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    return next(httpError(401, 'Invalid audit key'));
  }
  next();
};

// Public form: by default only 5 submissions per IP every 15 minutes.
// Raise it with LEAD_FORM_LIMIT in .env while testing (the dashboard's Add lead uses this route too).
const createLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LEAD_FORM_LIMIT) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please try again later.' },
});

/* --------------------------- Audit endpoints ----------------------------- */
// Declared first so "deleted" is never mistaken for a lead id.

/**
 * @route   GET /api/leads/deleted
 * @desc    All soft-deleted leads together with their audit logs
 * @access  Audit key required (header: x-audit-key)
 */
router.get(
  '/deleted',
  requireAuditKey,
  asyncHandler(async (req, res) => {
    const leads = await Lead.find({ isDeleted: true }).select('+auditLog').sort({ deletedAt: -1 }).lean();
    res.json({ success: true, count: leads.length, data: leads });
  })
);

/**
 * @route   GET /api/leads/:id/audit
 * @desc    Full audit log of one lead (works for deleted leads too)
 * @access  Audit key required
 */
router.get(
  '/:id/audit',
  requireAuditKey,
  validateObjectId,
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id).select('+auditLog').lean();
    if (!lead) throw httpError(404, 'Lead not found');
    res.json({ success: true, data: lead });
  })
);

/**
 * @route   POST /api/leads/:id/restore
 * @desc    Undo a deletion (for example when a lead was deleted by mistake)
 * @access  Audit key required
 */
router.post(
  '/:id/restore',
  requireAuditKey,
  validateObjectId,
  asyncHandler(async (req, res) => {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      {
        $set: { isDeleted: false },
        $unset: { deletedAt: 1 },
        $push: { auditLog: { action: 'restored', ip: req.ip } },
      },
      { new: true }
    );
    if (!lead) throw httpError(404, 'No deleted lead found with this id');
    res.json({ success: true, data: lead });
  })
);

/* --------------------------- Dashboard endpoints ------------------------- */

/**
 * @route   POST /api/leads
 * @desc    Create a new lead from the website contact form
 * @access  Public (rate limited)
 * @body    { name, email, source?, notes? }
 *
 * Only whitelisted fields are copied from req.body (prevents mass assignment).
 * The first audit entry ("created") is written together with the lead.
 */
router.post(
  '/',
  createLeadLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, source, notes } = req.body;

    const leadData = { name, email, auditLog: [{ action: 'created', ip: req.ip }] };
    if (source) leadData.source = source;
    if (typeof notes === 'string' && notes.trim()) leadData.notes = [{ text: notes }];

    const lead = await Lead.create(leadData);

    // Do not leak the audit log in the public response.
    const result = lead.toObject();
    delete result.auditLog;

    res.status(201).json({ success: true, data: result });
  })
);

/**
 * @route   GET /api/leads
 * @desc    Visible (not deleted) leads, newest first
 * @query   status?, page?, limit? (max 100)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { ...VISIBLE };

    // Validate the status filter so objects like ?status[$ne]=x never reach MongoDB.
    if (req.query.status !== undefined) {
      if (typeof req.query.status !== 'string' || !LEAD_STATUSES.includes(req.query.status)) {
        throw httpError(400, `Status filter must be one of: ${LEAD_STATUSES.join(', ')}`);
      }
      filter.status = req.query.status;
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({ success: true, count: leads.length, total, page, pages: Math.ceil(total / limit), data: leads });
  })
);

/**
 * @route   PATCH /api/leads/:id
 * @desc    Edit a lead's name, email or source
 * @body    any of { name, email, source }
 *
 * Status and notes have their own endpoints, and isDeleted / auditLog can
 * never be set from here. Every real change is recorded with old -> new values.
 */
router.patch(
  '/:id',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const existing = await Lead.findOne({ _id: req.params.id, ...VISIBLE });
    if (!existing) throw httpError(404, 'Lead not found');

    const EDITABLE = ['name', 'email', 'source'];
    const updates = {};

    for (const field of EDITABLE) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== 'string') throw httpError(400, `${field} must be text`);
      updates[field] = req.body[field].trim();
    }
    if (updates.email) updates.email = updates.email.toLowerCase(); // same normalisation as the schema

    if (Object.keys(updates).length === 0) {
      throw httpError(400, 'Provide at least one of: name, email, source');
    }

    const changes = diffFields(existing, { ...existing.toObject(), ...updates }, EDITABLE);

    // Nothing actually changed -> return the lead as it is, no audit noise.
    if (changes.length === 0) return res.json({ success: true, data: existing });

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, ...VISIBLE },
      { $set: updates, $push: { auditLog: { action: 'edited', changes, ip: req.ip } } },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: lead });
  })
);

/**
 * @route   PUT /api/leads/:id/status
 * @desc    Update the pipeline stage of a lead
 * @body    { status }
 */
router.put(
  '/:id/status',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (typeof status !== 'string' || !LEAD_STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${LEAD_STATUSES.join(', ')}`);
    }

    const existing = await Lead.findOne({ _id: req.params.id, ...VISIBLE }).select('status');
    if (!existing) throw httpError(404, 'Lead not found');

    const update = { $set: { status } };
    if (existing.status !== status) {
      update.$push = {
        auditLog: { action: 'status_changed', changes: [{ field: 'status', from: existing.status, to: status }], ip: req.ip },
      };
    }

    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, ...VISIBLE }, update, {
      new: true,
      runValidators: true,
    });
    if (!lead) throw httpError(404, 'Lead not found');

    res.json({ success: true, data: lead });
  })
);

/**
 * @route   PATCH /api/leads/:id/notes
 * @desc    Append a note (server-generated timestamp) to the lead's history
 * @body    { text }
 */
router.patch(
  '/:id/notes',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (typeof text !== 'string' || !text.trim()) throw httpError(400, 'Note text is required');

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, ...VISIBLE },
      { $push: { notes: { text } } },
      { new: true, runValidators: true }
    );
    if (!lead) throw httpError(404, 'Lead not found');

    res.json({ success: true, data: lead });
  })
);

/**
 * @route   DELETE /api/leads/:id
 * @desc    SOFT delete: hide the lead from the dashboard, keep the record
 * @body    { reason? }   optional explanation, stored in the audit log
 *
 * Nothing is removed from MongoDB. The lead gets isDeleted = true and an audit
 * entry with the time, the reason and the caller's IP address.
 */
router.delete(
  '/:id',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const entry = { action: 'deleted', ip: req.ip };
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    if (reason) entry.reason = reason;

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, ...VISIBLE },
      { $set: { isDeleted: true, deletedAt: new Date() }, $push: { auditLog: entry } },
      { new: true }
    );
    if (!lead) throw httpError(404, 'Lead not found');

    res.json({
      success: true,
      message: 'Lead removed from the dashboard. A record is kept for audit.',
      data: { _id: lead._id },
    });
  })
);

module.exports = router;
