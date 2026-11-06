/**
 * components/AddLeadModal.jsx
 * Dialog for creating a lead by hand from the dashboard, for example when an
 * enquiry arrives by phone, WhatsApp or in a meeting instead of the website form.
 *
 * It calls the same POST /api/leads endpoint as the website contact form, so
 * validation and the audit log ("created" entry) work exactly the same way.
 */

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/leads';
import { SOURCES } from '../lib/status';

export default function AddLeadModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Website');
  const [notes, setNotes] = useState('');
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
    setSaving(true);
    setError('');

    // The optional note becomes the lead's first note.
    const fields = { name: name.trim(), email: email.trim(), source };
    if (notes.trim()) fields.notes = notes.trim();

    try {
      await onSave(fields);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const fieldClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-teal-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="add-title" className="text-lg font-semibold text-slate-900">
          Add lead
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          For enquiries that did not come through the website form. The lead starts as New.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="add-name" className="text-sm font-medium text-slate-900">
              Name
            </label>
            <input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              autoFocus
              placeholder="Rohan Singh"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="add-email" className="text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              required
              placeholder="rohan@example.com"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="add-source" className="text-sm font-medium text-slate-900">
              Source
            </label>
            <select id="add-source" value={source} onChange={(e) => setSource(e.target.value)} className={fieldClass}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="add-notes" className="text-sm font-medium text-slate-900">
              First note (optional)
            </label>
            <textarea
              id="add-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Called us, wants a quote by Friday"
              className={`${fieldClass} resize-none`}
            />
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
            {saving ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
