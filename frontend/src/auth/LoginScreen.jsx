import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { FlameLogo } from '../ui/icons.jsx';
import { useAuth } from './AuthProvider.jsx';
import AuthLoading from './AuthLoading.jsx';
import { requestCode, verifyCode } from './authApi.js';
import { maskPhone, safeNext } from './authUtils.js';

const COUNTRIES = [
  { dial: '+1', name: 'United States or Canada' },
  { dial: '+44', name: 'United Kingdom' },
  { dial: '+91', name: 'India' },
  { dial: '+81', name: 'Japan' },
  { dial: '+61', name: 'Australia' },
  { dial: '+49', name: 'Germany' },
];

const RESEND_SECONDS = 30;
const LEAVE_MS = 900;

const MESSAGES = {
  invalid_phone: "That number doesn't look quite right. Check it and try again.",
  rate_limited: "You've asked for a few codes already. Give it a few minutes, then try again.",
  wait: 'Hang on a moment before asking for another code.',
  incomplete: 'Enter all six digits from the message.',
  wrong: "That code doesn't match. Check the message and try again.",
  expired: 'That code has expired. Use “Resend code” to get a fresh one.',
  too_many: "That's too many tries for this code. Ask for a new one and try again.",
  network: "We couldn't reach Campfire. Check your connection and try again.",
};

const messageFor = (code) => MESSAGES[code] || 'Something went wrong on our side. Please try again.';

function ErrorNote({ code }) {
  if (!code) return null;
  return (
    <p className="login-error" role="alert">
      {messageFor(code)}
    </p>
  );
}

function PhoneStep({ dial, setDial, digits, setDigits, busy, error, onSubmit }) {
  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <label className="login-label" htmlFor="login-phone">
        Your phone number
      </label>
      <div className="login-phone">
        <label className="visually-hidden" htmlFor="login-country">
          Country code
        </label>
        <select id="login-country" value={dial} onChange={(e) => setDial(e.target.value)}>
          {COUNTRIES.map((cc) => (
            <option key={cc.dial} value={cc.dial} aria-label={`${cc.name} ${cc.dial}`}>
              {cc.dial}
            </option>
          ))}
        </select>
        <input
          id="login-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="555 010 0001"
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/[^\d\s()-]/g, ''))}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby="login-phone-note"
          autoFocus
        />
      </div>
      <ErrorNote code={error} />
      <button className="btn-primary lg login-submit" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send me a code'}
      </button>
      <p className="login-note" id="login-phone-note">
        We'll message you on WhatsApp from Campfire.
      </p>
    </form>
  );
}

function CodeBoxes({ value, onChange, invalid }) {
  const refs = useRef([]);
  const focus = (i) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const fill = (start, text) => {
    const incoming = text.replace(/\D/g, '').slice(0, 6 - start);
    if (!incoming) return;
    const next = [...value];
    incoming.split('').forEach((d, k) => {
      next[start + k] = d;
    });
    onChange(next);
    focus(start + incoming.length);
  };

  return (
    <fieldset className="code-boxes">
      <legend className="login-label">Your 6-digit code</legend>
      <div className="code-boxes-row">
        {value.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? 6 : 1}
            aria-label={`Digit ${i + 1} of 6`}
            aria-invalid={invalid || undefined}
            value={d}
            autoFocus={i === 0}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              if (raw.length > 1) return fill(i, raw);
              const next = [...value];
              next[i] = raw;
              onChange(next);
              if (raw) focus(i + 1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !value[i] && i > 0) {
                e.preventDefault();
                const next = [...value];
                next[i - 1] = '';
                onChange(next);
                focus(i - 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                focus(i - 1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                focus(i + 1);
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData('text'));
            }}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </fieldset>
  );
}

function CodeStep({ masked, demo, busy, error, resendIn, onSubmit, onResend, onChangeNumber }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [localError, setLocalError] = useState(null);
  const shown = localError || error;

  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        const joined = code.join('');
        if (joined.length < 6) return setLocalError('incomplete');
        setLocalError(null);
        onSubmit(joined);
      }}
      noValidate
    >
      <p className="login-sent">
        Check WhatsApp. We sent a code to <strong>{masked}</strong>.
      </p>
      {demo && <p className="sample-chip login-demo">Demo mode: use 000000</p>}
      <CodeBoxes
        value={code}
        onChange={(next) => {
          setCode(next);
          setLocalError(null);
        }}
        invalid={Boolean(shown)}
      />
      <ErrorNote code={shown} />
      <button className="btn-primary lg login-submit" type="submit" disabled={busy}>
        {busy ? 'Checking…' : 'Sit down by the fire'}
      </button>
      <div className="login-links">
        <button type="button" className="login-link" onClick={onChangeNumber}>
          Use a different number
        </button>
        <button type="button" className="login-link" onClick={onResend} disabled={resendIn > 0 || busy} aria-live="polite">
          {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, '0')}` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

export default function LoginScreen() {
  const { status, signIn, flare } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [step, setStep] = useState('phone');
  const [dial, setDial] = useState('+1');
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [demo, setDemo] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const [codeKey, setCodeKey] = useState(0);

  const phone = `${dial}${digits.replace(/\D/g, '')}`;
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step, resendIn]);

  if (status === 'loading') return <AuthLoading />;
  if (status === 'signed-in' && !leaving) return <Navigate to={next} replace />;

  const sendCode = async () => {
    if (digits.replace(/\D/g, '').length < 6) return setError('invalid_phone');
    setBusy(true);
    setError(null);
    try {
      const res = await requestCode(phone);
      setDemo(Boolean(res.demo));
      setResendAt(Date.now() + (res.resend_after ?? RESEND_SECONDS) * 1000);
      setNow(Date.now());
      setCodeKey((k) => k + 1);
      setStep('code');
    } catch (err) {
      setError(err.code);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code) => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await verifyCode(phone, code);
      setLeaving(true);
      flare();
      window.setTimeout(() => {
        signIn(user);
        navigate(next, { replace: true });
      }, LEAVE_MS);
    } catch (err) {
      setError(err.code);
      setBusy(false);
    }
  };

  return (
    <div className="login-stage">
      <section className={`window login-window${leaving ? ' is-leaving' : ''}`} aria-labelledby="login-title">
        <header className="window-titlebar login-titlebar">
          <span className="window-title">Sign in</span>
        </header>
        <div className="window-body login-body">
          <div className="login-brand">
            <FlameLogo size={64} />
            <h1 id="login-title">Campfire</h1>
          </div>
          <p className="login-tagline">Every trip, told around the fire.</p>

          {step === 'phone' ? (
            <PhoneStep dial={dial} setDial={setDial} digits={digits} setDigits={setDigits} busy={busy} error={error} onSubmit={sendCode} />
          ) : (
            <CodeStep
              key={codeKey}
              masked={maskPhone(dial, digits.replace(/\D/g, ''))}
              demo={demo}
              busy={busy || leaving}
              error={error}
              resendIn={resendIn}
              onSubmit={verify}
              onResend={sendCode}
              onChangeNumber={() => {
                setStep('phone');
                setError(null);
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
