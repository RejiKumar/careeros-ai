import React, { useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

let BannerAdComponent: React.ComponentType<{ size?: unknown }> | null = null;
let adAvailable = false;

try {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mobileAds = require("react-native-google-mobile-ads").default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BannerAd, BannerAdSize, TestIds, useForeground } = require("react-native-google-mobile-ads");

    const bannerUnitId = Platform.select({
      android: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID || TestIds.BANNER,
      ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS || TestIds.BANNER,
    }) ?? TestIds.BANNER;

    function BannerInner({ size }: { size?: typeof BannerAdSize[keyof typeof BannerAdSize] }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bannerRef = React.useRef<any>(null);
      const [loaded, setLoaded] = useState(false);

      useForeground(() => bannerRef.current?.load());

      return (
        <View style={{ alignItems: "center", opacity: loaded ? 1 : 0, minHeight: loaded ? undefined : 0 }}>
          <BannerAd
            ref={bannerRef}
            unitId={bannerUnitId}
            size={size ?? BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            onAdLoaded={() => setLoaded(true)}
            onAdFailedToLoad={() => setLoaded(false)}
          />
        </View>
      );
    }

    BannerAdComponent = BannerInner;
    adAvailable = true;

    mobileAds()
      .initialize()
      .catch(() => {});
  }
} catch {
  adAvailable = false;
}

interface AdBannerProps {
  size?: unknown;
  style?: object;
}

export default function AdBanner({ size, style }: AdBannerProps) {
  if (!adAvailable || BannerAdComponent === null) {
    return null;
  }

  return (
    <View style={style}>
      <BannerAdComponent size={size} />
    </View>
  );
}
