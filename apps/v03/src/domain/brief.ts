export type InformationState = "present" | "not_mentioned" | "uncertain";
export type ReviewState = "unreviewed" | "confirmed" | "edited";
export type Group = "schedules" | "tasks" | "constraints";
export type ImageSource = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  url: string;
};
export type Source = { text: string; images: ImageSource[] };
export type Candidate = {
  id: string;
  group: Group;
  label: string;
  value: string;
  informationState: InformationState;
  reviewState: ReviewState;
  dueDate: string;
  originalValue: string;
  originalState: InformationState;
  origin: "mock";
};
export type Draft = { source: Source; candidates: Candidate[]; mode: "mock" };
export const STATES = {
  present: "값 있음",
  not_mentioned: "원문에 미기재",
  uncertain: "불명확 / 판독 불가",
};
export const REVIEWS = {
  unreviewed: "미확인",
  confirmed: "사용자 확인",
  edited: "사용자 수정",
};
export const SAMPLE =
  "브랜드 A 릴스 캠페인\n가편 전달 10월 20일, 업로드 10월 23일\nInstagram 릴스 영상과 자막 필수. 썸네일에 가격 표시 금지.\n최종 컨펌 후 게시, 업로드 후 30일 공개 유지.";
export const REQUIRED = [
  "draft_due",
  "publish_due",
  "film",
  "captions",
  "approval",
  "thumbnail",
  "platform",
  "retention",
  "usage_rights",
];
export function hasSource(source: Source) {
  return Boolean(source.text.trim() || source.images.length);
}
export function mockExtract(source: Source): Draft {
  if (!hasSource(source)) throw new Error("원본을 먼저 넣어주세요.");
  const values: [string, Group, string, string, InformationState][] = [
    [
      "draft_due",
      "schedules",
      "가편 전달",
      "10월 20일 · 연도 확인 필요",
      "present",
    ],
    [
      "publish_due",
      "schedules",
      "업로드 예정",
      "10월 23일 · 연도 확인 필요",
      "present",
    ],
    ["film", "tasks", "영상 제작", "릴스 영상 촬영·편집", "present"],
    ["captions", "tasks", "자막", "자막 넣기", "present"],
    ["approval", "tasks", "컨펌", "최종 컨펌 받기", "present"],
    [
      "thumbnail",
      "constraints",
      "금지 조건",
      "썸네일에 제품 가격 표시 금지",
      "present",
    ],
    ["platform", "constraints", "업로드 플랫폼", "Instagram · 릴스", "present"],
    [
      "retention",
      "constraints",
      "공개 유지",
      "업로드 후 30일 · 종료일 미확정",
      "present",
    ],
    [
      "usage_rights",
      "constraints",
      "Usage rights",
      "아직 확인하지 않음",
      "uncertain",
    ],
  ];
  return {
    mode: "mock",
    source: {
      text: source.text,
      images: source.images.map((image) => ({ ...image })),
    },
    candidates: values.map(([id, group, label, value, informationState]) => ({
      id,
      group,
      label,
      value,
      informationState,
      reviewState: "unreviewed",
      dueDate: "",
      originalValue: value,
      originalState: informationState,
      origin: "mock",
    })),
  };
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function candidateProblem(c: Candidate) {
  if (c.informationState === "present" && !c.value.trim())
    return "값을 입력해주세요.";
  if (
    c.group === "schedules" &&
    c.informationState === "present" &&
    !validDate(c.dueDate)
  )
    return "연도를 포함한 날짜를 선택하거나 불명확으로 남겨주세요.";
  return null;
}
export function editCandidate(
  d: Draft,
  id: string,
  patch: Partial<Pick<Candidate, "value" | "informationState" | "dueDate">>,
): Draft {
  return {
    ...d,
    candidates: d.candidates.map((c) =>
      c.id === id ? { ...c, ...patch, reviewState: "unreviewed" } : c,
    ),
  };
}
export function confirmCandidate(d: Draft, id: string): Draft {
  const c = d.candidates.find((c) => c.id === id);
  if (!c || candidateProblem(c)) throw new Error("후보를 먼저 검토해주세요.");
  const changed =
    c.value !== c.originalValue ||
    c.informationState !== c.originalState ||
    Boolean(c.dueDate);
  return {
    ...d,
    candidates: d.candidates.map((c) =>
      c.id === id ? { ...c, reviewState: changed ? "edited" : "confirmed" } : c,
    ),
  };
}
export function reviewComplete(d: Draft) {
  return (
    REQUIRED.every((id) => d.candidates.some((c) => c.id === id)) &&
    new Set(d.candidates.map((c) => c.id)).size === d.candidates.length &&
    d.candidates.every(
      (c) => c.reviewState !== "unreviewed" && !candidateProblem(c),
    )
  );
}
export const STATUS_LABELS = {
  discussion: "제안/협의",
  producing: "제작 중",
  draft_sent: "가편 전달",
  in_review: "컨펌 중",
  scheduled: "업로드 예정",
  completed: "완료",
  on_hold: "보류",
};
export type Status = keyof typeof STATUS_LABELS;
export function buildPayload(
  d: Draft,
  title: string,
  status: Status = "discussion",
) {
  if (
    !title.trim() ||
    title.length > 120 ||
    !reviewComplete(d) ||
    !(status in STATUS_LABELS)
  )
    throw new Error("협찬 이름과 모든 필수 후보를 검토해주세요.");
  const review = d.candidates.map((c) => ({
    candidate_id: c.id,
    group: c.group,
    label: c.label,
    information_state: c.informationState,
    review_state: c.reviewState,
    original_value: c.originalValue,
    original_information_state: c.originalState,
    value: c.informationState === "present" ? c.value.trim() : null,
    due_date:
      c.group === "schedules" && c.informationState === "present"
        ? c.dueDate
        : null,
    origin: "mock" as const,
    reviewed_origin: c.reviewState === "edited" ? "manual" : "mock",
    evidence: null,
  }));
  return {
    mode: "reviewed_mock" as const,
    collaboration: {
      title: title.trim(),
      status,
      contact_date: null,
      notes: null,
    },
    content: {
      platform:
        review.find((c) => c.candidate_id === "platform")?.value ?? null,
      content_url: null,
      ad_code: null,
      performance: null,
    },
    source: {
      raw_text: d.source.text,
      images: d.source.images.map(({ id, name, size, type }) => ({
        id,
        name,
        size,
        type,
      })),
    },
    review,
    tasks: review
      .filter(
        (c) =>
          (c.group === "schedules" || c.group === "tasks") &&
          c.information_state === "present",
      )
      .map((c) => ({
        candidate_id: c.candidate_id,
        type:
          c.candidate_id === "draft_due"
            ? "draft_delivery"
            : c.candidate_id === "publish_due"
              ? "publish"
              : "custom",
        title: c.group === "schedules" ? c.label : c.value,
        due_date: c.due_date,
      })),
    constraints: review
      .filter((c) => c.group === "constraints")
      .map((c) => ({
        type: c.candidate_id,
        value: c.value,
        information_state: c.information_state,
        review_state: c.review_state,
      })),
  };
}
export type CreationPayload = ReturnType<typeof buildPayload>;
export function imageError(file: Pick<File, "size" | "type">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "JPG, PNG, WebP 이미지를 선택해주세요.";
  if (file.size <= 0 || file.size > 10485760)
    return "한 장당 10MB 이하로 선택해주세요.";
  return null;
}
