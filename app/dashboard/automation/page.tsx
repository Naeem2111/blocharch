import { AutomationClient } from "./AutomationClient";

export default function AutomationPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">Lead nurturing</h1>
      <p className="text-slate-400 text-sm mb-8">
        Update pipeline stages, rate firms, and activate email workflows from templates.
      </p>
      <AutomationClient />
    </div>
  );
}
