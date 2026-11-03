// Text and icons for the three separate login flows.
export const ROLE_INFO = {
  worker: {
    title: 'Worker login',
    icon: 'bi-tools',
    blurb: 'Find jobs near you, track your bookings and build your Work Passport.',
    canRegister: true,
  },
  employer: {
    title: 'Employer login',
    icon: 'bi-briefcase',
    blurb: 'Post jobs, choose verified workers and rate the work.',
    canRegister: true,
  },
  admin: {
    title: 'Admin login',
    icon: 'bi-shield-lock',
    blurb: 'SIMSAR staff only. Review background checks and ITI certificates, set wage rates and moderate jobs.',
    canRegister: false,
  },
};
