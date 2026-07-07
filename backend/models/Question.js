import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    type: {
      type: String,
      enum: ['mcq', 'true_false', 'fill_blank', 'assertion_reason'],
      required: true,
    },
    subject: { type: String, required: true, trim: true, index: true },
    chapter: { type: String, required: true, trim: true, index: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
    questionText: { type: String, required: true },
    options: [{ type: String }], // used for mcq / assertion_reason
    correctAnswer: { type: String, required: true },
    explanation: { type: String },
    marks: { type: Number, default: 1 },
    imageUrl: { type: String }, // Cloudinary URL, diagram or scanned image
    source: {
      type: String,
      enum: ['manual', 'pasted', 'lesson_ai', 'pdf_ocr', 'image_ocr', 'camera_ocr', 'prompt_ai'],
      default: 'manual',
    },
    contentHash: { type: String, index: true }, // used for duplicate detection in Question Bank
  },
  { timestamps: true }
);

questionSchema.index({ teacher: 1, subject: 1, chapter: 1, difficulty: 1 });

export default mongoose.model('Question', questionSchema);
