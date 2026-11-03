const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

// One collection for every account. `role` decides which dashboard and
// which API routes a user can reach. Role-specific details live in
// WorkerProfile / EmployerProfile so this document stays small.
const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is not valid'],
    },
    // Never returned by queries unless explicitly asked for with .select('+passwordHash')
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, match: [/^[6-9]\d{9}$/, 'Phone must be a 10-digit Indian mobile number'] },
    isActive: { type: Boolean, default: true },
    // Cached from the Review collection so lists can show and sort by rating cheaply.
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

// Belt and braces: even if passwordHash was selected, never send it to a client.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
