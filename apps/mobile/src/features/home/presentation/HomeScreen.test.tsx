import { render } from "@testing-library/react-native";

import HomeScreen from "./HomeScreen";

describe("HomeScreen", () => {
  it("renders the app title and call to action", async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText("CareerOS AI")).toBeOnTheScreen();
    expect(getByText(/Import your resume to see a reviewable/)).toBeOnTheScreen();
  });
});
