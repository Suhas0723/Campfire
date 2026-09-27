import { useEffect, useState } from 'react';
import { listBookings } from '../auth/authApi.js';
import { FlameLogo, TicketIcon } from '../ui/icons.jsx';

const STATUS = {
  suggested: { label: 'Nearby', tone: 'go' },
  proposed: { label: 'Waiting in the chat', tone: 'wait' },
  approved: { label: 'Approved', tone: 'go' },
  booked: { label: 'Booking', tone: 'go' },
  paid: { label: 'Paid', tone: 'go' },
  confirmed: { label: 'Booked', tone: 'done' },
  declined: { label: 'Passed', tone: 'no' },
};

const SLOT = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

function money(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return 'Free';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

function replyBy(iso) {
  if (!iso) return 'Reply approve in the chat';
  const when = new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return `Reply approve in the chat by ${when}`;
}

function Wallet({ payment }) {
  if (!payment?.enrolled) {
    return (
      <article className="plan-wallet">
        <div>
          <span className="eyebrow">No card yet</span>
          <strong className="plan-wallet-title">Enroll a card to pay for plans</strong>
        </div>
      </article>
    );
  }
  const expiry = payment.expiration_month && payment.expiration_year ? `${payment.expiration_month}/${payment.expiration_year}` : '';
  const last4 = payment.suffix ? `···· ${payment.suffix}` : 'enrolled';
  return (
    <article className="plan-wallet">
      <div>
        <span className="eyebrow">{payment.provider_label}</span>
        <strong className="plan-wallet-title">
          {payment.brand} {last4}
        </strong>
        <span className="plan-wallet-meta">
          {payment.holder}
          {expiry && ` · exp ${expiry}`}
        </span>
      </div>
      <div className="plan-wallet-side">
        <span className="plan-chip">{payment.mode === 'live' ? 'Live' : 'Demo'}</span>
        <span className="plan-wallet-limit">Up to {money(payment.spend_limit, payment.currency)}</span>
      </div>
    </article>
  );
}

function PlanRow({ booking }) {
  const status = STATUS[booking.status] || { label: booking.status, tone: 'wait' };
  const quiet = booking.status === 'declined';
  const nearby = booking.status === 'suggested';
  return (
    <li className={`plan-row${quiet ? ' is-quiet' : ''}`}>
      <div className="plan-row-main">
        <span className="eyebrow">
          {SLOT[booking.time_slot] || booking.time_slot}
          {booking.start_time && ` · ${booking.start_time}`}
          {booking.is_primary && booking.status === 'proposed' && ' · First choice'}
        </span>
        <strong>{booking.name}</strong>
        {nearby && booking.url && (
          <a className="plan-link" href={booking.url} target="_blank" rel="noopener noreferrer">
            {booking.link_label || 'Sign up'}
          </a>
        )}
        {booking.status === 'proposed' && <p className="plan-note">{replyBy(booking.approval_deadline)}</p>}
        {booking.confirmation_ref && (
          <p className="plan-note">
            Confirmation {booking.confirmation_ref}
            {booking.approved_by && ` · paid with ${booking.approved_by}'s card`}
          </p>
        )}
        {booking.note && <p className="plan-note">{booking.note}</p>}
        {booking.steps?.length > 0 && (
          <ol className="plan-steps">
            {booking.steps.map((step) => (
              <li key={step.label} className={step.done ? 'is-done' : ''}>
                {step.label}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="plan-row-side">
        <span className="plan-price">
          {nearby && !booking.price_estimated ? 'Price varies' : nearby ? `est. ${money(booking.price, booking.currency)}` : money(booking.price, booking.currency)}
        </span>
        <span className={`plan-status is-${status.tone}`}>{status.label}</span>
      </div>
    </li>
  );
}

export default function Plans() {
  const [state, setState] = useState({ status: 'loading', payment: null, trips: [] });

  useEffect(() => {
    let cancel = false;
    listBookings()
      .then((data) => {
        if (!cancel) setState({ status: 'ready', payment: data.payment, trips: data.trips || [] });
      })
      .catch(() => {
        if (!cancel) setState({ status: 'error', payment: null, trips: [] });
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="state-msg">
        <FlameLogo size={40} />
        <strong>Looking up the plans…</strong>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="state-msg">
        <FlameLogo size={40} />
        <strong>We couldn't load the plans.</strong>
        <p>Check your connection and open this window again.</p>
      </div>
    );
  }

  return (
    <div className="plans">
      <div className="window-intro">
        <TicketIcon size={48} />
        <p>Nearby plans for the trip.</p>
      </div>
      {state.payment?.enrolled && <Wallet payment={state.payment} />}
      {state.trips.length === 0 ? (
        <div className="state-msg plans-empty">
          <strong>No plans yet.</strong>
          <p>When Campfire suggests tomorrow in the chat, the choices show up here.</p>
        </div>
      ) : (
        state.trips.map((trip) => (
          <section key={trip.id} className="plan-trip">
            <h2>{trip.title}</h2>
            {trip.location_name && <p className="plan-place">{trip.location_name}</p>}
            <ul className="plan-list">
              {trip.bookings.map((booking) => (
                <PlanRow key={booking.id} booking={booking} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
