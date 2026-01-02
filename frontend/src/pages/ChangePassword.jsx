import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { changePassword, user } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const currentPasswordRequired = !user?.mustChangePassword;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    try {
      setSubmitting(true);
      if (currentPasswordRequired && !formData.currentPassword) {
        throw new Error("Current password is required");
      }

      const payload = {
        newPassword: formData.newPassword,
      };

      if (formData.currentPassword) {
        payload.currentPassword = formData.currentPassword;
      }

      const result = await changePassword(payload);

      if (!result.success) {
        throw new Error(result.error || "Unable to change password");
      }

      toast.success("Password updated successfully");
      navigate("/");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white shadow rounded-lg p-6">
      <h1 className="text-2xl font-semibold mb-1 text-gray-900">
        Change Password
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Please update your password to continue using the portal.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {currentPasswordRequired && (
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleChange}
              required={currentPasswordRequired}
              minLength={8}
            />
          </div>
        )}

        <div>
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={handleChange}
            required
            minLength={8}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
};

export default ChangePassword;
