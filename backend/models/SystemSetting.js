import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  studentSystemActivatedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('SystemSetting', systemSettingSchema);
