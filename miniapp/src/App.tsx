import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import LoadingScreen from './components/LoadingScreen';

const Practice = lazy(() => import('./pages/Practice'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Stats = lazy(() => import('./pages/Stats'));
const Settings = lazy(() => import('./pages/Settings'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));

export default function App() {
  return (
    <div style={{ background: 'var(--tg-secondary-bg)', minHeight: '100vh' }}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}
