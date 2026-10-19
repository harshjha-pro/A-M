// One screen: top bar + content column.
import TopBar from './TopBar.jsx';

export function ScreenLoader({ message = 'Loading…' }) {
  return (
    <div className="flex w-full items-center justify-center py-12" aria-busy="true">
      <div className="size-8 animate-spin rounded-full border-2 border-[#861C32] border-t-transparent" />
      <span className="sr-only">{message}</span>
    </div>
  );
}

export default function Screen({
  title,
  back = false,
  actions = null,
  main = false,
  variant = 'default',
  loading = false,
  loadingMessage = 'Loading…',
  children,
}) {
  return (
    <>
      {/* Dreamy luxury blush floral background for every screen */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-gradient-to-b from-[#FAF4EC] via-[#FCEAEB] to-[#FAF4EC]">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-64 sm:w-80 h-64 sm:h-80 opacity-25 select-none bg-contain bg-no-repeat bg-right-top rotate-180"
          style={{ backgroundImage: `url('/art/welcome-floral-br-clean.webp')` }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-10 -left-10 w-64 sm:w-80 h-64 sm:h-80 opacity-25 select-none bg-contain bg-no-repeat bg-left-bottom"
          style={{ backgroundImage: `url('/art/welcome-floral-bl-clean.webp')` }}
        />
      </div>

      <TopBar title={title} back={back} actions={actions} main={main} variant={variant} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-safe py-6">
        {loading ? <ScreenLoader message={loadingMessage} /> : children}
      </main>
    </>
  );
}
