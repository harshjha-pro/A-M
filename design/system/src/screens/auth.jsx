// 2 · Authentication: /login, /set-password, /setup, /install
import React from 'react';
import { PhoneFrame, DesktopFrame, Button, TextField, Banner, Icon, Photo, Monogram, Segmented, Card, Checkbox, Toast } from '../components.jsx';
import { useGo } from '../core.jsx';

export function Floral({ corner = 'tl', size = 120 }) {
  const pos = { tl: { top: 40, left: -18 }, tr: { top: 40, right: -18, transform: 'scaleX(-1)' }, bl: { bottom: -10, left: -14, transform: 'scaleY(-1)' }, br: { bottom: -10, right: -14, transform: 'scale(-1,-1)' } }[corner];
  return (
    <svg className="am-floral" style={pos} width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M8 112 C 30 80, 50 60, 96 18" />
      <path d="M34 78 c -10 -6 -16 -16 -14 -26 c 10 2 16 12 14 26 z" />
      <path d="M52 58 c 2 -12 10 -20 20 -20 c 0 10 -8 18 -20 20 z" />
      <path d="M66 44 c -10 -4 -14 -14 -12 -22 c 8 2 14 10 12 22 z" />
      <circle cx="96" cy="18" r="6" /><circle cx="96" cy="18" r="2" />
      <circle cx="24" cy="96" r="3" />
    </svg>
  );
}

