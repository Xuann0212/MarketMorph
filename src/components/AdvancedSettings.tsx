import Icon from "./Icon";
import type { InputPayload } from "@/lib/designSchema";
import type { InputErrors } from "@/lib/inputValidation";
import Field, { fieldAttrs } from "./FormField";
export default function AdvancedSettings({
  input,
  errors,
  colorText,
  aiEnabled,
  onColorChange,
  onChange,
}: {
  input: InputPayload;
  errors: InputErrors;
  colorText: { allowed: string; forbidden: string };
  aiEnabled: boolean;
  onColorChange: (key: "allowed" | "forbidden", value: string) => void;
  onChange: (input: InputPayload) => void;
}) {
  return (
    <details className="advanced">
      <summary className="advanced-toggle"><span><Icon name="layout" size={18} />進階設定</span><Icon name="chevron" size={17} /></summary>
      <div className="advanced-body">
        <Field label="品牌風格細節（僅 AI）" path="brandStyle" errors={errors}>
          <textarea
            {...fieldAttrs("brandStyle", errors)}
            rows={2}
            disabled={!aiEnabled}
            value={input.brandStyle}
            onChange={(e) => onChange({ ...input, brandStyle: e.target.value })}
          />
        </Field>
        {(["allowed", "forbidden"] as const).map((key) => (
          <Field
            key={key}
            label={key === "allowed" ? "品牌允許顏色" : "品牌禁止顏色"}
            path={`brandColors.${key}`}
            errors={errors}
          >
            <input
              {...fieldAttrs(`brandColors.${key}`, errors)}
              value={colorText[key]}
              placeholder="#2563EB, #FFFFFF"
              onChange={(e) => onColorChange(key, e.target.value)}
            />
          </Field>
        ))}
        <p className="helper">
          使用六位 HEX，以逗號分隔。選擇風格不會覆寫禁止色。
        </p>
        <Field
          label="背景及其他品牌要求（僅 AI）"
          path="brandColors.backgroundPreference"
          errors={errors}
        >
          <textarea
            {...fieldAttrs("brandColors.backgroundPreference", errors)}
            rows={2}
            disabled={!aiEnabled}
            value={input.brandColors.backgroundPreference}
            onChange={(e) =>
              onChange({
                ...input,
                brandColors: {
                  ...input.brandColors,
                  backgroundPreference: e.target.value,
                },
              })
            }
          />
        </Field>
      </div>
    </details>
  );
}
