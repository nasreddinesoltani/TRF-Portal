# TRF Portal API Documentation

## Base URL

```
http://localhost:5000
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Public Endpoints

### 1. User Registration

**POST** `/api/auth/register`

**Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "firstNameAr": "جون",
  "lastNameNameAr": "دو",
  "birthDate": "1990-01-01",
  "gender": "homme",
  "category": "etudiant",
  "cin": "12345678",
  "phone": "+216123456789",
  "address": "123 Main St",
  "city": "Tunis",
  "postalCode": "1000",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    /* full user object */
  }
}
```

### 2. User Login

**POST** `/api/auth/login`

**Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "user",
    "isAdmin": false
  }
}
```

**Error (401):**

```json
{
  "message": "Invalid email or password"
}
```

### 3. User Logout

**POST** `/api/auth/logout`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "Logged out successfully"
}
```

---

## Protected Endpoints (Require JWT Token)

### 4. Get All Users

**GET** `/api/users`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "gender": "homme",
    "category": "etudiant",
    "city": "Tunis",
    "phone": "+216123456789",
    "createdAt": "2024-10-24T12:00:00Z",
    "updatedAt": "2024-10-24T12:00:00Z"
    /* ... other fields ... */
  }
]
```

### 5. Update User

**PUT** `/api/users/:id`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:** (Only send fields to update)

```json
{
  "firstName": "Jane",
  "city": "Sfax"
}
```

**Response (200):**

```json
{
  "message": "User updated successfully",
  "user": {
    /* updated user object */
  }
}
```

**Error (404):**

```json
{
  "message": "User not found"
}
```

### 6. Delete User

**DELETE** `/api/users/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "User deleted successfully"
}
```

**Error (404):**

```json
{
  "message": "User not found"
}
```

---

## Error Responses

### 400 - Bad Request

```json
{
  "message": "Please provide all required fields"
}
```

### 401 - Unauthorized

```json
{
  "message": "Not authorized to access this route"
}
```

### 403 - Forbidden

```json
{
  "message": "User account is deactivated"
}
```

### 500 - Server Error

```json
{
  "message": "Error message details"
}
```

---

## Testing with cURL

### Register a User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "firstNameAr": "جون",
    "lastNameNameAr": "دو",
    "birthDate": "1990-01-01",
    "gender": "homme",
    "category": "etudiant",
    "cin": "12345678",
    "phone": "+216123456789",
    "address": "123 Main St",
    "city": "Tunis",
    "postalCode": "1000",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get All Users (with token)

```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Update User

```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane"
  }'
```

### Delete User

```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Token Details

- **Algorithm**: HS256
- **Expiration**: 7 days
- **Secret**: Set in `backend/.env` as `JWT_SECRET`
- **Payload Includes**:
  - `id`: User MongoDB ID
  - `email`: User email
  - `role`: User role (admin, user, guest)

---

## Status Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 200  | OK - Request successful                 |
| 201  | Created - Resource created successfully |
| 400  | Bad Request - Invalid input             |
| 401  | Unauthorized - Missing/invalid token    |
| 403  | Forbidden - User deactivated            |
| 404  | Not Found - Resource not found          |
| 500  | Server Error - Internal error           |

---

## Notes

1. **Password Security**: Passwords are hashed using bcryptjs with 10 salt rounds
2. **Token Storage**: Frontend stores token in localStorage for automatic API requests
3. **CORS**: Backend allows all origins (can be restricted in production)
4. **Rate Limiting**: Not implemented (recommended for production)
5. **Audit Logs**: Not implemented (recommended for production)
6. **Input Validation**: Basic validation on required fields
7. **Email Validation**: Unique email constraint at database level
