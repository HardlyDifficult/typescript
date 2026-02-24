"use client";

import { type MouseEvent, type ReactNode, useEffect } from "react";

type ModalSize = "sm" | "md" | "lg" | "full";

interface ModalProps {
  title: string;
  size?: ModalSize;
  onClose: () => void;
  children: ReactNode;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-[420px] w-full mx-4 max-h-[90vh]",
  md: "max-w-[640px] w-full mx-4 max-h-[90vh]",
  lg: "w-[90vw] max-w-6xl h-[90vh]",
  full: "w-[95vw] h-[95vh]",
};

/** Modal overlay with backdrop blur and subtle bordered panel. */
export function Modal({ title, size = "md", onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className={`flex flex-col rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-lg)] ${sizeStyles[size]}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border)]">
          <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text)] font-[family-name:var(--font-sans)]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)] rounded-[var(--radius-md)] px-2.5 py-1 cursor-pointer hover:bg-[color:rgba(255,255,255,0.06)] transition-colors font-[family-name:var(--font-sans)]"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
