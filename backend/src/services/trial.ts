// Length of the free Premium welcome trial a new student gets on finishing onboarding.
// Each grant stores its own length (trial_grants.trial_days), so changing this only
// affects new signups: students already on a trial keep the length they were promised.
export const TRIAL_DAYS: number = 5;

// "5 days" / "1 day", for user-facing copy.
export const TRIAL_LABEL = `${TRIAL_DAYS} day${TRIAL_DAYS === 1 ? '' : 's'}`;
