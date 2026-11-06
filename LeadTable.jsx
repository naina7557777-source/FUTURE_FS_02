/**
 * components/LeadTable.jsx
 * Data table of leads. Each row has:
 *   - a name button that opens the notes panel
 *   - an inline status dropdown that updates the pipeline stage
 *   - a notes preview that also opens the panel
 *   - Edit and Remove actions (Remove is a soft delete handled by the backend)
 *
 * The component is "dumb": it only renders and reports user actions upward.
 * All data fetching and state live in App.jsx.
 */

import { STATUSES, STATUS_STYLES, formatDate } from '../lib/status';

const COLUMNS = ['Name', 'Email', 'Source', 'Status', 'Notes', 'Created', 'Actions'];

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="border-t border-slate-100">
      {COLUMNS.map((c) => (
        <td key={c} className="px-5 py-4">
          <div className="h-4 w-24 rounded bg-slate-100 motion-safe:animate-pulse" />
        </td>
      ))}
    </tr>
  ));
}

const actionClass =
  'rounded px-2 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2';

export default function LeadTable({
  leads,
  loading,
  updatingId,
  hasAnyLeads,
  activeFilter,
  onStatusChange,
  onOpenNotes,
  onEdit,
  onDelete,
  onClearFilter,
}) {
  const isEmpty = !loading && leads.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-5 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && <SkeletonRows />}

            {!loading &&
              leads.map((lead) => {
                const latestNote = lead.notes?.length ? lead.notes[lead.notes.length - 1] : null;
                const isUpdating = updatingId === lead._id;

                return (
                  <tr key={lead._id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onOpenNotes(lead._id)}
                        className="rounded font-medium text-slate-900 hover:text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        {lead.name}
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <a href={`mailto:${lead.email}`} className="text-slate-600 hover:text-slate-900 hover:underline">
                        {lead.email}
                      </a>
                    </td>

                    <td className="px-5 py-4 text-slate-600">{lead.source}</td>

                    <td className="px-5 py-4">
                      <select
                        value={lead.status}
                        disabled={isUpdating}
                        onChange={(e) => onStatusChange(lead._id, e.target.value)}
                        aria-label={`Change status for ${lead.name}`}
                        className={`rounded-full py-1 pl-3 pr-7 text-sm font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60 ${STATUS_STYLES[lead.status].badge}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="max-w-[16rem] px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onOpenNotes(lead._id)}
                        className="block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        {latestNote ? (
                          <>
                            <span className="block truncate text-slate-700">{latestNote.text}</span>
                            <span className="text-xs text-slate-500">
                              {lead.notes.length} {lead.notes.length === 1 ? 'note' : 'notes'}
                            </span>
                          </>
                        ) : (
                          <span className="text-teal-800 hover:underline">Add a note</span>
                        )}
                      </button>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(lead.createdAt)}</td>

                    {/* Edit fixes mistakes; Remove hides the lead but keeps an audit record */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onEdit(lead._id)}
                        aria-label={`Edit ${lead.name}`}
                        className={`${actionClass} text-teal-800 hover:bg-teal-50 focus-visible:outline-teal-700`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lead._id)}
                        aria-label={`Remove ${lead.name}`}
                        className={`${actionClass} text-red-700 hover:bg-red-50 focus-visible:outline-red-700`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {isEmpty && (
        <div className="border-t border-slate-100 px-6 py-14 text-center">
          {hasAnyLeads ? (
            <>
              <p className="font-medium text-slate-900">No {activeFilter.toLowerCase()} leads right now</p>
              <button
                type="button"
                onClick={onClearFilter}
                className="mt-2 text-sm text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                Show all leads
              </button>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-900">No leads yet</p>
              <p className="mt-1 text-sm text-slate-500">
                When someone submits your website contact form, they will show up here.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
