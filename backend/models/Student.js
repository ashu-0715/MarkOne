import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true }, // e.g. "XII"
    section: { type: String, required: true, trim: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A roll number must be unique within a given class (supports 500+ students per class safely)
studentSchema.index({ class: 1, rollNumber: 1 }, { unique: true });
// Fast lookups when listing a teacher's full roster (500+ students)
studentSchema.index({ teacher: 1, className: 1, section: 1 });

export default mongoose.model('Student', studentSchema);
