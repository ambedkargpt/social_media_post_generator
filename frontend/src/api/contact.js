import client from './client';

// POST /contact — landing-page contact form. Public: no account required.
// `website` is the honeypot and must stay empty for a real submission.
export async function sendContactMessage({ name, email, message, address, phone, website }) {
  const { data } = await client.post('/contact', {
    name,
    email,
    message,
    address: address || null,
    phone: phone || null,
    website: website || null,
  });
  return data;
}
