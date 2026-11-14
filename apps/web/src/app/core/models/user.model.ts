export interface Registration {
  name: string;
  email: string;
  registrationNumber: string;
  password: string;
  whatsapp: string;
}

export interface User extends Registration {
  id: string;
  role: 'student' | 'support';
  isBlocked: boolean;
  isEmailConfirmed: boolean;
  ratingAverage: number;
  createdAt: string;
}
