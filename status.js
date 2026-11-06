/**
 * src/lib/status.js
 * Single source of truth for pipeline stages and their colors.
 * The stage names must match the enum in the backend's models/Lead.js.
 *
 * Tailwind only generates classes it can find as complete strings,
 * so every class below is written out in full (no string concatenation).
 */

export const STATUSES = ['New', 'Contacted', 'In Progress', 'Converted'];

// Must match LEAD_SOURCES in the backend's models/Lead.js.
export const SOURCES = ['Website', 'Ads', 'Referral', 'Social Media', 'Email Campaign', 'Other'];

export const STATUS_STYLES = {
  New: {
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  Contacted: {
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
  'In Progress': {
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-800 ring-violet-200',
  },
  Converted: {
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
};

// Date helpers keep formatting consistent across the table and the notes panel.
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
