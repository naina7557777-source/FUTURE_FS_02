/**
 * src/api/leads.js
 * All HTTP calls to the Express backend live here, so components never
 * deal with URLs or response shapes directly.
 *
 * The backend base URL comes from frontend/.env (VITE_API_URL) and falls
 * back to http://localhost:5000/api for local development.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// GET /api/leads -> { success, count, total, page, pages, data: [...] }
// Deleted leads are already filtered out by the backend.
export const getLeads = async () => {
  const res = await api.get('/leads', { params: { limit: 100 } });
  return res.data;
};

// POST /api/leads -> the newly created lead (same endpoint the website contact form uses)
export const createLead = async (fields) => {
  const res = await api.post('/leads', fields);
  return res.data.data;
};

// PUT /api/leads/:id/status -> updated lead
export const updateLeadStatus = async (id, status) => {
  const res = await api.put(`/leads/${id}/status`, { status });
  return res.data.data;
};

// PATCH /api/leads/:id/notes -> updated lead
export const addLeadNote = async (id, text) => {
  const res = await api.patch(`/leads/${id}/notes`, { text });
  return res.data.data;
};

// PATCH /api/leads/:id -> updated lead (edit name, email or source)
export const updateLead = async (id, fields) => {
  const res = await api.patch(`/leads/${id}`, fields);
  return res.data.data;
};

// DELETE /api/leads/:id -> SOFT delete. The record stays in the database for audit.
// axios sends the optional reason in the request body through the "data" option.
export const deleteLead = async (id, reason) => {
  await api.delete(`/leads/${id}`, { data: { reason } });
};

// Turns any Axios error into a message the admin can act on.
export const getErrorMessage = (err) => {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.request) return 'Cannot reach the server. Check that the backend is running on port 5000.';
  return 'Something went wrong. Please try again.';
};
