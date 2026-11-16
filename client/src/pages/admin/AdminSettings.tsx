import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function getErrorMessage(error: unknown) {
  if (
    axios.isAxiosError(error) &&
    typeof error.response?.data?.error === "string"
  ) {
    return error.response.data.error;
  }
  return "The request failed. Please try again.";
}

export default function AdminSettings() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const response = await axios.put("/api/auth/profile", profile);
      updateProfile(response.data);
      toast.success("Admin profile updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (password.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      await axios.put("/api/auth/change-password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={saveProfile}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit the contact details on your admin account.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-name">Name</Label>
          <Input
            id="admin-name"
            autoComplete="name"
            value={profile.name}
            onChange={event =>
              setProfile({ ...profile, name: event.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={profile.email}
            onChange={event =>
              setProfile({ ...profile, email: event.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-phone">Phone</Label>
          <Input
            id="admin-phone"
            type="tel"
            autoComplete="tel"
            value={profile.phone}
            onChange={event =>
              setProfile({ ...profile, phone: event.target.value })
            }
            required
          />
        </div>
        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? "Saving..." : "Save profile"}
        </Button>
      </form>

      <form
        onSubmit={changePassword}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Change password
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirm your current password before choosing a new one.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-current-password">Current password</Label>
          <Input
            id="admin-current-password"
            type="password"
            autoComplete="current-password"
            value={password.currentPassword}
            onChange={event =>
              setPassword({ ...password, currentPassword: event.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-new-password">New password</Label>
          <Input
            id="admin-new-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password.newPassword}
            onChange={event =>
              setPassword({ ...password, newPassword: event.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-confirm-password">Confirm new password</Label>
          <Input
            id="admin-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password.confirmPassword}
            onChange={event =>
              setPassword({ ...password, confirmPassword: event.target.value })
            }
            required
          />
        </div>
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? "Updating..." : "Change password"}
        </Button>
      </form>
    </div>
  );
}
