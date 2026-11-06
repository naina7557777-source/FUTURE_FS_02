/**
 * components/DeleteLeadDialog.jsx
 * Confirmation step before a lead is removed from the dashboard.
 *
 * The admin is told plainly that this is a soft delete: the lead disappears
 * from the dashboard but a record is kept for audit. The optional reason is
 * stored in the lead's audit log.
 */

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/leads';

export default function DeleteLeadDialog({ lead, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const confirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirm(lead._id, reason.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="delete-title" className="text-lg font-semibold text-slate-900">
          Remove {lead.name}?
        </h2>
        <p id="delete-desc" className="mt-2 text-sm text-slate-600">
          This lead will disappear from the dashboard. A record of it, with the time of removal, is kept for audit
          and cannot be erased from here.
        </p>

        <label htmlFor="delete-reason" className="mt-5 block text-sm font-medium text-slate-900">
          Reason (optional)
        </label>
        <textarea
          id="delete-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Duplicate entry, wrong contact, spam…"
          className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-teal-700"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={deleting}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
