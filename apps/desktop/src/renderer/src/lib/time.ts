export function timeAgo(epochSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)): string {
  if (epochSeconds <= 0) return "never";
  const seconds = Math.max(0, nowSeconds - epochSeconds);
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
