import { detectDate } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { thoughtFirstLine, type BrainMirrorResult } from "@/lib/brainMirror";
import type { ThoughtCategory } from "@/lib/ruleEngine";

function birthdaySubject(text: string): string | null {
  const m = text.match(/([^\s,·]{1,10})\s*생일/u);
  if (!m) return null;
  const raw = m[1].trim().replace(/(인데|이고|이며|하고|인데요)$/u, "");
  if (!raw) return null;
  return `${raw} 생일`;
}

function preparationSubject(text: string): string | null {
  const line = thoughtFirstLine(text);
  const m = line.match(/^(.{2,18}?)(?:을|를|이|가)?\s*(?:사|예약|준비|챙기|기억|해야|하려)/u);
  if (m?.[1]) return m[1].trim();
  const trimmed = line.replace(/[.!?…]+$/u, "").trim();
  if (trimmed.length >= 2 && trimmed.length <= 22) return trimmed;
  return null;
}

function sentenceEndsCalmly(s: string): boolean {
  return /(?:같아요|있어요|느껴져요|마음이에요|같습니다|있습니다)\.?$/u.test(
    s.trim(),
  );
}

function fromMirrorResult(
  text: string,
  mirror: BrainMirrorResult,
  lang: "ko" | "en",
): string | null {
  const action = mirror.suggestedAction?.trim();
  if (action && sentenceEndsCalmly(action)) return action;

  const title = mirror.title?.trim();
  if (!title || title.length < 3) return null;

  if (lang === "en") {
    if (sentenceEndsCalmly(title)) return title;
    if (/birthday/i.test(text) || /birthday/i.test(title)) {
      const sub = birthdaySubject(text);
      return sub
        ? `Sounds like you're getting ready for ${sub.replace("생일", "'s birthday")}.`
        : "Sounds like you're thinking about a birthday.";
    }
    return `Sounds like ${title.charAt(0).toLowerCase()}${title.slice(1)}.`;
  }

  if (sentenceEndsCalmly(title)) return title;
  if (/생일/.test(text) || title.includes("생일")) {
    const sub = birthdaySubject(text);
    if (sub) return `${sub}을 준비하려는 생각 같아요.`;
  }
  if (title.length <= 28) return `${title}에 대한 생각 같아요.`;
  return null;
}

function byCategory(
  text: string,
  category: ThoughtCategory,
  lang: "ko" | "en",
  dateLabel?: string,
): string {
  const sub = preparationSubject(text);

  if (lang === "en") {
    switch (category) {
      case "shopping":
        return "Sounds like groceries or things to pick up are on your mind.";
      case "reminder":
        return dateLabel
          ? `Feels like something you don't want to forget for ${dateLabel}.`
          : "Feels like something you don't want to forget.";
      case "schedule":
        if (/birthday/i.test(text)) {
          const b = birthdaySubject(text);
          return b
            ? `Sounds like you're getting ready for ${b.replace("생일", "'s birthday")}.`
            : "Sounds like you're planning something for a special day.";
        }
        return sub
          ? `Sounds like you're thinking about ${sub}.`
          : "Sounds like a moment in time you're holding onto.";
      case "link":
        return "Sounds like a link you want to come back to later.";
      case "idea":
        return sub
          ? `An idea about ${sub} seems to be forming.`
          : "An idea seems to be taking shape.";
      case "task":
        return sub
          ? `Sounds like you want to ${sub.toLowerCase()}.`
          : "Sounds like something you mean to do.";
      case "list":
        return "A few things seem bundled together in this thought.";
      case "place":
        return "Sounds like a place you're keeping in mind.";
      default:
        return "A thought you wanted to set down for a moment.";
    }
  }

  switch (category) {
    case "shopping":
      return "장볼 것들을 떠올리고 있어요.";
    case "reminder":
      return dateLabel
        ? `${dateLabel}을 잊지 말아야 할 마음인 것 같아요.`
        : "잊지 말아야 할 마음인 것 같아요.";
    case "schedule":
      if (/생일/.test(text)) {
        const b = birthdaySubject(text);
        if (b) return `${b}을 준비하려는 생각 같아요.`;
        return "특별한 날을 챙기려는 생각 같아요.";
      }
      if (dateLabel) return `${dateLabel}을 염두에 두고 있는 것 같아요.`;
      return sub
        ? `${sub}하려는 생각 같아요.`
        : "그때를 마음에 두고 있는 것 같아요.";
    case "link":
      return "나중에 다시 보려는 링크 같아요.";
    case "idea":
      return sub ? `${sub}에 대한 생각이 떠오른 것 같아요.` : "머릿속에 맴도는 생각 같아요.";
    case "task":
      return sub ? `${sub}하려는 생각 같아요.` : "해두려는 마음인 것 같아요.";
    case "list":
      return "몇 가지가 한꺼번에 떠오른 것 같아요.";
    case "place":
      return "가보고 싶은 곳이 떠오른 것 같아요.";
    default:
      return "마음에 남긴 생각 같아요.";
  }
}

/** One calm sentence — not a summary, not bullets. */
export function buildCalmInterpretation(
  text: string,
  lang: "ko" | "en",
  mirror?: BrainMirrorResult | null,
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return lang === "en"
      ? "Something you wanted to hold for a moment."
      : "잠깐 마음에 둔 생각 같아요.";
  }

  if (mirror) {
    const fromMirror = fromMirrorResult(trimmed, mirror, lang);
    if (fromMirror) return fromMirror;
  }

  const dateHit = detectDate(trimmed);
  const resolution = classifyLocally(trimmed);
  const category = resolution?.category ?? "note";
  return byCategory(trimmed, category, lang, dateHit?.label);
}
