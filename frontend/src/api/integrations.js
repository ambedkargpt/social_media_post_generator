import client from './client';

// Accounts the user has connected on other platforms, and publishing through
// them. One module per concern, not per platform: Reddit is the only one live,
// and Twitter would be more functions here rather than a second client.

// GET /integrations/reddit/status
// `configured` is the server's side (does this deployment have Reddit
// credentials at all); `connected` is the user's. The UI needs both to tell
// "we cannot do this" apart from "you have not connected yet".
export async function getRedditStatus() {
  const { data } = await client.get('/integrations/reddit/status');
  return data;
}

// POST /integrations/reddit/authorize — the URL to send the user to.
// The app never sees or asks for their Reddit password.
export async function getRedditAuthorizeUrl() {
  const { data } = await client.post('/integrations/reddit/authorize');
  return data.authorize_url;
}

// DELETE /integrations/reddit — also revokes the token on Reddit's side.
export async function disconnectReddit() {
  await client.delete('/integrations/reddit');
}

// POST /posts/{id}/publish/reddit
// The title and body are sent rather than re-derived on the server, so what
// the user read on screen is exactly what lands on the subreddit.
export async function publishPostToReddit(postId, { title, body }) {
  const { data } = await client.post(`/posts/${postId}/publish/reddit`, { title, body });
  return data;
}
