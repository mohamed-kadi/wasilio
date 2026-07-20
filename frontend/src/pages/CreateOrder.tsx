import { useState, type ChangeEvent, type SyntheticEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, PackagePlus, PhoneCall, Plus, Trash2, Truck } from 'lucide-react';
import { ApiError, createOrder, fetchProducts, getErrorMessage, type Product } from '../api/client';

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

interface ProductLineForm {
  rowId: string;
  productId: string;
  quantity: string;
}

interface CityPreset {
  city: string;
  state: string;
  zipCode: string;
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

const cityPresets: CityPreset[] = [
  { city: 'Agadir', state: 'Souss-Massa', zipCode: '80000' },
  { city: 'Al Hoceima', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '32000' },
  { city: 'Azilal', state: 'Beni Mellal-Khenifra', zipCode: '22000' },
  { city: 'Beni Mellal', state: 'Beni Mellal-Khenifra', zipCode: '23000' },
  { city: 'Benslimane', state: 'Casablanca-Settat', zipCode: '13000' },
  { city: 'Boujdour', state: 'Laayoune-Sakia El Hamra', zipCode: '71000' },
  { city: 'Casablanca', state: 'Casablanca-Settat', zipCode: '20000' },
  { city: 'Chefchaouen', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '91000' },
  { city: 'Chichaoua', state: 'Marrakech-Safi', zipCode: '41000' },
  { city: 'Dakhla', state: 'Dakhla-Oued Ed-Dahab', zipCode: '73000' },
  { city: 'El Jadida', state: 'Casablanca-Settat', zipCode: '24000' },
  { city: 'Errachidia', state: 'Draa-Tafilalet', zipCode: '52000' },
  { city: 'Es Semara', state: 'Laayoune-Sakia El Hamra', zipCode: '72000' },
  { city: 'Essaouira', state: 'Marrakech-Safi', zipCode: '44000' },
  { city: 'Fes', state: 'Fes-Meknes', zipCode: '30000' },
  { city: 'Figuig', state: 'Oriental', zipCode: '61000' },
  { city: 'Guelmim', state: 'Guelmim-Oued Noun', zipCode: '81000' },
  { city: 'Ifrane', state: 'Fes-Meknes', zipCode: '53000' },
  { city: 'Kelaat Sraghna', state: 'Marrakech-Safi', zipCode: '43000' },
  { city: 'Kenitra', state: 'Rabat-Sale-Kenitra', zipCode: '14000' },
  { city: 'Khemisset', state: 'Rabat-Sale-Kenitra', zipCode: '15000' },
  { city: 'Khenifra', state: 'Beni Mellal-Khenifra', zipCode: '54000' },
  { city: 'Khouribga', state: 'Beni Mellal-Khenifra', zipCode: '25000' },
  { city: 'Laayoune', state: 'Laayoune-Sakia El Hamra', zipCode: '70000' },
  { city: 'Larache', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '92000' },
  { city: 'Marrakech', state: 'Marrakech-Safi', zipCode: '40000' },
  { city: 'Meknes', state: 'Fes-Meknes', zipCode: '50000' },
  { city: 'Mohammedia', state: 'Casablanca-Settat', zipCode: '20650' },
  { city: 'Nador', state: 'Oriental', zipCode: '62000' },
  { city: 'Ouarzazate', state: 'Draa-Tafilalet', zipCode: '45000' },
  { city: 'Oujda', state: 'Oriental', zipCode: '60000' },
  { city: 'Rabat', state: 'Rabat-Sale-Kenitra', zipCode: '10000' },
  { city: 'Safi', state: 'Marrakech-Safi', zipCode: '46000' },
  { city: 'Sale', state: 'Rabat-Sale-Kenitra', zipCode: '11000' },
  { city: 'Sefrou', state: 'Fes-Meknes', zipCode: '31000' },
  { city: 'Settat', state: 'Casablanca-Settat', zipCode: '26000' },
  { city: 'Sidi Kacem', state: 'Rabat-Sale-Kenitra', zipCode: '16000' },
  { city: 'Tan-Tan', state: 'Guelmim-Oued Noun', zipCode: '82000' },
  { city: 'Tangier', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '90000' },
  { city: 'Taounate', state: 'Fes-Meknes', zipCode: '34000' },
  { city: 'Taroudannt', state: 'Souss-Massa', zipCode: '83000' },
  { city: 'Tata', state: 'Souss-Massa', zipCode: '84000' },
  { city: 'Taza', state: 'Fes-Meknes', zipCode: '35000' },
  { city: 'Temara', state: 'Rabat-Sale-Kenitra', zipCode: '12000' },
  { city: 'Tetouan', state: 'Tanger-Tetouan-Al Hoceima', zipCode: '93000' },
  { city: 'Tiznit', state: 'Souss-Massa', zipCode: '85000' },
];

export default function CreateOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<OrderFormData>(emptyForm);
  const [productLines, setProductLines] = useState<ProductLineForm[]>([]);

