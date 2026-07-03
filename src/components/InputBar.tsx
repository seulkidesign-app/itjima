import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { Mic, Image as ImageIcon, Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ScribbleCanvas } from "./ScribbleCanvas";
import { useT, useLang } from "@/lib/i18n";
import {
  compressDataUrl,
  compressImageFile,
  MAX_IMAGES,
} from "@/lib/imageCompress";

type Props = {
  onAdd: (text: string, images: string[]) => void;
  onPasteMulti: (chunks: string[], original: string) => void;
  /** Restores pasted text when the split sheet is dismissed. */
  restoreText?: string | null;
  onRestoreConsumed?: () => void;
  /** Larger hero layout when inbox is empty */
  hero?: boolean;
};

export function InputBar({
  onAdd,
  onPasteMulti,
  restoreText,
  onRestoreConsumed,
  hero = false,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [scribbleOpen, setScribbleOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef(text);
  const imagesRef = useRef(images);
  const onAddRef = useRef(onAdd);
  const commandSnapshotRef = useRef("");
  const composingRef = useRef(false);
  const keySubmitRef = useRef(false);
  const buttonSubmitRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  textRef.current = text;
  imagesRef.current = images;
  onAddRef.current = onAdd;

  useEffect(() => {
    if (!hero) return;
    textareaRef.current?.focus();
  }, [hero]);

  useEffect(() => {
    if (!restoreText) return;
    setText(restoreText);
    textRef.current = restoreText;
    onRestoreConsumed?.();
    textareaRef.current?.focus();
  }, [restoreText, onRestoreConsumed]);

  const addImage = async (dataUrl: string) => {
    if (imagesRef.current.length >= MAX_IMAGES) {
      toast(t(`이미지는 ${MAX_IMAGES}장까지`, `Up to ${MAX_IMAGES} images`));
      return;
    }
    try {
      const compressed = await compressDataUrl(dataUrl);
      setImages((p) => [...p, compressed]);
    } catch {
      toast.error(t("이미지를 불러오지 못했어요", "Couldn't load image"));
    }
  };

  const reset = () => {
    textRef.current = "";
    imagesRef.current = [];
    commandSnapshotRef.current = "";
    setText("");
    setImages([]);
  };

  const primeCommandSubmit = (target: HTMLTextAreaElement) => {
    const snapshot = target.value;
    if (!snapshot.trim() && imagesRef.current.length === 0) return;
    commandSnapshotRef.current = snapshot;
  };

  const handleAdd = (textSnapshot?: string) => {
    const currentImages = imagesRef.current;
    const currentText =
      textSnapshot ?? textareaRef.current?.value ?? textRef.current;
    const trimmedText = currentText.replace(/\s*\[…\]\s*$/, "").trim();
    if (!trimmedText && currentImages.length === 0) return;
    onAddRef.current(trimmedText, currentImages);
    reset();
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
          "이 브라우저는 음성 입력을 지원하지 않아요.",
          "This browser doesn't support voice input.",
        ),
      );
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.results.length - 1];
      const transcript = last[0].transcript as string;
      if (last.isFinal)
        setText((prev) => (prev ? prev + " " : "") + transcript);
      else
        setText((prev) => {
          const base = prev.replace(/\s*\[…\]$/, "");
          return (base ? base + " " : "") + transcript + " […]";
        });
    };
    r.onerror = () => {
      setListening(false);
      toast.error(t("음성 입력에 실패했어요", "Voice input failed"));
    };
    r.onend = () => setListening(false);
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
      } catch {
        toast.error(t("이미지를 불러오지 못했어요", "Couldn't load image"));
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
    const t = e.clipboardData?.getData("text") ?? "";
    if (!t) return;
    const lines = t
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const bullety = /^[-•*·\u25AA]\s/.test(lines[0] ?? "");
    if (lines.length >= 3 || bullety) {
      e.preventDefault();
      onPasteMulti(lines, t);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className={`border-t border-ink/5 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.06)] ${
        hero ? "border-t-0 shadow-none" : ""
      }`}
    >
      {hero && (
        <p className="px-5 pt-4 text-center text-[13px] font-medium leading-relaxed text-ink-soft/90">
          {t(
            "잊어도 괜찮아요. ItJima가 기억할게요.",
            "It's okay to forget. ItJima will remember.",
          )}
        </p>
      )}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pt-3">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img
                src={src}
                alt=""
                className="h-16 w-16 rounded-[24px] object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setImages((p) => p.filter((_, idx) => idx !== i))
                }
                className="touch-target absolute -right-1 -top-1 rounded-full bg-ink text-white"
                aria-label={t("이미지 제거", "Remove image")}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`${hero ? "px-5" : "px-5"} ${hero ? "mt-3" : "mt-0"}`}>
        <div
          className={`rounded-[28px] bg-ink/[0.03] px-4 input-focus-ring transition-[box-shadow] duration-200 ${
            hero ? "py-4 ring-1 ring-ink/5" : "py-3"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
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
            rows={hero ? 4 : 3}
            placeholder={t("생각을 적어보세요", "Type a thought")}
            className={`block w-full resize-none bg-transparent leading-relaxed text-ink placeholder:text-ink-soft/60 focus:outline-none max-h-40 ${
              hero ? "min-h-[96px] text-[17px]" : "min-h-[72px] text-[16px]"
            }`}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 px-5 pb-2 pt-1">
        <button
          type="button"
          onClick={onMic}
          className={`touch-target rounded-full transition ${
            listening
              ? "bg-ink text-white animate-pulse"
              : "text-ink-soft hover:bg-white/60"
          }`}
          aria-label={t("음성 입력", "Voice input")}
        >
          <Mic size={18} />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="touch-target rounded-full text-ink-soft hover:bg-white/60"
          aria-label={t("이미지 첨부", "Attach image")}
        >
          <ImageIcon size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setScribbleOpen(true)}
          className="touch-target rounded-full text-ink-soft hover:bg-white/60"
          aria-label={t("낙서", "Scribble")}
        >
          <Pencil size={18} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (buttonSubmitRef.current) return;
            buttonSubmitRef.current = true;
            handleAdd();
            window.setTimeout(() => {
              buttonSubmitRef.current = false;
            }, 250);
          }}
          onClick={() => {
            if (buttonSubmitRef.current) return;
            buttonSubmitRef.current = true;
            handleAdd();
            window.setTimeout(() => {
              buttonSubmitRef.current = false;
            }, 250);
          }}
          className="pill-yellow flex items-center gap-1"
        >
          <Plus size={14} strokeWidth={3} /> {t("추가", "Add")}
        </button>
      </div>
      <ScribbleCanvas
        open={scribbleOpen}
        onClose={() => setScribbleOpen(false)}
        onDone={(dataUrl) => void addImage(dataUrl)}
      />
      {!hero && (
        <p className="px-5 pb-3 text-center text-[11px] text-ink-soft/75">
          {t(
            "잊어도 괜찮아요. ItJima가 기억할게요.",
            "It's okay to forget. ItJima will remember.",
          )}
        </p>
      )}
    </form>
  );
}