function LoginBody({ error, busy }) {
  return (
    <div className="am-col" style={{ minHeight: '100%', position: 'relative' }}>
      <Photo name="hero" ratio="auto" radius="none" overlay="scrim" style={{ height: 250, margin: '-50px 0 0' }}>
        <div style={{ marginTop: 'auto', padding: '0 20px 22px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <Monogram size={58} light />
          <div style={{ color: '#fff' }}>
            <div className="am-display" style={{ fontSize: 30, lineHeight: 1.05 }}>Ayush &amp; Mahi</div>
            <div style={{ fontSize: 15, fontWeight: 700, opacity: 0.95 }}>Bhilwara · 14–16 Feb 2027</div>
          </div>
        </div>
      </Photo>
      <div className="am-col" style={{ position: 'relative', padding: '24px 20px 32px', gap: 18, flex: 1 }}>
        <Floral corner="br" size={110} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Log in</h1>
          <p className="am-muted" style={{ fontSize: 16, marginTop: 4 }}>Welcome to the family planner.</p>
        </div>
        {error === 'wrong' && <Banner tone="error" title="Phone or password is wrong.">Try again, or ask Ayush or Mahi.</Banner>}
        {error === 'offline' && <Banner tone="offline" title="No internet.">Connect to log in.</Banner>}
        {error === 'locked' && <Banner tone="warning" title="Too many tries.">Wait 15 minutes or ask Ayush or Mahi.</Banner>}
        <TextField label="Phone number" value={error === 'empty' ? '' : '98290 12345'} icon="Phone" inputMode="tel" help="The number Ayush or Mahi added for you." error={error === 'empty' ? 'Enter your phone number and password.' : undefined} />
        <TextField label="Password" type="password" value={error === 'empty' ? '' : 'mahi2027'} icon="LockKeyhole" error={error === 'wrong' ? ' ' : undefined}
          suffix={<button type="button" className="am-input__eye" aria-label="Show password"><Icon name="Eye" size={18} /> Show</button>} />
        <Button block size="lg" busy={busy} to="home">{busy ? 'Logging in…' : 'Log in'}</Button>
        <p className="am-muted" style={{ textAlign: 'center', fontSize: 15, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="KeyRound" size={16} /> Forgot? Ask Ayush or Mahi for a new link.
        </p>
      </div>
    </div>
  );
}

export function Login({ error, busy }) {
  return <PhoneFrame darkStatus label={error ? `Login · ${error}` : busy ? 'Login · logging in' : 'Login'}><LoginBody error={error} busy={busy} /></PhoneFrame>;
}

export function LoginDesktop() {
  return (
    <figure className="am-frame am-frame--desk">
      <div className="am-desk" style={{ position: 'relative' }}>
        <Photo name="hero" ratio="auto" radius="none" overlay="scrim" style={{ width: 640, height: '100%' }}>
          <div style={{ marginTop: 'auto', padding: 48, color: '#fff' }}>
            <Monogram size={72} light />
            <div className="am-display" style={{ fontSize: 52, lineHeight: 1, marginTop: 20 }}>Every Detail,<br />A Beautiful Tomorrow</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>Ayush &amp; Mahi · Bhilwara · 14–16 Feb 2027</div>
          </div>
        </Photo>
        <div className="am-col" style={{ flex: 1, justifyContent: 'center', padding: '0 96px', gap: 20, position: 'relative' }}>
          <Floral corner="tr" size={150} /><Floral corner="bl" size={130} />
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>Log in</h1>
          <TextField label="Phone number" value="98290 12345" icon="Phone" help="The number Ayush or Mahi added for you." />
          <TextField label="Password" type="password" value="mahi2027" icon="LockKeyhole" suffix={<button type="button" className="am-input__eye"><Icon name="Eye" size={18} /> Show</button>} />
          <Button block size="lg">Log in</Button>
          <p className="am-muted" style={{ textAlign: 'center' }}>Forgot? Ask Ayush or Mahi for a new link.</p>
        </div>
      </div>
      <figcaption className="am-frame__label">Login · desktop</figcaption>
    </figure>
  );
}

export function SetPassword({ state = 'form' }) {
  return (
    <PhoneFrame label={`Set password · ${state}`}>
      <div className="am-col" style={{ padding: '28px 20px', gap: 18, position: 'relative', minHeight: '100%' }}>
        <Floral corner="tr" size={100} />
        <Monogram size={56} />
        {state === 'checking' && <><h1 style={{ fontSize: 26, fontWeight: 700 }}>Choose your password</h1><Banner tone="info" icon="LoaderCircle">Checking your link…</Banner></>}
        {state === 'expired' && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>This link can’t be used</h1>
            <Banner tone="error" title="This link has expired or was already used.">Ask Ayush or Mahi for a new one. Each invitation link works once.</Banner>
            <Button variant="outline" icon="MessageCircle" block>Message Ayush on WhatsApp</Button>
            <Button variant="ghost" block to="login">Go to Log in</Button>
          </>
        )}
        {(state === 'form' || state === 'error') && (
          <>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>Welcome, Riya.</h1>
              <p className="am-muted" style={{ marginTop: 4 }}>Choose a password for phone 98•••• •7120.</p>
            </div>
            <Banner tone="info" icon="Link">This is your one-time invitation link. After you save, log in with your phone and this password.</Banner>
            <TextField label="New password" type="password" value={state === 'error' ? '98290' : 'mehndi-14'} icon="LockKeyhole"
              help="At least 6 letters or numbers. Not your phone number." error={state === 'error' ? "That's part of your phone number. Choose something else." : undefined}
              suffix={<button type="button" className="am-input__eye"><Icon name="Eye" size={18} /> Show</button>} />
            <ul className="am-col" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none', fontSize: 15 }}>
              <li className="am-meta" style={{ color: 'var(--success)' }}><Icon name="CircleCheck" size={18} /> 6 or more characters</li>
              <li className="am-meta" style={{ color: state === 'error' ? 'var(--danger)' : 'var(--success)' }}><Icon name={state === 'error' ? 'CircleX' : 'CircleCheck'} size={18} /> Not your phone number</li>
            </ul>
            <div style={{ marginTop: 'auto' }}><Button block size="lg">Save password</Button></div>
          </>
        )}
        {state === 'success' && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Password saved</h1>
            <Toast tone="success">Your password is set. You’re logged in on this phone.</Toast>
            <Button block size="lg" iconRight="ArrowRight" to="home">Open the planner</Button>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

export function Setup({ step = 2 }) {
  const steps = ['Setup code', 'Your account', 'Wedding'];
  return (
    <PhoneFrame label={`First setup · step ${step} of 3`}>
      <div className="am-col" style={{ padding: '24px 20px 140px', gap: 18 }}>
        <div className="am-row-flex" style={{ gap: 12 }}><Monogram size={48} /><div><div className="am-strong" style={{ fontSize: 20 }}>First setup</div><div className="am-muted am-small">Creates the Owner account. Takes about 2 minutes.</div></div></div>
        <div className="am-steps" aria-label={`Step ${step} of 3`}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <span className={`am-step-num ${i + 1 < step ? 'is-done' : ''}`}>{i + 1 < step ? <Icon name="Check" size={16} stroke={3} /> : i + 1}</span>
              {i < 2 && <span className={`am-steps__bar ${i + 1 < step ? 'is-done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="am-small am-strong am-muted">Step {step} of 3 · {steps[step - 1]}</div>
        {step === 1 && <TextField label="Setup code" value="" placeholder="From the server file" help="Find it in the setup file on the server. Ask whoever installed the app." icon="KeyRound" />}
        {step === 2 && (
          <>
            <TextField label="Your name" value="Ayush Porwal" />
            <TextField label="Phone number" value="98290 12345" icon="Phone" help="You’ll log in with this number." />
            <TextField label="Password" type="password" value="••••••••" help="At least 6 letters or numbers. Not your phone number." />
          </>
        )}
        {step === 3 && (
          <>
            <TextField label="Couple names" value="Ayush & Mahi" />
            <TextField label="Wedding dates" value="14–16 Feb 2027" icon="CalendarDays" />
            <TextField label="City" value="Bhilwara" />
          </>
        )}
      </div>
      <div className="am-sticky" style={{ position: 'absolute' }}>
        <div className="am-sticky__row"><Button variant="outline">Back</Button><Button iconRight="ArrowRight">{step === 3 ? 'Finish setup' : 'Next'}</Button></div>
      </div>
    </PhoneFrame>
  );
}

export function Install({ os = 'Android' }) {
  const steps = os === 'Android'
    ? [['Open in Chrome', 'Open am-wedding on this phone in Chrome.', 'Chrome'], ['Tap the ⋮ menu', 'Top-right corner of Chrome.', 'EllipsisVertical'], ['Tap “Install app”', 'Or “Add to Home screen”.', 'Download'], ['Open from your Home screen', 'Look for the A&M icon.', 'Smartphone']]
    : [['Open in Safari', 'It must be Safari for this to work.', 'Compass'], ['Tap Share', 'The square with an arrow, at the bottom.', 'Share'], ['Tap “Add to Home Screen”', 'Scroll down the list to find it.', 'SquarePlus'], ['Tap Add', 'Then open A&M from your Home Screen.', 'Smartphone']];
  return (
    <PhoneFrame label={`Install guide · ${os}`}>
      <div className="am-col" style={{ gap: 16, paddingBottom: 24 }}>
        <div className="am-top"><button className="am-iconbtn" aria-label="Back"><Icon name="ChevronLeft" /></button><div className="am-top__titles"><h1 className="am-top__title">Install Guide</h1></div></div>
        <div className="am-pad am-col" style={{ gap: 16 }}>
          <p className="am-muted">Put A&amp;M on your Home screen. It opens faster and works without internet.</p>
          <Segmented options={['Android', 'iPhone']} value={os} label="Phone type" />
          <ol className="am-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
            {steps.map(([t, d, ic], i) => (
              <li key={t} className="am-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <span className="am-step-num" aria-hidden="true">{i + 1}</span>
                <div style={{ flex: 1 }}><div className="am-strong">{t}</div><div className="am-muted am-small">{d}</div></div>
                <span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span>
              </li>
            ))}
          </ol>
          <Banner tone="success" title="Already installed?">You’re using the app from your Home screen.</Banner>
          <Button block icon="ExternalLink">Open app</Button>
          <Button block variant="ghost" icon="ChevronLeft">Back to More</Button>
        </div>
      </div>
    </PhoneFrame>
  );
}
