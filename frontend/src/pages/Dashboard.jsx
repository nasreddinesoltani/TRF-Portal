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
import { 
  Users, 
  UserCheck, 
  AlertCircle, 
  ShieldAlert, 
  RefreshCw,
  TrendingUp,
  Award,
  ArrowRightLeft,
  Trash2,
  FileCheck,
  Plus,
  Search,
  ChevronRight,
  Clock
} from "lucide-react";

const API_BASE_URL = "";

// Modern stat card component
const StatCard = ({ title, value, subtitle, icon, color = "blue", trend }) => {
  const colorClasses = {
    blue: "bg-white border-blue-100 text-blue-700 shadow-blue-50/50",
    green: "bg-white border-emerald-100 text-emerald-700 shadow-emerald-50/50",
    amber: "bg-white border-amber-100 text-amber-700 shadow-amber-50/50",
    red: "bg-white border-rose-100 text-rose-700 shadow-rose-50/50",
    purple: "bg-white border-purple-100 text-purple-700 shadow-purple-50/50",
    indigo: "bg-white border-indigo-100 text-indigo-700 shadow-indigo-50/50",
    slate: "bg-white border-slate-100 text-slate-700 shadow-slate-50/50",
  };

  const iconBgClasses = {
    blue: "bg-blue-500 shadow-blue-200",
    green: "bg-emerald-500 shadow-emerald-200",
    amber: "bg-amber-500 shadow-amber-200",
    red: "bg-rose-500 shadow-rose-200",
    purple: "bg-purple-500 shadow-purple-200",
    indigo: "bg-indigo-500 shadow-indigo-200",
    slate: "bg-slate-500 shadow-slate-200",
  };

  return (
    <div
      className={`rounded-2xl border p-6 ${colorClasses[color]} transition-all hover:shadow-lg shadow-sm group`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">{value ?? 0}</p>
          {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`rounded-xl p-3 ${iconBgClasses[color]} text-white shadow-lg`}>
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
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
    setIsActionLoading(true);
    try {
      // Parallel fetch for better performance
      const [statsRes, clubsRes, transfersRes, deletionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/athletes/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/clubs`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/transfers`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/athlete-deletions`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (statsRes.ok) {
        setAthleteStats(await statsRes.json());
      }
      if (clubsRes.ok) {
        setClubsList(await clubsRes.json());
      }
      if (transfersRes.ok) {
        const transfers = await transfersRes.json();
        // Filter for pending status if necessary, or just store all
        setPendingTransfers(transfers.filter(t => t.status === 'pending') || []);
      }
      if (deletionsRes.ok) {
        const deletions = await deletionsRes.json();
        setPendingDeletions(deletions.filter(d => d.status === 'pending') || []);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
      toast.error("Failed to load administration data");
    } finally {
      setStatsLoading(false);
      setIsActionLoading(false);
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

    const clubStatCards = [
      { label: "Total Athletes", value: stats.totalAthletes, icon: <Users className="h-5 w-5" />, color: "blue" },
      { label: "Active Memb.", value: stats.activeMemberships, icon: <UserCheck className="h-5 w-5" />, color: "green" },
      { label: "Pending", value: stats.pendingMemberships, icon: <Clock className="h-5 w-5" />, color: "amber" },
      { label: "Inactive", value: stats.inactiveMemberships, icon: <AlertCircle className="h-5 w-5" />, color: "slate" },
      { label: "Transfers", value: stats.transferredMemberships, icon: <ArrowRightLeft className="h-5 w-5" />, color: "purple" },
    ];

    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {club?.name ? `${club.name} Dashboard` : "Club Dashboard"}
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-emerald-500" />
              Club Administration & Athlete Overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleRefresh} 
              disabled={clubLoading}
              variant="outline"
              className="bg-white hover:bg-slate-50 shadow-sm border-slate-200"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${clubLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button onClick={() => navigate(`/clubs/${clubId}`)}>Manage Club</Button>
          </div>
        </div>

        {clubError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
             <AlertCircle className="h-5 w-5" />
             <span>Error: {clubError}</span>
          </div>
        )}

        {clubLoading ? (
          <div className="flex items-center justify-center py-20">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : club ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {clubStatCards.map((card) => (
                <StatCard
                  key={card.label}
                  title={card.label}
                  value={card.value}
                  icon={card.icon}
                  color={card.color}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Recent Athletes Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-900">Recently Added Athletes</h2>
                    <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => navigate(`/clubs/${clubId}`)}>View All</Button>
                  </div>
                  {recentAthletes.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                      No athletes found in your club yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Athlete</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">License</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Added</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentAthletes.map((athlete) => (
                            <tr key={athlete.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-900">
                                {`${athlete.firstName} ${athlete.lastName}`}
                              </td>
                              <td className="px-6 py-4 text-center text-slate-600">
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{athlete.licenseNumber || "N/A"}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  athlete.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                                  athlete.status === 'pending_documents' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {athlete.status?.replace('_', ' ') || 'Pending'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-slate-500 text-sm">
                                {formatDate(athlete.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                 {/* Club Details Card */}
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="text-lg font-semibold text-slate-900">Club Information</h2>
                    </div>
                    <div className="p-6 space-y-4">
                       <div className="flex justify-between items-center pb-3 border-b border-slate-50 text-sm">
                          <span className="text-slate-500 font-medium whitespace-nowrap">Official Code</span>
                          <span className="text-slate-900 font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase">{club.code || "-"}</span>
                       </div>
                       <div className="flex justify-between items-center pb-3 border-b border-slate-50 text-sm">
                          <span className="text-slate-500 font-medium">Organization Type</span>
                          <span className="text-slate-900 font-semibold capitalize">{club.type?.replace(/_/g, " ") || "-"}</span>
                       </div>
                       <div className="flex justify-between items-center pb-3 border-b border-slate-50 text-sm">
                          <span className="text-slate-500 font-medium">Headquarters</span>
                          <span className="text-slate-900 font-semibold">{club.city || "-"}</span>
                       </div>
                       <div className="flex justify-between items-center pb-3 border-b border-slate-50 text-sm">
                          <span className="text-slate-500 font-medium">Primary Email</span>
                          <span className="text-slate-900 text-right truncate ml-4" title={club.email}>{club.email || "N/A"}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Season Activation</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${club.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {club.isActive ? "ACTIVE" : "EXPIRED"}
                          </span>
                       </div>
                    </div>
                 </div>

                 {/* Manager Info Card */}
                 <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm uppercase font-bold text-lg">
                        {managerInfo?.firstName?.charAt(0)}{managerInfo?.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/70 leading-none">Club Manager</p>
                        <p className="font-bold text-lg mt-1">{managerInfo?.firstName} {managerInfo?.lastName}</p>
                      </div>
                    </div>
                    <div className="space-y-4 text-sm mt-8 border-t border-white/10 pt-4">
                       <div className="flex items-center gap-3">
                          <Plus className="h-4 w-4 text-white/60" />
                          <span className="text-white/90">Email: {managerInfo?.email || "N/A"}</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <Plus className="h-4 w-4 text-white/60" />
                          <span className="text-white/90">Joined: {formatDate(managerInfo?.createdAt)}</span>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-slate-600 bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
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
      {/* Action Center - Urgent Tasks */}
      {(seasonAttention.pendingDocuments > 0 || pendingTransfers.length > 0 || pendingDeletions.length > 0) && (
        <div className="mb-8 p-6 bg-white rounded-2xl border border-red-100 shadow-sm shadow-red-50">
          <div className="flex items-center gap-2 mb-4 text-red-600 font-bold uppercase tracking-wider text-xs">
            <ShieldAlert className="h-4 w-4" />
            Action Required
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {seasonAttention.pendingDocuments > 0 && (
              <div 
                className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => navigate('/clubs')}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 text-white p-2 rounded-lg">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">{seasonAttention.pendingDocuments} Athletes</p>
                    <p className="text-xs text-amber-700 font-medium">Documents need verification</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </div>
            )}
            
            {pendingTransfers.length > 0 && (
              <div 
                className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => navigate('/clubs')}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 text-white p-2 rounded-lg">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">{pendingTransfers.length} Transfers</p>
                    <p className="text-xs text-blue-700 font-medium">Pending approval</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-blue-400" />
              </div>
            )}

            {pendingDeletions.length > 0 && (
              <div 
                className="flex items-center justify-between p-4 bg-rose-50 rounded-xl border border-rose-100 cursor-pointer hover:bg-rose-100 transition-colors"
                onClick={() => navigate('/clubs')}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500 text-white p-2 rounded-lg">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-rose-900">{pendingDeletions.length} Deletions</p>
                    <p className="text-xs text-rose-700 font-medium">Requested removals</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Federation Overview - Primary Season Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard
          title="Total Athletes"
          value={currentSeasonActive}
          subtitle={`Total for Season ${currentSeason}`}
          color="blue"
          icon={<Users className="h-6 w-6" />}
        />
        <StatCard
          title="Active Memb."
          value={seasonByStatus.active || 0}
          subtitle="Licensed & Verified"
          color="green"
          icon={<UserCheck className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Docs"
          value={seasonByStatus.pending_documents || 0}
          subtitle="Awaiting Verification"
          color="amber"
          icon={<Clock className="h-6 w-6" />}
        />
        <StatCard
          title="Active Clubs"
          value={totalClubs}
          subtitle="Federation Entities"
          color="purple"
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatCard
          title="Attention"
          value={seasonAttention.total || 0}
          subtitle="Urgent Issues"
          color="red"
          icon={<AlertCircle className="h-6 w-6" />}
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
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl shadow-xl mb-8 overflow-hidden text-white border border-slate-800">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Federation Historical Overview</h3>
            <p className="text-slate-400 text-sm mt-1">Growth and data points since establishment</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider">All-Time Statistics</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="p-8 group hover:bg-white/5 transition-colors">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Athletes</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black">{totalAthletes.toLocaleString()}</span>
              <TrendingUp className="h-6 w-6 text-emerald-400 mb-1" />
            </div>
            <p className="text-slate-500 text-xs mt-3">Registered across all seasons and clubs</p>
          </div>
          <div className="p-8 group hover:bg-white/5 transition-colors">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Male Demographic</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black">{byGender.male || 0}</span>
              <div className="h-2 w-24 bg-white/10 rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${totalAthletes > 0 ? (byGender.male / totalAthletes) * 100 : 0}%` }}></div>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-3">{totalAthletes > 0 ? Math.round((byGender.male/totalAthletes)*100) : 0}% of total distribution</p>
          </div>
          <div className="p-8 group hover:bg-white/5 transition-colors">
            <p className="text-pink-400 text-xs font-bold uppercase tracking-widest mb-2">Female Demographic</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black">{byGender.female || 0}</span>
              <div className="h-2 w-24 bg-white/10 rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-pink-500" style={{ width: `${totalAthletes > 0 ? (byGender.female / totalAthletes) * 100 : 0}%` }}></div>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-3">{totalAthletes > 0 ? Math.round((byGender.female/totalAthletes)*100) : 0}% of total distribution</p>
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
