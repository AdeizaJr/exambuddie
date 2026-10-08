import React from "react";

type BadgeVariant = "green" | "amber" | "red" | "blue" | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  green: "bg-success/20 text-success border border-success/30",
  amber: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  red: "bg-red-500/20 text-red-400 border border-red-500/30",
  blue: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  gray: "bg-surface2 text-muted border border-border",
};

export default function Badge({ variant = "gray", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
