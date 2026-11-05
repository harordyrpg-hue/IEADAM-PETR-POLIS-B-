import React, { useState } from 'react';
import { Mail, Key, ArrowRight, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const LoginView: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, resetPassword } = useApp();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setErrorMessage(null);
      setGoogleLoading(true);
      await loginWithGoogle(email.trim());
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      setErrorMessage(err?.message || 'Falha ao autenticar com o Google.');
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
        let msg = err?.message || 'Falha na autenticação.';
        if (
          msg.includes('auth/invalid-credential') ||
          msg.includes('auth/user-not-found') ||
          msg.includes('auth/wrong-password') ||
          msg.includes('incorretos')
        ) {
          msg = 'E-mail ou senha incorretos.';
        } else if (msg.includes('auth/too-many-requests')) {
          msg = 'Muitas tentativas com falha. Aguarde alguns minutos.';
        } else if (msg.includes('auth/invalid-email')) {
          msg = 'Formato de e-mail inválido.';
        }
        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        await resetPassword(cleanEmail);
        setSuccessMessage('E-mail de recuperação enviado com sucesso.');
        setMode('login');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Erro ao enviar e-mail de recuperação.');
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

          {mode === 'login' && (
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
                <span>{mode === 'login' ? 'Entrar com E-mail' : 'Enviar Link de Recuperação'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-neutral-800"></div>
              <span className="px-3 text-[11px] text-neutral-500 font-medium">ou</span>
              <div className="flex-1 border-t border-neutral-800"></div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {googleLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuar com o Google</span>
                </>
              )}
            </button>
          </>
        )}

        {mode === 'reset' && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setErrorMessage(null);
                setMode('login');
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline"
            >
              Voltar ao login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
