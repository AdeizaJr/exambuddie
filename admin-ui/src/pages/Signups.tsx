import React, { useState, useEffect, useCallback } from "react";
import { Gift, UserPlus, Users, CheckCircle2 } from "lucide-react";
import { getReferrals, getAcquisition, type ReferralsResponse, type AcquisitionRow } from "../api";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";
import StatCard from "../components/StatCard";

// Matches checkAndGrantReferralReward: 3 days of Premium once 2 invitees have practiced
const REWARD_THRESHOLD = 2;

// users.source is the /start payload minus "from_" (see joinSourceFromPayload in the
// bot), so the first segment is the channel and the rest is the page within it.
const CHANNEL_LABELS: Record<string, string> = {
  landing: "Home page",
  blog: "Blog",
  waec: "WAEC pages",
  jamb: "JAMB pages",
  neco: "NECO pages",
  pricing: "Pricing section",
  referral: "Friend invite",
  challenge: "Challenge link",
  direct: "Opened bot directly",
  other: "Other link",
};
const UNTRACKED = "__untracked";

interface Channel {
  key: string;
  label: string;
  users: number;
  last_7d: number;
  pages: { name: string; users: number; last_7d: number }[];
}

function groupChannels(rows: AcquisitionRow[]): Channel[] {
  const map = new Map<string, Channel>();
  for (const r of rows) {
    const [head, ...rest] = r.source ? r.source.split("_") : [UNTRACKED];
    const key = r.source ? head : UNTRACKED;
    let ch = map.get(key);
    if (!ch) {
      ch = {
        key,
        label: key === UNTRACKED ? "Before tracking started" : CHANNEL_LABELS[key] ?? key,
        users: 0,
        last_7d: 0,
        pages: [],
      };
      map.set(key, ch);
    }
    ch.users += r.users;
    ch.last_7d += r.last_7d;
    if (rest.length) ch.pages.push({ name: rest.join(" "), users: r.users, last_7d: r.last_7d });
  }
  // Untracked last: it only shrinks over time and would otherwise top the list
  return [...map.values()].sort(
    (a, b) => Number(a.key === UNTRACKED) - Number(b.key === UNTRACKED) || b.users - a.users
  );
}

function JoinSources() {
  const [rows, setRows] = useState<AcquisitionRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAcquisition()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <div className="rounded-xl border border-border bg-surface p-6 text-red-400">{error}</div>;
  if (!rows) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-surface py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const channels = groupChannels(rows);
  const total = channels.reduce((n, c) => n + c.users, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Users</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Last 7 days</th>
              <th className="w-1/3 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {channels.map((c) => {
              const pct = total ? Math.round((c.users / total) * 100) : 0;
              const expandable = c.pages.length > 0;
              const isOpen = open === c.key;
              return (
                <React.Fragment key={c.key}>
                  <tr
                    onClick={expandable ? () => setOpen(isOpen ? null : c.key) : undefined}
                    className={`transition-colors hover:bg-surface2 ${expandable ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className="mr-2 inline-block w-3 text-muted">{expandable ? (isOpen ? "▾" : "▸") : ""}</span>
                      <span className={c.key === UNTRACKED ? "text-muted" : "font-medium text-white"}>{c.label}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{c.users.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white">{c.last_7d ? `+${c.last_7d}` : <span className="text-muted">0</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface2">
                          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs text-muted">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    c.pages
                      .sort((a, b) => b.users - a.users)
                      .map((p) => (
                        <tr key={p.name} className="bg-bg/40 text-xs">
                          <td className="py-2 pl-14 pr-4 capitalize text-muted">{p.name}</td>
                          <td className="px-4 py-2 text-white">{p.users}</td>
                          <td className="px-4 py-2 text-muted">{p.last_7d ? `+${p.last_7d}` : "0"}</td>
                          <td />
                        </tr>
                      ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function Signups() {
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getReferrals());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const referrers = (data?.referrers ?? []).filter(
    (r) =>
      !q ||
      r.first_name?.toLowerCase().includes(q) ||
      r.username?.toLowerCase().includes(q) ||
      String(r.telegram_id).includes(q) ||
      r.referred.some(
        (u) => u.first_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
      )
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Signups</h1>
        <p className="mt-0.5 text-sm text-muted">Where new users came from before opening the bot</p>
      </div>

      <JoinSources />

      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Referrals</h2>
          <p className="mt-0.5 text-sm text-muted">
            Who invited whom · reward unlocks once {REWARD_THRESHOLD} invitees answer a question
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Joined via invite" value={data.summary.total_referred} icon={<UserPlus size={16} />} accent />
          <StatCard
            label="Invitees who practiced"
            value={data.summary.total_practiced}
            sub={
              data.summary.total_referred
                ? `${Math.round((data.summary.total_practiced / data.summary.total_referred) * 100)}% of invitees`
                : undefined
            }
            icon={<CheckCircle2 size={16} />}
          />
          <StatCard label="Active inviters" value={data.summary.referrers} icon={<Users size={16} />} />
          <StatCard label="Rewards granted" value={data.summary.rewards_granted} icon={<Gift size={16} />} />
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search inviter or invitee name, username, Telegram ID"
        className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : referrers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {q ? "No matches." : "Nobody has joined through an invite link yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Inviter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Telegram ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Practiced</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Reward</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Latest invite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrers.map((r) => {
                  const open = expanded === r.telegram_id;
                  return (
                    <React.Fragment key={r.telegram_id}>
                      <tr
                        onClick={() => setExpanded(open ? null : r.telegram_id)}
                        className="cursor-pointer transition-colors hover:bg-surface2"
                      >
                        <td className="px-4 py-3">
                          <span className="mr-2 text-muted">{open ? "▾" : "▸"}</span>
                          <span className="font-medium text-white">{r.first_name}</span>
                          {r.username && <span className="ml-1.5 text-xs text-muted">@{r.username}</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{r.telegram_id}</td>
                        <td className="px-4 py-3 font-semibold text-white">{r.referred_count}</td>
                        <td className="px-4 py-3 text-white">{r.practiced_count}</td>
                        <td className="px-4 py-3">
                          {r.reward_granted ? (
                            <Badge variant="green">Granted</Badge>
                          ) : (
                            <Badge variant="gray">
                              {Math.min(r.practiced_count, REWARD_THRESHOLD)}/{REWARD_THRESHOLD}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(r.last_referral_at)}</td>
                      </tr>
                      {open && (
                        <tr className="bg-bg/40">
                          <td colSpan={6} className="px-4 py-3">
                            <ul className="space-y-1.5 pl-6">
                              {r.referred.map((u) => (
                                <li key={u.telegram_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className="font-medium text-white">{u.first_name}</span>
                                  {u.username && <span className="text-muted">@{u.username}</span>}
                                  <span className="font-mono text-muted">{u.telegram_id}</span>
                                  <span className="text-muted">joined {formatDate(u.joined_at)}</span>
                                  {u.practiced ? (
                                    <Badge variant="green">Practiced</Badge>
                                  ) : (
                                    <Badge variant="amber">Not yet</Badge>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
