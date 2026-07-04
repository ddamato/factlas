import { Alert } from './components/Alert';
import { Badge } from './components/Badge';
import { Button, Ghost } from './components/Button';
import { Card } from './components/Card';
// Namespace import → one `import` fact (namespace); members are components.
import * as widgets from './components/widgets';
// A local legacy component → an ordinary `import` fact (relative specifier).
import { LegacyModal } from './legacy/LegacyModal';
import './styles/globals.css'; // side-effect import fact

// Layout uses plain (non-arbitrary) Tailwind utilities, which are `css.class`
// facts but never violations — so the page looks like a real console while the
// components keep the intentional anti-patterns the evaluation flags.
export function App({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Acme Console</h1>
          <span className="text-sm text-slate-500">design-system demo</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        {/* Component usage → jsx.element (imported_from) + jsx.prop values */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Actions</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" disabled>
              Save
            </Button>
            {/* Dynamic + static-union prop values */}
            <Ghost tone={theme} align={theme === 'dark' ? 'start' : 'center'}>
              Cancel
            </Ghost>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</h2>
          <div className="flex flex-wrap items-start gap-6">
            <Card tone="danger" active />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Unread</span>
              <Badge count={3} />
            </div>
          </div>
        </section>

        {/* Member-expression element → jsx.element (imported_from './components/widgets') */}
        <widgets.Panel title="Recent activity" />

        <section className="space-y-4">
          <LegacyModal open />
          {/* DOM element with an inline style → jsx.attribute (no-inline-style) */}
          <hr style={{ borderColor: '#DDD' }} />
          <Alert />
        </section>
      </main>
    </div>
  );
}
