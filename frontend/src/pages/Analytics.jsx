import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  Users, 
  UserCheck, 
  AlertCircle, 
  ShieldAlert, 
  RefreshCw,
  TrendingUp,
  Award
} from "lucide-react";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = "";
      let url = `${API_BASE_URL}/api/athletes/stats`;
      
      // Club managers always get their club's stats enforced by backend,
      // but we can be explicit if we want to allow admins to filter too.
      if (user?.role === 'club_manager' && user.clubId) {
        url += `?clubId=${user.clubId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast.error("Failed to load analytics data");
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Error loading analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    const loadingText = user?.role === 'club_manager' ? "Crunching club data..." : "Crunching federation data...";
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const currentSeason = stats.currentSeason;
  const seasonStats = stats.season || {};
  const isClubView = stats.isClubFiltered;
  const displayName = isClubView ? stats.clubName || "Club" : "Federation";
  
  // Chart Data: License Status
  const statusData = [
    { name: "Active", value: seasonStats.byStatus?.active || 0 },
    { name: "Pending Docs", value: seasonStats.byStatus?.pending_documents || 0 },
    { name: "Expired Medical", value: seasonStats.byStatus?.expired_medical || 0 },
    { name: "Suspended", value: seasonStats.byStatus?.suspended || 0 },
    { name: "Inactive", value: seasonStats.byStatus?.inactive || 0 },
  ].filter(d => d.value > 0);

  // Chart Data: Gender
  const genderData = [
    { name: "Male", value: seasonStats.byGender?.male || 0 },
    { name: "Female", value: seasonStats.byGender?.female || 0 },
  ].filter(d => d.value > 0);

  const metricCards = [
    {
      title: "Season Total",
      value: seasonStats.total || 0,
      subtitle: `Registrations for ${currentSeason}`,
      icon: <Users className="h-5 w-5" />,
      color: "bg-blue-500",
    },
    {
      title: "Active Memb.",
      value: seasonStats.byStatus?.active || 0,
      subtitle: "Licensed & Verified",
      icon: <UserCheck className="h-5 w-5" />,
      color: "bg-emerald-500",
    },
    {
      title: "Pending Docs",
      value: seasonStats.byStatus?.pending_documents || 0,
      subtitle: "Awaiting approval",
      icon: <RefreshCw className="h-5 w-5" />,
      color: "bg-amber-500",
    },
    {
      title: "Attention Required",
      value: seasonStats.attention?.total || 0,
      subtitle: "Issues to resolve",
      icon: <AlertCircle className="h-5 w-5" />,
      color: "bg-rose-500",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{displayName} Analytics</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {isClubView ? `Insights for ${displayName} - ${currentSeason} Season` : `Comprehensive insights for the ${currentSeason} Season`}
          </p>
        </div>
        <Button 
          onClick={loadAnalyticsData} 
          variant="outline" 
          className="bg-white hover:bg-slate-50 shadow-sm border-slate-200"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metricCards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <h3 className="text-3xl font-bold text-slate-900 mt-1">{card.value}</h3>
                <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
              </div>
              <div className={`${card.color} p-3 rounded-xl text-white shadow-lg shadow-${card.color.split('-')[1]}-200`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* License Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">License Status Distribution</h2>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Season {currentSeason}</div>
          </div>
          <div className="h-80 w-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Distribution Pie */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Gender Balance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#ec4899"} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {genderData.map((item, idx) => {
              const totalGenders = genderData.reduce((acc, curr) => acc + curr.value, 0);
              const percent = totalGenders > 0 ? Math.round((item.value / totalGenders) * 100) : 0;
              return (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.name === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-700 w-8 text-right">{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attention Items Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-500/20 p-2 rounded-lg">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold">Security & Compliance</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Pending Documents</p>
                <p className="text-2xl font-bold mt-0.5">{seasonStats.attention?.pendingDocuments || 0}</p>
              </div>
              <div className="h-10 w-10 flex items-center justify-center bg-white/10 rounded-full">
                <RefreshCw className="h-4 w-4 text-slate-300" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Expired Medicals</p>
                <p className="text-2xl font-bold mt-0.5">{seasonStats.attention?.expiredMedical || 0}</p>
              </div>
              <div className="h-10 w-10 flex items-center justify-center bg-white/10 rounded-full">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-slate-400 text-xs leading-relaxed">
                Ensure all athletes have uploaded valid documentation before the next competition starts. Unverified athletes will be ineligible to register for upcoming races.
              </p>
            </div>
          </div>
        </div>

        {/* Clubs Participation (Summary) - Only show for global view */}
        {!isClubView && (
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
             <h2 className="text-lg font-semibold text-slate-900 mb-6">Club Ecosystem</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">Active Clubs</p>
                  <p className="text-3xl font-black text-blue-900 mt-1">{stats.uniqueClubs}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 md:col-span-2">
                   <p className="text-purple-600 text-xs font-bold uppercase tracking-wider">Season Licensing Efficiency</p>
                   <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-black text-purple-900">
                         {seasonStats.total > 0 ? Math.round(((seasonStats.byStatus?.active || 0) / seasonStats.total) * 100) : 0}%
                      </p>
                      <p className="text-purple-500 text-sm mb-1 font-medium pb-0.5">Ratio of verified licenses for {currentSeason}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Efficiency Card for Club View */}
        {isClubView && (
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
             <h2 className="text-lg font-semibold text-slate-900 mb-6">Licensing Status</h2>
             <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                <p className="text-purple-600 text-xs font-bold uppercase tracking-wider">Club Licensing Efficiency</p>
                <div className="flex items-end gap-4 mt-2">
                   <p className="text-5xl font-black text-purple-900">
                      {seasonStats.total > 0 ? Math.round(((seasonStats.byStatus?.active || 0) / seasonStats.total) * 100) : 0}%
                   </p>
                   <div>
                      <p className="text-purple-700 font-semibold">Verified License Ratio</p>
                      <p className="text-purple-500 text-sm">Percentage of athletes fully verified for the {currentSeason} season.</p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;

