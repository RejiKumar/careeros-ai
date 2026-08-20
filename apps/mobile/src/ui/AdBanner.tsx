import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  useForeground,
} from "react-native-google-mobile-ads";

const bannerUnitId = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID || TestIds.BANNER,
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS || TestIds.BANNER,
}) ?? TestIds.BANNER;

interface AdBannerProps {
  size?: BannerAdSize;
  style?: object;
}

export default function AdBanner({ size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER, style }: AdBannerProps) {
  const bannerRef = useRef<BannerAd>(null);
  const [loaded, setLoaded] = useState(false);

  useForeground(() => bannerRef.current?.load());

  return (
    <View style={[{ alignItems: "center", opacity: loaded ? 1 : 0, minHeight: loaded ? undefined : 0 }, style]}>
      <BannerAd
        ref={bannerRef}
        unitId={bannerUnitId}
        size={size}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}
