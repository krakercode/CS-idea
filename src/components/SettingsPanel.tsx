import { useState } from "react";
import { validateApiKey } from "../lib/leetify";

interface Props {
  apiKey: string;
  onSave: (apiKey: string) => void;
}

export function SettingsPanel({ apiKey, onSave }: Props) {
  const [value, setValue] = useState(apiKey);
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "error">(
    "idle",
  );

  async function save() {
    onSave(value.trim());
    if (!value.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    try {
      const ok = await validateApiKey(value.trim());
      setStatus(ok ? "valid" : "invalid");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="settings-panel">
      <label htmlFor="api-key">Leetify API key</label>
      <p className="muted">
        Optional but recommended — get one at{" "}
        <a href="https://leetify.com/app/developer" target="_blank" rel="noreferrer">
          leetify.com/app/developer
        </a>
        . Without a key, requests use stricter rate limits.
      </p>
      <div className="row">
        <input
          id="api-key"
          type="password"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="Paste your API key"
        />
        <button onClick={save}>Save</button>
      </div>
      {status === "checking" && <p className="muted">Validating…</p>}
      {status === "valid" && <p className="status-ok">Key looks valid.</p>}
      {status === "invalid" && <p className="status-error">Leetify rejected this key.</p>}
      {status === "error" && <p className="status-error">Couldn't validate the key right now.</p>}
    </div>
  );
}
