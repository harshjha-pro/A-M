// Catches a crashed screen, shows a calm message and reports it to /client-log.
import { Component } from 'react';
import { reportProblem } from '../api/client.js';
import { t } from '../i18n/strings.en.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    reportProblem({ code: 'render_error', message: error?.message, stack: error?.stack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-safe">
        <h1 className="text-xl font-bold">{t('errors.crashTitle')}</h1>
        <p>{t('errors.crashBody')}</p>
        <button type="button" className="tap rounded-md bg-primary px-5 font-bold text-on-primary" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </button>
      </main>
    );
  }
}
