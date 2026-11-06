/**
 * models/Lead.js
 * ---------------------------------------------------------------------------
 * Mongoose schema for a CRM "Lead" – a potential client who has shown interest
 * (usually through a website contact form or an ad campaign).
 *
 * Pipeline: New -> Contacted -> In Progress -> Converted
 *
 * Integrity features (added so a lead manager cannot quietly erase data):
 *   1. SOFT DELETE: deleting a lead only sets isDeleted = true. The document
 *      stays in MongoDB and is simply hidden from the normal dashboard queries.
 *   2. AUDIT LOG: every create / edit / status change / delete / restore is
 *      appended to auditLog with the old and new values and a timestamp.
 *      The log is append-only and hidden from normal API responses.
 */

const mongoose = require('mongoose');

const LEAD_STATUSES = ['New', 'Contacted', 'In Progress', 'Converted'];
const LEAD_SOURCES = ['Website', 'Ads', 'Referral', 'Social Media', 'Email Campaign', 'Other'];
const AUDIT_ACTIONS = ['created', 'edited', 'status_changed', 'deleted', 'restored'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A single note in a lead's history (append-only). */
const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
      minlength: [1, 'Note cannot be empty'],
      maxlength: [1000, 'Note cannot exceed 1000 characters'],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * One audit entry = one thing that happened to the lead.
 * "changes" stores the before/after value of each changed field.
 * "ip" records where the request came from (there is no login yet, so this is
 * the best available "who"; once JWT auth is added, store the admin's id here).
 */
const auditSchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    changes: [{ field: String, from: String, to: String, _id: false }],
    reason: { type: String, trim: true, maxlength: [300, 'Reason cannot exceed 300 characters'] },
    ip: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email is too long'],
      validate: {
        validator: (value) => EMAIL_REGEX.test(value),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },

    source: {
      type: String,
      enum: { values: LEAD_SOURCES, message: `Source must be one of: ${LEAD_SOURCES.join(', ')}` },
      default: 'Website',
    },

    status: {
      type: String,
      enum: { values: LEAD_STATUSES, message: `Status must be one of: ${LEAD_STATUSES.join(', ')}` },
      default: 'New',
    },

    notes: { type: [noteSchema], default: [] },

    // ---- Soft delete -------------------------------------------------------
    // NOTE: leads created before this feature have no isDeleted field at all,
    // so every "visible" query uses { isDeleted: { $ne: true } }, never { isDeleted: false }.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // ---- Audit trail -------------------------------------------------------
    // select:false keeps this out of normal responses; the audit endpoint
    // asks for it explicitly with .select('+auditLog').
    auditLog: { type: [auditSchema], default: [], select: false },
  },
  {
    timestamps: true, // createdAt and updatedAt are maintained automatically
    versionKey: false,
  }
);

leadSchema.index({ isDeleted: 1, createdAt: -1 });
leadSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
module.exports.LEAD_STATUSES = LEAD_STATUSES;
module.exports.LEAD_SOURCES = LEAD_SOURCES;
