export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl">🎓</span>
        <span
          className="text-xl font-extrabold tracking-tight"
          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          ExamBuddie
        </span>
      </div>
      <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      {message && <p className="text-xs text-[var(--tg-hint)]">{message}</p>}
    </div>
  );
}
