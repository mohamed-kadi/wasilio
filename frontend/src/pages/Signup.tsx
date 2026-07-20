import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, ShieldCheck, Store, UserPlus, UserRound } from 'lucide-react';
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
  const accountBlocks = [
    {
      label: 'Workspace',
      detail: 'Name the store your team will manage.',
      complete: Boolean(tenantName.trim()),
      icon: <Store size={16} />,
    },
    {
      label: 'Contact',
      detail: 'Add the person who signs in first.',
      complete: Boolean(adminName.trim() && adminEmail.trim()),
      icon: <UserRound size={16} />,
    },
    {
      label: 'Security',
      detail: 'Create a strong password for this account.',
      complete: STRONG_PASSWORD.test(password) && Boolean(confirmPassword) && password === confirmPassword,
      icon: <ShieldCheck size={16} />,
    },
  ];

  if (session) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
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
        state: { message: 'Account created. Sign in to continue.' },
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:items-center">
        <section>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={16} />
            Sign in
          </Link>
          <div className="mt-12">
            <BrandLogo className="flex" markClassName="h-10 w-10" textClassName="text-2xl" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-950">Create merchant account</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
            Set up Wasilio access for your store operations.
          </p>
          <div className="mt-8 grid gap-3">
            {accountBlocks.map((block) => (
              <SetupBlock
                key={block.label}
                label={block.label}
                detail={block.detail}
                complete={block.complete}
                icon={block.icon}
              />
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
            label="Merchant full name"
            help="This is the person who will sign in and manage the workspace."
            name="adminName"
            value={adminName}
            error={fieldErrors.adminName}
            autoComplete="name"
            onChange={setAdminName}
          />
          <Field
            label="Merchant email"
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
          <PasswordChecklist password={password} confirmPassword={confirmPassword} />
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
            {loading ? 'Creating account' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}

function SetupBlock({
  label,
  detail,
  complete,
  icon,
}: {
  label: string;
  detail: string;
  complete: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          complete ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="mt-1 text-sm leading-5 text-gray-500">{detail}</p>
        </div>
        {complete ? (
          <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-700" />
        ) : (
          <Circle size={16} className="mt-1 shrink-0 text-gray-300" />
        )}
      </div>
    </div>
  );
}

function PasswordChecklist({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const checks = [
    { label: 'At least 12 characters', complete: password.length >= 12 },
    { label: 'Uppercase and lowercase letters', complete: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Number and symbol', complete: /\d/.test(password) && /[^A-Za-z0-9]/.test(password) },
    { label: 'Passwords match', complete: Boolean(confirmPassword) && password === confirmPassword },
  ];

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-gray-500">Password requirements</p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs text-gray-600">
            {check.complete ? (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-700" />
            ) : (
              <Circle size={14} className="shrink-0 text-gray-300" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
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
