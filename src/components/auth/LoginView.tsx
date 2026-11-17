import React, { useState } from 'react';
import { Mail, Key, ArrowRight, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, resetPassword } = useApp();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao entrar com Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Informe seu e-mail.');
      return;
    }

    if (mode === 'login') {
      try {
        setLoading(true);
        await loginWithEmail(cleanEmail, password);
      } catch (err: any) {
        const msg = err?.message || 'Falha na autenticação.';
        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        await resetPassword(cleanEmail);
        setSuccessMessage('Link de redefinição enviado para o seu e-mail pelo Firebase!');
        setMode('login');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Erro ao enviar e-mail de redefinição.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 text-neutral-100 shadow-2xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-lg tracking-wider border border-amber-500/30 mb-3 shadow-inner">
            PTB
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">PT-B Mídia</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Central de Arquivos e Mídias</p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center">
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Google Login */}
        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-semibold rounded-xl text-xs flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {googleLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-700" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
              )}
              <span>Entrar com Google</span>
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-neutral-900 px-2.5 text-neutral-500">ou com e-mail</span>
              </div>
            </div>
          </>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@igreja.com"
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {mode === 'login' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-neutral-300 font-medium">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('reset');
                  }}
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Informe o e-mail cadastrado da sua conta para receber o link de redefinição de senha do Firebase.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Entrar com E-mail' : 'Enviar Link de Redefinição'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'reset' && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setErrorMessage(null);
                setMode('login');
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline cursor-pointer"
            >
              Voltar ao login
            </button>
          </div>
        )}

        {/* Public Church Page Access Link */}
        <div className="mt-6 pt-4 border-t border-neutral-800 text-center">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#igreja';
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>⛪ Visitar Site Público da Igreja</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <p className="text-[10px] text-neutral-500 mt-1.5">
            Acesso livre para visitantes e membros (sem necessidade de login)
          </p>
        </div>
      </div>
    </div>
  );
};
