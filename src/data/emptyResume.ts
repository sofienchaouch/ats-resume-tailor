import { ResumeData } from '../types';

// Blank master resume used as the initial state for a fresh workspace.
export const emptyResume: ResumeData = {
  contact: {
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
  },
  summary: '',
  experience: [],
  skills: [],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
};