  const {
    data: productsPage,
    error: productsError,
    isLoading: productsLoading,
  } = useQuery({
    queryKey: ['products', { page: 0, size: 100, status: 'ACTIVE' }],
    queryFn: () => fetchProducts({ page: 0, size: 100, status: 'ACTIVE' }),
  });

  const activeProducts = (productsPage?.content ?? []).filter((product) => product.status === 'ACTIVE');
  const hasProductLines = productLines.length > 0;
  const productLineError =
    fieldErrors.productLines ??
    Object.entries(fieldErrors).find(([field]) => field.startsWith('productLines'))?.[1];

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

  function handleCityChange(event: ChangeEvent<HTMLSelectElement>) {
    const preset = cityPresets.find((candidate) => candidate.city === event.target.value);
    if (preset) {
      applyCityPreset(preset);
      return;
    }

    setFormData((current) => ({ ...current, city: '', state: '', zipCode: '' }));
    clearFieldErrors(['city', 'state', 'zipCode']);
  }

  function applyCityPreset(preset: CityPreset) {
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

  function addProductLine() {
    const selectedProductIds = new Set(productLines.map((line) => line.productId));
    const product = activeProducts.find((candidate) => !selectedProductIds.has(candidate.id));
    if (!product) {
      return;
    }
    setProductLines((current) => [
      ...current,
      {
        rowId: createRowId(),
        productId: product.id,
        quantity: '1',
      },
    ]);
    setFormData((current) => ({ ...current, amount: '' }));
    clearFieldErrors(['amount', 'productLines']);
  }

  function updateProductLine(rowId: string, nextLine: Partial<ProductLineForm>) {
    setProductLines((current) => current.map((line) => (line.rowId === rowId ? { ...line, ...nextLine } : line)));
    clearProductLineErrors();
  }

  function removeProductLine(rowId: string) {
    setProductLines((current) => current.filter((line) => line.rowId !== rowId));
    clearProductLineErrors();
  }

  function clearFieldErrors(fields: string[]) {
    setFieldErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => {
        delete next[field];
      });
      return next;
    });
  }

  function clearProductLineErrors() {
    setFieldErrors((current) => {
      const next = { ...current };
      Object.keys(next).forEach((field) => {
        if (field.startsWith('productLines')) {
          delete next[field];
        }
      });
      return next;
    });
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationErrors = validateForm(formData, productLines, activeProducts);
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
        ...(hasProductLines
          ? {
              productLines: productLines.map((line) => ({
                productId: line.productId,
                quantity: Number(line.quantity),
              })),
            }
          : { amount: Number(formData.amount) }),
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
              <CitySelect
                label="City"
                value={formData.city}
                error={fieldError('city', 'address.city')}
                options={cityPresets}
                onChange={handleCityChange}
              />
              <Field
                label="Region"
                name="state"
                value={formData.state}
                error={fieldError('state', 'address.state')}
                help="Auto-filled after selection."
                placeholder="Casablanca-Settat"
                autoComplete="address-level1"
                readOnly
                onChange={handleChange}
              />
              <Field
                label="Postal code"
                name="zipCode"
                value={formData.zipCode}
                error={fieldError('zipCode', 'address.zipCode')}
                help="Auto-filled after selection."
                placeholder="20000"
                autoComplete="postal-code"
                readOnly
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

          </FormSection>

          <FormSection
            icon={<PackagePlus size={18} />}
            title="Catalog products"
            detail="Select active products when the order should use a catalog snapshot."
          >
            {productsError && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {getErrorMessage(productsError)}
              </div>
            )}

            <div className="space-y-3">
              {productLines.map((line, index) => {
                const product = activeProducts.find((candidate) => candidate.id === line.productId);
                const selectedProductIds = new Set(productLines.map((candidate) => candidate.productId));
                const lineTotal = product ? product.priceAmount * Number(line.quantity || '0') : 0;
                const quantityError = fieldErrors[`productLines.${index}.quantity`];

                return (
                  <div
                    key={line.rowId}
                    className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-3 md:grid-cols-[1fr_120px_130px_40px]"
                  >
                    <label>
                      <span className="mb-1 block text-sm font-medium text-gray-700">Product</span>
                      <select
                        value={line.productId}
                        onChange={(event) => updateProductLine(line.rowId, { productId: event.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {activeProducts.map((candidate) => (
                          <option
                            key={candidate.id}
                            value={candidate.id}
                            disabled={selectedProductIds.has(candidate.id) && candidate.id !== line.productId}
                          >
                            {candidate.name} - {formatMoney(candidate.priceAmount, candidate.currency)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium text-gray-700">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) => updateProductLine(line.rowId, { quantity: event.target.value })}
                        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          quantityError ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {quantityError && <span className="mt-1 block text-xs text-red-600">{quantityError}</span>}
                    </label>
                    <div>
                      <span className="mb-1 block text-sm font-medium text-gray-700">Line total</span>
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                        {formatMoney(Number.isFinite(lineTotal) ? lineTotal : 0, product?.currency ?? 'MAD')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProductLine(line.rowId)}
                      className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                      aria-label={`Remove ${product?.name ?? 'product line'}`}
                      title="Remove product"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}

              {productLineError && <p className="text-xs text-red-600">{productLineError}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addProductLine}
                  disabled={productsLoading || activeProducts.length === productLines.length}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <Plus size={16} />
                  Add product
                </button>
                {hasProductLines && (
                  <p className="text-sm font-semibold text-gray-900">
                    Product total: {formatProductTotal(productLines, activeProducts)}
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={<ClipboardList size={18} />}
            title="Cash amount"
            detail={
              hasProductLines
                ? 'The cash amount is calculated from selected catalog products.'
                : 'Enter the amount the customer should confirm before the package moves to courier operations.'
            }
          >
            {hasProductLines ? (
              <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-gray-700">Amount to collect</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{formatProductTotal(productLines, activeProducts)}</p>
              </div>
            ) : (
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
            )}
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
              Choose a city to fill the region and main postal code without slowing the workflow.
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

function CitySelect({
  label,
  value,
  error,
  options,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  options: CityPreset[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="block">
      <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id="city"
        required
        name="city"
        value={value}
        autoComplete="address-level2"
        onChange={onChange}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        <option value="">Select city</option>
        {options.map((option) => (
          <option key={option.city} value={option.city}>
            {option.city}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
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
  required?: boolean;
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
  required = true,
  onChange,
}: FieldProps) {
  const helpId = help ? `${name}-help` : undefined;

  return (
    <div className="block">
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {help && (
        <span id={helpId} className="mb-2 block text-xs leading-5 text-gray-500">
          {help}
        </span>
      )}
      <input
        id={name}
        required={required}
        name={name}
        type={type}
        step={step}
        min={min}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={helpId}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          readOnly ? 'bg-gray-100 text-gray-600' : 'bg-white'
        } ${error ? 'border-red-300' : 'border-gray-300'}`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
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

function validateForm(
  formData: OrderFormData,
  productLines: ProductLineForm[],
  activeProducts: Product[],
): Record<string, string> {
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

  if (productLines.length > 0) {
    const seenProductIds = new Set<string>();
    productLines.forEach((line, index) => {
      if (!activeProducts.some((product) => product.id === line.productId)) {
        errors.productLines = 'Select an active product for each line';
      }
      if (seenProductIds.has(line.productId)) {
        errors.productLines = 'Each product can only be selected once';
      }
      seenProductIds.add(line.productId);

      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors[`productLines.${index}.quantity`] = 'Quantity must be at least 1';
      }
    });
  } else {
    const amount = Number(formData.amount);
    if (!formData.amount.trim()) {
      errors.amount = 'Required';
    } else if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
  }

  return errors;
}

function calculateProductTotal(productLines: ProductLineForm[], products: Product[]): number {
  return productLines.reduce((total, line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity)) {
      return total;
    }
    return total + product.priceAmount * quantity;
  }, 0);
}

function formatProductTotal(productLines: ProductLineForm[], products: Product[]): string {
  const currencies = productLines
    .map((line) => products.find((product) => product.id === line.productId)?.currency)
    .filter((currency): currency is string => Boolean(currency));
  const uniqueCurrencies = Array.from(new Set(currencies));
  const currency = uniqueCurrencies.length === 1 ? uniqueCurrencies[0] : 'MAD';
  return formatMoney(calculateProductTotal(productLines, products), currency);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function createRowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toFieldErrorMap(error: ApiError): Record<string, string> {
  return error.fieldErrors.reduce<Record<string, string>>((errors, fieldError) => {
    errors[fieldError.field] = fieldError.message;
    return errors;
  }, {});
}
