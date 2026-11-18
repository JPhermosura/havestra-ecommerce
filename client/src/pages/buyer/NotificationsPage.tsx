import { Bell, Check } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { UserNotification, useNotifications } from "@/hooks/useNotifications";

function getNotificationCategory(notification: UserNotification) {
  const content = `${notification.title} ${notification.message}`.toLowerCase();

  if (content.includes("announcement") || content.includes("important")) {
    return "Important announcement";
  }
  if (content.includes("in transit")) return "In Transit";
  if (content.includes("delivered")) return "Delivered";
  if (notification.type === "order") {
    return /\b(placed|confirm)/.test(content)
      ? "Order confirmation"
      : "Order status update";
  }
  if (notification.type === "delivery") return "Order status update";
  if (notification.type === "inventory") return "Inventory update";
  return "Review update";
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasLoadError,
    refetch,
    actionError,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const openNotification = async (notification: UserNotification) => {
    if (!(await markAsRead(notification._id))) return;
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="min-h-screen bg-[#F7F9F5]">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8">
        <header className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#16834A]">
                <Bell className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Notifications
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Order updates and important activity for your account.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-[#16834A]">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </span>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void markAllAsRead()}
                  className="shrink-0 border-emerald-200 text-[#16834A] hover:bg-emerald-50"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </header>

        {actionError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700"
          >
            {actionError}
          </p>
        )}

        {isLoading ? (
          <div
            role="status"
            className="rounded-3xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm"
          >
            Loading notifications...
          </div>
        ) : hasLoadError ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
          >
            <p className="font-medium text-red-700">
              Notifications could not be loaded.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <section className="flex min-h-[50dvh] flex-col items-center justify-center rounded-3xl border border-emerald-100 bg-white px-6 py-12 text-center shadow-sm">
            <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-[#16834A]">
              <Bell className="h-10 w-10" />
            </span>
            <h2 className="text-xl font-semibold text-slate-900">
              You&apos;re all caught up!
            </h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              New order and delivery updates will appear here.
            </p>
          </section>
        ) : (
          <section aria-label="Notification list" className="space-y-3">
            {notifications.map(notification => {
              const isUnread = !notification.readAt;

              return (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  aria-label={`${getNotificationCategory(notification)}: ${notification.title}${isUnread ? ", unread" : ""}`}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-colors sm:p-5 ${
                    isUnread
                      ? "border-emerald-200 bg-white hover:bg-emerald-50/50"
                      : "border-slate-100 bg-white/90 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        isUnread ? "bg-[#16834A]" : "bg-transparent"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#16834A]">
                          {getNotificationCategory(notification)}
                        </span>
                        {isUnread && (
                          <span className="text-xs font-medium text-[#16834A]">
                            New
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block font-semibold text-slate-900">
                        {notification.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        {notification.message}
                      </span>
                      <time
                        dateTime={notification.createdAt}
                        className="mt-2 block text-xs text-slate-400"
                      >
                        {new Date(notification.createdAt).toLocaleString()}
                      </time>
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
