import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export const controlClass =
  'h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand-blue';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p> : null}
    </header>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-4 shadow-[0_8px_24px_rgb(23_32_51/0.04)] ${className}`}>
      {children}
    </section>
  );
}

export function Split({
  list,
  form,
  className = 'lg:grid-cols-[minmax(0,1fr)_22rem]',
}: {
  list: ReactNode;
  form: ReactNode;
  className?: string;
}) {
  return <div className={`grid items-start gap-4 ${className}`}>{list}{form}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        {label}
        {hint ? <span className="text-xs font-medium text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-muted/70 focus:border-brand-blue ${props.className ?? ''}`}
    />
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

export function PrimaryButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60 anan-accent-fill ${className}`}
    />
  );
}

export function GhostButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-brand-blue ${className}`}
    />
  );
}

export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full border px-3 text-xs font-bold anan-accent-line ${className}`}
    />
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm leading-6 text-muted">{children}</p>;
}

export function SearchBox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput type="search" {...props} />;
}
