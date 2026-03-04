import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTrips, createTrip } from '../api';
import api from '../api';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', destination: '', cities: '', start_date: '', end_date: '', budget_target: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const create = async () => {
    if (!form.name || !form.destination) return setError('Name and destination are required');
    setCreating(true); setError('');
    try {
      const trip = await createTrip({
        ...form,
        cities: form.cities ? form.cities.split(',').map(c => c.trim()) : [],
        budget_target: form.budget_target ? parseFloat(form.budget_target) : null,
      });
      setTrips(t => [...t, trip]);
      setModal(false);
      setForm({ name: '', destination: '', cities: '', start_date: '', end_date: '', budget_target: '' });
      navigate(`/trip/${trip.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create trip');
    } finally { setCreating(false); }
  };

  const deleteTrip = async (e, tripId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    try {
      await api.delete(`/api/trips/${tripId}`);
      setTrips(t => t.filter(trip => trip.id !== tripId));
    } catch (err) {
      alert('Failed to delete trip');
    }
  };

  const EMOJIS = { colombia: '🇨🇴', japan: '🇯🇵', italy: '🇮🇹', france: '🇫🇷', spain: '🇪🇸', default: '✈️' };
  const getEmoji = (dest) => EMOJIS[dest?.toLowerCase()] || EMOJIS.default;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-logo">Wander<em>Together</em></div>
        <div className="header-right">
          <span className="user-name">{user?.user_metadata?.full_name || user?.email}</span>
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
          <button className="dark-mode-toggle" onClick={() => document.body.classList.toggle('dark-mode')}>
  {document.body.classList.contains('dark-mode') ? '☀️ Light' : '🌙 Dark'}
</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-hero">
          <h1>Your Trips</h1>
          <button className="btn btn-gold" onClick={() => setModal(true)}>+ New Trip</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : trips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✈️</div>
            <h2>No trips yet</h2>
            <p>Create your first trip and invite your crew to start planning together.</p>
            <button className="btn btn-gold" onClick={() => setModal(true)}>Plan your first trip</button>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map(trip => (
              <div key={trip.id} className="trip-card" onClick={() => navigate(`/trip/${trip.id}`)}>
                <div className="trip-card-cover">
                  <span className="trip-card-emoji">{trip.emoji || getEmoji(trip.destination)}</span>
                  <button
                    className="trip-delete-btn"
                    onClick={(e) => deleteTrip(e, trip.id)}
                    title="Delete trip"
                  >
                    🗑
                  </button>
                </div>
                <div className="trip-card-body">
                  <h3>{trip.name}</h3>
                  <p className="trip-card-dest">📍 {trip.destination}</p>
                  {trip.start_date && (
                    <p className="trip-card-date">
                      🗓 {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {trip.end_date && ` – ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  )}
                  <div className="trip-card-members">
                    {(trip.members || []).slice(0, 4).map((m, i) => (
                      <div key={i} className="member-avatar" title={m.profile?.full_name}>
                        {(m.profile?.full_name || m.profile?.username || '?')[0].toUpperCase()}
                      </div>
                    ))}
                    {(trip.members?.length || 0) > 4 && (
                      <div className="member-avatar">+{trip.members.length - 4}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Plan a New Trip ✈️</div>
            {error && <div className="error-msg">{error}</div>}
            <div className="form-group">
              <label className="form-label">Trip Name</label>
              <input className="form-input" name="name" placeholder="Colombia Adventure" value={form.name} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Destination</label>
              <input className="form-input" name="destination" placeholder="Colombia" value={form.destination} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Cities (comma separated)</label>
              <input className="form-input" name="cities" placeholder="Medellín, Cartagena" value={form.cities} onChange={handle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Start Date</label>
                <input className="form-input" name="start_date" type="date" value={form.start_date} onChange={handle} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">End Date</label>
                <input className="form-input" name="end_date" type="date" value={form.end_date} onChange={handle} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Budget Target (total $USD)</label>
              <input className="form-input" name="budget_target" type="number" placeholder="4000" value={form.budget_target} onChange={handle} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={create} disabled={creating}>
                {creating ? 'Creating...' : 'Create Trip →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}