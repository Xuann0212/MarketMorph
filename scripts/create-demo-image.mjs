import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
const demo = JSON.parse(
  await readFile(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
).input;
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1880" viewBox="0 0 900 1880"><rect width="900" height="1880" fill="#ffffff"/><g font-family="Arial,sans-serif" fill="#0f172a"><rect x="350" y="165" width="200" height="160" rx="42" fill="#eff6ff"/><text x="450" y="277" text-anchor="middle" font-size="100" fill="#2563eb">L</text><text x="450" y="385" text-anchor="middle" font-size="40">${escape(demo.productName)}</text><text x="450" y="480" text-anchor="middle" font-size="62" font-weight="bold">A little practice.</text><text x="450" y="555" text-anchor="middle" font-size="62" font-weight="bold">A brighter you.</text><text x="450" y="640" text-anchor="middle" font-size="33">Build your daily learning rhythm.</text><g font-size="31"><text x="75" y="740">✓ Practice quizzes from your study notes</text><text x="75" y="805">✓ AI-assisted concept explanations</text><text x="75" y="870">✓ Daily study sessions and streak tracking</text></g>${demo.subscriptionPlans.map((p, i) => `<rect x="65" y="${940 + i * 170}" width="770" height="140" rx="24" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><text x="100" y="${1000 + i * 170}" font-size="40" font-weight="bold">${escape(p.name)}</text><text x="790" y="${1000 + i * 170}" text-anchor="end" font-size="40">USD ${(p.price.amountMinor / 100).toFixed(2)}</text><text x="100" y="${1045 + i * 170}" font-size="28">Billed ${p.price.billingPeriod === "year" ? "annually" : "monthly"}</text>`).join("")}<rect x="65" y="1310" width="770" height="110" rx="25" fill="#2563eb"/><text x="450" y="1380" text-anchor="middle" font-size="38" fill="#fff">Continue</text><g font-size="28" text-anchor="middle"><text x="450" y="1490">3-day free trial · Annual plan only</text><text x="450" y="1540">New subscribers only, once per person.</text><text x="450" y="1610">After trial: USD 79.99 / year unless canceled</text><text x="450" y="1655">before the trial ends. Monthly: USD 9.99 / month,</text><text x="450" y="1700">no free trial.</text></g></g></svg>`;
await writeFile(
  new URL("../public/demo-paywall.png", import.meta.url),
  await sharp(Buffer.from(svg)).png().toBuffer(),
);
console.log(
  "Created trusted demo-paywall.png (900 × 1880). No AI or browser capture used.",
);
