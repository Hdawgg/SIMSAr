const mongoose = require('mongoose');

const employerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Households hire too, so a company name is optional.
    company: { type: String, trim: true, maxlength: 100, default: '' },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 80 },
    pincode: { type: String, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
    about: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployerProfile', employerProfileSchema);
