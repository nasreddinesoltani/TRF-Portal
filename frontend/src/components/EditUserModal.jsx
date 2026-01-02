import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";

export default function EditUserModal({ user, onClose, onSave }) {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    firstNameAr: "",
    lastNameNameAr: "",
    birthDate: "",
    gender: "homme",
    category: "etudiant",
    cin: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Populate form with user data when modal opens
  useEffect(() => {
    if (user) {
      // Parse birthDate to YYYY-MM-DD format
      let formattedBirthDate = "";
      if (user.birthDate && user.birthDate !== "N/A") {
        const date = new Date(user.birthDate);
        formattedBirthDate = date.toISOString().split("T")[0];
      }

      // Map gender values: "male" -> "homme", "female" -> "femme"
      let genderValue = user.gender || "homme";
      if (genderValue === "male") genderValue = "homme";
      if (genderValue === "female") genderValue = "femme";
      if (genderValue === "N/A") genderValue = "homme";

      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        firstNameAr: user.firstNameAr === "N/A" ? "" : user.firstNameAr || "",
        lastNameNameAr:
          user.lastNameNameAr === "N/A" ? "" : user.lastNameNameAr || "",
        birthDate: formattedBirthDate,
        gender: genderValue,
        category:
          user.category === "N/A" ? "etudiant" : user.category || "etudiant",
        cin: user.cin === "N/A" ? "" : user.cin || "",
        phone: user.phone === "N/A" ? "" : user.phone || "",
        address: user.address === "N/A" ? "" : user.address || "",
        city: user.city === "N/A" ? "" : user.city || "",
        postalCode: user.postalCode === "N/A" ? "" : user.postalCode || "",
        email: user.email === "N/A" ? "" : user.email || "",
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setFormData({
      ...formData,
      category: value,
    });
  };

  const handleGenderChange = (e) => {
    const value = e.target.value;

    setFormData({
      ...formData,
      gender: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Create a clean update object - only include non-empty fields
      const updateData = {};
      Object.keys(formData).forEach((key) => {
        const value = formData[key];
        // Only include non-empty values
        if (value && value !== "") {
          updateData[key] = value;
        }
      });

      console.log("Sending update data:", updateData);

      const response = await fetch(
        `/api/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success("User updated successfully!");
        console.log("User updated:", result);

        // Call parent callback after delay
        setTimeout(() => {
          onSave();
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to update user");
        setError(errorData.message || "Failed to update user");
      }
    } catch (err) {
      toast.error("Error: " + err.message);
      setError("Error: " + err.message);
      console.error("Update error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-black">Edit User</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 text-black">
              Personal Information
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Birth Date *</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleGenderChange}
                >
                  <option value="homme">Male (Homme)</option>
                  <option value="femme">Female (Femme)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cin">CIN (ID Number) *</Label>
                <Input
                  id="cin"
                  name="cin"
                  type="text"
                  value={formData.cin}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Arabic Information */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 text-black">
              معلومات شخصية (Arabic)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstNameAr">First Name (Arabic) *</Label>
                <Input
                  id="firstNameAr"
                  name="firstNameAr"
                  type="text"
                  value={formData.firstNameAr}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastNameNameAr">Last Name (Arabic) *</Label>
                <Input
                  id="lastNameNameAr"
                  name="lastNameNameAr"
                  type="text"
                  value={formData.lastNameNameAr}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact & Address */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 text-black">
              Contact & Address
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Category</h3>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleCategoryChange}
              >
                <option value="etudiant">Student (Étudiant)</option>
                <option value="enseignant">Teacher (Enseignant)</option>
                <option value="autre">Other (Autre)</option>
              </Select>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-black text-white hover:bg-gray-800"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
