import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const CONTENT = {
  terms: {
    title: 'Terms of Service',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By creating an account and using AmbedkarGPT, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.',
      },
      {
        heading: '2. Use of the Platform',
        body: 'AmbedkarGPT is an AI-powered knowledge platform dedicated to preserving and amplifying the writings and legacy of Dr. B.R. Ambedkar. You agree to use the platform solely for lawful, educational, and research purposes.',
      },
      {
        heading: '3. User Accounts',
        body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to terminate accounts that violate these terms.',
      },
      {
        heading: '4. Intellectual Property',
        body: 'All content generated or provided by AmbedkarGPT, including AI responses, curated texts, and design elements, is the intellectual property of AmbedkarGPT or its licensors. You may not reproduce or redistribute this content without prior written permission.',
      },
      {
        heading: '5. Limitation of Liability',
        body: 'AmbedkarGPT provides information for educational purposes only and does not constitute legal, political, or professional advice. We are not liable for any decisions made based on the content provided by the platform.',
      },
      {
        heading: '6. Modifications',
        body: 'We reserve the right to modify these Terms at any time. Continued use of the platform after changes are posted constitutes your acceptance of the revised terms.',
      },
      {
        heading: '7. Governing Law',
        body: 'These Terms are governed by the laws of India. Any disputes arising from the use of this platform shall be subject to the exclusive jurisdiction of the courts of India.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect information you provide when creating an account (email, phone number), interaction data within the platform (queries, session activity), and technical data such as device type, browser, and IP address.',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'Your information is used to operate and improve AmbedkarGPT, personalize your experience, send important service updates, and (if opted in) educational content and newsletters.',
      },
      {
        heading: '3. Data Sharing',
        body: 'We do not sell your personal data. We may share data with trusted service providers (e.g., Firebase, cloud infrastructure) strictly for platform operation. We comply with applicable data protection laws.',
      },
      {
        heading: '4. Data Retention',
        body: 'We retain your account data for as long as your account is active. You may request deletion of your data at any time by contacting us. Some data may be retained as required by law.',
      },
      {
        heading: '5. Security',
        body: 'We implement industry-standard security measures including encryption, secure authentication, and regular audits to protect your data. However, no method of transmission over the internet is 100% secure.',
      },
      {
        heading: '6. Cookies',
        body: 'AmbedkarGPT uses cookies and similar technologies to maintain session state and improve user experience. You may control cookie preferences through your browser settings.',
      },
      {
        heading: '7. Your Rights',
        body: 'You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at hello@ambedkargpt.in. We will respond to verified requests within 30 days.',
      },
      {
        heading: '8. Changes to This Policy',
        body: 'We may update this Privacy Policy periodically. We will notify you of material changes via email or a prominent notice on the platform.',
      },
    ],
  },
};

export default function LegalModal({ type, onClose }) {
  const content = CONTENT[type];

  // Close on Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!content) return null;

  // Into document.body: the footer renders inside PageTransition, whose
  // transform becomes the containing block for position:fixed and strands the
  // panel outside the viewport. Signup got away without this only because it
  // has no such ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3,6,17,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-[640px] flex-col rounded-2xl border border-[#1e3260] bg-[#080e24] shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a2c55] px-6 py-4">
          <h2 className="font-display text-[20px] font-semibold text-white">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e3260] text-[#8b94b8] transition hover:border-[#3a6bc4] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#6b80ab]">Last updated: April 2026</p>
          {content.sections.map((s) => (
            <div key={s.heading}>
              <h3 className="mb-1.5 text-[13px] font-semibold text-[#9dc3ff]">{s.heading}</h3>
              <p className="text-[13px] leading-relaxed text-[#a6b9d6]">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1a2c55] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-[#0a7dff] to-[#3a9fff] py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
