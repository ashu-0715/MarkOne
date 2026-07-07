import mongoose from 'mongoose';

const testSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    chapter: { type: String },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true }],
    timeLimitMinutes: { type: Number, required: true },
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    negativeMarking: { enabled: { type: Boolean, default: false }, value: { type: Number, default: 0 } },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    autoSubmit: { type: Boolean, default: true },
    showAnswersAfterSubmission: { type: Boolean, default: true },
    allowRetest: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    totalMarks: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Test', testSchema);
