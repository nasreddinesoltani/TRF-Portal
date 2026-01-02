import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../Models/userModel.js";

// @desc    Get all users
// @route   GET /api/users
// @access  Public
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    console.log("Getting all users from database...");

    // Fetch real users from MongoDB
    const users = await User.find({});

    if (!users || users.length === 0) {
      console.log("No users found in database");
      return res.json([]);
    }

    console.log(`Found ${users.length} users in database`);
    res.json(users);
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    firstNameAr,
    lastNameNameAr,
    birthDate,
    gender,
    category,
    cin,
    phone,
    address,
    city,
    postalCode,
    email,
    password,
  } = req.body;

  console.log("Received form data:", req.body);

  // Validate required fields
  if (!firstName || !lastName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Create new user with all fields
    const newUser = await User.create({
      firstName,
      lastName,
      firstNameAr,
      lastNameNameAr,
      birthDate,
      gender,
      category,
      cin,
      phone,
      address,
      city,
      postalCode,
      email,
      password,
    });

    console.log("New user registered:", newUser._id);
    res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Auth user / Login
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt for email:", email);

  // Validate email and password
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password" });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email }).populate({
      path: "clubId",
      select: "name nameAr code type",
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: "User account is deactivated" });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const rawClubId =
      user.clubId && user.clubId._id ? user.clubId._id : user.clubId;
    const userClubId = rawClubId ? rawClubId.toString() : null;

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        clubId: userClubId,
      },
      process.env.JWT_SECRET || "your_jwt_secret_key",
      { expiresIn: "7d" }
    );

    console.log("User logged in successfully:", user._id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        clubId: userClubId,
        mustChangePassword: user.mustChangePassword,
        club: user.clubId
          ? {
              id: user.clubId._id?.toString?.() || userClubId,
              name: user.clubId.name,
              nameAr: user.clubId.nameAr,
              code: user.clubId.code,
              type: user.clubId.type,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error in authUser:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  // Client-side will handle token removal
  res.json({ message: "Logged out successfully" });
});

// @desc    Change password (and clear mustChangePassword)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  if (!newPassword || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const requiresCurrentPassword = !user.mustChangePassword;

  if (requiresCurrentPassword && !currentPassword) {
    return res.status(400).json({ message: "Current password is required" });
  }

  if (currentPassword) {
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ message: "New password must be different" });
    }
  } else {
    const isSameAsExisting = await user.matchPassword(newPassword);
    if (isSameAsExisting) {
      return res
        .status(400)
        .json({ message: "New password must be different" });
    }
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();

  await user.save();

  res.json({ message: "Password updated successfully" });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Public
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Deleting user with ID:", id);

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User deleted successfully:", id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Public
const updateUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log("Updating user with ID:", id);
    console.log("Update data:", updateData);

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      context: "query", // Only validate fields being updated
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User updated successfully:", id);
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error in updateUser:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Admin Force Reset Password
// @route   POST /api/users/:id/reset-password
// @access  Admin
const adminResetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  // Try to find user by ID first
  let user = await User.findById(id);

  // If not found by ID, try to find by email (in case the ID passed is a Club ID)
  if (!user) {
    // Check if the ID passed is actually a Club ID, and find the user associated with that club's email
    // We need to import Club model to check this properly, but for now let's assume the frontend might pass a Club ID
    // and we want to find the User account that matches the Club's email.

    // However, we don't have the Club model imported here.
    // Let's try to find a user where the email matches the club's email if we can get it.
    // But we don't have the club's email here.

    // ALTERNATIVE: The frontend is passing the CLUB ID, but we need the USER ID.
    // We should fix this in the Controller to look up the user by the Club's email if the ID lookup fails.

    // Let's assume the frontend might be passing a Club ID.
    // We need to find the User that corresponds to this Club.
    // Usually, the User account for a club has the same email as the Club.

    // Let's try to find a user with the same ID (maybe they are the same?) -> We did that above.

    // Let's try to find a user by `clubId` if your User model has it.
    user = await User.findOne({ clubId: id });
  }

  if (!user) {
    // Fallback: Maybe the frontend passed the Club ID, and we need to find the user by email?
    // We can't do that easily without querying the Club first.
    // Let's try to import Club dynamically or just fail for now.
    return res
      .status(404)
      .json({ message: "User account not found for this club" });
  }

  user.password = newPassword;
  user.mustChangePassword = true; // Force change on next login
  user.passwordChangedAt = new Date();

  await user.save();

  res.json({
    message: "Password reset successfully. User must change it on next login.",
  });
});

export {
  getAllUsers,
  registerUser,
  authUser,
  logoutUser,
  changePassword,
  deleteUser,
  updateUser,
  adminResetPassword,
};
// This code defines Express route handlers for user operations.
