import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  ScheduleChoiceFlow,
  type ScheduleConfirmOptions,
} from "./ScheduleChoiceFlow";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { readCachedTimingExtra } from "@/lib/brainMirrorApi";
import {
  detectDate,
  hasScheduleTimeIntent,
  resolveTimingSuggestion,
  type ResolvedTiming,
} from "@/lib/dateDetect";
import { useLang } from "@/lib/i18n";

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
  ) => void;
};

function defaultStart(item: InboxItem): Date {
  const det =
    detectDate(item.text) ??
    (item.brain_mirror?.suggestedDateText
      ? detectDate(item.brain_mirror.suggestedDateText)
      : null);
  if (det) return det.start;
  const d = new Date();
  d.setMinutes(0, 0, 0);
  if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
  else if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function FocusScheduleSheet({ item, open, onClose, onConfirm }: Props) {
  const [title, setTitle] = useState("");
  const [flowMode, setFlowMode] = useState<"suggested" | "manual">("manual");
  const { lang } = useLang();

  const aiSuggestion = useMemo((): ResolvedTiming | null => {
    if (!item || !open || !hasScheduleTimeIntent(item.text)) return null;
    const cacheExtra = readCachedTimingExtra(item.text);
    return resolveTimingSuggestion(
      item.text,
      item.brain_mirror,
      cacheExtra,
      lang === "en" ? "en" : "ko",
    );
  }, [item, lang, open]);

  const initialStart = useMemo(() => {
    if (!item) return undefined;
    return aiSuggestion?.start ?? defaultStart(item);
  }, [item, aiSuggestion]);

  useEffect(() => {
    if (!open || !item) return;
    setTitle(thoughtFirstLine(item.text));
    setFlowMode(
      aiSuggestion?.confidence === "high" ? "suggested" : "manual",
    );
  }, [open, item, aiSuggestion]);

  if (!item) return null;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="88vh">
      <ScheduleChoiceFlow
        open={open}
        title={title}
        onTitleChange={setTitle}
        thoughtText={item.text}
        initialStart={initialStart}
        suggestedStart={initialStart}
        flowMode={flowMode}
        onFlowModeChange={setFlowMode}
        aiSuggestion={aiSuggestion}
        onConfirm={(start, end, options) => {
          onConfirm(
            title.trim() || thoughtFirstLine(item.text),
            start,
            end,
            options,
          );
        }}
      />
    </BottomSheet>
  );
}
