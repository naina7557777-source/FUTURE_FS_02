/**
 * components/Stats.jsx
 * Summary tiles at the top of the dashboard.
 *
 * - The first tile shows the whole pipeline as one proportional bar, so the
 *   admin sees the shape of the funnel at a glance.
 * - Every tile is a button: clicking it filters the table below by that stage
 *   (clicking "Total leads" clears the filter).
 */

import { STATUSES, STATUS_STYLES } from '../lib/status';

const formatNumber = (n) => n.toLocaleString('en-IN');

export default function Stats({ leads, loading, activeFilter, onFilter }) {
  // Count leads per stage once, then reuse for the tiles and the pipeline bar.
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  leads.forEach((lead) => {
    if (counts[lead.status] !== undefined) counts[lead.status] += 1;
  });

  const total = leads.length;
  const conversionRate = total ? Math.round((counts.Converted / total) * 100) : 0;
  const display = (n) => (loading ? '–' : formatNumber(n));

  // Shared look for every tile; the active one gets a visible ring.
  const tileClass = (isActive) =>
    `rounded-xl border bg-white p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
      isActive ? 'border-teal-700 ring-1 ring-teal-700' : 'border-slate-200 hover:border-slate-300'
    }`;

  const stageTile = (status, helper) => (
    <button
      key={status}
      type="button"
      onClick={() => onFilter(activeFilter === status ? 'All' : status)}
      aria-pressed={activeFilter === status}
      className={tileClass(activeFilter === status)}
    >
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <span className={`size-2 rounded-full ${STATUS_STYLES[status].dot}`} aria-hidden="true" />
        {status === 'Converted' ? 'Converted leads' : `${status} leads`}
      </span>
      <span className="mt-2 block text-3xl font-semibold tabular-nums text-slate-900">
        {display(counts[status])}
      </span>
      <span className="mt-1 block text-sm text-slate-500">{helper}</span>
    </button>
  );

  return (
    <section aria-label="Lead summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
      {/* Total tile with the pipeline bar */}
      <button
        type="button"
        onClick={() => onFilter('All')}
        aria-pressed={activeFilter === 'All'}
        className={`${tileClass(activeFilter === 'All')} sm:col-span-2 lg:col-span-1`}
      >
        <span className="text-sm text-slate-600">Total leads</span>
        <span className="mt-2 block text-3xl font-semibold tabular-nums text-slate-900">{display(total)}</span>

        {/* Proportional bar: one segment per stage, width = share of all leads */}
        <div
          className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={STATUSES.map((s) => `${counts[s]} ${s}`).join(', ')}
        >
          {!loading &&
            total > 0 &&
            STATUSES.map((s) =>
              counts[s] ? (
                <span
                  key={s}
                  className={STATUS_STYLES[s].bar}
                  style={{ width: `${(counts[s] / total) * 100}%` }}
                  title={`${s}: ${counts[s]}`}
                />
              ) : null
            )}
        </div>
        <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${STATUS_STYLES[s].dot}`} aria-hidden="true" />
              {s}
            </span>
          ))}
        </span>
      </button>

      {stageTile('New', 'Waiting for a first reply')}
      {stageTile('Contacted', 'Reached out, no deal yet')}
      {stageTile('Converted', total ? `${conversionRate}% of all leads` : 'No leads yet')}
    </section>
  );
}
