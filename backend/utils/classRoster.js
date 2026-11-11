// Official student records use 12A1/12A2 as their stable class section.
// Class names and codes may include a subject or teacher prefix, so find the
// section token in either field before building a class-specific roster.
export const getRosterClassName = (classDoc) => {
  const values = [classDoc?.classCode, classDoc?.name];
  for (const value of values) {
    const match = String(value || '').toUpperCase().match(/12A[12]/);
    if (match) return match[0];
  }
  return null;
};
