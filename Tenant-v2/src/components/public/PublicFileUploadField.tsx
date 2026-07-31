import { Upload } from 'lucide-react';

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
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-200">
          {label} {required ? <span className="text-rose-400">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
      </div>
      <label
        htmlFor={inputId}
        className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 text-sm transition ${
          error ? 'border-rose-400/60 bg-rose-500/10 text-rose-100' : 'border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10'
        }`}
      >
        <Upload size={16} className="text-amber-300" />
        <span>{file ? file.name : 'Choose a file'}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

