"use client";

"use client";

import { useCallback, useState } from "react";

export type BillingCycle = "monthly" | "yearly";

export const useBillingCycle = (initialCycle: BillingCycle = "monthly") => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const isYearly = billingCycle === "yearly";

  const toggleBillingCycle = useCallback(() => {
    setBillingCycle((current) =>
      current === "monthly" ? "yearly" : "monthly",
    );
  }, []);

  const getPrice = useCallback(
    (monthlyPrice: number, yearlyPrice: number) =>
      isYearly ? yearlyPrice : monthlyPrice,
    [isYearly],
  );

  return {
    billingCycle,
    isYearly,
    setBillingCycle,
    toggleBillingCycle,
    getPrice,
  };
};