// Download a file from an authenticated API endpoint.
// Uses apiFetch so the Authorization header (and automatic token refresh) apply,
// then saves the response from a Blob — no token ever appears in a URL.
export async function downloadFromApi(apiFetch, url, filename) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Download failed (${res.status})`);
  }
  const blob   = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
}
