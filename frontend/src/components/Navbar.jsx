import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { toast } from "react-toastify";

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      toast.success("Logged out successfully");
      navigate("/login");
    }
  };

  const role = user?.role ?? null;
  const clubId = user?.clubId ?? null;

  const roleLabelMap = {
    admin: "Admin",
    jury_president: "Jury President",
    club_manager: "Club Manager",
  };

  const roleBadgeStyles = {
    admin: "bg-rose-500/90 text-white",
    jury_president: "bg-blue-500/90 text-white",
    club_manager: "bg-emerald-500/90 text-white",
  };

  const roleChipLabel = role
    ? roleLabelMap[role] || role.replace(/_/g, " ")
    : null;
  const roleChipClass = role
    ? roleBadgeStyles[role] || "bg-slate-700 text-white"
    : null;

  const navigationSections = useMemo(() => {
    const sections = [
      {
        key: "overview",
        label: "Overview",
        links: [
          { key: "dashboard", label: "Dashboard", to: "/" },
          { key: "analytics", label: "Analytics", to: "/analytics" },
        ],
      },
      {
        key: "operations",
        label: "Athlete Ops",
        links: [
          {
            key: "add-athlete",
            label: "Add Athlete",
            to: "/athletes/new",
            roles: ["admin", "club_manager"],
          },
          {
            key: "import-athletes",
            label: "Import Athletes",
            to: "/athletes/import",
            roles: ["admin"],
          },
          {
            key: "my-club",
            label: "My Club",
            to: clubId ? `/clubs/${clubId}` : null,
            roles: ["club_manager"],
            hidden: !clubId,
          },
        ],
      },
      {
        key: "administration",
        label: "Administration",
        links: [
          {
            key: "register",
            label: "Register User",
            to: "/register",
            roles: ["admin"],
          },
          {
            key: "clubs",
            label: "Manage Clubs",
            to: "/clubs",
            roles: ["admin"],
          },
          {
            key: "categories",
            label: "Categories",
            to: "/categories",
            roles: ["admin"],
          },
          {
            key: "boat-classes",
            label: "Boat Classes",
            to: "/boat-classes",
            roles: ["admin", "jury_president"],
          },
          {
            key: "competitions",
            label: "Competitions",
            to: "/competitions",
            roles: ["admin", "jury_president", "club_manager"],
          },
          {
            key: "ranking-systems",
            label: "Ranking Systems",
            to: "/ranking-systems",
            roles: ["admin"],
          },
        ],
      },
      {
        key: "profile",
        label: "Profile",
        links: [
          {
            key: "change-password",
            label: "Change Password",
            to: "/change-password",
          },
        ],
      },
    ];

    const matchesRole = (roles) =>
      !Array.isArray(roles) || (role && roles.includes(role));

    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (link) => link.to && !link.hidden && matchesRole(link.roles)
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [role, clubId]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="border-b border-white/10 bg-slate-950 text-white shadow-lg">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex cursor-pointer items-center gap-2"
              onClick={() => navigate("/")}
            >
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-[0.28em] text-white/50">
                  TRF Portal
                </span>
                <span className="text-2xl font-semibold leading-tight text-white">
                  Federation Control Center
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  Welcome
                </span>
                <span className="text-sm font-semibold text-white">
                  {user?.firstName || "User"}
                </span>
              </div>
              {roleChipLabel ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${roleChipClass}`}
                >
                  {roleChipLabel}
                </span>
              ) : null}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-3 shadow-inner">
            {navigationSections.map((section) => (
              <div
                key={section.key}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-[0.625rem] uppercase tracking-[0.32em] text-white/50">
                  {section.label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {section.links.map((link) => (
                    <Button
                      key={link.key}
                      type="button"
                      variant="ghost"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/20 hover:bg-white/15 hover:text-white"
                      onClick={() => navigate(link.to)}
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
