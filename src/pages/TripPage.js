import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import * as api from '../api';
import '../styles/TripPage.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '🗺' },
  { id: 'itinerary', label: 'Itinerary', icon: '📅' },
  { id: 'suggestions', label: 'Suggestions', icon: '💡' },
  { id: 'polls', label: 'Polls', icon: '🗳' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'chat', label: 'Chat', icon: '💬' },
];

export default function TripPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [trip, setTrip] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [polls, setPolls] = useState([]);
  const [budget, setBudget] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [chatText, setChatText] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const photoInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const suggestionsTopRef = useRef(null);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    Promise.all([
      api.getTrip(tripId),
      api.getSuggestions(tripId),
      api.getPolls(tripId),
      api.getBudget(tripId),
      api.getPhotos(tripId),
      api.getMessages(tripId),
      api.getItinerary(tripId),
    ]).then(([t, s, p, b, ph, m, it]) => {
      setTrip(t); setSuggestions(s); setPolls(p);
      setBudget(b); setPhotos(ph); setMessages(m); setItinerary(it);
    }).catch(console.error).finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`trip-${tripId}-messages`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [tripId]);

  const sendChat = async () => {
    if (!chatText.trim()) return;
    const text = chatText; setChatText('');
    try { await api.sendMessage(tripId, text); } catch (e) { console.error(e); }
  };

  const vote = async (suggId, v) => {
    const current = suggestions.find(s => s.id === suggId)?.my_vote;
    const newVote = current === v ? null : v;
    try {
      await api.voteSuggestion(tripId, suggId, newVote);
      const updated = await api.getSuggestions(tripId);
      setSuggestions(updated);
    } catch (e) { console.error(e); }
  };

  const deleteSuggestion = async (suggId) => {
    if (!window.confirm('Delete this suggestion?')) return;
    try {
      await api.default.delete(`/api/trips/${tripId}/suggestions/${suggId}`);
      setSuggestions(prev => prev.filter(s => s.id !== suggId));
    } catch (e) {
      console.error('Delete failed:', e.response?.data || e.message);
      alert('Failed to delete suggestion');
    }
  };

  const pollVote = async (pollId, optionId) => {
    try {
      await api.votePoll(tripId, pollId, optionId);
      const updated = await api.getPolls(tripId);
      setPolls(updated);
    } catch (e) { console.error(e); }
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    try {
      const result = await api.inviteMember(tripId, inviteEmail);
      setInviteStatus(`link:${result.token}`);
      setInviteEmail('');
    } catch (e) {
      console.error('Invite error:', e.response?.data || e.message);
      setInviteStatus(e.response?.data?.error || 'Failed to send invite');
    }
  };

  const loadAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const result = await api.getAiSuggestions({
        destination: trip.destination,
        cities: trip.cities,
        start_date: trip.start_date,
        end_date: trip.end_date,
        trip_id: tripId,
      });
      setAiSuggestions(result);
    } catch (e) { console.error(e); }
    finally { setAiLoading(false); }
  };

  const addAiSuggestion = async (item) => {
    try {
      const s = await api.addSuggestion(tripId, {
        type: item.type, title: item.title,
        description: item.description,
        location: item.location,
        cost: item.estimated_cost_usd || item.estimated_cost_per_night_usd || item.estimated_cost_per_person_usd,
      });
      setSuggestions(prev => [s, ...prev]);
      suggestionsTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { console.error(e); }
  };

 const uploadPhoto = async (file) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${tripId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-photos')
        .upload(filename, file);
      if (uploadError) throw uploadError;

      await api.registerPhoto(tripId, {
        storage_path: filename,
        caption: photoCaption,
      });

      const updated = await api.getPhotos(tripId);
      setPhotos(updated);
      setPhotoCaption('');
      setModal(null);
    } catch (e) {
      console.error(e);
      alert('Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!trip) return <div className="loading-screen"><p>Trip not found</p></div>;

  const members = trip.members || [];
  const totalBudget = budget?.total_spent || 0;
  const budgetTarget = budget?.budget_target || trip.budget_target || 0;
  const budgetPct = budgetTarget ? Math.min(100, Math.round((totalBudget / budgetTarget) * 100)) : 0;

  return (
    <div className="trip-page">
      <header className="trip-header">
        <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>← Back</button>
        <div className="trip-header-info">
          <h1>{trip.emoji || '✈️'} <em>{trip.name}</em></h1>
          <p>{trip.start_date && new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {trip.end_date && ` – ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {trip.cities?.length ? ` · ${trip.cities.join(' · ')}` : ''}
          </p>
        </div>
        <div className="trip-header-right">
          <div className="members-row">
            {members.slice(0, 5).map((m, i) => (
              <div key={i} className="member-avatar" title={m.profile?.full_name}
                style={{ background: `hsl(${i * 60}, 60%, 45%)` }}>
                {(m.profile?.full_name || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
          <button className="btn btn-outline" onClick={() => setModal('invite')}>+ Invite</button>
        </div>
      </header>

      <div className="trip-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`trip-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="trip-content">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="tab-pane">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Travelers</div>
                <div className="stat-value">{members.length}</div>
                <div className="stat-sub">people in this trip</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Destination</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{trip.destination}</div>
                <div className="stat-sub">{trip.cities?.join(', ')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Budget Spent</div>
                <div className="stat-value">${totalBudget.toLocaleString()}</div>
                <div className="stat-sub">{budgetPct}% of ${budgetTarget.toLocaleString()} target</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Suggestions</div>
                <div className="stat-value">{suggestions.length}</div>
                <div className="stat-sub">{polls.filter(p => p.my_vote_option_id === null).length} polls need your vote</div>
              </div>
            </div>
            <h2 className="section-title">Top Suggestions</h2>
            {suggestions.slice(0, 3).map(s => (
              <div key={s.id} className="suggestion-card mini">
                <span className="sugg-icon">
                  {s.type === 'hotel' ? '🏨' : s.type === 'food' ? '🍽' : s.type === 'transport' ? '🚗' : '🎨'}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="sugg-title">{s.title}</div>
                  <div className="sugg-meta">👍 {s.upvotes} · 👎 {s.downvotes}</div>
                </div>
                <span className={`tag tag-${s.type}`}>{s.type}</span>
              </div>
            ))}
          </div>
        )}

        {/* ITINERARY */}
        {tab === 'itinerary' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2 className="section-title" style={{ margin: 0 }}>Itinerary</h2>
              <button className="btn btn-gold" onClick={() => setModal('event')}>+ Add Event</button>
            </div>
            {itinerary.length === 0 ? (
              <div className="empty-tab"><p>No events yet. Add your first itinerary item!</p></div>
            ) : (
              itinerary.map(ev => (
                <div key={ev.id} className="event-card">
                  <div className="event-time">
                    {ev.start_time ? new Date(ev.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                  <div className="event-icon">
                    {ev.type === 'flight' ? '✈️' : ev.type === 'accommodation' ? '🏨' : ev.type === 'food' ? '🍽' : ev.type === 'transport' ? '🚗' : '🎯'}
                  </div>
                  <div className="event-info">
                    <div className="event-name">{ev.title}</div>
                    {ev.location && <div className="event-meta">📍 {ev.location}</div>}
                    {ev.description && <div className="event-meta">{ev.description}</div>}
                  </div>
                  {ev.cost_per_person && <div className="event-cost">${ev.cost_per_person}/pp</div>}
                </div>
              ))
            )}
          </div>
        )}

{/* SUGGESTIONS */}
        {tab === 'suggestions' && (
          <div className="tab-pane">
            <div className="section-header" ref={suggestionsTopRef}>
              <h2 className="section-title" style={{ margin: 0 }}>Suggestions</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={loadAiSuggestions} disabled={aiLoading}>
                  {aiLoading ? '✨ Loading...' : '✨ AI Suggest'}
                </button>
                <button className="btn btn-gold" onClick={() => setModal('suggestion')}>+ Add</button>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {suggestions.map(s => (
                  <div key={s.id} className="suggestion-card">
                    <div className="sugg-header" style={{ cursor: 'pointer' }}
                      onClick={() => setModal(`sugg-${s.id}`)}>
                      <span className="sugg-icon">
                        {s.type === 'hotel' ? '🏨' : s.type === 'food' ? '🍽' : s.type === 'transport' ? '🚗' : '🎨'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="sugg-title">{s.title}</div>
                          <span className={`tag tag-${s.type}`}>{s.type}</span>
                        </div>
                        <div className="sugg-meta">by {s.created_by_profile?.full_name || 'someone'}</div>
                        {s.description && <div className="sugg-desc">{s.description}</div>}
                        {s.cost && <div className="sugg-meta">💰 Est. ${parseFloat(s.cost).toLocaleString()}</div>}
                        {s.url && <div className="sugg-meta">🔗 <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }} onClick={e => e.stopPropagation()}>{s.url}</a></div>}
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.72rem', color: 'var(--muted)', padding: '2px 6px' }}
                        onClick={e => { e.stopPropagation(); deleteSuggestion(s.id); }}
                        title="Delete suggestion"
                      >🗑</button>
                    </div>
                    <div className="sugg-footer">
                      <button className={`vote-btn ${s.my_vote === 'up' ? 'voted-up' : ''}`} onClick={() => vote(s.id, 'up')}>
                        👍 {s.upvotes}
                      </button>
                      <button className={`vote-btn ${s.my_vote === 'down' ? 'voted-down' : ''}`} onClick={() => vote(s.id, 'down')}>
                        👎 {s.downvotes}
                      </button>
                    </div>

                    {/* EXPANDED DETAIL MODAL */}
                    {modal === `sugg-${s.id}` && (
                      <div className="modal-overlay" onClick={() => setModal(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <span style={{ fontSize: '2rem' }}>
                              {s.type === 'hotel' ? '🏨' : s.type === 'food' ? '🍽' : s.type === 'transport' ? '🚗' : '🎨'}
                            </span>
                            <div>
                              <div className="modal-title" style={{ margin: 0 }}>{s.title}</div>
                              <span className={`tag tag-${s.type}`}>{s.type}</span>
                            </div>
                          </div>
                          {s.description && (
                            <div style={{ marginBottom: 12, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text)' }}>
                              {s.description}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                            {s.location && <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>📍 {s.location}</div>}
{s.cost && <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>💰 Est. ${parseFloat(s.cost).toLocaleString()}</div>}
{s.url && <div style={{ fontSize: '0.82rem' }}>🔗 <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>{s.url}</a></div>}
<div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>👤 Suggested by {s.created_by_profile?.full_name || 'someone'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <button className={`vote-btn ${s.my_vote === 'up' ? 'voted-up' : ''}`} onClick={() => vote(s.id, 'up')}>
                              👍 {s.upvotes}
                            </button>
                            <button className={`vote-btn ${s.my_vote === 'down' ? 'voted-down' : ''}`} onClick={() => vote(s.id, 'down')}>
                              👎 {s.downvotes}
                            </button>
                          </div>
                          <div className="modal-footer">
                            <button className="btn btn-ghost" style={{ color: 'var(--muted)' }}
                              onClick={e => { e.stopPropagation(); setModal(null); deleteSuggestion(s.id); }}>
                              🗑 Delete
                            </button>
                            <button className="btn btn-gold" onClick={() => setModal(null)}>Close</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {aiSuggestions && (
              <div className="ai-panel">
                <div className="ai-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✨ AI Suggestions for {trip.destination}</span>
                  <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px' }} onClick={() => setAiSuggestions(null)}>✕ Close</button>
                </div>
                {[...(aiSuggestions.activities || []), ...(aiSuggestions.hotels || []), ...(aiSuggestions.restaurants || [])].map((item, i) => (
                  <div key={i} className="suggestion-card">
                    <div className="sugg-header">
                      <span className="sugg-icon">{item.type === 'hotel' ? '🏨' : item.type === 'food' ? '🍽' : '🎨'}</span>
                      <div style={{ flex: 1 }}>
                        <div className="sugg-title">{item.title}</div>
                        <div className="sugg-desc">{item.description}</div>
                        {(item.estimated_cost_usd || item.estimated_cost_per_night_usd || item.estimated_cost_per_person_usd) && (
                          <div className="sugg-meta">
                            💰 Est. ${(item.estimated_cost_usd || item.estimated_cost_per_night_usd || item.estimated_cost_per_person_usd).toLocaleString()}
                            {item.estimated_cost_per_night_usd ? '/night' : item.estimated_cost_per_person_usd ? '/person' : ''}
                          </div>
                        )}
                      </div>
                      <button className="btn btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => addAiSuggestion(item)}>
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length === 0 && !aiSuggestions && (
              <div className="empty-tab"><p>No suggestions yet. Add one or try ✨ AI Suggest!</p></div>
            )}
          </div>
        )}
        {/* POLLS */}
        {tab === 'polls' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2 className="section-title" style={{ margin: 0 }}>Polls</h2>
              <button className="btn btn-gold" onClick={() => setModal('poll')}>+ Create Poll</button>
            </div>
            {polls.map(poll => {
              const total = poll.total_votes || 1;
              return (
                <div key={poll.id} className="poll-card">
                  <div className="poll-question">{poll.question}</div>
                  {poll.options?.map(opt => {
                    const pct = Math.round((opt.votes / total) * 100);
                    const selected = poll.my_vote_option_id === opt.id;
                    return (
                      <div key={opt.id} className={`poll-option ${selected ? 'selected' : ''}`}
                        onClick={() => pollVote(poll.id, opt.id)}>
                        <div className="poll-bar" style={{ width: `${pct}%` }} />
                        <div className="poll-option-text">
                          <span>{opt.text}</span>
                          <span>{pct}% · {opt.votes} votes</span>
                        </div>
                      </div>
                    );
                  })}
                  {poll.my_vote_option_id === null && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gold)', marginTop: 8 }}>⚡ Tap to vote</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* BUDGET */}
        {tab === 'budget' && (
          <div className="tab-pane">
            <h2 className="section-title">Budget</h2>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div className="stat-label">Total Spent</div>
                  <div className="stat-value">${totalBudget.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label">Target</div>
                  <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>
                    ${budgetTarget.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="budget-bar-wrap">
                <div className="budget-bar" style={{ width: `${budgetPct}%` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>{budgetPct}% of target used</div>
            </div>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>Expenses</h3>
              <button className="btn btn-gold" onClick={() => setModal('expense')}>+ Log Expense</button>
            </div>
            {(budget?.expenses || []).map(exp => (
              <div key={exp.id} className="expense-row">
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{exp.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {exp.category} · paid by {exp.paid_by_profile?.full_name || 'unknown'}
                  </div>
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--green)' }}>
                  ${parseFloat(exp.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2 className="section-title" style={{ margin: 0 }}>Photos</h2>
              <button className="btn btn-gold" onClick={() => setModal('photo')}>+ Add Photo</button>
            </div>
            <div className="photo-grid">
              {photos.map(p => (
                <div key={p.id} className="photo-card" onClick={() => setModal(`lightbox-${p.id}`)}>
                  <img src={p.url} alt={p.caption || ''} />
                  <div className="photo-overlay">
                    <div>{p.caption}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>by {p.uploaded_by_profile?.full_name}</div>
                  </div>
                  <div className="photo-actions" onClick={e => e.stopPropagation()}>
                   <button className="photo-action-btn" title="Download"
  onClick={async () => {
    const res = await fetch(p.url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.caption || 'photo';
    a.click();
  }}>⬇️</button>
                    <button className="photo-action-btn" title="Delete"
                      onClick={async () => {
                        if (!window.confirm('Delete this photo?')) return;
                        try {
                          await api.default.delete(`/api/trips/${tripId}/photos/${p.id}`);
                          setPhotos(prev => prev.filter(ph => ph.id !== p.id));
                        } catch (e) { console.error(e); }
                      }}>🗑</button>
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <div className="empty-tab" style={{ gridColumn: '1/-1' }}>
                  <p>No photos yet. Share your trip memories!</p>
                </div>
              )}
            </div>

            {/* LIGHTBOX */}
            {photos.map(p => modal === `lightbox-${p.id}` && (
              <div key={p.id} className="lightbox-overlay" onClick={() => setModal(null)}>
                <div className="lightbox" onClick={e => e.stopPropagation()}>
                  <button className="lightbox-close" onClick={() => setModal(null)}>✕</button>
                  <img src={p.url} alt={p.caption || ''} className="lightbox-img" />
                  <div className="lightbox-footer">
                    <div>
                      {p.caption && <div style={{ fontSize: '0.9rem' }}>{p.caption}</div>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>by {p.uploaded_by_profile?.full_name}</div>
                    </div>
                    <button className="btn btn-gold" style={{ fontSize: '0.8rem' }}
  onClick={async () => {
    const res = await fetch(p.url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.caption || 'photo';
    a.click();
  }}>⬇️ Download</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* CHAT */}
        {tab === 'chat' && (
          <div className="chat-wrap">
            <div className="messages">
              {messages.map((m, i) => {
                const isMe = m.user_id === user?.id;
                const name = m.user?.full_name || m.user?.username || 'Unknown';
                return (
                  <div key={m.id || i} className={`msg ${isMe ? 'msg-me' : ''}`}>
                    {!isMe && (
                      <div className="msg-avatar" style={{ background: `hsl(${name.charCodeAt(0) * 20}, 60%, 45%)` }}>
                        {name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="msg-content">
                      {!isMe && <div className="msg-meta"><strong>{name}</strong> {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
                      <div className="msg-bubble">{m.content}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-row">
              <textarea className="chat-input" rows={2} placeholder="Message the group..."
                value={chatText} onChange={e => setChatText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button className="btn btn-gold" onClick={sendChat}>Send</button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal === 'invite' && (
        <div className="modal-overlay" onClick={() => { setModal(null); setInviteStatus(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Invite to {trip.name}</div>
            <div style={{ marginBottom: 16 }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="member-avatar">{(m.profile?.full_name || '?')[0].toUpperCase()}</div>
                  <span style={{ fontSize: '0.84rem' }}>{m.profile?.full_name || m.profile?.username}</span>
                  {m.role === 'organizer' && <span className="tag tag-activity" style={{ marginLeft: 'auto' }}>Organizer</span>}
                </div>
              ))}
            </div>
            {inviteStatus && inviteStatus.startsWith('link:') ? (
  <div className="success-msg">
    ✅ Share this link with your friend:
    <br />
    <span
      style={{ color: 'var(--accent)', fontSize: '0.78rem', wordBreak: 'break-all', cursor: 'pointer' }}
      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${inviteStatus.replace('link:', '')}`)}
    >
      📋 Click to copy invite link
    </span>
  </div>
) : inviteStatus ? (
  <div className="error-msg">{inviteStatus}</div>
) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setModal(null); setInviteStatus(''); }}>Close</button>
              <button className="btn btn-gold" onClick={sendInvite}>Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'photo' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Photo 📸</div>
            <div className="form-group">
              <label className="form-label">Caption (optional)</label>
              <input className="form-input" placeholder="e.g. Sunset in Cartagena"
                value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Choose Photo</label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => uploadPhoto(e.target.files[0])}
              />
              <button
                className="btn btn-outline"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
              >
                {photoUploading ? '⏳ Uploading...' : '📁 Browse Photos'}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'suggestion' && <SuggestionModal tripId={tripId} onClose={() => setModal(null)}
        onAdd={s => { setSuggestions(prev => [s, ...prev]); suggestionsTopRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />}
      {modal === 'poll' && <PollModal tripId={tripId} onClose={() => setModal(null)}
        onAdd={p => setPolls(prev => [p, ...prev])} />}
      {modal === 'expense' && <ExpenseModal tripId={tripId} onClose={() => setModal(null)}
        onAdd={() => api.getBudget(tripId).then(setBudget)} />}
      {modal === 'event' && <EventModal tripId={tripId} onClose={() => setModal(null)}
        onAdd={ev => setItinerary(prev => [...prev, ev])} />}
    </div>
  );
}

function SuggestionModal({ tripId, onClose, onAdd }) {
  const [form, setForm] = useState({ type: 'activity', title: '', description: '', location: '', cost: '', url: '' });
  const [saving, setSaving] = useState(false);
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const save = async () => {
    if (!form.title) return;
    setSaving(true);
    try { const s = await api.addSuggestion(tripId, form); onAdd(s); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Suggestion</div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" name="type" value={form.type} onChange={handle}>
            <option value="activity">Activity</option>
            <option value="hotel">Hotel</option>
            <option value="food">Restaurant / Food</option>
            <option value="transport">Transport</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" name="title" placeholder="e.g. Sunset boat tour" value={form.title} onChange={handle} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" name="description" placeholder="Any details..." value={form.description} onChange={handle} />
        </div>
        <div className="form-group">
          <label className="form-label">Link (optional)</label>
          <input className="form-input" name="url" placeholder="https://..." value={form.url} onChange={handle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Location</label>
            <input className="form-input" name="location" value={form.location} onChange={handle} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Est. Cost ($)</label>
            <input className="form-input" name="cost" type="number" value={form.cost} onChange={handle} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add Suggestion'}</button>
        </div>
      </div>
    </div>
  );
}

function PollModal({ tripId, onClose, onAdd }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!question || options.filter(Boolean).length < 2) return;
    setSaving(true);
    try { const p = await api.createPoll(tripId, { question, options: options.filter(Boolean) }); onAdd(p); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Create Poll</div>
        <div className="form-group">
          <label className="form-label">Question</label>
          <input className="form-input" placeholder="What should we decide?" value={question} onChange={e => setQuestion(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Options</label>
          {options.map((opt, i) => (
            <input key={i} className="form-input" style={{ marginBottom: 6 }}
              placeholder={`Option ${i + 1}`} value={opt}
              onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} />
          ))}
          {options.length < 5 && (
            <button className="btn btn-ghost" style={{ fontSize: '0.75rem', marginTop: 4 }}
              onClick={() => setOptions(o => [...o, ''])}>+ Add option</button>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create Poll'}</button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ tripId, onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', status: 'paid' });
  const [saving, setSaving] = useState(false);
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const save = async () => {
    if (!form.title || !form.amount) return;
    setSaving(true);
    try { await api.addExpense(tripId, form); onAdd(); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Log Expense</div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" name="title" placeholder="e.g. Airbnb deposit" value={form.title} onChange={handle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Amount ($)</label>
            <input className="form-input" name="amount" type="number" value={form.amount} onChange={handle} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Category</label>
            <select className="form-select" name="category" value={form.category} onChange={handle}>
              <option value="flights">Flights</option>
              <option value="accommodation">Accommodation</option>
              <option value="activities">Activities</option>
              <option value="food">Food</option>
              <option value="transport">Transport</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Log Expense'}</button>
        </div>
      </div>
    </div>
  );
}

function EventModal({ tripId, onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', type: 'activity', location: '', start_time: '', cost_per_person: '' });
  const [saving, setSaving] = useState(false);
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const save = async () => {
    if (!form.title) return;
    setSaving(true);
    try { const ev = await api.addEvent(tripId, form); onAdd(ev); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Itinerary Event</div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" name="title" placeholder="e.g. Graffiti tour" value={form.title} onChange={handle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Type</label>
            <select className="form-select" name="type" value={form.type} onChange={handle}>
              <option value="activity">Activity</option>
              <option value="flight">Flight</option>
              <option value="accommodation">Accommodation</option>
              <option value="food">Food</option>
              <option value="transport">Transport</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Date & Time</label>
            <input className="form-input" name="start_time" type="datetime-local" value={form.start_time} onChange={handle} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Location</label>
          <input className="form-input" name="location" value={form.location} onChange={handle} />
        </div>
        <div className="form-group">
          <label className="form-label">Cost per person ($)</label>
          <input className="form-input" name="cost_per_person" type="number" value={form.cost_per_person} onChange={handle} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add Event'}</button>
        </div>
      </div>
    </div>
  );
}