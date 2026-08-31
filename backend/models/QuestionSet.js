import mongoose from 'mongoose';

const questionSetSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, required: true },
  },
  { timestamps: true }
);

questionSetSchema.index({ teacher: 1, normalizedTitle: 1 }, { unique: true });

export default mongoose.model('QuestionSet', questionSetSchema);
