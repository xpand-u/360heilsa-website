import OnboardingClient from "./OnboardingClient";

export const metadata = { title: "Coach Franklin" };

export default function OnboardingPage() {
  return (
    <div style={{ background: "#0c0c0b", minHeight: "100vh" }}>
      <OnboardingClient />
    </div>
  );
}
