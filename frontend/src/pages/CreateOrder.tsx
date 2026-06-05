import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, createOrder, getErrorMessage } from '../api/client';

export default function CreateOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
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
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      await createOrder({
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },
        amount: Number(formData.amount),
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
      navigate('/orders');
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(toFieldErrorMap(submitError));
      }
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (field: string) => fieldErrors[field];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Create Order</h2>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Customer Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First Name"
              name="firstName"
              value={formData.firstName}
              error={fieldError('customer.firstName')}
              onChange={handleChange}
            />
            <Field
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              error={fieldError('customer.lastName')}
              onChange={handleChange}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              error={fieldError('customer.email')}
              onChange={handleChange}
            />
            <Field
              label="Phone"
              name="phone"
              value={formData.phone}
              error={fieldError('customer.phone')}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Delivery Address</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field
                label="Street Address"
                name="street"
                value={formData.street}
                error={fieldError('address.street')}
                onChange={handleChange}
              />
            </div>
            <Field
              label="City"
              name="city"
              value={formData.city}
              error={fieldError('address.city')}
              onChange={handleChange}
            />
            <Field
              label="State / Region"
              name="state"
              value={formData.state}
              error={fieldError('address.state')}
              onChange={handleChange}
            />
            <Field
              label="ZIP Code"
              name="zipCode"
              value={formData.zipCode}
              error={fieldError('address.zipCode')}
              onChange={handleChange}
            />
            <Field
              label="Country"
              name="country"
              value={formData.country}
              error={fieldError('address.country')}
              readOnly
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Order Summary</h3>
          <Field
            label="Amount (MAD)"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            error={fieldError('amount')}
            onChange={handleChange}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  type?: string;
  step?: string;
  min?: string;
  readOnly?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function Field({ label, name, value, error, type = 'text', step, min, readOnly = false, onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        required
        name={name}
        type={type}
        step={step}
        min={min}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          readOnly ? 'bg-gray-50' : ''
        } ${error ? 'border-red-300' : 'border-gray-300'}`}
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
