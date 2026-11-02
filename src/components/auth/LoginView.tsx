import React, { useState } from 'react';
import { Mail, Key, ArrowRight, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const LoginView: React.FC = () => {
  const { loginWithEmail, resetPassword } = useApp();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      if (!password) {
        setErrorMessage('Informe sua senha.');
        return;
      }

      try {
        setLoading(true);
        await loginWithEmail(cleanEmail, password);
      } catch (err: any) {
        let msg = err.message || 'Falha na autenticação.';
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
        setErrorMessage(err.message || 'Erro ao enviar e-mail de recuperação.');
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
            <span>{errorMessage}</span>
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
                  required
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
            disabled={loading}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Entrar' : 'Enviar Link de Recuperação'}</span>
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
