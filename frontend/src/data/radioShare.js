// Sharing Bhim Radio: the message and the link, to whichever app the listener
// picks.
//
// WhatsApp draws the card from the page's own tags (vite.config.js writes them
// into bhimradio.html); the words around it are the sender's message, which is
// what these links pre-fill. The link sits on a line of its own and is the
// only one, so the card is always the radio.
//
// Emoji: WhatsApp's Windows app turned every one into a replacement box when
// the text reached it through wa.me. On a computer the WhatsApp link goes to
// WhatsApp Web instead, which keeps them; phones keep them through wa.me.

export const RADIO_SHARE_URL = 'https://www.ambedkargpt.in/bhimradio';

export function radioShareText(headline, { withLink = true } = {}) {
  return [
    '🎙️ *भीम रेडियो - दैनिक मध्य भारत समाचार*',
    '',
    '📻 संविधान की बात, जनता के साथ - आज की बड़ी राजनीतिक खबरें, हिंदी में, बिना लॉगिन के।',
    '',
    '✅ हर दिन ताज़ा बुलेटिन',
    '✅ कांग्रेस, सपा, भाजपा और देश-दुनिया की खबरें',
    '✅ मोबाइल पर, कहीं भी, बिल्कुल मुफ़्त',
    ...(headline ? ['', `🔴 *अभी ऑन एयर:* ${headline}`] : []),
    ...(withLink ? ['', '🔗 अभी सुनिए:', RADIO_SHARE_URL] : []),
    '',
    '📢 अपने दोस्तों और साथियों के साथ शेयर कीजिए। जय भीम! 🙏',
  ].join('\n');
}

const ON_PHONE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Short enough for a post: X counts every character. */
function shortText(headline) {
  return headline ? `भीम रेडियो - अभी ऑन एयर: ${headline}` : 'भीम रेडियो - आज की बड़ी राजनीतिक खबरें, हिंदी में';
}

const enc = encodeURIComponent;

/**
 * Where a share can go. `href` opens that app's own share page with the
 * message filled in; `copy` means the app has no such page (Instagram), so the
 * message is copied and the app opened for the listener to paste it.
 */
export function radioShareTargets(headline) {
  const url = RADIO_SHARE_URL;
  return [
    { id: 'whatsapp', label: 'WhatsApp',
      href: `${ON_PHONE ? 'https://wa.me/' : 'https://web.whatsapp.com/send'}?text=${enc(radioShareText(headline))}` },
    { id: 'telegram', label: 'Telegram',
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(radioShareText(headline, { withLink: false }))}` },
    { id: 'instagram', label: 'Instagram', copy: true, href: 'https://www.instagram.com/direct/inbox/' },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${enc(shortText(headline))}&url=${enc(url)}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { id: 'email', label: 'Email',
      href: `mailto:?subject=${enc('भीम रेडियो - दैनिक मध्य भारत समाचार')}&body=${enc(radioShareText(headline).replace(/\*/g, ''))}` },
  ];
}
