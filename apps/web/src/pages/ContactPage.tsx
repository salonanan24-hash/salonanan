import { Instagram, MapPin, Phone, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { storeInstagramUrl, storeMapUrl, storePhones } from '@/data/store-contact';
import { apiBase } from '@/lib/api-url';
import { usePageTitle } from '@/hooks/use-page-title';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { Container } from '@/components/ui/Container';
import { useI18n } from '@/i18n';

const fieldClass =
  'w-full rounded-md border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand-blue';

export function ContactPage() {
  const { locale, messages } = useI18n();
  const copy = messages.contactPage;
  usePageTitle(copy.title);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
      locale,
      website,
    };
    if (payload.name.length < 2 || !payload.email.includes('@') || payload.phone.replace(/\D/g, '').length < 7 || payload.message.length < 2) {
      setNotice({ tone: 'err', text: copy.missing });
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase()}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('failed');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setNotice({ tone: 'ok', text: copy.sent });
    } catch {
      setNotice({ tone: 'err', text: copy.failed });
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: messages.common.home, to: '/' }, { label: copy.title }]} />
      <h1 className="mt-6 text-3xl font-extrabold text-ink">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.intro}</p>

      <div className="mt-8 grid items-start gap-6 lg:max-w-3xl lg:grid-cols-[minmax(0,1fr)_16.5rem] xl:max-w-4xl">
        <form onSubmit={submit} noValidate className="relative rounded-2xl border border-line bg-white p-5 lg:p-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-ink">{copy.name}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className={`${fieldClass} h-12 lg:h-10`}
            />
          </label>
          <label className="mt-4 block text-sm lg:mt-3">
            <span className="mb-1.5 block font-bold text-ink">{copy.email}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              dir="ltr"
              className={`${fieldClass} h-12 text-end lg:h-10`}
            />
          </label>
          <label className="mt-4 block text-sm lg:mt-3">
            <span className="mb-1.5 block font-bold text-ink">{copy.phone}</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              dir="ltr"
              className={`${fieldClass} h-12 text-end lg:h-10`}
            />
          </label>
          <label className="mt-4 block text-sm lg:mt-3">
            <span className="mb-1.5 block font-bold text-ink">{copy.message}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className={`${fieldClass} min-h-36 py-3 lg:min-h-24 lg:py-2`}
            />
          </label>
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0"
          />
          {notice ? (
            <p className={`mt-4 text-sm font-semibold ${notice.tone === 'ok' ? 'text-brand-blue' : 'text-brand-red'}`} role="status">
              {notice.text}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-lg bg-brand-blue px-6 text-sm font-bold text-white transition hover:bg-brand-blue-dark hover:shadow-[0_10px_20px_rgb(12_86_149/0.28)] disabled:opacity-60 lg:mt-4 lg:h-10"
          >
            {pending ? copy.sending : copy.submit}
          </button>
        </form>

        <aside className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="h-1 bg-brand-red" />
          <div className="space-y-5 p-5">
            <Detail icon={MapPin} label={copy.addressLabel}>
              <a href={storeMapUrl} target="_blank" rel="noreferrer" className="font-bold text-brand-blue hover:underline">
                {copy.address}
              </a>
            </Detail>
            <Detail icon={Phone} label={copy.phoneLabel}>
              <ul className="space-y-1">
                {storePhones.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} dir="ltr" className="font-bold text-brand-blue hover:underline">
                      {item.display}
                    </a>
                  </li>
                ))}
              </ul>
            </Detail>
            <Detail icon={Instagram} label={copy.follow}>
              <a
                href={storeInstagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-blue px-4 text-sm font-bold text-brand-blue transition hover:bg-brand-blue hover:text-white"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                {copy.instagram}
              </a>
            </Detail>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f4f7fb] text-brand-blue">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-xs font-bold text-muted">{label}</p>
        <div className="mt-1 text-sm">{children}</div>
      </div>
    </div>
  );
}
