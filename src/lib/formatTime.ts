export function formatRelativeTime(ts: number, opts?: { showTime?: boolean }) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(ts).toLocaleDateString();
  if (opts?.showTime) {
    return date + ' ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date;
}
