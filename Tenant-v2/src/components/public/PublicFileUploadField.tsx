import { useEffect, useMemo } from 'react';
import { FileImage, FileText, Upload, X } from 'lucide-react';

interface PublicFileUploadFieldProps {
  label: string;
  file: File | null;
  required?: boolean;
  error?: string;
  accept?: string;
  hint?: string;
  inputId: string;
  onChange: (file: File | null) => void;
}

export default function PublicFileUploadField({
  label,
  file,
  required = false,
  error,
  accept = '.pdf,image/*',
  hint,
  inputId,
  onChange
}: PublicFileUploadFieldProps) {
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith('image/')) return '';
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isImage = Boolean(file?.type.startsWith('image/'));

  return (
    <div className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-200">
          {label} {required ? <span className="text-rose-400">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
      </div>
      <label
        htmlFor={inputId}
        className={`group flex cursor-pointer items-center justify-between gap-4 rounded-[1.5rem] border border-dashed px-4 py-4 text-sm transition ${
          error
            ? 'border-rose-400/60 bg-rose-500/10 text-rose-100'
            : 'border-white/15 bg-white/5 text-zinc-300 hover:border-amber-300/60 hover:bg-white/10'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-amber-300">
            <Upload size={16} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{file ? file.name : 'Drop your file here or browse'}</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PNG, JPG, PDF and office files supported'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-zinc-300">
          {file ? <X size={12} className="text-rose-300" /> : null}
          <span>{file ? 'Replace' : 'Choose file'}</span>
        </div>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {file ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt={file.name} className="h-40 w-full object-cover" />
          ) : null}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-amber-300">
              {isImage ? <FileImage size={16} /> : <FileText size={16} />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{file.name}</div>
              <div className="text-xs text-zinc-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'unknown type'}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
