import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type LeaderboardEntry } from '../api';
import LoadingScreen from '../components/LoadingScreen';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.getLeaderboard()
      .then(({ entries, myRank }) => {
        setEntries(entries);
        setMyRank(myRank);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="page pb-24">
      <div className="px-4 pt-8 pb-4">
        <button onClick={() => nav(-1)} className="text-blue-600 text-sm mb-4">← Back</button>
        <h1 className="text-2xl font-extrabold text-[var(--tg-text)]">This Week's Top 10</h1>
        <p className="text-sm text-[var(--tg-hint)] mt-1">Rankings reset every Monday · Min 5 attempts</p>
      </div>

      {myRank && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #2563eb15, #7c3aed15)', border: '1px solid #7c3aed30' }}>
          <span className="text-2xl font-extrabold text-violet-600">#{myRank}</span>
          <p className="text-sm text-[var(--tg-text)]">Your current rank this week</p>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-5xl mb-4">🏆</p>
          <p className="text-base font-semibold text-[var(--tg-text)] mb-2">No rankings yet</p>
          <p className="text-sm text-[var(--tg-hint)]">Answer at least 5 questions this week to appear on the leaderboard.</p>
          <button
            onClick={() => nav('/practice')}
            className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-full"
          >
            Start Practising
          </button>
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-2">
          {entries.map(e => (
            <div
              key={e.telegram_id}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'var(--tg-bg)', border: '1px solid rgba(0,0,0,0.07)' }}
            >
              <span className="w-8 text-center text-lg flex-shrink-0">
                {e.rank <= 3 ? MEDALS[e.rank - 1] : <span className="text-sm font-bold text-[var(--tg-hint)]">#{e.rank}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--tg-text)] truncate">{e.first_name}</p>
                <p className="text-xs text-[var(--tg-hint)]">{e.correct}/{e.total} correct</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-extrabold" style={{ color: e.accuracy >= 70 ? '#10B981' : e.accuracy >= 50 ? '#F59E0B' : '#EF4444' }}>
                  {e.accuracy}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
