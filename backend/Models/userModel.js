import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: false,
    },
    firstNameAr: {
      type: String,
      required: false,
    },
    lastNameNameAr: {
      type: String,
      required: false,
    },
    birthDate: {
      type: Date,
      required: false,
    },

    gender: {
      type: String,
      enum: ["homme", "femme"], // Define
      required: false,
    },
    category: {
      type: String,
      enum: ["etudiant", "enseignant", "autre"], // Define categories
      required: false,
    },
    licence: {
      type: String,
      required: false, // Licence is optional
      unique: true, // Ensure that licence is unique
    },
    club: {
      type: String,
      required: false, // Club is optional (legacy text field)
    },
    clubAr: {
      type: String,
      required: false, // Club in Arabic is optional
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    photo: {
      type: String,
      required: false, // Photo is optional
    },

    email: {
      type: String,
      required: false,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true, // Default to active
    },
    role: {
      type: String,
      enum: [
        "admin",
        "user",
        "guest",
        "club_manager",
        "umpire",
        "jury_president",
      ], // Define roles
      default: "user", // Default role
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
    },

    cin: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    address: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    postalCode: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
