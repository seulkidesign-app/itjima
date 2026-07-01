import { useT } from "@/lib/i18n";

export function CleanupBar({
  deleteCount,
  onCancel,
  onDelete,
}: {
  deleteCount: number;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const t = useT();

  return (
    <div className="border-t border-ink/10 bg-white/95 px-5 py-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-ink-soft">
          {t(`${deleteCount}개 삭제됩니다`, `${deleteCount} will be deleted`)}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="pill-ghost px-4 py-2 text-[13px]">
            {t("취소", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteCount === 0}
            className="pill-yellow px-4 py-2 text-[13px] disabled:opacity-40"
          >
            {t("삭제", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
