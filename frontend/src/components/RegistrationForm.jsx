import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { toast } from "react-toastify";

export default function RegistrationForm({ onUserAdded }) {
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
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setMessage("");
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newUser = await response.json();
        toast.success("User registered successfully!");
        setFormData({
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
          password: "",
        });

        // Notify parent to refresh data
        if (onUserAdded) {
          onUserAdded();
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to register user");
        setError(errorData.message || "Failed to register user");
      }
    } catch (err) {
      toast.error("Error: " + err.message);
      setError("Error: " + err.message);
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-black">Add New User</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                placeholder="John"
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
                placeholder="Doe"
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
                placeholder="12345678"
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
                placeholder="محمد"
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
                placeholder="علي"
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
                placeholder="john@example.com"
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
                placeholder="+216 12 345 678"
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
                placeholder="123 Main St"
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
                placeholder="Tunis"
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
                placeholder="1000"
                value={formData.postalCode}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Category & Account */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4 text-black">
            Category & Account
          </h3>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
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

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white hover:bg-gray-800"
        >
          {loading ? "Creating User..." : "Add User"}
        </Button>
      </form>
    </div>
  );
}
