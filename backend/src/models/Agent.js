const crypto = require('crypto');
const mongoose = require('mongoose');
const { STATUSES, VEHICLE_TYPES } = require('../constants');

/** Human-friendly public identifier, e.g. DA-1A2B3C4D. Unique-indexed; the service retries on collision. */
function generateAgentId() {
  return `DA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const agentSchema = new mongoose.Schema(
  {
    agentId: { type: String, default: generateAgentId, immutable: true, unique: true },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    serviceArea: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: STATUSES, default: 'active' },
    vehicleType: { type: String, enum: VEHICLE_TYPES, default: 'none' },
  },
  { timestamps: true, versionKey: false }
);

// Supports the common list filters (status / serviceArea) with newest-first ordering.
agentSchema.index({ status: 1, serviceArea: 1, createdAt: -1 });
agentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Agent', agentSchema);
module.exports.generateAgentId = generateAgentId;
