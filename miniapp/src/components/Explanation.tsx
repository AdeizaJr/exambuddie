// Renders the server-formatted explanation (see withExplanationHtml in backend/src/api/miniapp.ts).
// The backend already escapes everything except <b>/<i>/<u>/<code>, but this goes into
// innerHTML so we re-check here: any "<" that isn't one of those exact bare tags gets escaped,
// which also blocks attributes like <b onclick=...>.
export function sanitizeExplanationHtml(html: string): string {
  return html.replace(/<(?!\/?(?:b|i|u|code)>)/g, '&lt;');
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Props {
  html?: string | null;
  raw?: string | null;
  className?: string;
}

export default function ExplanationBody({ html, raw, className = '' }: Props) {
  const body = html ? sanitizeExplanationHtml(html) : raw ? escapeText(raw) : null;
  if (!body) return <i className={className}>Explanation not yet available.</i>;
  return (
    <span
      className={`block whitespace-pre-line break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
