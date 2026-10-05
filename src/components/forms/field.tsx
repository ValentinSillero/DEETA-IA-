import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Field({ label, error, id, name, ...props }: FieldProps) {
  const inputId = id ?? name;
  return (
    <label className="field-label" htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        name={name}
        className="field-input"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <span id={`${inputId}-error`} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: React.ReactNode;
};

export function SelectField({ label, error, id, name, children, ...props }: SelectFieldProps) {
  const inputId = id ?? name;
  return (
    <label className="field-label" htmlFor={inputId}>
      <span>{label}</span>
      <select
        {...props}
        id={inputId}
        name={name}
        className="field-input appearance-none bg-[linear-gradient(45deg,transparent_50%,#5b5f7a_50%),linear-gradient(135deg,#5b5f7a_50%,transparent_50%)] bg-[position:calc(100%-20px)_50%,calc(100%-15px)_50%] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-11"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
      >
        {children}
      </select>
      {error && <span id={`${inputId}-error`} className="field-error">{error}</span>}
    </label>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function TextAreaField({ label, error, id, name, ...props }: TextAreaFieldProps) {
  const inputId = id ?? name;
  return (
    <label className="field-label" htmlFor={inputId}>
      <span>{label}</span>
      <textarea
        {...props}
        id={inputId}
        name={name}
        className="field-input min-h-28 resize-y"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <span id={`${inputId}-error`} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
