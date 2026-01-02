import "../App.css";
import "../styles/datagrid.css";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DataGrid } from "../components/DataGrid";
import EditUserModal from "../components/EditUserModal";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Modern stat card component
const StatCard = ({ title, value, subtitle, icon, color = "blue", trend }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-rose-50 border-rose-200 text-rose-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };

  const iconBgClasses = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    purple: "bg-purple-500",
    indigo: "bg-indigo-500",
    slate: "bg-slate-500",
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${colorClasses[color]} transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold">{value ?? 0}</p>
          {subtitle && <p className="text-xs opacity-70">{subtitle}</p>}
          {trend && (
            <p
              className={`text-xs font-medium ${
                trend > 0
                  ? "text-emerald-600"
                  : trend < 0
                  ? "text-rose-600"
                  : "text-slate-500"
              }`}
            >
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}% vs
              last month
            </p>
          )}
        </div>
        {icon && (
          <div className={`rounded-xl p-3 ${iconBgClasses[color]} text-white`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Progress bar component
const ProgressBar = ({ label, value, total, color = "blue" }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">
          {value} ({percentage}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Donut chart component (CSS-based)
const DonutChart = ({ data, total, centerLabel }) => {
  let accumulated = 0;
  const segments = data.map((item, index) => {
    const startAngle = accumulated;
    accumulated += (item.value / total) * 360;
    return { ...item, startAngle, endAngle: accumulated };
  });

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        {segments.map((segment, index) => {
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const percentage = segment.value / total;
          const strokeDasharray = `${
            percentage * circumference
          } ${circumference}`;
          const strokeDashoffset = -(
            (segment.startAngle / 360) *
            circumference
          );

          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{total}</span>
        <span className="text-xs text-slate-500">{centerLabel}</span>
      </div>
    </div>
  );
};

// Club row component for the table
const ClubRow = ({ club, index }) => {
  const typeColors = {
    club: "bg-blue-100 text-blue-700",
    ecole_federale: "bg-purple-100 text-purple-700",
    centre_de_promotion: "bg-teal-100 text-teal-700",
  };

  return (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
            {club.code?.slice(0, 2) || club.name?.slice(0, 2)?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">{club.name}</p>
            {club.nameAr && (
              <p className="text-xs text-slate-500">{club.nameAr}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{club.code || "-"}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            typeColors[club.type] || "bg-indigo-100 text-indigo-700"
          }`}
        >
          {club.type?.replace(/_/g, " ") || "Club"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
        {club.athleteCount ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{club.city || "-"}</td>
    </tr>
  );
};

function Dashboard() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [clubSummary, setClubSummary] = useState(null);
  const [clubLoading, setClubLoading] = useState(false);
  const [clubError, setClubError] = useState(null);

  // Admin analytics state
  const [athleteStats, setAthleteStats] = useState(null);
  const [clubsList, setClubsList] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const { token, user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const isClubManager = user?.role === "club_manager";

  useEffect(() => {
    if (!token) {
      return;
    }

    if (isAdmin) {
      loadUsers();
    } else if (isClubManager) {
      loadClubSummary();
    }
  }, [isAdmin, isClubManager, token]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    applyFilters();
  }, [isAdmin, data, categoryFilter, genderFilter, searchTerm]);

  // Load admin analytics data
  const loadAdminAnalytics = async () => {
    if (!token || !isAdmin) return;

    setStatsLoading(true);
    try {
      // Load athlete statistics
      const statsResponse = await fetch(`${API_BASE_URL}/api/athletes/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setAthleteStats(stats);
      }

      // Load clubs list
      const clubsResponse = await fetch(`${API_BASE_URL}/api/clubs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (clubsResponse.ok) {
        const clubs = await clubsResponse.json();
        setClubsList(Array.isArray(clubs) ? clubs : []);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && token) {
      loadAdminAnalytics();
    }
  }, [isAdmin, token]);

  const loadUsers = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const users = await response.json();
        const transformedData = users.map((currentUser) => ({
          id: currentUser._id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          firstNameAr: currentUser.firstNameAr || "N/A",
          lastNameNameAr: currentUser.lastNameNameAr || "N/A",
          email: currentUser.email || "N/A",
          phone: currentUser.phone || "N/A",
          birthDate: currentUser.birthDate || "N/A",
          gender: currentUser.gender || "N/A",
          category: currentUser.category || "N/A",
          cin: currentUser.cin || "N/A",
          address: currentUser.address || "N/A",
          city: currentUser.city || "N/A",
          postalCode: currentUser.postalCode || "N/A",
        }));

        setData(transformedData);
      } else if (response.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
      } else {
        setError("Failed to load data");
        toast.error("Failed to load users");
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
      toast.error("Error loading data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadClubSummary = async () => {
    if (!token) {
      return;
    }

    setClubLoading(true);
    setClubError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs/mine`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const summary = await response.json();
        setClubSummary(summary);
      } else if (response.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
      } else {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load club summary");
      }
    } catch (err) {
      console.error("Error loading club summary:", err);
      setClubError(err.message);
      toast.error("Error loading club summary: " + err.message);
    } finally {
      setClubLoading(false);
    }
  };

  const applyFilters = () => {
    if (!isAdmin) {
      return;
    }

    let filtered = [...data];

    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (currentUser) => currentUser.category === categoryFilter
      );
    }

    if (genderFilter !== "all") {
      filtered = filtered.filter(
        (currentUser) => currentUser.gender === genderFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (currentUser) =>
          currentUser.firstName.toLowerCase().includes(term) ||
          currentUser.lastName.toLowerCase().includes(term) ||
          currentUser.email.toLowerCase().includes(term) ||
          currentUser.city.toLowerCase().includes(term)
      );
    }

    setFilteredData(filtered);
  };

  const columns = [
    { field: "id", headerText: "ID", width: "120" },
    { field: "firstName", headerText: "First Name", width: "120" },
    { field: "lastName", headerText: "Last Name", width: "120" },
    { field: "firstNameAr", headerText: "First Name (AR)", width: "120" },
    { field: "lastNameNameAr", headerText: "Last Name (AR)", width: "120" },
    { field: "email", headerText: "Email", width: "150" },
    { field: "phone", headerText: "Phone", width: "130" },
    {
      field: "birthDate",
      headerText: "Birth Date",
      width: "130",
      type: "date",
      format: "yMd",
    },
    { field: "gender", headerText: "Gender", width: "100" },
    { field: "category", headerText: "Category", width: "120" },
    { field: "cin", headerText: "CIN", width: "120" },
    { field: "address", headerText: "Address", width: "150" },
    { field: "city", headerText: "City", width: "100" },
    { field: "postalCode", headerText: "Postal Code", width: "100" },
    {
      field: "actions",
      headerText: "Actions",
      width: "150",
      template: (props) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(props)}
            className="px-3 py-1 text-xs"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDelete(props.id)}
            className="px-3 py-1 text-xs"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const handleEdit = (currentUser) => {
    setEditingUser(currentUser);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("User deleted successfully");
        loadUsers();
      } else {
        toast.error("Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("Error deleting user: " + err.message);
    }
  };

  const handleRefresh = () => {
    if (isAdmin) {
      loadUsers();
    } else if (isClubManager) {
      loadClubSummary();
    }
  };

  const handleClearFilters = () => {
    if (!isAdmin) {
      return;
    }

    setCategoryFilter("all");
    setGenderFilter("all");
    setSearchTerm("");
  };

  if (isClubManager) {
    const club = clubSummary?.club;
    const stats = clubSummary?.stats ?? {};
    const managerInfo = clubSummary?.manager;
    const recentAthletes = clubSummary?.recentAthletes ?? [];
    const formatDate = (value) =>
      value ? new Date(value).toLocaleDateString() : "-";

    const statCards = [
      { label: "Total Athletes", value: stats.totalAthletes },
      { label: "Active Memberships", value: stats.activeMemberships },
      { label: "Pending Memberships", value: stats.pendingMemberships },
      { label: "Inactive Memberships", value: stats.inactiveMemberships },
      { label: "Transferred Memberships", value: stats.transferredMemberships },
    ];

    return (
      <div className="min-h-screen bg-white p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-black">
            {club?.name ? `${club.name} Overview` : "Club Overview"}
          </h1>
          <Button onClick={handleRefresh} disabled={clubLoading}>
            {clubLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {clubError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {clubError}
          </div>
        )}

        {clubLoading ? (
          <div className="p-4 text-center text-gray-600">
            Loading club data...
          </div>
        ) : club ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-gray-200 p-4 shadow-sm bg-white"
                >
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-semibold text-black mt-1">
                    {card.value ?? 0}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
                <h2 className="text-xl font-semibold text-black mb-3">
                  Club Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Code</p>
                    <p className="text-lg font-medium text-black">
                      {club.code || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="text-lg font-medium text-black capitalize">
                      {club.type || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="text-lg font-medium text-black">
                      {club.email || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="text-lg font-medium text-black">
                      {club.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">City</p>
                    <p className="text-lg font-medium text-black">
                      {club.city || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="text-lg font-medium text-black">
                      {club.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Season From</p>
                    <p className="text-lg font-medium text-black">
                      {formatDate(club.seasonActivation?.from)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Season To</p>
                    <p className="text-lg font-medium text-black">
                      {formatDate(club.seasonActivation?.to)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
                <h2 className="text-xl font-semibold text-black mb-3">
                  Club Manager
                </h2>
                {managerInfo ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500">Name</p>
                      <p className="text-lg font-medium text-black">
                        {`${managerInfo.firstName ?? ""} ${
                          managerInfo.lastName ?? ""
                        }`.trim() || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="text-lg font-medium text-black">
                        {managerInfo.email || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="text-lg font-medium text-black">
                        {managerInfo.phone || "-"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No manager information available.
                  </p>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
              <h2 className="text-xl font-semibold text-black mb-3">
                Recent Athletes
              </h2>
              {recentAthletes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No athletes have been added yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          License
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CIN
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Passport
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Athlete Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Membership Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentAthletes.map((athlete) => (
                        <tr key={athlete.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {`${athlete.firstName} ${athlete.lastName}`.trim()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {athlete.licenseNumber || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {athlete.cin || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {athlete.passportNumber || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                            {athlete.status || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                            {athlete.membershipStatus || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(athlete.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-gray-600">
            No club is associated with your account yet.
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-black mb-4">
            Welcome to TRF Portal
          </h1>
          <p className="text-gray-600">
            Your role does not have a dedicated dashboard yet. Please contact an
            administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  // Computed values for admin dashboard
  const totalAthletes = athleteStats?.total || 0;
  const licensedAthletes = athleteStats?.licensed || 0;
  const byStatus = athleteStats?.byStatus || {};
  const byGender = athleteStats?.byGender || {};
  const attention = athleteStats?.attention || {};

  // Current season data (only athletes with active membership in current season)
  const currentSeason = athleteStats?.currentSeason || new Date().getFullYear();
  const seasonData = athleteStats?.season || {};
  const currentSeasonActive = seasonData.total || 0;
  const seasonByStatus = seasonData.byStatus || {};
  const seasonByGender = seasonData.byGender || {};
  const seasonAttention = seasonData.attention || {};

  // Club statistics - only active clubs
  const activeClubsList = clubsList.filter((c) => c.isActive);
  const totalClubs = activeClubsList.length;
  const activeClubs = totalClubs; // All displayed are active
  const clubsByType = activeClubsList.reduce((acc, club) => {
    const type = club.type || "club";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // All clubs sorted by type: club > ecole_federale > centre_de_promotion, then by athlete count
  const typeOrder = { club: 0, ecole_federale: 1, centre_de_promotion: 2 };
  const sortedClubs = [...activeClubsList].sort((a, b) => {
    const typeA = typeOrder[a.type] ?? 99;
    const typeB = typeOrder[b.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;
    return (b.athleteCount || 0) - (a.athleteCount || 0);
  });

  // Gender chart data - using current season data
  const genderChartData = [
    { label: "Male", value: seasonByGender.male || 0, color: "#3b82f6" },
    { label: "Female", value: seasonByGender.female || 0, color: "#ec4899" },
  ].filter((d) => d.value > 0);

  // Status chart data - using current season data
  const statusChartData = [
    { label: "Active", value: seasonByStatus.active || 0, color: "#10b981" },
    {
      label: "Pending Docs",
      value: seasonByStatus.pending_documents || 0,
      color: "#f59e0b",
    },
    {
      label: "Expired Medical",
      value: seasonByStatus.expired_medical || 0,
      color: "#ef4444",
    },
    {
      label: "Suspended",
      value: seasonByStatus.suspended || 0,
      color: "#8b5cf6",
    },
    {
      label: "Inactive",
      value: seasonByStatus.inactive || 0,
      color: "#64748b",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Federation Dashboard
            </h1>
            <p className="text-slate-500 mt-1">
              Tunisian Rowing Federation • Season {currentSeason}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                loadAdminAnalytics();
                loadUsers();
              }}
              disabled={statsLoading || loading}
            >
              {statsLoading ? "Loading..." : "↻ Refresh"}
            </Button>
            <Button onClick={() => navigate("/register")}>+ Add User</Button>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Current Season Athletes"
          value={currentSeasonActive}
          subtitle={`${totalAthletes} total in database`}
          color="blue"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Documents Complete"
          value={seasonByStatus.active || 0}
          subtitle={`${
            currentSeasonActive - (seasonByStatus.active || 0)
          } need attention`}
          color="green"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Active Clubs"
          value={totalClubs}
          subtitle={`${clubsByType.club || 0} clubs, ${
            clubsByType.ecole_federale || 0
          } écoles, ${clubsByType.centre_de_promotion || 0} centres`}
          color="purple"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
        />
        <StatCard
          title="Need Attention"
          value={seasonAttention.total || 0}
          subtitle="Active athletes with issues"
          color="amber"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* License Status Breakdown - Current Season */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            License Status (Season {currentSeason})
          </h3>
          <div className="space-y-3">
            <ProgressBar
              label="Active"
              value={seasonByStatus.active || 0}
              total={currentSeasonActive}
              color="green"
            />
            <ProgressBar
              label="Pending Documents"
              value={seasonByStatus.pending_documents || 0}
              total={currentSeasonActive}
              color="amber"
            />
            <ProgressBar
              label="Expired Medical"
              value={seasonByStatus.expired_medical || 0}
              total={currentSeasonActive}
              color="red"
            />
            <ProgressBar
              label="Suspended"
              value={seasonByStatus.suspended || 0}
              total={currentSeasonActive}
              color="purple"
            />
            <ProgressBar
              label="Inactive"
              value={seasonByStatus.inactive || 0}
              total={currentSeasonActive}
              color="slate"
            />
          </div>
        </div>

        {/* Gender Distribution - Current Season */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Gender Distribution (Season {currentSeason})
          </h3>
          {currentSeasonActive > 0 ? (
            <>
              <DonutChart
                data={genderChartData}
                total={currentSeasonActive}
                centerLabel="Athletes"
              />
              <div className="mt-4 flex justify-center gap-6">
                {genderChartData.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-slate-600">
                      {item.label}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* Club Types */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Club Types
          </h3>
          <div className="space-y-4">
            {Object.entries(clubsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 font-semibold text-sm">
                      {count}
                    </span>
                  </div>
                  <span className="text-slate-700 capitalize">
                    {type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-sm text-slate-500">
                  {totalClubs > 0 ? Math.round((count / totalClubs) * 100) : 0}%
                </span>
              </div>
            ))}
            {Object.keys(clubsByType).length === 0 && (
              <div className="text-center text-slate-400 py-8">
                No clubs registered
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attention Required Cards - Only for Active Membership Athletes */}
      {(seasonAttention.total > 0 || (seasonByStatus.inactive || 0) > 0) && (
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">
                  {seasonAttention.pendingDocuments || 0}
                </p>
                <p className="text-sm text-amber-600">Pending Documents</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-700">
                  {seasonAttention.expiredMedical || 0}
                </p>
                <p className="text-sm text-rose-600">Expired Medical</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">
                  {seasonAttention.suspended || 0}
                </p>
                <p className="text-sm text-purple-600">Suspended</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700">
                  {seasonByStatus.inactive || 0}
                </p>
                <p className="text-sm text-slate-600">Inactive</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Overview - Historical Data */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-8">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Database Overview
              </h3>
              <p className="text-sm text-slate-500">
                Historical athlete records across all seasons
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
              All Time
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-slate-900">
              {totalAthletes.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500">Total Records</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {byGender.male || 0}
            </p>
            <p className="text-sm text-slate-500">Male Athletes</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-pink-600">
              {byGender.female || 0}
            </p>
            <p className="text-sm text-slate-500">Female Athletes</p>
          </div>
        </div>
      </div>

      {/* All Active Clubs Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-8">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Active Clubs ({totalClubs})
              </h3>
              <p className="text-sm text-slate-500">
                All active clubs sorted by type and athlete count
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/clubs")}
            >
              Manage Clubs
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Club
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Athletes
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  City
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedClubs.map((club, index) => (
                <ClubRow key={club._id} club={club} index={index} />
              ))}
              {sortedClubs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No active clubs registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => navigate("/clubs")}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900">Manage Clubs</p>
              <p className="text-xs text-slate-500">View & edit clubs</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/athletes")}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900">Athletes</p>
              <p className="text-xs text-slate-500">Search & manage</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/competitions")}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900">Competitions</p>
              <p className="text-xs text-slate-500">Events & races</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/register")}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900">Add User</p>
              <p className="text-xs text-slate-500">Create new account</p>
            </div>
          </button>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <EditUserModal
          user={editingUser}
          onClose={() => setShowEditModal(false)}
          onSave={loadUsers}
        />
      )}
    </div>
  );
}

export default Dashboard;
