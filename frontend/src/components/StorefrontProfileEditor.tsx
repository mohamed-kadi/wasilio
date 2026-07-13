import { type FormEvent, type RefObject, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Upload } from 'lucide-react';
import {
  fetchProductStorefrontProfile,
  getErrorMessage,
  upsertProductStorefrontProfile,
  uploadProductMedia,
  type Product,
  type ProductMediaPurpose,
  type StorefrontProductProfilePayload,
} from '../api/client';

export default function StorefrontProfileEditor({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const galleryImageUrlsRef = useRef<HTMLTextAreaElement | null>(null);
  const seoImageUrlRef = useRef<HTMLInputElement | null>(null);

  const {
    data: profile,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['product-storefront-profile', product.id],
    queryFn: () => fetchProductStorefrontProfile(product.id),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: StorefrontProductProfilePayload) => upsertProductStorefrontProfile(product.id, payload),
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(['product-storefront-profile', product.id], savedProfile);
    },
  });

  const mediaUploadMutation = useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: ProductMediaPurpose }) => uploadProductMedia(product.id, file, purpose),
    onSuccess: (media, variables) => {
      if (variables.purpose === 'GALLERY_IMAGE') {
        appendTextAreaLine(galleryImageUrlsRef.current, media.publicUrl);
      }
      if (variables.purpose === 'SEO_IMAGE') {
        setInputValue(seoImageUrlRef.current, media.publicUrl);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(profilePayloadFromFormData(new FormData(event.currentTarget)));
  }

  const formKey = `${product.id}:${profile ? JSON.stringify(profile) : 'empty'}`;

  return (
    <form key={formKey} onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase text-gray-500">Landing content</h3>
          <p className="mt-1 text-sm text-gray-600">
            Public landing content for <span className="font-medium text-gray-900">{product.name}</span>. Draft profiles
            stay hidden from public product endpoints.
            {isFetching && !isLoading ? ' Refreshing' : ''}
          </p>
        </div>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Profile status</span>
          <select
            name="status"
            defaultValue={profile?.status ?? 'DRAFT'}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
      </div>

      {(error || saveMutation.error || mediaUploadMutation.error) && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? saveMutation.error ?? mediaUploadMutation.error)}
        </div>
      )}

      {saveMutation.isSuccess && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Storefront profile saved.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Headline</span>
          <input
            name="headline"
            defaultValue={profile?.headline ?? ''}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={255}
            disabled={isLoading}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Subheadline</span>
          <input
            name="subheadline"
            defaultValue={profile?.subheadline ?? ''}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={500}
            disabled={isLoading}
          />
        </label>
        <TextAreaField
          label="Benefits"
          name="benefits"
          defaultValue={profile?.benefits.join('\n') ?? ''}
          help="One short benefit per line."
          disabled={isLoading}
        />
        <MediaTextAreaField
          label="Gallery image URLs"
          name="galleryImageUrls"
          defaultValue={profile?.galleryImageUrls.join('\n') ?? ''}
          help="One public image URL per line."
          disabled={isLoading}
          fieldRef={galleryImageUrlsRef}
          uploadLabel={mediaUploadMutation.isPending ? 'Uploading' : 'Add gallery image'}
          uploadDisabled={isLoading || mediaUploadMutation.isPending}
          onUpload={(file) => mediaUploadMutation.mutate({ file, purpose: 'GALLERY_IMAGE' })}
        />
        <TextAreaField
          label="Features"
          name="features"
          defaultValue={profile ? pairLinesFromObjects(profile.features, 'title', 'description') : ''}
          help="One feature per line: title | description."
          disabled={isLoading}
        />
        <TextAreaField
          label="FAQ"
          name="faq"
          defaultValue={profile ? pairLinesFromObjects(profile.faq, 'question', 'answer') : ''}
          help="One question per line: question | answer."
          disabled={isLoading}
        />
        <TextAreaField
          label="Trust badges"
          name="trustBadges"
          defaultValue={profile ? pairLinesFromObjects(profile.trustBadges, 'label', 'description') : ''}
          help="One badge per line: label | description."
          disabled={isLoading}
        />
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">SEO title</span>
            <input
              name="seoTitle"
              defaultValue={profile?.seoTitle ?? ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              disabled={isLoading}
            />
          </label>
          <div className="block">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="block text-xs font-medium uppercase text-gray-500">SEO image URL</span>
              <FileUploadButton
                label={mediaUploadMutation.isPending ? 'Uploading' : 'Upload SEO image'}
                disabled={isLoading || mediaUploadMutation.isPending}
                onUpload={(file) => mediaUploadMutation.mutate({ file, purpose: 'SEO_IMAGE' })}
              />
            </div>
            <input
              ref={seoImageUrlRef}
              name="seoImageUrl"
              defaultValue={profile?.seoImageUrl ?? ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={1000}
              disabled={isLoading}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">SEO description</span>
            <textarea
              name="seoDescription"
              defaultValue={profile?.seoDescription ?? ''}
              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={500}
              disabled={isLoading}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={18} />
          {saveMutation.isPending ? 'Saving profile' : 'Save profile'}
        </button>
        {profile && (
          <p className="text-sm text-gray-500">
            Current profile: <span className="font-medium text-gray-700">{profile.status}</span>
          </p>
        )}
      </div>
    </form>
  );
}

function FileUploadButton({
  label,
  disabled,
  onUpload,
}: {
  label: string;
  disabled: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
          : 'cursor-pointer border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
      }`}
    >
      <Upload size={14} />
      {label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            onUpload(file);
          }
        }}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  help,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  help: string;
  disabled: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        className="min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={disabled}
      />
      <span className="mt-1 block text-xs text-gray-500">{help}</span>
    </label>
  );
}

function MediaTextAreaField({
  label,
  name,
  defaultValue,
  help,
  disabled,
  fieldRef,
  uploadLabel,
  uploadDisabled,
  onUpload,
}: {
  label: string;
  name: string;
  defaultValue: string;
  help: string;
  disabled: boolean;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  uploadLabel: string;
  uploadDisabled: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="block text-xs font-medium uppercase text-gray-500">{label}</span>
        <FileUploadButton label={uploadLabel} disabled={uploadDisabled} onUpload={onUpload} />
      </div>
      <textarea
        ref={fieldRef}
        name={name}
        defaultValue={defaultValue}
        className="min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={disabled}
      />
      <span className="mt-1 block text-xs text-gray-500">{help}</span>
    </div>
  );
}

function profilePayloadFromFormData(formData: FormData): StorefrontProductProfilePayload {
  const status = formValue(formData, 'status') === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  return {
    headline: optionalValue(formValue(formData, 'headline')),
    subheadline: optionalValue(formValue(formData, 'subheadline')),
    benefits: linesFromText(formValue(formData, 'benefits')),
    features: parsePairLines(formValue(formData, 'features'), 'title', 'description'),
    faq: parsePairLines(formValue(formData, 'faq'), 'question', 'answer'),
    trustBadges: parsePairLines(formValue(formData, 'trustBadges'), 'label', 'description'),
    galleryImageUrls: linesFromText(formValue(formData, 'galleryImageUrls')),
    seoTitle: optionalValue(formValue(formData, 'seoTitle')),
    seoDescription: optionalValue(formValue(formData, 'seoDescription')),
    seoImageUrl: optionalValue(formValue(formData, 'seoImageUrl')),
    status,
  };
}

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function linesFromText(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePairLines<TFirst extends string, TSecond extends string>(
  value: string,
  firstKey: TFirst,
  secondKey: TSecond,
): Array<Record<TFirst | TSecond, string>> {
  return linesFromText(value).map((line) => {
    const [first, ...rest] = line.split('|');
    return {
      [firstKey]: first.trim(),
      [secondKey]: rest.join('|').trim(),
    } as Record<TFirst | TSecond, string>;
  });
}

function pairLinesFromObjects<TFirst extends string, TSecond extends string>(
  values: Array<Partial<Record<TFirst | TSecond, string>>>,
  firstKey: TFirst,
  secondKey: TSecond,
): string {
  return values
    .map((value) => [value[firstKey] ?? '', value[secondKey] ?? ''].map((part) => part.trim()).join(' | ').trim())
    .filter((line) => line !== '|')
    .join('\n');
}

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function appendTextAreaLine(textarea: HTMLTextAreaElement | null, value: string) {
  if (!textarea) {
    return;
  }
  const currentValue = textarea.value.trim();
  textarea.value = currentValue ? `${currentValue}\n${value}` : value;
}

function setInputValue(input: HTMLInputElement | null, value: string) {
  if (!input) {
    return;
  }
  input.value = value;
}
