"use client";

import { useEffect, useState } from "react";

type Props = {
  messages: string[];
  intervalMs?: number;
};

export function AnalyzingIndicator({ messages, intervalMs = 1800 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages.length, intervalMs]);

  return (
    <div className="analyzing" role="status" aria-live="polite">
      <span className="analyzing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span key={index} className="analyzing-text">
        {messages[index]}
      </span>
    </div>
  );
}
