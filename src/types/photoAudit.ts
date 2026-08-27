export type PhotoIssueType =
  | "blur"
  | "too_dark"
  | "overexposed"
  | "cropped_product"
  | "busy_background"
  | "low_detail"
  | "watermark"
  | "face"
  | "address"
  | "license_plate"
  | "personal_document"
  | "serial_number"
  | "other";

export type PhotoAuditItem = {
  photoIndex: number;
  qualityScore: number;
  coverScore: number;
  usable: boolean;
  issues: PhotoIssueType[];
  notes: string[];
  privacyRisks: string[];
  blockingPrivacyRisk: boolean;
};

export type PhotoAuditResult = {
  source: "ai" | "local_fallback" | "demo";
  privacyScanComplete: boolean;
  overallQualityScore: number;
  recommendedCoverIndex: number;
  hasBlockingPrivacyRisk: boolean;
  blockingIssues: string[];
  improvementTips: string[];
  photos: PhotoAuditItem[];
};
