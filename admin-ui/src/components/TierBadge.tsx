import React from "react";
import Badge from "./Badge";
import type { User, UserTier } from "../types";

const TIERS: Record<UserTier, { label: string; variant: "green" | "amber" | "blue" | "gray"; hint: string }> = {
  paid:   { label: "Premium", variant: "green", hint: "Paying subscriber" },
  gifted: { label: "Premium · gifted", variant: "blue", hint: "Premium set by an admin, no payment" },
  trial:  { label: "Trial", variant: "amber", hint: "On the 14-day welcome trial" },
  free:   { label: "Free", variant: "gray", hint: "Free plan" },
};

// Older API responses have no `tier`; fall back to the plain plan so nothing breaks
// while a deploy is rolling out.
export function tierOf(user: Pick<User, "plan" | "tier">): UserTier {
  return user.tier ?? (user.plan === "premium" ? "paid" : "free");
}

export default function TierBadge({ user }: { user: Pick<User, "plan" | "tier"> }) {
  const t = TIERS[tierOf(user)];
  return (
    <span title={t.hint}>
      <Badge variant={t.variant}>{t.label}</Badge>
    </span>
  );
}
