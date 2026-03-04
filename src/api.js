import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = 'https://wandertogether-backend-production.up.railway.app';

// Create axios instance
const api = axios.create({ baseURL: BASE_URL });

// Attach Supabase auth token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Trips ──────────────────────────────────────────────────
export const getTrips = () => api.get('/api/trips').then(r => r.data);
export const getTrip = (id) => api.get(`/api/trips/${id}`).then(r => r.data);
export const createTrip = (data) => api.post('/api/trips', data).then(r => r.data);
export const updateTrip = (id, data) => api.patch(`/api/trips/${id}`, data).then(r => r.data);
export const inviteMember = (tripId, email) => api.post(`/api/trips/${tripId}/invite`, { email }).then(r => r.data);

// ── Itinerary ──────────────────────────────────────────────
export const getItinerary = (tripId) => api.get(`/api/trips/${tripId}/itinerary`).then(r => r.data);
export const addEvent = (tripId, data) => api.post(`/api/trips/${tripId}/itinerary`, data).then(r => r.data);
export const deleteEvent = (tripId, eventId) => api.delete(`/api/trips/${tripId}/itinerary/${eventId}`).then(r => r.data);

// ── Suggestions ────────────────────────────────────────────
export const getSuggestions = (tripId) => api.get(`/api/trips/${tripId}/suggestions`).then(r => r.data);
export const addSuggestion = (tripId, data) => api.post(`/api/trips/${tripId}/suggestions`, data).then(r => r.data);
export const voteSuggestion = (tripId, suggestionId, vote) =>
  api.post(`/api/trips/${tripId}/suggestions/${suggestionId}/vote`, { vote }).then(r => r.data);

// ── Polls ──────────────────────────────────────────────────
export const getPolls = (tripId) => api.get(`/api/trips/${tripId}/polls`).then(r => r.data);
export const createPoll = (tripId, data) => api.post(`/api/trips/${tripId}/polls`, data).then(r => r.data);
export const votePoll = (tripId, pollId, optionId) =>
  api.post(`/api/trips/${tripId}/polls/${pollId}/vote`, { option_id: optionId }).then(r => r.data);

// ── Budget ─────────────────────────────────────────────────
export const getBudget = (tripId) => api.get(`/api/trips/${tripId}/budget`).then(r => r.data);
export const addExpense = (tripId, data) => api.post(`/api/trips/${tripId}/budget/expenses`, data).then(r => r.data);
export const getBudgetSplit = (tripId) => api.get(`/api/trips/${tripId}/budget/split`).then(r => r.data);

// ── Photos ─────────────────────────────────────────────────
export const getPhotos = (tripId) => api.get(`/api/trips/${tripId}/photos`).then(r => r.data);
export const getUploadUrl = (tripId, filename) =>
  api.get(`/api/trips/${tripId}/photos/upload-url`, { params: { filename } }).then(r => r.data);
export const registerPhoto = (tripId, data) => api.post(`/api/trips/${tripId}/photos`, data).then(r => r.data);

// ── Chat ───────────────────────────────────────────────────
export const getMessages = (tripId) => api.get(`/api/trips/${tripId}/messages`).then(r => r.data);
export const sendMessage = (tripId, content) =>
  api.post(`/api/trips/${tripId}/messages`, { content }).then(r => r.data);

// ── AI ─────────────────────────────────────────────────────
export const getAiSuggestions = (data) => api.post('/api/ai/suggestions', data).then(r => r.data);
export const getAiItinerary = (data) => api.post('/api/ai/itinerary', data).then(r => r.data);

export default api;