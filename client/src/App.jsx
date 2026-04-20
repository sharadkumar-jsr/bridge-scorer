import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage        from './pages/LoginPage.jsx';
import SessionsPage     from './pages/SessionsPage.jsx';
import NewSessionPage   from './pages/NewSessionPage.jsx';
import SetupPairsPage   from './pages/SetupPairsPage.jsx';
import DirectorPage     from './pages/DirectorPage.jsx';
import LeaderboardPage  from './pages/LeaderboardPage.jsx';

function PrivateRoute({ children }) {
  const { auth } = useAuth();
  return auth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/sessions" replace />} />

      <Route path="/sessions" element={
        <PrivateRoute><SessionsPage /></PrivateRoute>
      } />
      <Route path="/sessions/new" element={
        <PrivateRoute><NewSessionPage /></PrivateRoute>
      } />
      <Route path="/sessions/:id/setup" element={
        <PrivateRoute><SetupPairsPage /></PrivateRoute>
      } />
      <Route path="/sessions/:id/director" element={
        <PrivateRoute><DirectorPage /></PrivateRoute>
      } />
      <Route path="/sessions/:id/leaderboard" element={
        <PrivateRoute><LeaderboardPage /></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
