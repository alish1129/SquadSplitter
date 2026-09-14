import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { generateTeams } from './lib/teamBalancer.js';
import AuthWidget from './components/AuthWidget.jsx';
import Turnout from './components/Turnout.jsx';
import Teams from './components/Teams.jsx';
import RosterManager from './components/RosterManager.jsx';
import AdminApprovals from './components/AdminApprovals.jsx';
import ThemePicker from './components/ThemePicker.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [split, setSplit] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const loadPlayers = useCallback(async () => {
    const { data, error } = await supabase.from('players').select('*').order('name');
    if (error) setGlobalError(error.message);
    else setPlayers(data);
  }, []);

  const loadSplit = useCallback(async () => {
    const { data, error } = await supabase.from('current_split').select('*').eq('id', 1).maybeSingle();
    if (error) setGlobalError(error.message);
    else setSplit(data);
  }, []);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) setGlobalError(error.message);
    setProfile(data || { id: userId, is_admin: false });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    Promise.all([loadPlayers(), loadSplit()]).then(() => setLoaded(true));

    const channel = supabase
      .channel('squad-split-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_split' }, loadSplit)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadPlayers, loadSplit]);

  const isAdmin = !!profile?.is_admin;
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  async function handleGenerate() {
    const inPlayers = players.filter((p) => p.is_in);
    if (inPlayers.length < 2) return;
    setGenerating(true);
    const { team_a, team_b } = generateTeams(inPlayers);
    const { error } = await supabase
      .from('current_split')
      .upsert({ id: 1, team_a, team_b, generated_at: new Date().toISOString() });
    setGenerating(false);
    if (error) setGlobalError(error.message);
  }

  return (
    <>
      {/* Sticky top bar — theme picker lives here */}
      <div className="topbar" role="banner">
        <ThemePicker />
      </div>

      {/* Hero banner */}
      <div className="hero">
        <div className="hero-row">
          <div>
            <div className="eyebrow">Pickup Soccer</div>
            <h1>Squad Split</h1>
            <p>Mark who's in for this week, then split into two fair teams by skill and position.</p>
          </div>
          <AuthWidget session={session} profile={profile} />
        </div>
      </div>

      {globalError && <p className="error-note col-full">{globalError}</p>}

      {!loaded ? (
        <p className="empty-note" aria-live="polite">Loading…</p>
      ) : (
        <>
          <div className="main-grid">
            {/* Left column: who's in */}
            <div>
              <Turnout
                players={players}
                session={session}
                isAdmin={isAdmin}
                onGenerate={handleGenerate}
                generating={generating}
              />
            </div>

            {/* Right column: team split */}
            <div>
              <Teams
                split={split}
                players={players}
                playersById={playersById}
                onGenerate={handleGenerate}
                isAdmin={isAdmin}
                generating={generating}
              />
            </div>
          </div>

          {/* Admin sections — full width below the grid */}
          {isAdmin && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <RosterManager players={players} />
              <AdminApprovals selfId={session?.user?.id} />
            </div>
          )}

          {!session && (
            <p className="empty-note" style={{ marginTop: 8 }}>
              Sign in above to mark yourself IN for the week. Ask an existing admin to promote you if
              you need to manage ratings and the roster.
            </p>
          )}
        </>
      )}
    </>
  );
}
