import { christmasPaths, christmasViewBox } from "./christmasBackground.ts";
import type { DesignSpec } from "./designSchema.ts";
import { TEXT_SURFACE_THRESHOLD } from "./background.ts";

export function nativeTemplate(pattern: DesignSpec["backgroundPattern"], uploaded = false) {
  const christmas = !uploaded && pattern === "christmas";
  const artwork = christmasPaths.map(({ d, opacity }) =>
    `        <Path d=${JSON.stringify(d)} strokeOpacity={${opacity}} />`,
  ).join("\n");
  return String.raw`import { useRef, useState } from "react";
import { ${uploaded ? "Image, " : ""}Pressable, ScrollView, StyleSheet, Text, View } from "react-native";${christmas ? '\nimport Svg, { Path } from "react-native-svg";' : ""}

type Section = "headline" | "benefits" | "plans" | "trial" | "cta" | "disclosures";
type Plan = {
  id: string;
  name: string;
  productId?: string;
  previewPrice: string;
  periodLabel: string;
  benefitIds?: string[];
};
export interface PaywallDesign {
  schemaVersion: "1.0";
  product: { name: string };
  outputLanguage: "en" | "zh-Hant" | "zh-Hans";
  design: {
    layout: "benefits-first" | "plans-first";
    sectionOrder: readonly Section[];
    theme: { background: string; surface: string; text: string; accent: string };${christmas ? '\n    backgroundPattern?: "christmas";' : ""}
    featuredPlanId: string;
    planOrder: readonly string[];
    headline: string;
    subtitle?: string;
    benefitsCopy: readonly { benefitId: string; text: string }[];
    ctaText: string;
  };
  plans: readonly Plan[];
  terms: { trial: readonly string[]; disclosures: readonly string[] };
  interactions: { restore: string; close: string };${uploaded ? `
  background: {
    type: "uploaded";
    assetPath: "react-native/assets/background.png";
    width: number;
    height: number;
    focalPoint: { x: number; y: number };
    scale: number;
    overlayOpacity: number;
  };` : ""}
}
export interface StoreProduct {
  productId: string;
  localizedPrice: string;
}
interface Props {
  designSpec: PaywallDesign;
  products: readonly StoreProduct[];
  previewMode?: boolean;
  onPurchase: (product: StoreProduct, planId: string) => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onClose: () => void;
  onError?: (error: unknown) => void;
}

export default function LocalizedPaywall({
  designSpec, products, previewMode = false, onPurchase, onRestore, onClose, onError,
}: Props) {
  const { design } = designSpec;
  const { theme } = design;${uploaded ? `
  const background = designSpec.background;
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const coverScale = Math.max(viewport.width / background.width, viewport.height / background.height) * background.scale;
  const imageWidth = background.width * coverScale;
  const imageHeight = background.height * coverScale;
  const textSurface = background.overlayOpacity < ${TEXT_SURFACE_THRESHOLD}
    ? { backgroundColor: theme.background + "cc", padding: 8, borderRadius: 10 }
    : undefined;` : ""}
  const [selectedId, setSelectedId] = useState(design.featuredPlanId);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const plans = design.planOrder.flatMap((id) => designSpec.plans.filter((plan) => plan.id === id));
  const chosen = plans.find((plan) => plan.id === selectedId) ?? plans.find((plan) => plan.id === design.featuredPlanId);
  const lookup = (plan: Plan) => products.find((item) => item.productId === plan.productId && item.localizedPrice.trim());
  const selectedProduct = chosen && lookup(chosen);
  const copy = { color: theme.text };
  const unavailable = {
    en: "Price unavailable", "zh-Hant": "價格暫未提供", "zh-Hans": "价格暂未提供",
  }[designSpec.outputLanguage];

  async function execute(action: () => void | Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await action();
    } catch (error) {
      onError?.(error);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const sections = {
    headline: <View style={styles.stack}>
      <Text accessibilityRole="header" style={[styles.headline, copy]}>{design.headline}</Text>
      {design.subtitle && <Text style={copy}>{design.subtitle}</Text>}
    </View>,
    benefits: <View style={styles.stack}>
      {design.benefitsCopy.map((benefit) => <Text key={benefit.benefitId} style={copy}>✓ {benefit.text}</Text>)}
    </View>,
    plans: <View style={styles.stack}>
      {plans.map((plan) => {
        const isSelected = plan.id === chosen?.id;
        const isFeatured = plan.id === design.featuredPlanId;
        return (
          <Pressable key={plan.id} accessibilityRole="radio" aria-checked={isSelected} accessibilityState={{ checked: isSelected }}
            onPress={() => setSelectedId(plan.id)}
            style={[styles.plan, {
              backgroundColor: theme.surface, borderColor: isSelected || isFeatured ? theme.accent : theme.text,
              borderWidth: isFeatured ? 2 : 1,
            }]}>
            <Text style={[styles.strong, copy]}>{plan.name}</Text>
            <Text style={copy}>{lookup(plan)?.localizedPrice ?? (previewMode ? plan.previewPrice : unavailable)} · {plan.periodLabel}</Text>
            {plan.benefitIds?.length ? design.benefitsCopy.filter((item) => plan.benefitIds?.includes(item.benefitId))
              .map((item) => <Text key={item.benefitId} style={copy}>{item.text}</Text>) : null}
          </Pressable>
        );
      })}
    </View>,
    trial: <View style={styles.stack}>{designSpec.terms.trial.map((term, index) => <Text key={index} style={copy}>{term}</Text>)}</View>,
    cta: <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending || !selectedProduct }}
      disabled={pending || !selectedProduct} style={[styles.cta, { backgroundColor: theme.accent, opacity: pending || !selectedProduct ? 0.55 : 1 }]}
      onPress={() => { if (selectedProduct && chosen) void execute(() => onPurchase(selectedProduct, chosen.id)); }}>
      <Text style={[styles.strong, { color: theme.surface }]}>{design.ctaText}</Text>
    </Pressable>,
    disclosures: <View style={styles.stack}>{designSpec.terms.disclosures.map((term, index) => <Text key={index} style={copy}>{term}</Text>)}</View>,
  };

  return (
    ${uploaded ? `<View style={{ flex: 1, backgroundColor: theme.background, overflow: "hidden" }}
      onLayout={({ nativeEvent: { layout: { width, height } } }) => setViewport((current) =>
        current.width === width && current.height === height ? current : { width, height })}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
        {viewport.width > 0 && viewport.height > 0 && <Image
          source={require("./assets/background.png")} resizeMode="cover"
          style={{
            position: "absolute", width: imageWidth, height: imageHeight,
            left: (viewport.width - imageWidth) * background.focalPoint.x,
            top: (viewport.height - imageHeight) * background.focalPoint.y,
          }}
        />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background, opacity: background.overlayOpacity }]} />
      </View>
    ` : ""}<ScrollView style={{ backgroundColor: ${uploaded ? '"transparent"' : "theme.background"} }} contentContainerStyle={styles.content}>
      ${christmas ? `{design.backgroundPattern === "christmas" && (
      <Svg pointerEvents="none" accessible={false} width="100%" height={66} viewBox="${christmasViewBox}"
        fill="none" stroke={theme.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
${artwork}
      </Svg>
      )}\n      ` : ""}<View style={${uploaded ? "[styles.header, textSurface]" : "styles.header"}}>
        <Text style={[styles.strong, copy]}>{designSpec.product.name}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}><Text style={copy}>{designSpec.interactions.close}</Text></Pressable>
      </View>
      {design.sectionOrder.map((section) => <View key={section}${uploaded ? ` style={
        section === "headline" || section === "benefits" ||
        (section === "trial" && designSpec.terms.trial.length > 0) ||
        (section === "disclosures" && designSpec.terms.disclosures.length > 0) ? textSurface : undefined
      }` : ""}>{sections[section]}</View>)}
      <Pressable accessibilityRole="button" disabled={pending} onPress={() => void execute(onRestore)} style={styles.action}>
        <Text style={copy}>{designSpec.interactions.restore}</Text>
      </Pressable>
    </ScrollView>${uploaded ? "\n    </View>" : ""}
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  headline: { fontSize: 28, fontWeight: "700" },
  strong: { fontWeight: "700" },
  stack: { gap: 8 },
  plan: { borderRadius: 12, padding: 12, gap: 4 },
  cta: { alignItems: "center", borderRadius: 10, padding: 14 },
  action: { minHeight: 44, justifyContent: "center" },
});
`;
}

