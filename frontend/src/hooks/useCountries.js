import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE_URL = "";
let globalCache = null;

export const useCountries = () => {
  const { token } = useAuth();
  const [countries, setCountries] = useState(() => globalCache || []);
  const [loading, setLoading] = useState(!globalCache);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token || fetchedRef.current) return;
    if (globalCache) {
      setCountries(globalCache);
      setLoading(false);
      return;
    }
    fetchedRef.current = true;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/countries`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        globalCache = list;
        setCountries(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getCountry = useCallback(
    (code) => {
      if (!code) return null;
      const c = countries.find(
        (c) => c.code === code || c.iocCode === code,
      );
      return c || null;
    },
    [countries],
  );

  const countryLabel = useCallback(
    (code) => {
      const c = getCountry(code);
      return c?.names?.en || code || "-";
    },
    [getCountry],
  );

  const countryFlag = useCallback(
    (code) => {
      const c = getCountry(code);
      if (c?.flagUrl) return c.flagUrl;
      if (c?.codeAlpha2)
        return `https://flagcdn.com/24x18/${c.codeAlpha2.toLowerCase()}.png`;
      return null;
    },
    [getCountry],
  );

  const countryFederation = useCallback(
    (code) => {
      const c = getCountry(code);
      return c?.federationNames?.en || c?.federationCode || null;
    },
    [getCountry],
  );

  return { countries, loading, getCountry, countryLabel, countryFlag, countryFederation };
};
