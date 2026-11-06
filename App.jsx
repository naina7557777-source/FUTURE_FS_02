/**
 * App.jsx
 * Root of the Mini CRM dashboard. Owns ALL state and talks to the backend;
 * the child components only render and report user actions.
 *
 * State overview
 *   leads        visible leads from GET /api/leads (deleted leads never arrive here)
 *   total        total number of visible leads reported by the server
 *   loading      true during the first load / manual refresh
 *   error        message shown when the list cannot be loaded
 *   notice       message shown when a status update fails
 *   filter       'All' or one pipeline stage (set by clicking the summary tiles)
 *   updatingId   id of the lead whose status is being saved
 *   selectedId   id of the lead open in the notes panel
 *   editingId    id of the lead open in the edit dialog
 *   deletingId   id of the lead waiting for delete confirmation
 *   adding       true while the Add lead dialog is open
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Stats from './components/Stats';
import LeadTable from './components/LeadTable';
import NotesPanel from './components/NotesPanel';
import EditLeadModal from './components/EditLeadModal';
import DeleteLeadDialog from './components/DeleteLeadDialog';
import AddLeadModal from './components/AddLeadModal';
import {
  addLeadNote,
  createLead,
  deleteLead,
  getErrorMessage,
  getLeads,
  updateLead,
  updateLeadStatus,
} from './api/leads';

export default function App() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getLeads();
      setLeads(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const replaceLead = (updated) =>
    setLeads((current) => current.map((l) => (l._id === updated._id ? updated : l)));

  // Change a lead's pipeline stage (optimistic update with rollback on failure).
  const handleStatusChange = async (id, status) => {
    const previous = leads.find((l) => l._id === id);
    if (!previous || previous.status === status) return;

    setNotice('');
    setUpdatingId(id);
    setLeads((current) => current.map((l) => (l._id === id ? { ...l, status } : l)));

    try {
      const updated = await updateLeadStatus(id, status);
      replaceLead(updated);
    } catch (err) {
      replaceLead(previous);
      setNotice(`Could not update ${previous.name}: ${getErrorMessage(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Append a note. Errors are thrown so the panel can show them next to the form.
  const handleAddNote = async (id, text) => {
    const updated = await addLeadNote(id, text);
    replaceLead(updated);
  };

  // Edit name / email / source. The dialog shows any error, so we let it throw.
  const handleEdit = async (id, fields) => {
    const updated = await updateLead(id, fields);
    replaceLead(updated);
  };

  // Soft delete: the backend hides the lead and keeps an audit record.
  // Here we simply drop it from the screen.
  const handleDelete = async (id, reason) => {
    await deleteLead(id, reason);
    setLeads((current) => current.filter((l) => l._id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (selectedId === id) setSelectedId(null);
  };

  // Create a lead by hand. It starts as "New", so we show all leads to make sure it is visible.
  const handleAdd = async (fields) => {
    const lead = await createLead(fields);
    setLeads((current) => [lead, ...current]);
    setTotal((t) => t + 1);
    setFilter('All');
  };

  const selectedLead = useMemo(() => leads.find((l) => l._id === selectedId) || null, [leads, selectedId]);
  const editingLead = useMemo(() => leads.find((l) => l._id === editingId) || null, [leads, editingId]);
  const deletingLead = useMemo(() => leads.find((l) => l._id === deletingId) || null, [leads, deletingId]);

  const closePanel = useCallback(() => setSelectedId(null), []);
  const closeEdit = useCallback(() => setEditingId(null), []);
  const closeDelete = useCallback(() => setDeletingId(null), []);
  const closeAdd = useCallback(() => setAdding(false), []);

  const visibleLeads = useMemo(
    () => (filter === 'All' ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track every enquiry from first contact to conversion.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchLeads}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Add lead
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchLeads}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {notice && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="rounded-md px-2 py-1 font-medium hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-700"
            >
              Dismiss
            </button>
          </div>
        )}

        <Stats leads={leads} loading={loading} activeFilter={filter} onFilter={setFilter} />

        <LeadTable
          leads={visibleLeads}
          loading={loading}
          updatingId={updatingId}
          hasAnyLeads={leads.length > 0}
          activeFilter={filter}
          onStatusChange={handleStatusChange}
          onOpenNotes={setSelectedId}
          onEdit={setEditingId}
          onDelete={setDeletingId}
          onClearFilter={() => setFilter('All')}
        />

        {!loading && total > leads.length && (
          <p className="text-sm text-slate-500">
            Showing the latest {leads.length} of {total} leads. Tile counts cover these {leads.length}.
          </p>
        )}
      </main>

      <NotesPanel lead={selectedLead} onClose={closePanel} onAddNote={handleAddNote} />

      {/* key makes each dialog start with fresh form values for the lead it opens */}
      {editingLead && (
        <EditLeadModal key={editingLead._id} lead={editingLead} onClose={closeEdit} onSave={handleEdit} />
      )}
      {deletingLead && (
        <DeleteLeadDialog key={deletingLead._id} lead={deletingLead} onClose={closeDelete} onConfirm={handleDelete} />
      )}
      {adding && <AddLeadModal onClose={closeAdd} onSave={handleAdd} />}
    </div>
  );
}
