import { render, userEvent, waitFor } from "@testing-library/react-native";

import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import SpeechToTextButton from "./SpeechToTextButton";

type Listener = (event: { results: { transcript?: string }[] }) => void;

const speechListeners = (): Map<string, (payload: unknown) => void> =>
  ((globalThis as unknown as Record<string, unknown>).__speechListeners as
    Map<string, (payload: unknown) => void> | undefined) ?? new Map();

describe("SpeechToTextButton", () => {
  const onResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    speechListeners().clear();
  });

  it("renders the mic button with the accessibility label", async () => {
    const { getByLabelText } = await render(
      <SpeechToTextButton
        onResult={onResult}
        color="#666"
        activeColor="#123456"
        label="Voice input"
      />,
    );

    expect(getByLabelText("Voice input")).toBeOnTheScreen();
  });

  it("starts recognition after permission is granted", async () => {
    const { getByLabelText } = await render(
      <SpeechToTextButton
        onResult={onResult}
        color="#666"
        activeColor="#123456"
        label="Voice input"
      />,
    );
    const user = userEvent.setup();

    await user.press(getByLabelText("Voice input"));

    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    expect(ExpoSpeechRecognitionModule.isRecognitionAvailable).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "en-US" }),
    );
  });

  it("does not start when permission is denied", async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce(false);
    const { getByLabelText, getByText } = await render(
      <SpeechToTextButton
        onResult={onResult}
        color="#666"
        activeColor="#123456"
        label="Voice input"
      />,
    );
    const user = userEvent.setup();

    await user.press(getByLabelText("Voice input"));

    await waitFor(() => expect(getByText(/Microphone permission is required/)).toBeOnTheScreen());
    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  });

  it("delivers the transcript through onResult when the result event fires", async () => {
    const { getByLabelText } = await render(
      <SpeechToTextButton
        onResult={onResult}
        color="#666"
        activeColor="#123456"
        label="Voice input"
      />,
    );
    const user = userEvent.setup();

    await user.press(getByLabelText("Voice input"));

    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());

    (speechListeners().get("result") as unknown as Listener)({
      results: [{ transcript: "Senior React Native Engineer" }],
    });

    expect(onResult).toHaveBeenCalledWith("Senior React Native Engineer");
  });
});
