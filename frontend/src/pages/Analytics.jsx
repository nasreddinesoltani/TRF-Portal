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
import { format, subDays } from "date-fns";

const COLORS = ["#000000", "#333333", "#666666", "#999999"];

export const Analytics = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      const API_BASE_URL = "";
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
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

  // Calculate statistics
  const totalUsers = users.length;

  const categoryStats = users.reduce((acc, user) => {
    const category = user.category || "Unknown";
    const existing = acc.find((item) => item.name === category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: category, value: 1 });
    }
    return acc;
  }, []);

  const genderStats = users.reduce((acc, user) => {
    const gender =
      user.gender === "homme"
        ? "Male"
        : user.gender === "femme"
        ? "Female"
        : "Unknown";
    const existing = acc.find((item) => item.name === gender);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: gender, value: 1 });
    }
    return acc;
  }, []);

  // Top cities
  const cityStats = users
    .reduce((acc, user) => {
      const city = user.city || "Unknown";
      const existing = acc.find((item) => item.name === city);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: city, value: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Registration timeline (last 7 days)
  const getRegistrationTimeline = () => {
    const timeline = {};
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "MMM dd");
      timeline[date] = 0;
    }

    users.forEach((user) => {
      if (user.createdAt) {
        const date = format(new Date(user.createdAt), "MMM dd");
        if (timeline.hasOwnProperty(date)) {
          timeline[date] += 1;
        }
      }
    });

    return Object.entries(timeline).map(([date, count]) => ({
      date,
      registrations: count,
    }));
  };

  const registrationTimeline = getRegistrationTimeline();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">User statistics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-black text-white p-6 rounded-lg">
          <p className="text-gray-300 text-sm">Total Users</p>
          <p className="text-3xl font-bold">{totalUsers}</p>
        </div>

        <div className="bg-gray-800 text-white p-6 rounded-lg">
          <p className="text-gray-300 text-sm">Students</p>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.category === "etudiant").length}
          </p>
        </div>

        <div className="bg-gray-700 text-white p-6 rounded-lg">
          <p className="text-gray-300 text-sm">Teachers</p>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.category === "enseignant").length}
          </p>
        </div>

        <div className="bg-gray-600 text-white p-6 rounded-lg">
          <p className="text-gray-300 text-sm">Others</p>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.category === "autre").length}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Category Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Users by Category</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryStats.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gender Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Users by Gender</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={genderStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#000000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Registration Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Registrations (Last 7 Days)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={registrationTimeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="registrations"
              stroke="#000000"
              strokeWidth={2}
              dot={{ fill: "#000000" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Cities */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Top Cities ({cityStats.length})
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={cityStats}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" />
            <Tooltip />
            <Bar dataKey="value" fill="#000000" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <Button onClick={loadAnalyticsData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Analytics"}
        </Button>
      </div>
    </div>
  );
};

export default Analytics;
