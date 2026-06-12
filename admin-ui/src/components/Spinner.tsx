import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-10 h-10" : "w-6 h-6";
  return (
    <div
      className={`${sizeClass} animate-spin rounded-full border-2 border-surface2 border-t-accent`}
      role="status"
      aria-label="Loading"
    />
  );
}
