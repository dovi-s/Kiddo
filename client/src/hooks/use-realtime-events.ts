// Re-export shim. The real implementation lives in lib/realtime-context.tsx
// where a single EventSource is shared across every surface that cares about
// realtime events. Keeping this path so older imports continue resolving.

export { useRealtimeEvents, useRealtimeConnected, type RealtimeEvent } from "@/lib/realtime-context";
