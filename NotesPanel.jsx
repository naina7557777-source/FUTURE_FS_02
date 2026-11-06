/**
 * components/NotesPanel.jsx
 * Slide-out panel that shows one lead's details and note history, and lets the
 * admin append a new note (PATCH via the parent's onAddNote).
 *
 * Behaviour:
 *   - Esc, the close button, or a click on the backdrop closes it
 *   - the textarea is focused when the panel opens
 *   - Ctrl/Cmd + Enter submits the note
 *   - notes are shown newest first, each with its timestamp
 */

import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/leads';
import { STATUS_STYLES, formatDateTime } from '../lib/status';

const MAX_LENGTH = 1000; // matches the backend schema limit

export default function NotesPanel({ lead, onClose, onAddNote }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // Start with a clean form whenever a different lead is opened.
  useEffect(() => {
    setText('');
    setError('');
    if (lead) textareaRef.current?.focus();
  }, [lead?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape while the panel is open.
  useEffect(() => {
    if (!lead) return undefined;
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lead, onClose]);

  if (!lead) return null;

  const submit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || saving) return;

    setSaving(true);
    setError('');
    try {
      await onAddNote(lead._id, value);
      setText(''); // clear only after the server accepted the note
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Newest note first; copy the array so we never mutate state.
  const notes = [...(lead.notes || [])].reverse();

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-title"
        className="panel-enter absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl"
      >
        {/* Lead details */}
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="notes-title" className="truncate text-lg font-semibold text-slate-900">
                {lead.name}
              </h2>
              <a href={`mailto:${lead.email}`} className="block truncate text-sm text-slate-600 hover:underline">
                {lead.email}
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notes panel"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[lead.status].badge}`}>
              {lead.status}
            </span>
            <span>From {lead.source}</span>
            <span>Added {formatDateTime(lead.createdAt)}</span>
          </div>
        </header>

        {/* Note history */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-sm font-medium text-slate-900">Note history</h3>

          {notes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No notes yet. Record what you discussed or what happens next.
            </p>
          ) : (
            <ol className="mt-4 space-y-4 border-l border-slate-200 pl-4">
              {notes.map((note) => (
                <li key={note._id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-teal-700" aria-hidden="true" />
                  <time dateTime={note.createdAt} className="text-xs text-slate-500">
                    {formatDateTime(note.createdAt)}
                  </time>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">{note.text}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Add note form */}
        <form onSubmit={submit} className="border-t border-slate-200 px-6 py-4">
          <label htmlFor="new-note" className="text-sm font-medium text-slate-900">
            Add a note
          </label>
          <textarea
            id="new-note"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit(e)}
            maxLength={MAX_LENGTH}
            rows={3}
            placeholder="Called today, asked for a quote by Friday"
            className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-teal-700"
          />

          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {text.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              disabled={!text.trim() || saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
