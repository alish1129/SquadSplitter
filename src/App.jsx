import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { generateTeams } from './lib/teamBalancer.js';
import AuthWidget from './components/AuthWidget.jsx';
import Turnout from './components/Turnout.jsx';
import Teams from './components/Teams.jsx';
import RosterManager from './components/RosterManager.jsx';
import AdminApprovals from './components/AdminApprovals.jsx';
import AdminSettings from './components/AdminSettings.jsx';
import ThemePicker from './components/ThemePicker.jsx';
import SessionPicker from './components/SessionPicker.jsx';

// ── URL helpers ──────────────────────────────────────────────
function getDateParam() {
  return new URLSearchParams(window.location.search).get('date') ?? null;
}
function getViewParam() {
  return new URLSearchParams(window.location.search).get('view') ?? null;
}
function pushDateParam(dateStr) {
  const url = new URL(window.location);
  if (dateStr) url.searchParams.set('date', dateStr);
  else url.searchParams.delete('date');
  window.history.pushState({}, '', url);
}


export default function App() {
  // Auth
  const [authSession, setAuthSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // Roster
  const [players, setPlayers] = useState([]);

  // App config
  const [hideRatings, setHideRatings] = useState(true);   // default: hidden until DB confirms

  // Game session
  const [gameSession, setGameSession] = useState(null);   // {id, session_date, …}
  const [turnoutMap, setTurnoutMap] = useState({});        // { player_id → is_in }
  const [split, setSplit] = useState(null);                // {team_a, team_b}

  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const realtimeRef = useRef(null);
  const configChRef = useRef(null);

  // ── Data loaders ─────────────────────────────────────────
  const loadPlayers = useCallback(async () => {
    const { data, error } = await supabase.from('players').select('*').order('name');
    if (error) setGlobalError(error.message);
    else setPlayers(data ?? []);
  }, []);

  const loadTurnout = useCallback(async (sessionId) => {
    const { data } = await supabase
      .from('session_turnout')
      .select('player_id, is_in')
      .eq('session_id', sessionId);
    setTurnoutMap(Object.fromEntries((data ?? []).map((t) => [t.player_id, t.is_in])));
  }, []);

  const loadSplit = useCallback(async (sessionId) => {
    const { data } = await supabase
      .from('splits')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    setSplit(data ?? null);
  }, []);

  const loadGameSession = useCallback(async (dateStr) => {
    const q = supabase.from('sessions').select('*');
    const { data } = dateStr
      ? await q.eq('session_date', dateStr).maybeSingle()
      : await q.order('session_date', { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
  }, []);

  const subscribeSession = useCallback((sessionId) => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    realtimeRef.current = supabase
      .channel(`game-session-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_turnout',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadTurnout(sessionId))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'splits',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadSplit(sessionId))
      .subscribe();
  }, [loadTurnout, loadSplit]);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) setGlobalError(error.message);
    setProfile(data ?? { id: userId, is_admin: false });
  }, []);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from('app_config')
      .select('hide_ratings')
      .eq('id', 1)
      .maybeSingle();
    if (data) setHideRatings(data.hide_ratings);
  }, []);

  // ── Boot ─────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      await Promise.all([loadPlayers(), loadConfig()]);
      const gs = await loadGameSession(getDateParam());
      if (gs) {
        setGameSession(gs);
        await Promise.all([loadTurnout(gs.id), loadSplit(gs.id)]);
        subscribeSession(gs.id);
      }
      setLoaded(true);
    }
    boot();

    // Players realtime (roster & rating changes)
    const playersCh = supabase
      .channel('roster-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
      .subscribe();

    // App config realtime (admin toggles visible to all sessions instantly)
    configChRef.current = supabase
      .channel('app-config-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, loadConfig)
      .subscribe();

    return () => {
      supabase.removeChannel(playersCh);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
      if (configChRef.current) supabase.removeChannel(configChRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session);
      loadProfile(data.session?.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setAuthSession(s);
      loadProfile(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // ── Navigate to a date ───────────────────────────────────
  async function navigateToDate(dateStr) {
    pushDateParam(dateStr);
    const gs = await loadGameSession(dateStr);
    setGameSession(gs);
    setSplit(null);
    setTurnoutMap({});
    if (gs) {
      await Promise.all([loadTurnout(gs.id), loadSplit(gs.id)]);
      subscribeSession(gs.id);
    }
  }

  async function reloadSession() {
    if (!gameSession) return;
    const gs = await loadGameSession(gameSession.session_date);
    setGameSession(gs);
  }

  // ── Derived state ─────────────────────────────────────────
  const isAdmin = !!profile?.is_admin;

  // Merge roster with this session's turnout
  const playersWithTurnout = useMemo(
    () => players.map((p) => ({ ...p, is_in: turnoutMap[p.id] ?? false })),
    [players, turnoutMap]
  );

  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  // ── Generate teams ────────────────────────────────────────
  async function handleGenerate() {
    if (!gameSession) return;
    const inPlayers = playersWithTurnout.filter((p) => p.is_in);
    if (inPlayers.length < 2) return;
    setGenerating(true);
    const { team_a, team_b } = generateTeams(inPlayers);
    const { error } = await supabase
      .from('splits')
      .upsert({ session_id: gameSession.id, team_a, team_b, generated_at: new Date().toISOString() });
    setGenerating(false);
    if (error) setGlobalError(error.message);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="topbar" role="banner">
        <ThemePicker />
      </div>

      <div className="hero">
        <div className="hero-row">
          <div>
            <div className="eyebrow">Pickup Soccer</div>
            <h1>Squad Split</h1>
            <p>Mark who's in, then split into two fair teams by skill and position.</p>
          </div>
          <AuthWidget session={authSession} profile={profile} />
        </div>
      </div>

      {globalError && <p className="error-note" role="alert">{globalError}</p>}

      {!loaded ? (
        <p className="empty-note" aria-live="polite">Loading…</p>
      ) : (
        <>
          <SessionPicker
            gameSession={gameSession}
            isAdmin={isAdmin}
            onNavigate={navigateToDate}
            onSessionUpdated={reloadSession}
          />

          {!gameSession ? (
            <p className="empty-note">
              {isAdmin
                ? 'Pick a date above to create or open a session, then share the link with your group.'
                : 'No session is open yet. Ask an admin to create one and send you the link.'}
            </p>
          ) : (
            <div className="main-grid">
              <div>
                <Turnout
                  players={playersWithTurnout}
                  session={authSession}
                  sessionId={gameSession.id}
                  isAdmin={isAdmin}
                  hideRatings={hideRatings}
                  onGenerate={handleGenerate}
                  generating={generating}
                />
              </div>
              <div>
                <Teams
                  split={split}
                  players={playersWithTurnout}
                  playersById={playersById}
                  onGenerate={handleGenerate}
                  isAdmin={isAdmin}
                  hideRatings={hideRatings}
                  generating={generating}
                  gameSession={gameSession}
                />
              </div>
            </div>
          )}

          {isAdmin && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <AdminSettings hideRatings={hideRatings} onOptimistic={setHideRatings} />
              <RosterManager players={players} />
              <AdminApprovals selfId={authSession?.user?.id} />
            </div>
          )}

          {!authSession && (
            <p className="empty-note" style={{ marginTop: 8 }}>
              Sign in above to mark yourself IN. Ask an existing admin to promote you if you need to
              manage ratings and the roster.
            </p>
          )}
        </>
      )}
    </>
  );
}
