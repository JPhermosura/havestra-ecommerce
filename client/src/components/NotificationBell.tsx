import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  _id: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } =
        await axios.get<NotificationResponse>("/api/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setHasLoadError(false);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      setHasLoadError(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 45_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, user?.id]);

  const openNotification = async (notification: Notification) => {
    try {
      if (!notification.readAt) {
        await axios.patch(`/api/notifications/${notification._id}/read`);
        setNotifications(current =>
          current.map(item =>
            item._id === notification._id
              ? { ...item, readAt: new Date().toISOString() }
              : item
          )
        );
        setUnreadCount(count => Math.max(0, count - 1));
      }
      if (notification.link) navigate(notification.link);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      setHasLoadError(true);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch("/api/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifications(current => current.map(item => ({ ...item, readAt })));
      setUnreadCount(0);
      setHasLoadError(false);
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      setHasLoadError(true);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-100 bg-white text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-xs font-bold leading-5 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {hasLoadError ? (
            <p role="alert" className="px-3 py-5 text-sm text-rose-700">
              Notifications could not be loaded. Please try again later.
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-5 text-sm text-slate-500">
              You’re all caught up.
            </p>
          ) : (
            notifications.map(notification => (
              <DropdownMenuItem
                key={notification._id}
                onSelect={() => void openNotification(notification)}
                className="items-start gap-3 whitespace-normal px-3 py-3"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notification.readAt ? "bg-transparent" : "bg-emerald-600"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
