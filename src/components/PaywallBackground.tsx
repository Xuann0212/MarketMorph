import type { BackgroundSettings, StudioBackground } from "@/lib/background";

export default function PaywallBackground({ asset, tint, settings = asset.config }: {
  asset: StudioBackground;
  tint: string;
  settings?: BackgroundSettings;
}) {
  const position = `${settings.focalPoint.x * 100}% ${settings.focalPoint.y * 100}%`;
  return (
    <div className="paywall-background" aria-hidden="true" data-background-asset={asset.config.assetId}>
      <img src={asset.url} alt="" style={{
        objectPosition: position, transformOrigin: position, transform: `scale(${settings.scale})`,
      }} />
      <div style={{ backgroundColor: tint, opacity: settings.overlayOpacity }} />
    </div>
  );
}
