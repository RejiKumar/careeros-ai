import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";

let BannerAdComponent: React.ComponentType<{ size?: unknown }> | null = null;
let adAvailable = false;
let initPromise: Promise<void> | null = null;

export type AdBannerStatus = "idle" | "initializing" | "ready" | "unavailable";
let adStatus: AdBannerStatus = "idle";
export type AdStatusListener = (status: AdBannerStatus) => void;
const statusListeners = new Set<AdStatusListener>();

function setAdStatus(next: AdBannerStatus) {
  adStatus = next;
  statusListeners.forEach((listener) => listener(next));
}

export function onAdStatusChange(listener: AdStatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

const BANNER_IDS = {
  dev: {
    android: "ca-app-pub-3940256099942544/6300978111",
    ios: "ca-app-pub-3940256099942544/2934735716",
  },
  prod: {
    android: "ca-app-pub-3342123808291001/4771523057",
    ios: "ca-app-pub-3342123808291001/4771523057",
  },
} as const;

try {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mobileAds = require("react-native-google-mobile-ads").default;
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {
      BannerAd,
      BannerAdSize,
      TestIds,
      useForeground,
    } = require("react-native-google-mobile-ads");
    /* eslint-enable @typescript-eslint/no-require-imports */

    const appEnv = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as "dev" | "prod";
    const ids = BANNER_IDS[appEnv];

    const bannerUnitId =
      Platform.select({
        android: ids.android,
        ios: ids.ios,
      }) ?? TestIds.BANNER;

    function BannerInner({ size }: { size?: (typeof BannerAdSize)[keyof typeof BannerAdSize] }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bannerRef = React.useRef<any>(null);
      const [loaded, setLoaded] = useState(false);
      const [initState, setInitState] = useState<AdBannerStatus>(adStatus);

      useEffect(() => {
        return onAdStatusChange(setInitState);
      }, []);

      useForeground(() => {
        if (initState === "ready") {
          bannerRef.current?.load();
        }
      });

      useEffect(() => {
        if (initState !== "ready") {
          return;
        }
        const timer = setTimeout(() => {
          if (!loaded) {
            bannerRef.current?.load();
          }
        }, 0);
        return () => clearTimeout(timer);
      }, [initState, loaded]);

      if (initState === "unavailable") {
        console.warn("[AdMob] Banner not rendered: SDK unavailable");
        return null;
      }

      return (
        <View
          style={{
            alignItems: "center",
            opacity: loaded ? 1 : 0,
            minHeight: loaded ? undefined : 0,
          }}
        >
          <BannerAd
            ref={bannerRef}
            unitId={bannerUnitId}
            size={size ?? BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            onAdLoaded={() => {
              setLoaded(true);
              console.log("[AdMob] Banner loaded");
            }}
            onAdFailedToLoad={(e: { code: string; message: string }) => {
              console.warn("[AdMob] Banner failed:", e.code, e.message);
            }}
          />
        </View>
      );
    }

    BannerAdComponent = BannerInner;
    adAvailable = true;
    setAdStatus("initializing");

    initPromise = mobileAds()
      .initialize()
      .then(() => {
        console.log("[AdMob] SDK initialized successfully");
        setAdStatus("ready");
      })
      .catch((e: unknown) => {
        console.warn("[AdMob] SDK initialization failed:", e);
        adAvailable = false;
        setAdStatus("unavailable");
      });
  }
} catch (e) {
  console.warn("[AdMob] Module load failed:", e);
  adAvailable = false;
  setAdStatus("unavailable");
}

export function initAdMob(): Promise<void> {
  if (initPromise === null) {
    initPromise = Promise.reject(new Error("[AdMob] SDK module not loaded"));
    setAdStatus("unavailable");
  }
  return initPromise;
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
