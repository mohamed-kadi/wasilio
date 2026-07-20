import { useState, type SyntheticEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck, Store } from 'lucide-react';
import { getErrorMessage, login } from '../api/client';
import { useAuthStore } from '../store/authStore';
import BrandLogo from '../components/BrandLogo';

interface LocationState {
  from?: {
    pathname?: string;
  };
  message?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const setToken = useAuthStore((state) => state.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to="/app" replace />;
  }

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/app';
  const message = (location.state as LocationState | null)?.message;

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login(email, password);
      setToken(response.token);
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <section className="flex flex-col justify-center">
          <BrandLogo className="flex" markClassName="h-11 w-11" textClassName="text-3xl" />
          <h1 className="mt-10 text-2xl font-semibold text-gray-900">Merchant operations workspace</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
            Sign in to manage confirmations, courier operations, recovery, storefront publishing, and merchant setup.
          </p>
          <div className="mt-6 grid gap-3">
            <AuthCue icon={<Store size={16} />} title="Store workspace" detail="Your products, orders, and storefront setup stay together." />
            <AuthCue icon={<ShieldCheck size={16} />} title="Operations access" detail="Use your owner or team login." />
          </div>
        </section>

        <section className="flex flex-col justify-center space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
            <p className="mt-2 text-sm text-gray-600">Enter your merchant account credentials.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-[23rem] flex-col justify-center space-y-5 rounded-lg border border-gray-200 bg-white p-7 shadow-sm sm:p-8">
          {message && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:underline">
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? 'Signing in' : 'Sign in'}
          </button>

          <p className="border-t border-gray-100 pt-4 text-center text-xs leading-5 text-gray-500">
            By signing in, you agree to the{' '}
            <Link to="/terms" className="font-medium text-blue-600 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          </form>

          <p className="text-center text-sm text-gray-600">
            Approved merchant?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:underline">
              Create workspace
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function AuthCue({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-sm leading-5 text-gray-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
