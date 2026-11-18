"use client";

import { useEffect, useState } from "react";
import { ClientMeetingNotesEditor } from "@/components/ops/ClientMeetingNotesEditor";
import { clientPortalPath } from "@/lib/client-slug";

type ClientOption = {
  id: string;
  name: string;
  slug: string | null;
  publicPortalEnabled: boolean;
  contacts: { name: string }[];
};

export function MeetingNotesPageClient({ initialClientId = "" }: { initialClientId?: string }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(initialClientId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/ops/clients")
      .then((response) => response.json())
      .then((payload: { clients?: ClientOption[]; error?: string }) => {
        const rows = payload.clients ?? [];
        setClients(rows);
        setClientId((current) => {
          if (current && rows.some((client) => client.id === current)) return current;
          return rows[0]?.id ?? "";
        });
        if (!payload.clients) setError(payload.error || "Could not load clients.");
      })
      .catch(() => setError("Could not load clients."))
      .finally(() => setLoading(false));
  }, []);

  const selected = clients.find((client) => client.id === clientId) ?? null;

  return (
    <div className="max-w-3xl space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <label className="block text-xs text-slate-400">
        Client
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          disabled={loading || clients.length === 0}
          className="select-console mt-1 block w-full max-w-md rounded-md px-3 py-2 text-sm"
        >
          {clients.length === 0 ? <option value="">No clients yet</option> : null}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <>
          <p className="text-xs text-slate-500">
            {selected.publicPortalEnabled && selected.slug ? (
              <>
                Clients see these on their portal under Meeting Notes.{" "}
                <a
                  href={clientPortalPath(selected.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 hover:text-brand-200"
                >
                  Open portal
                </a>
              </>
            ) : (
              "Turn on this client’s public portal before they can see these notes."
            )}
          </p>
          <ClientMeetingNotesEditor
            key={selected.id}
            clientId={selected.id}
            contacts={selected.contacts}
          />
        </>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading clients…</p>
      ) : null}
    </div>
  );
}
