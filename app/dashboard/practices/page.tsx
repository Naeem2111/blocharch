import { PracticesClient } from "./PracticesClient";

export default function PracticesPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">Practices</h1>
      <p className="text-slate-400 text-sm mb-8">
        Search and browse architect practices from the directory.
      </p>
      <PracticesClient />
    </div>
  );
}
