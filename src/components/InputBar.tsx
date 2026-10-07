import type { ComponentProps } from "react";
import { CaptureComposer } from "./CaptureComposer";
import { useT } from "@/lib/i18n";

type InputBarProps = ComponentProps<typeof CaptureComposer>;

/**
 * V03 keeps V02's natural-language capture intact, but makes the product promise
 * visible at the moment of capture: users can leave a thought without managing it,
 * and ItJima may bring it back later when it is useful.
 */
export function InputBar(props: InputBarProps) {
  const t = useT();
  const showResurfacingPromise = Boolean(props.composer);

  return (
    <div className="bg-white">
      {showResurfacingPromise && (
        <p
          className="px-5 pb-1 pt-2 text-[11px] font-medium leading-relaxed text-ink-soft/65"
          data-testid="v03-capture-promise"
        >
          {t(
            "그냥 남겨두세요. 필요한 때 다시 꺼내드릴게요.",
            "Leave it here. We'll bring it back when it may matter.",
          )}
        </p>
      )}
      <CaptureComposer {...props} />
    </div>
  );
}
