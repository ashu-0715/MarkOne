import Teacher from '../models/Teacher.js';

export const ASH_TEST_TEACHER_ID = 'ASH2007';

const isLoopback = (host = '') => {
  const hostWithoutBrackets = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostWithoutBrackets === '::1') return true;
  const normalized = hostWithoutBrackets.split(':')[0];
  return normalized === 'localhost' || normalized === '127.0.0.1';
};

export const isLocalDevelopmentRequest = (req) => {
  if (process.env.NODE_ENV !== 'development' || !isLoopback(req.hostname)) return false;
  const origin = req.get('origin');
  if (!origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    return ['http:', 'https:'].includes(parsedOrigin.protocol) && isLoopback(parsedOrigin.hostname);
  } catch {
    return false;
  }
};

export const classMatchesStudentClass = (classDoc, className) => {
  const name = String(classDoc?.name || '').toUpperCase();
  const code = String(classDoc?.classCode || '').trim().toUpperCase();
  const tokenMatch = new RegExp(`(^|[^A-Z0-9])${className}([^A-Z0-9]|$)`).test(name);
  const romanLabel = className === '12A1' ? /(^|[^A-Z0-9])XII\s*A1([^A-Z0-9]|$)/.test(name) : /(^|[^A-Z0-9])XII\s*A2([^A-Z0-9]|$)/.test(name);
  return tokenMatch || romanLabel || code.endsWith(className);
};

export const classBelongsToAshTeacher = async (classDoc) => {
  if (!classDoc?.teacher) return false;
  const teacher = await Teacher.findById(classDoc.teacher).select('teacherId isActive').lean();
  return Boolean(teacher?.isActive && teacher.teacherId === ASH_TEST_TEACHER_ID);
};
