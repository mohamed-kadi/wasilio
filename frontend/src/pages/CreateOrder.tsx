import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, PackagePlus, PhoneCall, Truck } from 'lucide-react';
import { ApiError, createOrder, getErrorMessage } from '../api/client';

interface OrderFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  amount: string;
}

const emptyForm: OrderFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Morocco',
  amount: '',
};

const cityPresets = [
  { city: 'Casablanca', state: 'Casablanca-Settat', zipCode: '20000' },
  { city: 'Rabat', state: 'Rabat-Sale-Kenitra', zipCode: '10000' },
  { city: 'Marrakech', state: 'Marrakech-Safi', zipCode: '40000' },
  { city: 'Tangier', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '90000' },
];

export default function CreateOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<OrderFormData>(emptyForm);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function applyCityPreset(preset: { city: string; state: string; zipCode: string }) {
    setFormData((current) => ({
      ...current,
      city: preset.city,
      state: preset.state,
      zipCode: preset.zipCode,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.city;
      delete next.state;
      delete next.zipCode;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Review the highlighted fields before creating this COD order.');
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      const orderId = await createOrder({
        customer: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        },
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
          country: formData.country.trim(),
        },
        amount: Number(formData.amount),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] }),
      ]);

      navigate('/app/confirmations', { state: { createdOrderId: orderId } });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(toFieldErrorMap(submitError));
      }
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  function fieldError(field: keyof OrderFormData, apiField?: string) {
    return fieldErrors[field] ?? (apiField ? fieldErrors[apiField] : undefined);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/orders" className="text-sm font-medium text-blue-600 hover:underline">
            &larr; Back to orders
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Create COD order</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Capture the customer, delivery address, and cash amount. The order will be sent to the confirmation queue next.
          </p>
        </div>
        <Link
          to="/app/confirmations"
          className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          Open confirmation queue
          <ArrowRight size={16} />
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <FormSection
            icon={<PhoneCall size={18} />}
            title="Customer contact"
            detail="Use the phone number operators will call or message during confirmation."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                name="firstName"
                value={formData.firstName}
                error={fieldError('firstName', 'customer.firstName')}
                placeholder="Sara"
                autoComplete="given-name"
                onChange={handleChange}
              />
              <Field
                label="Last name"
                name="lastName"
                value={formData.lastName}
                error={fieldError('lastName', 'customer.lastName')}
                placeholder="Customer"
                autoComplete="family-name"
                onChange={handleChange}
              />
              <Field
                label="Phone / WhatsApp"
                name="phone"
                value={formData.phone}
                error={fieldError('phone', 'customer.phone')}
                placeholder="+212600000001"
                autoComplete="tel"
                onChange={handleChange}
              />
              <Field
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                error={fieldError('email', 'customer.email')}
                help="Required by the current order record."
                placeholder="customer@example.com"
                autoComplete="email"
                onChange={handleChange}
              />
            </div>
          </FormSection>

          <FormSection
            icon={<Truck size={18} />}
            title="Delivery address"
            detail="This is the address the courier team will use after confirmation."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Street address"
                  name="street"
                  value={formData.street}
                  error={fieldError('street', 'address.street')}
                  placeholder="Rue Example, building, floor"
                  autoComplete="street-address"
                  onChange={handleChange}
                />
              </div>
              <Field
                label="City"
                name="city"
                value={formData.city}
                error={fieldError('city', 'address.city')}
                placeholder="Casablanca"
                autoComplete="address-level2"
                onChange={handleChange}
              />
              <Field
                label="Region"
                name="state"
                value={formData.state}
                error={fieldError('state', 'address.state')}
                placeholder="Casablanca-Settat"
                autoComplete="address-level1"
                onChange={handleChange}
              />
              <Field
                label="Postal code"
                name="zipCode"
                value={formData.zipCode}
                error={fieldError('zipCode', 'address.zipCode')}
                help="Use the city postal code when the source order has no exact code."
                placeholder="20000"
                autoComplete="postal-code"
                onChange={handleChange}
              />
              <Field
                label="Country"
                name="country"
                value={formData.country}
                error={fieldError('country', 'address.country')}
                readOnly
                onChange={handleChange}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {cityPresets.map((preset) => (
                <button
                  key={preset.city}
                  type="button"
                  onClick={() => applyCityPreset(preset)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {preset.city}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection
            icon={<PackagePlus size={18} />}
            title="Cash amount"
            detail="Enter the amount the customer should confirm before the package moves to courier operations."
          >
            <Field
              label="Amount to collect (MAD)"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={formData.amount}
              error={fieldError('amount')}
              placeholder="349.00"
              onChange={handleChange}
            />
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
            <p className="text-sm text-gray-500">After creation, continue from the confirmation queue.</p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ClipboardList size={17} />
              {loading ? 'Creating order' : 'Create and confirm next'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-900">
            <p className="text-xs font-semibold uppercase">Next operational step</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900">Start customer confirmation</h3>
            <p className="mt-2 text-sm leading-6">
              New orders enter the confirmation queue. Operators can call, record the outcome, schedule callbacks, or reject before courier handoff.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase text-gray-500">Creation checklist</h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              <ChecklistItem>Phone number is callable or reachable on WhatsApp.</ChecklistItem>
              <ChecklistItem>Address is specific enough for courier pickup and delivery.</ChecklistItem>
              <ChecklistItem>Cash amount matches what the customer will confirm.</ChecklistItem>
            </ul>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="text-xs font-semibold uppercase">Demo tip</p>
            <p className="mt-2 text-sm leading-6">
              Use the city presets during demos to enter a realistic Moroccan address quickly without slowing the workflow.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FormSection({
  icon,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{detail}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  name: keyof OrderFormData;
  value: string;
  error?: string;
  help?: string;
  type?: string;
  step?: string;
  min?: string;
  inputMode?: 'decimal' | 'email' | 'numeric' | 'search' | 'tel' | 'text' | 'url';
  placeholder?: string;
  autoComplete?: string;
  readOnly?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function Field({
  label,
  name,
  value,
  error,
  help,
  type = 'text',
  step,
  min,
  inputMode,
  placeholder,
  autoComplete,
  readOnly = false,
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {help && <span className="mb-2 block text-xs leading-5 text-gray-500">{help}</span>}
      <input
        required
        name={name}
        type={type}
        step={step}
        min={min}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          readOnly ? 'bg-gray-100 text-gray-600' : 'bg-white'
        } ${error ? 'border-red-300' : 'border-gray-300'}`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
      <span>{children}</span>
    </li>
  );
}

function validateForm(formData: OrderFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const requiredFields: Array<keyof OrderFormData> = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'street',
    'city',
    'state',
    'zipCode',
    'country',
  ];

  requiredFields.forEach((field) => {
    if (!formData[field].trim()) {
      errors[field] = 'Required';
    }
  });

  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  const amount = Number(formData.amount);
  if (!formData.amount.trim()) {
    errors.amount = 'Required';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  return errors;
}

function toFieldErrorMap(error: ApiError): Record<string, string> {
  return error.fieldErrors.reduce<Record<string, string>>((errors, fieldError) => {
    errors[fieldError.field] = fieldError.message;
    return errors;
  }, {});
}
