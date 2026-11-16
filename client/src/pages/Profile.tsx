import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Phone, MapPin, LogOut, Edit, Lock } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const [, navigate] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    country: user?.country || "",
    zipCode: user?.zipCode || "",
  });

  React.useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      country: user?.country || "",
      zipCode: user?.zipCode || "",
    });
  }, [user]);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">
            Please log in to view your profile
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await axios.put("/api/auth/profile", profileForm);
      updateProfile(response.data);
      setProfileForm({
        name: response.data.name || "",
        email: response.data.email || "",
        phone: response.data.phone || "",
        address: response.data.address || "",
        city: response.data.city || "",
        country: response.data.country || "",
        zipCode: response.data.zipCode || "",
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSaving(true);
    try {
      await axios.put("/api/auth/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangingPassword(false);
    } catch {
      toast.error("Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
            <p className="text-slate-500 mt-1">
              Manage your account information
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <div className="w-28 h-28 bg-emerald-500 rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
                  {user?.name?.charAt(0).toUpperCase() || "B"}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 text-center">
                  {user?.name || "Buyer"}
                </h2>
                <p className="text-sm text-slate-500 text-center">
                  {user?.phone || "Not set"}
                </p>
                <div className="mt-4 text-center">
                  <Link
                    href="/verification"
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      user.idVerificationStatus === "verified"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {user.idVerificationStatus === "verified"
                      ? "Identity verified"
                      : "View ID review status"}
                  </Link>
                </div>

                <div className="mt-6 space-y-3 text-slate-700">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm">{user?.email || "Not set"}</span>
                  </div>
                  {user?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm">{user.phone}</span>
                    </div>
                  )}
                  {user?.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm truncate">{user.address}</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleLogout}
                  className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-medium py-2 rounded-2xl mt-6"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>

            {/* Account Information */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Account Information
                    </h2>
                    <p className="text-slate-500 mt-1">
                      Update your account details anytime
                    </p>
                  </div>
                  {!isEditing && !isChangingPassword && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          value={profileForm.name}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                      {/* Email removed from profile edit form. */}
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          name="phone"
                          value={profileForm.phone}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          name="country"
                          value={profileForm.country}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="address">Street Address</Label>
                        <Input
                          id="address"
                          name="address"
                          value={profileForm.address}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={profileForm.city}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          name="zipCode"
                          value={profileForm.zipCode}
                          onChange={handleProfileChange}
                          className="border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        onClick={() => {
                          setIsEditing(false);
                          setProfileForm({
                            name: user?.name || "",
                            email: user?.email || "",
                            phone: user?.phone || "",
                            address: user?.address || "",
                            city: user?.city || "",
                            country: user?.country || "",
                            zipCode: user?.zipCode || "",
                          });
                        }}
                        className="bg-slate-100 text-slate-900 hover:bg-slate-200"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : isChangingPassword ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="currentPassword">
                          Current Password
                        </Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className="border-slate-200"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">
                          Confirm Password
                        </Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className="border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4">
                      <Button
                        onClick={handleChangePassword}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isSaving ? "Updating..." : "Update Password"}
                      </Button>
                      <Button
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                        className="bg-slate-100 text-slate-900 hover:bg-slate-200"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-slate-900">
                        Personal Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-slate-500 mb-1">
                            Full Name
                          </p>
                          <p className="font-medium text-slate-900">
                            {profileForm.name || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 mb-1">Contact</p>
                          <p className="font-medium text-slate-900">
                            {profileForm.phone || "Not set"}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-500 mb-1">
                            Street Address
                          </p>
                          <p className="font-medium text-slate-900">
                            {profileForm.address || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 mb-1">City</p>
                          <p className="font-medium text-slate-900">
                            {profileForm.city || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 mb-1">Country</p>
                          <p className="font-medium text-slate-900">
                            {profileForm.country || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 mb-1">
                            ZIP Code
                          </p>
                          <p className="font-medium text-slate-900">
                            {profileForm.zipCode || "Not set"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          {!isEditing && !isChangingPassword && (
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Password</h2>
                  <p className="text-slate-500 mt-1">
                    Keep your account secure
                  </p>
                </div>
                <Button
                  onClick={() => setIsChangingPassword(true)}
                  className="bg-slate-100 text-slate-900 hover:bg-slate-200"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
