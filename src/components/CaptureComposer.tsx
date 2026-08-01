import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import {
  ArrowUp,
  Image as ImageIcon,
  Mic,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ScribbleCanvas } from "./ScribbleCanvas";
import { useLang, useT } from "@/lib/i18n";
import {
  compressDataUrl,
  compressImageFile,
  MAX_IMAGES,
} from "@/lib/imageCompress";
import { FEATURES } from "@/lib/features";
import { confirm, light, tap } from "@/lib/haptics";
import { SPRING_MICRO } from "@/lib/motion";
import { appendFinalSpeech } from "@/lib/speechInput";
import {
  clearComposerDraft,
  readComposerDraft,
  writeComposerDraft,
} from "@/lib/composerDraft";
import { track } from "@/lib/analytics";

type Props = {
  onAdd: (
    text: string,
    images: string[],
    source?: "text" | "voice",
  ) => void | Promise<void>;
  onPasteMulti: (chunks: string[], original: string) => void;
  restoreText?: string | null;
  onRestoreConsumed?: () => void;
  hero?: boolean;
  releasing?: boolean;
  onActivityChange?: (active: boolean) => void;
  composer?: boolean;
  exampleChips?: { ko: string; en: string }[];
};

export function CaptureComposer({
  onAdd,
  onPasteMulti,
  restoreText,
  onRestoreConsumed,
  hero = false,
  composer = false,
  releasing = false,
  onActivityChange,
  exampleChips,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [committedText, setCommittedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scribbleOpen, setScribbleOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const firstToolRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechFinalIndexRef = useRef(0);
  const composingRef = useRef(false);
  const submittingRef = useRef(false);
  const submitQueueRef = useRef(Promise.resolve());
  const textRef = useRef("");
  const imagesRef = useRef(images);
  const onAddRef = useRef(onAdd);
  const sourceRef = useRef<"text" | "voice">("text");

  const text = interimText
    ? `${committedText}${committedText ? " " : ""}${interimText} […]`
    : committedText;
  const hasContent = text.trim().length > 0 || images.length > 0;

  textRef.current = text;
  imagesRef.current = images;
  onAddRef.current = onAdd;

  useEffect(() => {
    onActivityChange?.(focused || hasContent);
  }, [focused, hasContent, onActivityChange]);

  useEffect(() => {
    const draft = readComposerDraft();
    if (draft) setCommittedText(draft);
    if (hero) textareaRef.current?.focus();
  }, [hero]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeComposerDraft(committedText);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [committedText]);

  useEffect(() => {
    if (!restoreText) return;
    setCommittedText(restoreText);
    setInterimText("");
    textRef.current = restoreText;
    onRestoreConsumed?.();
    textareaRef.current?.focus();
  }, [restoreText, onRestoreConsumed]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setToolsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setToolsOpen(false);
      textareaRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => firstToolRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toolsOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const setUserText = (value: string) => {
    setCommittedText(value);
    setInterimText("");
    sourceRef.current = "text";
    speechFinalIndexRef.current = 0;
    textRef.current = value;
  };

  const reset = () => {
    setCommittedText("");
    setInterimText("");
    setImages([]);
    setToolsOpen(false);
    textRef.current = "";
    imagesRef.current = [];
    sourceRef.current = "text";
    speechFinalIndexRef.current = 0;
    clearComposerDraft();
  };

  const addImage = async (dataUrl: string) => {
    if (imagesRef.current.length >= MAX_IMAGES) {
      toast(t(`이미지는 ${MAX_IMAGES}장까지`, `Up to ${MAX_IMAGES} images`));
      return;
    }
    try {
      const compressed = await compressDataUrl(dataUrl);
      setImages((current) => [...current, compressed]);
      light();
    } catch {
      toast.error(t("사진을 불러오지 못했어요", "Couldn't load that photo"));
    }
  };

  const submit = (snapshot?: string) => {
    const currentText = (
      snapshot ??
      textareaRef.current?.value.replace(/\s*\[…\]\s*$/, "") ??
      committedText
    ).trim();
    const currentImages = [...imagesRef.current];

    if (!currentText && currentImages.length === 0) {
      light();
      textareaRef.current?.focus();
      return;
    }

    const backup = { text: currentText, images: currentImages };
    const source = sourceRef.current;
    confirm();

    submitQueueRef.current = submitQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        reset();
        try {
          await onAddRef.current(backup.text, backup.images, source);
        } catch {
          setCommittedText(backup.text);
          setImages(backup.images);
          textRef.current = backup.text;
          imagesRef.current = backup.images;
          track("thought_create_failed", { text_length: backup.text.length });
          toast.error(
            t(
              "저장하지 못했어요. 입력한 내용은 그대로 남겨뒀어요.",
              "Couldn't save it. Your input is still here.",
            ),
          );
          textareaRef.current?.focus();
        } finally {
          submittingRef.current = false;
        }
      });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const onMic = () => {
    const SpeechRecognitionConstructor =
      window.SpeechRecognition ??
      (
        window as Window & {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      toast.error(
        t(
          "이 브라우저에서는 음성 입력을 지원하지 않아요.",
          "Voice input isn't available in this browser.",
        ),
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setInterimText("");
      setListening(false);
      tap();
      return;
    }

    tap();
    track("voice_started");
    speechFinalIndexRef.current = 0;
    setInterimText("");
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = lang === "en" ? "en-US" : "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let nextInterim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = String(result[0].transcript).trim();
        if (!transcript) continue;
        if (result.isFinal) {
          if (index >= speechFinalIndexRef.current) {
            sourceRef.current = "voice";
            setCommittedText((current) => appendFinalSpeech(current, transcript));
            speechFinalIndexRef.current = index + 1;
          }
        } else if (index === event.results.length - 1) {
          nextInterim = transcript;
        }
      }
      setInterimText(nextInterim);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setInterimText("");
      setListening(false);
      track("voice_failed", { code: String(event.error ?? "unknown") });
      if (event.error === "not-allowed") {
        toast.error(
          t(
            "마이크 권한을 허용하면 음성으로 입력할 수 있어요.",
            "Allow microphone access to capture by voice.",
          ),
        );
      } else {
        toast.error(t("음성을 인식하지 못했어요.", "Couldn't recognize that speech."));
      }
    };
    recognition.onend = () => {
      setInterimText("");
      setListening(false);
      recognitionRef.current = null;
      track("voice_completed");
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (imagesRef.current.length >= MAX_IMAGES) {
        toast(t(`이미지는 ${MAX_IMAGES}장까지`, `Up to ${MAX_IMAGES} images`));
        break;
      }
      try {
        const compressed = await compressImageFile(file);
        setImages((current) => [...current, compressed]);
        light();
      } catch {
        toast.error(t("사진을 불러오지 못했어요", "Couldn't load that photo"));
      }
    }
    event.target.value = "";
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    for (const item of Array.from(event.clipboardData?.items ?? [])) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => void addImage(String(reader.result));
      reader.readAsDataURL(file);
    }

    const pasted = event.clipboardData?.getData("text") ?? "";
    if (!pasted) return;
    const lines = pasted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const startsAsList = /^[-•*·\u25AA]\s/.test(lines[0] ?? "");
    if (FEATURES.PASTE_SPLIT && (lines.length >= 3 || startsAsList)) {
      event.preventDefault();
      onPasteMulti(lines, pasted);
    }
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={false}
      animate={{ opacity: releasing ? 0 : 1, y: releasing ? -3 : 0 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      style={{ pointerEvents: releasing ? "none" : undefined }}
      className={`composer-hero pb-[env(safe-area-inset-bottom)] ${
        composer
          ? ""
          : "border-t border-ink/8 bg-white/98 shadow-[0_-2px_16px_-6px_rgba(0,0,0,0.06)] backdrop-blur-xl"
      }`}
      aria-label={t("일정과 할 일 입력", "Schedule and task capture")}
    >
      {exampleChips && exampleChips.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 px-4 ${composer ? "pb-1.5 pt-2" : "pt-3"}`}>
          {exampleChips.map((chip) => {
            const label = lang === "en" ? chip.en : chip.ko;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  tap();
                  setUserText(label);
                  textareaRef.current?.focus();
                }}
                className="touch-press min-h-11 rounded-full border border-ink/10 bg-ink/[0.035] px-3 py-2 text-[11px] font-semibold text-ink-soft"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {images.length > 0 && (
        <motion.div
          layout
          className="flex gap-2 overflow-x-auto px-4 pt-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          {images.map((source, index) => (
            <motion.div
              key={`${source.slice(0, 24)}-${index}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative shrink-0"
            >
              <img
                src={source}
                alt={t(`첨부 이미지 ${index + 1}`, `Attached image ${index + 1}`)}
                className="h-[4.5rem] w-[4.5rem] rounded-[15px] object-cover shadow-card ring-1 ring-ink/8"
              />
              <button
                type="button"
                onClick={() => {
                  tap();
                  setImages((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  );
                }}
                className="absolute -right-1.5 -top-1.5 grid h-7 min-h-7 w-7 min-w-7 place-items-center rounded-full bg-ink text-white shadow-float"
                aria-label={t("이미지 제거", "Remove image")}
              >
                <X size={13} aria-hidden />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className={`px-4 ${composer ? "pb-0.5 pt-0.5" : hero ? "mt-3" : "mt-2"}`}>
        <motion.div
          layout
          transition={SPRING_MICRO}
          className={`input-shell input-focus-ring px-3 ${focused ? "input-shell-focused" : ""} ${
            composer ? "py-1.5" : hero ? "py-4 ring-1 ring-ink/5" : "py-3"
          }`}
        >
          <textarea
            id="capture-input"
            ref={textareaRef}
            value={text}
            onChange={(event) => setUserText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onPaste={onPaste}
            onKeyDown={(event) => {
              const composing = composingRef.current || event.nativeEvent.isComposing;
              if (event.key !== "Enter" || composing) return;
              if (event.shiftKey) return;
              event.preventDefault();
              submit(event.currentTarget.value);
            }}
            rows={composer ? 1 : hero ? 4 : 3}
            placeholder={t(
              "일정이나 할 일을 말하듯 남겨보세요",
              "Say a plan or task naturally",
            )}
            className={`block w-full resize-none bg-transparent leading-relaxed text-ink placeholder:text-ink-soft/55 focus:outline-none ${
              composer
                ? "min-h-[26px] max-h-28 text-[16px]"
                : hero
                  ? "min-h-[96px] max-h-40 text-[17px]"
                  : "min-h-[72px] max-h-40 text-[16px]"
            }`}
          />
        </motion.div>
      </div>

      <div className={`flex min-h-[50px] items-center gap-1 ${composer ? "px-3 pb-1.5" : "px-5 pb-2 pt-2"}`}>
        <div ref={toolsRef} className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              tap();
              setToolsOpen((current) => !current);
            }}
            aria-label={t("첨부 도구", "Attachment tools")}
            aria-haspopup="menu"
            aria-expanded={toolsOpen}
            className={`touch-target rounded-full transition-colors ${
              toolsOpen ? "bg-ink text-white" : "text-ink-soft hover:bg-ink/[0.055]"
            }`}
          >
            <Plus
              size={18}
              className={`transition-transform ${toolsOpen ? "rotate-45" : ""}`}
              aria-hidden
            />
          </motion.button>

          <AnimatePresence>
            {toolsOpen && (
              <motion.div
                role="menu"
                aria-label={t("첨부 도구", "Attachment tools")}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                className="absolute bottom-[calc(100%+8px)] left-0 z-50 min-w-[176px] overflow-hidden rounded-[18px] border border-ink/10 bg-white/96 p-1.5 shadow-float backdrop-blur-2xl"
              >
                <button
                  ref={firstToolRef}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    tap();
                    setToolsOpen(false);
                    fileRef.current?.click();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[13px] px-3 text-left text-[13px] font-semibold text-ink hover:bg-ink/[0.05]"
                >
                  <ImageIcon size={17} className="text-ink-soft" aria-hidden />
                  {t("사진 첨부", "Attach photo")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    tap();
                    setToolsOpen(false);
                    setScribbleOpen(true);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[13px] px-3 text-left text-[13px] font-semibold text-ink hover:bg-ink/[0.05]"
                >
                  <Pencil size={17} className="text-ink-soft" aria-hidden />
                  {t("손글씨·낙서", "Scribble")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFile}
          className="hidden"
        />

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={onMic}
          className={`touch-target rounded-full transition-colors ${
            listening
              ? "bg-red-500 text-white shadow-float"
              : "text-ink-soft hover:bg-ink/[0.055]"
          }`}
          aria-label={
            listening
              ? t("음성 입력 중지", "Stop voice input")
              : t("음성 입력", "Voice input")
          }
          aria-pressed={listening}
        >
          <Mic size={18} className={listening ? "animate-pulse" : ""} aria-hidden />
        </motion.button>

        <span className="hidden pl-1 text-[10px] font-medium text-ink-soft/55 sm:inline">
          {t("Enter로 남기기 · Shift+Enter 줄바꿈", "Enter to capture · Shift+Enter for a new line")}
        </span>

        <div className="flex-1" />

        <motion.button
          type="submit"
          layout
          whileTap={{ scale: 0.96 }}
          transition={SPRING_MICRO}
          disabled={submittingRef.current || !hasContent}
          data-testid="capture-submit"
          className="capture-submit-button flex h-11 min-h-11 min-w-[6rem] items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-black text-ink shadow-card disabled:bg-ink/[0.08] disabled:text-ink-soft/55 disabled:shadow-none"
          aria-label={t("남기기", "Capture")}
        >
          <ArrowUp size={16} strokeWidth={2.8} aria-hidden />
          {t("남기기", "Capture")}
        </motion.button>
      </div>

      <ScribbleCanvas
        open={scribbleOpen}
        onClose={() => setScribbleOpen(false)}
        onDone={(dataUrl) => void addImage(dataUrl)}
      />
    </motion.form>
  );
}
