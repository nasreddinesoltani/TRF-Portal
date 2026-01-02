# ⚡ Quick Reference - Start the TRF Portal

## 🚀 Start Both Servers (Recommended)

### PowerShell / Command Prompt

```powershell
# Open Terminal 1: Backend Server
cd d:\TRF-Portal\backend
npm start

# Open Terminal 2: Frontend Server
cd d:\TRF-Portal\frontend
npm run dev

# Then open browser:
# Frontend: http://localhost:5174
# Backend: http://localhost:5000
```

---

## 📝 Login Credentials

```
Email:    demo@example.com
Password: password123
```

---

## 🎯 Test the Export Feature

1. **Open Dashboard**

   - Go to http://localhost:5174
   - Login with demo credentials
   - Click "Dashboard" from navbar

2. **Test PDF Export**

   - Scroll down to "Export Data" section
   - Click "📄 Export PDF"
   - File downloads to Downloads folder
   - Check: `TRF-Portal-Users-YYYY-MM-DD.pdf`

3. **Test Excel Export**

   - Click "📊 Export Excel"
   - File downloads to Downloads folder
   - Check: `TRF-Portal-Users-YYYY-MM-DD.csv`

4. **Test JSON Export**

   - Click "📋 Export JSON"
   - File downloads to Downloads folder
   - Check: `TRF-Portal-Users-YYYY-MM-DD.json`

5. **Test Filtering**
   - Type in search box (e.g., "demo")
   - Select category filter
   - Click export button
   - Verify only filtered data exports

---

## 📁 Project Structure

```
d:\TRF-Portal\
├── backend/                 # Node.js Express server
│   ├── server.js
│   ├── package.json
│   ├── config/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Models/
│   └── Routes/
│
├── frontend/                # React Vite app
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── lib/
│   │   │   ├── exportUtils.js      ← Export functions (NEW)
│   │   │   └── utils.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── Documentation files (README, GUIDES, etc)
```

---

## 🔗 Important Files for Export

### Export Functions

- `frontend/src/lib/exportUtils.js` - Contains all export logic

### Dashboard Integration

- `frontend/src/pages/Dashboard.jsx` - Import and use export functions

### Enhanced Grid

- `frontend/src/components/DataGrid.jsx` - Syncfusion grid with export

---

## 📊 API Endpoints

### Public (No Auth Required)

```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
```

### Protected (JWT Required)

```
GET    /api/users
PUT    /api/users/:id
DELETE /api/users/:id
```

---

## 🧪 Test With Curl

### Login

```powershell
curl -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"demo@example.com","password":"password123"}'
```

### Get Users (requires token)

```powershell
# First get token from login above, then:
curl -X GET http://localhost:5000/api/users `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🛠️ Environment Setup

### Backend `.env`

```
PORT=5000
URL_DB=mongodb+srv://[credentials]@cluster0.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345678901234567890
```

### Frontend (Vite)

- Base URL: http://localhost:5174
- API Base: http://localhost:5000
- Configured in axios interceptors

---

## 📦 npm Commands

### Backend

```powershell
cd backend
npm install        # Install dependencies
npm start         # Start server
npm run dev       # Dev mode
```

### Frontend

```powershell
cd frontend
npm install       # Install dependencies
npm run dev       # Start Vite dev server
npm run build     # Build for production
npm run preview   # Preview production build
```

---

## 🔍 Debugging

### Enable Console Logs

- Backend: Check terminal where `npm start` runs
- Frontend: Open DevTools (F12) → Console tab

### Check Network Requests

- Frontend: DevTools → Network tab
- See all API calls and responses

### Database Connection

- MongoDB Compass: Connect to your cluster
- Check collections and documents

---

## 📱 Browser DevTools

### Check Authentication

```javascript
// In Console tab:
localStorage.getItem("token"); // Should show JWT token
localStorage.getItem("user"); // Should show user data
```

### Test Export Functions

```javascript
// In Console tab:
// These won't work directly as they depend on page context
// But you can verify they're imported
```

---

## ✅ Verification Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend server running on port 5174
- [ ] Can login with demo@example.com / password123
- [ ] Dashboard shows users from database
- [ ] Filters work in real-time
- [ ] Analytics dashboard displays charts
- [ ] Export buttons visible in dashboard
- [ ] PDF export downloads file
- [ ] Excel export downloads file
- [ ] JSON export downloads file
- [ ] Toast notifications appear
- [ ] Files have today's date in name

---

## 🚨 Common Issues

### Port Already in Use

```powershell
# Find process using port
netstat -ano | findstr :5000
netstat -ano | findstr :5174

# Kill process (if needed)
taskkill /PID <PID> /F
```

### MongoDB Connection Failed

- Check MongoDB Atlas cluster is running
- Verify credentials in .env
- Check IP whitelist in MongoDB Atlas

### CORS Error

- Backend server must be running
- Must login first (get token)
- Token must be in Authorization header

### Export Not Working

- Ensure data is loaded in grid
- Try clearing filters first
- Check browser console for errors
- Verify jsPDF library installed

---

## 📊 Example: Full Test Workflow

```
1. Start backend (Terminal 1):
   cd d:\TRF-Portal\backend
   npm start

2. Start frontend (Terminal 2):
   cd d:\TRF-Portal\frontend
   npm run dev

3. Open browser:
   http://localhost:5174

4. Login:
   Email: demo@example.com
   Password: password123

5. Wait for dashboard to load

6. See users in grid

7. Try filters:
   - Search for "demo"
   - Select category filter
   - Select gender filter

8. Click export buttons:
   - PDF exports professional report
   - Excel exports CSV spreadsheet
   - JSON exports raw data

9. Check Downloads folder:
   - TRF-Portal-Users-2024-10-24.pdf
   - TRF-Portal-Users-2024-10-24.csv
   - TRF-Portal-Users-2024-10-24.json

10. Open files in appropriate programs:
    - PDF → Any PDF reader
    - CSV → Excel / Google Sheets
    - JSON → Text editor

11. Verify data matches what you see on dashboard

✅ Export feature is working!
```

---

## 🎓 Learn More

### Read These Files

- `README.md` - Overview
- `SYSTEM_STATUS.md` - Current system status
- `EXPORT_COMPLETE.md` - Export feature details
- `PDF_EXPORT_GUIDE.md` - Complete export guide
- `API_DOCUMENTATION.md` - All API endpoints
- `SYSTEM_OVERVIEW.md` - Architecture

---

## 💡 Pro Tips

1. **Speed Up Testing**

   - Use keyboard shortcuts
   - Ctrl+K in Dashboard for quick search
   - Tab to navigate between fields

2. **Monitor API Calls**

   - Open DevTools Network tab
   - See all requests/responses
   - Check status codes

3. **Create More Test Users**

   - Use Register form
   - Fill all 18 fields
   - Use unique email addresses

4. **Analyze Data**

   - Export to Excel
   - Use pivot tables
   - Create charts

5. **Integrate with Other Systems**
   - Export JSON
   - Parse in your app
   - Use in integrations

---

## 📞 Quick Help

**Something not working?**

1. Check if both servers are running
2. Try refreshing the page
3. Clear browser cache (Ctrl+Shift+Delete)
4. Check browser console (F12)
5. Check backend console
6. Verify credentials are correct
7. Try a different browser

---

**Status:** ✅ Ready to Use  
**Last Updated:** Today  
**All Features:** ✅ Working
