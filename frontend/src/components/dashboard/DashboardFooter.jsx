const LINKS = ['Help Center', 'Privacy Policy', 'Contact', 'Terms'];

export default function DashboardFooter() {
  return (
    <footer className="mt-8 border-t border-[#1a254a]/50 pt-5 pb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12.5px] text-[#6b78a0]">
        © 2026 Dashboard. All rights reserved.
      </p>

      <nav className="flex flex-wrap items-center gap-6">
        {LINKS.map((l) => (
          <a
            key={l}
            href="#"
            className="text-[12.5px] text-[#8b94b8] transition hover:text-white"
          >
            {l}
          </a>
        ))}
      </nav>
    </footer>
  );
}
