import { render, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "@/lib/theme";
import {
  ApiError,
  type BenefitsComparisonResponse,
  type NegotiationResponse,
} from "@/services/contract";

import SalaryNegotiatorScreen from "./SalaryNegotiatorScreen";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <SalaryNegotiatorScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const mockGetSalaryRange = jest.fn();
const mockGetBenefitsComparison = jest.fn();
const mockHandleUnauthorized = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual("react");
    React.useEffect(callback, [callback]);
  },
}));

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    status: "guest",
    session: null,
    guestId: "guest-1",
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    getSalaryRange: (...args: unknown[]) => mockGetSalaryRange(...args),
    getBenefitsComparison: (...args: unknown[]) => mockGetBenefitsComparison(...args),
  })),
}));

const salary: NegotiationResponse = {
  salary_range: {
    role: "Software Engineer",
    location: "Bangalore",
    min_salary: 850000,
    max_salary: 1500000,
    median_salary: 1150000,
    confidence: 0.85,
    currency: "INR",
    experience_level: "mid",
  },
  script: {
    opening: "Thank you for extending the offer.",
    justification_points: [
      "Based on current market signals for mid-level software engineers in Bangalore.",
    ],
    handling_objections: ["If rigid band limits are mentioned: I understand."],
    closing: "I am ready to sign the offer.",
  },
  generated_at: "2026-08-29T00:00:00+00:00",
};

const benefits: BenefitsComparisonResponse = {
  benefits: [
    {
      item: "Health Insurance",
      typical: "Group health cover for employee + family",
      negotiable: true,
    },
    { item: "Stock Options", typical: "ESOPs with 4-year vesting", negotiable: false },
  ],
  generated_at: "2026-08-29T00:00:00+00:00",
};

describe("SalaryNegotiatorScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSalaryRange.mockResolvedValue(salary);
    mockGetBenefitsComparison.mockResolvedValue(benefits);
  });

  it("renders the input form", async () => {
    const { getByText } = await renderScreen();

    expect(getByText("Know your worth")).toBeOnTheScreen();
    expect(getByText("Target role")).toBeOnTheScreen();
    expect(getByText("Location")).toBeOnTheScreen();
    expect(getByText("Years of experience")).toBeOnTheScreen();
    expect(getByText("Get salary range")).toBeOnTheScreen();
    expect(getByText("Enter your details to get salary data.")).toBeOnTheScreen();
  });

  it("submits and renders salary range, script and benefits with negotiable badge", async () => {
    const user = userEvent.setup();
    const { getByText, getByLabelText } = await renderScreen();

    await user.type(getByLabelText("Target role"), "Software Engineer");
    await user.type(getByLabelText("Location"), "Bangalore");
    await user.type(getByLabelText("Key skills (comma-separated)"), "React, Python");
    await user.type(getByLabelText("Company (optional)"), "TCS");
    await user.press(getByLabelText("5 years"));
    await user.press(getByLabelText("Get salary range"));

    await waitFor(() => expect(mockGetSalaryRange).toHaveBeenCalled());

    await waitFor(() => expect(getByText("₹8.5L")).toBeOnTheScreen());
    expect(getByText("₹11.5L")).toBeOnTheScreen();
    expect(getByText("₹15L")).toBeOnTheScreen();
    expect(getByText("85%")).toBeOnTheScreen();

    expect(getByText("Thank you for extending the offer.")).toBeOnTheScreen();
    expect(getByText("Health Insurance")).toBeOnTheScreen();
    expect(getByText("Negotiable")).toBeOnTheScreen();
    expect(getByText("Stock Options")).toBeOnTheScreen();

    expect(mockGetSalaryRange).toHaveBeenCalledWith(
      undefined,
      {
        role: "Software Engineer",
        location: "Bangalore",
        experience_years: 5,
        skills: ["React", "Python"],
        company: "TCS",
      },
      "guest-1",
    );
    expect(mockGetBenefitsComparison).toHaveBeenCalledWith(
      undefined,
      {
        role: "Software Engineer",
        location: "Bangalore",
        experience_years: 5,
        skills: ["React", "Python"],
        company: "TCS",
      },
      "guest-1",
    );
  });

  it("shows the error state on failure", async () => {
    mockGetSalaryRange.mockRejectedValue(new ApiError(502, "Market data unavailable", "upstream"));
    mockGetBenefitsComparison.mockRejectedValue(
      new ApiError(502, "Market data unavailable", "upstream"),
    );

    const user = userEvent.setup();
    const { getByText, getByLabelText } = await renderScreen();

    await user.type(getByLabelText("Target role"), "Software Engineer");
    await user.type(getByLabelText("Location"), "Bangalore");
    await user.press(getByLabelText("Get salary range"));

    await waitFor(() => expect(getByText("Market data unavailable")).toBeOnTheScreen());
  });
});
