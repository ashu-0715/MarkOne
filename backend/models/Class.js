import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Physics XII A"
    subject: { type: String, required: true, trim: true },
    classCode: { type: String, unique: true, index: true }, // e.g. PHY12A83
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    studentCount: { type: Number, default: 0 }, // denormalized counter, avoids COUNT() over 500+ docs
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Class', classSchema);
