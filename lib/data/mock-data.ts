export type ClassRecord = {
  id: string;
  name: string;
  level: string;
  isActive: boolean;
};

export type FamilyRecord = {
  id: string;
  familyName: string;
  primaryContact: string;
  phone: string;
  email: string;
  address: string;
  status: "active" | "inactive";
};

export type StudentRecord = {
  id: string;
  familyId: string;
  classId: string;
  fullName: string;
  gender: "male" | "female";
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  admissionDate: string;
  status: "active" | "inactive" | "graduated" | "withdrawn";
  paymentFrequency: "monthly" | "quarterly";
  customMonthlyFeeKobo?: number;
  currentFeeKobo: number;
  outstandingKobo: number;
  lastPaymentDate?: string;
};

export const feeSettings = {
  monthlyKobo: 500_000,
  quarterlyKobo: 1_500_000,
  termKobo: 3_000_000,
  annualKobo: 6_000_000,
  currency: "NGN",
};

export const classCatalog: ClassRecord[] = [
  { id: "class-primary-1", name: "Primary 1", level: "Primary", isActive: true },
  { id: "class-primary-2", name: "Primary 2", level: "Primary", isActive: true },
  { id: "class-primary-3", name: "Primary 3", level: "Primary", isActive: true },
  { id: "class-secondary-1", name: "Secondary 1", level: "Secondary", isActive: true },
];

export const families: FamilyRecord[] = [
  {
    id: "family-1",
    familyName: "Family A",
    primaryContact: "Amina Yusuf",
    phone: "08012345678",
    email: "familya@example.com",
    address: "No. 1 Madrasah Road",
    status: "active",
  },
  {
    id: "family-2",
    familyName: "Family B",
    primaryContact: "Sulaiman Bello",
    phone: "08087654321",
    email: "familyb@example.com",
    address: "No. 2 Madrasah Road",
    status: "active",
  },
  {
    id: "family-3",
    familyName: "Family C",
    primaryContact: "Hauwa Salihu",
    phone: "08013579246",
    email: "familyc@example.com",
    address: "No. 3 Madrasah Road",
    status: "active",
  },
  {
    id: "family-4",
    familyName: "Family D",
    primaryContact: "Musa Ahmed",
    phone: "08024681357",
    email: "familyd@example.com",
    address: "No. 4 Madrasah Road",
    status: "active",
  },
];

export const students: StudentRecord[] = [
  {
    id: "student-1",
    familyId: "family-1",
    classId: "class-primary-1",
    fullName: "Abubakar Yusuf",
    gender: "male",
    parentName: "Amina Yusuf",
    parentPhone: "08012345678",
    parentEmail: "familya@example.com",
    admissionDate: "2021-09-10",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 1_500_000,
    lastPaymentDate: "2026-10-20",
  },
  {
    id: "student-2",
    familyId: "family-1",
    classId: "class-primary-2",
    fullName: "Maryam Yusuf",
    gender: "female",
    parentName: "Amina Yusuf",
    parentPhone: "08012345678",
    parentEmail: "familya@example.com",
    admissionDate: "2022-01-12",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 1_000_000,
    lastPaymentDate: "2026-10-18",
  },
  {
    id: "student-3",
    familyId: "family-1",
    classId: "class-primary-3",
    fullName: "Zainab Yusuf",
    gender: "female",
    parentName: "Amina Yusuf",
    parentPhone: "08012345678",
    parentEmail: "familya@example.com",
    admissionDate: "2023-01-07",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 450_000,
    lastPaymentDate: "2026-11-04",
  },
  {
    id: "student-4",
    familyId: "family-2",
    classId: "class-primary-1",
    fullName: "Ali Bello",
    gender: "male",
    parentName: "Sulaiman Bello",
    parentPhone: "08087654321",
    parentEmail: "familyb@example.com",
    admissionDate: "2020-09-15",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 700_000,
    lastPaymentDate: "2026-09-20",
  },
  {
    id: "student-5",
    familyId: "family-3",
    classId: "class-primary-2",
    fullName: "Musa Salihu",
    gender: "male",
    parentName: "Hauwa Salihu",
    parentPhone: "08013579246",
    parentEmail: "familyc@example.com",
    admissionDate: "2022-02-01",
    status: "active",
    paymentFrequency: "monthly",
    customMonthlyFeeKobo: 400_000,
    currentFeeKobo: 400_000,
    outstandingKobo: 800_000,
    lastPaymentDate: "2026-10-18",
  },
  {
    id: "student-6",
    familyId: "family-3",
    classId: "class-primary-3",
    fullName: "Fatima Salihu",
    gender: "female",
    parentName: "Hauwa Salihu",
    parentPhone: "08013579246",
    parentEmail: "familyc@example.com",
    admissionDate: "2023-04-03",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 1_200_000,
    lastPaymentDate: "2026-10-10",
  },
  {
    id: "student-7",
    familyId: "family-3",
    classId: "class-secondary-1",
    fullName: "Umar Salihu",
    gender: "male",
    parentName: "Hauwa Salihu",
    parentPhone: "08013579246",
    parentEmail: "familyc@example.com",
    admissionDate: "2024-08-13",
    status: "active",
    paymentFrequency: "monthly",
    currentFeeKobo: 500_000,
    outstandingKobo: 900_000,
    lastPaymentDate: "2026-10-14",
  },
  {
    id: "student-8",
    familyId: "family-4",
    classId: "class-primary-1",
    fullName: "Hassan Ahmed",
    gender: "male",
    parentName: "Musa Ahmed",
    parentPhone: "08024681357",
    parentEmail: "familyd@example.com",
    admissionDate: "2019-09-20",
    status: "active",
    paymentFrequency: "quarterly",
    currentFeeKobo: 500_000,
    outstandingKobo: 2_300_000,
    lastPaymentDate: "2026-12-01",
  },
];

export function findStudentById(id: string) {
  return students.find((student) => student.id === id);
}

export function findFamilyById(id: string) {
  return families.find((family) => family.id === id);
}

export function getStudentFamily(student: StudentRecord) {
  return findFamilyById(student.familyId);
}

export function getFamilyStudents(familyId: string) {
  return students.filter((student) => student.familyId === familyId);
}

export function getDashboardStats() {
  const totalStudents = students.length;
  const activeStudents = students.filter((student) => student.status === "active").length;
  const totalOutstanding = students.reduce((sum, student) => sum + student.outstandingKobo, 0);
  const expectedCollection = students.reduce((sum, student) => sum + (student.currentFeeKobo * 3), 0);

  return {
    totalStudents,
    activeStudents,
    totalOutstanding,
    expectedCollection,
  };
}

export function updateFees(newSettings: typeof feeSettings) {
  Object.assign(feeSettings, newSettings);
}

export function addClass(name: string, level: string) {
  const id = `class-${name.toLowerCase().replace(/\s+/g, "-")}`;
  classCatalog.push({ id, name, level, isActive: true });
}
