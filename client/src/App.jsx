import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Account from './pages/Account';
import Dashboard from './pages/Dashboard';
import GamesList from './pages/GamesList';
import GameForm from './pages/GameForm';
import GameDetail from './pages/GameDetail';
import GameShare from './pages/GameShare';
import Players from './pages/Players';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-pitch-950 flex items-center justify-center">
      <Spinner />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/games/:id/share" element={<GameShare />} />
            <Route element={<AuthGuard />}>
              <Route element={<Layout />}>
                <Route index                 element={<Dashboard />} />
                <Route path="games"          element={<GamesList />} />
                <Route path="games/new"      element={<GameForm />} />
                <Route path="games/:id/edit" element={<GameForm />} />
                <Route path="games/:id"      element={<GameDetail />} />
                <Route path="players"        element={<Players />} />
                <Route path="stats"          element={<Stats />} />
                <Route path="settings"       element={<Settings />} />
                <Route path="account"        element={<Account />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
