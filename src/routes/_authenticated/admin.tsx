import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  checkIsAdmin,
  deleteFeedback,
  getAdminCount,
  grantAdmin,
  listFeedback,
  updateFeedbackStatus,
} from "@/lib/admin.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type FeedbackRow = Awaited<ReturnType<typeof listFeedback>>[number];

function AdminPage() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [bootstrapUserId, setBootstrapUserId] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const status = await checkIsAdmin();
      setIsAdmin(status.isAdmin);
      setUserId(status.userId);
      const count = await getAdminCount();
      setAdminCount(count.count);
      if (status.isAdmin) {
        setFeedback(await listFeedback());
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("로드 실패", "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = t("관리자 — ItJima", "Admin — ItJima");
    refresh();
  }, [t]);

  const bootstrap = async () => {
    const id = bootstrapUserId.trim() || userId;
    if (!id) return;
    try {
      await grantAdmin({ userId: id });
      toast.success(t("관리자 권한 부여됨", "Admin granted"));
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("실패", "Failed"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      </div>
    );
  }

  if (!isAdmin && adminCount === 0) {
    return (
      <div className="flex h-full flex-col px-4 py-[calc(env(safe-area-inset-top)+1rem)]">
        <Link to="/about" className="text-sm font-medium text-ink-soft">
          {t("← 돌아가기", "← Back")}
        </Link>
        <h1 className="mt-4 text-[22px] font-bold text-ink">{t("관리자 부트스트랩", "Admin bootstrap")}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {t("아직 관리자가 없어요. 본인 계정에 권한을 부여하세요.", "No admin yet. Grant yourself access.")}
        </p>
        <input
          value={bootstrapUserId}
          onChange={(e) => setBootstrapUserId(e.target.value)}
          placeholder={userId ?? ""}
          className="mt-4 rounded-xl border border-ink/10 px-3 py-3 text-sm"
        />
        <button onClick={bootstrap} className="pill-yellow mt-4">
          {t("관리자 되기", "Become admin")}
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] font-semibold text-ink">{t("권한 없음", "Access denied")}</p>
        <Link to="/about" className="mt-4 text-sm font-medium text-primary">
          {t("돌아가기", "Go back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <Link to="/about" className="text-sm font-medium text-ink-soft">
        {t("← 돌아가기", "← Back")}
      </Link>
      <h1 className="mt-3 text-[22px] font-bold text-ink">{t("관리자", "Admin")}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {t(`관리자 ${adminCount}명`, `${adminCount} admin(s)`)}
      </p>

      <section className="mt-6">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-soft">
          {t("피드백", "Feedback")}
        </h2>
        <ul className="space-y-2">
          {feedback.map((row) => (
            <li key={row.id} className="rounded-2xl border border-ink/8 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-primary">{row.category}</span>
                <select
                  value={row.status}
                  onChange={async (e) => {
                    await updateFeedbackStatus({
                      id: row.id,
                      status: e.target.value as FeedbackRow["status"],
                    });
                    await refresh();
                  }}
                  className="rounded-lg border border-ink/10 px-2 py-1 text-[11px]"
                >
                  <option value="new">new</option>
                  <option value="reviewing">reviewing</option>
                  <option value="resolved">resolved</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <p className="mt-2 text-sm text-ink">{row.message}</p>
              <div className="mt-2 flex gap-3">
                <button
                  onClick={async () => {
                    await deleteFeedback({ id: row.id });
                    await refresh();
                  }}
                  className="text-[11px] font-semibold text-destructive"
                >
                  {t("삭제", "Delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
