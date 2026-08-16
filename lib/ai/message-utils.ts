import type { UIMessage } from "ai";

/** Extract plain text from a UIMessage (v7 uses parts array, legacy uses content) */
export function getMessageText(m: UIMessage): string {
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
