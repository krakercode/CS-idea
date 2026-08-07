export interface SituationUpdate {
  id: string;
  title: string;
  url: string;
  /** Publisher domain (GDELT) or source organization name (ReliefWeb). */
  source: string;
  country: string | null;
  publishedAt: string;
  kind: "news" | "reliefweb";
}
