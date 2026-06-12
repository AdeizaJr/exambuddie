import React, { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({ title, onClose, children, wide = false }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`flex max-h-[90vh] flex-col rounded-xl border border-border bg-surface shadow-2xl ${
          wide ? "w-full max-w-3xl" : "w-full max-w-lg"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-lg leading-none text-muted transition-colors hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
