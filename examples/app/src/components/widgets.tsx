import styles from './Button.module.css';

// A small internal widget namespace. App imports it as `import * as widgets`,
// so `<widgets.Panel />` is a member-expression element. This also wires up the
// CSS Module in `Button.module.css` (a plain-CSS button, no styled/Tailwind).
export function Panel({ title }: { title: string }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <p className="text-sm text-slate-500">No new activity in the last hour.</p>
      <button type="button" className={styles.button}>
        Refresh
      </button>
    </section>
  );
}
