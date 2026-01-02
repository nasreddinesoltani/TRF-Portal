import fs from "fs";
import jwt from "jsonwebtoken";

const secret =
  "your_super_secret_jwt_key_change_this_in_production_12345678901234567890";
const token = jwt.sign(
  { id: "000000000000000000000000", role: "admin" },
  secret,
  { expiresIn: "1h" }
);

const fileBuffer = fs.readFileSync("d:/TRF-Portal/temp-import.csv");
const blob = new Blob([fileBuffer], { type: "text/csv" });
const form = new FormData();
form.append("file", blob, "temp-import.csv");

const response = await fetch("http://localhost:5000/api/athletes/import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});

console.log("status", response.status);
const text = await response.text();
console.log("body", text);
