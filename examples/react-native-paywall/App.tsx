import { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import LocalizedPaywall from "./generated/LocalizedPaywall";
import type { PaywallDesign } from "./generated/LocalizedPaywall";
import fixture from "./generated/design-spec.json";

const designSpec = fixture as PaywallDesign;
const products = fixture.plans.flatMap((plan) => "productId" in plan && typeof plan.productId === "string" ? [{
  productId: plan.productId,
  localizedPrice: plan.previewPrice + " · sandbox",
}] : []);

export default function App() {
  const [event, setEvent] = useState("Sandbox callback waiting");
  const [closed, setClosed] = useState(false);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.status}>
        <Text accessibilityLiveRegion="polite">{event}</Text>
        <Text>{fixture.provenance.mode === "demo" ? "Demo Simulation · Fixture" : "Exported model design · Sandbox callbacks"}</Text>
      </View>
      {!closed && <LocalizedPaywall
        designSpec={designSpec}
        products={products}
        previewMode
        onPurchase={(product, planId) => setEvent("Purchase: " + product.productId + " · " + planId)}
        onRestore={() => setEvent("Restore: sandbox")}
        onClose={() => { setEvent("Close: sandbox"); setClosed(true); }}
        onError={() => setEvent("Sandbox callback error")}
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  status: { padding: 14, gap: 4, backgroundColor: "#efeaff" },
});
