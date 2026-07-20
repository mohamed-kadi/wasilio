import { useState, type SyntheticEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { getErrorMessage, requestPasswordReset } from '../api/client';
import { useAuthStore } from '../store/authStore';
import BrandLogo from '../components/BrandLogo';

export default function ForgotPassword() {
  const session = useAuthStore((state) => state.session);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <BrandLogo markClassName="h-10 w-10" textClassName="text-2xl" />
          <h2 className="mt-6 text-xl font-semibold text-gray-900">Reset password</h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
          >
            <Mail size={18} />
            {loading ? 'Sending link' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          <Link to="/login" className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
