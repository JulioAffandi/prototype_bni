"use client";

import type { UIMessage } from "ai";
import { Bot } from "lucide-react";
import { ToolInvocationBadge } from "./ToolInvocationBadge";

/** Extract plain text from a UIMessage (v7 uses parts array) */
function getMessageText(m: UIMessage): string {
  // v7 format: parts array with { type: "text", text: "..." }
  if (m.parts && Array.isArray(m.parts)) {
    return m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  // Fallback for legacy format
  return (m as any).content ?? ""; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Extract tool invocations from a UIMessage (v7 uses parts) */
function getToolInvocations(m: UIMessage): Array<{ toolCallId: string; toolName: string; state: string }> {
  if (m.parts && Array.isArray(m.parts)) {
    return m.parts
      .filter((p): p is any => p.type === "tool-invocation") // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        toolCallId: p.toolInvocation?.toolCallId ?? p.toolCallId ?? "",
        toolName: p.toolInvocation?.toolName ?? p.toolName ?? "",
        state: p.toolInvocation?.state ?? p.state ?? "call",
      }));
  }
  // Fallback for legacy format
  return ((m as any).toolInvocations ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function ChatMessageList({
  messages,
  sapaan,
}: {
  messages: UIMessage[];
  sapaan: string;
}) {
  return (
    <div className="space-y-3">
      {/* Welcome message when message history is empty */}
      {messages.length === 0 && (
        <div className="flex items-start gap-2.5">
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div
            className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]"
            style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.2)" }}
          >
            <p className="text-xs text-slate-200 leading-relaxed">{sapaan}</p>
          </div>
        </div>
      )}

      {/* Render messages */}
      {messages.map((m) => {
        const text = getMessageText(m);
        const toolInvocations = getToolInvocations(m);

        return (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {m.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div className="max-w-[85%] space-y-1">
              {/* Tool Invocations */}
              {toolInvocations.map((inv) => (
                <ToolInvocationBadge
                  key={inv.toolCallId}
                  toolName={inv.toolName}
                  state={inv.state === "result" ? "result" : "call"}
                />
              ))}

              {/* Text Bubble */}
              {text && (
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "rounded-tr-sm text-white"
                      : "rounded-tl-sm text-slate-200"
                  }`}
                  style={
                    m.role === "user"
                      ? { background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {text.split("\n").map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
