"use client";

import { Suspense } from "react";
import { OnboardingWizard } from "@/components/vault/onboarding/OnboardingWizard";

export default function VaultOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}
