import Icon from "./Icon";
import { isValidElement, type ReactNode } from "react";
import type { InputErrors } from "@/lib/inputValidation";
export function fieldAttrs(path: string, errors: InputErrors) {
  return {
    id: path,
    "aria-invalid": Boolean(errors[path]),
    "aria-describedby": errors[path] ? `${path}-error` : undefined,
  };
}
export default function FormField({
  label,
  path,
  errors = {},
  children,
  hint,
}: {
  label: string;
  path: string;
  errors?: InputErrors;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={path}>{label}</label>
      {isValidElement(children) && children.type === "select" ? (
        <div className="select-wrap">{children}<Icon name="chevron" size={16} /></div>
      ) : children}
      {hint && <small>{hint}</small>}
      {errors[path] && (
        <span className="error" id={`${path}-error`} role="alert">
          {errors[path]}
        </span>
      )}
    </div>
  );
}
