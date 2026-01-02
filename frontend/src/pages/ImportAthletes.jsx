import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";

const API_BASE_URL = "";

const templateHeaders = [
  "licenseNumber",
  "clubCode",
  "firstName",
  "lastName",
  "firstNameAr",
  "lastNameAr",
  "birthDate",
  "gender",
  "nationality",
  "cin",
  "passportNumber",
  "season",
  "membershipStatus",
];

const ImportAthletes = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [syncingCounter, setSyncingCounter] = useState(false);
  const [licenseCounterValue, setLicenseCounterValue] = useState(null);

  const downloadTemplate = () => {
    const headerRow = `${templateHeaders.join(",")}`;
    const sampleRow =
      "12345-25,CLUB01,John,Doe,جون,دو,1995-04-15,male,Tunisia,AA123456,AB789101,2025,active";
    const csvContents = `${headerRow}\n${sampleRow}\n`;
    const blob = new Blob([csvContents], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "athletes-import-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      toast.error("Please choose a CSV file to import");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/athletes/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Import failed");
      }

      toast.success(data.message || "Import completed");
      setResult(data);
    } catch (error) {
      console.error("Failed to import athletes", error);
      toast.error(error.message || "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => result?.summary, [result]);

  const handleSyncLicenseCounter = async () => {
    if (!token) {
      toast.error("Authentication required");
      return;
    }

    try {
      setSyncingCounter(true);
      const response = await fetch(
        `${API_BASE_URL}/api/athletes/license-counter/sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
        setLicenseCounterValue(data.sequenceValue);
      } else {
        toast.error(data.message || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error", error);
      toast.error("Failed to sync license counter");
    } finally {
      setSyncingCounter(false);
    }
  };

  const [statusFile, setStatusFile] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusSeason, setStatusSeason] = useState(new Date().getFullYear());

  const handleStatusFileChange = (event) => {
    setStatusFile(event.target.files?.[0] ?? null);
    setStatusResult(null);
  };

  const handleStatusSubmit = async (event) => {
    event.preventDefault();

    if (!statusFile) {
      toast.error("Please choose a CSV file for status update");
      return;
    }

    const formData = new FormData();
    formData.append("file", statusFile);
    formData.append("season", statusSeason);

    setStatusSubmitting(true);
    setStatusResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/athletes/bulk-status-update`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Update failed");
      }

      toast.success(data.message || "Update completed");
      setStatusResult(data);
    } catch (error) {
      console.error("Failed to update statuses", error);
      toast.error(error.message || "Update failed");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const downloadStatusTemplate = () => {
    const headerRow = "licenseNumber";
    const sampleRow = "12345-25";
    const csvContents = `${headerRow}\n${sampleRow}\n`;
    const blob = new Blob([csvContents], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "status-update-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Import Athletes</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Bulk Import (New Athletes)
        </h2>
        <p className="mb-4 text-gray-600">
          Upload a CSV file to import multiple athletes at once.
        </p>

        <div className="mb-6">
          <Button variant="outline" onClick={downloadTemplate} className="mb-4">
            Download CSV Template
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="ml-3"
            onClick={handleSyncLicenseCounter}
            disabled={syncingCounter}
          >
            {syncingCounter ? "Syncing counter..." : "Sync license counter"}
          </Button>
          {licenseCounterValue !== null ? (
            <span className="ml-3 text-sm text-gray-500">
              Current sequence: <strong>{licenseCounterValue}</strong>
            </span>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-5 space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={submitting}
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Importing..." : "Run Import"}
            </Button>
            {file && !submitting ? (
              <span className="text-sm text-gray-500">
                Ready to upload: <strong>{file.name}</strong>
              </span>
            ) : null}
          </div>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded border">
            <h3 className="font-semibold mb-2">Import Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Total Processed: {summary?.total ?? 0}</div>
              <div className="text-green-600">
                Created: {summary?.created ?? 0}
              </div>
              <div className="text-blue-600">
                Updated: {summary?.updated ?? 0}
              </div>
              <div className="text-red-600">Failed: {summary?.failed ?? 0}</div>
              <div className="text-amber-600">
                Skipped: {summary?.skipped ?? 0}
              </div>
            </div>
            {summary?.errors?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-600 mb-2">
                  Errors ({summary.errors.length}):
                </h4>
                <ul className="list-disc list-inside text-sm text-red-600 max-h-60 overflow-y-auto bg-red-50 p-3 rounded">
                  {summary.errors.map((error, index) => (
                    <li key={index}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Bulk Status Update (Active/Eligible)
        </h2>
        <p className="mb-4 text-gray-600">
          Upload a CSV file with license numbers to set athletes as active,
          eligible, and verify their documents for the specified season.
        </p>

        <div className="mb-6">
          <Button
            variant="outline"
            onClick={downloadStatusTemplate}
            className="mb-4"
          >
            Download Template (License Only)
          </Button>
        </div>

        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Season Year
            </label>
            <input
              type="number"
              value={statusSeason}
              onChange={(e) => setStatusSeason(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="YYYY"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleStatusFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <Button type="submit" disabled={!statusFile || statusSubmitting}>
            {statusSubmitting ? "Updating..." : "Update Statuses"}
          </Button>
        </form>

        {statusResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded border">
            <h3 className="font-semibold mb-2">Update Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Total Processed: {statusResult.results?.total ?? 0}</div>
              <div className="text-green-600">
                Updated: {statusResult.results?.updated ?? 0}
              </div>
              <div className="text-red-600">
                Not Found: {statusResult.results?.notFound ?? 0}
              </div>
            </div>
            {statusResult.results?.errors?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                <ul className="list-disc list-inside text-sm text-red-600 max-h-40 overflow-y-auto">
                  {statusResult.results.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          License Counter Management
        </h2>
        <p className="mb-4 text-gray-600">
          Manage the license counter used for generating athlete license
          numbers.
        </p>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleSyncLicenseCounter}
            disabled={syncingCounter}
          >
            {syncingCounter ? "Syncing..." : "Sync License Counter"}
          </Button>
          {licenseCounterValue !== null && (
            <span className="text-sm text-gray-500">
              Current License Counter:{" "}
              <strong className="text-gray-800">{licenseCounterValue}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportAthletes;
