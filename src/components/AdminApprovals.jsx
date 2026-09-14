import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AdminApprovals({ selfId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, is_admin, created_at')
      .order('created_at', { ascending: true });
    if (err) setError(err.message);
    else setProfiles(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleAdmin(p) {
    if (p.id === selfId && p.is_admin) {
      const confirmed = window.confirm('Remove your own admin access? You will need another admin to add you back.');
      if (!confirmed) return;
    }
    setError('');
    const { error: err } = await supabase.from('profiles').update({ is_admin: !p.is_admin }).eq('id', p.id);
    if (err) setError(err.message);
    else load();
  }

  return (
    <details className="roster-details card">
      <summary>
        <span className="chev">▸</span>
        <h2 style={{ display: 'inline' }}>Admins</h2>
        <span className="count-badge">{profiles.filter((p) => p.is_admin).length}</span>
      </summary>
      <div style={{ marginTop: 14 }}>
        {loading && <p className="empty-note">Loading…</p>}
        {!loading && profiles.length === 0 && <p className="empty-note">Nobody has signed in yet.</p>}
        {profiles.map((p) => (
          <div className="approval-row" key={p.id}>
            <span className="email">{p.email}</span>
            <button
              type="button"
              className={'btn small' + (p.is_admin ? ' secondary' : '')}
              onClick={() => toggleAdmin(p)}
            >
              {p.is_admin ? 'Remove admin' : 'Make admin'}
            </button>
          </div>
        ))}
        {error && <p className="error-note">{error}</p>}
      </div>
    </details>
  );
}
