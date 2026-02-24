"use client";

import { type KeyboardEvent, useCallback, useState } from "react";

import { Badge } from "../content/Badge.js";

import { Button } from "./Button.js";
import { Input } from "./Input.js";

interface ChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  contextLabel?: string;
}

/** Chat input bar: auto-growing textarea + send button. Enter to send, Shift+Enter for newline. */
export function ChatInput({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  contextLabel,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {return;}
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      {contextLabel !== undefined && (
        <div>
          <Badge variant="accent" size="sm">
            {contextLabel}
          </Badge>
        </div>
      )}
      <div className="flex items-end gap-[var(--space-2)]">
        <div className="flex-1">
          <Input
            value={value}
            onChange={setValue}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            multiline
            rows={1}
            size="sm"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={disabled || value.trim().length === 0}
          onClick={handleSend}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
