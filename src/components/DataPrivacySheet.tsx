import {
  Download,
  ExternalLink,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import {
  buildItjimaDataExport,
  clearItjimaCaches,
  clearLocalItjimaData,
  deleteCurrentAccount,
  downloadItjimaDataExport,
} from "@/lib/dataRights";
import { tap } from "@/lib/haptics";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
};

const actionClass =
  "flex min-h-[52px] w-full items-center gap-3 rounded-[16px] border border-ink/[0.08] bg-white px-3.5 text-left text-[14px] font-semibold text-ink transition-colors active:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export function DataPrivacySheet({ open, onClose, userId }: Props) {
  const t = useT();
  const [exporting, setExporting] = useState(false);
  const [destructiveConfirm, setDestructiveConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    tap();
    setExporting(true);
    try {
      const data = await buildItjimaDataExport(userId);
      downloadItjimaDataExport(data);
      if (data.warnings.length > 0) {
        toast.warning(
          t(
            "일부 서버 데이터를 읽지 못했지만, 가능한 데이터는 내려받았어요.",
            "Some server data could not be read, but the available data was downloaded.",
          ),
        );
      } else {
        toast.success(t("데이터를 내려받았어요", "Your data was downloaded"));
      }
    } catch {
      toast.error(
        t(
          "데이터를 내려받지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          "Couldn't download your data. Check your connection and try again.",
        ),
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    tap();
    if (!destructiveConfirm) {
      setDestructiveConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      if (userId) {
        await deleteCurrentAccount();
      } else {
        clearLocalItjimaData();
        await clearItjimaCaches();
      }
      toast.success(
        userId
          ? t("계정과 데이터를 삭제했어요", "Your account and data were deleted")
          : t("이 기기의 데이터를 삭제했어요", "Data on this device was deleted"),
      );
      onClose();
      window.setTimeout(() => window.location.assign("/"), 250);
    } catch {
      setDestructiveConfirm(false);
      toast.error(
        t(
          "삭제를 완료하지 못했어요. 데이터는 그대로이며, 다시 시도할 수 있어요.",
          "Deletion could not be completed. Your data remains available and you can try again.",
        ),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setDestructiveConfirm(false);
        onClose();
      }}
      maxHeight="82dvh"
      title={t("데이터와 개인정보", "Data & privacy")}
    >
      <div className="px-5 pb-8 pt-1">
        <div className="px-1 pb-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/20 text-ink">
            <ShieldCheck size={21} strokeWidth={2.1} aria-hidden />
          </span>
          <h2 className="mt-4 text-[22px] font-bold tracking-[-0.03em] text-ink">
            {t("내 데이터는 내가 통제해요", "You control your data")}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            {t(
              "저장된 내용을 내려받거나, 더 이상 사용하지 않을 때 삭제할 수 있어요.",
              "Download what you have saved, or delete it when you no longer use Itjima.",
            )}
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            data-testid="data-export-button"
            onClick={() => void handleExport()}
            disabled={exporting || deleting}
            className={actionClass}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/20 text-ink">
              <Download size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">
                {exporting
                  ? t("데이터 준비 중…", "Preparing your data…")
                  : t("내 데이터 내려받기", "Download my data")}
              </span>
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-ink-soft">
                {t(
                  "일정, 할 일, 보관 데이터와 계정 정보를 JSON 파일로 받아요.",
                  "Get schedules, tasks, archive data, and account information as JSON.",
                )}
              </span>
            </span>
          </button>

          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className={actionClass}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
              <ExternalLink size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex-1">{t("개인정보 처리방침", "Privacy policy")}</span>
          </a>

          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className={actionClass}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
              <ExternalLink size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex-1">{t("이용약관", "Terms of use")}</span>
          </a>
        </div>

        <div className="mt-6 rounded-[18px] border border-red-500/10 bg-red-500/[0.045] p-3.5">
          <h3 className="text-[13px] font-bold text-red-700">
            {userId
              ? t("계정 영구 삭제", "Permanently delete account")
              : t("이 기기의 데이터 삭제", "Delete data on this device")}
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-red-700/75">
            {destructiveConfirm
              ? t(
                  "되돌릴 수 없어요. 정말 삭제하려면 아래 버튼을 한 번 더 눌러 주세요.",
                  "This cannot be undone. Press the button once more to confirm deletion.",
                )
              : userId
                ? t(
                    "계정, 일정, 보관함, 알림 등록 정보를 서버에서 삭제해요.",
                    "Deletes your account, schedules, archive, and notification registrations from the server.",
                  )
                : t(
                    "로그인하지 않고 이 기기에 저장한 내용을 모두 삭제해요.",
                    "Deletes everything saved on this device while signed out.",
                  )}
          </p>
          <button
            type="button"
            data-testid="data-delete-button"
            onClick={() => void handleDelete()}
            disabled={exporting || deleting}
            className={`mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] px-4 text-[13px] font-bold transition-colors disabled:opacity-50 ${
              destructiveConfirm
                ? "bg-red-600 text-white active:bg-red-700"
                : "border border-red-500/15 bg-white text-red-600 active:bg-red-50"
            }`}
          >
            <Trash2 size={16} strokeWidth={2.1} aria-hidden />
            {deleting
              ? t("삭제 중…", "Deleting…")
              : destructiveConfirm
                ? t("영구 삭제 확인", "Confirm permanent deletion")
                : userId
                  ? t("계정 삭제", "Delete account")
                  : t("기기 데이터 삭제", "Delete device data")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