export const integrationGuide = String.raw`# MarketMorph React Native 接入

导出组件可用于开发集成，但不代表已通过生产支付及发布审核。

1. 将 react-native/LocalizedPaywall.tsx 和 design-spec.json 复制进已有的 Expo 或 React Native 项目。组件依赖 react 和 react-native。如果设计包含圣诞背景图案，还需安装 react-native-svg；Expo 项目可用 npx expo install react-native-svg。
2. 将 JSON 作为 designSpec 传入。使用从 App Store、Google Play 或订阅 SDK 取得的 products 数组。每项提供 productId 和 localizedPrice。
3. 按企业商品 ID 对应 design-spec.json 中的 plans[].productId。未映射、商店无该商品或无本地化价格时，购买 CTA 会停用。
4. 用 onPurchase(product, planId) 调用宿主的购买流程，用 onRestore 调用恢复购买，用 onClose 关闭页面。可通过 onError 呈现 SDK 错误。
5. 在 SDK 沙盒核对商店本地化价格、试用资格、续订披露、购买与恢复结果，再做设备和发布审核。previewMode 只为设计评审显示设计价。它无法替代商店报价或启用未映射的商品。
6. 在交付前查看 audit-report.json。需要人工确认的项目包括模型文案语义、品牌表达或图片识别。示例模式和模拟产品数据在 design-spec.json 的 provenance 中有标记。

仓库内的 examples/react-native-paywall 可以用 npm install、npm run typecheck、npm run web 启动示例验证。示例使用本地回调展示事件，不执行真实交易。
`;
