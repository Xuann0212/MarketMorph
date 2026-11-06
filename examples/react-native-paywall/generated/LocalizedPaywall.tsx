import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
    theme: { background: string; surface: string; text: string; accent: string };
    featuredPlanId: string;
    planOrder: readonly string[];
    headline: string;
    subtitle?: string;
    benefitsCopy: readonly { benefitId: string; text: string }[];
    ctaText: string;
  };
  plans: readonly Plan[];
  terms: { trial: readonly string[]; disclosures: readonly string[] };
  interactions: { restore: string; close: string };
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
  const { theme } = design;
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
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.strong, copy]}>{designSpec.product.name}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}><Text style={copy}>{designSpec.interactions.close}</Text></Pressable>
      </View>
      {design.sectionOrder.map((section) => <View key={section}>{sections[section]}</View>)}
      <Pressable accessibilityRole="button" disabled={pending} onPress={() => void execute(onRestore)} style={styles.action}>
        <Text style={copy}>{designSpec.interactions.restore}</Text>
      </Pressable>
    </ScrollView>
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
