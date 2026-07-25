import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { Mic, Image as ImageIcon, Plus, X, Pencil, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ScribbleCanvas } from "./ScribbleCanvas";
import { useT, useLang } from "@/lib/i18n";
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
  /** Restores pasted text when the split sheet is dismissed. */
  restoreText?: string | null;
  onRestoreConsumed?: () => void;
  /** Larger hero layout when inbox is empty */
  hero?: boolean;
  /** Input softly fades while a thought is releasing */
  releasing?: boolean;
  /** Fired when user is typing or input is focused (Capture idle → typing) */
  onActivityChange?: (active: boolean) => void;
  /** Bottom composer bar (messenger-style). */
  composer?: boolean;
  /** Tap-to-fill example chips — typically only when chat is empty. */
  exampleChips?: { ko: string; en: string }[];
};

export function InputBar({
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
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scribbleOpen, setScribbleOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef("");
  const imagesRef = useRef(images);
  const onAddRef = useRef(onAdd);
  const commandSnapshotRef = useRef("");
  const composingRef = useRef(false);
  const keySubmitRef = useRef(false);
  const buttonSubmitRef = useRef(false);
  const submittingRef = useRef(false);
  const submitQueueRef = useRef(Promise.resolve());
  const fileRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const speechFinalIndexRef = useRef(0);
  const captureSourceRef = useRef<"text" | "voice">("text");

  const text = interimText
    ? `${committedText}${committedText ? " " : ""}${interimText} […]`
    : committedText;

  textRef.current = text;
  imagesRef.current = images;
  onAddRef.current = onAdd;

  const hasContent = text.trim().length > 0 || images.length > 0;

  useEffect(() => {
    onActivityChange?.(focused || hasContent);
  }, [focused, hasContent, onActivityChange]);

  useEffect(() => {
    if (!hero) return;
    const draft = readComposerDraft();
    if (draft) setUserText(draft);
    textareaRef.current?.focus();
  }, [hero]);

  useEffect(() => {
    if (hero) return;
    const draft = readComposerDraft();
    if (draft && !committedText) setUserText(draft);
  }, [hero, committedText]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeComposerDraft(committedText);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [committedText]);

  useEffect(() => {
    return () => {
      recogRef.current?.stop();
      recogRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!restoreText) return;
    setCommittedText(restoreText);
    setInterimText("");
    textRef.current = restoreText;
    onRestoreConsumed?.();
    textareaRef.current?.focus();
  }, [restoreText, onRestoreConsumed]);

  const setUserText = (value: string) => {
    setCommittedText(value);
    setInterimText("");
    speechFinalIndexRef.current = 0;
    captureSourceRef.current = "text";
    textRef.current = value;
  };

  const addImage = async (dataUrl: string) => {
    if (imagesRef.current.length >= MAX_IMAGES) {
      toast(t(`이미지는 ${MAX_IMAGES}장까지`, `Up to ${MAX_IMAGES} images`));
      return;
    }
    try {
      const compressed = await compressDataUrl(dataUrl);
      setImages((p) => [...p, compressed]);
      light();
    } catch {
      toast.error(t("사진을 못 불러왔어요", "Couldn't bring that photo in"));
    }
  };

  const reset = () => {
    textRef.current = "";
    imagesRef.current = [];
    commandSnapshotRef.current = "";
    captureSourceRef.current = "text";
    setCommittedText("");
    setInterimText("");
    speechFinalIndexRef.current = 0;
    setImages([]);
    clearComposerDraft();
  };

  const clearInterimSpeech = () => {
    setInterimText("");
  };

  const primeCommandSubmit = (target: HTMLTextAreaElement) => {
    const snapshot = target.value;
    if (!snapshot.trim() && imagesRef.current.length === 0) return;
    commandSnapshotRef.current = snapshot;
  };

  const handleAdd = (textSnapshot?: string) => {
    const currentImages = [...imagesRef.current];
    const currentText =
      textSnapshot ??
      textareaRef.current?.value.replace(/\s*\[…\]\s*$/, "") ??
      committedText;
    const trimmedText = currentText.trim();
    if (!trimmedText && currentImages.length === 0) {
      light();
      textareaRef.current?.focus();
      return;
    }

    const textToAdd = trimmedText;
    const imagesToAdd = currentImages;
    confirm();

    submitQueueRef.current = submitQueueRef.current
      .catch(() => {})
      .then(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        const backup = { text: textToAdd, images: imagesToAdd };
        reset();
        try {
          await onAddRef.current(textToAdd, imagesToAdd, captureSourceRef.current);
        } catch {
          setCommittedText(backup.text);
          setInterimText("");
          setImages(backup.images);
          textRef.current = backup.text;
          imagesRef.current = backup.images;
          track("thought_create_failed", { text_length: backup.text.length });
          toast.error(
            t(
              "잠깐, 못 남겼어요. 적은 건 그대로예요",
              "Didn't stick — what you wrote is still here",
            ),
          );
          textareaRef.current?.focus();
        } finally {
          submittingRef.current = false;
        }
      });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleAdd();
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const textarea = textareaRef.current;
      if (!textarea || document.activeElement !== textarea) return;
      if (
        event.key !== "Enter" ||
        (!event.metaKey && !event.ctrlKey) ||
        composingRef.current ||
        event.isComposing
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      handleAdd(textarea.value);
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, []);

  const submitFromKeyboard = (target: HTMLTextAreaElement) => {
    if (keySubmitRef.current) return;
    keySubmitRef.current = true;
    handleAdd(target.value);
    window.setTimeout(() => {
      keySubmitRef.current = false;
    }, 0);
  };

  const submitCommandEnter = (target: HTMLTextAreaElement) => {
    if (keySubmitRef.current) return;
    keySubmitRef.current = true;
    const snapshot = commandSnapshotRef.current || target.value;
    const wasMetaSubmit = Boolean(commandSnapshotRef.current);
    if (wasMetaSubmit) {
      handleAdd(snapshot);
      window.setTimeout(() => {
        keySubmitRef.current = false;
      }, 0);
      return;
    }
    target.blur();
    window.setTimeout(() => {
      handleAdd(textareaRef.current?.value || snapshot);
      keySubmitRef.current = false;
    }, 0);
  };

  const onMic = () => {
    const SR =
      window.SpeechRecognition ??
      (
        window as Window & {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;
    if (!SR) {
      toast.error(
        t(
          "이 브라우저에선 말로는 못 남겨요",
          "Voice isn't available in this browser",
        ),
      );
      return;
    }
    if (listening) {
      clearInterimSpeech();
      recogRef.current?.stop();
      recogRef.current = null;
      setListening(false);
      tap();
      return;
    }
    tap();
    track("voice_started");
    speechFinalIndexRef.current = 0;
    clearInterimSpeech();
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      let nextInterim = "";
      for (let i = 0; i < e.results.length; i += 1) {
        const result = e.results[i];
        const transcript = (result[0].transcript as string).trim();
        if (!transcript) continue;
        if (result.isFinal) {
          if (i >= speechFinalIndexRef.current) {
            captureSourceRef.current = "voice";
            setCommittedText((prev) => appendFinalSpeech(prev, transcript));
            speechFinalIndexRef.current = i + 1;
          }
        } else if (i === e.results.length - 1) {
          nextInterim = transcript;
        }
      }
      setInterimText(nextInterim);
    };
    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearInterimSpeech();
      setListening(false);
      track("voice_failed", {
        code: "error" in event ? String(event.error) : "unknown",
      });
      if (event.error === "not-allowed") {
        toast.error(
          t(
            "마이크를 켜주면 말로 남길 수 있어요",
            "Turn on the mic and you can speak your thought",
          ),
        );
        return;
      }
      toast.error(t("목소리로 못 받았어요", "Couldn't catch that — try again?"));
    };
    r.onend = () => {
      clearInterimSpeech();
      setListening(false);
      recogRef.current = null;
      track("voice_completed");
    };
    r.start();
    recogRef.current = r;
    setListening(true);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      if (imagesRef.current.length >= MAX_IMAGES) {
        toast(t(`이미지는 ${MAX_IMAGES}장까지`, `Up to ${MAX_IMAGES} images`));
        break;
      }
      try {
        const compressed = await compressImageFile(f);
        setImages((p) => [...p, compressed]);
        light();
      } catch {
        toast.error(t("사진을 못 불러왔어요", "Couldn't bring that photo in"));
      }
    }
    e.target.value = "";
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            void (async () => {
              const reader = new FileReader();
              reader.onload = () => void addImage(reader.result as string);
              reader.readAsDataURL(f);
            })();
          }
        }
      }
    }
    const pasted = e.clipboardData?.getData("text") ?? "";
    if (!pasted) return;
    const lines = pasted
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const bullety = /^[-•*·\u25AA]\s/.test(lines[0] ?? "");
    if (FEATURES.PASTE_SPLIT && (lines.length >= 3 || bullety)) {
      e.preventDefault();
      onPasteMulti(lines, pasted);
    }
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={false}
      animate={{
        y: releasing ? -4 : 0,
        opacity: releasing ? 0 : 1,
      }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      style={{ pointerEvents: releasing ? "none" : undefined }}
      className={`composer-hero pb-[env(safe-area-inset-bottom)] ${
        hero ? "" : ""
      } ${composer ? "" : "border-t border-ink/8 bg-white/98 backdrop-blur-xl shadow-[0_-2px_16px_-6px_rgba(0,0,0,0.06)]"}`}
    >
      {composer && exampleChips && exampleChips.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-1.5 pt-2">
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
                className="touch-press rounded-full border border-ink/10 bg-ink/[0.03] px-2.5 py-1 text-[11px] font-medium text-ink-soft"
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
          {images.map((src, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              <img
                src={src}
                alt=""
                className="h-[4.5rem] w-[4.5rem] rounded-[var(--radius-md)] object-cover shadow-card ring-1 ring-ink/8"
              />
              <button
                type="button"
                onClick={() => {
                  tap();
                  setImages((p) => p.filter((_, idx) => idx !== i));
                }}
                className="touch-target absolute -right-1 -top-1 rounded-full bg-ink text-white shadow-float"
                aria-label={t("이미지 제거", "Remove image")}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
      <div className={`px-4 ${composer ? "pb-0.5 pt-0.5" : hero ? "mt-3" : "mt-2"}`}>
        <motion.div
          layout
          transition={SPRING_MICRO}
          className={`input-shell px-3 input-focus-ring ${
            focused ? "input-shell-focused" : ""
          } ${composer ? "py-1.5" : hero ? "py-4 ring-1 ring-ink/5" : "py-3"}`}
        >
          <textarea
            id="capture-input"
            ref={textareaRef}
            value={text}
            onChange={(e) => setUserText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onPaste={onPaste}
            onKeyDownCapture={(e) => {
              if (e.key !== "Enter" || (!e.metaKey && !e.ctrlKey)) return;
              e.preventDefault();
              e.stopPropagation();
              submitCommandEnter(e.currentTarget);
            }}
            onKeyDown={(e) => {
              const isComposing =
                composingRef.current || e.nativeEvent.isComposing;
              if (e.key === "Meta" && !isComposing)
                primeCommandSubmit(e.currentTarget);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                submitCommandEnter(e.currentTarget);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                e.preventDefault();
                submitFromKeyboard(e.currentTarget);
              }
            }}
            onKeyUp={(e) => {
              const isComposing =
                composingRef.current || e.nativeEvent.isComposing;
              if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                e.preventDefault();
                submitFromKeyboard(e.currentTarget);
              }
            }}
            rows={composer ? 1 : hero ? 4 : 3}
            placeholder={t("떠오르는 대로 적어보세요", "Write whatever comes to mind")}
            className={`block w-full resize-none bg-transparent leading-relaxed text-ink placeholder:text-ink-soft/55 placeholder:transition-opacity focus:outline-none ${
              composer
                ? "min-h-[24px] max-h-28 text-[15px]"
                : hero
                  ? "min-h-[96px] max-h-40 text-[17px]"
                  : "min-h-[72px] max-h-40 text-[16px]"
            }`}
          />
        </motion.div>
        {!composer && exampleChips && exampleChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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
                  className="touch-press rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className={`flex items-center gap-1 ${composer ? "px-3 pb-1.5 pt-0" : "px-5 pb-2 pt-2"}`}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.12 }}
          onClick={onMic}
          className={`touch-target rounded-full transition-colors ${
            listening
              ? "bg-ink text-white shadow-float"
              : "text-ink-soft hover:bg-ink/[0.05]"
          }`}
          aria-label={t("음성 입력", "Voice input")}
        >
          <Mic size={17} className={listening ? "animate-pulse" : ""} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            tap();
            fileRef.current?.click();
          }}
          className="touch-target rounded-full text-ink-soft hover:bg-ink/[0.05]"
          aria-label={t("이미지 첨부", "Attach image")}
        >
          <ImageIcon size={17} />
        </motion.button>
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
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            tap();
            setScribbleOpen(true);
          }}
          className="touch-target rounded-full text-ink-soft hover:bg-ink/[0.05]"
          aria-label={t("낙서", "Scribble")}
        >
          <Pencil size={17} />
        </motion.button>
        <div className="flex-1" />
        <motion.button
          type="button"
          layout
          whileTap={{ scale: 0.94 }}
          transition={SPRING_MICRO}
          onClick={() => {
            if (buttonSubmitRef.current) return;
            buttonSubmitRef.current = true;
            handleAdd();
            window.setTimeout(() => {
              buttonSubmitRef.current = false;
            }, 250);
          }}
          disabled={submittingRef.current || !hasContent}
          className={`flex h-10 min-w-[5.5rem] items-center justify-center gap-1 rounded-full text-button transition-shadow disabled:opacity-50 ${
            hasContent
              ? "bg-ink px-4 text-white shadow-card"
              : "bg-primary px-4 text-ink shadow-card"
          }`}
          aria-label={t("던지기", "Drop it")}
        >
          <AnimatePresence mode="wait" initial={false}>
            {hasContent ? (
              <motion.span
                key="send"
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1"
              >
                <ArrowUp size={16} strokeWidth={3} />
                {t("던지기", "Drop it")}
              </motion.span>
            ) : (
              <motion.span
                key="add"
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1"
              >
                <Plus size={14} strokeWidth={3} />
                {t("던지기", "Drop it")}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      <ScribbleCanvas
        open={scribbleOpen}
        onClose={() => setScribbleOpen(false)}
        onDone={(dataUrl) => void addImage(dataUrl)}
      />
      {!hero && !composer && (
        <p className="px-5 pb-3 text-center text-[11px] text-ink-soft/75">
          {t(
            "잊어도 괜찮아요. Itjima(잊지마)가 기억할게요.",
            "It's okay to forget. Itjima (잊지마) will remember.",
          )}
        </p>
      )}
    </motion.form>
  );
}
