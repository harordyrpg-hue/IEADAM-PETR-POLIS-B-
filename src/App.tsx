/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, Suspense, lazy, useEffect, useState } from 'react';

const PublicBaptismPage = lazy(() =>
  import('./components/public/PublicBaptismPage.js').then((m) => ({
    default: m.PublicBaptismPage,
  }))
);

const PublicChurchPage = lazy(() =>
  import('./components/public/PublicChurchPage.js').then((m) => ({
    default: m.PublicChurchPage,
  }))
);

const PublicEventRegistrationPage = lazy(() =>
  import('./components/public/PublicEventRegistrationPage.js').then((m) => ({
    default: m.PublicEventRegistrationPage,
  }))
);

const AuthenticatedShell = lazy(() => import('./components/layout/AuthenticatedShell.js'));

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-screen min-h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100">
    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-lg flex items-center justify-center border border-amber-500/30 animate-pulse mb-3">
      PTB
    </div>
    <p className="text-xs font-semibold text-neutral-300">Carregando...</p>
    <p className="text-[11px] text-neutral-500 mt-1">IEADAM Petrópolis B · PT-B Mídia</p>
  </div>
);

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[PT-B Mídia AppErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-[100dvh] bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 font-bold text-base flex items-center justify-center mx-auto border border-amber-500/30">
              PTB
            </div>
            <h1 className="text-lg font-bold text-neutral-100">
              Não foi possível carregar esta página
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Caso esteja abrindo pelo WhatsApp no iPhone, toque para recarregar ou abra o link no Safari.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs cursor-pointer"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const checkIsBaptismRoute = () => {
  if (typeof window === 'undefined') return false;
  try {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);

    if (path === '/batismo' || path.startsWith('/batismo')) {
      return true;
    }
    if (hash === '#batismo' || hash.startsWith('#batismo')) {
      return true;
    }
    if (
      searchParams.has('batismo') ||
      searchParams.get('tab') === 'batismo' ||
      searchParams.get('view') === 'batismo' ||
      searchParams.get('page') === 'batismo'
    ) {
      return true;
    }
  } catch {}

  return false;
};

const checkIsChurchRoute = () => {
  if (typeof window === 'undefined') return false;
  try {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);

    if (path === '/igreja' || path.startsWith('/igreja') || path === '/site' || path.startsWith('/site')) {
      return true;
    }

    if (
      hash === '#igreja' ||
      hash.startsWith('#igreja') ||
      hash === '#site' ||
      hash.startsWith('#site') ||
      hash === '#portal' ||
      hash === '#publico'
    ) {
      return true;
    }

    if (
      searchParams.has('site') ||
      searchParams.has('igreja') ||
      searchParams.has('portal') ||
      searchParams.has('publico') ||
      searchParams.get('tab') === 'igreja' ||
      searchParams.get('view') === 'igreja' ||
      searchParams.get('view') === 'church' ||
      searchParams.get('page') === 'church'
    ) {
      return true;
    }
  } catch {}

  return false;
};

const getPublicEventRouteId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryInscricao = searchParams.get('inscricao') || searchParams.get('evento');
    if (queryInscricao) return queryInscricao;

    const hash = window.location.hash;
    if (hash.startsWith('#inscricao=') || hash.startsWith('#evento=')) {
      return hash.replace(/#(inscricao|evento)=/, '');
    }
  } catch {}
  return null;
};

export default function App() {
  const [isBaptismPage, setIsBaptismPage] = useState(checkIsBaptismRoute);
  const [isChurchPage, setIsChurchPage] = useState(checkIsChurchRoute);
  const [publicEventId, setPublicEventId] = useState<string | null>(getPublicEventRouteId);

  useEffect(() => {
    const handleRouteCheck = () => {
      setIsBaptismPage(checkIsBaptismRoute());
      setIsChurchPage(checkIsChurchRoute());
      setPublicEventId(getPublicEventRouteId());
    };

    window.addEventListener('popstate', handleRouteCheck);
    window.addEventListener('hashchange', handleRouteCheck);
    return () => {
      window.removeEventListener('popstate', handleRouteCheck);
      window.removeEventListener('hashchange', handleRouteCheck);
    };
  }, []);

  return (
    <AppErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>
        {isBaptismPage ? (
          <PublicBaptismPage />
        ) : isChurchPage ? (
          <PublicChurchPage />
        ) : publicEventId ? (
          <PublicEventRegistrationPage
            eventId={publicEventId}
            onExit={() => {
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete('inscricao');
                url.searchParams.delete('evento');
                url.hash = '';
                window.history.replaceState({}, '', url.pathname);
              } catch {}
              setPublicEventId(null);
            }}
          />
        ) : (
          <AuthenticatedShell />
        )}
      </Suspense>
    </AppErrorBoundary>
  );
}
