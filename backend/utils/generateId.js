const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

const randomCode = (length) => {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
};

// e.g. TCH-7XQ82L
export const generateTeacherId = () => `TCH-${randomCode(6)}`;

// e.g. PHY12A83 - built from subject prefix + class label + random suffix
export const generateClassCode = (subject, className, section) => {
  const subjPrefix = subject.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  const classPart = className.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const sectionPart = (section || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `${subjPrefix}${classPart}${sectionPart}${randomCode(2)}`;
};
