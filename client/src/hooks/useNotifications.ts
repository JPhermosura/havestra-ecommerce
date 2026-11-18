import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export interface UserNotification {
  _id: string;
  type: "order" | "delivery" | "review" | "inventory";
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  notifications: UserNotification[];
  unreadCount: number;
}

const notificationsQueryKey = (userId?: string) =>
  ["notifications", userId] as const;

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const queryKey = useMemo(() => notificationsQueryKey(user?.id), [user?.id]);

  const query = useQuery<NotificationResponse>(
    queryKey,
    async () => {
      const { data } =
        await axios.get<NotificationResponse>("/api/notifications");
      return data;
    },
    {
      enabled: Boolean(user?.id),
      refetchInterval: 45_000,
      retry: false,
    }
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const cached = queryClient.getQueryData<NotificationResponse>(queryKey);
      if (
        cached?.notifications.some(
          notification =>
            notification._id === notificationId && notification.readAt
        )
      ) {
        return true;
      }

      setActionError(null);
      try {
        await axios.patch(`/api/notifications/${notificationId}/read`);
        queryClient.setQueryData<NotificationResponse>(queryKey, current => {
          if (!current) return current;
          const wasUnread = current.notifications.some(
            notification =>
              notification._id === notificationId && !notification.readAt
          );
          const readAt = new Date().toISOString();
          return {
            ...current,
            notifications: current.notifications.map(notification =>
              notification._id === notificationId
                ? { ...notification, readAt }
                : notification
            ),
            unreadCount: wasUnread
              ? Math.max(0, current.unreadCount - 1)
              : current.unreadCount,
          };
        });
        return true;
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        setActionError("This notification could not be marked as read.");
        return false;
      }
    },
    [queryClient, queryKey]
  );

  const markAllAsRead = useCallback(async () => {
    setActionError(null);
    try {
      await axios.patch("/api/notifications/read-all");
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationResponse>(queryKey, current =>
        current
          ? {
              ...current,
              notifications: current.notifications.map(notification => ({
                ...notification,
                readAt: notification.readAt ?? readAt,
              })),
              unreadCount: 0,
            }
          : current
      );
      return true;
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      setActionError("Notifications could not be marked as read.");
      return false;
    }
  }, [queryClient, queryKey]);

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    hasLoadError: query.isError,
    refetch: query.refetch,
    actionError,
    markAsRead,
    markAllAsRead,
  };
}
