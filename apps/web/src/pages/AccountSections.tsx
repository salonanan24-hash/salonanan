import { Link } from 'react-router-dom';
import { fill, useI18n } from '@/i18n';
import { useAuth } from '@/auth/auth-context';
import { usePageTitle } from '@/hooks/use-page-title';

function displayName(metadata: Record<string, unknown> | undefined): string {
  const full = metadata?.full_name;
  if (typeof full === 'string' && full.trim()) return full.trim();
  const first = typeof metadata?.first_name === 'string' ? metadata.first_name : '';
  const last = typeof metadata?.last_name === 'string' ? metadata.last_name : '';
  return `${first} ${last}`.trim();
}

export function AccountDashboardPage() {
  const { messages } = useI18n();
  const auth = useAuth();
  const copy = messages.account;
  usePageTitle(copy.dashboard);
  const name = displayName(auth.user?.user_metadata);

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-ink">{copy.dashboard}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {name ? fill(copy.greeting, { name }) : copy.dashboardBody}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">{copy.dashboardBody}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link to="/account" className="rounded-2xl border border-line bg-white px-5 py-6 font-bold text-ink hover:border-ink">
          {copy.details}
        </Link>
        <Link to="/account/orders" className="rounded-2xl border border-line bg-white px-5 py-6 font-bold text-ink hover:border-ink">
          {copy.orders}
        </Link>
      </div>
    </div>
  );
}

export function AccountReviewsPage() {
  const { messages } = useI18n();
  usePageTitle(messages.account.reviews);
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-ink">{messages.account.reviews}</h1>
      <p className="mt-6 text-sm text-muted">{messages.account.reviewsEmpty}</p>
    </div>
  );
}
