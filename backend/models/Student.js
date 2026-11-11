import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true }, // e.g. "XII"
    section: { type: String, trim: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', index: true },
    isActive: { type: Boolean, default: true },
    isOfficial: { type: Boolean, default: false, index: true },
    registerNumber: { type: String, trim: true },
    isTestAccount: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
    dashboardStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Historical and official identities may share a roll number within a class.
studentSchema.index({ class: 1, rollNumber: 1, isOfficial: 1, isTestAccount: 1 }, { unique: true });
studentSchema.index(
  { className: 1, registerNumber: 1 },
  { unique: true, partialFilterExpression: { isOfficial: true, registerNumber: { $type: 'string' } } }
);
studentSchema.index(
  { className: 1, registerNumber: 1, isTestAccount: 1 },
  { unique: true, partialFilterExpression: { isTestAccount: true } }
);
// Fast lookups when listing a teacher's full roster (500+ students)
studentSchema.index({ teacher: 1, className: 1, section: 1 });

export default mongoose.model('Student', studentSchema);
