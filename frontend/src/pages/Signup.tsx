import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { ApiError, getErrorMessage, onboardTenant } from '../api/client';
import { useAuthStore } from '../store/authStore';
import BrandLogo from '../components/BrandLogo';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function Signup() {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const [tenantName, setTenantName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!STRONG_PASSWORD.test(password)) {
      setFieldErrors({
        password: 'Use at least 12 characters with uppercase, lowercase, number, and symbol',
      });
      return;
    }

    setLoading(true);
    try {
      await onboardTenant({ tenantName, adminName, adminEmail, password });
      navigate('/login', {
        replace: true,
        state: { message: 'Workspace created. Sign in with the main admin account.' },
      });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(toFieldErrorMap(submitError));
      }
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={16} />
            Sign in
          </Link>
          <BrandLogo className="mt-6" markClassName="h-10 w-10" textClassName="text-2xl" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Create store workspace</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            The store workspace is the business account. The main admin is the person who will manage it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Field
            label="Store / business name"
            help="This is the company, shop, or client workspace name."
            name="tenantName"
            value={tenantName}
            error={fieldErrors.tenantName}
            autoComplete="organization"
            onChange={setTenantName}
          />
          <Field
            label="Main admin full name"
            help="This is the person who will log in and manage the workspace."
            name="adminName"
            value={adminName}
            error={fieldErrors.adminName}
            autoComplete="name"
            onChange={setAdminName}
          />
          <Field
            label="Main admin email"
            name="adminEmail"
            type="email"
            value={adminEmail}
            error={fieldErrors.adminEmail}
            autoComplete="email"
            onChange={setAdminEmail}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            value={password}
            error={fieldErrors.password}
            autoComplete="new-password"
            onChange={setPassword}
          />
          <Field
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            error={fieldErrors.confirmPassword}
            autoComplete="new-password"
            onChange={setConfirmPassword}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
          >
            <UserPlus size={18} />
            {loading ? 'Creating workspace' : 'Create workspace'}
          </button>
        </form>
      </div>
    </main>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  help?: string;
  onChange: (value: string) => void;
}

function Field({ label, name, value, error, type = 'text', autoComplete, help, onChange }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {help && <p className="mb-2 text-xs leading-5 text-gray-500">{help}</p>}
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function toFieldErrorMap(error: ApiError): Record<string, string> {
  return error.fieldErrors.reduce<Record<string, string>>((errors, fieldError) => {
    errors[fieldError.field] = fieldError.message;
    return errors;
  }, {});
}
