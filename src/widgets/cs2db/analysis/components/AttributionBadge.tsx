import { ExternalLink } from "../../../../shared/ExternalLink";

export function AttributionBadge() {
  return (
    <div className="analysis__attribution">
      <ExternalLink href="https://leetify.com">Data Provided by Leetify</ExternalLink>
      <span> · not affiliated with or endorsed by Leetify</span>
    </div>
  );
}
