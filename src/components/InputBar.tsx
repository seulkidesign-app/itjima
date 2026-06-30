import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";
import { Mic, Image as ImageIcon, Plus, X, Pencil } from "lucide-react";
import { ScribbleCanvas } from "./ScribbleCanvas";
import { useT, useLang } from "@/lib/i18n";

type Props = {
  onAdd: (text: string, images: string[]) => void;
  onQuickSave?: (text: string, images: string[]) => void;
  onPasteMulti: (chunks: string[], original: string) => void;
};

export function InputBar({ onAdd, onPasteMulti }: Props) {
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
  const recogRef = useRef<any>(null);

  textRef.current = text;
  imagesRef.current = images;
  onAddRef.current = onAdd;

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
    const currentText = textSnapshot ?? textareaRef.current?.value ?? textRef.current;
    const trimmedText = currentText.trim();
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
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey) || composingRef.current || event.isComposing) return;
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
    window.setTimeout(() => { keySubmitRef.current = false; }, 0);
  };

  const submitCommandEnter = (target: HTMLTextAreaElement) => {
    if (keySubmitRef.current) return;
    keySubmitRef.current = true;
    const snapshot = commandSnapshotRef.current || target.value;
    const wasMetaSubmit = Boolean(commandSnapshotRef.current);
    if (wasMetaSubmit) {
      handleAdd(snapshot);
      window.setTimeout(() => { keySubmitRef.current = false; }, 0);
      return;
    }
    target.blur();
    window.setTimeout(() => {
      handleAdd(textareaRef.current?.value || snapshot);
      keySubmitRef.current = false;
    }, 0);
  };

  const onMic = () => {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      alert(t("이 브라우저는 음성 입력을 지원하지 않아요.", "This browser doesn't support voice input."));
      return;
    }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "ko-KR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const t = last[0].transcript;
      if (last.isFinal) setText((prev) => (prev ? prev + " " : "") + t);
    };
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setImages((p) => [...p, reader.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            const reader = new FileReader();
            reader.onload = () => setImages((p) => [...p, reader.result as string]);
            reader.readAsDataURL(f);
          }
        }
      }
    }
    const t = e.clipboardData?.getData("text") ?? "";
    if (!t) return;
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bullety = /^[-•*·▪︎]\s/.test(lines[0] ?? "");
    if (lines.length >= 3 || bullety) {
      e.preventDefault();
      onPasteMulti(lines, t);
    }
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-ink/5 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <button
                onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                className="absolute -right-1 -top-1 rounded-full bg-ink p-0.5 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onPaste={onPaste}
        onKeyDownCapture={(e) => {
          if (e.key !== "Enter" || (!e.metaKey && !e.ctrlKey)) return;
          e.preventDefault();
          e.stopPropagation();
          submitCommandEnter(e.currentTarget);
        }}
        onKeyDown={(e) => {
          const isComposing = composingRef.current || e.nativeEvent.isComposing;
          if (e.key === "Meta" && !isComposing) primeCommandSubmit(e.currentTarget);
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
          const isComposing = composingRef.current || e.nativeEvent.isComposing;
          if (e.key === "Enter" && !e.shiftKey && !isComposing) {
            e.preventDefault();
            submitFromKeyboard(e.currentTarget);
          }
        }}
        rows={1}
        placeholder={t("메시지 입력", "Message")}
        className="block w-full resize-none bg-transparent px-4 pt-2.5 pb-1 text-[15px] leading-snug text-ink placeholder:text-ink-soft/70 focus:outline-none max-h-32"
      />
      <div className="flex items-center gap-1 px-2 pb-1.5 pt-0.5">
        <button
          onClick={onMic}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            listening ? "bg-destructive text-white animate-pulse" : "text-ink-soft hover:bg-white/60"
          }`}
          aria-label={t("음성 입력", "Voice input")}
        >
          <Mic size={18} />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white/60"
          aria-label={t("이미지 첨부", "Attach image")}
        >
          <ImageIcon size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
        <button
          onClick={() => setScribbleOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white/60"
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
            window.setTimeout(() => { buttonSubmitRef.current = false; }, 250);
          }}
          onClick={() => {
            if (buttonSubmitRef.current) return;
            buttonSubmitRef.current = true;
            handleAdd();
            window.setTimeout(() => { buttonSubmitRef.current = false; }, 250);
          }}
          className="pill-yellow flex items-center gap-1"
        >
          <Plus size={14} strokeWidth={3} /> {t("새 메모", "New note")}
        </button>
      </div>
      <ScribbleCanvas
        open={scribbleOpen}
        onClose={() => setScribbleOpen(false)}
        onDone={(dataUrl) => setImages((p) => [...p, dataUrl])}
      />
    </form>
  );
}
