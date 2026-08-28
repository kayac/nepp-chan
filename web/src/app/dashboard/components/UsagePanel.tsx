import { CostSection } from "./analytics/CostSection";
import { UsageSection } from "./analytics/UsageSection";

export const UsagePanel = () => {
  return (
    <div className="space-y-6">
      <CostSection />
      <UsageSection />
    </div>
  );
};
