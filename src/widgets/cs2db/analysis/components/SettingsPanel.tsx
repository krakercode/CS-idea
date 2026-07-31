import { useEffect, useState } from "react";
import { ExternalLink } from "../../../../shared/ExternalLink";
import { validateApiKey } from "../analysisService";

interface Props {
  apiKey: string;
  onSave: (apiKey: string) => void;
}

export function SettingsPanel({ apiKey, onSave }: Props) {
  const [value, setValue] = useState(apiKey);
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "error">("idle");

  // apiKey loads asynchronously from the settings store after this panel's
  // first render (it starts as "" until that resolves), so the input needs
  // to pick up the loaded value instead of only using useState's initial one.
  useEffect(() => {
    setValue(apiKey);
  }, [apiKey]);

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
    <div className="analysis__settings">
      <label htmlFor="leetify-api-key">Leetify API key</label>
      <p className="analysis__muted">
        Optional but recommended — get one at{" "}
        <ExternalLink href="https://leetify.com/app/developer">leetify.com/app/developer</ExternalLink>
        . Without a key, requests use stricter rate limits.
      </p>
      <div className="analysis__search-row">
        <input
          id="leetify-api-key"
          type="password"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="Paste your API key"
        />
        <button type="button" onClick={save}>
          Save
        </button>
      </div>
      {status === "checking" && <p className="analysis__muted">Validating…</p>}
      {status === "valid" && <p className="analysis__status-ok">Key looks valid.</p>}
      {status === "invalid" && <p className="analysis__status-error">Leetify rejected this key.</p>}
      {status === "error" && <p className="analysis__status-error">Couldn't validate the key right now.</p>}
    </div>
  );
}
