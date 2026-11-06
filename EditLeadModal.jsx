/**
 * components/EditLeadModal.jsx
 * Small dialog for correcting a lead's name, email or source.
 * Status and notes are changed elsewhere (dropdown and notes panel).
 *
 * Only the fields that actually changed are sent to the backend, which also
 * records the old and new values in the lead's audit log.
 */

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/leads';
import { SOURCES } from '../lib/status';

export default function EditLeadModal({ lead, onClose, onSave }) {
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email);
  const [source, setSource] = useState(lead.source);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Esc closes the dialog.
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();

    // Send only what changed.
    const changes = {};
    if (name.trim() !== lead.name) changes.name = name.trim();
    if (email.trim().toLowerCase() !== lead.email) changes.email = email.trim();
    if (source !== lead.source) changes.source = source;

    if (Object.keys(changes).length === 0) return onClose(); // nothing to save

    setSaving(true);
    setError('');
    try {
      await onSave(lead._id, changes);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const fieldClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="edit-title" className="text-lg font-semibold text-slate-900">
          Edit lead
        </h2>
        <p className="mt-1 text-sm text-slate-600">Fix a typo or a wrong detail. Every change is recorded.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="edit-name" className="text-sm font-medium text-slate-900">
              Name
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoFocus
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="edit-email" className="text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              required
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="edit-source" className="text-sm font-medium text-slate-900">
              Source
            </label>
            <select id="edit-source" value={source} onChange={(e) => setSource(e.target.value)} className={fieldClass}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
