import { ImageResponse } from 'next/og';

export const alt = 'ExamBuddie — Ace WAEC, JAMB & NECO on Telegram';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1D4ED8 0%, #6D28D9 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 900, color: 'white', letterSpacing: -4 }}>E</span>
          <span style={{ fontSize: 28, position: 'absolute', marginLeft: 68, marginTop: 52, color: '#FDE68A' }}>★</span>
        </div>

        {/* Product name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: 'white',
            letterSpacing: -2,
            marginBottom: 16,
          }}
        >
          ExamBuddie
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Ace WAEC, JAMB &amp; NECO on Telegram
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
          {['Past Questions', 'AI Explanations', 'Progress Tracking'].map((label) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 22,
                color: 'white',
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ marginTop: 48, fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>
          exambuddie.app
        </div>
      </div>
    ),
    size,
  );
}
