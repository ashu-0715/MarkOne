import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const otpSchema = new mongoose.Schema(
  {
    code: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      unique: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    institution: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    subjects: [
      {
        type: String,
        trim: true,
      },
    ],

    classesHandling: [
      {
        type: String,
        trim: true,
      },
    ],

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    mobileVerified: {
      type: Boolean,
      default: false,
    },

    otp: {
      type: otpSchema,
      select: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
teacherSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
teacherSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data
teacherSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  return obj;
};

export default mongoose.model("Teacher", teacherSchema);