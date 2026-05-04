import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth }        from './context/AuthContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import LoginPage              from './pages/LoginPage.jsx';
import SessionsPage           from './pages/SessionsPage.jsx';
import NewSessionPage         from './pages/NewSessionPage.jsx';
import ManualMovementPage     from './pages/ManualMovementPage.jsx';
import SetupPairsPage         from './pages/SetupPairsPage.jsx';
import DirectorPage           from './pages/DirectorPage.jsx';
import LeaderboardPage        from './pages/LeaderboardPage.jsx';
import ArchivedSessionsPage   from './pages/ArchivedSessionsPage.jsx';
import DirectorResultsPage    from './pages/DirectorResultsPage.jsx';
import PlayJoinPage           from './pages/PlayJoinPage.jsx';
import PlayerDashboard        from './pages/PlayerDashboard.jsx';
import PlayerResults          from './pages/PlayerResults.jsx';
import TravellerPage          from './pages/TravellerPage.jsx';
import PairResultsPage        from './pages/PairResultsPage.jsx';

function PrivateRoute({ children }) {
  const { auth } = useAuth();
  return auth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <PlayerProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<Navigate to="/sessions" replace />} />

        {/* Director routes */}
        <Route path="/sessions"                   element={<PrivateRoute><SessionsPage /></PrivateRoute>} />
        <Route path="/sessions/new"               element={<PrivateRoute><NewSessionPage /></PrivateRoute>} />
        <Route path="/sessions/archived"          element={<PrivateRoute><ArchivedSessionsPage /></PrivateRoute>} />
        <Route path="/sessions/:id/movement"      element={<PrivateRoute><ManualMovementPage /></PrivateRoute>} />
        <Route path="/sessions/:id/setup"         element={<PrivateRoute><SetupPairsPage /></PrivateRoute>} />
        <Route path="/sessions/:id/director"      element={<PrivateRoute><DirectorPage /></PrivateRoute>} />
        <Route path="/sessions/:id/leaderboard"   element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
        <Route path="/sessions/:id/full-results"  element={<PrivateRoute><DirectorResultsPage /></PrivateRoute>} />

        {/* Player routes */}
        <Route path="/play/:token"              element={<PlayJoinPage />} />
        <Route path="/play/:token/score"        element={<PlayerDashboard />} />
        <Route path="/play/:token/results"      element={<PlayerResults />} />
        <Route path="/play/:token/traveller"    element={<TravellerPage />} />
        <Route path="/play/:token/pair-results" element={<PairResultsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PlayerProvider>
  );
}
