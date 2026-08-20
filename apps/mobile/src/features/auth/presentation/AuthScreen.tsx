import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t } from "../../../i18n";
import AppBackground from "@/ui/AppBackground";
import BrandMark from "@/ui/BrandMark";
import GradientButton from "@/ui/GradientButton";

type Mode = "signIn" | "signUp";

export default function AuthScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { signIn, signUp, googleSignIn, signInAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const trimmedEmail = email.trim();
    if (trimmedEmail === "") {
      return t("auth.enterEmail");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return t("auth.invalidEmail");
    }
    if (password === "") {
      return t("auth.enterPassword");
    }
    if (password.length < 6) {
      return t("auth.shortPassword");
    }
    return null;
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    const validationError = validate();
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (googleSubmitting || submitting) {
      return;
    }
    setError(null);
    setGoogleSubmitting(true);
    try {
      await googleSignIn();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.googleError"));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGuestSignIn() {
    if (submitting || googleSubmitting) {
      return;
    }
    try {
      await signInAsGuest();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.guestError"));
    }
  }

  function switchMode(nextMode: Mode) {
    if (submitting) {
      return;
    }
    setMode(nextMode);
    setError(null);
  }

  const isSignIn = mode === "signIn";

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <BrandMark size={64} />
          <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>{t("auth.brand")}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isSignIn ? t("auth.signInTitle") : t("auth.signUpTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isSignIn
              ? t("auth.signInSubtitle")
              : t("auth.signUpSubtitle")}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("auth.googleButton")}
            onPress={() => void handleGoogleSignIn()}
            disabled={googleSubmitting || submitting}
            style={({ pressed }) => [
              styles.googleButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
              (googleSubmitting || submitting) && styles.disabled,
            ]}
          >
            {googleSubmitting ? (
              <ActivityIndicator color={colors.textPrimary} accessibilityLabel="Opening Google" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
                <Text style={[styles.googleButtonLabel, { color: colors.textPrimary }]}>
                  {t("auth.googleButton")}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow} accessibilityElementsHidden>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>
              {t("auth.dividerText")}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("auth.emailLabel")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              accessibilityLabel={t("auth.emailLabel")}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.textDisabled}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("auth.passwordLabel")}</Text>
            <View
              style={[
                styles.passwordWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                accessibilityLabel={t("auth.passwordLabel")}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={colors.textDisabled}
                style={[styles.passwordInput, { color: colors.textPrimary }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                accessibilityState={{ selected: passwordVisible }}
                onPress={() => setPasswordVisible((visible) => !visible)}
                hitSlop={8}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.primaryStrong}
                />
              </Pressable>
            </View>

            {error !== null && (
              <View
                style={[styles.errorBox, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.errorText, { color: colors.onDanger }]}>{error}</Text>
              </View>
            )}

            <GradientButton
              label={isSignIn ? t("auth.signInButton") : t("auth.signUpButton")}
              accessibilityLabel={isSignIn ? t("auth.signInButton") : t("auth.signUpButton")}
              onPress={() => void handleSubmit()}
              loading={submitting}
              icon={isSignIn ? "log-in-outline" : "person-add-outline"}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSignIn ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
              onPress={() => switchMode(isSignIn ? "signUp" : "signIn")}
              disabled={submitting}
              style={styles.switchButton}
            >
              <Text style={[styles.switchText, { color: colors.primaryStrong }]}>
                {isSignIn ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
              </Text>
            </Pressable>

            <View style={styles.dividerRow} accessibilityElementsHidden>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textDisabled }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("auth.guestButton")}
              onPress={() => void handleGuestSignIn()}
              disabled={submitting || googleSubmitting}
              style={({ pressed }) => [
                styles.guestButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
                (submitting || googleSubmitting) && styles.disabled,
              ]}
            >
              <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
              <Text style={[styles.guestButtonText, { color: colors.textPrimary }]}>
                {t("auth.guestButton")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingVertical: 48,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  googleButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 4,
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 12,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  errorBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  switchText: {
    fontSize: 14,
    fontWeight: "600",
  },
  guestButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
