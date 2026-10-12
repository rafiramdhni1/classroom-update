const mongoose = require('mongoose');

const adminMessageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  targetStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  }],
  targetKelas: [String],
  targetAngkatan: [Number],
  isGlobal: {
    type: Boolean,
    default: false,
  },
  targetType: {
    type: String,
    enum: ['all', 'kelas', 'student'],
    default: 'all',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  senderName: String,
  senderRole: String,
  isReadBy: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
    readAt: Date,
  }],
  expiresAt: Date,
}, { timestamps: true });

adminMessageSchema.index({ targetStudents: 1 });
adminMessageSchema.index({ targetKelas: 1 });
adminMessageSchema.index({ isGlobal: 1 });

module.exports = mongoose.model('AdminMessage', adminMessageSchema);
